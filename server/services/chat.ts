import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import { authenticateRequest } from "../auth";
import { getDb } from "../db";
import { chatMessages } from "../../drizzle/schema";
import { sql } from "drizzle-orm";

/**
 * Presence tracking (supports multiple tabs per user).
 * userId -> set(socketId)
 */
const onlineSocketsByUser = new Map<number, Set<string>>();

function addOnline(userId: number, socketId: string) {
  const set = onlineSocketsByUser.get(userId) ?? new Set<string>();
  const wasOffline = set.size === 0;
  set.add(socketId);
  onlineSocketsByUser.set(userId, set);
  return wasOffline; // true means user just transitioned offline->online
}

function removeOnline(userId: number, socketId: string) {
  const set = onlineSocketsByUser.get(userId);
  if (!set) return false;

  set.delete(socketId);
  if (set.size === 0) {
    onlineSocketsByUser.delete(userId);
    return true; // true means user just transitioned online->offline
  }

  onlineSocketsByUser.set(userId, set);
  return false;
}

function getOnlineUserIds() {
  return Array.from(onlineSocketsByUser.keys());
}

export type ConversationMetaForUser = {
  totalUnread: number;
  byUser: Record<
    string,
    {
      unreadCount: number;
      lastMessage: {
        id: number;
        fromUserId: number;
        toUserId: number | null;
        roomId: string | null;
        content: string;
        createdAt: Date;
      } | null;
    }
  >;
};

/**
 * Per-user conversation meta for direct messages:
 * - last message per otherUser
 * - unread count per otherUser
 * - total unread
 */
export async function getConversationMetaForUser(userId: number): Promise<ConversationMetaForUser> {
  const db = await getDb();
  if (!db) return { totalUnread: 0, byUser: {} };

  // 1) last message id per conversation partner (direct messages only)
  const lastIdsRes: any = await db.execute(sql`
    SELECT
      CASE
        WHEN fromUserId = ${userId} THEN toUserId
        ELSE fromUserId
      END AS otherUserId,
      MAX(id) AS lastId
    FROM chat_messages
    WHERE
      deletedAt IS NULL
      AND roomId IS NULL
      AND toUserId IS NOT NULL
      AND (fromUserId = ${userId} OR toUserId = ${userId})
    GROUP BY otherUserId
  `);

  const lastIdsRows = (lastIdsRes?.[0] ?? lastIdsRes) as Array<{ otherUserId: number; lastId: number }>;
  const lastIds = (lastIdsRows ?? [])
    .map((r) => Number(r.lastId))
    .filter((n) => Number.isFinite(n) && n > 0);

  let lastMessagesByOther: Record<string, ConversationMetaForUser["byUser"][string]["lastMessage"]> = {};

  if (lastIds.length) {
    const inClause = sql.join(lastIds.map((id) => sql`${id}`), sql`, `);

    const lastMsgsRes: any = await db.execute(sql`
      SELECT id, fromUserId, toUserId, roomId, content, createdAt
      FROM chat_messages
      WHERE id IN (${inClause})
    `);

    const lastMsgsRows = (lastMsgsRes?.[0] ?? lastMsgsRes) as Array<{
      id: number;
      fromUserId: number;
      toUserId: number | null;
      roomId: string | null;
      content: string;
      createdAt: Date;
    }>;

    // Map by "otherUserId" (computed again to avoid relying on join)
    for (const m of lastMsgsRows ?? []) {
      const other =
        Number(m.fromUserId) === userId ? Number(m.toUserId) : Number(m.fromUserId);
      if (!other) continue;
      lastMessagesByOther[String(other)] = {
        id: Number(m.id),
        fromUserId: Number(m.fromUserId),
        toUserId: m.toUserId == null ? null : Number(m.toUserId),
        roomId: m.roomId ?? null,
        content: String(m.content ?? ""),
        createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt as any),
      };
    }
  }

  // 2) unread counts grouped by sender (direct messages only)
  const unreadRes: any = await db.execute(sql`
    SELECT fromUserId AS otherUserId, COUNT(*) AS unreadCount
    FROM chat_messages
    WHERE
      deletedAt IS NULL
      AND roomId IS NULL
      AND toUserId = ${userId}
      AND isRead = false
    GROUP BY fromUserId
  `);

  const unreadRows = (unreadRes?.[0] ?? unreadRes) as Array<{ otherUserId: number; unreadCount: number }>;
  const unreadByOther: Record<string, number> = {};
  let totalUnread = 0;

  for (const r of unreadRows ?? []) {
    const otherId = String(Number(r.otherUserId));
    const c = Number(r.unreadCount) || 0;
    unreadByOther[otherId] = c;
    totalUnread += c;
  }

  // 3) Merge into byUser
  const byUser: ConversationMetaForUser["byUser"] = {};
  const allOtherIds = new Set<string>([
    ...Object.keys(lastMessagesByOther),
    ...Object.keys(unreadByOther),
  ]);

  for (const otherId of allOtherIds) {
    byUser[otherId] = {
      unreadCount: unreadByOther[otherId] ?? 0,
      lastMessage: lastMessagesByOther[otherId] ?? null,
    };
  }

  return { totalUnread, byUser };
}

export function setupChat(server: HttpServer) {
  const io = new SocketServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/chat/socket.io",
  });

  io.on("connection", async (socket) => {
    try {
      const req = socket.request as any;
      const user = await authenticateRequest(req).catch(() => null);

      if (!user) {
        socket.disconnect();
        return;
      }

      const userId = user.id as number;
      const userRole = user.role as string;

      socket.join(`user_${userId}`);

      if (userRole === "Admin" || userRole === "admin") {
        socket.join("admin_monitor");
      }

      // Presence
      const becameOnline = addOnline(userId, socket.id);

      // Send the full presence snapshot to the newly connected socket
      socket.emit("presence_state", { onlineUserIds: getOnlineUserIds() });

      // Broadcast only if this user transitioned offline -> online
      if (becameOnline) {
        socket.broadcast.emit("user_online", { userId });
      }

      console.log(`[Chat] User ${userId} (${userRole}) connected`);

      socket.on(
        "send_message",
        async (data: { toUserId?: number; roomId?: string; content: string }) => {
          const db = await getDb();
          if (!db) return;

          if (!data?.content || (!data.toUserId && !data.roomId)) return;

          const [result] = await db.insert(chatMessages).values({
            fromUserId: userId,
            toUserId: data.toUserId,
            roomId: data.roomId,
            content: data.content,
          });

          const messageId = (result as any).insertId;

          const messageData = {
            id: messageId,
            fromUserId: userId,
            fromUserName: user.name,
            toUserId: data.toUserId ?? null,
            roomId: data.roomId ?? null,
            content: data.content,
            createdAt: new Date(),
          };

          if (data.toUserId) {
            io.to(`user_${data.toUserId}`).emit("new_message", messageData);
          } else if (data.roomId) {
            io.to(data.roomId).emit("new_message", messageData);
          }

          socket.emit("new_message", messageData);
          io.to("admin_monitor").emit("monitor_message", messageData);
        }
      );

      // Typing indicator (direct messages; room typing can be added later)
      socket.on("typing", (data: { toUserId?: number; roomId?: string; isTyping?: boolean }) => {
        if (data?.toUserId) {
          io.to(`user_${data.toUserId}`).emit("typing", {
            fromUserId: userId,
            isTyping: !!data.isTyping,
          });
        } else if (data?.roomId) {
          io.to(data.roomId).emit("typing", {
            fromUserId: userId,
            isTyping: !!data.isTyping,
          });
        }
      });

      socket.on("disconnect", () => {
        const becameOffline = removeOnline(userId, socket.id);
        if (becameOffline) {
          socket.broadcast.emit("user_offline", { userId });
        }
        console.log(`[Chat] User ${userId} disconnected`);
      });
    } catch (err) {
      console.error("[Chat] Connection error:", err);
      socket.disconnect();
    }
  });

  return io;
}

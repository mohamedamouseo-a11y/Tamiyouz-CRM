import React, { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Send, Search, Minimize2, Maximize2, Smile } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

const LOGO_URL =
  "https://tamiyouz.com/wp-content/uploads/2025/06/logo_6c7f064383640f5c36d63389d45cf9ed_1x.webp";

type ChatUser = {
  id: number;
  name?: string | null;
  role?: string | null;
};

type ChatMessage = {
  id?: number;
  fromUserId: number;
  fromUserName?: string | null;
  toUserId?: number | null;
  roomId?: string | null;
  content: string;
  createdAt: string | Date;
};

type ConversationMeta = {
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
        createdAt: string | Date;
      } | null;
    }
  >;
};

function smartTimestamp(dt: Date, isRTL: boolean) {
  if (isToday(dt)) return format(dt, "HH:mm");
  if (isYesterday(dt)) return isRTL ? "أمس" : "Yesterday";
  return format(dt, "dd/MM");
}

function safeDate(d: string | Date) {
  const dd = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dd.getTime()) ? new Date() : dd;
}

/** Small, dependency-free emoji list (fast + simple). */
const EMOJIS = ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤝", "👍", "🔥", "🎉", "🙏", "✅", "❤️", "✨"];

function playBeep() {
  try {
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.03;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => undefined);
    }, 140);
  } catch {
    // ignore (autoplay restrictions, etc.)
  }
}

export default function SalesHeroesChat() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // ─── Draggable state ───────────────────────────────────────────────
  const [position, setPosition] = useState({ x: 40, y: 40 }); // distance from right/bottom
  const dragging = useRef(false);
  const dragStart = useRef({ px: 0, py: 0, sx: 0, sy: 0 });
  const wasDragged = useRef(false);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    dragging.current = true;
    wasDragged.current = false;
    dragStart.current = {
      px: e.clientX,
      py: e.clientY,
      sx: position.x,
      sy: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    const dx = dragStart.current.px - e.clientX;
    const dy = dragStart.current.py - e.clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged.current = true;
    const newX = Math.max(10, Math.min(window.innerWidth - 80, dragStart.current.sx + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 80, dragStart.current.sy + dy));
    setPosition({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
  const onlineSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);

  const [typingMap, setTypingMap] = useState<Record<number, boolean>>({});
  const typingTimeoutsRef = useRef<Record<number, any>>({});

  const socketRef = useRef<Socket | null>(null);
  const selectedUserRef = useRef<ChatUser | null>(null);
  const typingEmitRef = useRef<{ lastSentAt: number; isTyping: boolean }>({ lastSentAt: 0, isTyping: false });
  const stopTypingTimerRef = useRef<any>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Keep refs for isOpen/isMinimized so socket listeners see latest values without re-running the effect
  const isOpenRef = useRef(isOpen);
  const isMinimizedRef = useRef(isMinimized);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isMinimizedRef.current = isMinimized; }, [isMinimized]);

  // Keep a ref so socket listeners always see the latest selectedUser (without reconnecting).
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Users list (kept as-is from your existing structure).
  const {
    data: users,
    isLoading: isLoadingUsers,
    error: usersError,
  } = trpc.users.list.useQuery(undefined, { enabled: !!user });

  // New: per-conversation unread + last message preview.
  const {
    data: convoMeta,
    refetch: refetchConvoMeta,
  } = trpc.chat.getConversationMeta.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const markAsRead = trpc.chat.markAsRead.useMutation();

  // Stable refs for mutation/refetch so they can be used inside useEffect without causing re-runs
  const markAsReadRef = useRef(markAsRead);
  const refetchConvoMetaRef = useRef(refetchConvoMeta);
  useEffect(() => { markAsReadRef.current = markAsRead; }, [markAsRead]);
  useEffect(() => { refetchConvoMetaRef.current = refetchConvoMeta; }, [refetchConvoMeta]);

  const { data: history } = trpc.chat.getHistory.useQuery(
    { toUserId: selectedUser?.id as number },
    { enabled: !!selectedUser }
  );

  // Load history + mark as read when opening a conversation
  // FIX: Removed markAsRead and refetchConvoMeta from deps — use refs instead to prevent infinite loop
  useEffect(() => {
    if (!history) return;

    setMessages(history as ChatMessage[]);

    if (selectedUser) {
      markAsReadRef.current.mutate(
        { fromUserId: selectedUser.id },
        { onSuccess: () => refetchConvoMetaRef.current() }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, selectedUser]);

  // Socket: connect once per user session (not per selectedUser)
  // FIX: Removed isOpen, isMinimized, markAsRead, refetchConvoMeta from deps — use refs instead
  useEffect(() => {
    if (!user) return;

    if (!socketRef.current) {
      socketRef.current = io({
        path: "/api/chat/socket.io",
      });

      // Presence state (initial)
      socketRef.current.on("presence_state", (payload: { onlineUserIds?: number[] }) => {
        setOnlineUserIds(payload?.onlineUserIds ?? []);
      });

      // Presence delta
      socketRef.current.on("user_online", (payload: { userId: number }) => {
        setOnlineUserIds((prev) => (prev.includes(payload.userId) ? prev : [...prev, payload.userId]));
      });
      socketRef.current.on("user_offline", (payload: { userId: number }) => {
        setOnlineUserIds((prev) => prev.filter((id) => id !== payload.userId));
      });

      // Typing indicator
      socketRef.current.on("typing", (payload: { fromUserId: number; isTyping: boolean }) => {
        const fromId = payload?.fromUserId;
        if (!fromId) return;

        setTypingMap((prev) => ({ ...prev, [fromId]: !!payload.isTyping }));

        if (typingTimeoutsRef.current[fromId]) {
          clearTimeout(typingTimeoutsRef.current[fromId]);
        }

        // Auto-clear to avoid "stuck typing"
        typingTimeoutsRef.current[fromId] = setTimeout(() => {
          setTypingMap((prev) => ({ ...prev, [fromId]: false }));
        }, 1800);
      });

      // Messages
      socketRef.current.on("new_message", (msg: ChatMessage) => {
        // Always refresh conversation meta (last message + unread badges)
        refetchConvoMetaRef.current();

        const currentSelected = selectedUserRef.current;

        const isInActiveConversation =
          !!currentSelected &&
          ((msg.fromUserId === currentSelected.id && msg.toUserId === user.id) ||
            (msg.fromUserId === user.id && msg.toUserId === currentSelected.id));

        if (isInActiveConversation) {
          setMessages((prev) => [...prev, msg]);

          // If message is from the other user in the active chat, mark as read
          if (msg.fromUserId === currentSelected!.id) {
            markAsReadRef.current.mutate(
              { fromUserId: currentSelected!.id },
              { onSuccess: () => refetchConvoMetaRef.current() }
            );
          }
          return;
        }

        // If message is for me but I'm not actively viewing that conversation, play sound (when not active)
        if (msg.toUserId === user.id) {
          const isChatActive = isOpenRef.current && !isMinimizedRef.current && !document.hidden;
          if (!isChatActive) playBeep();
        }
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedUser]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (users ?? []).filter((u: ChatUser) => {
      if (u.id === user?.id) return false;
      if (!q) return true;
      return ((u.name as string) || "").toLowerCase().includes(q);
    });
  }, [users, searchQuery, user?.id]);

  const sortedUsers = useMemo(() => {
    const meta = (convoMeta as ConversationMeta | undefined)?.byUser ?? {};
    return [...filteredUsers].sort((a: ChatUser, b: ChatUser) => {
      const aLast = meta[String(a.id)]?.lastMessage?.createdAt;
      const bLast = meta[String(b.id)]?.lastMessage?.createdAt;
      const aT = aLast ? safeDate(aLast).getTime() : 0;
      const bT = bLast ? safeDate(bLast).getTime() : 0;
      if (bT !== aT) return bT - aT;
      return ((a.name || "") as string).localeCompare(((b.name || "") as string));
    });
  }, [filteredUsers, convoMeta]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedUser || !socketRef.current) return;

    socketRef.current.emit("send_message", {
      toUserId: selectedUser.id,
      content: inputValue.trim(),
    });

    // Stop typing state immediately after send
    socketRef.current.emit("typing", { toUserId: selectedUser.id, isTyping: false });
    typingEmitRef.current.isTyping = false;

    setInputValue("");
  };

  const emitTyping = (value: string) => {
    if (!selectedUser || !socketRef.current) return;

    const now = Date.now();
    const shouldSendTypingTrue =
      value.trim().length > 0 &&
      (!typingEmitRef.current.isTyping || now - typingEmitRef.current.lastSentAt > 450);

    if (shouldSendTypingTrue) {
      socketRef.current.emit("typing", { toUserId: selectedUser.id, isTyping: true });
      typingEmitRef.current = { lastSentAt: now, isTyping: true };
    }

    // Debounced stop typing
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(() => {
      if (!selectedUserRef.current || !socketRef.current) return;
      socketRef.current.emit("typing", { toUserId: selectedUserRef.current.id, isTyping: false });
      typingEmitRef.current.isTyping = false;
    }, 900);
  };

  const totalUnread = (convoMeta as ConversationMeta | undefined)?.totalUnread ?? 0;

  if (!user) return null;

  const selectedIsOnline = selectedUser ? onlineSet.has(selectedUser.id) : false;
  const selectedIsTyping = selectedUser ? !!typingMap[selectedUser.id] : false;

  return (
    <div
      className="fixed z-[9999] flex flex-col items-end"
      style={{ bottom: `${position.y}px`, right: `${position.x}px` }}
    >
      {isOpen && (
        <Card className="mb-4 w-80 md:w-96 shadow-2xl border-primary/20 flex flex-col overflow-hidden">
          <CardHeader className="p-3 bg-primary text-white flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <img src={LOGO_URL} alt="Tamiyouz" className="w-6 h-6 rounded-full" />
              <div className="min-w-0">
                <CardTitle className="text-sm font-bold truncate">
                  {selectedUser ? selectedUser.name : isRTL ? "شات أبطال المبيعات" : "Sales Heroes Chat"}
                </CardTitle>

                {selectedUser && (
                  <div className="text-[11px] opacity-90 flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full border border-white/60 ${
                        selectedIsOnline ? "bg-emerald-400" : "bg-gray-300"
                      }`}
                    />
                    <span className="truncate">
                      {selectedIsTyping
                        ? isRTL
                          ? "يكتب الآن..."
                          : "typing..."
                        : selectedIsOnline
                          ? isRTL
                            ? "متصل"
                            : "Online"
                          : isRTL
                            ? "غير متصل"
                            : "Offline"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/10"
                onClick={() => setIsMinimized((v) => !v)}
              >
                {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/10"
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                  setSelectedUser(null);
                }}
              >
                <X size={16} />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden bg-background">
              {selectedUser ? (
                <>
                  <div className="p-2 border-b flex items-center gap-2 bg-muted/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedUser(null)}
                    >
                      {isRTL ? "← رجوع" : "← Back"}
                    </Button>

                    <div className="flex-1 text-center font-medium text-xs truncate px-2">
                      {selectedUser.name}
                    </div>

                    <span
                      title={selectedIsOnline ? "Online" : "Offline"}
                      className={`inline-block h-2.5 w-2.5 rounded-full border border-primary/20 ${
                        selectedIsOnline ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    />
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((msg, i) => {
                        const mine = msg.fromUserId === user.id;
                        const dt = safeDate(msg.createdAt);
                        return (
                          <div key={msg.id ?? i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                                mine
                                  ? "bg-primary text-white rounded-br-none"
                                  : "bg-muted text-foreground rounded-bl-none"
                              }`}
                            >
                              {msg.content}
                              <div className={`text-[10px] mt-1 opacity-70 ${mine ? "text-right" : "text-left"}`}>
                                {smartTimestamp(dt, isRTL)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={bottomRef} />
                    </div>
                  </ScrollArea>

                  <form onSubmit={handleSendMessage} className="p-3 border-t flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                          <Smile size={18} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2 z-[10000]" side="top" align={isRTL ? "end" : "start"}>
                        <div className="grid grid-cols-8 gap-1">
                          {EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="h-8 w-8 rounded hover:bg-muted text-lg"
                              onClick={() => {
                                setInputValue((v) => v + emoji);
                                emitTyping(inputValue + emoji);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Input
                      placeholder={isRTL ? "اكتب رسالتك..." : "Type a message..."}
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        emitTyping(e.target.value);
                      }}
                      className={`flex-1 h-9 text-sm ${isRTL ? "text-right" : ""}`}
                    />

                    <Button type="submit" size="icon" className="h-9 w-9 shrink-0">
                      <Send size={16} className={isRTL ? "rotate-180" : ""} />
                    </Button>
                  </form>
                </>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search
                        className={`absolute top-2.5 h-4 w-4 text-muted-foreground ${
                          isRTL ? "right-2" : "left-2"
                        }`}
                      />
                      <Input
                        placeholder={isRTL ? "بحث عن زميل..." : "Search colleague..."}
                        className={`${isRTL ? "pr-8 text-right" : "pl-8"} h-9 text-sm`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="divide-y">
                      {isLoadingUsers ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          {isRTL ? "جاري تحميل الزملاء..." : "Loading colleagues..."}
                        </div>
                      ) : usersError ? (
                        <div className="p-8 text-center text-sm text-destructive">
                          {isRTL ? "خطأ في تحميل الزملاء" : "Error loading colleagues"}
                        </div>
                      ) : sortedUsers.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          {isRTL ? "لا يوجد زملاء متاحين حالياً" : "No colleagues available"}
                        </div>
                      ) : (
                        sortedUsers.map((u: ChatUser) => {
                          const meta = (convoMeta as ConversationMeta | undefined)?.byUser?.[String(u.id)];
                          const last = meta?.lastMessage ?? null;
                          const unread = meta?.unreadCount ?? 0;

                          const lastText = last?.content ?? "";
                          const lastDt = last?.createdAt ? safeDate(last.createdAt) : null;
                          const isOnline = onlineSet.has(u.id);

                          const previewPrefix =
                            last && last.fromUserId === user.id ? (isRTL ? "أنت: " : "You: ") : "";

                          return (
                            <div
                              key={u.id}
                              className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                              onClick={() => setSelectedUser(u)}
                            >
                              <div className="relative">
                                <Avatar className="h-9 w-9 border border-primary/10">
                                  <AvatarFallback className="bg-primary/5 text-primary">
                                    {((u.name as string) || "?")[0]?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>

                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                                    isOnline ? "bg-emerald-500" : "bg-gray-300"
                                  }`}
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-medium truncate">{u.name}</div>
                                  {lastDt && (
                                    <div className="text-[10px] text-muted-foreground shrink-0">
                                      {smartTimestamp(lastDt, isRTL)}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {lastText ? `${previewPrefix}${lastText}` : isRTL ? "لا توجد رسائل بعد" : "No messages yet"}
                                  </div>

                                  {unread > 0 && (
                                    <div className="min-w-[22px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                                      {unread > 99 ? "99+" : unread}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Button
        size="icon"
        className="h-16 w-16 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() => {
          if (wasDragged.current) return; // ignore click after drag
          setIsOpen((v) => !v);
          setIsMinimized(false);
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          <img src={LOGO_URL} alt="Tamiyouz Chat" className="w-11 h-11 object-contain" />
          {totalUnread > 0 && (
            <div className="absolute top-0 right-0 min-w-[24px] h-6 px-1.5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
              {totalUnread > 9 ? "+9" : totalUnread}
            </div>
          )}
        </div>
      </Button>
    </div>
  );
}

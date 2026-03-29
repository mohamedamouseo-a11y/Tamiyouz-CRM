import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/mysql-core";
import mysql from "mysql2/promise";
// ─── DB Pool ──────────────────────────────────────────────────────────────────
let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool) {
    _pool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _pool;
}
function getDb() {
  return drizzle(getPool());
}
// ─── InnoCall Settings Table (inline Drizzle schema) ──────────────────────────
const innocallSettings = mysqlTable("innocall_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
// ─── Types ────────────────────────────────────────────────────────────────────
export type InnoCallSettings = {
  innocall_api_key: string;
  innocall_extension: string;
  innocall_webrtc_secret: string;
  innocall_base_color: string;
  innocall_enabled: boolean;
  innocall_script_url: string;
};
// ─── Settings CRUD ────────────────────────────────────────────────────────────
export async function getInnoCallSettings(): Promise<InnoCallSettings> {
  const db = getDb();
  const rows = await db.select().from(innocallSettings);
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.settingKey, row.settingValue || "");
  }
  return {
    innocall_api_key: map.get("innocall_api_key") || "",
    innocall_extension: map.get("innocall_extension") || "",
    innocall_webrtc_secret: map.get("innocall_webrtc_secret") || "",
    innocall_base_color: map.get("innocall_base_color") || "#6366f1",
    innocall_enabled: (map.get("innocall_enabled") || "false") === "true",
    innocall_script_url: map.get("innocall_script_url") || "",
  };
}
export async function updateInnoCallSettings(input: InnoCallSettings) {
  const db = getDb();
  const pairs: Record<string, string> = {
    innocall_api_key: input.innocall_api_key || "",
    innocall_extension: input.innocall_extension || "",
    innocall_webrtc_secret: input.innocall_webrtc_secret || "",
    innocall_base_color: input.innocall_base_color || "#6366f1",
    innocall_enabled: input.innocall_enabled ? "true" : "false",
    innocall_script_url: input.innocall_script_url || "",
  };
  for (const [settingKey, settingValue] of Object.entries(pairs)) {
    await db
      .insert(innocallSettings)
      .values({ settingKey, settingValue })
      .onDuplicateKeyUpdate({
        set: {
          settingValue,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }
  return await getInnoCallSettings();
}

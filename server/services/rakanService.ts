import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import mysql from "mysql2/promise";
import {
  defaultDateRangeForReport,
  generateRakanReport,
  type AuthUserLike,
  type RakanReportType,
} from "./rakanReportGenerator";

// ─── DB Connection ─────────────────────────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  if (!_db) throw new Error("DB not initialized");
  return _db;
}

// ─── Raw MySQL pool for direct queries ────────────────────────────────────────
let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  if (!_pool) throw new Error("Pool not initialized");
  return _pool;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "Admin" | "SalesManager" | "SalesAgent" | "MediaBuyer" | "AccountManager" | "AccountManagerLead";

export interface RakanSetting {
  userId: number | null;
  settingKey: string;
  settingValue: string;
}

export interface ChatHistoryRow {
  id: number;
  userId: number;
  role: "user" | "assistant";
  content: string;
  audioUrl: string | null;
  createdAt: string;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface AnalyzeIntentResult {
  isReportRequest: boolean;
  reportType: RakanReportType | null;
  dateFrom: string | null;
  dateTo: string | null;
  confidence: number;
  reason?: string;
}

export interface RakanReportPayload {
  fileName: string;
  mimeType: string;
  url?: string;
  base64?: string;
}

export interface RakanChatResponse {
  kind: "text" | "report";
  answer: string;
  report?: RakanReportPayload;
  // Legacy fields for backward compatibility with existing frontend
  reply?: string;
  audioBase64?: string | null;
  mode?: "smart" | "normal";
}

// ─── Settings helpers ──────────────────────────────────────────────────────────
export async function getRakanSetting(key: string, userId?: number): Promise<string> {
  const pool = getPool();
  // Try user-specific first, then global
  if (userId) {
    const [rows] = await pool.execute(
      "SELECT settingValue FROM rakan_settings WHERE userId = ? AND settingKey = ? LIMIT 1",
      [userId, key]
    ) as any;
    if (rows.length > 0 && rows[0].settingValue) return rows[0].settingValue;
  }
  // For global settings: get latest non-empty value (ORDER BY id DESC handles duplicates)
  const [rows] = await pool.execute(
    "SELECT settingValue FROM rakan_settings WHERE userId IS NULL AND settingKey = ? AND settingValue != '' ORDER BY id DESC LIMIT 1",
    [key]
  ) as any;
  return rows.length > 0 ? rows[0].settingValue : "";
}

export async function upsertRakanSetting(key: string, value: string, userId?: number | null): Promise<void> {
  const pool = getPool();
  const uid = userId ?? null;
  await pool.execute(
    `INSERT INTO rakan_settings (userId, settingKey, settingValue)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), updatedAt = NOW()`,
    [uid, key, value]
  );
}

export async function getAllGlobalSettings(): Promise<Record<string, string>> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT settingKey, settingValue FROM rakan_settings WHERE userId IS NULL"
  ) as any;
  const result: Record<string, string> = {};
  for (const row of rows) result[row.settingKey] = row.settingValue;
  return result;
}

export async function getUserRakanSettings(userId: number): Promise<Record<string, string>> {
  const pool = getPool();
  const [rows] = await pool.execute(
    "SELECT settingKey, settingValue FROM rakan_settings WHERE userId = ?",
    [userId]
  ) as any;
  const result: Record<string, string> = {};
  for (const row of rows) result[row.settingKey] = row.settingValue;
  return result;
}

// ─── Chat History ──────────────────────────────────────────────────────────────
export async function saveChatMessage(
  userId: number,
  role: "user" | "assistant",
  content: string,
  audioUrl?: string
): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute(
    "INSERT INTO rakan_chat_history (userId, role, content, audioUrl) VALUES (?, ?, ?, ?)",
    [userId, role, content, audioUrl ?? null]
  ) as any;
  return result.insertId;
}

export async function getChatHistory(userId: number, limit = 20): Promise<ChatHistoryRow[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM rakan_chat_history WHERE userId = ? ORDER BY createdAt DESC LIMIT ${Number(limit)}`,
    [userId]
  ) as any;
  return (rows as ChatHistoryRow[]).reverse();
}

export async function clearChatHistory(userId: number): Promise<void> {
  const pool = getPool();
  await pool.execute("DELETE FROM rakan_chat_history WHERE userId = ?", [userId]);
}

// ─── DB Context Builder (role-based) ──────────────────────────────────────────
export async function buildDbContext(userId: number, role: UserRole, question: string): Promise<string> {
  const pool = getPool();
  const parts: string[] = [];
  const today = new Date().toISOString().split("T")[0];

  try {
    if (role === "Admin" || role === "SalesManager") {
      // Full team stats
      const [leadsToday] = await pool.execute(
        "SELECT COUNT(*) as cnt FROM leads WHERE DATE(createdAt) = ? AND deletedAt IS NULL",
        [today]
      ) as any;
      const [leadsTotal] = await pool.execute(
        "SELECT COUNT(*) as cnt FROM leads WHERE deletedAt IS NULL"
      ) as any;
      const [slaBreached] = await pool.execute(
        "SELECT COUNT(*) as cnt FROM leads WHERE slaBreached = 1 AND deletedAt IS NULL"
      ) as any;
      const [dealsWon] = await pool.execute(
        "SELECT COUNT(*) as cnt, SUM(valueSar) as total FROM deals WHERE status = 'Won' AND deletedAt IS NULL"
      ) as any;
      const [agentPerf] = await pool.execute(
        `SELECT u.name, COUNT(l.id) as leads, SUM(CASE WHEN d.status='Won' THEN 1 ELSE 0 END) as won
         FROM users u LEFT JOIN leads l ON l.ownerId = u.id AND l.deletedAt IS NULL
         LEFT JOIN deals d ON d.leadId = l.id AND d.deletedAt IS NULL
         WHERE u.role = 'SalesAgent' AND u.deletedAt IS NULL
         GROUP BY u.id, u.name ORDER BY leads DESC LIMIT 10`
      ) as any;
      const [campaigns] = await pool.execute(
        "SELECT name, platform, isActive FROM campaigns WHERE deletedAt IS NULL ORDER BY createdAt DESC LIMIT 10"
      ) as any;

      parts.push(`📊 إحصائيات اليوم (${today}):`);
      parts.push(`- ليدز اليوم: ${leadsToday[0].cnt}`);
      parts.push(`- إجمالي الليدز: ${leadsTotal[0].cnt}`);
      parts.push(`- SLA Breached: ${slaBreached[0].cnt}`);
      parts.push(`- صفقات مكسوبة: ${dealsWon[0].cnt} (${dealsWon[0].total ?? 0} SAR)`);
      parts.push(`\n👥 أداء الـ Sales Agents:`);
      for (const a of agentPerf) {
        parts.push(`- ${a.name}: ${a.leads} ليد، ${a.won} صفقة`);
      }
      parts.push(`\n📢 الحملات الأخيرة:`);
      for (const c of campaigns) {
        parts.push(`- ${c.name} (${c.platform}) - ${c.isActive ? "نشطة" : "متوقفة"}`);
      }

      // If question mentions a specific agent or client
      const nameMatch = question.match(/[\u0600-\u06FF\w]{3,}/g);
      if (nameMatch && nameMatch.length > 0) {
        for (const term of nameMatch.slice(0, 3)) {
          const [matchedLeads] = await pool.execute(
            `SELECT l.name, l.phone, l.stage, l.leadQuality, l.slaBreached,
                    u.name as ownerName, l.createdAt,
                    a.type as lastActivity, a.outcome as lastOutcome, a.activityTime as lastActivityTime
             FROM leads l
             LEFT JOIN users u ON u.id = l.ownerId
             LEFT JOIN activities a ON a.id = (SELECT id FROM activities WHERE leadId = l.id ORDER BY activityTime DESC LIMIT 1)
             WHERE (l.name LIKE ? OR u.name LIKE ?) AND l.deletedAt IS NULL
             LIMIT 5`,
            [`%${term}%`, `%${term}%`]
          ) as any;
          if (matchedLeads.length > 0) {
            parts.push(`\n🔍 نتائج البحث عن "${term}":`);
            for (const lead of matchedLeads) {
              parts.push(`- ${lead.name} | ${lead.phone} | المرحلة: ${lead.stage} | الجودة: ${lead.leadQuality} | المسؤول: ${lead.ownerName ?? "غير محدد"}`);
              if (lead.lastActivity) {
                parts.push(`  آخر نشاط: ${lead.lastActivity} - ${lead.lastOutcome} (${lead.lastActivityTime})`);
              }
            }
          }
        }
      }

    } else if (role === "SalesAgent") {
      // Only own leads
      const [myLeads] = await pool.execute(
        "SELECT COUNT(*) as cnt FROM leads WHERE ownerId = ? AND deletedAt IS NULL",
        [userId]
      ) as any;
      const [myLeadsToday] = await pool.execute(
        "SELECT COUNT(*) as cnt FROM leads WHERE ownerId = ? AND DATE(createdAt) = ? AND deletedAt IS NULL",
        [userId, today]
      ) as any;
      const [mySla] = await pool.execute(
        "SELECT COUNT(*) as cnt FROM leads WHERE ownerId = ? AND slaBreached = 1 AND deletedAt IS NULL",
        [userId]
      ) as any;
      const [myDeals] = await pool.execute(
        "SELECT COUNT(*) as cnt, SUM(d.valueSar) as total FROM deals d JOIN leads l ON l.id = d.leadId WHERE l.ownerId = ? AND d.status = 'Won' AND d.deletedAt IS NULL",
        [userId]
      ) as any;
      const [recentLeads] = await pool.execute(
        `SELECT l.name, l.phone, l.stage, l.leadQuality, l.slaBreached,
                a.type as lastActivity, a.outcome as lastOutcome, a.activityTime
         FROM leads l
         LEFT JOIN activities a ON a.id = (SELECT id FROM activities WHERE leadId = l.id ORDER BY activityTime DESC LIMIT 1)
         WHERE l.ownerId = ? AND l.deletedAt IS NULL
         ORDER BY l.updatedAt DESC LIMIT 10`,
        [userId]
      ) as any;

      parts.push(`📊 إحصائياتك (${today}):`);
      parts.push(`- ليدزك الكلي: ${myLeads[0].cnt}`);
      parts.push(`- ليدز اليوم: ${myLeadsToday[0].cnt}`);
      parts.push(`- SLA Breached: ${mySla[0].cnt}`);
      parts.push(`- صفقاتك المكسوبة: ${myDeals[0].cnt} (${myDeals[0].total ?? 0} SAR)`);
      parts.push(`\n📋 آخر 10 ليدز:`);
      for (const l of recentLeads) {
        parts.push(`- ${l.name ?? "بدون اسم"} | ${l.phone} | ${l.stage} | ${l.leadQuality}${l.slaBreached ? " ⚠️ SLA" : ""}`);
        if (l.lastActivity) parts.push(`  آخر نشاط: ${l.lastActivity} - ${l.lastOutcome}`);
      }

      // Search by name/phone
      const nameMatch = question.match(/[\u0600-\u06FF\w]{3,}/g);
      if (nameMatch) {
        for (const term of nameMatch.slice(0, 2)) {
          const [found] = await pool.execute(
            `SELECT l.name, l.phone, l.stage, l.leadQuality, l.slaBreached, l.notes,
                    a.type as lastActivity, a.outcome, a.notes as actNotes, a.activityTime
             FROM leads l
             LEFT JOIN activities a ON a.id = (SELECT id FROM activities WHERE leadId = l.id ORDER BY activityTime DESC LIMIT 1)
             WHERE l.ownerId = ? AND (l.name LIKE ? OR l.phone LIKE ?) AND l.deletedAt IS NULL
             LIMIT 3`,
            [userId, `%${term}%`, `%${term}%`]
          ) as any;
          if (found.length > 0) {
            parts.push(`\n🔍 نتائج "${term}":`);
            for (const f of found) {
              parts.push(`- ${f.name} | ${f.phone} | المرحلة: ${f.stage} | الجودة: ${f.leadQuality}`);
              if (f.notes) parts.push(`  ملاحظات: ${f.notes}`);
              if (f.lastActivity) parts.push(`  آخر نشاط: ${f.lastActivity} - ${f.outcome} - ${f.actNotes ?? ""} (${f.activityTime})`);
            }
          }
        }
      }

    } else if (role === "AccountManager" || role === "AccountManagerLead") {
      // Own clients
      const [myClients] = await pool.execute(
        "SELECT COUNT(*) as cnt FROM clients WHERE accountManagerId = ? AND deletedAt IS NULL",
        [userId]
      ) as any;
      const [renewalsDue] = await pool.execute(
        `SELECT c.leadName, c.contactPhone, ct.endDate, ct.contractRenewalStatus
         FROM clients c JOIN contracts ct ON ct.clientId = c.id
         WHERE c.accountManagerId = ? AND ct.endDate >= NOW() AND ct.endDate <= DATE_ADD(NOW(), INTERVAL 30 DAY)
         AND ct.deletedAt IS NULL AND c.deletedAt IS NULL
         ORDER BY ct.endDate ASC LIMIT 10`,
        [userId]
      ) as any;
      const [followUpsDue] = await pool.execute(
        `SELECT c.leadName, f.type, f.followUpDate, f.notes
         FROM follow_ups f JOIN clients c ON c.id = f.clientId
         WHERE f.userId = ? AND f.status = 'Pending' AND f.followUpDate <= DATE_ADD(NOW(), INTERVAL 7 DAY)
         ORDER BY f.followUpDate ASC LIMIT 10`,
        [userId]
      ) as any;

      parts.push(`📊 إحصائياتك:`);
      parts.push(`- عملاؤك: ${myClients[0].cnt}`);
      parts.push(`\n⚠️ عقود تنتهي خلال 30 يوم:`);
      for (const r of renewalsDue) {
        parts.push(`- ${r.leadName} | تنتهي: ${r.endDate} | حالة التجديد: ${r.contractRenewalStatus}`);
      }
      parts.push(`\n📅 متابعات مطلوبة (7 أيام):`);
      for (const f of followUpsDue) {
        parts.push(`- ${f.leadName} | ${f.type} | ${f.followUpDate} | ${f.notes ?? ""}`);
      }

      // Search client
      const nameMatch = question.match(/[\u0600-\u06FF\w]{3,}/g);
      if (nameMatch) {
        for (const term of nameMatch.slice(0, 2)) {
          const [found] = await pool.execute(
            `SELECT c.leadName, c.contactPhone, c.planStatus, c.healthScore, c.notes,
                    ct.endDate, ct.contractRenewalStatus, ct.charges
             FROM clients c LEFT JOIN contracts ct ON ct.clientId = c.id AND ct.deletedAt IS NULL
             WHERE c.accountManagerId = ? AND c.leadName LIKE ? AND c.deletedAt IS NULL
             LIMIT 3`,
            [userId, `%${term}%`]
          ) as any;
          if (found.length > 0) {
            parts.push(`\n🔍 نتائج "${term}":`);
            for (const f of found) {
              parts.push(`- ${f.leadName} | ${f.contactPhone} | الحالة: ${f.planStatus} | Health: ${f.healthScore}`);
              if (f.endDate) parts.push(`  العقد ينتهي: ${f.endDate} | التجديد: ${f.contractRenewalStatus} | القيمة: ${f.charges} SAR`);
              if (f.notes) parts.push(`  ملاحظات: ${f.notes}`);
            }
          }
        }
      }

    } else if (role === "MediaBuyer") {
      // Campaigns data
      const [campaigns] = await pool.execute(
        `SELECT name, platform, isActive, createdAt FROM campaigns WHERE deletedAt IS NULL ORDER BY createdAt DESC LIMIT 15`
      ) as any;
      const [leadsPerCampaign] = await pool.execute(
        `SELECT campaignName, COUNT(*) as cnt FROM leads WHERE deletedAt IS NULL AND campaignName IS NOT NULL
         GROUP BY campaignName ORDER BY cnt DESC LIMIT 10`
      ) as any;

      parts.push(`📢 الحملات (${campaigns.length} حملة):`);
      for (const c of campaigns) {
        parts.push(`- ${c.name} | ${c.platform} | ${c.isActive ? "نشطة" : "متوقفة"}`);
      }
      parts.push(`\n📊 ليدز لكل حملة:`);
      for (const l of leadsPerCampaign) {
        parts.push(`- ${l.campaignName}: ${l.cnt} ليد`);
      }
    }

  } catch (err: any) {
    console.error("[Rakan] DB context error:", err.message);
  }

  return parts.join("\n");
}

// ─── OpenAI-Compatible API Call (Fallback LLM) ──────────────────────────────
async function callOpenAICompatible(
  apiKey: string,
  baseUrl: string,
  model: string,
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add history (last 6 messages to keep it light)
  const recentHistory = history.slice(-6);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({ role: "user", content: userMessage });

  const body = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${err}`);
  }

  const data = await response.json() as any;
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from OpenAI-compatible API");
  return text;
}

// ─── Smart Fallback Response (Last Resort - No LLM) ────────────────────────
function generateStaticFallbackReply(
  rakanName: string,
  userName: string,
  role: UserRole,
  userMessage: string,
  dbContext: string
): string {
  const msg = userMessage.toLowerCase().trim();
  const parts: string[] = [];

  // ─── Detect intent ───
  const isGreeting = /^(هاي|هلا|مرحبا|السلام|صباح|مساء|عامل|ازيك|كيفك|hi|hello|hey|good|how are|what'?s up)/i.test(msg);
  const asksLeads = /(ليد|lead|عميل محتمل|عملاء محتمل)/i.test(msg);
  const asksDeals = /(صفق|deal|مبيع|sale|إيراد|revenue|كسب|won)/i.test(msg);
  const asksSla = /(sla|تأخ|breach|متأخر)/i.test(msg);
  const asksPerformance = /(أداء|perform|أفضل|best|ترتيب|rank|فريق|team|agent)/i.test(msg);
  const asksCampaign = /(حمل|campaign|إعلان|ad|تسويق|market)/i.test(msg);
  const asksRenewal = /(عقد|contract|تجديد|renew|ينتهي|expire)/i.test(msg);
  const asksFollowUp = /(متابع|follow|تذكير|remind)/i.test(msg);
  const asksCount = /(كم|عدد|how many|count|total|إجمالي)/i.test(msg);
  const asksHelp = /(مساعد|help|تقدر|ايه|شو|ماذا|what can)/i.test(msg);
  const asksWho = /(مين|من هو|who|انت مين)/i.test(msg);

  if (isGreeting && !asksLeads && !asksDeals && !asksSla && !asksPerformance && !asksCampaign) {
    const greetings = [
      `أهلاً ${userName}! 😊 إزيك النهارده؟ أنا ${rakanName} جاهز أساعدك في أي حاجة تخص النظام.`,
      `يا هلا ${userName}! 👋 تمام الحمد لله! إيه اللي أقدر أساعدك فيه؟`,
      `مرحباً ${userName}! 😄 أنا هنا عشان أخدمك. قولي إيه اللي محتاجه!`,
    ];
    parts.push(greetings[Math.floor(Math.random() * greetings.length)]);
    parts.push(``);
    parts.push(`ممكن تسألني عن:`);
    parts.push(`• 📊 إحصائيات الليدز والصفقات`);
    parts.push(`• 👥 أداء الفريق`);
    parts.push(`• 📢 الحملات التسويقية`);
    parts.push(`• ⚠️ تنبيهات SLA`);
    parts.push(`• 🔍 البحث عن عميل بالاسم`);
    parts.push(`• 📥 تقارير Excel (قولي "عايز تقرير أداء السيلز" أو "هات شيت بالتجديدات")`);

  } else if (asksWho) {
    parts.push(`أنا ${rakanName}! 🤖 مساعدك الذكي في نظام تميز CRM.`);
    parts.push(`بقدر أساعدك تتابع الليدز، الصفقات، أداء الفريق، الحملات، وأي حاجة تخص شغلك في النظام.`);
    parts.push(`وكمان بقدر أطلعلك تقارير Excel جاهزة! 📥`);

  } else if (asksHelp && !asksLeads && !asksDeals) {
    parts.push(`أهلاً ${userName}! أنا ${rakanName} وبقدر أساعدك في:`);
    parts.push(``);
    parts.push(`• 📊 "كم عدد الليدز اليوم؟" - إحصائيات الليدز`);
    parts.push(`• 💰 "إيه الصفقات المكسوبة؟" - بيانات الصفقات`);
    parts.push(`• 👥 "مين أفضل سيلز؟" - أداء الفريق`);
    parts.push(`• 📢 "إيه الحملات النشطة؟" - الحملات التسويقية`);
    parts.push(`• ⚠️ "كم ليد متأخر SLA؟" - تنبيهات SLA`);
    parts.push(`• 🔍 "ابحث عن أحمد" - البحث عن عميل`);
    parts.push(`• 📥 "عايز تقرير أداء السيلز" - تقارير Excel`);
    parts.push(`• 📥 "هات شيت بالتجديدات" - تقارير العقود`);

  } else if (dbContext && dbContext.trim().length > 0) {
    const dbLines = dbContext.split("\n");

    if (asksLeads || asksCount) {
      parts.push(`أهلاً ${userName}! هنا بيانات الليدز:`);
      parts.push(``);
      const leadLines = dbLines.filter(l =>
        l.includes("ليدز") || l.includes("إجمالي") || l.includes("lead") || l.includes("📊")
      );
      if (leadLines.length > 0) {
        parts.push(...leadLines);
      } else {
        parts.push(dbContext.split("\n\n")[0]);
      }

    } else if (asksDeals) {
      parts.push(`أهلاً ${userName}! هنا بيانات الصفقات:`);
      parts.push(``);
      const dealLines = dbLines.filter(l =>
        l.includes("صفق") || l.includes("deal") || l.includes("SAR") || l.includes("إيراد") || l.includes("مكسوب")
      );
      if (dealLines.length > 0) {
        parts.push(...dealLines);
      } else {
        parts.push(dbContext.split("\n\n")[0]);
      }

    } else if (asksSla) {
      parts.push(`أهلاً ${userName}! هنا حالة الـ SLA:`);
      parts.push(``);
      const slaLines = dbLines.filter(l =>
        l.includes("SLA") || l.includes("sla") || l.includes("breach") || l.includes("تأخ")
      );
      if (slaLines.length > 0) {
        parts.push(...slaLines);
      } else {
        parts.push(dbContext.split("\n\n")[0]);
      }

    } else if (asksPerformance) {
      parts.push(`أهلاً ${userName}! هنا أداء الفريق:`);
      parts.push(``);
      const perfLines: string[] = [];
      let inPerfSection = false;
      for (const line of dbLines) {
        if (line.includes("👥") || line.includes("أداء")) inPerfSection = true;
        if (inPerfSection) {
          perfLines.push(line);
          if (line === "" && perfLines.length > 2) break;
        }
      }
      if (perfLines.length > 0) {
        parts.push(...perfLines);
      } else {
        parts.push(dbContext);
      }

    } else if (asksCampaign) {
      parts.push(`أهلاً ${userName}! هنا الحملات:`);
      parts.push(``);
      const campLines: string[] = [];
      let inCampSection = false;
      for (const line of dbLines) {
        if (line.includes("📢") || line.includes("حمل")) inCampSection = true;
        if (inCampSection) {
          campLines.push(line);
        }
      }
      if (campLines.length > 0) {
        parts.push(...campLines);
      } else {
        parts.push(dbContext);
      }

    } else if (dbContext.includes("🔍")) {
      parts.push(`أهلاً ${userName}! هنا نتائج البحث:`);
      parts.push(``);
      const searchLines: string[] = [];
      let inSearchSection = false;
      for (const line of dbLines) {
        if (line.includes("🔍")) inSearchSection = true;
        if (inSearchSection) searchLines.push(line);
      }
      if (searchLines.length > 0) {
        parts.push(...searchLines);
      } else {
        parts.push(dbContext);
      }

    } else {
      parts.push(`أهلاً ${userName}! 👋`);
      parts.push(``);
      const firstSection = dbContext.split("\n\n")[0];
      parts.push(firstSection);
      parts.push(``);
      parts.push(`💡 لو عايز تفاصيل أكتر، اسألني عن حاجة محددة زي "كم ليد النهارده" أو "مين أفضل سيلز".`);
      parts.push(`📥 أو لو عايز تقرير Excel، قولي "عايز تقرير أداء السيلز" أو "هات شيت بالتجديدات".`);
    }
  } else {
    parts.push(`أهلاً ${userName}! 👋 أنا ${rakanName}.`);
    parts.push(`معنديش بيانات كافية عن سؤالك ده. ممكن تسألني عن الليدز، الصفقات، أداء الفريق، أو الحملات.`);
    parts.push(`📥 أو لو عايز تقرير Excel، قولي "عايز تقرير" وحدد النوع.`);
  }

  return parts.join("\n");
}

// ─── Gemini API Call ───────────────────────────────────────────────────────────
export async function callGemini(
  apiKey: string,
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<string> {
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents: any[] = [];

  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json() as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return text;
}

// ─── Google TTS ────────────────────────────────────────────────────────────────
export async function textToSpeech(
  ttsApiKey: string,
  text: string,
  voiceName: string,
  languageCode: string
): Promise<string | null> {
  if (!ttsApiKey) return null;

  try {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsApiKey}`;
    const body = {
      input: { text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.0, pitch: 0 },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const data = await response.json() as any;
    if (!data.audioContent) return null;

    return `data:audio/mp3;base64,${data.audioContent}`;
  } catch {
    return null;
  }
}

// ─── Detect language for TTS ───────────────────────────────────────────────────
export function detectLanguageCode(text: string): string {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(text) ? "ar" : "en";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report Intent Analysis (from drop-in)
// ═══════════════════════════════════════════════════════════════════════════════

function stripCodeFence(input: string): string {
  return input
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(stripCodeFence(text)) as T;
  } catch {
    return null;
  }
}

function lower(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const y = parsed.getFullYear();
  const m = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const d = `${parsed.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inferReportTypeHeuristically(message: string): RakanReportType | null {
  const text = lower(message);

  if (
    text.includes("أداء السيلز") ||
    text.includes("اداء السيلز") ||
    text.includes("sales performance") ||
    text.includes("conversion")
  ) {
    return "sales_performance";
  }

  if (
    text.includes("sla") ||
    text.includes("خروقات") ||
    text.includes("مهملة") ||
    text.includes("neglected leads")
  ) {
    return "sla_breaches";
  }

  if (
    text.includes("الأنشطة") ||
    text.includes("المتابعات") ||
    text.includes("activities") ||
    text.includes("follow-up")
  ) {
    return "activities_followups";
  }

  if (
    text.includes("التجديدات") ||
    text.includes("العقود") ||
    text.includes("renewals") ||
    text.includes("contracts")
  ) {
    return "contracts_renewals";
  }

  if (
    text.includes("متأخرة") ||
    text.includes("متابعة متأخرة") ||
    text.includes("delayed follow")
  ) {
    return "am_delayed_followups";
  }

  if (
    text.includes("إيرادات") ||
    text.includes("ايرادات") ||
    text.includes("upsell") ||
    text.includes("revenue")
  ) {
    return "am_revenue";
  }

  return null;
}

function looksLikeExcelRequest(message: string): boolean {
  const text = lower(message);
  return [
    "excel",
    "xlsx",
    "شيت",
    "sheet",
    "تقرير",
    "report",
    "تحميل",
    "download",
    "export",
    "اكسل",
  ].some((token) => text.includes(token));
}

function applyDefaultDates(
  intent: Partial<AnalyzeIntentResult>,
  userMessage: string,
): AnalyzeIntentResult {
  const reportType = intent.reportType ?? inferReportTypeHeuristically(userMessage);

  if (!reportType) {
    return {
      isReportRequest: false,
      reportType: null,
      dateFrom: null,
      dateTo: null,
      confidence: intent.confidence ?? 0.3,
      reason: intent.reason ?? "No supported report type detected",
    };
  }

  const fallbackRange = defaultDateRangeForReport(reportType, userMessage);

  return {
    isReportRequest: Boolean(intent.isReportRequest ?? looksLikeExcelRequest(userMessage)),
    reportType,
    dateFrom: normalizeDate(intent.dateFrom) ?? fallbackRange.dateFrom,
    dateTo: normalizeDate(intent.dateTo) ?? fallbackRange.dateTo,
    confidence: intent.confidence ?? 0.75,
    reason: intent.reason,
  };
}

async function callGeminiForIntent(
  apiKey: string,
  userMessage: string,
  history: ChatHistoryItem[],
): Promise<string | null> {
  if (!apiKey) return null;

  const GEMINI_MODEL = "gemini-2.0-flash";

  const historyPreview = history
    .slice(-6)
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n");

  const prompt = `
You are an intent analyzer for a CRM assistant named Rakan.
Return JSON only. No markdown. No explanation.

Task:
1) detect whether the user is asking for an Excel report.
2) map the request to one of these exact report types only:
   - sales_performance
   - sla_breaches
   - activities_followups
   - contracts_renewals
   - am_delayed_followups
   - am_revenue
3) extract dateFrom and dateTo in YYYY-MM-DD if possible.
4) if dates are not explicit, return null for them.
5) confidence is a number between 0 and 1.

Required JSON shape:
{
  "isReportRequest": boolean,
  "reportType": "sales_performance" | "sla_breaches" | "activities_followups" | "contracts_renewals" | "am_delayed_followups" | "am_revenue" | null,
  "dateFrom": string | null,
  "dateTo": string | null,
  "confidence": number,
  "reason": string
}

Examples:
- "عايز تقرير أداء السيلز من أول الشهر" => sales_performance
- "طلعلي شيت بالتجديدات اللي هتنتهي الشهر الجاي" => contracts_renewals
- "هات تقرير الأنشطة والمتابعات آخر 7 أيام" => activities_followups
- "مين عنده ليدز مهملة؟" => sla_breaches
- "وريني إيرادات مديري الحسابات هذا الشهر" => am_revenue

Conversation history:
${historyPreview || "(empty)"}

Last user message:
${userMessage}
  `.trim();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          topP: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) return null;

  const data = (await response.json()) as any;
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text ?? "")
      .join("") ?? null
  );
}

async function analyzeIntent(
  geminiApiKey: string,
  userMessage: string,
  history: ChatHistoryItem[],
): Promise<AnalyzeIntentResult> {
  const raw = await callGeminiForIntent(geminiApiKey, userMessage, history).catch(() => null);
  const parsed = raw ? safeJsonParse<AnalyzeIntentResult>(raw) : null;

  if (parsed) {
    return applyDefaultDates(parsed, userMessage);
  }

  return applyDefaultDates(
    {
      isReportRequest: looksLikeExcelRequest(userMessage),
      reportType: inferReportTypeHeuristically(userMessage),
      confidence: 0.55,
      reason: "Heuristic fallback",
    },
    userMessage,
  );
}

async function storeGeneratedReport(buffer: Buffer, fileName: string): Promise<string> {
  const downloadsDir = path.join(process.cwd(), "public", "downloads", "rakan");
  await mkdir(downloadsDir, { recursive: true });

  const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${fileName}`;
  const absolutePath = path.join(downloadsDir, uniqueName);

  await writeFile(absolutePath, buffer);
  return `/downloads/rakan/${uniqueName}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Rakan Chat Handler (merged: text-only + report generation)
// ═══════════════════════════════════════════════════════════════════════════════
export async function rakanChat(
  userId: number,
  role: UserRole,
  userName: string,
  userMessage: string,
  ttsVoicePreference?: string
): Promise<RakanChatResponse> {
  // 1. Get settings
  const geminiKey = await getRakanSetting("gemini_api_key");
  const ttsKey = await getRakanSetting("google_tts_api_key");
  const instructions = await getRakanSetting("rakan_instructions");
  const rakanName = await getRakanSetting("rakan_name") || "راكان";

  // Fallback LLM settings
  const fallbackApiKey = await getRakanSetting("fallback_llm_api_key");
  const fallbackBaseUrl = await getRakanSetting("fallback_llm_base_url") || "https://api.openai.com/v1";
  const fallbackModel = await getRakanSetting("fallback_llm_model") || "gpt-4.1-nano";

  // 2. Get chat history for intent analysis
  const history = await getChatHistory(userId, 10);
  const historyForLLM = history.map(h => ({ role: h.role, content: h.content }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Check if this is a report request FIRST
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const intent = await analyzeIntent(geminiKey, userMessage, historyForLLM);

    if (intent.isReportRequest && intent.reportType) {
      console.log(`[Rakan] 📊 Report request detected: ${intent.reportType} (confidence: ${intent.confidence})`);

      const generated = await generateRakanReport({
        reportType: intent.reportType,
        dateFrom: intent.dateFrom!,
        dateTo: intent.dateTo!,
        requestedBy: { id: userId, name: userName, role },
        delivery: "both",
      });

      let url: string | undefined;
      if (generated.buffer) {
        url = await storeGeneratedReport(generated.buffer, generated.fileName);
      }

      const labelMap: Record<RakanReportType, string> = {
        sales_performance: "تقرير أداء المبيعات والتحويل",
        sla_breaches: "تقرير خروقات SLA والليدز المهملة",
        activities_followups: "تقرير الأنشطة والمتابعات",
        contracts_renewals: "تقرير العقود والتجديدات",
        am_delayed_followups: "تقرير المتابعات المتأخرة لمديري الحسابات",
        am_revenue: "تقرير إيرادات مديري الحسابات",
      };

      const answer = `تفضل، هذا ${labelMap[intent.reportType]} من ${intent.dateFrom} إلى ${intent.dateTo}. (${generated.rowCount} صف)`;

      // Save to chat history
      await saveChatMessage(userId, "user", userMessage);
      await saveChatMessage(userId, "assistant", answer);

      return {
        kind: "report",
        answer,
        report: {
          fileName: generated.fileName,
          mimeType: generated.mimeType,
          url,
          base64: generated.base64,
        },
        // Legacy fields
        reply: answer,
        audioBase64: null,
        mode: "smart",
      };
    }
  } catch (err: any) {
    console.error("[Rakan] Report generation error:", err.message);
    // Fall through to normal text flow
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Normal text-only flow (existing logic preserved)
  // ═══════════════════════════════════════════════════════════════════════════
  const dbContext = await buildDbContext(userId, role as UserRole, userMessage);

  const systemPrompt = `${instructions || "أنت راكان، مساعد ذكاء اصطناعي متخصص في نظام CRM."}

اسمك: ${rakanName}
المستخدم الحالي: ${userName} (دور: ${role})
التاريخ والوقت الحالي: ${new Date().toLocaleString("ar-EG")}

البيانات المتاحة من النظام:
${dbContext}

تعليمات مهمة:
- ترد فقط بالبيانات الموجودة أعلاه، لا تخترع أرقاماً
- لو السؤال خارج نطاق صلاحيات المستخدم، اعتذر بأدب
- كن موجزاً ومفيداً وطبيعي في الكلام
- استخدم الأرقام والبيانات الحقيقية في ردودك
- لو حد سلم عليك أو قالك "عامل ايه"، رد عليه بشكل طبيعي وودود بدون ما ترمي كل البيانات
- لو سأل سؤال محدد، رد بالمعلومات المتعلقة بسؤاله بس
- اتكلم بالمصري أو بالعربي الطبيعي
- لو المستخدم طلب تقرير أو شيت Excel، قوله يقول "عايز تقرير أداء السيلز" أو "هات شيت بالتجديدات" وانت هتطلعهوله`;

  let reply: string;
  let mode: "smart" | "normal" = "smart";

  // Tier 1: Gemini API
  if (geminiKey) {
    try {
      reply = await callGemini(geminiKey, systemPrompt, historyForLLM, userMessage);
      mode = "smart";
      console.log("[Rakan] ✅ Tier 1: Gemini response successful");
    } catch (err: any) {
      console.warn("[Rakan] ❌ Tier 1: Gemini failed:", err.message);

      // Tier 2: Fallback LLM
      if (fallbackApiKey) {
        try {
          reply = await callOpenAICompatible(
            fallbackApiKey,
            fallbackBaseUrl,
            fallbackModel,
            systemPrompt,
            historyForLLM,
            userMessage
          );
          mode = "smart";
          console.log("[Rakan] ✅ Tier 2: Fallback LLM response successful");
        } catch (err2: any) {
          console.warn("[Rakan] ❌ Tier 2: Fallback LLM failed:", err2.message);
          reply = generateStaticFallbackReply(rakanName, userName, role as UserRole, userMessage, dbContext);
          mode = "normal";
          console.log("[Rakan] ⚠️ Tier 3: Using smart static fallback");
        }
      } else {
        reply = generateStaticFallbackReply(rakanName, userName, role as UserRole, userMessage, dbContext);
        mode = "normal";
        console.log("[Rakan] ⚠️ Tier 3: No fallback LLM, using smart static fallback");
      }
    }
  } else if (fallbackApiKey) {
    try {
      reply = await callOpenAICompatible(
        fallbackApiKey,
        fallbackBaseUrl,
        fallbackModel,
        systemPrompt,
        historyForLLM,
        userMessage
      );
      mode = "smart";
      console.log("[Rakan] ✅ Tier 2 (direct): Fallback LLM response successful");
    } catch (err: any) {
      console.warn("[Rakan] ❌ Tier 2 (direct): Fallback LLM failed:", err.message);
      reply = generateStaticFallbackReply(rakanName, userName, role as UserRole, userMessage, dbContext);
      mode = "normal";
      console.log("[Rakan] ⚠️ Tier 3: Using smart static fallback");
    }
  } else {
    console.log("[Rakan] ⚠️ No LLM configured, using smart static fallback");
    reply = generateStaticFallbackReply(rakanName, userName, role as UserRole, userMessage, dbContext);
    mode = "normal";
  }

  // Save to history
  await saveChatMessage(userId, "user", userMessage);
  await saveChatMessage(userId, "assistant", reply);

  // TTS
  let audioBase64: string | null = null;
  const voicePref = ttsVoicePreference || "ar_formal";

  if (voicePref !== "none" && ttsKey) {
    const lang = detectLanguageCode(reply);
    let voiceName: string;
    let langCode: string;

    if (lang === "ar") {
      const voiceMap: Record<string, string> = {
        ar_formal: await getRakanSetting("tts_voice_ar_formal") || "ar-XA-Wavenet-B",
        ar_egyptian: await getRakanSetting("tts_voice_ar_egyptian") || "ar-XA-Wavenet-A",
        ar_gulf: await getRakanSetting("tts_voice_ar_gulf") || "ar-XA-Wavenet-D",
      };
      voiceName = voiceMap[voicePref] || voiceMap["ar_formal"];
      langCode = "ar-XA";
    } else {
      voiceName = await getRakanSetting("tts_voice_en") || "en-US-Neural2-D";
      langCode = "en-US";
    }

    const ttsText = reply.length > 500 ? reply.substring(0, 500) + "..." : reply;
    audioBase64 = await textToSpeech(ttsKey, ttsText, voiceName, langCode);
  }

  return {
    kind: "text",
    answer: reply,
    // Legacy fields for backward compatibility
    reply,
    audioBase64,
    mode,
  };
}

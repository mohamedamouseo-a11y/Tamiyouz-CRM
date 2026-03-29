import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import mysql from "mysql2/promise";
import { buildRakanExecutiveReport, buildReportOverview } from "./rakanExecutiveReportService";
import { exportRakanReportBundle } from "./rakanExecutiveExportService";
import type { RakanExecutiveReportType, RakanExportBundle } from "./rakanExecutiveTypes";

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

  // ─── Respond based on intent ───
  if (isGreeting && !asksLeads && !asksDeals && !asksSla && !asksPerformance && !asksCampaign) {
    // Pure greeting - respond naturally
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

  } else if (asksWho) {
    parts.push(`أنا ${rakanName}! 🤖 مساعدك الذكي في نظام تميز CRM.`);
    parts.push(`بقدر أساعدك تتابع الليدز، الصفقات، أداء الفريق، الحملات، وأي حاجة تخص شغلك في النظام.`);

  } else if (asksHelp && !asksLeads && !asksDeals) {
    parts.push(`أهلاً ${userName}! أنا ${rakanName} وبقدر أساعدك في:`);
    parts.push(``);
    parts.push(`• 📊 "كم عدد الليدز اليوم؟" - إحصائيات الليدز`);
    parts.push(`• 💰 "إيه الصفقات المكسوبة؟" - بيانات الصفقات`);
    parts.push(`• 👥 "مين أفضل سيلز؟" - أداء الفريق`);
    parts.push(`• 📢 "إيه الحملات النشطة؟" - الحملات التسويقية`);
    parts.push(`• ⚠️ "كم ليد متأخر SLA؟" - تنبيهات SLA`);
    parts.push(`• 🔍 "ابحث عن أحمد" - البحث عن عميل`);

  } else if (dbContext && dbContext.trim().length > 0) {
    // Has DB context - show relevant sections based on intent
    const dbLines = dbContext.split("\n");

    if (asksLeads || asksCount) {
      // Filter to show only lead-related stats
      parts.push(`أهلاً ${userName}! هنا بيانات الليدز:`);
      parts.push(``);
      const leadLines = dbLines.filter(l =>
        l.includes("ليدز") || l.includes("إجمالي") || l.includes("lead") || l.includes("📊")
      );
      if (leadLines.length > 0) {
        parts.push(...leadLines);
      } else {
        parts.push(dbContext.split("\n\n")[0]); // First section
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
      // Search results found
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
      // General question - show a summary, not everything
      parts.push(`أهلاً ${userName}! 👋`);
      parts.push(``);
      // Show just the first stats section
      const firstSection = dbContext.split("\n\n")[0];
      parts.push(firstSection);
      parts.push(``);
      parts.push(`💡 لو عايز تفاصيل أكتر، اسألني عن حاجة محددة زي "كم ليد النهارده" أو "مين أفضل سيلز".`);
    }
  } else {
    parts.push(`أهلاً ${userName}! 👋 أنا ${rakanName}.`);
    parts.push(`معنديش بيانات كافية عن سؤالك ده. ممكن تسألني عن الليدز، الصفقات، أداء الفريق، أو الحملات.`);
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

  // Build contents array for Gemini
  const contents: any[] = [];

  // Add history (last 10 messages)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  // Add current user message
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

    // Return as base64 data URL
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

// ─── Main Rakan Chat Handler ───────────────────────────────────────────────────
export interface RakanChatReportAttachment {
  reportType: RakanExecutiveReportType;
  overview: string;
  files?: RakanExportBundle;
}

export interface RakanChatResponse {
  reply: string;
  audioBase64: string | null;
  mode: "smart" | "normal";
  report?: RakanChatReportAttachment;
}

function getRouteSpecificGuidance(currentRoute = "/"): string {
  const route = currentRoute.toLowerCase();
  if (route.includes("/leads")) {
    return "أنت داخل صفحة الليدز. ركّز على ترتيب الأولويات، الليدز المتوقفة، سوء استخدام Cold، والبيانات الناقصة.";
  }
  if (route.includes("/clients")) {
    return "أنت داخل صفحة العملاء. ركّز على صحة العميل، المتابعات المتأخرة، والتجديدات القريبة.";
  }
  if (route.includes("/campaign")) {
    return "أنت داخل صفحة الحملات. ركّز على جودة الليدز، الهدر المحتمل، ومقارنة النتائج بالإنفاق المتاح.";
  }
  if (route.includes("/dashboard")) {
    return "أنت داخل لوحة المتابعة التنفيذية. ابدأ دائمًا بالاختناقات ثم اعرض أهم 3 أولويات.";
  }
  return "قدّم تحليلًا تنفيذيًا واضحًا يربط بين نقص البيانات، ضعف المتابعة، والنتيجة التجارية.";
}

function detectExecutiveReportIntent(userMessage: string): {
  reportType?: RakanExecutiveReportType;
  wantsExcel: boolean;
  wantsDocument: boolean;
} {
  const msg = userMessage.toLowerCase();
  const asksReport = /(تقرير|report|ملف|اكسيل|excel|sheet|document|word|doc|ملخص|summary|طلع|هات|اعمل)/i.test(userMessage);
  const wantsExcel = /(excel|xlsx|sheet|شيت|اكسيل)/i.test(userMessage);
  const wantsDocument = /(document|word|doc|مستند|document)/i.test(userMessage);

  if (!asksReport) {
    return { wantsExcel, wantsDocument };
  }

  if (/(جودة البيانات|بيانات ناقصة|نقص البيانات|data quality|incomplete data|missing data|عك)/i.test(userMessage)) {
    return { reportType: "data_quality", wantsExcel, wantsDocument };
  }
  if (/(cold|كولد|cold misuse|lead cold|ليدز cold)/i.test(userMessage)) {
    return { reportType: "cold_misuse", wantsExcel, wantsDocument };
  }
  if (/(متابعة|follow|compliance|نشاط|activity|مهمل|واقف)/i.test(userMessage)) {
    return { reportType: "follow_up_compliance", wantsExcel, wantsDocument };
  }
  if (/(account manager|account managers|مدير الحساب|مديري الحسابات|am|عملاء)/i.test(msg)) {
    return { reportType: "account_management", wantsExcel, wantsDocument };
  }
  if (/(تجديد|تجديدات|renew|contract|contracts|عقد|عقود)/i.test(userMessage)) {
    return { reportType: "renewals_risk", wantsExcel, wantsDocument };
  }
  if (/(campaign|campaigns|حملات|حملة|media buyer|ads|اعلانات|إعلانات)/i.test(userMessage)) {
    return { reportType: "campaign_efficiency", wantsExcel, wantsDocument };
  }
  if (/(sales|مبيعات|صفقات|team|agents|سيلز|funnel)/i.test(userMessage)) {
    return { reportType: "sales_management", wantsExcel, wantsDocument };
  }
  if (/(ceo|executive|executive summary|شامل|ملخص تنفيذي|إدارة|الادارة|المدير التنفيذي)/i.test(userMessage)) {
    return { reportType: "ceo_master", wantsExcel, wantsDocument };
  }

  return { reportType: "ceo_master", wantsExcel, wantsDocument };
}

async function maybeBuildDeterministicReport(params: {
  userId: number;
  role: UserRole;
  userMessage: string;
}): Promise<RakanChatReportAttachment | null> {
  const intent = detectExecutiveReportIntent(params.userMessage);
  if (!intent.reportType) return null;

  const report = await buildRakanExecutiveReport({
    reportType: intent.reportType,
    role: params.role,
    userId: params.userId,
  });

  const shouldExport = intent.wantsExcel || intent.wantsDocument;
  const format = intent.wantsExcel && intent.wantsDocument
    ? "both"
    : intent.wantsDocument
      ? "document"
      : intent.wantsExcel
        ? "excel"
        : null;

  const files = format ? await exportRakanReportBundle(report, format) : undefined;
  return {
    reportType: intent.reportType,
    overview: buildReportOverview(report),
    files,
  };
}

export async function rakanChat(
  userId: number,
  role: UserRole,
  userName: string,
  userMessage: string,
  ttsVoicePreference?: string,
  currentRoute = "/",
): Promise<RakanChatResponse> {
  const geminiKey = await getRakanSetting("gemini_api_key");
  const ttsKey = await getRakanSetting("google_tts_api_key");
  const instructions = await getRakanSetting("rakan_instructions");
  const rakanName = (await getRakanSetting("rakan_name")) || "راكان";

  const fallbackApiKey = await getRakanSetting("fallback_llm_api_key");
  const fallbackBaseUrl = (await getRakanSetting("fallback_llm_base_url")) || "https://api.openai.com/v1";
  const fallbackModel = (await getRakanSetting("fallback_llm_model")) || "gpt-4.1-nano";

  const deterministicReport = await maybeBuildDeterministicReport({ userId, role, userMessage });
  if (deterministicReport) {
    const downloadLines: string[] = [];
    if (deterministicReport.files?.excel) {
      downloadLines.push(`رابط ملف Excel: ${deterministicReport.files.excel.fileUrl}`);
    }
    if (deterministicReport.files?.document) {
      downloadLines.push(`رابط الـ Document: ${deterministicReport.files.document.fileUrl}`);
    }

    const reply = [
      deterministicReport.overview,
      downloadLines.length ? "" : "",
      ...downloadLines,
      downloadLines.length
        ? "هذا التقرير مبني مباشرة على قاعدة بيانات الـ CRM الحالية، ومخصص للمتابعة والتحليل فقط دون تنفيذ أي إجراء تلقائي."
        : "لو تريد، أقدر في نفس اللحظة أجهزه لك كـ Excel أو Document بمجرد أن تطلب الصيغة المطلوبة.",
    ]
      .filter(Boolean)
      .join("\n");

    await saveChatMessage(userId, "user", userMessage);
    await saveChatMessage(userId, "assistant", reply);

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
        voiceName = (await getRakanSetting("tts_voice_en")) || "en-US-Neural2-D";
        langCode = "en-US";
      }
      const ttsText = reply.length > 500 ? `${reply.substring(0, 500)}...` : reply;
      audioBase64 = await textToSpeech(ttsKey, ttsText, voiceName, langCode);
    }

    return {
      reply,
      audioBase64,
      mode: "normal",
      report: deterministicReport,
    };
  }

  const dbContext = await buildDbContext(userId, role, userMessage);
  const routeGuidance = getRouteSpecificGuidance(currentRoute);

  const systemPrompt = `${instructions || "أنت راكان، مساعد تنفيذي استشاري داخل نظام CRM."}

اسمك: ${rakanName}
المستخدم الحالي: ${userName} (الدور: ${role})
التاريخ والوقت الحالي: ${new Date().toLocaleString("ar-EG")}
المسار الحالي: ${currentRoute}

سياق قاعدة البيانات:
${dbContext}

تعليمات تشغيل إلزامية:
- أنت مستشار وتحليلي فقط، ولا تقوم بأي تعديل مباشر أو إرسال أو تحديث للسجلات.
- ممنوع منعًا باتًا أن تدّعي أنك غيّرت حالة ليد أو أرسلت رسالة أو نفذت إجراء.
- ركّز على نقص البيانات، سوء المتابعة، الاختناقات، وحالات Cold المشكوك فيها.
- إذا طلب المستخدم تقريرًا أو ملفًا، اقترح الأنسب أو استخدم البيانات المتاحة فعليًا فقط.
- استخدم لهجة عربية مهنية وواضحة، وابدأ دائمًا بالأولوية الأعلى.
- ${routeGuidance}`;

  const history = await getChatHistory(userId, 10);
  const historyForLLM = history.map((h) => ({ role: h.role, content: h.content }));

  let reply: string;
  let mode: "smart" | "normal" = "smart";

  if (geminiKey) {
    try {
      reply = await callGemini(geminiKey, systemPrompt, historyForLLM, userMessage);
      mode = "smart";
      console.log("[Rakan] ✅ Tier 1: Gemini response successful");
    } catch (err: any) {
      console.warn("[Rakan] ❌ Tier 1: Gemini failed:", err.message);
      if (fallbackApiKey) {
        try {
          reply = await callOpenAICompatible(
            fallbackApiKey,
            fallbackBaseUrl,
            fallbackModel,
            systemPrompt,
            historyForLLM,
            userMessage,
          );
          mode = "smart";
          console.log("[Rakan] ✅ Tier 2: Fallback LLM response successful");
        } catch (err2: any) {
          console.warn("[Rakan] ❌ Tier 2: Fallback LLM failed:", err2.message);
          reply = generateStaticFallbackReply(rakanName, userName, role, userMessage, dbContext);
          mode = "normal";
        }
      } else {
        reply = generateStaticFallbackReply(rakanName, userName, role, userMessage, dbContext);
        mode = "normal";
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
        userMessage,
      );
      mode = "smart";
    } catch (err: any) {
      console.warn("[Rakan] ❌ Tier 2 (direct): Fallback LLM failed:", err.message);
      reply = generateStaticFallbackReply(rakanName, userName, role, userMessage, dbContext);
      mode = "normal";
    }
  } else {
    reply = generateStaticFallbackReply(rakanName, userName, role, userMessage, dbContext);
    mode = "normal";
  }

  await saveChatMessage(userId, "user", userMessage);
  await saveChatMessage(userId, "assistant", reply);

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

  return { reply, audioBase64, mode };
}

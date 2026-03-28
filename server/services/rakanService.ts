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
export type UserRole = "Admin" | "CEO" | "SalesManager" | "SalesAgent" | "MediaBuyer" | "AccountManager" | "AccountManagerLead";

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
function formatMetric(value: unknown, fractionDigits = 0): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function getRouteSpecificGuidance(currentRoute = "/"): string {
  const route = currentRoute.toLowerCase();

  if (route.includes("/leads")) {
    return "أنت داخل صفحة الليدز. ركّز على ترتيب الأولويات، سرعة الاستجابة، تحليل المرحلة الحالية، جودة الليد، وأفضل خطوة تالية مقترحة دون تنفيذ أي إجراء.";
  }

  if (route.includes("/clients")) {
    return "أنت داخل صفحة العملاء. ركّز على صحة العميل، مخاطر فقدانه، المتابعات المتأخرة، وفرص الاحتفاظ والتجديد، وقدّم توصيات فقط من دون أي تنفيذ مباشر.";
  }

  if (route.includes("/contracts")) {
    return "أنت داخل صفحة العقود. ركّز على العقود القريبة من الانتهاء، مخاطر عدم التجديد، وأفضل توصيات التفاوض والمتابعة دون تنفيذ أي إجراء.";
  }

  if (
    route.includes("/campaigns") ||
    route.includes("/meta") ||
    route.includes("/tiktok")
  ) {
    return "أنت داخل صفحة الحملات الإعلانية. ركّز على الإنفاق، CPL/CPA، جودة الليدز، ومواطن الهدر أو فرص التحسين، مع توصيات واضحة فقط.";
  }

  if (route.includes("/dashboard")) {
    return "أنت داخل لوحة القيادة. ابدأ بملخص تنفيذي قصير، ثم اذكر الاختناقات، المخاطر، وأهم 3 توصيات عملية.";
  }

  return "قدّم تحليلًا إداريًا واضحًا يربط المؤشرات بالسبب المحتمل والخطوة التالية المقترحة، مع الالتزام بالدور الاستشاري فقط.";
}

export async function buildDbContext(
  userId: number,
  role: UserRole,
  question: string,
  currentRoute = "/"
): Promise<string> {
  const pool = getPool();
  const parts: string[] = [];
  const routeGuidance = getRouteSpecificGuidance(currentRoute);
  const executiveRole = role === "Admin" || role === "CEO";

  parts.push(`سياق الشاشة الحالية: ${routeGuidance}`);
  parts.push(`سؤال المستخدم: ${question}`);

  try {
    if (executiveRole) {
      const [salesRows] = await pool.execute(
        `
          SELECT
            COUNT(*) AS wonDeals,
            COALESCE(SUM(valueSar), 0) AS totalSales
          FROM deals
          WHERE status = 'Won'
            AND deletedAt IS NULL
        `
      ) as any;

      const [adSpendRows] = await pool.execute(
        `
          SELECT COALESCE(SUM(spend), 0) AS totalAdSpend
          FROM (
            SELECT CAST(spend AS DECIMAL(12,2)) AS spend
            FROM meta_campaign_snapshots
            WHERE syncedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)

            UNION ALL

            SELECT CAST(spend AS DECIMAL(12,2)) AS spend
            FROM tiktok_campaign_snapshots
            WHERE syncedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          ) x
        `
      ) as any;

      const [stageRows] = await pool.execute(
        `
          SELECT stage, COUNT(*) AS total
          FROM leads
          WHERE deletedAt IS NULL
          GROUP BY stage
          ORDER BY total DESC
          LIMIT 10
        `
      ) as any;

      const [negotiationRows] = await pool.execute(
        `
          SELECT COUNT(*) AS stuckCount
          FROM leads l
          LEFT JOIN (
            SELECT leadId, MAX(activityTime) AS lastActivityTime
            FROM activities
            GROUP BY leadId
          ) a ON a.leadId = l.id
          WHERE l.deletedAt IS NULL
            AND l.stage = 'Negotiation'
            AND (
              a.lastActivityTime IS NULL OR
              a.lastActivityTime < DATE_SUB(NOW(), INTERVAL 7 DAY)
            )
        `
      ) as any;

      parts.push("ملخص تنفيذي للإدارة العليا:");
      parts.push(`- إجمالي الصفقات المكسوبة: ${formatMetric(salesRows[0]?.wonDeals)}`);
      parts.push(`- إجمالي المبيعات المحققة: ${formatMetric(salesRows[0]?.totalSales, 2)}`);
      parts.push(`- إجمالي الإنفاق الإعلاني خلال آخر 30 يومًا: ${formatMetric(adSpendRows[0]?.totalAdSpend, 2)}`);
      parts.push(`- عدد الليدز العالقة في مرحلة التفاوض لأكثر من 7 أيام: ${formatMetric(negotiationRows[0]?.stuckCount)}`);
      parts.push("أبرز الاختناقات حسب المرحلة:");
      for (const row of stageRows as any[]) {
        parts.push(`- ${row.stage}: ${formatMetric(row.total)} ليد`);
      }
    } else if (role === "MediaBuyer") {
      const [campaignRows] = await pool.execute(
        `
          SELECT
            platform,
            campaignName,
            ROUND(SUM(spend), 2) AS totalSpend,
            SUM(conversions) AS totalConversions,
            ROUND(AVG(NULLIF(cpa, 0)), 2) AS avgCpa
          FROM (
            SELECT 'Meta' AS platform, campaignName, CAST(spend AS DECIMAL(12,2)) AS spend, CAST(conversions AS UNSIGNED) AS conversions, CAST(cpa AS DECIMAL(12,2)) AS cpa
            FROM meta_campaign_snapshots
            WHERE syncedAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)

            UNION ALL

            SELECT 'TikTok' AS platform, campaignName, CAST(spend AS DECIMAL(12,2)) AS spend, CAST(conversions AS UNSIGNED) AS conversions, CAST(cpa AS DECIMAL(12,2)) AS cpa
            FROM tiktok_campaign_snapshots
            WHERE syncedAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)
          ) t
          WHERE campaignName IS NOT NULL AND campaignName <> ''
          GROUP BY platform, campaignName
          ORDER BY totalSpend DESC
          LIMIT 12
        `
      ) as any;

      const [leadQualityRows] = await pool.execute(
        `
          SELECT
            COALESCE(campaignName, 'Direct / Unknown') AS campaignName,
            SUM(CASE WHEN leadQuality = 'Hot' THEN 1 ELSE 0 END) AS hotLeads,
            SUM(CASE WHEN leadQuality = 'Warm' THEN 1 ELSE 0 END) AS warmLeads,
            SUM(CASE WHEN leadQuality = 'Cold' THEN 1 ELSE 0 END) AS coldLeads,
            SUM(CASE WHEN leadQuality = 'Bad' THEN 1 ELSE 0 END) AS badLeads,
            COUNT(*) AS totalLeads
          FROM leads
          WHERE deletedAt IS NULL
          GROUP BY COALESCE(campaignName, 'Direct / Unknown')
          ORDER BY totalLeads DESC
          LIMIT 12
        `
      ) as any;

      parts.push("ملخص تحليلي لإدارة الميديا بايينج:");
      parts.push("أداء الحملات خلال آخر 14 يومًا:");
      for (const row of campaignRows as any[]) {
        parts.push(`- ${row.platform} | ${row.campaignName}: إنفاق ${formatMetric(row.totalSpend, 2)} | تحويلات ${formatMetric(row.totalConversions)} | متوسط CPA/CPL = ${formatMetric(row.avgCpa, 2)}`);
      }
      parts.push("توزيع جودة الليدز حسب الحملة:");
      for (const row of leadQualityRows as any[]) {
        parts.push(`- ${row.campaignName}: Hot ${formatMetric(row.hotLeads)} | Warm ${formatMetric(row.warmLeads)} | Cold ${formatMetric(row.coldLeads)} | Bad ${formatMetric(row.badLeads)} | الإجمالي ${formatMetric(row.totalLeads)}`);
      }
    } else if (role === "SalesManager") {
      const [agentRows] = await pool.execute(
        `
          SELECT
            u.id,
            COALESCE(u.name, CONCAT('User #', u.id)) AS agentName,
            COUNT(DISTINCT l.id) AS totalLeads,
            COUNT(DISTINCT CASE WHEN d.status = 'Won' THEN d.id END) AS wonDeals,
            ROUND(
              100 * COUNT(DISTINCT CASE WHEN d.status = 'Won' THEN d.id END)
              / NULLIF(COUNT(DISTINCT l.id), 0),
              1
            ) AS winRate,
            SUM(
              CASE WHEN l.stage = 'New' AND l.createdAt <= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
              THEN 1 ELSE 0 END
            ) AS slaRiskLeads
          FROM users u
          LEFT JOIN leads l
            ON l.ownerId = u.id
           AND l.deletedAt IS NULL
          LEFT JOIN deals d
            ON d.leadId = l.id
           AND d.deletedAt IS NULL
          WHERE u.role = 'SalesAgent'
            AND u.deletedAt IS NULL
            AND u.isActive = 1
          GROUP BY u.id, u.name
          ORDER BY totalLeads DESC
          LIMIT 15
        `
      ) as any;

      const [slaRows] = await pool.execute(
        `
          SELECT
            COALESCE(u.name, 'غير محدد') AS agentName,
            COUNT(*) AS breaches
          FROM leads l
          LEFT JOIN users u ON u.id = l.ownerId
          WHERE l.deletedAt IS NULL
            AND l.stage = 'New'
            AND l.createdAt <= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
          GROUP BY u.id, u.name
          ORDER BY breaches DESC
          LIMIT 10
        `
      ) as any;

      const [stageRows] = await pool.execute(
        `
          SELECT stage, COUNT(*) AS total
          FROM leads
          WHERE deletedAt IS NULL
          GROUP BY stage
          ORDER BY total DESC
          LIMIT 8
        `
      ) as any;

      parts.push("لوحة مدير المبيعات:");
      parts.push("أداء الفريق:");
      for (const row of agentRows as any[]) {
        parts.push(`- ${row.agentName}: ليدز ${formatMetric(row.totalLeads)} | صفقات مكسوبة ${formatMetric(row.wonDeals)} | معدل الفوز ${formatMetric(row.winRate, 1)}% | ليدز في خطر SLA ${formatMetric(row.slaRiskLeads)}`);
      }
      parts.push("خروقات SLA أو حالات التأخر الحالية:");
      for (const row of slaRows as any[]) {
        parts.push(`- ${row.agentName}: ${formatMetric(row.breaches)} حالة`);
      }
      parts.push("المراحل الأكثر ازدحامًا:");
      for (const row of stageRows as any[]) {
        parts.push(`- ${row.stage}: ${formatMetric(row.total)} ليد`);
      }
    } else if (role === "SalesAgent") {
      const [myStageRows] = await pool.execute(
        `
          SELECT stage, COUNT(*) AS total
          FROM leads
          WHERE ownerId = ?
            AND deletedAt IS NULL
          GROUP BY stage
          ORDER BY total DESC
        `,
        [userId]
      ) as any;

      const [myDealsRows] = await pool.execute(
        `
          SELECT
            COUNT(DISTINCT CASE WHEN d.status = 'Won' THEN d.id END) AS wonDeals,
            COALESCE(SUM(CASE WHEN d.status = 'Won' THEN d.valueSar ELSE 0 END), 0) AS wonValue
          FROM deals d
          INNER JOIN leads l ON l.id = d.leadId
          WHERE l.ownerId = ?
            AND l.deletedAt IS NULL
            AND d.deletedAt IS NULL
        `,
        [userId]
      ) as any;

      const [myUnattendedRows] = await pool.execute(
        `
          SELECT
            l.id,
            COALESCE(l.name, CONCAT('Lead #', l.id)) AS leadName,
            l.stage,
            l.leadQuality,
            MAX(a.activityTime) AS lastActivityTime
          FROM leads l
          LEFT JOIN activities a ON a.leadId = l.id
          WHERE l.ownerId = ?
            AND l.deletedAt IS NULL
          GROUP BY l.id, l.name, l.stage, l.leadQuality
          HAVING lastActivityTime IS NULL
              OR lastActivityTime < DATE_SUB(NOW(), INTERVAL 24 HOUR)
          ORDER BY lastActivityTime ASC
          LIMIT 10
        `,
        [userId]
      ) as any;

      parts.push("لوحة المستشار البيعي:");
      parts.push("توزيع الليدز حسب المرحلة:");
      for (const row of myStageRows as any[]) {
        parts.push(`- ${row.stage}: ${formatMetric(row.total)} ليد`);
      }
      parts.push(`- صفقاتك المكسوبة: ${formatMetric(myDealsRows[0]?.wonDeals)} بقيمة ${formatMetric(myDealsRows[0]?.wonValue, 2)}`);
      parts.push("أولويات المتابعة اليوم:");
      for (const row of myUnattendedRows as any[]) {
        parts.push(`- ${row.leadName} | المرحلة: ${row.stage} | الجودة: ${row.leadQuality} | آخر نشاط: ${row.lastActivityTime ?? 'لا يوجد'}`);
      }
    } else if (role === "AccountManager" || role === "AccountManagerLead") {
      const [clientSummaryRows] = await pool.execute(
        `
          SELECT
            COUNT(*) AS totalClients,
            SUM(CASE WHEN COALESCE(healthScore, 0) < 50 THEN 1 ELSE 0 END) AS riskyClients
          FROM clients
          WHERE accountManagerId = ?
            AND deletedAt IS NULL
        `,
        [userId]
      ) as any;

      const [renewalRows] = await pool.execute(
        `
          SELECT
            c.id AS clientId,
            COALESCE(c.leadName, CONCAT('Client #', c.id)) AS clientName,
            ct.endDate,
            ct.contractRenewalStatus
          FROM clients c
          INNER JOIN contracts ct ON ct.clientId = c.id
          WHERE c.accountManagerId = ?
            AND c.deletedAt IS NULL
            AND ct.deletedAt IS NULL
            AND ct.endDate IS NOT NULL
            AND ct.endDate <= DATE_ADD(NOW(), INTERVAL 30 DAY)
          ORDER BY ct.endDate ASC
          LIMIT 12
        `,
        [userId]
      ) as any;

      const [followUpGapRows] = await pool.execute(
        `
          SELECT
            c.id AS clientId,
            COALESCE(c.leadName, CONCAT('Client #', c.id)) AS clientName,
            c.healthScore,
            MAX(f.followUpDate) AS lastFollowUpDate
          FROM clients c
          LEFT JOIN follow_ups f ON f.clientId = c.id
          WHERE c.accountManagerId = ?
            AND c.deletedAt IS NULL
          GROUP BY c.id, c.leadName, c.healthScore
          HAVING lastFollowUpDate IS NULL
              OR lastFollowUpDate < DATE_SUB(NOW(), INTERVAL 14 DAY)
          ORDER BY lastFollowUpDate ASC
          LIMIT 12
        `,
        [userId]
      ) as any;

      parts.push("لوحة إدارة الحسابات:");
      parts.push(`- إجمالي العملاء: ${formatMetric(clientSummaryRows[0]?.totalClients)}`);
      parts.push(`- العملاء المعرضون للخطر: ${formatMetric(clientSummaryRows[0]?.riskyClients)}`);
      parts.push("العقود القريبة من الانتهاء:");
      for (const row of renewalRows as any[]) {
        parts.push(`- ${row.clientName}: نهاية العقد ${row.endDate} | حالة التجديد ${row.contractRenewalStatus}`);
      }
      parts.push("العملاء الذين يحتاجون متابعة استباقية:");
      for (const row of followUpGapRows as any[]) {
        parts.push(`- ${row.clientName}: Health Score = ${formatMetric(row.healthScore)} | آخر متابعة = ${row.lastFollowUpDate ?? 'لا توجد'}`);
      }
    }

    parts.push("ضوابط تشغيل راكان:");
    parts.push("- دورك استشاري فقط.");
    parts.push("- ممنوع تنفيذ أي تحديث أو إرسال أو تعديل مباشر داخل النظام.");
    parts.push("- مهمتك تحليل البيانات، كشف المخاطر، وترتيب الأولويات مع اقتراح أفضل خطوة تالية فقط.");
  } catch (error: any) {
    console.error("[Rakan] buildDbContext error:", error?.message || error);
    parts.push("تعذر تحميل بعض المؤشرات من قاعدة البيانات. استخدم فقط ما هو متاح واذكر حدود البيانات بوضوح.");
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
  ttsVoicePreference?: string,
  currentRoute = "/"
): Promise<RakanChatResponse> {
  const geminiKey = await getRakanSetting("gemini_api_key");
  const ttsKey = await getRakanSetting("google_tts_api_key");
  const instructions = await getRakanSetting("rakan_instructions");
  const rakanName = (await getRakanSetting("rakan_name")) || "راكان";

  const fallbackApiKey = await getRakanSetting("fallback_llm_api_key");
  const fallbackBaseUrl =
    (await getRakanSetting("fallback_llm_base_url")) || "https://api.openai.com/v1";
  const fallbackModel =
    (await getRakanSetting("fallback_llm_model")) || "gpt-4.1-nano";

  const history = await getChatHistory(userId, 10);
  const historyForLLM = history.map((h) => ({ role: h.role, content: h.content }));

  try {
    const intent = await analyzeIntent(geminiKey, userMessage, historyForLLM);

    if (intent.isReportRequest && intent.reportType) {
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

      const answer =
        `تم تجهيز ${labelMap[intent.reportType]} للفترة من ${intent.dateFrom} إلى ${intent.dateTo}. ` +
        `هذا التقرير مخصص للتحليل والدعم الإداري فقط ولا يتضمن أي تنفيذ مباشر داخل النظام.`;

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
        reply: answer,
        audioBase64: null,
        mode: "smart",
      };
    }
  } catch (err: any) {
    console.error("[Rakan] Report intent analysis error:", err?.message);
  }

  const dbContext = await buildDbContext(userId, role, userMessage, currentRoute);
  const routeGuidance = getRouteSpecificGuidance(currentRoute);

  const systemPrompt = `${instructions || "أنت راكان، مدير ذكاء اصطناعي استشاري داخل نظام CRM."}

اسمك: ${rakanName}
المستخدم الحالي: ${userName}
الدور الحالي: ${role}
الوقت الحالي: ${new Date().toLocaleString("ar-EG")}
المسار الحالي داخل النظام: ${currentRoute}

سياق العمل:
${dbContext}

تعليمات تشغيل إلزامية:
- أنت مساعد استشاري فقط، ولست منفذًا لأي إجراءات.
- ممنوع منعًا باتًا أن تدّعي أنك عدّلت بيانات، أو أرسلت رسالة، أو حدّثت سجلًا، أو غيّرت حالة، أو أنشأت مهمة.
- عندما يطلب منك المستخدم تنفيذ إجراء مباشر، وضّح باحتراف أنك لا تنفذ الإجراءات، ثم قدّم له توصية عملية وخطوات مقترحة فقط.
- مهمتك الأساسية: التحليل، اكتشاف الاختناقات، تحديد المخاطر، ترتيب الأولويات، وتقديم توصيات تنفيذية للإدارة والفرق.
- استخدم فقط الأرقام والسياق المتاحين لك. إذا كانت البيانات غير كافية فقل ذلك بوضوح.
- لا تخترع مؤشرات أو نتائج غير موجودة.
- اجعل الردود مهنية، مختصرة، وذات قيمة تنفيذية.
- عند عرض التوصيات، رتّبها بحسب الأولوية: عاجل، مهم، تحسين.
- عند الحديث عن المبيعات أو خدمة العملاء أو الميديا بايينج، اربط دائمًا بين المؤشر والسبب المحتمل والتوصية التالية.
- ${routeGuidance}
- إذا كان السؤال عامًا من الإدارة العليا، أعطِ ملخصًا تنفيذيًا أولًا ثم 3 توصيات واضحة.
- إذا كان السؤال من مدير مبيعات، اذكر الأداء، المخاطر، ومواطن ضعف الالتزام.
- إذا كان السؤال من مدير حسابات، اذكر مخاطر churn، العملاء المتعثرين، وفرص الاحتفاظ والتجديد.
- إذا كان السؤال من Media Buyer، ركّز على الإنفاق، CPA/CPL، جودة الليدز، وفرضيات التحسين.
- اللغة الأساسية: العربية المهنية الواضحة.
- لا تستخدم عبارات توحي بالتنفيذ مثل: "تم", "نفذت", "أرسلت", "حدّثت". استخدم بدلًا منها: "أوصي", "أقترح", "يُفضّل", "يحتاج إلى مراجعة".`;

  let reply: string;
  let mode: "smart" | "normal" = "smart";

  if (geminiKey) {
    try {
      reply = await callGemini(geminiKey, systemPrompt, historyForLLM, userMessage);
      mode = "smart";
    } catch (err: any) {
      console.warn("[Rakan] Gemini failed:", err.message);

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
        } catch (err2: any) {
          console.warn("[Rakan] Fallback LLM failed:", err2.message);
          reply = generateStaticFallbackReply(
            rakanName,
            userName,
            role,
            userMessage,
            dbContext
          );
          mode = "normal";
        }
      } else {
        reply = generateStaticFallbackReply(
          rakanName,
          userName,
          role,
          userMessage,
          dbContext
        );
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
        userMessage
      );
      mode = "smart";
    } catch (err: any) {
      console.warn("[Rakan] Direct fallback LLM failed:", err.message);
      reply = generateStaticFallbackReply(
        rakanName,
        userName,
        role,
        userMessage,
        dbContext
      );
      mode = "normal";
    }
  } else {
    reply = generateStaticFallbackReply(
      rakanName,
      userName,
      role,
      userMessage,
      dbContext
    );
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
        ar_formal: (await getRakanSetting("tts_voice_ar_formal")) || "ar-XA-Wavenet-B",
        ar_egyptian: (await getRakanSetting("tts_voice_ar_egyptian")) || "ar-XA-Wavenet-A",
        ar_gulf: (await getRakanSetting("tts_voice_ar_gulf")) || "ar-XA-Wavenet-D",
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
    kind: "text",
    answer: reply,
    reply,
    audioBase64,
    mode,
  };
}

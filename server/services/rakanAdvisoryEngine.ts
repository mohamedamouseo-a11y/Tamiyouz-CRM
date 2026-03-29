import cron from "node-cron";
import mysql from "mysql2/promise";

let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  if (!_pool) throw new Error("Pool not initialized");
  return _pool;
}

const TZ = process.env.RAKAN_CRON_TIMEZONE || "Africa/Cairo";
let started = false;

async function getAdminUsers(): Promise<Array<{ id: number; name: string | null }>> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, name FROM users WHERE deletedAt IS NULL AND isActive = 1 AND role IN ('Admin')`,
  );
  return rows as Array<{ id: number; name: string | null }>;
}

async function insertNotification(params: {
  userId: number;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  link?: string | null;
  dedupeHours?: number;
  metadata?: Record<string, unknown>;
}) {
  const pool = getPool();
  const dedupeHours = Math.max(1, params.dedupeHours ?? 12);
  const [existing] = await pool.execute(
    `SELECT id FROM in_app_notifications
     WHERE userId = ?
       AND type = 'system'
       AND titleAr = ?
       AND createdAt >= DATE_SUB(NOW(), INTERVAL ${dedupeHours} HOUR)
     LIMIT 1`,
    [params.userId, params.titleAr],
  );

  if ((existing as any[]).length > 0) return false;

  await pool.execute(
    `INSERT INTO in_app_notifications
      (userId, type, title, titleAr, body, bodyAr, isRead, link, metadata, createdAt)
     VALUES (?, 'system', ?, ?, ?, ?, 0, ?, ?, NOW())`,
    [
      params.userId,
      params.title,
      params.titleAr,
      params.body,
      params.bodyAr,
      params.link ?? null,
      JSON.stringify(params.metadata ?? {}),
    ],
  );

  return true;
}

async function runLeadCompletenessAdvisor() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
       l.id,
       COALESCE(NULLIF(TRIM(l.name), ''), CONCAT('Lead #', l.id)) AS leadName,
       l.ownerId,
       l.stage,
       l.campaignName,
       l.createdAt,
       CASE
         WHEN l.ownerId IS NULL OR l.ownerId = 0 THEN 'lead بدون مسؤول'
         WHEN l.name IS NULL OR TRIM(l.name) = '' THEN 'الاسم غير مكتمل'
         WHEN l.campaignName IS NULL OR TRIM(l.campaignName) = '' THEN 'الحملة غير مسجلة'
         ELSE 'بيانات تحتاج مراجعة'
       END AS issueLabel
     FROM leads l
     WHERE l.deletedAt IS NULL
       AND l.createdAt <= DATE_SUB(NOW(), INTERVAL 6 HOUR)
       AND (
         l.ownerId IS NULL OR l.ownerId = 0
         OR l.name IS NULL OR TRIM(l.name) = ''
         OR l.campaignName IS NULL OR TRIM(l.campaignName) = ''
       )
     ORDER BY l.createdAt ASC
     LIMIT 25`,
  );

  let sent = 0;
  for (const row of rows as any[]) {
    const recipientIds = row.ownerId ? [Number(row.ownerId)] : (await getAdminUsers()).map((u) => u.id);
    for (const userId of recipientIds) {
      const inserted = await insertNotification({
        userId,
        title: "Rakan Advisory | Lead data is incomplete",
        titleAr: "تنبيه راكان | بيانات ليد غير مكتملة",
        body: `Lead ${row.leadName} has incomplete CRM data: ${row.issueLabel}. Please review and complete the record.`,
        bodyAr: `الليد ${row.leadName} لديه بيانات غير مكتملة داخل الـ CRM: ${row.issueLabel}. يُفضّل استكمال السجل ومراجعة المسؤول عنه.`,
        link: `/leads/${row.id}`,
        dedupeHours: 12,
        metadata: { advisoryType: "lead_data_quality", leadId: row.id },
      });
      if (inserted) sent += 1;
    }
  }
  return { checked: (rows as any[]).length, sent };
}

async function runColdMisuseAdvisor() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
       l.id,
       COALESCE(NULLIF(TRIM(l.name), ''), CONCAT('Lead #', l.id)) AS leadName,
       l.ownerId,
       u.name AS ownerName,
       l.createdAt,
       COUNT(a.id) AS totalActivities
     FROM leads l
     LEFT JOIN users u ON u.id = l.ownerId
     LEFT JOIN activities a ON a.leadId = l.id AND a.deletedAt IS NULL
     WHERE l.deletedAt IS NULL
       AND l.stage = 'Cold'
       AND l.createdAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)
     GROUP BY l.id, l.name, l.ownerId, u.name, l.createdAt
     HAVING totalActivities = 0
     ORDER BY l.createdAt DESC
     LIMIT 20`,
  );

  const admins = await getAdminUsers();
  let sent = 0;
  for (const row of rows as any[]) {
    const recipients = new Set<number>(admins.map((u) => u.id));
    if (row.ownerId) recipients.add(Number(row.ownerId));
    for (const userId of recipients) {
      const inserted = await insertNotification({
        userId,
        title: "Rakan Advisory | Suspicious Cold lead",
        titleAr: "تنبيه راكان | Lead تم تحويله إلى Cold بشكل مشكوك فيه",
        body: `Lead ${row.leadName} was moved to Cold without any logged activity.`,
        bodyAr: `الليد ${row.leadName} تم وضعه على Cold بدون أي Activity مسجل. يُفضّل مراجعة سبب الإغلاق وجودة المتابعة.`,
        link: `/leads/${row.id}`,
        dedupeHours: 24,
        metadata: { advisoryType: "cold_misuse", leadId: row.id },
      });
      if (inserted) sent += 1;
    }
  }
  return { checked: (rows as any[]).length, sent };
}

async function runFollowUpGapAdvisor() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
       c.id,
       COALESCE(NULLIF(TRIM(c.leadName), ''), CONCAT('Client #', c.id)) AS clientName,
       c.accountManagerId,
       c.healthScore,
       c.lastFollowUpDate,
       c.nextFollowUpDate
     FROM clients c
     WHERE c.deletedAt IS NULL
       AND (
         c.nextFollowUpDate IS NULL
         OR c.nextFollowUpDate < NOW()
         OR c.lastFollowUpDate IS NULL
         OR c.lastFollowUpDate < DATE_SUB(NOW(), INTERVAL 14 DAY)
       )
     ORDER BY c.nextFollowUpDate ASC, c.lastFollowUpDate ASC
     LIMIT 25`,
  );

  const admins = await getAdminUsers();
  let sent = 0;
  for (const row of rows as any[]) {
    const recipients = new Set<number>(admins.map((u) => u.id));
    if (row.accountManagerId) recipients.add(Number(row.accountManagerId));
    for (const userId of recipients) {
      const inserted = await insertNotification({
        userId,
        title: "Rakan Advisory | Client follow-up gap",
        titleAr: "تنبيه راكان | فجوة متابعة على عميل",
        body: `Client ${row.clientName} needs an immediate follow-up review.`,
        bodyAr: `العميل ${row.clientName} يحتاج إلى متابعة عاجلة. لا توجد متابعة مستقبلية واضحة أو أن آخر متابعة قديمة.`,
        link: `/clients/${row.id}`,
        dedupeHours: 24,
        metadata: { advisoryType: "client_followup_gap", clientId: row.id, healthScore: row.healthScore },
      });
      if (inserted) sent += 1;
    }
  }
  return { checked: (rows as any[]).length, sent };
}

async function safeRun(label: string, fn: () => Promise<{ checked: number; sent: number }>) {
  try {
    const result = await fn();
    console.log(`[Rakan Advisory] ${label}: checked=${result.checked}, sent=${result.sent}`);
  } catch (error) {
    console.error(`[Rakan Advisory] ${label} failed`, error);
  }
}

export async function runRakanAdvisorsOnce() {
  await safeRun("Lead Completeness", runLeadCompletenessAdvisor);
  await safeRun("Cold Misuse", runColdMisuseAdvisor);
  await safeRun("Follow-up Gaps", runFollowUpGapAdvisor);
}

export function startRakanAdvisoryEngine() {
  if (started) return;
  started = true;

  cron.schedule("0 */6 * * *", () => {
    void safeRun("Lead Completeness", runLeadCompletenessAdvisor);
  }, { timezone: TZ });

  cron.schedule("15 9 * * *", () => {
    void safeRun("Cold Misuse", runColdMisuseAdvisor);
  }, { timezone: TZ });

  cron.schedule("30 9 * * *", () => {
    void safeRun("Follow-up Gaps", runFollowUpGapAdvisor);
  }, { timezone: TZ });

  console.log(`[Rakan Advisory] Started with timezone ${TZ}`);
}

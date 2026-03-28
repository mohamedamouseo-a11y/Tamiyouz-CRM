import cron from "node-cron";
import mysql from "mysql2/promise";

export type AdvisoryRunSummary = {
  checked: number;
  sent: number;
};

let _pool: mysql.Pool | null = null;

function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  if (!_pool) throw new Error("Pool not initialized");
  return _pool;
}

const CRON_TIMEZONE = process.env.RAKAN_CRON_TIMEZONE || "Africa/Cairo";
let started = false;

function formatNumber(value: unknown, fractionDigits = 0): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

async function insertSystemAdvisory(params: {
  userId: number;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
  dedupeHours?: number;
}) {
  const pool = getPool();
  const dedupeHours = Math.max(1, Number(params.dedupeHours ?? 12));

  const [existingRows] = await pool.execute(
    `
      SELECT id
      FROM in_app_notifications
      WHERE userId = ?
        AND type = 'system'
        AND title = ?
        AND createdAt >= DATE_SUB(NOW(), INTERVAL ${dedupeHours} HOUR)
      LIMIT 1
    `,
    [params.userId, params.title]
  ) as any;

  if (existingRows?.length) return false;

  await pool.execute(
    `
      INSERT INTO in_app_notifications
      (userId, type, title, body, isRead, link, metadata, createdAt)
      VALUES (?, 'system', ?, ?, 0, ?, ?, NOW())
    `,
    [
      params.userId,
      params.title,
      params.body,
      params.link ?? null,
      JSON.stringify({
        source: "rakan_advisory_engine",
        ...(params.metadata ?? {}),
      }),
    ]
  );

  return true;
}

async function getMediaBuyerIds(): Promise<number[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM users
      WHERE role = 'MediaBuyer'
        AND isActive = 1
        AND deletedAt IS NULL
    `
  ) as any;

  return rows
    .map((row: any) => Number(row.id))
    .filter((id: number) => Number.isFinite(id) && id > 0);
}

async function runSalesSlaAdvisor(): Promise<AdvisoryRunSummary> {
  const pool = getPool();

  const [rows] = await pool.execute(
    `
      SELECT
        l.id,
        COALESCE(l.name, CONCAT('Lead #', l.id)) AS leadName,
        l.ownerId,
        TIMESTAMPDIFF(MINUTE, l.createdAt, NOW()) AS waitMinutes
      FROM leads l
      WHERE l.deletedAt IS NULL
        AND l.stage = 'New'
        AND l.ownerId IS NOT NULL
        AND l.createdAt <= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
      ORDER BY l.createdAt ASC
      LIMIT 250
    `
  ) as any;

  let sent = 0;

  for (const lead of rows as any[]) {
    const title = "تنبيه استشاري | تأخر متابعة ليد جديد";
    const body =
      `استشاريًا: الليد "${lead.leadName}" ينتظر منذ أكثر من ${formatNumber(lead.waitMinutes)} دقيقة وهو ما يزال في مرحلة New. ` +
      `الاستجابة السريعة ترفع احتمالية الإغلاق. يُنصح بالتواصل معه فورًا وتسجيل نتيجة التواصل داخل النظام.`;

    const inserted = await insertSystemAdvisory({
      userId: Number(lead.ownerId),
      title,
      body,
      link: `/leads/${lead.id}`,
      metadata: {
        advisoryType: "sales_sla",
        leadId: lead.id,
      },
      dedupeHours: 8,
    });

    if (inserted) sent += 1;
  }

  return { checked: rows.length, sent };
}

async function runAmChurnAdvisor(): Promise<AdvisoryRunSummary> {
  const pool = getPool();

  const [rows] = await pool.execute(
    `
      SELECT
        c.id,
        COALESCE(c.leadName, CONCAT('Client #', c.id)) AS clientName,
        c.accountManagerId,
        COALESCE(c.healthScore, 0) AS healthScore,
        MAX(f.followUpDate) AS lastFollowUpDate
      FROM clients c
      LEFT JOIN follow_ups f ON f.clientId = c.id
      WHERE c.deletedAt IS NULL
        AND c.accountManagerId IS NOT NULL
      GROUP BY c.id, c.leadName, c.accountManagerId, c.healthScore
      HAVING COALESCE(c.healthScore, 0) < 50
         OR lastFollowUpDate IS NULL
         OR lastFollowUpDate < DATE_SUB(NOW(), INTERVAL 14 DAY)
      ORDER BY COALESCE(c.healthScore, 0) ASC, lastFollowUpDate ASC
      LIMIT 250
    `
  ) as any;

  let sent = 0;

  for (const client of rows as any[]) {
    const reasons: string[] = [];
    if (Number(client.healthScore ?? 0) < 50) {
      reasons.push(`درجة الصحة منخفضة (${formatNumber(client.healthScore)}/100)`);
    }
    if (!client.lastFollowUpDate) {
      reasons.push("لا توجد متابعة مسجلة خلال آخر 14 يومًا");
    } else {
      reasons.push(`آخر متابعة كانت في ${client.lastFollowUpDate}`);
    }

    const title = "تنبيه استشاري | مخاطر churn على عميل";
    const body =
      `استشاريًا: العميل "${client.clientName}" لديه مؤشرات تستدعي التدخل الوقائي. ${reasons.join("، ")}. ` +
      `يُنصح بجدولة مكالمة مراجعة اليوم، وتحديد سبب التراجع، وتحديث خطة الاحتفاظ بالعميل.`;

    const inserted = await insertSystemAdvisory({
      userId: Number(client.accountManagerId),
      title,
      body,
      link: `/clients/${client.id}`,
      metadata: {
        advisoryType: "am_churn",
        clientId: client.id,
      },
      dedupeHours: 24,
    });

    if (inserted) sent += 1;
  }

  return { checked: rows.length, sent };
}

async function runMediaBuyingAdvisor(): Promise<AdvisoryRunSummary> {
  const pool = getPool();

  const [rows] = await pool.execute(
    `
      WITH latest_meta AS (
        SELECT
          'Meta' AS platform,
          campaignName,
          CAST(COALESCE(dailyBudget, 0) AS DECIMAL(12,2)) AS spend,
          0 AS conversions,
          0 AS cpa,
          syncedAt,
          ROW_NUMBER() OVER (PARTITION BY campaignName ORDER BY syncedAt DESC, id DESC) AS rn
        FROM meta_campaign_snapshots
        WHERE campaignName IS NOT NULL
          AND campaignName <> ''
          AND syncedAt >= DATE_SUB(NOW(), INTERVAL 3 DAY)
      ),
      latest_tiktok AS (
        SELECT
          'TikTok' AS platform,
          campaign_name AS campaignName,
          CAST(COALESCE(spend, 0) AS DECIMAL(12,2)) AS spend,
          CAST(COALESCE(conversions, 0) AS UNSIGNED) AS conversions,
          CAST(COALESCE(cpa, 0) AS DECIMAL(12,2)) AS cpa,
          synced_at,
          ROW_NUMBER() OVER (PARTITION BY campaign_name ORDER BY synced_at DESC, id DESC) AS rn
        FROM tiktok_campaign_snapshots
        WHERE campaign_name IS NOT NULL
          AND campaign_name <> ''
          AND synced_at >= DATE_SUB(NOW(), INTERVAL 3 DAY)
      ),
      latest AS (
        SELECT platform, campaignName, spend, conversions, cpa FROM latest_meta WHERE rn = 1
        UNION ALL
        SELECT platform, campaignName, spend, conversions, cpa FROM latest_tiktok WHERE rn = 1
      ),
      bench AS (
        SELECT
          AVG(cpa) AS avgCpa,
          STDDEV_POP(cpa) AS stdCpa
        FROM latest
        WHERE cpa > 0
      )
      SELECT
        l.platform,
        l.campaignName,
        l.spend,
        l.conversions,
        l.cpa,
        b.avgCpa,
        b.stdCpa
      FROM latest l
      CROSS JOIN bench b
      WHERE l.cpa > 0
        AND l.cpa > GREATEST(b.avgCpa * 1.35, b.avgCpa + IFNULL(b.stdCpa, 0))
      ORDER BY l.cpa DESC
      LIMIT 20
    `
  ) as any;

  const mediaBuyerIds = await getMediaBuyerIds();
  if (!mediaBuyerIds.length) {
    return { checked: rows.length, sent: 0 };
  }

  let sent = 0;

  for (const campaign of rows as any[]) {
    const title = "تنبيه استشاري | ارتفاع CPL/CPA في حملة إعلانية";
    const body =
      `استشاريًا: الحملة "${campaign.campaignName}" على ${campaign.platform} تسجل CPL/CPA مرتفعًا (${formatNumber(campaign.cpa, 2)}) ` +
      `مقارنة بمتوسط الحساب (${formatNumber(campaign.avgCpa, 2)}). يُنصح بمراجعة الإبداع، الاستهداف، الرسائل، وتوزيع الميزانية قبل التوسع في الإنفاق.`;

    for (const userId of mediaBuyerIds) {
      const inserted = await insertSystemAdvisory({
        userId,
        title,
        body,
        link: "/campaigns",
        metadata: {
          advisoryType: "media_buying_high_cpa",
          platform: campaign.platform,
          campaignName: campaign.campaignName,
        },
        dedupeHours: 18,
      });

      if (inserted) sent += 1;
    }
  }

  return { checked: rows.length, sent };
}

async function safeRun(name: string, fn: () => Promise<AdvisoryRunSummary>) {
  try {
    const result = await fn();
    console.log(`[Rakan Advisory] ${name}: checked=${result.checked}, sent=${result.sent}`);
  } catch (error) {
    console.error(`[Rakan Advisory] ${name} failed:`, error);
  }
}

export async function runAllRakanAdvisorsOnce() {
  await safeRun("Sales SLA Advisor", runSalesSlaAdvisor);
  await safeRun("AM Churn Advisor", runAmChurnAdvisor);
  await safeRun("Media Buying Advisor", runMediaBuyingAdvisor);
}

export function initRakanAdvisoryEngine() {
  if (started) return;
  started = true;

  cron.schedule(
    "*/15 * * * *",
    () => {
      void safeRun("Sales SLA Advisor", runSalesSlaAdvisor);
    },
    { timezone: CRON_TIMEZONE }
  );

  cron.schedule(
    "0 9 * * *",
    () => {
      void safeRun("AM Churn Advisor", runAmChurnAdvisor);
    },
    { timezone: CRON_TIMEZONE }
  );

  cron.schedule(
    "15 9 * * *",
    () => {
      void safeRun("Media Buying Advisor", runMediaBuyingAdvisor);
    },
    { timezone: CRON_TIMEZONE }
  );

  console.log(`[Rakan Advisory] Engine started. Timezone=${CRON_TIMEZONE}`);
}

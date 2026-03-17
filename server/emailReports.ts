import cron from "node-cron";
import { sendEmail } from "./email";
import { getActiveNotificationSubscribers, getReportData } from "./db";

// ─── Report Email Builder ─────────────────────────────────────────────────────
export function buildReportEmail(
  data: NonNullable<Awaited<ReturnType<typeof getReportData>>>,
  frequency: "daily" | "weekly"
): { subject: string; html: string; text: string } {
  const isDaily = frequency === "daily";
  const periodLabel = isDaily ? "اليومي" : "الأسبوعي";
  const periodLabelEn = isDaily ? "Daily" : "Weekly";

  const from = data.period.from.toLocaleDateString("ar-SA", { dateStyle: "medium" });
  const to = data.period.to.toLocaleDateString("ar-SA", { dateStyle: "medium" });

  const subject = `تقرير ${periodLabel} - Tamiyouz CRM | ${periodLabelEn} Report`;

  const agentRows = (data.agentStats as any[])
    .map(
      (a) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">${a.name ?? a.email}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;">${a.totalLeads}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;">${a.totalActivities}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;">${a.wonDeals}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;color:${Number(a.slaBreached) > 0 ? "#e53e3e" : "#38a169"};">${a.slaBreached}</td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: 'Cairo', Arial, sans-serif; direction: rtl; }
    .container { max-width: 680px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a3a5c 0%, #0f2444 100%); padding: 28px 40px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.7); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 32px 40px; }
    .period { background: #f0f4f8; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #555; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
    .stat-card { background: #f8f9fa; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-card .value { font-size: 28px; font-weight: 700; color: #1a3a5c; }
    .stat-card .label { font-size: 12px; color: #888; margin-top: 4px; }
    .stat-card.sla .value { color: #e53e3e; }
    .stat-card.won .value { color: #38a169; }
    h3 { color: #1a3a5c; font-size: 16px; margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    thead tr { background: #1a3a5c; color: white; }
    thead th { padding: 10px 14px; text-align: right; font-weight: 600; }
    .footer { text-align: center; padding: 20px 40px; font-size: 12px; color: #aaa; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tamiyouz CRM — تقرير ${periodLabel}</h1>
      <p>${periodLabelEn} Performance Report</p>
    </div>
    <div class="body">
      <div class="period">
        📅 الفترة: ${from} — ${to}
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${data.totalLeads}</div>
          <div class="label">إجمالي الليدز</div>
        </div>
        <div class="stat-card won">
          <div class="value">${data.wonDeals}</div>
          <div class="label">صفقات مُغلقة</div>
        </div>
        <div class="stat-card">
          <div class="value">${data.wonValue.toLocaleString()} ر.س</div>
          <div class="label">قيمة المبيعات</div>
        </div>
        <div class="stat-card sla">
          <div class="value">${data.slaBreached}</div>
          <div class="label">خرق SLA</div>
        </div>
      </div>

      ${
        agentRows
          ? `<h3>أداء فريق المبيعات</h3>
      <table>
        <thead>
          <tr>
            <th>الموظف</th>
            <th style="text-align:center">الليدز</th>
            <th style="text-align:center">الأنشطة</th>
            <th style="text-align:center">مُغلق</th>
            <th style="text-align:center">خرق SLA</th>
          </tr>
        </thead>
        <tbody>
          ${agentRows}
        </tbody>
      </table>`
          : ""
      }
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Tamiyouz Alrowad. جميع الحقوق محفوظة.
    </div>
  </div>
</body>
</html>`;

  const text = [
    `تقرير ${periodLabel} - Tamiyouz CRM`,
    `الفترة: ${from} — ${to}`,
    ``,
    `إجمالي الليدز: ${data.totalLeads}`,
    `صفقات مُغلقة: ${data.wonDeals}`,
    `قيمة المبيعات: ${data.wonValue.toLocaleString()} ر.س`,
    `خرق SLA: ${data.slaBreached}`,
    ``,
    `أداء الفريق:`,
    ...(data.agentStats as any[]).map(
      (a) =>
        `  - ${a.name ?? a.email}: ${a.totalLeads} ليد، ${a.totalActivities} نشاط، ${a.wonDeals} مُغلق، ${a.slaBreached} خرق SLA`
    ),
  ].join("\n");

  return { subject, html, text };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
let schedulerStarted = false;

export function startEmailScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Daily report: every day at 8:00 AM
  cron.schedule("0 8 * * *", async () => {
    console.log("[EmailScheduler] Running daily report...");
    await sendScheduledReport("daily");
  });

  // Weekly report: every Monday at 8:00 AM
  cron.schedule("0 8 * * 1", async () => {
    console.log("[EmailScheduler] Running weekly report...");
    await sendScheduledReport("weekly");
  });

  console.log("[EmailScheduler] Started — daily at 08:00, weekly on Mondays at 08:00");
}

async function sendScheduledReport(frequency: "daily" | "weekly") {
  try {
    const subscribers = await getActiveNotificationSubscribers(frequency);
    if (!subscribers.length) {
      console.log(`[EmailScheduler] No active ${frequency} subscribers`);
      return;
    }

    const dateFrom =
      frequency === "daily"
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dateTo = new Date();

    const reportData = await getReportData(dateFrom, dateTo);
    if (!reportData) {
      console.log("[EmailScheduler] No report data available");
      return;
    }

    const { subject, html, text } = buildReportEmail(reportData, frequency);

    for (const subscriber of subscribers) {
      const result = await sendEmail({ to: subscriber.email, subject, html, text });
      if (result.success) {
        console.log(`[EmailScheduler] Sent ${frequency} report to ${subscriber.email}`);
      } else {
        console.error(`[EmailScheduler] Failed to send to ${subscriber.email}: ${result.info}`);
      }
    }
  } catch (error) {
    console.error("[EmailScheduler] Error:", error);
  }
}

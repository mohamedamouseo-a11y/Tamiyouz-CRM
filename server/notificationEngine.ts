// server/notificationEngine.ts
import type { InsertInAppNotification } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import {
  createInAppNotification,
  createBulkInAppNotifications,
  getAllUsers,
  getLeadById,
  getDb,
  getSlaConfig,
} from "./db";

const ADMIN_ROLES = new Set(["Admin", "admin", "SalesManager"]);

function displayLeadNameOrPhone(lead: { name?: string | null; phone: string }): string {
  const name = (lead.name ?? "").trim();
  return name.length > 0 ? name : lead.phone;
}

function campaignOrDirect(campaignName?: string | null): string {
  const c = (campaignName ?? "").trim();
  return c.length > 0 ? c : "Direct";
}

function campaignOrDirectAr(campaignName?: string | null): string {
  const c = (campaignName ?? "").trim();
  return c.length > 0 ? c : "مباشر";
}

async function getAdminIds(): Promise<number[]> {
  const users = await getAllUsers();
  return users
    .filter((u: any) => Boolean(u.isActive) && ADMIN_ROLES.has(String(u.role)))
    .map((u: any) => Number(u.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function getUserName(userId: number): Promise<string> {
  const users = await getAllUsers();
  const user = users.find((u: any) => u.id === userId);
  return user?.name ?? `User #${userId}`;
}

// ─── Notification #1 — New Lead ──────────────────────────────────────────────
export async function notifyNewLead(lead: {
  id: number;
  name?: string | null;
  phone: string;
  campaignName?: string | null;
  ownerId?: number | null;
}): Promise<void> {
  const adminIds = await getAdminIds();

  const recipients = new Set<number>();
  if (lead.ownerId != null) recipients.add(Number(lead.ownerId));
  for (const id of adminIds) recipients.add(id);

  if (recipients.size === 0) return;

  const display = displayLeadNameOrPhone({ name: lead.name, phone: lead.phone });
  const campaignEn = campaignOrDirect(lead.campaignName);
  const campaignAr = campaignOrDirectAr(lead.campaignName);

  const title = `New Lead: ${display} from ${campaignEn}`;
  const titleAr = `ليد جديد: ${display} من حملة ${campaignAr}`;

  const items: InsertInAppNotification[] = Array.from(recipients).map((userId) => ({
    userId,
    type: "lead_assigned" as const,
    title,
    titleAr,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${lead.id}`,
    metadata: { leadId: lead.id, trigger: "new_lead" },
  }));

  await createBulkInAppNotifications(items);
}

// ─── Notification #2 — Lead Assigned ─────────────────────────────────────────
export async function notifyLeadAssigned(
  lead: { id: number; name?: string | null; phone: string },
  newOwnerId: number
): Promise<void> {
  const userId = Number(newOwnerId);
  if (!Number.isFinite(userId) || userId <= 0) return;

  const display = displayLeadNameOrPhone({ name: lead.name, phone: lead.phone });

  const data: InsertInAppNotification = {
    userId,
    type: "lead_assigned" as const,
    title: `A lead has been assigned to you: ${display}`,
    titleAr: `تم تعيين ليد جديد لك: ${display}`,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${lead.id}`,
    metadata: { leadId: lead.id, trigger: "lead_assigned" },
  };

  await createInAppNotification(data);
}

// ─── Notification #3 — SLA Breach ────────────────────────────────────────────
export async function notifySLABreach(
  breachedLeads: Array<{
    id: number;
    name?: string | null;
    phone: string;
    ownerId?: number | null;
    slaAlertedAt?: Date | null;
  }>
): Promise<void> {
  if (!Array.isArray(breachedLeads) || breachedLeads.length === 0) return;

  // Important: do NOT notify leads whose slaAlertedAt is NOT null
  const leadsToNotify = breachedLeads.filter((l) => l.slaAlertedAt == null);
  if (leadsToNotify.length === 0) return;

  const adminIds = await getAdminIds();
  const items: InsertInAppNotification[] = [];

  for (const lead of leadsToNotify) {
    const recipients = new Set<number>();
    if (lead.ownerId != null) recipients.add(Number(lead.ownerId));
    for (const id of adminIds) recipients.add(id);

    if (recipients.size === 0) continue;

    const display = displayLeadNameOrPhone({ name: lead.name, phone: lead.phone });

    const title = `⚠️ SLA Breach: ${display} — No response within the SLA window`;
    const titleAr = `⚠️ تأخر في الرد: ${display} — تجاوز مدة الاستجابة المحددة`;

    for (const userId of recipients) {
      if (!Number.isFinite(userId) || userId <= 0) continue;
      items.push({
        userId,
        type: "sla_breach" as const,
        title,
        titleAr,
        body: null,
        bodyAr: null,
        isRead: false,
        link: `/leads/${lead.id}`,
        metadata: { leadId: lead.id, trigger: "sla_breach" },
      });
    }
  }

  if (items.length === 0) return;
  await createBulkInAppNotifications(items);
}

// ─── Notification #4 — Stage Change ─────────────────────────────────────────
export async function notifyStageChange(lead: {
  id: number;
  name?: string | null;
  phone: string;
  ownerId?: number | null;
  oldStage: string;
  newStage: string;
}): Promise<void> {
  const adminIds = await getAdminIds();

  const recipients = new Set<number>();
  if (lead.ownerId != null) recipients.add(Number(lead.ownerId));
  for (const id of adminIds) recipients.add(id);

  if (recipients.size === 0) return;

  const display = displayLeadNameOrPhone({ name: lead.name, phone: lead.phone });

  const title = `Stage changed: ${display} moved from "${lead.oldStage}" to "${lead.newStage}"`;
  const titleAr = `تغيرت مرحلة ${display} من "${lead.oldStage}" إلى "${lead.newStage}"`;

  const items: InsertInAppNotification[] = Array.from(recipients).map((userId) => ({
    userId,
    type: "stage_change" as const,
    title,
    titleAr,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${lead.id}`,
    metadata: { leadId: lead.id, trigger: "stage_change", oldStage: lead.oldStage, newStage: lead.newStage },
  }));

  await createBulkInAppNotifications(items);
}

// ─── Notification #5 — Deal Won ─────────────────────────────────────────────
export async function notifyDealWon(deal: {
  id: number;
  leadId: number;
  valueSar?: string | null;
}, leadName: string, ownerName: string): Promise<void> {
  const adminIds = await getAdminIds();
  if (adminIds.length === 0) return;

  const value = deal.valueSar ? `${deal.valueSar} SAR` : "N/A";

  const title = `🎉 Deal Won: ${leadName} — ${value} by ${ownerName}`;
  const titleAr = `🎉 صفقة ناجحة: ${leadName} — ${value} بواسطة ${ownerName}`;

  const items: InsertInAppNotification[] = adminIds.map((userId) => ({
    userId,
    type: "deal_won" as const,
    title,
    titleAr,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${deal.leadId}`,
    metadata: { dealId: deal.id, leadId: deal.leadId, trigger: "deal_won", valueSar: deal.valueSar },
  }));

  await createBulkInAppNotifications(items);
}

// ─── Notification #6 — Deal Lost ────────────────────────────────────────────
export async function notifyDealLost(deal: {
  id: number;
  leadId: number;
  lossReason?: string | null;
}, leadName: string, ownerName: string): Promise<void> {
  const adminIds = await getAdminIds();
  if (adminIds.length === 0) return;

  const reason = deal.lossReason ? ` — Reason: ${deal.lossReason}` : "";
  const reasonAr = deal.lossReason ? ` — السبب: ${deal.lossReason}` : "";

  const title = `Deal Lost: ${leadName} by ${ownerName}${reason}`;
  const titleAr = `صفقة خاسرة: ${leadName} بواسطة ${ownerName}${reasonAr}`;

  const items: InsertInAppNotification[] = adminIds.map((userId) => ({
    userId,
    type: "deal_lost" as const,
    title,
    titleAr,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${deal.leadId}`,
    metadata: { dealId: deal.id, leadId: deal.leadId, trigger: "deal_lost", lossReason: deal.lossReason },
  }));

  await createBulkInAppNotifications(items);
}

// ─── Notification #7 — Activity Logged ──────────────────────────────────────
export async function notifyActivityLogged(activity: {
  id: number;
  leadId: number;
  userId: number;
  type: string;
  outcome?: string | null;
}): Promise<void> {
  const lead = await getLeadById(activity.leadId);
  if (!lead) return;

  const adminIds = await getAdminIds();
  const recipients = new Set<number>();

  // Notify the lead owner (if different from the person who logged the activity)
  if (lead.ownerId != null && lead.ownerId !== activity.userId) {
    recipients.add(Number(lead.ownerId));
  }
  // Notify admins
  for (const id of adminIds) {
    if (id !== activity.userId) recipients.add(id);
  }

  if (recipients.size === 0) return;

  const display = displayLeadNameOrPhone({ name: lead.name, phone: lead.phone });
  const agentName = await getUserName(activity.userId);
  const outcome = activity.outcome ? ` (${activity.outcome})` : "";

  const title = `Activity: ${agentName} logged ${activity.type}${outcome} on ${display}`;
  const titleAr = `نشاط: ${agentName} سجل ${activity.type}${outcome} على ${display}`;

  const items: InsertInAppNotification[] = Array.from(recipients).map((userId) => ({
    userId,
    type: "activity_logged" as const,
    title,
    titleAr,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${lead.id}`,
    metadata: { activityId: activity.id, leadId: lead.id, trigger: "activity_logged", activityType: activity.type },
  }));

  await createBulkInAppNotifications(items);
}

// ─── Notification #8 — Lead Quality Change ──────────────────────────────────
export async function notifyLeadQualityChange(lead: {
  id: number;
  name?: string | null;
  phone: string;
  ownerId?: number | null;
  oldQuality: string;
  newQuality: string;
}): Promise<void> {
  const adminIds = await getAdminIds();

  const recipients = new Set<number>();
  if (lead.ownerId != null) recipients.add(Number(lead.ownerId));
  for (const id of adminIds) recipients.add(id);

  if (recipients.size === 0) return;

  const display = displayLeadNameOrPhone({ name: lead.name, phone: lead.phone });

  const title = `Quality changed: ${display} from "${lead.oldQuality}" to "${lead.newQuality}"`;
  const titleAr = `تغيرت جودة الليد: ${display} من "${lead.oldQuality}" إلى "${lead.newQuality}"`;

  const items: InsertInAppNotification[] = Array.from(recipients).map((userId) => ({
    userId,
    type: "lead_quality_change" as const,
    title,
    titleAr,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${lead.id}`,
    metadata: { leadId: lead.id, trigger: "lead_quality_change", oldQuality: lead.oldQuality, newQuality: lead.newQuality },
  }));

  await createBulkInAppNotifications(items);
}

// ─── Notification #9 — Lead Transfer ────────────────────────────────────────
export async function notifyLeadTransfer(transfer: {
  leadId: number;
  fromUserId: number;
  toUserId: number;
  reason?: string | null;
}): Promise<void> {
  const lead = await getLeadById(transfer.leadId);
  if (!lead) return;

  const display = displayLeadNameOrPhone({ name: lead.name, phone: lead.phone });
  const fromName = await getUserName(transfer.fromUserId);
  const toName = await getUserName(transfer.toUserId);
  const reason = transfer.reason ? ` — Reason: ${transfer.reason}` : "";
  const reasonAr = transfer.reason ? ` — السبب: ${transfer.reason}` : "";

  // Notify the new owner
  const toNotification: InsertInAppNotification = {
    userId: transfer.toUserId,
    type: "lead_transfer" as const,
    title: `Lead transferred to you: ${display} from ${fromName}${reason}`,
    titleAr: `تم تحويل ليد إليك: ${display} من ${fromName}${reasonAr}`,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${transfer.leadId}`,
    metadata: { leadId: transfer.leadId, trigger: "lead_transfer", fromUserId: transfer.fromUserId },
  };

  // Notify the old owner
  const fromNotification: InsertInAppNotification = {
    userId: transfer.fromUserId,
    type: "lead_transfer" as const,
    title: `Lead transferred from you: ${display} to ${toName}${reason}`,
    titleAr: `تم تحويل ليد منك: ${display} إلى ${toName}${reasonAr}`,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${transfer.leadId}`,
    metadata: { leadId: transfer.leadId, trigger: "lead_transfer", toUserId: transfer.toUserId },
  };

  // Notify admins
  const adminIds = await getAdminIds();
  const adminItems: InsertInAppNotification[] = adminIds
    .filter((id) => id !== transfer.fromUserId && id !== transfer.toUserId)
    .map((userId) => ({
      userId,
      type: "lead_transfer" as const,
      title: `Lead transferred: ${display} from ${fromName} to ${toName}${reason}`,
      titleAr: `تم تحويل ليد: ${display} من ${fromName} إلى ${toName}${reasonAr}`,
      body: null,
      bodyAr: null,
      isRead: false,
      link: `/leads/${transfer.leadId}`,
      metadata: { leadId: transfer.leadId, trigger: "lead_transfer", fromUserId: transfer.fromUserId, toUserId: transfer.toUserId },
    }));

  const allItems = [toNotification, fromNotification, ...adminItems];
  await createBulkInAppNotifications(allItems);
}

// ─── Notification #10 — Duplicate Lead Detected ─────────────────────────────
export async function notifyDuplicateLead(lead: {
  id: number;
  name?: string | null;
  phone: string;
  duplicateOfId: number;
  ownerId?: number | null;
}): Promise<void> {
  const adminIds = await getAdminIds();

  const recipients = new Set<number>();
  if (lead.ownerId != null) recipients.add(Number(lead.ownerId));
  for (const id of adminIds) recipients.add(id);

  if (recipients.size === 0) return;

  const display = displayLeadNameOrPhone({ name: lead.name, phone: lead.phone });

  const title = `Duplicate detected: ${display} (duplicate of #${lead.duplicateOfId})`;
  const titleAr = `ليد مكرر: ${display} (مكرر من #${lead.duplicateOfId})`;

  const items: InsertInAppNotification[] = Array.from(recipients).map((userId) => ({
    userId,
    type: "duplicate_lead" as const,
    title,
    titleAr,
    body: null,
    bodyAr: null,
    isRead: false,
    link: `/leads/${lead.id}`,
    metadata: { leadId: lead.id, duplicateOfId: lead.duplicateOfId, trigger: "duplicate_lead" },
  }));

  await createBulkInAppNotifications(items);
}

export function startNotificationEngine(): void {
  // No cron jobs — event-driven only
  startFollowUpReminderScheduler();
  startContractRenewalScheduler();
  console.log("[NotificationEngine] Started — event-driven notifications active (10 triggers)");
}

// ─── Notification #11 — Follow-up Reminder (Stale Leads) ──────────────────
// Checks for leads that haven't been contacted within the SLA window
// and sends reminder notifications to the lead owner and admins.

// Track which follow-up reminders have been sent (leadId -> last sent timestamp)
const sentFollowUpReminders = new Map<number, number>();

// Clean up old entries every 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of sentFollowUpReminders) {
    if (now - ts > 12 * 60 * 60 * 1000) {
      sentFollowUpReminders.delete(key);
    }
  }
}, 2 * 60 * 60 * 1000);

async function checkStaleLeadsForFollowUp(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const config = await getSlaConfig();
    if (!config || !config.isEnabled) return;
    const hoursThreshold = config.hoursThreshold || 24;

    const thresholdDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

    const staleLeads = await db.execute(sql`
      SELECT l.id, l.name, l.phone, l.ownerId, l.stage,
             MAX(a.activityTime) as lastActivityTime
      FROM leads l
      LEFT JOIN activities a ON a.leadId = l.id AND a.deletedAt IS NULL
      WHERE l.deletedAt IS NULL
        AND l.stage NOT IN ('Won', 'Lost')
        AND l.createdAt < ${thresholdDate}
      GROUP BY l.id, l.name, l.phone, l.ownerId, l.stage
      HAVING lastActivityTime IS NULL OR lastActivityTime < ${thresholdDate}
      LIMIT 50
    `);

    const rows = (staleLeads as any)[0] ?? [];
    if (rows.length === 0) return;

    const allUsers = await getAllUsers();
    const adminIds = allUsers
      .filter((u: any) => Boolean(u.isActive) && ADMIN_ROLES.has(String(u.role)))
      .map((u: any) => Number(u.id))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    const notifications: InsertInAppNotification[] = [];
    const now = Date.now();

    for (const lead of rows) {
      const lastSent = sentFollowUpReminders.get(lead.id);
      if (lastSent && now - lastSent < 12 * 60 * 60 * 1000) continue;

      const display = (lead.name ?? "").trim() || lead.phone || "Lead #" + lead.id;
      const lastContact = lead.lastActivityTime
        ? new Date(lead.lastActivityTime).toLocaleDateString("en-US")
        : "Never";
      const lastContactAr = lead.lastActivityTime
        ? new Date(lead.lastActivityTime).toLocaleDateString("ar-SA")
        : "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u062a\u0648\u0627\u0635\u0644";

      const recipients = new Set<number>();
      if (lead.ownerId) recipients.add(Number(lead.ownerId));
      for (const id of adminIds) recipients.add(id);

      for (const userId of recipients) {
        notifications.push({
          userId,
          type: "sla_breach" as const,
          title: "Follow-up needed: " + display + " \u2014 Last contact: " + lastContact,
          titleAr: "\u0645\u062a\u0627\u0628\u0639\u0629 \u0645\u0637\u0644\u0648\u0628\u0629: " + display + " \u2014 \u0622\u062e\u0631 \u062a\u0648\u0627\u0635\u0644: " + lastContactAr,
          body: "This lead hasn't been contacted within the " + hoursThreshold + "h window. Stage: " + lead.stage,
          bodyAr: "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0647\u0630\u0627 \u0627\u0644\u0644\u064a\u062f \u062e\u0644\u0627\u0644 " + hoursThreshold + " \u0633\u0627\u0639\u0629. \u0627\u0644\u0645\u0631\u062d\u0644\u0629: " + lead.stage,
          isRead: false,
          link: "/leads/" + lead.id,
          metadata: { leadId: lead.id, trigger: "follow_up_reminder", lastActivityTime: lead.lastActivityTime },
        });
      }

      sentFollowUpReminders.set(lead.id, now);
    }

    if (notifications.length > 0) {
      await createBulkInAppNotifications(notifications);
      console.log("[FollowUpReminder] Created " + notifications.length + " follow-up reminder notifications");
    }
  } catch (error) {
    console.error("[FollowUpReminder] Error checking stale leads:", error);
  }
}

export function startFollowUpReminderScheduler() {
  console.log("[FollowUpReminder] Starting follow-up reminder scheduler (every 30 minutes)");
  setInterval(checkStaleLeadsForFollowUp, 30 * 60 * 1000);
  setTimeout(checkStaleLeadsForFollowUp, 15000);
}

// ─── Notification #12 — Contract Renewal Reminder (3 days before end date) ───
// Checks for contracts expiring within 3 days and sends reminder notifications
// to the Account Manager so they can prepare the renewal report.
const sentRenewalReminders = new Map<number, number>();

// Clean up old entries every 6 hours
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of sentRenewalReminders) {
    if (now - ts > 24 * 60 * 60 * 1000) {
      sentRenewalReminders.delete(key);
    }
  }
}, 6 * 60 * 60 * 1000);

async function checkContractRenewals(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Find contracts expiring within the next 3 days
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiringContracts = await db.execute(sql`
      SELECT c.id, c.clientId, c.contractName, c.endDate, c.startDate, c.status,
             cl.accountManagerId, cl.competentPerson, cl.contactPhone,
             l.name as leadName, l.phone as leadPhone,
             u.name as amName
      FROM contracts c
      JOIN clients cl ON cl.id = c.clientId AND cl.deletedAt IS NULL
      LEFT JOIN leads l ON l.id = cl.leadId AND l.deletedAt IS NULL
      LEFT JOIN users u ON u.id = cl.accountManagerId AND u.deletedAt IS NULL
      WHERE c.deletedAt IS NULL
        AND c.status IN ('Active', 'PendingRenewal')
        AND c.endDate IS NOT NULL
        AND c.endDate <= ${threeDaysFromNow.toISOString().slice(0, 19).replace('T', ' ')}
        AND c.endDate >= ${now.toISOString().slice(0, 19).replace('T', ' ')}
      LIMIT 50
    `);

    const rows = (expiringContracts as any)[0] ?? [];
    if (rows.length === 0) return;

    const allUsers = await getAllUsers();
    const adminIds = allUsers
      .filter((u: any) => Boolean(u.isActive) && ADMIN_ROLES.has(String(u.role)))
      .map((u: any) => Number(u.id))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    const notifications: InsertInAppNotification[] = [];
    const nowMs = Date.now();

    for (const contract of rows) {
      const lastSent = sentRenewalReminders.get(contract.id);
      if (lastSent && nowMs - lastSent < 24 * 60 * 60 * 1000) continue;

      const clientName = (contract.leadName ?? "").trim() || contract.competentPerson || contract.contactPhone || "Client #" + contract.clientId;
      const contractLabel = contract.contractName || "Contract #" + contract.id;
      const endDateStr = contract.endDate ? new Date(contract.endDate).toLocaleDateString("en-US") : "N/A";
      const endDateStrAr = contract.endDate ? new Date(contract.endDate).toLocaleDateString("ar-SA") : "غير محدد";
      
      const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const daysText = daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
      const daysTextAr = daysLeft <= 0 ? "اليوم" : daysLeft === 1 ? "غداً" : `خلال ${daysLeft} أيام`;

      const recipients = new Set<number>();
      // Send to Account Manager
      if (contract.accountManagerId) recipients.add(Number(contract.accountManagerId));
      // Send to all admins
      for (const id of adminIds) recipients.add(id);

      for (const userId of recipients) {
        notifications.push({
          userId,
          type: "sla_breach" as const,
          title: `Contract renewal ${daysText}: ${clientName} — ${contractLabel} expires ${endDateStr}`,
          titleAr: `تجديد عقد ${daysTextAr}: ${clientName} — ${contractLabel} ينتهي ${endDateStrAr}`,
          body: `Prepare the renewal report. Contract ends ${daysText}. Client: ${clientName}`,
          bodyAr: `جهّز تقرير التجديد. العقد ينتهي ${daysTextAr}. العميل: ${clientName}`,
          isRead: false,
          link: `/clients/${contract.clientId}`,
          metadata: { contractId: contract.id, clientId: contract.clientId, trigger: "contract_renewal_reminder", endDate: contract.endDate },
        });
      }
      sentRenewalReminders.set(contract.id, nowMs);
    }

    if (notifications.length > 0) {
      await createBulkInAppNotifications(notifications);
      console.log("[ContractRenewal] Created " + notifications.length + " contract renewal reminder notifications");
    }
  } catch (error) {
    console.error("[ContractRenewal] Error checking contract renewals:", error);
  }
}

export function startContractRenewalScheduler() {
  console.log("[ContractRenewal] Starting contract renewal reminder scheduler (every 60 minutes)");
  setInterval(checkContractRenewals, 60 * 60 * 1000);
  // First check after 20 seconds
  setTimeout(checkContractRenewals, 20000);
}


// ─── Inbox-Specific Notification Functions ────────────────────────────────────

async function getUsersByRoles(roles: string[]): Promise<{ id: number; name: string; role: string }[]> {
  const users = await getAllUsers();
  return users
    .filter((u: any) => Boolean(u.isActive) && roles.includes(String(u.role)))
    .map((u: any) => ({ id: Number(u.id), name: String(u.name ?? ""), role: String(u.role) }));
}

export async function notifyInboxNewLead(params: {
  targetUserId: number;
  leadId: number;
  leadName: string;
  phone?: string;
  campaignName?: string;
  leadTime?: Date | string | null;
  createdAt?: Date | string | null;
}) {
  await createInAppNotification({
    userId: params.targetUserId,
    type: "new_lead" as any,
    title: `New lead: ${params.leadName}`,
    titleAr: `عميل محتمل جديد: ${params.leadName}`,
    body: `${params.leadName} was received from ${params.campaignName ?? "a campaign"}.`,
    bodyAr: `تم استلام ${params.leadName} من ${params.campaignName ?? "إحدى الحملات"}.`,
    isRead: false,
    link: `/leads/${params.leadId}`,
    metadata: {
      leadId: params.leadId,
      leadName: params.leadName,
      phone: params.phone ?? null,
      campaignName: params.campaignName ?? null,
      leadTime: params.leadTime ? new Date(String(params.leadTime)).toISOString() : null,
      createdAt: params.createdAt ? new Date(String(params.createdAt)).toISOString() : new Date().toISOString(),
    },
  });
}

export async function notifyInboxLeadAssigned(params: {
  assigneeUserId: number;
  assignedToName: string;
  leadId: number;
  leadName: string;
  phone?: string;
  campaignName?: string;
  leadTime?: Date | string | null;
  createdAt?: Date | string | null;
}) {
  await createInAppNotification({
    userId: params.assigneeUserId,
    type: "lead_assigned" as any,
    title: `Lead assigned: ${params.leadName}`,
    titleAr: `تم توزيع عميل محتمل: ${params.leadName}`,
    body: `${params.leadName} was assigned to ${params.assignedToName}.`,
    bodyAr: `تم توزيع ${params.leadName} على ${params.assignedToName}.`,
    isRead: false,
    link: `/leads/${params.leadId}`,
    metadata: {
      leadId: params.leadId,
      leadName: params.leadName,
      phone: params.phone ?? null,
      campaignName: params.campaignName ?? null,
      assignedToName: params.assignedToName,
      leadTime: params.leadTime ? new Date(String(params.leadTime)).toISOString() : null,
      createdAt: params.createdAt ? new Date(String(params.createdAt)).toISOString() : new Date().toISOString(),
    },
  });
}

export async function notifyInboxCampaignStatus(params: {
  campaignName: string;
  platform?: string;
  status: "started" | "stopped";
  startDate?: Date | string | null;
}) {
  const recipients = await getUsersByRoles(["Admin", "admin", "SalesManager", "SalesAgent", "MediaBuyer"]);
  if (recipients.length === 0) return;
  const items = recipients.map((user) => ({
    userId: user.id,
    type: "campaign_alert" as any,
    title: `Campaign ${params.status}: ${params.campaignName}`,
    titleAr: `الحملة ${params.status === "started" ? "بدأت" : "توقفت"}: ${params.campaignName}`,
    body: `${params.campaignName} on ${params.platform ?? "Unknown platform"} has ${params.status}.`,
    bodyAr: `حالة الحملة ${params.campaignName} على ${params.platform ?? "منصة غير معروفة"}: ${params.status === "started" ? "بدأت" : "توقفت"}.`,
    isRead: false,
    link: `/campaigns`,
    metadata: {
      campaignName: params.campaignName,
      platform: params.platform ?? null,
      status: params.status,
      startDate: params.startDate ? new Date(String(params.startDate)).toISOString() : null,
    },
  }));
  await createBulkInAppNotifications(items as any);
}

export async function notifyInboxAdminLeadDistribution(params: {
  leadId: number;
  leadName: string;
  phone?: string;
  campaignName?: string;
  leadTime?: Date | string | null;
  createdAt?: Date | string | null;
  assignedToId: number;
  assignedToName: string;
}) {
  const admins = await getUsersByRoles(["Admin", "admin", "SalesManager"]);
  if (admins.length === 0) return;
  const items = admins.map((admin) => ({
    userId: admin.id,
    type: "lead_distribution" as any,
    title: `Lead distributed: ${params.leadName}`,
    titleAr: `تم توزيع عميل محتمل: ${params.leadName}`,
    body: `${params.leadName} from ${params.campaignName ?? "a campaign"} was assigned to ${params.assignedToName}.`,
    bodyAr: `تم توزيع ${params.leadName} من ${params.campaignName ?? "إحدى الحملات"} على ${params.assignedToName}.`,
    isRead: false,
    link: `/leads/${params.leadId}`,
    metadata: {
      leadId: params.leadId,
      leadName: params.leadName,
      phone: params.phone ?? null,
      campaignName: params.campaignName ?? null,
      assignedToId: params.assignedToId,
      assignedToName: params.assignedToName,
      leadTime: params.leadTime ? new Date(String(params.leadTime)).toISOString() : null,
      createdAt: params.createdAt ? new Date(String(params.createdAt)).toISOString() : new Date().toISOString(),
    },
  }));
  await createBulkInAppNotifications(items as any);
}

export async function notifyInboxMediaBuyerLeadPulse(params: {
  campaignName: string;
  leadId: number;
}) {
  const mediaBuyers = await getUsersByRoles(["MediaBuyer"]);
  if (mediaBuyers.length === 0) return;
  const items = mediaBuyers.map((user) => ({
    userId: user.id,
    type: "campaign_alert" as any,
    title: `Lead received from ${params.campaignName}`,
    titleAr: `تم استلام ليد من ${params.campaignName}`,
    body: `A new lead came from ${params.campaignName}.`,
    bodyAr: `وصل ليد جديد من ${params.campaignName}.`,
    isRead: false,
    link: `/campaigns`,
    metadata: {
      campaignName: params.campaignName,
      leadId: params.leadId,
      visibility: "campaign_only",
    },
  }));
  await createBulkInAppNotifications(items as any);
}

// ─── Notification — Internal Note Created ────────────────────────────────────
export async function notifyInternalNoteCreated(params: {
  leadId: number;
  noteId: number;
  content: string;
  creatorId: number;
}): Promise<void> {
  const lead = await getLeadById(params.leadId);
  if (!lead) return;

  const adminIds = await getAdminIds();
  const recipients = new Set<number>();

  // Add lead owner
  if (lead.ownerId != null) {
    const ownerId = Number(lead.ownerId);
    if (Number.isFinite(ownerId) && ownerId > 0) recipients.add(ownerId);
  }

  // Add admins / sales managers
  for (const id of adminIds) recipients.add(id);

  // Never notify the creator of the note about their own action
  recipients.delete(Number(params.creatorId));

  if (recipients.size === 0) return;

  const display = displayLeadNameOrPhone({ name: (lead as any).name, phone: (lead as any).phone });
  const snippet =
    params.content.length > 120
      ? params.content.slice(0, 120) + "…"
      : params.content;

  const items: InsertInAppNotification[] = Array.from(recipients).map((userId) => ({
    userId,
    type: "internal_note" as any,
    title: `New internal note on lead: ${display}`,
    titleAr: `ملاحظة داخلية جديدة على العميل: ${display}`,
    body: snippet,
    bodyAr: snippet,
    isRead: false,
    link: `/leads/${params.leadId}`,
    metadata: {
      leadId: params.leadId,
      noteId: params.noteId,
      trigger: "internal_note_created",
    },
  }));

  await createBulkInAppNotifications(items);
}

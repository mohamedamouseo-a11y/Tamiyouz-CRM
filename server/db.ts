import { and, asc, desc, eq, gte, ilike, inArray, isNull, isNotNull, like, lt, lte, or, sql, count} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Activity,
  Campaign,
  CustomField,
  Deal,
  InsertActivity,
  InsertCampaign,
  InsertCustomField,
  InsertDeal,
  InsertLead,
  InsertPipelineStage,
  InsertUser,
  Lead,
  NotificationSubscriber,
  InsertNotificationSubscriber,
  PasswordResetToken,
  PipelineStage,
  SlaConfig,
  ThemeSetting,
  User,
  activities,
  campaigns,
  customFields,
  deals,
  leads,
  notificationSubscribers,
  passwordResetTokens,
  pipelineStages,
  slaConfig,
  themeSettings,
  users,
  internalNotes,
  leadTransfers,
  chatMessages,
  auditLogs,
  inAppNotifications,
  InAppNotification,
  InsertInAppNotification,
  clients,
  Client,
  InsertClient,
  servicePackages,
  ServicePackage,
  InsertServicePackage,
  contracts,
  Contract,
  InsertContract,
  followUps,
  FollowUp,
  InsertFollowUp,
  clientTasks,
  ClientTask,
  InsertClientTask,
  onboardingChecklists,
  clientOnboardingItems,
  InsertClientOnboardingItem,
  clientObjectives,
  keyResults,
  deliverables,
  upsellOpportunities,
  clientCommunications,
  csatSurveys,
  leadAssignments,
  InsertClientObjective,
  InsertKeyResult,
  InsertDeliverable,
  InsertUpsellOpportunity,
  InsertClientCommunication,
  InsertCsatSurvey,
  meetingNotificationConfig,
  MeetingNotificationConfig,
  InsertMeetingNotificationConfig,
  leadReminders,
  LeadReminder,
  InsertLeadReminder,
  userNotificationPreferences,
  UserNotificationPreference,
  notificationSoundConfig,
  NotificationSoundConfig,
  exchangeRates,
  ExchangeRate,
  InsertExchangeRate,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { notifyNewLead, notifyLeadAssigned, notifySLABreach, notifyStageChange, notifyDealWon, notifyDealLost, notifyActivityLogged, notifyLeadQualityChange, notifyLeadTransfer, notifyDuplicateLead } from "./notificationEngine";
import { convertMoney, normalizeCurrency, BASE_CURRENCY } from "./lib/currency";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Phone Normalization ──────────────────────────────────────────────────────
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");
  // Handle leading zeros: 0XXXXXXXXX → 966XXXXXXXXX
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "966" + digits.slice(1);
  }
  // Handle +966 format
  if (digits.startsWith("966") && digits.length === 12) {
    return "+" + digits;
  }
  // Handle 5XXXXXXXX (9 digits, Saudi mobile)
  if (digits.startsWith("5") && digits.length === 9) {
    return "+966" + digits;
  }
  // Already has country code without +
  if (digits.length >= 11) {
    return "+" + digits;
  }
  return phone; // Return as-is if can't normalize
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "Admin";
    updateSet.role = "Admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createUser(data: InsertUser): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values(data);
  const created = await db.select().from(users).where(eq(users.email, data.email!)).limit(1);
  if (!created[0]) throw new Error("Failed to create user");
  return created[0];
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(isNull(users.deletedAt)).orderBy(users.name);
}

// Helper: get user display name by ID (used in notifications)
async function _getUserNameById(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "Unknown";
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.name ?? "Unknown";
}

export async function getUsersByRole(role: string): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(and(eq(users.role, role as any), isNull(users.deletedAt)));
}

export async function updateUser(id: number, data: Partial<InsertUser>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
}
export async function deleteUser(id: number, deletedByUserId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ deletedAt: new Date(), deletedBy: deletedByUserId ?? null, isActive: false } as any).where(eq(users.id, id));
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export interface LeadFilters {
  ownerId?: number;
  assignedUserId?: number;
  stage?: string;
  leadQuality?: string;
  fitStatus?: string;
  campaignName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  slaBreached?: boolean;
  isDuplicate?: boolean;
  limit?: number;
  offset?: number;
}

export async function getLeads(filters: LeadFilters = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [isNull(leads.deletedAt)];
  if (filters.assignedUserId) {
    // Show leads where user is owner OR has an active assignment
    const assignedLeadIds = await db.execute(sql`
      SELECT DISTINCT leadId FROM lead_assignments
      WHERE userId = ${filters.assignedUserId} AND isActive = 1
    `);
    const ids = ((assignedLeadIds as any)[0] ?? []).map((r: any) => r.leadId);
    if (ids.length > 0) {
      conditions.push(
        or(
          eq(leads.ownerId, filters.assignedUserId),
          inArray(leads.id, ids)
        )!
      );
    } else {
      conditions.push(eq(leads.ownerId, filters.assignedUserId));
    }
  } else if (filters.ownerId) {
    conditions.push(eq(leads.ownerId, filters.ownerId));
  }
  if (filters.stage) conditions.push(eq(leads.stage, filters.stage));
  if (filters.leadQuality) conditions.push(eq(leads.leadQuality, filters.leadQuality as any));
  if (filters.fitStatus) conditions.push(eq(leads.fitStatus, filters.fitStatus as any));
  if (filters.campaignName) conditions.push(eq(leads.campaignName, filters.campaignName));
  // Filter by contactTime (date when client was contacted)
  if (filters.dateFrom) {
    conditions.push(gte(leads.contactTime, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(leads.contactTime, filters.dateTo));
  }
  if (filters.slaBreached !== undefined) conditions.push(eq(leads.slaBreached, filters.slaBreached));
  if (filters.isDuplicate !== undefined) conditions.push(eq(leads.isDuplicate, filters.isDuplicate));
  if (filters.search) {
    conditions.push(
      or(
        like(leads.name, `%${filters.search}%`),
        like(leads.phone, `%${filters.search}%`),
        like(leads.businessProfile, `%${filters.search}%`)
      )!
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      country: leads.country,
      businessProfile: leads.businessProfile,
      leadQuality: leads.leadQuality,
      fitStatus: leads.fitStatus,
      stage: leads.stage,
      campaignName: leads.campaignName,
      adCreative: leads.adCreative,
      ownerId: leads.ownerId,
      slaBreached: leads.slaBreached,
      isDuplicate: leads.isDuplicate,
      duplicateOfId: leads.duplicateOfId,
      notes: leads.notes,
      leadTime: leads.leadTime,
      contactTime: leads.contactTime,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      customFieldsData: leads.customFieldsData,
      sourceMetadata: leads.sourceMetadata,
      externalId: leads.externalId,
      ownerName: users.name,
    })
    .from(leads)
    .leftJoin(users, eq(leads.ownerId, users.id))
    .where(whereClause)
    .orderBy(desc(leads.contactTime ?? leads.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);
  // Map rows to include owner object for frontend compatibility
  return rows.map((row) => ({
    ...row,
    owner: row.ownerName ? { name: row.ownerName } : null,
  }));
}

export async function getLeadById(id: number): Promise<any | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      country: leads.country,
      businessProfile: leads.businessProfile,
      leadQuality: leads.leadQuality,
      fitStatus: leads.fitStatus,
      stage: leads.stage,
      campaignName: leads.campaignName,
      adCreative: leads.adCreative,
      ownerId: leads.ownerId,
      slaBreached: leads.slaBreached,
      isDuplicate: leads.isDuplicate,
      duplicateOfId: leads.duplicateOfId,
      notes: leads.notes,
      mediaBuyerNotes: leads.mediaBuyerNotes,
      serviceIntroduced: leads.serviceIntroduced,
      priceOfferSent: leads.priceOfferSent,
      priceOfferLink: leads.priceOfferLink,
      leadTime: leads.leadTime,
      contactTime: leads.contactTime,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      deletedAt: leads.deletedAt,
      customFieldsData: leads.customFieldsData,
      sourceMetadata: leads.sourceMetadata,
      externalId: leads.externalId,
      ownerName: users.name,
    })
    .from(leads)
    .leftJoin(users, eq(leads.ownerId, users.id))
    .where(eq(leads.id, id))
    .limit(1);
  if (!result[0]) return undefined;
  return {
    ...result[0],
    owner: result[0].ownerName ? { name: result[0].ownerName } : null,
  };
}

export async function createLead(data: InsertLead): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normalize phone
  if (data.phone) data.phone = normalizePhone(data.phone);

  // Check for duplicates
  const existing = await db
    .select()
    .from(leads)
    .where(eq(leads.phone, data.phone))
    .limit(1);

  if (existing.length > 0) {
    data.isDuplicate = true;
    data.duplicateOfId = existing[0].id;
  }
  const result = await db.insert(leads).values(data);
  const createdId = (result as any)[0]?.insertId ?? 0;
  notifyNewLead({
    id: createdId,
    name: data.name,
    phone: data.phone,
    campaignName: data.campaignName,
    ownerId: data.ownerId,
  }).catch((err) => console.error("[NotificationEngine] notifyNewLead error:", err));
  // Notification #10 — Duplicate Lead Detected
  if (data.isDuplicate && data.duplicateOfId) {
    notifyDuplicateLead({
      id: createdId,
      name: data.name,
      phone: data.phone,
      duplicateOfId: data.duplicateOfId,
      ownerId: data.ownerId,
    }).catch((err) => console.error("[NotificationEngine] notifyDuplicateLead error:", err));
  }
  return createdId;
}


export async function getLeadByPhone(phone: string): Promise<any | null> {
  const db = await getDb();
  const result = await db
    .select()
    .from(leads)
    .where(and(eq(leads.phone, phone), isNull(leads.deletedAt)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function updateLead(id: number, data: Partial<InsertLead>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existingLead = await getLeadById(id);
  if (data.phone) data.phone = normalizePhone(data.phone);
  await db.update(leads).set(data).where(eq(leads.id, id));
  // Notification #2 — Lead Assigned (owner changed)
  if (data.ownerId && existingLead && data.ownerId !== existingLead.ownerId) {
    notifyLeadAssigned(
      { id, name: existingLead.name, phone: existingLead.phone },
      data.ownerId
    ).catch((err) => console.error("[NotificationEngine] notifyLeadAssigned error:", err));
  }
  // Notification #4 — Stage Change
  if (data.stage && existingLead && data.stage !== existingLead.stage) {
    notifyStageChange({
      id,
      name: existingLead.name,
      phone: existingLead.phone,
      ownerId: data.ownerId ?? existingLead.ownerId,
      oldStage: existingLead.stage,
      newStage: data.stage,
    }).catch((err) => console.error("[NotificationEngine] notifyStageChange error:", err));
  }
  // Notification #8 — Lead Quality Change
  if (data.leadQuality && existingLead && data.leadQuality !== existingLead.leadQuality) {
    notifyLeadQualityChange({
      id,
      name: existingLead.name,
      phone: existingLead.phone,
      ownerId: data.ownerId ?? existingLead.ownerId,
      oldQuality: existingLead.leadQuality,
      newQuality: data.leadQuality,
    }).catch((err) => console.error("[NotificationEngine] notifyLeadQualityChange error:", err));
  }
}

export async function deleteLead(id: number, deletedByUserId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(leads).set({ deletedAt: new Date(), deletedBy: deletedByUserId ?? null } as any).where(eq(leads.id, id));
}

export async function getLeadsCount(filters: LeadFilters = {}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const conditions = [isNull(leads.deletedAt)];
  if (filters.assignedUserId) {
    // Show leads where user is owner OR has an active assignment
    const assignedLeadIds = await db.execute(sql`
      SELECT DISTINCT leadId FROM lead_assignments
      WHERE userId = ${filters.assignedUserId} AND isActive = 1
    `);
    const ids = ((assignedLeadIds as any)[0] ?? []).map((r: any) => r.leadId);
    if (ids.length > 0) {
      conditions.push(
        or(
          eq(leads.ownerId, filters.assignedUserId),
          inArray(leads.id, ids)
        )!
      );
    } else {
      conditions.push(eq(leads.ownerId, filters.assignedUserId));
    }
  } else if (filters.ownerId) {
    conditions.push(eq(leads.ownerId, filters.ownerId));
  }
  if (filters.stage) conditions.push(eq(leads.stage, filters.stage));
  if (filters.leadQuality) conditions.push(eq(leads.leadQuality, filters.leadQuality as any));
  if (filters.fitStatus) conditions.push(eq(leads.fitStatus, filters.fitStatus as any));
  if (filters.campaignName) conditions.push(eq(leads.campaignName, filters.campaignName));
  if (filters.dateFrom) {
    conditions.push(gte(leads.contactTime, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(leads.contactTime, filters.dateTo));
  }
  if (filters.slaBreached !== undefined) conditions.push(eq(leads.slaBreached, filters.slaBreached));

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return Number(result[0]?.count ?? 0);
}

// ─── Round-Robin Assignment ───────────────────────────────────────────────────
export async function assignLeadRoundRobin(campaignName: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Find campaign
  const campaign = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.name, campaignName), eq(campaigns.roundRobinEnabled, true)))
    .limit(1);

  if (!campaign.length || !campaign[0].roundRobinEnabled) return null;

  // Get active sales agents
  const agents = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "SalesAgent"), eq(users.isActive, true)));

  if (!agents.length) return null;

  const currentIndex = campaign[0].roundRobinIndex % agents.length;
  const assignedAgent = agents[currentIndex];

  // Update round-robin index
  await db
    .update(campaigns)
    .set({ roundRobinIndex: currentIndex + 1 })
    .where(eq(campaigns.id, campaign[0].id));

  return assignedAgent.id;
}

// ─── SLA Check ────────────────────────────────────────────────────────────────
export async function checkAndUpdateSLA(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const config = await db.select().from(slaConfig).limit(1);
  if (!config.length || !config[0].isEnabled) return 0;

  const hoursThreshold = config[0].hoursThreshold;
  const thresholdDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

  // Find leads created before threshold with no activities
  const leadsWithNoActivity = await db.execute(sql`
    SELECT l.id FROM leads l
    LEFT JOIN activities a ON a.leadId = l.id
    WHERE l.createdAt < ${thresholdDate}
    AND l.slaBreached = false
    AND l.deletedAt IS NULL
    AND a.id IS NULL
  `);

  const breachedIds = (leadsWithNoActivity as any)[0]?.map((r: any) => r.id) ?? [];

  if (breachedIds.length > 0) {
    // Fetch full lead data before updating for notifications
    const breachedLeads = await db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        ownerId: leads.ownerId,
        slaAlertedAt: leads.slaAlertedAt,
      })
      .from(leads)
      .where(inArray(leads.id, breachedIds));

    await db
      .update(leads)
      .set({ slaBreached: true, slaAlertedAt: new Date() })
      .where(inArray(leads.id, breachedIds));

    if (breachedLeads.length > 0) {
      notifySLABreach(breachedLeads).catch((err) =>
        console.error("[NotificationEngine] notifySLABreach error:", err)
      );
    }
  }

  return breachedIds.length;
}

// ─── Activities ───────────────────────────────────────────────────────────────
export async function getActivitiesByLead(leadId: number): Promise<Activity[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.leadId, leadId), isNull(activities.deletedAt)))
    .orderBy(desc(activities.activityTime));
}

export async function getActivitiesByUser(userId: number, limit = 20): Promise<Activity[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, userId), isNull(activities.deletedAt)))
    .orderBy(desc(activities.activityTime))
    .limit(limit);
}

export async function createActivity(data: InsertActivity): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(activities).values(data);
  const activityId = (result as any)[0]?.insertId ?? 0;
  // Mark lead as contacted (update contactTime if first activity)
  const existingActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.leadId, data.leadId))
    .limit(2);
  if (existingActivities.length === 1) {
    await db
      .update(leads)
      .set({ contactTime: new Date(), slaBreached: false })
      .where(eq(leads.id, data.leadId));
  }

  // Auto-update lead stage based on activity outcome
  if (data.outcome) {
    const outcomeToStage: Record<string, string> = {
      Contacted: 'Contacted',
      Meeting: 'Meeting Scheduled',
      Offer: 'Proposal Delivered',
      Won: 'Won',
      Lost: 'Lost',
      Callback: 'Contact Again',
      Interested: 'Contacted',
      NotInterested: 'Lost',
    };
    const newStage = outcomeToStage[data.outcome];
    if (newStage) {
      // Only advance stage, never go backward (except Lost)
      const stageOrder: Record<string, number> = {
        'New': 0, 'CREATED': 0, 'Contacted Us': 1, 'Contacted': 2,
        'Leads': 3, 'Meeting Scheduled': 4, 'Proposal Delivered': 5,
        'Won': 6, 'Contact Again': 7, 'Lost': 8,
      };
      const currentLead = await db.select({ stage: leads.stage }).from(leads).where(eq(leads.id, data.leadId)).limit(1);
      const currentStage = currentLead[0]?.stage ?? 'New';
      const currentOrder = stageOrder[currentStage] ?? 0;
      const newOrder = stageOrder[newStage] ?? 0;
      if (newOrder > currentOrder || newStage === 'Lost' || newStage === 'Won' || newStage === 'Contact Again') {
        await db.update(leads).set({ stage: newStage }).where(eq(leads.id, data.leadId));
      }
    }
  }

  // Notification #7 — Activity Logged
  notifyActivityLogged({
    id: activityId,
    leadId: data.leadId,
    userId: data.userId,
    type: data.type,
    outcome: data.outcome,
  }).catch((err) => console.error("[NotificationEngine] notifyActivityLogged error:", err));
  return activityId;
}

export async function updateActivity(id: number, data: Partial<InsertActivity>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(activities).set(data).where(eq(activities.id, id));
}

export async function deleteActivity(id: number, deletedByUserId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(activities).set({ deletedAt: new Date(), deletedBy: deletedByUserId ?? null } as any).where(eq(activities.id, id));
}

// ─── Deals ────────────────────────────────────────────────────────────────────
export async function getDealByLead(leadId: number): Promise<Deal | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(deals).where(eq(deals.leadId, leadId)).limit(1);
  return result[0];
}

export async function getDealsByUser(userId: number): Promise<Deal[]> {
  const db = await getDb();
  if (!db) return [];
  // Join with leads to filter by owner
  const result = await db.execute(sql`
    SELECT d.* FROM deals d
    JOIN leads l ON l.id = d.leadId
    WHERE l.ownerId = ${userId}
    ORDER BY d.createdAt DESC
  `);
  return (result as any)[0] ?? [];
}

export async function createDeal(data: InsertDeal): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Multi-currency: calculate valueBase before insert
  const dealCurrency = normalizeCurrency((data as any).currency);
  const dealValue = String((data as any).valueSar || 0);
  const valueBase = await convertMoney(dealValue, dealCurrency, BASE_CURRENCY);
  const result = await db.insert(deals).values({ ...data, currency: dealCurrency, valueBase } as any);
  const dealId = (result as any)[0]?.insertId ?? 0;
  // Update lead stage based on deal status
  if (data.status === "Won") {
    await db.update(leads).set({ stage: "Won" }).where(eq(leads.id, data.leadId));
  } else if (data.status === "Lost") {
    await db.update(leads).set({ stage: "Lost" }).where(eq(leads.id, data.leadId));
  }
  // Notification #5/#6 — Deal Won/Lost
  const lead = await getLeadById(data.leadId);
  const leadName = lead ? (lead.name ?? lead.phone) : `Lead #${data.leadId}`;
  const ownerName = lead?.ownerId ? await _getUserNameById(lead.ownerId) : "Unknown";
  if (data.status === "Won") {
    notifyDealWon({ id: dealId, leadId: data.leadId, valueSar: data.valueSar }, leadName, ownerName)
      .catch((err) => console.error("[NotificationEngine] notifyDealWon error:", err));
  } else if (data.status === "Lost") {
    notifyDealLost({ id: dealId, leadId: data.leadId, lossReason: data.lossReason }, leadName, ownerName)
      .catch((err) => console.error("[NotificationEngine] notifyDealLost error:", err));
  }
  return dealId;
}

export async function updateDeal(id: number, data: Partial<InsertDeal>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Multi-currency: recalculate valueBase if value or currency changed
  if ((data as any).valueSar !== undefined || (data as any).currency !== undefined) {
    const [existing] = await db.select({ valueSar: deals.valueSar, currency: deals.currency }).from(deals).where(eq(deals.id, id)).limit(1);
    const nextCurrency = normalizeCurrency((data as any).currency ?? existing?.currency);
    const nextValue = String((data as any).valueSar ?? existing?.valueSar ?? 0);
    const nextValueBase = await convertMoney(nextValue, nextCurrency, BASE_CURRENCY);
    (data as any).currency = nextCurrency;
    (data as any).valueBase = nextValueBase;
  }
  await db.update(deals).set(data).where(eq(deals.id, id));
  // Update lead stage if deal status changed
  if (data.status && data.leadId) {
    if (data.status === "Won") {
      await db.update(leads).set({ stage: "Won" }).where(eq(leads.id, data.leadId));
    } else if (data.status === "Lost") {
      await db.update(leads).set({ stage: "Lost" }).where(eq(leads.id, data.leadId));
    }
    // Notification #5/#6 — Deal Won/Lost on update
    const lead = await getLeadById(data.leadId);
    const leadName = lead ? (lead.name ?? lead.phone) : `Lead #${data.leadId}`;
    const ownerName = lead?.ownerId ? await _getUserNameById(lead.ownerId) : "Unknown";
    if (data.status === "Won") {
      notifyDealWon({ id, leadId: data.leadId, valueSar: data.valueSar }, leadName, ownerName)
        .catch((err) => console.error("[NotificationEngine] notifyDealWon error:", err));
      // ── Account Management Handoff: auto-create client when deal is Won ──
      try {
        const existingClient = await db.select().from(clients).where(eq(clients.leadId, data.leadId)).limit(1);
        if (existingClient.length === 0 && lead) {
          await db.insert(clients).values({
            leadId: data.leadId,
            dealId: id,
            businessProfile: lead.businessProfile ?? lead.name ?? null,
            planStatus: "Active",
            renewalStatus: "Pending",
            notes: `Auto-created from Deal #${id} won on ${new Date().toISOString()}`,
          });
          console.log(`[AccountMgmt] Auto-created client for lead #${data.leadId} from deal #${id}`);
        }
      } catch (err) {
        console.error("[AccountMgmt] Handoff error:", err);
      }
    } else if (data.status === "Lost") {
      notifyDealLost({ id, leadId: data.leadId, lossReason: data.lossReason }, leadName, ownerName)
        .catch((err) => console.error("[NotificationEngine] notifyDealLost error:", err));
    }
  }
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
export async function getCampaigns(): Promise<Campaign[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).where(isNull(campaigns.deletedAt)).orderBy(desc(campaigns.createdAt));
}

export async function createCampaign(data: InsertCampaign): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaigns).values(data);
  return (result as any)[0]?.insertId ?? 0;
}

export async function updateCampaign(id: number, data: Partial<InsertCampaign>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(campaigns).set(data).where(eq(campaigns.id, id));
}

export async function deleteCampaign(id: number, deletedByUserId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(campaigns).set({ deletedAt: new Date(), deletedBy: deletedByUserId ?? null } as any).where(eq(campaigns.id, id));
}

// ─── Campaign Stats ───────────────────────────────────────────────────────────
export interface CampaignLeadStats {
  campaignName: string;
  totalLeads: number;
  hot: number;
  warm: number;
  cold: number;
  bad: number;
  unknown: number;
}
export async function getCampaignStats(dateFrom?: Date, dateTo?: Date): Promise<CampaignLeadStats[]> {
  const db = await getDb();
  if (!db) return [];
  const hasDateFilter = dateFrom && dateTo;
  const rows = hasDateFilter
    ? await db.execute(sql`
        SELECT
          COALESCE(l.campaignName, 'Unassigned') AS campaignName,
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN l.leadQuality = 'Hot' THEN 1 ELSE 0 END) AS hot,
          SUM(CASE WHEN l.leadQuality = 'Warm' THEN 1 ELSE 0 END) AS warm,
          SUM(CASE WHEN l.leadQuality = 'Cold' THEN 1 ELSE 0 END) AS cold,
          SUM(CASE WHEN l.leadQuality = 'Bad' THEN 1 ELSE 0 END) AS bad,
          SUM(CASE WHEN l.leadQuality = 'Unknown' THEN 1 ELSE 0 END) AS unknown
        FROM leads l
        WHERE l.createdAt >= ${dateFrom} AND l.createdAt <= ${dateTo} AND l.deletedAt IS NULL
        GROUP BY l.campaignName
        ORDER BY totalLeads DESC
      `)
    : await db.execute(sql`
        SELECT
          COALESCE(l.campaignName, 'Unassigned') AS campaignName,
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN l.leadQuality = 'Hot' THEN 1 ELSE 0 END) AS hot,
          SUM(CASE WHEN l.leadQuality = 'Warm' THEN 1 ELSE 0 END) AS warm,
          SUM(CASE WHEN l.leadQuality = 'Cold' THEN 1 ELSE 0 END) AS cold,
          SUM(CASE WHEN l.leadQuality = 'Bad' THEN 1 ELSE 0 END) AS bad,
          SUM(CASE WHEN l.leadQuality = 'Unknown' THEN 1 ELSE 0 END) AS unknown
        FROM leads l
        WHERE l.deletedAt IS NULL
        GROUP BY l.campaignName
        ORDER BY totalLeads DESC
      `);
  return ((rows as any)[0] ?? []).map((r: any) => ({
    campaignName: r.campaignName ?? 'Unassigned',
    totalLeads: Number(r.totalLeads ?? 0),
    hot: Number(r.hot ?? 0),
    warm: Number(r.warm ?? 0),
    cold: Number(r.cold ?? 0),
    bad: Number(r.bad ?? 0),
    unknown: Number(r.unknown ?? 0),
  }));
}

// ─── Campaign Detail (per ad-creative breakdown) ─────────────────────────────
export interface AdCreativeStats {
  adCreative: string;
  totalLeads: number;
  hot: number;
  warm: number;
  cold: number;
  bad: number;
  unknown: number;
}
export interface CampaignDetail {
  campaignName: string;
  totalLeads: number;
  hot: number;
  warm: number;
  cold: number;
  bad: number;
  unknown: number;
  adCreatives: AdCreativeStats[];
}
export async function getCampaignDetail(campaignName: string, dateFrom?: Date, dateTo?: Date): Promise<CampaignDetail | null> {
  const db = await getDb();
  if (!db) return null;
  const hasDateFilter = dateFrom && dateTo;

  // Overall campaign stats
  const totalRows = hasDateFilter
    ? await db.execute(sql`
        SELECT
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN leadQuality = 'Hot' THEN 1 ELSE 0 END) AS hot,
          SUM(CASE WHEN leadQuality = 'Warm' THEN 1 ELSE 0 END) AS warm,
          SUM(CASE WHEN leadQuality = 'Cold' THEN 1 ELSE 0 END) AS cold,
          SUM(CASE WHEN leadQuality = 'Bad' THEN 1 ELSE 0 END) AS bad,
          SUM(CASE WHEN leadQuality = 'Unknown' THEN 1 ELSE 0 END) AS unknown
        FROM leads
        WHERE campaignName = ${campaignName} AND deletedAt IS NULL AND createdAt >= ${dateFrom} AND createdAt <= ${dateTo}
      `)
    : await db.execute(sql`
        SELECT
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN leadQuality = 'Hot' THEN 1 ELSE 0 END) AS hot,
          SUM(CASE WHEN leadQuality = 'Warm' THEN 1 ELSE 0 END) AS warm,
          SUM(CASE WHEN leadQuality = 'Cold' THEN 1 ELSE 0 END) AS cold,
          SUM(CASE WHEN leadQuality = 'Bad' THEN 1 ELSE 0 END) AS bad,
          SUM(CASE WHEN leadQuality = 'Unknown' THEN 1 ELSE 0 END) AS unknown
        FROM leads
        WHERE campaignName = ${campaignName} AND deletedAt IS NULL
      `);
  const t = ((totalRows as any)[0] ?? [])[0];
  if (!t || Number(t.totalLeads) === 0) {
    return {
      campaignName,
      totalLeads: 0, hot: 0, warm: 0, cold: 0, bad: 0, unknown: 0,
      adCreatives: [],
    };
  }

  // Per ad-creative breakdown
  const adRows = hasDateFilter
    ? await db.execute(sql`
        SELECT
          COALESCE(adCreative, 'بدون إعلان') AS adCreative,
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN leadQuality = 'Hot' THEN 1 ELSE 0 END) AS hot,
          SUM(CASE WHEN leadQuality = 'Warm' THEN 1 ELSE 0 END) AS warm,
          SUM(CASE WHEN leadQuality = 'Cold' THEN 1 ELSE 0 END) AS cold,
          SUM(CASE WHEN leadQuality = 'Bad' THEN 1 ELSE 0 END) AS bad,
          SUM(CASE WHEN leadQuality = 'Unknown' THEN 1 ELSE 0 END) AS unknown
        FROM leads
        WHERE campaignName = ${campaignName} AND deletedAt IS NULL AND createdAt >= ${dateFrom} AND createdAt <= ${dateTo}
        GROUP BY adCreative
        ORDER BY totalLeads DESC
      `)
    : await db.execute(sql`
        SELECT
          COALESCE(adCreative, 'بدون إعلان') AS adCreative,
          COUNT(*) AS totalLeads,
          SUM(CASE WHEN leadQuality = 'Hot' THEN 1 ELSE 0 END) AS hot,
          SUM(CASE WHEN leadQuality = 'Warm' THEN 1 ELSE 0 END) AS warm,
          SUM(CASE WHEN leadQuality = 'Cold' THEN 1 ELSE 0 END) AS cold,
          SUM(CASE WHEN leadQuality = 'Bad' THEN 1 ELSE 0 END) AS bad,
          SUM(CASE WHEN leadQuality = 'Unknown' THEN 1 ELSE 0 END) AS unknown
        FROM leads
        WHERE campaignName = ${campaignName} AND deletedAt IS NULL
        GROUP BY adCreative
        ORDER BY totalLeads DESC
      `);

  const adCreatives: AdCreativeStats[] = ((adRows as any)[0] ?? []).map((r: any) => ({
    adCreative: r.adCreative ?? 'بدون إعلان',
    totalLeads: Number(r.totalLeads ?? 0),
    hot: Number(r.hot ?? 0),
    warm: Number(r.warm ?? 0),
    cold: Number(r.cold ?? 0),
    bad: Number(r.bad ?? 0),
    unknown: Number(r.unknown ?? 0),
  }));

  return {
    campaignName,
    totalLeads: Number(t.totalLeads ?? 0),
    hot: Number(t.hot ?? 0),
    warm: Number(t.warm ?? 0),
    cold: Number(t.cold ?? 0),
    bad: Number(t.bad ?? 0),
    unknown: Number(t.unknown ?? 0),
    adCreatives,
  };
}

// ─── Pipeline Stages ─────────────────────────────────────────────────────────
export async function getPipelineStages(): Promise<PipelineStage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pipelineStages).orderBy(pipelineStages.order);
}

export async function createPipelineStage(data: InsertPipelineStage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pipelineStages).values(data);
  return (result as any)[0]?.insertId ?? 0;
}

export async function updatePipelineStage(id: number, data: Partial<InsertPipelineStage>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(pipelineStages).set(data).where(eq(pipelineStages.id, id));
}

export async function deletePipelineStage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
}

// ─── Custom Fields ────────────────────────────────────────────────────────────
export async function getCustomFields(entity?: string): Promise<CustomField[]> {
  const db = await getDb();
  if (!db) return [];
  if (entity) {
    return db
      .select()
      .from(customFields)
      .where(eq(customFields.entity, entity as any))
      .orderBy(customFields.order);
  }
  return db.select().from(customFields).orderBy(customFields.entity, customFields.order);
}

export async function createCustomField(data: InsertCustomField): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customFields).values(data);
  return (result as any)[0]?.insertId ?? 0;
}

export async function deleteCustomField(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(customFields).where(eq(customFields.id, id));
}

// ─── Theme Settings ───────────────────────────────────────────────────────────
export async function getThemeSettings(): Promise<ThemeSetting[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(themeSettings);
}

export async function upsertThemeSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(themeSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

// ─── SLA Config ───────────────────────────────────────────────────────────────
export async function getSlaConfig(): Promise<SlaConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(slaConfig).limit(1);
  return result[0];
}

export async function updateSlaConfig(hoursThreshold: number, isEnabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(slaConfig).limit(1);
  if (existing.length > 0) {
    await db.update(slaConfig).set({ hoursThreshold, isEnabled });
  } else {
    await db.insert(slaConfig).values({ hoursThreshold, isEnabled });
  }
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getAgentStats(userId: number, dateFrom?: Date, dateTo?: Date, role?: string) {
  const db = await getDb();
  if (!db) return null;
  const from = dateFrom ?? new Date(0);
  const to = dateTo ?? new Date();
  if (dateTo) { to.setHours(23, 59, 59, 999); }
  const isMediaBuyer = role === "MediaBuyer";
  const leadConditions = isMediaBuyer
    ? [isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)]
    : [eq(leads.ownerId, userId), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)];
  const activityConditions = isMediaBuyer
    ? [gte(activities.createdAt, from), lte(activities.createdAt, to)]
    : [eq(activities.userId, userId), gte(activities.createdAt, from), lte(activities.createdAt, to)];
  const [myLeads, myActivities, myDeals, slaBreached] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...leadConditions)),
    db.select({ count: sql<number>`count(*)` }).from(activities).where(and(...activityConditions)),
    isMediaBuyer
      ? db.execute(sql`SELECT COUNT(*) as count, COALESCE(SUM(d.valueBase), 0) as totalValue FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to}`)
      : db.execute(sql`SELECT COUNT(*) as count, COALESCE(SUM(d.valueBase), 0) as totalValue FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.ownerId = ${userId} AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to}`),
    isMediaBuyer
      ? db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.slaBreached, true), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)))
      : db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.ownerId, userId), eq(leads.slaBreached, true), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to))),
  ]);
  const dealsData = (myDeals as any)[0]?.[0] ?? { count: 0, totalValue: 0 };
  
  // Revenue breakdown by currency
  const revenueBreakdownQuery = isMediaBuyer
    ? db.execute(sql`SELECT COALESCE(d.currency, 'SAR') as currency, COALESCE(SUM(CAST(d.valueSar AS DECIMAL(15,2))), 0) as total FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to} GROUP BY d.currency`)
    : db.execute(sql`SELECT COALESCE(d.currency, 'SAR') as currency, COALESCE(SUM(CAST(d.valueSar AS DECIMAL(15,2))), 0) as total FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.ownerId = ${userId} AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to} GROUP BY d.currency`);
  const breakdownRows = (await revenueBreakdownQuery as any)[0] ?? [];
  const revenueBreakdown = Array.isArray(breakdownRows) ? breakdownRows.map((r: any) => ({ currency: r.currency || "SAR", total: Number(r.total || 0) })) : [];
  
  // Conversion rate queries
  const meetingStages = ['Meeting Scheduled', 'Proposal Delivered', 'Won'];
  const contactedStages = ['Contacted', 'Leads', 'Meeting Scheduled', 'Proposal Delivered', 'Won', 'Contact Again'];
  const wonStages = ['Won'];

  const convBaseConditions = isMediaBuyer
    ? [isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)]
    : [eq(leads.ownerId, userId), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)];
  const [contactedLeads, meetingLeads, wonLeads] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...convBaseConditions, inArray(leads.stage, contactedStages))),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...convBaseConditions, inArray(leads.stage, meetingStages))),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...convBaseConditions, inArray(leads.stage, wonStages))),
  ]);

  const contactedCount = Number(contactedLeads[0]?.count ?? 0);
  const meetingCount = Number(meetingLeads[0]?.count ?? 0);
  const wonCount = Number(wonLeads[0]?.count ?? 0);

  return {
    totalLeads: Number(myLeads[0]?.count ?? 0),
    totalActivities: Number(myActivities[0]?.count ?? 0),
    wonDeals: Number(dealsData.count ?? 0),
    totalRevenue: Number(dealsData.totalValue ?? 0),
    revenueBreakdown,
    slaBreached: Number(slaBreached[0]?.count ?? 0),
    contactToMeetingRate: contactedCount > 0 ? Math.round((meetingCount / contactedCount) * 100 * 10) / 10 : 0,
    meetingToCloseRate: meetingCount > 0 ? Math.round((wonCount / meetingCount) * 100 * 10) / 10 : 0,
    contactedCount,
    meetingCount,
    wonCount,
  };
}

export async function getTeamStats(dateFrom?: Date, dateTo?: Date) {
  const db = await getDb();
  if (!db) return null;
  const from = dateFrom ?? new Date(0);
  const to = dateTo ?? new Date();
  if (dateTo) { to.setHours(23, 59, 59, 999); }
  const [totalLeads, totalDeals, stageBreakdown, agentPerformance] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leads).where(and(isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to))),
    db.execute(sql`
      SELECT status, COUNT(*) as count, COALESCE(SUM(valueBase), 0) as totalValue
      FROM deals WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to} GROUP BY status
    `),
    db.execute(sql`
      SELECT stage, COUNT(*) as count FROM leads
      WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to} GROUP BY stage
    `),
    db.execute(sql`
      SELECT u.id, u.name,
        COALESCE(lc.leadCount, 0) as leadCount,
        COALESCE(ac.activityCount, 0) as activityCount,
        COALESCE(dc.wonDeals, 0) as wonDeals,
        COALESCE(dc.revenue, 0) as revenue,
        COALESCE(lc.slaBreachedCount, 0) as slaBreachedCount,
        COALESCE(lc.contactedCount, 0) as contactedCount,
        COALESCE(lc.meetingCount, 0) as meetingCount,
        COALESCE(lc.wonStageCount, 0) as wonStageCount
      FROM users u
      LEFT JOIN (
        SELECT ownerId,
          COUNT(*) as leadCount,
          SUM(CASE WHEN slaBreached = 1 THEN 1 ELSE 0 END) as slaBreachedCount,
          SUM(CASE WHEN stage IN ('Contacted','Leads','Meeting Scheduled','Proposal Delivered','Won','Contact Again') THEN 1 ELSE 0 END) as contactedCount,
          SUM(CASE WHEN stage IN ('Meeting Scheduled','Proposal Delivered','Won') THEN 1 ELSE 0 END) as meetingCount,
          SUM(CASE WHEN stage = 'Won' THEN 1 ELSE 0 END) as wonStageCount
        FROM leads
        WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to}
        GROUP BY ownerId
      ) lc ON lc.ownerId = u.id
      LEFT JOIN (
        SELECT userId, COUNT(*) as activityCount
        FROM activities
        WHERE createdAt BETWEEN ${from} AND ${to}
        GROUP BY userId
      ) ac ON ac.userId = u.id
      LEFT JOIN (
        SELECT l2.ownerId,
          COUNT(d.id) as wonDeals,
          COALESCE(SUM(d.valueBase), 0) as revenue
        FROM deals d
        JOIN leads l2 ON l2.id = d.leadId AND l2.deletedAt IS NULL
        WHERE d.deletedAt IS NULL AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to}
        GROUP BY l2.ownerId
      ) dc ON dc.ownerId = u.id
      WHERE u.role = 'SalesAgent' AND u.deletedAt IS NULL
      ORDER BY wonDeals DESC
    `),
  ]);

  // Process agent performance
  const agentRows = (agentPerformance as any)[0] ?? [];
  const processedAgents = agentRows.map((a: any) => {
    const contactedCount = Number(a.contactedCount ?? 0);
    const meetingCount = Number(a.meetingCount ?? 0);
    const wonStageCount = Number(a.wonStageCount ?? 0);
    return {
      agentId: a.id,
      agentName: a.name,
      totalLeads: Number(a.leadCount ?? 0),
      totalActivities: Number(a.activityCount ?? 0),
      wonDeals: Number(a.wonDeals ?? 0),
      revenue: Number(a.revenue ?? 0),
      conversionRate: Number(a.leadCount) > 0 ? (Number(a.wonDeals) / Number(a.leadCount)) * 100 : 0,
      slaBreached: Number(a.slaBreachedCount ?? 0),
      contactToMeetingRate: contactedCount > 0 ? Math.round((meetingCount / contactedCount) * 100 * 10) / 10 : 0,
      meetingToCloseRate: meetingCount > 0 ? Math.round((wonStageCount / meetingCount) * 100 * 10) / 10 : 0,
    };
  });

  const stageRows = (stageBreakdown as any)[0] ?? [];
  const dealRows = (totalDeals as any)[0] ?? [];

  const wonRow = dealRows.find((r: any) => r.status === 'Won');
  const wonDeals = Number(wonRow?.count ?? 0);
  const totalRevenue = Number(wonRow?.totalValue ?? 0);

  // SLA breached count (date-filtered)
  const slaBreachedCount = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.slaBreached, true), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)));

  // Revenue breakdown by currency for team
  const teamBreakdownQuery = await db.execute(sql`SELECT COALESCE(d.currency, 'SAR') as currency, COALESCE(SUM(CAST(d.valueSar AS DECIMAL(15,2))), 0) as total FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to} GROUP BY d.currency`);
  const teamBreakdownRows = (teamBreakdownQuery as any)[0] ?? [];
  const revenueBreakdown = Array.isArray(teamBreakdownRows) ? teamBreakdownRows.map((r: any) => ({ currency: r.currency || "SAR", total: Number(r.total || 0) })) : [];

  console.log("[DEBUG getTeamStats] totalLeads:", Number(totalLeads[0]?.count ?? 0), "from:", from, "to:", to, "agentPerformance leadSum:", processedAgents.reduce((a:any,c:any) => a + c.totalLeads, 0), "actSum:", processedAgents.reduce((a:any,c:any) => a + c.totalActivities, 0));
  return {
    totalLeads: Number(totalLeads[0]?.count ?? 0),
    wonDeals,
    totalRevenue,
    revenueBreakdown,
    slaBreached: Number(slaBreachedCount[0]?.count ?? 0),
    dealStats: dealRows,
    leadsByStage: stageRows.map((r: any) => ({ stage: r.stage, count: Number(r.count) })),
    leadsByAgent: processedAgents.map((a: any) => ({ agentName: a.agentName, count: a.totalLeads })),
    dealsByAgent: processedAgents.map((a: any) => ({ agentName: a.agentName, wonDeals: a.wonDeals, revenue: a.revenue })),
    leadsByQuality: await (async () => {
      const q = await db.execute(sql`SELECT leadQuality as quality, COUNT(*) as count FROM leads WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to} GROUP BY leadQuality`);
      return ((q as any)[0] ?? []).map((r: any) => ({ quality: r.quality, count: Number(r.count) }));
    })(),
    agentPerformance: processedAgents,
    totalDeals: dealRows.map((r: any) => ({ status: r.status, count: Number(r.count), totalValue: Number(r.totalValue ?? 0) })),
    // Team-level conversion rates
    contactToMeetingRate: await (async () => {
      const allContacted = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to), inArray(leads.stage, ['Contacted','Leads','Meeting Scheduled','Proposal Delivered','Won','Contact Again'])));
      const allMeetings = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to), inArray(leads.stage, ['Meeting Scheduled','Proposal Delivered','Won'])));
      const cCount = Number(allContacted[0]?.count ?? 0);
      const mCount = Number(allMeetings[0]?.count ?? 0);
      return cCount > 0 ? Math.round((mCount / cCount) * 100 * 10) / 10 : 0;
    })(),
    meetingToCloseRate: await (async () => {
      const allMeetings = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to), inArray(leads.stage, ['Meeting Scheduled','Proposal Delivered','Won'])));
      const allWon = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to), inArray(leads.stage, ['Won'])));
      const mCount = Number(allMeetings[0]?.count ?? 0);
      const wCount = Number(allWon[0]?.count ?? 0);
      return mCount > 0 ? Math.round((wCount / mCount) * 100 * 10) / 10 : 0;
    })(),
  };
}

// ─── Sales Funnel Dashboard ───────────────────────────────────────────────────
export async function getSalesFunnelData(dateFrom?: Date, dateTo?: Date, userRole?: string, userId?: number) {
  const db = await getDb();
  if (!db) return null;
  const from = dateFrom ?? new Date(0);
  const to = dateTo ?? new Date();
  if (dateTo) { to.setHours(23, 59, 59, 999); }
  const isAgent = userRole === 'SalesAgent';
  const agentId = userId ?? 0;

  // 1. Funnel stages — count leads in each pipeline stage
  const [funnelRows] = isAgent
    ? await db.execute(sql`
        SELECT COALESCE(l.stage, 'New') AS stage, COUNT(*) AS count
        FROM leads l
        WHERE l.deletedAt IS NULL AND l.ownerId = ${agentId}
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY l.stage ORDER BY count DESC
      `) as any
    : await db.execute(sql`
        SELECT COALESCE(l.stage, 'New') AS stage, COUNT(*) AS count
        FROM leads l
        WHERE l.deletedAt IS NULL
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY l.stage ORDER BY count DESC
      `) as any;

  // 2. Pipeline stages with colors
  const stages = await db.select().from(pipelineStages).orderBy(pipelineStages.order);
  const stageMap = new Map(stages.map(s => [s.name, s]));

  // Build ordered funnel
  const funnelCountMap = new Map((funnelRows ?? []).map((r: any) => [r.stage, Number(r.count)]));
  const funnelData = stages.map(s => ({
    stage: s.name,
    stageAr: s.nameAr,
    color: s.color,
    count: funnelCountMap.get(s.name) ?? 0,
  }));
  // Add any stages not in pipeline_stages
  for (const [stage, count] of funnelCountMap) {
    if (!stageMap.has(stage)) {
      funnelData.push({ stage, stageAr: stage, color: '#9ca3af', count });
    }
  }

  const totalLeads = funnelData.reduce((sum, s) => sum + s.count, 0);

  // 3. Conversion rates between stages
  const conversionRates = funnelData.map((s, i) => ({
    stage: s.stage,
    stageAr: s.stageAr,
    count: s.count,
    percentage: totalLeads > 0 ? ((s.count / totalLeads) * 100) : 0,
    dropOff: i > 0 && funnelData[i - 1].count > 0
      ? (((funnelData[i - 1].count - s.count) / funnelData[i - 1].count) * 100)
      : 0,
  }));

  // 4. Campaign performance
  const [campaignRows] = isAgent
    ? await db.execute(sql`
        SELECT COALESCE(l.campaignName, 'Direct') AS campaignName, COUNT(*) AS totalLeads,
          SUM(CASE WHEN l.stage = 'Won' THEN 1 ELSE 0 END) AS wonLeads,
          SUM(CASE WHEN l.stage = 'Lost' THEN 1 ELSE 0 END) AS lostLeads,
          SUM(CASE WHEN l.stage IN ('Contacted', 'Contacted Us', 'Meeting Scheduled', 'Proposal Delivered', 'Won') THEN 1 ELSE 0 END) AS progressedLeads
        FROM leads l WHERE l.deletedAt IS NULL AND l.ownerId = ${agentId}
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY l.campaignName ORDER BY totalLeads DESC
      `) as any
    : await db.execute(sql`
        SELECT COALESCE(l.campaignName, 'Direct') AS campaignName, COUNT(*) AS totalLeads,
          SUM(CASE WHEN l.stage = 'Won' THEN 1 ELSE 0 END) AS wonLeads,
          SUM(CASE WHEN l.stage = 'Lost' THEN 1 ELSE 0 END) AS lostLeads,
          SUM(CASE WHEN l.stage IN ('Contacted', 'Contacted Us', 'Meeting Scheduled', 'Proposal Delivered', 'Won') THEN 1 ELSE 0 END) AS progressedLeads
        FROM leads l WHERE l.deletedAt IS NULL
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY l.campaignName ORDER BY totalLeads DESC
      `) as any;

  const campaignPerformance = (campaignRows ?? []).map((r: any) => ({
    campaignName: r.campaignName ?? 'Direct',
    totalLeads: Number(r.totalLeads ?? 0),
    wonLeads: Number(r.wonLeads ?? 0),
    lostLeads: Number(r.lostLeads ?? 0),
    progressedLeads: Number(r.progressedLeads ?? 0),
    conversionRate: Number(r.totalLeads) > 0 ? (Number(r.wonLeads) / Number(r.totalLeads)) * 100 : 0,
  }));

  // 5. Deal values
  const [dealRows] = isAgent
    ? await db.execute(sql`
        SELECT d.status, COUNT(*) AS count, COALESCE(SUM(d.valueBase), 0) AS totalValue, COALESCE(AVG(d.valueBase), 0) AS avgValue
        FROM deals d JOIN leads l ON l.id = d.leadId
        WHERE d.deletedAt IS NULL AND l.ownerId = ${agentId}
          AND d.createdAt >= ${from} AND d.createdAt <= ${to}
        GROUP BY d.status
      `) as any
    : await db.execute(sql`
        SELECT d.status, COUNT(*) AS count, COALESCE(SUM(d.valueBase), 0) AS totalValue, COALESCE(AVG(d.valueBase), 0) AS avgValue
        FROM deals d WHERE d.deletedAt IS NULL
          AND d.createdAt >= ${from} AND d.createdAt <= ${to}
        GROUP BY d.status
      `) as any;

  const dealSummary = {
    won: { count: 0, totalValue: 0, avgValue: 0 },
    lost: { count: 0, totalValue: 0, avgValue: 0 },
    pending: { count: 0, totalValue: 0, avgValue: 0 },
  };
  for (const r of (dealRows ?? [])) {
    const key = (r.status ?? '').toLowerCase() as keyof typeof dealSummary;
    if (dealSummary[key]) {
      dealSummary[key] = {
        count: Number(r.count ?? 0),
        totalValue: Number(r.totalValue ?? 0),
        avgValue: Number(r.avgValue ?? 0),
      };
    }
  }

  // 6. Lead quality breakdown per stage
  const [qualityRows] = isAgent
    ? await db.execute(sql`
        SELECT l.stage, l.leadQuality, COUNT(*) AS count FROM leads l
        WHERE l.deletedAt IS NULL AND l.ownerId = ${agentId}
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY l.stage, l.leadQuality ORDER BY l.stage, l.leadQuality
      `) as any
    : await db.execute(sql`
        SELECT l.stage, l.leadQuality, COUNT(*) AS count FROM leads l
        WHERE l.deletedAt IS NULL
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY l.stage, l.leadQuality ORDER BY l.stage, l.leadQuality
      `) as any;

  const qualityByStage: Record<string, Record<string, number>> = {};
  for (const r of (qualityRows ?? [])) {
    const stage = r.stage ?? 'New';
    if (!qualityByStage[stage]) qualityByStage[stage] = {};
    qualityByStage[stage][r.leadQuality ?? 'Unknown'] = Number(r.count ?? 0);
  }

  // 7. Time-based trend (leads created per day in the range)
  const [trendRows] = isAgent
    ? await db.execute(sql`
        SELECT DATE(l.createdAt) AS date, COUNT(*) AS count FROM leads l
        WHERE l.deletedAt IS NULL AND l.ownerId = ${agentId}
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY DATE(l.createdAt) ORDER BY date ASC
      `) as any
    : await db.execute(sql`
        SELECT DATE(l.createdAt) AS date, COUNT(*) AS count FROM leads l
        WHERE l.deletedAt IS NULL
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY DATE(l.createdAt) ORDER BY date ASC
      `) as any;

  const leadTrend = (trendRows ?? []).map((r: any) => ({
    date: r.date,
    count: Number(r.count ?? 0),
  }));

  // 8. Average time to contact (for leads that have contactTime)
  const [avgContactTime] = isAgent
    ? await db.execute(sql`
        SELECT AVG(TIMESTAMPDIFF(HOUR, l.createdAt, l.contactTime)) AS avgHours FROM leads l
        WHERE l.deletedAt IS NULL AND l.contactTime IS NOT NULL AND l.ownerId = ${agentId}
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
      `) as any
    : await db.execute(sql`
        SELECT AVG(TIMESTAMPDIFF(HOUR, l.createdAt, l.contactTime)) AS avgHours FROM leads l
        WHERE l.deletedAt IS NULL AND l.contactTime IS NOT NULL
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
      `) as any;

  return {
    totalLeads,
    funnelData,
    conversionRates,
    campaignPerformance,
    dealSummary,
    qualityByStage,
    leadTrend,
    avgContactTimeHours: Number((avgContactTime ?? [])[0]?.avgHours ?? 0),
  };
}

// ─── Task & SLA Dashboard ─────────────────────────────────────────────────────
export async function getTaskSlaDashboardData(dateFrom?: Date, dateTo?: Date, userRole?: string, userId?: number) {
  const db = await getDb();
  if (!db) return null;
  const from = dateFrom ?? new Date(0);
  const to = dateTo ?? new Date();
  if (dateTo) { to.setHours(23, 59, 59, 999); }
  const isAgent = userRole === 'SalesAgent';
  const agentId = userId ?? 0;

  // 1. SLA Config
  const slaConfigResult = await db.select().from(slaConfig).limit(1);
  const slaSettings = slaConfigResult[0] ?? { hoursThreshold: 24, isEnabled: true };

  // 2. SLA Overview
  const [slaOverview] = isAgent
    ? await db.execute(sql`
        SELECT COUNT(*) AS totalLeads,
          SUM(CASE WHEN l.slaBreached = 1 THEN 1 ELSE 0 END) AS breachedCount,
          SUM(CASE WHEN l.contactTime IS NOT NULL THEN 1 ELSE 0 END) AS contactedCount,
          SUM(CASE WHEN l.contactTime IS NULL AND l.slaBreached = 0 THEN 1 ELSE 0 END) AS pendingCount,
          AVG(CASE WHEN l.contactTime IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, l.createdAt, l.contactTime) ELSE NULL END) AS avgResponseMinutes
        FROM leads l WHERE l.deletedAt IS NULL AND l.ownerId = ${agentId}
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
      `) as any
    : await db.execute(sql`
        SELECT COUNT(*) AS totalLeads,
          SUM(CASE WHEN l.slaBreached = 1 THEN 1 ELSE 0 END) AS breachedCount,
          SUM(CASE WHEN l.contactTime IS NOT NULL THEN 1 ELSE 0 END) AS contactedCount,
          SUM(CASE WHEN l.contactTime IS NULL AND l.slaBreached = 0 THEN 1 ELSE 0 END) AS pendingCount,
          AVG(CASE WHEN l.contactTime IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, l.createdAt, l.contactTime) ELSE NULL END) AS avgResponseMinutes
        FROM leads l WHERE l.deletedAt IS NULL
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
      `) as any;

  const slaData = (slaOverview ?? [])[0] ?? {};

  // 3. SLA Breached by Agent
  const [slaByAgent] = isAgent
    ? await db.execute(sql`
        SELECT u.id AS agentId, u.name AS agentName, COUNT(l.id) AS totalLeads,
          SUM(CASE WHEN l.slaBreached = 1 THEN 1 ELSE 0 END) AS breachedCount,
          SUM(CASE WHEN l.contactTime IS NOT NULL THEN 1 ELSE 0 END) AS contactedCount,
          AVG(CASE WHEN l.contactTime IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, l.createdAt, l.contactTime) ELSE NULL END) AS avgResponseMinutes
        FROM users u LEFT JOIN leads l ON l.ownerId = u.id AND l.deletedAt IS NULL AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        WHERE u.id = ${agentId} AND u.deletedAt IS NULL
        GROUP BY u.id, u.name ORDER BY breachedCount DESC
      `) as any
    : await db.execute(sql`
        SELECT u.id AS agentId, u.name AS agentName, COUNT(l.id) AS totalLeads,
          SUM(CASE WHEN l.slaBreached = 1 THEN 1 ELSE 0 END) AS breachedCount,
          SUM(CASE WHEN l.contactTime IS NOT NULL THEN 1 ELSE 0 END) AS contactedCount,
          AVG(CASE WHEN l.contactTime IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, l.createdAt, l.contactTime) ELSE NULL END) AS avgResponseMinutes
        FROM users u LEFT JOIN leads l ON l.ownerId = u.id AND l.deletedAt IS NULL AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        WHERE u.role = 'SalesAgent' AND u.deletedAt IS NULL
        GROUP BY u.id, u.name ORDER BY breachedCount DESC
      `) as any;

  const agentSlaPerformance = (slaByAgent ?? []).map((r: any) => ({
    agentId: Number(r.agentId),
    agentName: r.agentName ?? 'Unknown',
    totalLeads: Number(r.totalLeads ?? 0),
    breachedCount: Number(r.breachedCount ?? 0),
    contactedCount: Number(r.contactedCount ?? 0),
    avgResponseMinutes: Number(r.avgResponseMinutes ?? 0),
    complianceRate: Number(r.totalLeads) > 0
      ? (((Number(r.totalLeads) - Number(r.breachedCount)) / Number(r.totalLeads)) * 100)
      : 100,
  }));

  // 4. Activity Summary
  const [activitySummary] = isAgent
    ? await db.execute(sql`
        SELECT a.type, COUNT(*) AS count, COUNT(DISTINCT a.userId) AS uniqueAgents
        FROM activities a WHERE a.deletedAt IS NULL AND a.userId = ${agentId}
          AND a.createdAt >= ${from} AND a.createdAt <= ${to}
        GROUP BY a.type ORDER BY count DESC
      `) as any
    : await db.execute(sql`
        SELECT a.type, COUNT(*) AS count, COUNT(DISTINCT a.userId) AS uniqueAgents
        FROM activities a WHERE a.deletedAt IS NULL
          AND a.createdAt >= ${from} AND a.createdAt <= ${to}
        GROUP BY a.type ORDER BY count DESC
      `) as any;

  const activityByType = (activitySummary ?? []).map((r: any) => ({
    type: r.type ?? 'Unknown',
    count: Number(r.count ?? 0),
    uniqueAgents: Number(r.uniqueAgents ?? 0),
  }));

  // 5. Activity by Agent
  const [activityByAgent] = isAgent
    ? await db.execute(sql`
        SELECT u.id AS agentId, u.name AS agentName, COUNT(a.id) AS totalActivities,
          SUM(CASE WHEN a.type = 'Call' THEN 1 ELSE 0 END) AS calls,
          SUM(CASE WHEN a.type = 'WhatsApp' THEN 1 ELSE 0 END) AS whatsapp,
          SUM(CASE WHEN a.type = 'Meeting' THEN 1 ELSE 0 END) AS meetings,
          SUM(CASE WHEN a.type = 'Email' THEN 1 ELSE 0 END) AS emails,
          SUM(CASE WHEN a.type = 'SMS' THEN 1 ELSE 0 END) AS sms,
          SUM(CASE WHEN a.type = 'Offer' THEN 1 ELSE 0 END) AS offers,
          SUM(CASE WHEN a.type = 'Note' THEN 1 ELSE 0 END) AS notes
        FROM users u LEFT JOIN activities a ON a.userId = u.id AND a.deletedAt IS NULL AND a.createdAt >= ${from} AND a.createdAt <= ${to}
        WHERE u.id = ${agentId} AND u.deletedAt IS NULL
        GROUP BY u.id, u.name ORDER BY totalActivities DESC
      `) as any
    : await db.execute(sql`
        SELECT u.id AS agentId, u.name AS agentName, COUNT(a.id) AS totalActivities,
          SUM(CASE WHEN a.type = 'Call' THEN 1 ELSE 0 END) AS calls,
          SUM(CASE WHEN a.type = 'WhatsApp' THEN 1 ELSE 0 END) AS whatsapp,
          SUM(CASE WHEN a.type = 'Meeting' THEN 1 ELSE 0 END) AS meetings,
          SUM(CASE WHEN a.type = 'Email' THEN 1 ELSE 0 END) AS emails,
          SUM(CASE WHEN a.type = 'SMS' THEN 1 ELSE 0 END) AS sms,
          SUM(CASE WHEN a.type = 'Offer' THEN 1 ELSE 0 END) AS offers,
          SUM(CASE WHEN a.type = 'Note' THEN 1 ELSE 0 END) AS notes
        FROM users u LEFT JOIN activities a ON a.userId = u.id AND a.deletedAt IS NULL AND a.createdAt >= ${from} AND a.createdAt <= ${to}
        WHERE u.role = 'SalesAgent' AND u.deletedAt IS NULL
        GROUP BY u.id, u.name ORDER BY totalActivities DESC
      `) as any;

  const agentActivityBreakdown = (activityByAgent ?? []).map((r: any) => ({
    agentId: Number(r.agentId),
    agentName: r.agentName ?? 'Unknown',
    totalActivities: Number(r.totalActivities ?? 0),
    calls: Number(r.calls ?? 0),
    whatsapp: Number(r.whatsapp ?? 0),
    meetings: Number(r.meetings ?? 0),
    emails: Number(r.emails ?? 0),
    sms: Number(r.sms ?? 0),
    offers: Number(r.offers ?? 0),
    notes: Number(r.notes ?? 0),
  }));

  // 6. Activity Outcome Distribution
  const [outcomeRows] = isAgent
    ? await db.execute(sql`
        SELECT COALESCE(a.outcome, 'Unknown') AS outcome, COUNT(*) AS count
        FROM activities a WHERE a.deletedAt IS NULL AND a.userId = ${agentId}
          AND a.createdAt >= ${from} AND a.createdAt <= ${to}
        GROUP BY a.outcome ORDER BY count DESC
      `) as any
    : await db.execute(sql`
        SELECT COALESCE(a.outcome, 'Unknown') AS outcome, COUNT(*) AS count
        FROM activities a WHERE a.deletedAt IS NULL
          AND a.createdAt >= ${from} AND a.createdAt <= ${to}
        GROUP BY a.outcome ORDER BY count DESC
      `) as any;

  const activityOutcomes = (outcomeRows ?? []).map((r: any) => ({
    outcome: r.outcome ?? 'Unknown',
    count: Number(r.count ?? 0),
  }));

  // 7. Activity Trend (daily)
  const [activityTrend] = isAgent
    ? await db.execute(sql`
        SELECT DATE(a.createdAt) AS date, COUNT(*) AS count
        FROM activities a WHERE a.deletedAt IS NULL AND a.userId = ${agentId}
          AND a.createdAt >= ${from} AND a.createdAt <= ${to}
        GROUP BY DATE(a.createdAt) ORDER BY date ASC
      `) as any
    : await db.execute(sql`
        SELECT DATE(a.createdAt) AS date, COUNT(*) AS count
        FROM activities a WHERE a.deletedAt IS NULL
          AND a.createdAt >= ${from} AND a.createdAt <= ${to}
        GROUP BY DATE(a.createdAt) ORDER BY date ASC
      `) as any;

  const activityDailyTrend = (activityTrend ?? []).map((r: any) => ({
    date: r.date,
    count: Number(r.count ?? 0),
  }));

  // 8. SLA Breach Trend (daily — how many leads breached SLA per day)
  const [slaTrend] = isAgent
    ? await db.execute(sql`
        SELECT DATE(l.createdAt) AS date,
          SUM(CASE WHEN l.slaBreached = 1 THEN 1 ELSE 0 END) AS breached, COUNT(*) AS total
        FROM leads l WHERE l.deletedAt IS NULL AND l.ownerId = ${agentId}
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY DATE(l.createdAt) ORDER BY date ASC
      `) as any
    : await db.execute(sql`
        SELECT DATE(l.createdAt) AS date,
          SUM(CASE WHEN l.slaBreached = 1 THEN 1 ELSE 0 END) AS breached, COUNT(*) AS total
        FROM leads l WHERE l.deletedAt IS NULL
          AND l.createdAt >= ${from} AND l.createdAt <= ${to}
        GROUP BY DATE(l.createdAt) ORDER BY date ASC
      `) as any;

  const slaDailyTrend = (slaTrend ?? []).map((r: any) => ({
    date: r.date,
    breached: Number(r.breached ?? 0),
    total: Number(r.total ?? 0),
  }));

  // 9. Top SLA breached leads (most recent, for the table)
  const [topBreachedLeads] = isAgent
    ? await db.execute(sql`
        SELECT l.id, l.name, l.phone, l.stage, l.campaignName, l.createdAt, l.slaBreached,
          u.name AS ownerName, TIMESTAMPDIFF(HOUR, l.createdAt, NOW()) AS hoursElapsed
        FROM leads l LEFT JOIN users u ON u.id = l.ownerId
        WHERE l.slaBreached = 1 AND l.deletedAt IS NULL AND l.contactTime IS NULL AND l.ownerId = ${agentId}
        ORDER BY l.createdAt DESC LIMIT 20
      `) as any
    : await db.execute(sql`
        SELECT l.id, l.name, l.phone, l.stage, l.campaignName, l.createdAt, l.slaBreached,
          u.name AS ownerName, TIMESTAMPDIFF(HOUR, l.createdAt, NOW()) AS hoursElapsed
        FROM leads l LEFT JOIN users u ON u.id = l.ownerId
        WHERE l.slaBreached = 1 AND l.deletedAt IS NULL AND l.contactTime IS NULL
        ORDER BY l.createdAt DESC LIMIT 20
      `) as any;

  const breachedLeadsList = (topBreachedLeads ?? []).map((r: any) => ({
    id: Number(r.id),
    name: r.name ?? r.phone,
    phone: r.phone,
    stage: r.stage,
    campaignName: r.campaignName ?? 'Direct',
    ownerName: r.ownerName ?? 'Unassigned',
    hoursElapsed: Number(r.hoursElapsed ?? 0),
    createdAt: r.createdAt,
  }));

  return {
    slaSettings: {
      hoursThreshold: Number(slaSettings.hoursThreshold),
      isEnabled: Boolean(slaSettings.isEnabled),
    },
    slaOverview: {
      totalLeads: Number(slaData.totalLeads ?? 0),
      breachedCount: Number(slaData.breachedCount ?? 0),
      contactedCount: Number(slaData.contactedCount ?? 0),
      pendingCount: Number(slaData.pendingCount ?? 0),
      avgResponseMinutes: Number(slaData.avgResponseMinutes ?? 0),
      complianceRate: Number(slaData.totalLeads) > 0
        ? (((Number(slaData.totalLeads) - Number(slaData.breachedCount)) / Number(slaData.totalLeads)) * 100)
        : 100,
    },
    agentSlaPerformance,
    activityByType,
    agentActivityBreakdown,
    activityOutcomes,
    activityDailyTrend,
    slaDailyTrend,
    breachedLeadsList,
  };
}

// ─── Bulk Lead Import ─────────────────────────────────────────────────────────
export async function bulkCreateLeads(leadsData: InsertLead[]): Promise<{ created: number; duplicates: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let created = 0;
  let duplicates = 0;

  for (const lead of leadsData) {
    if (lead.phone) lead.phone = normalizePhone(lead.phone);

    // Check for duplicate
    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.phone, lead.phone))
      .limit(1);

    if (existing.length > 0) {
      lead.isDuplicate = true;
      lead.duplicateOfId = existing[0].id;
      duplicates++;
    } else {
      created++;
    }

    await db.insert(leads).values(lead);
  }

  return { created, duplicates };
}

// ─── Password Reset Tokens ────────────────────────────────────────────────────
export async function createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Invalidate any existing tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
}

export async function getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
  return result[0];
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.token, token));
}

// ─── Notification Subscribers ─────────────────────────────────────────────────
export async function getNotificationSubscribers(): Promise<NotificationSubscriber[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationSubscribers).orderBy(notificationSubscribers.createdAt);
}

export async function addNotificationSubscriber(data: InsertNotificationSubscriber): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notificationSubscribers).values(data);
  return (result as any)[0]?.insertId ?? 0;
}

export async function updateNotificationSubscriber(id: number, data: Partial<InsertNotificationSubscriber>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(notificationSubscribers).set(data).where(eq(notificationSubscribers.id, id));
}

export async function deleteNotificationSubscriber(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(notificationSubscribers).where(eq(notificationSubscribers.id, id));
}

export async function getActiveNotificationSubscribers(frequency?: "daily" | "weekly"): Promise<NotificationSubscriber[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(notificationSubscribers.isActive, true)];
  if (frequency) conditions.push(eq(notificationSubscribers.frequency, frequency));
  return db.select().from(notificationSubscribers).where(and(...conditions));
}

// ─── Report Data ──────────────────────────────────────────────────────────────
export async function getReportData(dateFrom?: Date, dateTo?: Date) {
  const db = await getDb();
  if (!db) return null;

  const from = dateFrom ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = dateTo ?? new Date();

  // Total leads in period
  const totalLeadsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(gte(leads.createdAt, from), lte(leads.createdAt, to)));
  const totalLeads = Number(totalLeadsResult[0]?.count ?? 0);

  // SLA breached leads
  const slaBreachedResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.slaBreached, true));
  const slaBreached = Number(slaBreachedResult[0]?.count ?? 0);

  // Won deals in period
  const wonDealsResult = await db
    .select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(SUM(valueBase), 0)` })
    .from(deals)
    .where(and(eq(deals.status, "Won"), isNull(deals.deletedAt), gte(deals.createdAt, from), lte(deals.createdAt, to)));
  const wonDeals = Number(wonDealsResult[0]?.count ?? 0);
  const wonValue = Number(wonDealsResult[0]?.total ?? 0);

  // Lost deals in period
  const lostDealsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(deals)
    .where(and(eq(deals.status, "Lost"), isNull(deals.deletedAt), gte(deals.createdAt, from), lte(deals.createdAt, to)));
  const lostDeals = Number(lostDealsResult[0]?.count ?? 0);

  // Per-agent stats
  const agentStats = await db.execute(sql`
    SELECT u.name, u.email,
      COUNT(DISTINCT l.id) as totalLeads,
      COUNT(DISTINCT a.id) as totalActivities,
      COUNT(DISTINCT CASE WHEN d.status = 'Won' THEN d.id END) as wonDeals,
      COUNT(DISTINCT CASE WHEN l.slaBreached = true THEN l.id END) as slaBreached
    FROM users u
    LEFT JOIN leads l ON l.ownerId = u.id AND l.createdAt BETWEEN ${from} AND ${to}
    LEFT JOIN activities a ON a.userId = u.id AND a.createdAt BETWEEN ${from} AND ${to}
    LEFT JOIN deals d ON d.leadId = l.id AND d.deletedAt IS NULL
    WHERE u.role = 'SalesAgent' AND u.isActive = true
    GROUP BY u.id, u.name, u.email
    ORDER BY totalLeads DESC
  `);

  return {
    period: { from, to },
    totalLeads,
    slaBreached,
    wonDeals,
    wonValue,
    lostDeals,
    agentStats: (agentStats as any)[0] ?? [],
  };
}

// ─── Leads Export (with owner name join) ─────────────────────────────────────
export interface LeadExportFilters {
  limit?: number;
  stage?: string;
  leadQuality?: string;
  fitStatus?: string;
  campaignName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  slaBreached?: boolean;
  search?: string;
  ownerId?: number;
}

export async function getLeadsForExport(filters: LeadExportFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(filters.limit ?? 100, 5000); // cap at 5000 rows

  const rows = await db.execute(sql`
    SELECT
      l.id,
      l.name,
      l.phone,
      l.country,
      l.businessProfile,
      l.leadQuality,
      l.stage,
      l.campaignName,
      l.slaBreached,
      l.createdAt,
      l.notes,
      u.name AS ownerName
    FROM leads l
    LEFT JOIN users u ON u.id = l.ownerId
    WHERE 1=1
      ${filters.ownerId ? sql`AND l.ownerId = ${filters.ownerId}` : sql``}
      ${filters.stage ? sql`AND l.stage = ${filters.stage}` : sql``}
      ${filters.leadQuality ? sql`AND l.leadQuality = ${filters.leadQuality}` : sql``}
      ${filters.campaignName ? sql`AND l.campaignName = ${filters.campaignName}` : sql``}
      ${filters.slaBreached !== undefined ? sql`AND l.slaBreached = ${filters.slaBreached}` : sql``}
      ${filters.dateFrom ? sql`AND l.createdAt >= ${filters.dateFrom}` : sql``}
      ${filters.dateTo ? sql`AND l.createdAt <= ${filters.dateTo}` : sql``}
      ${filters.search ? sql`AND (l.name LIKE ${`%${filters.search}%`} OR l.phone LIKE ${`%${filters.search}%`})` : sql``}
    ORDER BY l.createdAt DESC
    LIMIT ${limit}
  `);
  return (rows as any)[0] as Array<{
    id: number;
    name: string | null;
    phone: string | null;
    country: string | null;
    businessProfile: string | null;
    leadQuality: string | null;
    stage: string | null;
    campaignName: string | null;
    slaBreached: boolean;
    createdAt: Date;
    notes: string | null;
    ownerName: string | null;
  }>;
}

// ─── Internal Notes ───────────────────────────────────────────────────────────
export async function getInternalNotesByLead(leadId: number) {
  const db = await getDb();
  const rows = await db.execute(sql`
    SELECT n.*, u.name as userName
    FROM internal_notes n
    LEFT JOIN users u ON u.id = n.userId
    WHERE n.leadId = ${leadId} AND n.deletedAt IS NULL
    ORDER BY n.createdAt DESC
  `);
  return (rows as any)[0] ?? [];
}

export async function createInternalNote(data: { leadId: number; userId: number; content: string }): Promise<number> {
  const db = await getDb();
  const result = await db.insert(internalNotes).values(data);
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function deleteInternalNote(id: number, deletedByUserId?: number): Promise<void> {
  const db = await getDb();
  await db.update(internalNotes).set({ deletedAt: new Date(), deletedBy: deletedByUserId ?? null } as any).where(eq(internalNotes.id, id));
}

// ─── Lead Transfers ──────────────────────────────────────────────────────────
export async function getLeadTransfersByLead(leadId: number) {
  const db = await getDb();
  const rows = await db.execute(sql`
    SELECT t.*, 
      fu.name as fromUserName, 
      tu.name as toUserName
    FROM lead_transfers t
    LEFT JOIN users fu ON fu.id = t.fromUserId
    LEFT JOIN users tu ON tu.id = t.toUserId
    WHERE t.leadId = ${leadId}
    ORDER BY t.createdAt DESC
  `);
  return (rows as any)[0] ?? [];
}

export async function createLeadTransfer(data: { leadId: number; fromUserId: number; toUserId: number; reason?: string; notes?: string }): Promise<number> {
  const db = await getDb();
  // 1. Create transfer record
  const result = await db.insert(leadTransfers).values(data);
  // 2. Update lead ownership
  await db.update(leads).set({ ownerId: data.toUserId }).where(eq(leads.id, data.leadId));
  // Notification #9 — Lead Transfer
  notifyLeadTransfer({
    leadId: data.leadId,
    fromUserId: data.fromUserId,
    toUserId: data.toUserId,
    reason: data.reason,
  }).catch((err) => console.error("[NotificationEngine] notifyLeadTransfer error:", err));
  return Number((result as any)[0]?.insertId ?? 0);
}

// ─── Chat Messages ───────────────────────────────────────────────────────────
export async function getChatMessages(filters: { fromUserId?: number; toUserId?: number; roomId?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let conditions = [];
  if (filters.roomId) {
    conditions.push(eq(chatMessages.roomId, filters.roomId));
  } else if (filters.fromUserId && filters.toUserId) {
    conditions.push(
      or(
        and(eq(chatMessages.fromUserId, filters.fromUserId), eq(chatMessages.toUserId, filters.toUserId)),
        and(eq(chatMessages.fromUserId, filters.toUserId), eq(chatMessages.toUserId, filters.fromUserId))
      )
    );
  }

  const query = db.select({
    id: chatMessages.id,
    fromUserId: chatMessages.fromUserId,
    fromUserName: users.name,
    toUserId: chatMessages.toUserId,
    toUserName: sql`tu.name`,
    content: chatMessages.content,
    isRead: chatMessages.isRead,
    createdAt: chatMessages.createdAt,
  })
  .from(chatMessages)
  .leftJoin(users, eq(chatMessages.fromUserId, users.id))
  .leftJoin(sql`users tu`, eq(chatMessages.toUserId, sql`tu.id`))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(chatMessages.createdAt))
  .limit(filters.limit || 50);

  const rows = await query;
  return rows.reverse();
}

export async function getAllChatConversations() {
  const db = await getDb();
  if (!db) return [];
  
  const rows = await db.execute(sql`
    SELECT 
      m.id, m.fromUserId, m.toUserId, m.content, m.createdAt,
      u1.name as fromUserName, u2.name as toUserName
    FROM chat_messages m
    JOIN users u1 ON m.fromUserId = u1.id
    JOIN users u2 ON m.toUserId = u2.id
    WHERE m.deletedAt IS NULL AND m.id IN (
      SELECT MAX(id) FROM chat_messages WHERE deletedAt IS NULL GROUP BY LEAST(fromUserId, toUserId), GREATEST(fromUserId, toUserId)
    )
    ORDER BY m.createdAt DESC
  `);
  return (rows as any)[0] ?? [];
}

// ─── Chat Notifications ─────────────────────────────────────────────────────
export async function getUnreadMessageCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({
    count: sql<number>`count(*)`
  })
  .from(chatMessages)
  .where(and(eq(chatMessages.toUserId, userId), eq(chatMessages.isRead, false)));
  
  return Number(result[0]?.count ?? 0);
}

export async function markMessagesAsRead(fromUserId: number, toUserId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(chatMessages)
    .set({ isRead: true })
    .where(and(
      eq(chatMessages.fromUserId, fromUserId),
      eq(chatMessages.toUserId, toUserId),
      eq(chatMessages.isRead, false)
    ));
}

// ─── Audit Log ───────────────────────────────────────────────────────────────
export async function createAuditLog(data: {
  userId: number;
  userName: string | null;
  userRole: string;
  action: string;
  entityType: string;
  entityId: number;
  entityName?: string;
  details?: any;
  previousValue?: any;
  newValue?: any;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    userId: data.userId,
    userName: data.userName ?? "Unknown",
    userRole: data.userRole,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    entityName: data.entityName ?? null,
    details: data.details ?? null,
    previousValue: data.previousValue ?? null,
    newValue: data.newValue ?? null,
  } as any);
}

export async function getAuditLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getAuditLogs(filters: { entityType?: string; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  return db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
}

// ─── Trash Functions ─────────────────────────────────────────────────────────
export async function getTrashItems(entityType?: string) {
  const db = await getDb();
  if (!db) return { leads: [], users: [], campaigns: [], activities: [], notes: [], deals: [] };
  const result: any = {};

  if (!entityType || entityType === "leads") {
    const rows = await db.execute(sql`
      SELECT l.id, l.name, l.phone, l.stage, l.leadQuality, l.campaignName, l.deletedAt, l.deletedBy,
        u.name as deletedByName, o.name as ownerName
      FROM leads l LEFT JOIN users u ON u.id = l.deletedBy LEFT JOIN users o ON o.id = l.ownerId
      WHERE l.deletedAt IS NOT NULL ORDER BY l.deletedAt DESC
    `);
    result.leads = (rows as any)[0] ?? [];
  }
  if (!entityType || entityType === "users") {
    const rows = await db.execute(sql`
      SELECT u.id, u.name, u.email, u.role, u.deletedAt, u.deletedBy, d.name as deletedByName
      FROM users u LEFT JOIN users d ON d.id = u.deletedBy
      WHERE u.deletedAt IS NOT NULL ORDER BY u.deletedAt DESC
    `);
    result.users = (rows as any)[0] ?? [];
  }
  if (!entityType || entityType === "campaigns") {
    const rows = await db.execute(sql`
      SELECT c.id, c.name, c.platform, c.deletedAt, c.deletedBy, u.name as deletedByName
      FROM campaigns c LEFT JOIN users u ON u.id = c.deletedBy
      WHERE c.deletedAt IS NOT NULL ORDER BY c.deletedAt DESC
    `);
    result.campaigns = (rows as any)[0] ?? [];
  }
  if (!entityType || entityType === "activities") {
    const rows = await db.execute(sql`
      SELECT a.id, a.type, a.outcome, a.notes, a.deletedAt, a.deletedBy,
        u.name as deletedByName, l.name as leadName
      FROM activities a LEFT JOIN users u ON u.id = a.deletedBy LEFT JOIN leads l ON l.id = a.leadId
      WHERE a.deletedAt IS NOT NULL ORDER BY a.deletedAt DESC
    `);
    result.activities = (rows as any)[0] ?? [];
  }
  if (!entityType || entityType === "deals") {
    const rows = await db.execute(sql`
      SELECT d.id, d.valueSar, d.status, d.dealType, d.deletedAt, d.deletedBy,
        u.name as deletedByName, l.name as leadName
      FROM deals d LEFT JOIN users u ON u.id = d.deletedBy LEFT JOIN leads l ON l.id = d.leadId
      WHERE d.deletedAt IS NOT NULL ORDER BY d.deletedAt DESC
    `);
    result.deals = (rows as any)[0] ?? [];
  }
  if (!entityType || entityType === "notes") {
    const rows = await db.execute(sql`
      SELECT n.id, n.content, n.deletedAt, n.deletedBy, u.name as deletedByName, l.name as leadName
      FROM internal_notes n LEFT JOIN users u ON u.id = n.deletedBy LEFT JOIN leads l ON l.id = n.leadId
      WHERE n.deletedAt IS NOT NULL ORDER BY n.deletedAt DESC
    `);
    result.notes = (rows as any)[0] ?? [];
  }
  return result;
}

export async function getTrashStats() {
  const db = await getDb();
  if (!db) return { leads: 0, users: 0, campaigns: 0, activities: 0, deals: 0, notes: 0 };
  const [l, u, c, a, d, n] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) as count FROM leads WHERE deletedAt IS NOT NULL`),
    db.execute(sql`SELECT COUNT(*) as count FROM users WHERE deletedAt IS NOT NULL`),
    db.execute(sql`SELECT COUNT(*) as count FROM campaigns WHERE deletedAt IS NOT NULL`),
    db.execute(sql`SELECT COUNT(*) as count FROM activities WHERE deletedAt IS NOT NULL`),
    db.execute(sql`SELECT COUNT(*) as count FROM deals WHERE deletedAt IS NOT NULL`),
    db.execute(sql`SELECT COUNT(*) as count FROM internal_notes WHERE deletedAt IS NOT NULL`),
  ]);
  return {
    leads: Number((l as any)[0]?.[0]?.count ?? 0),
    users: Number((u as any)[0]?.[0]?.count ?? 0),
    campaigns: Number((c as any)[0]?.[0]?.count ?? 0),
    activities: Number((a as any)[0]?.[0]?.count ?? 0),
    deals: Number((d as any)[0]?.[0]?.count ?? 0),
    notes: Number((n as any)[0]?.[0]?.count ?? 0),
  };
}

// ─── Restore Functions ───────────────────────────────────────────────────────
export async function restoreLead(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(leads).set({ deletedAt: null, deletedBy: null } as any).where(eq(leads.id, id));
}
export async function restoreUser(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ deletedAt: null, deletedBy: null, isActive: true } as any).where(eq(users.id, id));
}
export async function restoreCampaign(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(campaigns).set({ deletedAt: null, deletedBy: null } as any).where(eq(campaigns.id, id));
}
export async function restoreActivity(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(activities).set({ deletedAt: null, deletedBy: null } as any).where(eq(activities.id, id));
}
export async function restoreDeal(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(deals).set({ deletedAt: null, deletedBy: null } as any).where(eq(deals.id, id));
}
export async function restoreInternalNote(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(internalNotes).set({ deletedAt: null, deletedBy: null } as any).where(eq(internalNotes.id, id));
}

// ─── Soft Delete Deal ────────────────────────────────────────────────────────
export async function softDeleteDeal(id: number, deletedByUserId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(deals).set({ deletedAt: new Date(), deletedBy: deletedByUserId ?? null } as any).where(eq(deals.id, id));
}

// ─── Permanent Delete (password-protected, 1 year minimum) ──────────────────
export async function permanentDeleteEntity(entityType: string, id: number): Promise<{ success: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { success: false, reason: "Database not available" };
  
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const tableMap: Record<string, any> = { leads, users, campaigns, activities, deals, internalNotes };
  const table = tableMap[entityType];
  if (!table) return { success: false, reason: "Invalid entity type" };
  
  const item = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!item[0]) return { success: false, reason: "Item not found" };
  if (!item[0].deletedAt) return { success: false, reason: "Item is not in trash" };
  if (new Date(item[0].deletedAt) > oneYearAgo) {
    const deleteDate = new Date(item[0].deletedAt);
    const eligibleDate = new Date(deleteDate);
    eligibleDate.setFullYear(eligibleDate.getFullYear() + 1);
    return { success: false, reason: `Cannot permanently delete yet. Eligible after ${eligibleDate.toISOString().split("T")[0]}` };
  }
  
  await db.delete(table).where(eq(table.id, id));
  return { success: true };
}


// ─── In-App Notifications ────────────────────────────────────────────────────
export async function createInAppNotification(data: InsertInAppNotification): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(inAppNotifications).values(data);
  return result[0].insertId;
}

export async function createBulkInAppNotifications(items: InsertInAppNotification[]): Promise<void> {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await db.insert(inAppNotifications).values(items);
}

export async function getInAppNotifications(userId: number, limit: number = 30, offset: number = 0, dateFrom?: Date, dateTo?: Date): Promise<{ data: InAppNotification[]; total: number }> {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const conditions: any[] = [eq(inAppNotifications.userId, userId)];
  if (dateFrom) conditions.push(gte(inAppNotifications.createdAt, dateFrom.toISOString().slice(0, 19).replace('T', ' ')));
  if (dateTo) conditions.push(lte(inAppNotifications.createdAt, dateTo.toISOString().slice(0, 19).replace('T', ' ')));
  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
  const [data, countResult] = await Promise.all([
    db.select().from(inAppNotifications).where(whereClause).orderBy(desc(inAppNotifications.createdAt)).limit(limit).offset(offset),
    db.select({ count: count() }).from(inAppNotifications).where(whereClause),
  ]);
  return { data, total: countResult[0]?.count ?? 0 };
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: count() })
    .from(inAppNotifications)
    .where(and(eq(inAppNotifications.userId, userId), eq(inAppNotifications.isRead, false)));
  return result[0]?.count ?? 0;
}

export async function markNotificationRead(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(inAppNotifications)
    .set({ isRead: true })
    .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(inAppNotifications)
    .set({ isRead: true })
    .where(and(eq(inAppNotifications.userId, userId), eq(inAppNotifications.isRead, false)));
}


// ─── Account Management: Clients ────────────────────────────────────────────

export async function getClients(filters: {
  planStatus?: string;
  renewalStatus?: string;
  accountManagerId?: number;
  search?: string;
  limit?: number;
  offset?: number;
  userRole?: string;
  userId?: number;
} = {}): Promise<{ data: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const conditions: any[] = [isNull(clients.deletedAt)];

  if (filters.planStatus) conditions.push(eq(clients.planStatus, filters.planStatus as any));
  if (filters.renewalStatus) conditions.push(eq(clients.renewalStatus, filters.renewalStatus as any));
  if (filters.accountManagerId) conditions.push(eq(clients.accountManagerId, filters.accountManagerId));
  if (filters.search) conditions.push(like(clients.businessProfile, `%${filters.search}%`));

  // RBAC: AccountManager can only see their own clients
  if (filters.userRole === "AccountManager" && filters.userId) {
    conditions.push(eq(clients.accountManagerId, filters.userId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select({
      id: clients.id,
      leadId: clients.leadId,
      dealId: clients.dealId,
      businessProfile: clients.businessProfile,
      group: clients.group,
      planStatus: clients.planStatus,
      renewalStatus: clients.renewalStatus,
      accountManagerId: clients.accountManagerId,
      competentPerson: clients.competentPerson,
      contactEmail: clients.contactEmail,
      contactPhone: clients.contactPhone,
      leadName: clients.leadName,
      phone: clients.phone,
      otherPhones: clients.otherPhones,
      contractLink: clients.contractLink,
      marketingObjective: clients.marketingObjective,
      servicesNeeded: clients.servicesNeeded,
      socialMedia: clients.socialMedia,
      feedback: clients.feedback,
      notes: clients.notes,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
      healthScore: clients.healthScore,
      accountManagerName: users.name,
    }).from(clients)
      .leftJoin(users, eq(clients.accountManagerId, users.id))
      .where(whereClause)
      .orderBy(desc(clients.createdAt))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0),
    db.select({ count: count() }).from(clients).where(whereClause),
  ]);

  // Fetch active contracts for these clients to get start/end dates
  const clientIds = data.map(c => c.id);
  let contractMap: Record<number, any> = {};
  if (clientIds.length > 0) {
    const clientContracts = await db.select({
      clientId: contracts.clientId,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      status: contracts.status,
      charges: contracts.charges,
      period: contracts.period,
    }).from(contracts)
      .where(and(
        inArray(contracts.clientId, clientIds),
        isNull(contracts.deletedAt)
      ))
      .orderBy(desc(contracts.createdAt));

    // Group by clientId, take the latest active contract
    for (const c of clientContracts) {
      if (!contractMap[c.clientId]) {
        contractMap[c.clientId] = c;
      }
    }
  }

  // Merge contract data into client data
  const enrichedData = data.map(client => ({
    ...client,
    contractStartDate: contractMap[client.id]?.startDate || null,
    contractEndDate: contractMap[client.id]?.endDate || null,
    contractStatus: contractMap[client.id]?.status || null,
    contractCharges: contractMap[client.id]?.charges || null,
    contractPeriod: contractMap[client.id]?.period || null,
  }));

  return { data: enrichedData, total: countResult[0]?.count ?? 0 };
}
export async function getClientById(id: number): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function createClient(data: InsertClient): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(clients).values(data);
  return Number(result[0].insertId);
}

export async function updateClient(id: number, data: Partial<InsertClient>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set(data).where(eq(clients.id, id));
}

export async function deleteClient(id: number, deletedByUserId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set({ deletedAt: new Date(), deletedBy: deletedByUserId ?? null }).where(eq(clients.id, id));
}

// ─── Account Management: List Account Managers ──────────────────────────────

export async function listAccountManagers(): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(
    and(
      or(eq(users.role, "AccountManager" as any), eq(users.role, "AccountManagerLead" as any)),
      eq(users.isActive, true),
      isNull(users.deletedAt)
    )
  );
}

// ─── Account Management: Contracts ──────────────────────────────────────────

export async function getContractsByClient(clientId: number): Promise<Contract[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contracts)
    .where(and(eq(contracts.clientId, clientId), isNull(contracts.deletedAt)))
    .orderBy(desc(contracts.createdAt));
}

export async function createContract(data: InsertContract): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(contracts).values(data);
  return Number(result[0].insertId);
}

export async function updateContract(id: number, data: Partial<InsertContract>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(contracts).set(data).where(eq(contracts.id, id));
}

// ─── Account Management: Service Packages ───────────────────────────────────

export async function getServicePackages(): Promise<ServicePackage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(servicePackages).where(eq(servicePackages.isActive, true)).orderBy(desc(servicePackages.createdAt));
}

export async function createServicePackage(data: InsertServicePackage): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(servicePackages).values(data);
  return Number(result[0].insertId);
}
export async function updateServicePackage(id: number, data: Partial<InsertServicePackage>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(servicePackages).set(data).where(eq(servicePackages.id, id));
}
export async function deleteServicePackage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(servicePackages).set({ isActive: 0 }).where(eq(servicePackages.id, id));
}
export async function restoreServicePackage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(servicePackages).set({ isActive: 1 }).where(eq(servicePackages.id, id));
}
export async function getAllServicePackages(): Promise<ServicePackage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(servicePackages).orderBy(desc(servicePackages.createdAt));
}


// ─── Phase 2: Client Profile with Contracts & Renewals ─────────────────────

export async function getClientProfileById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get client with lead name and account manager name
  const clientRows = await db
    .select({
      id: clients.id,
      leadId: clients.leadId,
      dealId: clients.dealId,
      businessProfile: clients.businessProfile,
      group: clients.group,
      planStatus: clients.planStatus,
      renewalStatus: clients.renewalStatus,
      accountManagerId: clients.accountManagerId,
      competentPerson: clients.competentPerson,
      contactEmail: clients.contactEmail,
      contactPhone: clients.contactPhone,
      clientLeadName: clients.leadName,
      clientPhone: clients.phone,
      otherPhones: clients.otherPhones,
      contractLink: clients.contractLink,
      marketingObjective: clients.marketingObjective,
      servicesNeeded: clients.servicesNeeded,
      socialMedia: clients.socialMedia,
      feedback: clients.feedback,
      notes: clients.notes,
      lastFollowUpDate: clients.lastFollowUpDate,
      nextFollowUpDate: clients.nextFollowUpDate,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
      // Join lead name
      leadName: leads.name,
      leadPhone: leads.phone,
      // Join account manager name
      accountManagerName: users.name,
    })
    .from(clients)
    .leftJoin(leads, eq(clients.leadId, leads.id))
    .leftJoin(users, eq(clients.accountManagerId, users.id))
    .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
    .limit(1);

  const client = clientRows[0];
  if (!client) throw new Error("Client not found");

  // Get contracts for this client
  const contractRows = await db
    .select({
      id: contracts.id,
      clientId: contracts.clientId,
      packageId: contracts.packageId,
      packageIds: contracts.packageIds,
      packageName: servicePackages.name,
      contractName: contracts.contractName,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      period: contracts.period,
      charges: contracts.charges,
      currency: contracts.currency,
      monthlyCharges: contracts.monthlyCharges,
      status: contracts.status,
      contractRenewalStatus: contracts.contractRenewalStatus,
      renewalAssignedTo: contracts.renewalAssignedTo,
      priceOffer: contracts.priceOffer,
      upselling: contracts.upselling,
      notes: contracts.notes,
      createdAt: contracts.createdAt,
      updatedAt: contracts.updatedAt,
    })
    .from(contracts)
    .leftJoin(servicePackages, eq(contracts.packageId, servicePackages.id))
    .where(and(eq(contracts.clientId, id), isNull(contracts.deletedAt)))
    .orderBy(desc(contracts.startDate));

  // Get active service packages for dropdown
  const packages = await db
    .select({ id: servicePackages.id, name: servicePackages.name })
    .from(servicePackages)
    .where(eq(servicePackages.isActive, true))
    .orderBy(servicePackages.name);

  return { client, contracts: contractRows, servicePackages: packages };
}

export async function getContractById(contractId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      id: contracts.id,
      clientId: contracts.clientId,
      accountManagerId: clients.accountManagerId,
    })
    .from(contracts)
    .innerJoin(clients, eq(contracts.clientId, clients.id))
    .where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Contract not found");
  return row;
}

export async function getRenewals() {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const limitDate = new Date(now);
  limitDate.setDate(limitDate.getDate() + 90);

  const rows = await db
    .select({
      contractId: contracts.id,
      clientId: clients.id,
      clientName: leads.name,
      accountManagerId: clients.accountManagerId,
      endDate: contracts.endDate,
      charges: contracts.charges,
      currency: contracts.currency,
      contractRenewalStatus: contracts.contractRenewalStatus,
    })
    .from(contracts)
    .innerJoin(clients, eq(contracts.clientId, clients.id))
    .leftJoin(leads, eq(clients.leadId, leads.id))
    .where(
      and(
        isNull(contracts.deletedAt),
        isNull(clients.deletedAt),
        or(
          lte(contracts.endDate, limitDate),
          inArray(contracts.contractRenewalStatus, [
            "Negotiation",
            "SentOffer",
            "Won",
            "Lost",
            "Renewed",
            "NotRenewed",
          ] as any),
        ),
      ),
    )
    .orderBy(desc(contracts.endDate));

  return rows;
}

export async function updateRenewalStage(contractId: number, stage: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(contracts)
    .set({ contractRenewalStatus: stage as any })
    .where(eq(contracts.id, contractId));
}


// ─── Phase 3: Follow-ups ─────────────────────────────────────────────────────

async function recalcClientFollowUpDates(db: any, clientId: number) {
  const rows = await db
    .select({
      last: sql<string | null>`MAX(CASE WHEN ${followUps.status} = 'Completed' THEN ${followUps.followUpDate} ELSE NULL END)`,
      next: sql<string | null>`MIN(CASE WHEN ${followUps.status} = 'Pending' THEN ${followUps.followUpDate} ELSE NULL END)`,
    })
    .from(followUps)
    .where(eq(followUps.clientId, clientId));

  const agg = rows[0] as any;

  await db
    .update(clients)
    .set({
      lastFollowUpDate: agg?.last ?? null,
      nextFollowUpDate: agg?.next ?? null,
    })
    .where(eq(clients.id, clientId));
}

export async function getFollowUps(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: followUps.id,
      clientId: followUps.clientId,
      userId: followUps.userId,
      userName: users.name,
      type: followUps.type,
      followUpDate: followUps.followUpDate,
      notes: followUps.notes,
      status: followUps.status,
      createdAt: followUps.createdAt,
    })
    .from(followUps)
    .leftJoin(users, eq(followUps.userId, users.id))
    .where(eq(followUps.clientId, clientId))
    .orderBy(desc(followUps.followUpDate));
}

export async function createFollowUp(data: { clientId: number; userId: number; type: string; followUpDate: Date; notes?: string | null; status?: string }) {
  const db = await getDb();
  if (!db) return;

  await db.insert(followUps).values({
    clientId: data.clientId,
    userId: data.userId,
    type: data.type as any,
    followUpDate: data.followUpDate as any,
    notes: data.notes ?? null,
    status: (data.status ?? "Pending") as any,
  });

  await recalcClientFollowUpDates(db, data.clientId);
}

export async function getFollowUpMeta(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ id: followUps.id, clientId: followUps.clientId })
    .from(followUps)
    .where(eq(followUps.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Follow-up not found");
  return row;
}

export async function completeFollowUp(id: number) {
  const db = await getDb();
  if (!db) return;

  const row = await db
    .select({ id: followUps.id, clientId: followUps.clientId })
    .from(followUps)
    .where(eq(followUps.id, id))
    .limit(1);

  const meta = row[0];
  if (!meta) throw new Error("Follow-up not found");

  await db
    .update(followUps)
    .set({ status: "Completed" as any })
    .where(eq(followUps.id, id));

  await recalcClientFollowUpDates(db, meta.clientId);
}


export async function updateFollowUp(id: number, data: { type?: string; followUpDate?: Date; notes?: string | null }) {
  const db = await getDb();
  if (!db) return;
  const row = await db
    .select({ id: followUps.id, clientId: followUps.clientId })
    .from(followUps)
    .where(eq(followUps.id, id))
    .limit(1);
  const meta = row[0];
  if (!meta) throw new Error("Follow-up not found");
  const setObj: any = {};
  if (data.type !== undefined) setObj.type = data.type;
  if (data.followUpDate !== undefined) setObj.followUpDate = data.followUpDate;
  if (data.notes !== undefined) setObj.notes = data.notes;
  await db
    .update(followUps)
    .set(setObj)
    .where(eq(followUps.id, id));
  await recalcClientFollowUpDates(db, meta.clientId);
}
// ─── Phase 3: Client Tasks ──────────────────────────────────────────────────

export async function getClientTasks(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: clientTasks.id,
      clientId: clientTasks.clientId,
      title: clientTasks.title,
      assignedTo: clientTasks.assignedTo,
      assignedToName: sql<string | null>`(SELECT name FROM users WHERE id = ${clientTasks.assignedTo})`,
      dueDate: clientTasks.dueDate,
      priority: clientTasks.priority,
      status: clientTasks.status,
      notes: clientTasks.notes,
      createdBy: clientTasks.createdBy,
      createdByName: sql<string>`(SELECT name FROM users WHERE id = ${clientTasks.createdBy})`,
      createdAt: clientTasks.createdAt,
    })
    .from(clientTasks)
    .where(eq(clientTasks.clientId, clientId))
    .orderBy(desc(clientTasks.createdAt));
}

export async function createClientTask(data: { clientId: number; title: string; assignedTo?: number | null; dueDate?: Date | null; priority?: string; status?: string; notes?: string | null; createdBy: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(clientTasks).values({
    clientId: data.clientId,
    title: data.title,
    assignedTo: data.assignedTo ?? null,
    dueDate: data.dueDate ?? null,
    priority: (data.priority ?? "Medium") as any,
    status: (data.status ?? "ToDo") as any,
    notes: data.notes ?? null,
    createdBy: data.createdBy,
  } as any);
}

export async function updateClientTask(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(clientTasks).set(data).where(eq(clientTasks.id, id));
}

export async function getClientTaskMeta(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ id: clientTasks.id, clientId: clientTasks.clientId })
    .from(clientTasks)
    .where(eq(clientTasks.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Task not found");
  return row;
}

// ─── Phase 3: Onboarding ────────────────────────────────────────────────────

export async function getOnboardingItems(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: clientOnboardingItems.id,
      clientId: clientOnboardingItems.clientId,
      itemName: clientOnboardingItems.itemName,
      isChecked: clientOnboardingItems.isChecked,
      notes: clientOnboardingItems.notes,
    })
    .from(clientOnboardingItems)
    .where(eq(clientOnboardingItems.clientId, clientId))
    .orderBy(desc(clientOnboardingItems.id));
}

export async function getOnboardingItemMeta(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ id: clientOnboardingItems.id, clientId: clientOnboardingItems.clientId })
    .from(clientOnboardingItems)
    .where(eq(clientOnboardingItems.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Onboarding item not found");
  return row;
}

export async function updateOnboardingItem(id: number, isChecked: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(clientOnboardingItems)
    .set({ isChecked: isChecked ? 1 : 0 })
    .where(eq(clientOnboardingItems.id, id));
}

export async function initializeOnboarding(clientId: number, checklistId: number) {
  const db = await getDb();
  if (!db) return;

  // Check if already initialized
  const existing = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(clientOnboardingItems)
    .where(eq(clientOnboardingItems.clientId, clientId));

  const cnt = Number((existing[0] as any)?.c ?? 0);
  if (cnt > 0) return; // Already initialized

  const checklist = await db
    .select()
    .from(onboardingChecklists)
    .where(eq(onboardingChecklists.id, checklistId))
    .limit(1);

  if (!checklist[0]) throw new Error("Checklist not found");

  const items = (checklist[0].items ?? []) as unknown as string[];
  if (items.length === 0) return;

  await db.insert(clientOnboardingItems).values(
    items.map((name) => ({
      clientId,
      itemName: name,
      isChecked: 0,
    })) as any,
  );
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
    .orderBy(users.name);
}

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "bigint") return Number(value);
  return 0;
};

const round = (value: number, precision = 2) => Number(value.toFixed(precision));

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

const buildUpcomingRenewalBuckets = (months = 6) => {
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const monthDate = addMonths(startOfMonth(now), index);
    return {
      key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      month: getMonthLabel(monthDate),
      count: 0,
    };
  });
};

const getHealthBucket = (score: number) => {
  if (score >= 70) return "Good";
  if (score >= 40) return "Average";
  return "Poor";
};

// ─── Phase 4: AM Dashboard ──────────────────────────────────────────────────

export async function getAMDashboardStats(userId: number, userRole?: string) {
  const db = await getDb();
  if (!db) return { kpis: { myActiveClients: 0, myRenewalRate: 0, myUpsellValue: 0, avgHealthScore: 0 }, charts: { clientsByHealthScore: [], upcomingRenewals: [] }, tables: { myOverdueTasks: [], recentFollowUps: [] } };

  // Get active clients for this AM with lead name
  const activeClients = await db
    .select({
      id: clients.id,
      leadId: clients.leadId,
      healthScore: clients.healthScore,
      leadName: leads.name,
    })
    .from(clients)
    .leftJoin(leads, eq(clients.leadId, leads.id))
    .where(and(...(userRole === "Admin" || userRole === "admin" ? [] : [eq(clients.accountManagerId, userId)]), eq(clients.planStatus, "Active" as any), isNull(clients.deletedAt)))
    .orderBy(leads.name);

  const clientIds = activeClients.map((c) => c.id);
  const averageHealthScore =
    activeClients.length > 0
      ? round(activeClients.reduce((sum, c) => sum + toNumber(c.healthScore), 0) / activeClients.length)
      : 0;

  const healthDistribution = [
    { name: "Good", value: 0 },
    { name: "Average", value: 0 },
    { name: "Poor", value: 0 },
  ];

  for (const client of activeClients) {
    const bucket = getHealthBucket(toNumber(client.healthScore));
    const entry = healthDistribution.find((item) => item.name === bucket);
    if (entry) entry.value += 1;
  }

  // Get contracts for these clients
  const contractRows = clientIds.length
    ? await db
        .select({
          id: contracts.id,
          clientId: contracts.clientId,
          endDate: contracts.endDate,
          status: contracts.status,
          contractRenewalStatus: contracts.contractRenewalStatus,
        })
        .from(contracts)
        .where(and(inArray(contracts.clientId, clientIds), isNull(contracts.deletedAt)))
    : [];

  const renewedContracts = contractRows.filter((c) => c.contractRenewalStatus === "Renewed" || c.contractRenewalStatus === "Won").length;
  const renewalBase = contractRows.filter(
    (c) => c.status === "Expired" || c.contractRenewalStatus === "Renewed" || c.contractRenewalStatus === "Won",
  ).length;
  const renewalRate = renewalBase > 0 ? round((renewedContracts / renewalBase) * 100) : 0;

  const upcomingRenewalsBuckets = buildUpcomingRenewalBuckets(6);
  const firstBucketDate = startOfMonth(new Date());
  const lastBucketDate = addMonths(firstBucketDate, 6);

  for (const contract of contractRows) {
    if (!contract.endDate) continue;
    const contractEndDate = new Date(contract.endDate);
    if (contractEndDate >= firstBucketDate && contractEndDate < lastBucketDate) {
      const key = `${contractEndDate.getFullYear()}-${String(contractEndDate.getMonth() + 1).padStart(2, "0")}`;
      const targetBucket = upcomingRenewalsBuckets.find((b) => b.key === key);
      if (targetBucket) targetBucket.count += 1;
    }
  }

  // Overdue tasks
  const overdueTasks = clientIds.length
    ? await db
        .select({
          id: clientTasks.id,
          title: clientTasks.title,
          status: clientTasks.status,
          dueDate: clientTasks.dueDate,
          clientId: clientTasks.clientId,
          clientName: leads.name,
        })
        .from(clientTasks)
        .innerJoin(clients, eq(clientTasks.clientId, clients.id))
        .leftJoin(leads, eq(clients.leadId, leads.id))
        .where(
          and(
            inArray(clientTasks.clientId, clientIds),
            lte(clientTasks.dueDate, new Date()),
            or(eq(clientTasks.status, "ToDo" as any), eq(clientTasks.status, "InProgress" as any)),
          ),
        )
        .orderBy(clientTasks.dueDate)
    : [];

  // Recent follow-ups
  const recentFollowUps = await db
    .select({
      id: followUps.id,
      notes: followUps.notes,
      followUpDate: followUps.followUpDate,
      createdAt: followUps.createdAt,
      clientId: followUps.clientId,
      clientName: leads.name,
    })
    .from(followUps)
    .innerJoin(clients, eq(followUps.clientId, clients.id))
    .leftJoin(leads, eq(clients.leadId, leads.id))
    .where(...(userRole === "Admin" || userRole === "admin" ? [sql`1=1`] : [eq(followUps.userId, userId)]))
    .orderBy(desc(followUps.followUpDate), desc(followUps.createdAt))
    .limit(10);

  return {
    kpis: {
      myActiveClients: activeClients.length,
      myRenewalRate: renewalRate,
      myUpsellValue: 0,
      avgHealthScore: averageHealthScore,
    },
    charts: {
      clientsByHealthScore: healthDistribution,
      upcomingRenewals: upcomingRenewalsBuckets.map(({ key, ...bucket }) => bucket),
    },
    tables: {
      myOverdueTasks: overdueTasks,
      recentFollowUps,
    },
  };
}

// ─── Phase 4: AM Lead Dashboard ─────────────────────────────────────────────

export async function getAMLeadDashboardStats() {
  const db = await getDb();
  if (!db) return { kpis: { totalActiveClients: 0, teamRenewalRate: 0, totalContractValue: 0, teamAvgHealthScore: 0 }, charts: { teamPerformance: [], portfolioHealth: [] }, tables: { highRiskClients: [], teamRenewalPipelineSummary: [] } };

  const [activeClients, allContracts, allUsers, allFollowUps] = await Promise.all([
    db
      .select({
        id: clients.id,
        healthScore: clients.healthScore,
        accountManagerId: clients.accountManagerId,
        leadName: leads.name,
        accountManagerName: users.name,
      })
      .from(clients)
      .leftJoin(leads, eq(clients.leadId, leads.id))
      .leftJoin(users, eq(clients.accountManagerId, users.id))
      .where(and(eq(clients.planStatus, "Active" as any), isNull(clients.deletedAt)))
      .orderBy(leads.name),
    db
      .select({
        id: contracts.id,
        clientId: contracts.clientId,
        status: contracts.status,
        contractRenewalStatus: contracts.contractRenewalStatus,
        charges: contracts.charges,
        endDate: contracts.endDate,
      })
      .from(contracts)
      .where(isNull(contracts.deletedAt)),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(
        or(eq(users.role, "AccountManager" as any), eq(users.role, "AccountManagerLead" as any)),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      )),
    db
      .select({ clientId: followUps.clientId, followUpDate: followUps.followUpDate })
      .from(followUps)
      .orderBy(desc(followUps.followUpDate)),
  ]);

  const activeClientIds = new Set(activeClients.map((c) => c.id));
  const teamContracts = allContracts.filter((c) => activeClientIds.has(c.clientId));

  const renewedContracts = teamContracts.filter((c) => c.contractRenewalStatus === "Renewed" || c.contractRenewalStatus === "Won").length;
  const renewalBase = teamContracts.filter(
    (c) => c.status === "Expired" || c.contractRenewalStatus === "Renewed" || c.contractRenewalStatus === "Won",
  ).length;
  const teamRenewalRate = renewalBase > 0 ? round((renewedContracts / renewalBase) * 100) : 0;

  const totalContractValue = round(
    teamContracts
      .filter((c) => c.status === "Active")
      .reduce((sum, c) => sum + toNumber(c.charges), 0),
  );

  const teamAvgHealthScore =
    activeClients.length > 0
      ? round(activeClients.reduce((sum, c) => sum + toNumber(c.healthScore), 0) / activeClients.length)
      : 0;

  const portfolioHealth = [
    { name: "Good", value: 0 },
    { name: "Average", value: 0 },
    { name: "Poor", value: 0 },
  ];

  for (const client of activeClients) {
    const bucket = getHealthBucket(toNumber(client.healthScore));
    const entry = portfolioHealth.find((item) => item.name === bucket);
    if (entry) entry.value += 1;
  }

  const performanceMap = new Map<number, { name: string; activeClients: number; renewed: number; base: number }>();

  for (const user of allUsers) {
    performanceMap.set(user.id, { name: user.name ?? "Unknown", activeClients: 0, renewed: 0, base: 0 });
  }

  for (const client of activeClients) {
    if (!client.accountManagerId) continue;
    const manager = performanceMap.get(client.accountManagerId);
    if (manager) manager.activeClients += 1;
  }

  const clientManagerMap = new Map<number, number | null>(activeClients.map((c) => [c.id, c.accountManagerId]));

  for (const contract of teamContracts) {
    const managerId = clientManagerMap.get(contract.clientId);
    if (!managerId) continue;
    const manager = performanceMap.get(managerId);
    if (!manager) continue;
    if (contract.contractRenewalStatus === "Renewed" || contract.contractRenewalStatus === "Won") manager.renewed += 1;
    if (contract.status === "Expired" || contract.contractRenewalStatus === "Renewed" || contract.contractRenewalStatus === "Won") manager.base += 1;
  }

  const teamPerformance = Array.from(performanceMap.values())
    .filter((m) => m.activeClients > 0 || m.base > 0)
    .map((m) => ({
      name: m.name,
      activeClients: m.activeClients,
      renewalRate: m.base > 0 ? round((m.renewed / m.base) * 100) : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const followUpMap = new Map<number, Date>();
  for (const f of allFollowUps) {
    if (!followUpMap.has(f.clientId)) {
      followUpMap.set(f.clientId, new Date(f.followUpDate));
    }
  }

  const highRiskClients = activeClients
    .filter((c) => toNumber(c.healthScore) < 40)
    .map((c) => ({
      clientId: c.id,
      clientName: c.leadName ?? "Unknown",
      accountManager: c.accountManagerName ?? "Unassigned",
      healthScore: toNumber(c.healthScore),
      lastFollowUp: followUpMap.get(c.id) ?? null,
    }))
    .sort((a, b) => a.healthScore - b.healthScore);

  const pipelineAccumulator = new Map<string, { accountManager: string; Pending: number; InProgress: number; Renewed: number; Churned: number }>();

  for (const client of activeClients) {
    const managerName = client.accountManagerName ?? "Unassigned";
    if (!pipelineAccumulator.has(managerName)) {
      pipelineAccumulator.set(managerName, { accountManager: managerName, Pending: 0, InProgress: 0, Renewed: 0, Churned: 0 });
    }
  }

  for (const contract of teamContracts) {
    const client = activeClients.find((item) => item.id === contract.clientId);
    const managerName = client?.accountManagerName ?? "Unassigned";
    if (!pipelineAccumulator.has(managerName)) continue;
    const row = pipelineAccumulator.get(managerName)!;
    const status = contract.contractRenewalStatus ?? "New";
    if (status === "Renewed" || status === "Won") row.Renewed += 1;
    else if (status === "NotRenewed" || status === "Lost") row.Churned += 1;
    else if (status === "Negotiation" || status === "SentOffer") row.InProgress += 1;
    else row.Pending += 1;
  }

  return {
    kpis: { totalActiveClients: activeClients.length, teamRenewalRate, totalContractValue, teamAvgHealthScore },
    charts: { teamPerformance, portfolioHealth },
    tables: {
      highRiskClients,
      teamRenewalPipelineSummary: Array.from(pipelineAccumulator.values()).sort((a, b) => a.accountManager.localeCompare(b.accountManager)),
    },
  };
}

// ─── Phase 4: Health Score Calculation ──────────────────────────────────────

export async function calculateHealthScore(clientId: number) {
  const db = await getDb();
  if (!db) return { clientId, score: 0, breakdown: { okrAchievement: 0, followUpCompliance: 0, taskOnTimeDelivery: 0, openIssuesScore: 0 } };

  const [objectiveRows, taskRows, followUpRows] = await Promise.all([
    db
      .select({ id: keyResults.id, targetValue: keyResults.targetValue, currentValue: keyResults.currentValue })
      .from(keyResults)
      .innerJoin(clientObjectives, eq(keyResults.objectiveId, clientObjectives.id))
      .where(eq(clientObjectives.clientId, clientId)),
    db
      .select({ id: clientTasks.id, status: clientTasks.status, dueDate: clientTasks.dueDate })
      .from(clientTasks)
      .where(eq(clientTasks.clientId, clientId)),
    db
      .select({ followUpDate: followUps.followUpDate })
      .from(followUps)
      .where(eq(followUps.clientId, clientId))
      .orderBy(desc(followUps.followUpDate))
      .limit(1),
  ]);

  const measurableKRs = objectiveRows.filter((r) => r.targetValue !== null);
  const achievedKRs = measurableKRs.filter((r) => {
    const target = toNumber(r.targetValue);
    const current = toNumber(r.currentValue);
    return target === 0 ? true : current >= target;
  }).length;
  const okrAchievement = measurableKRs.length > 0 ? achievedKRs / measurableKRs.length : 1;

  const lastFollowUp = followUpRows[0] ? new Date(followUpRows[0].followUpDate) : null;
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const followUpCompliance = lastFollowUp && lastFollowUp >= fourteenDaysAgo ? 1 : 0;

  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter((t) => t.status === "Done").length;
  const taskOnTimeDelivery = totalTasks > 0 ? completedTasks / totalTasks : 1;

  const overdueOpenTasks = taskRows.filter((t) => {
    if (t.status === "Done" || t.status === "Cancelled") return false;
    return t.dueDate && new Date(t.dueDate) < new Date();
  }).length;
  const openIssuesScore = totalTasks > 0 ? Math.max(0, 1 - overdueOpenTasks / totalTasks) : 1;

  const healthScore = Math.max(0, Math.min(100,
    Math.round(okrAchievement * 30 + followUpCompliance * 20 + taskOnTimeDelivery * 25 + openIssuesScore * 25),
  ));

  await db.update(clients).set({ healthScore }).where(eq(clients.id, clientId));

  return {
    clientId,
    score: healthScore,
    breakdown: {
      okrAchievement: round(okrAchievement * 100),
      followUpCompliance: round(followUpCompliance * 100),
      taskOnTimeDelivery: round(taskOnTimeDelivery * 100),
      openIssuesScore: round(openIssuesScore * 100),
    },
  };
}

export async function updateAllHealthScores() {
  const db = await getDb();
  if (!db) return { updated: 0, results: [] };

  const activeClientRows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.planStatus, "Active" as any), isNull(clients.deletedAt)));

  const results = [];
  for (const client of activeClientRows) {
    const result = await calculateHealthScore(client.id);
    results.push(result);
  }

  return { updated: results.length, results };
}

// ─── Phase 4: OKRs (Objectives & Key Results) ──────────────────────────────

export async function getObjectives(clientId: number) {
  const db = await getDb();
  if (!db) return [];

  const [objectiveRows, keyResultRows] = await Promise.all([
    db
      .select({
        id: clientObjectives.id,
        clientId: clientObjectives.clientId,
        title: clientObjectives.title,
        status: clientObjectives.status,
        createdAt: clientObjectives.createdAt,
      })
      .from(clientObjectives)
      .where(eq(clientObjectives.clientId, clientId))
      .orderBy(desc(clientObjectives.createdAt)),
    db
      .select({
        id: keyResults.id,
        objectiveId: keyResults.objectiveId,
        title: keyResults.title,
        targetValue: keyResults.targetValue,
        currentValue: keyResults.currentValue,
        createdAt: keyResults.createdAt,
      })
      .from(keyResults)
      .innerJoin(clientObjectives, eq(keyResults.objectiveId, clientObjectives.id))
      .where(eq(clientObjectives.clientId, clientId)),
  ]);

  return objectiveRows.map((obj) => ({
    ...obj,
    keyResults: keyResultRows
      .filter((kr) => kr.objectiveId === obj.id)
      .map((kr) => ({
        ...kr,
        targetValue: kr.targetValue === null ? null : toNumber(kr.targetValue),
        currentValue: toNumber(kr.currentValue),
      })),
  }));
}

export async function createObjective(data: { clientId: number; title: string; status?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(clientObjectives).values({
    clientId: data.clientId,
    title: data.title,
    status: (data.status ?? "OnTrack") as any,
  } as any);
  const objectiveId = Number((result as any)[0]?.insertId ?? 0);
  const [objective] = await db.select().from(clientObjectives).where(eq(clientObjectives.id, objectiveId)).limit(1);
  return objective;
}


export async function updateObjective(id: number, data: { title?: string; status?: string }) {
  const db = await getDb();
  if (!db) return null;
  const patch: any = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.status !== undefined) patch.status = data.status;
  await db.update(clientObjectives).set(patch).where(eq(clientObjectives.id, id));
  const [row] = await db.select().from(clientObjectives).where(eq(clientObjectives.id, id)).limit(1);
  return row;
}
export async function createKeyResult(data: { objectiveId: number; title: string; targetValue?: number | null }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(keyResults).values({
    objectiveId: data.objectiveId,
    title: data.title,
    targetValue: data.targetValue != null ? data.targetValue.toFixed(2) : null,
    currentValue: "0",
  } as any);
  const krId = Number((result as any)[0]?.insertId ?? 0);
  const [kr] = await db.select().from(keyResults).where(eq(keyResults.id, krId)).limit(1);

  // Recalculate health score
  const [obj] = await db.select({ clientId: clientObjectives.clientId }).from(clientObjectives).where(eq(clientObjectives.id, data.objectiveId)).limit(1);
  if (obj) await calculateHealthScore(obj.clientId);

  return kr;
}

export async function updateKeyResult(id: number, currentValue: number) {
  const db = await getDb();
  if (!db) return null;
  await db.update(keyResults).set({ currentValue: currentValue.toFixed(2) } as any).where(eq(keyResults.id, id));

  const [kr] = await db
    .select({
      id: keyResults.id,
      objectiveId: keyResults.objectiveId,
      targetValue: keyResults.targetValue,
      currentValue: keyResults.currentValue,
      clientId: clientObjectives.clientId,
    })
    .from(keyResults)
    .innerJoin(clientObjectives, eq(keyResults.objectiveId, clientObjectives.id))
    .where(eq(keyResults.id, id))
    .limit(1);

  if (!kr) return null;

  // Recalculate objective status
  const objectiveKRs = await db
    .select({ targetValue: keyResults.targetValue, currentValue: keyResults.currentValue })
    .from(keyResults)
    .where(eq(keyResults.objectiveId, kr.objectiveId));

  const measurable = objectiveKRs.filter((item) => item.targetValue !== null);
  const avgProgress =
    measurable.length > 0
      ? measurable.reduce((sum, item) => {
          const target = toNumber(item.targetValue);
          const current = toNumber(item.currentValue);
          return sum + (target <= 0 ? 1 : Math.min(current / target, 1));
        }, 0) / measurable.length
      : 1;

  const status = avgProgress >= 0.7 ? "OnTrack" : avgProgress >= 0.4 ? "AtRisk" : "OffTrack";
  await db.update(clientObjectives).set({ status: status as any }).where(eq(clientObjectives.id, kr.objectiveId));
  await calculateHealthScore(kr.clientId);

  const [updated] = await db.select().from(keyResults).where(eq(keyResults.id, id)).limit(1);
  return updated;
}

// ─── Phase 5: Deliverables ──────────────────────────────────────────────────

export async function getDeliverables(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: deliverables.id,
      clientId: deliverables.clientId,
      contractId: deliverables.contractId,
      name: deliverables.name,
      description: deliverables.description,
      status: deliverables.status,
      dueDate: deliverables.dueDate,
      deliveredAt: deliverables.deliveredAt,
      assignedTo: deliverables.assignedTo,
      createdAt: deliverables.createdAt,
      assignedToName: sql<string | null>`(SELECT name FROM users WHERE id = ${deliverables.assignedTo})`,
    })
    .from(deliverables)
    .where(eq(deliverables.clientId, clientId))
    .orderBy(deliverables.dueDate, desc(deliverables.createdAt));
}

export async function createDeliverable(data: { clientId: number; contractId?: number | null; name: string; description?: string | null; status?: string; dueDate?: Date | null; assignedTo?: number | null }) {
  const db = await getDb();
  if (!db) return null;
  const insertData: any = {
    clientId: data.clientId,
    contractId: data.contractId ?? null,
    name: data.name,
    description: data.description ?? null,
    status: (data.status ?? "Pending") as any,
    dueDate: data.dueDate ?? null,
    assignedTo: data.assignedTo ?? null,
  };
  if (insertData.status === "Delivered" || insertData.status === "Approved") {
    insertData.deliveredAt = new Date();
  }
  const result = await db.insert(deliverables).values(insertData);
  const id = Number((result as any)[0]?.insertId ?? 0);
  const [row] = await db.select().from(deliverables).where(eq(deliverables.id, id)).limit(1);
  return row;
}

export async function updateDeliverable(id: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  const patch = { ...data };
  if (patch.status === "Delivered" || patch.status === "Approved") {
    patch.deliveredAt = patch.deliveredAt ?? new Date();
  }
  await db.update(deliverables).set(patch).where(eq(deliverables.id, id));
  const [row] = await db.select().from(deliverables).where(eq(deliverables.id, id)).limit(1);
  return row;
}

// ─── Phase 5: Upsell Opportunities ─────────────────────────────────────────

export async function getUpsellOpportunities(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: upsellOpportunities.id,
      clientId: upsellOpportunities.clientId,
      servicePackageId: upsellOpportunities.servicePackageId,
      title: upsellOpportunities.title,
      potentialValue: upsellOpportunities.potentialValue,
      status: upsellOpportunities.status,
      notes: upsellOpportunities.notes,
      createdBy: upsellOpportunities.createdBy,
      createdAt: upsellOpportunities.createdAt,
      createdByName: sql<string | null>`(SELECT name FROM users WHERE id = ${upsellOpportunities.createdBy})`,
    })
    .from(upsellOpportunities)
    .where(eq(upsellOpportunities.clientId, clientId))
    .orderBy(desc(upsellOpportunities.createdAt));
}

export async function createUpsellOpportunity(data: { clientId: number; servicePackageId?: number | null; title: string; potentialValue?: string | null; status?: string; notes?: string | null; createdBy: number }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(upsellOpportunities).values({
    clientId: data.clientId,
    servicePackageId: data.servicePackageId ?? null,
    title: data.title,
    potentialValue: data.potentialValue ?? null,
    status: (data.status ?? "Prospecting") as any,
    notes: data.notes ?? null,
    createdBy: data.createdBy,
  } as any);
  const id = Number((result as any)[0]?.insertId ?? 0);
  const [row] = await db.select().from(upsellOpportunities).where(eq(upsellOpportunities.id, id)).limit(1);
  return row;
}

export async function updateUpsellOpportunity(id: number, data: any) {
  const db = await getDb();
  if (!db) return null;
  await db.update(upsellOpportunities).set(data).where(eq(upsellOpportunities.id, id));
  const [row] = await db.select().from(upsellOpportunities).where(eq(upsellOpportunities.id, id)).limit(1);
  return row;
}

// ─── Phase 5: Client Communications ────────────────────────────────────────

export async function getClientCommunications(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientCommunications)
    .where(eq(clientCommunications.clientId, clientId))
    .orderBy(desc(clientCommunications.createdAt));
}

export async function createClientCommunication(data: { clientId: number; channelName: string; channelType: string; link?: string | null; notes?: string | null }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(clientCommunications).values({
    clientId: data.clientId,
    channelName: data.channelName,
    channelType: data.channelType as any,
    link: data.link ?? null,
    notes: data.notes ?? null,
  } as any);
  const id = Number((result as any)[0]?.insertId ?? 0);
  const [row] = await db.select().from(clientCommunications).where(eq(clientCommunications.id, id)).limit(1);
  return row;
}


export async function updateClientCommunication(id: number, data: { channelName?: string; channelType?: string; link?: string | null; notes?: string | null }) {
  const db = await getDb();
  if (!db) return null;
  const patch: any = {};
  if (data.channelName !== undefined) patch.channelName = data.channelName;
  if (data.channelType !== undefined) patch.channelType = data.channelType;
  if (data.link !== undefined) patch.link = data.link;
  if (data.notes !== undefined) patch.notes = data.notes;
  await db.update(clientCommunications).set(patch).where(eq(clientCommunications.id, id));
  const [row] = await db.select().from(clientCommunications).where(eq(clientCommunications.id, id)).limit(1);
  return row;
}

// ─── Soft Delete & Restore Functions ────────────────────────────────────
export async function softDeleteFollowUp(id: number): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  const [existing] = await db.select().from(followUps).where(eq(followUps.id, id));
  await db.update(followUps).set({ deletedAt: new Date() } as any).where(eq(followUps.id, id));
  return existing;
}
export async function restoreFollowUp(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(followUps).set({ deletedAt: null } as any).where(eq(followUps.id, id));
}
export async function softDeleteClientTask(id: number): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  const [existing] = await db.select().from(clientTasks).where(eq(clientTasks.id, id));
  await db.update(clientTasks).set({ deletedAt: new Date() } as any).where(eq(clientTasks.id, id));
  return existing;
}
export async function restoreClientTask(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clientTasks).set({ deletedAt: null } as any).where(eq(clientTasks.id, id));
}
export async function softDeleteObjective(id: number): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  const [existing] = await db.select().from(clientObjectives).where(eq(clientObjectives.id, id));
  await db.update(clientObjectives).set({ deletedAt: new Date() } as any).where(eq(clientObjectives.id, id));
  return existing;
}
export async function restoreObjective(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clientObjectives).set({ deletedAt: null } as any).where(eq(clientObjectives.id, id));
}
export async function softDeleteDeliverable(id: number): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  const [existing] = await db.select().from(deliverables).where(eq(deliverables.id, id));
  await db.update(deliverables).set({ deletedAt: new Date() } as any).where(eq(deliverables.id, id));
  return existing;
}
export async function restoreDeliverable(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(deliverables).set({ deletedAt: null } as any).where(eq(deliverables.id, id));
}
export async function softDeleteUpsell(id: number): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  const [existing] = await db.select().from(upsellOpportunities).where(eq(upsellOpportunities.id, id));
  await db.update(upsellOpportunities).set({ deletedAt: new Date() } as any).where(eq(upsellOpportunities.id, id));
  return existing;
}
export async function restoreUpsell(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(upsellOpportunities).set({ deletedAt: null } as any).where(eq(upsellOpportunities.id, id));
}
export async function softDeleteCommunication(id: number): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  const [existing] = await db.select().from(clientCommunications).where(eq(clientCommunications.id, id));
  await db.update(clientCommunications).set({ deletedAt: new Date() } as any).where(eq(clientCommunications.id, id));
  return existing;
}
export async function restoreCommunication(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clientCommunications).set({ deletedAt: null } as any).where(eq(clientCommunications.id, id));
}
// ─── Phase 5: CSAT Surveys ─────────────────────────────────────────────────

export async function submitCSAT(data: { clientId: number; contractId?: number | null; score: number; feedback?: string | null }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(csatSurveys).values({
    clientId: data.clientId,
    contractId: data.contractId ?? null,
    score: data.score,
    feedback: data.feedback ?? null,
  } as any);
  const id = Number((result as any)[0]?.insertId ?? 0);
  const [row] = await db.select().from(csatSurveys).where(eq(csatSurveys.id, id)).limit(1);
  await calculateHealthScore(data.clientId);
  return row;
}

export async function getCSATScores(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(csatSurveys)
    .where(eq(csatSurveys.clientId, clientId))
    .orderBy(desc(csatSurveys.submittedAt));
}

// ─── Lead Assignments (Collaboration Model) ──────────────────────────────────

export async function getLeadAssignments(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT la.*, u.name as userName, u.email as userEmail, u.role as userRole,
           ab.name as assignedByName
    FROM lead_assignments la
    LEFT JOIN users u ON u.id = la.userId
    LEFT JOIN users ab ON ab.id = la.assignedBy
    WHERE la.leadId = ${leadId} AND la.isActive = 1
    ORDER BY FIELD(la.role, 'owner', 'collaborator', 'client_success', 'account_manager', 'observer'), la.createdAt ASC
  `);
  return (rows as any)[0] ?? [];
}

export async function getLeadAssignmentHistory(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT la.*, u.name as userName, u.email as userEmail, u.role as userRole,
           ab.name as assignedByName
    FROM lead_assignments la
    LEFT JOIN users u ON u.id = la.userId
    LEFT JOIN users ab ON ab.id = la.assignedBy
    WHERE la.leadId = ${leadId}
    ORDER BY la.createdAt DESC
  `);
  return (rows as any)[0] ?? [];
}

export async function getLeadsByAssignment(userId: number, assignmentRole?: string) {
  const db = await getDb();
  if (!db) return [];
  let roleFilter = '';
  if (assignmentRole) {
    roleFilter = `AND la.role = '${assignmentRole}'`;
  }
  const rows = await db.execute(sql`
    SELECT l.*, la.role as assignmentRole, la.permissions as assignmentPermissions,
           la.createdAt as assignedAt, la.reason as assignmentReason,
           u.name as ownerName,
           ab.name as assignedByName
    FROM lead_assignments la
    JOIN leads l ON l.id = la.leadId AND l.deletedAt IS NULL
    LEFT JOIN users u ON u.id = l.ownerId
    LEFT JOIN users ab ON ab.id = la.assignedBy
    WHERE la.userId = ${userId} AND la.isActive = 1
    ${assignmentRole ? sql`AND la.role = ${assignmentRole}` : sql``}
    ORDER BY la.createdAt DESC
  `);
  return (rows as any)[0] ?? [];
}

export async function getMyCollaboratedLeads(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT l.*, la.role as assignmentRole, la.permissions as assignmentPermissions,
           la.createdAt as assignedAt, la.reason as assignmentReason,
           u.name as ownerName
    FROM lead_assignments la
    JOIN leads l ON l.id = la.leadId AND l.deletedAt IS NULL
    LEFT JOIN users u ON u.id = l.ownerId
    WHERE la.userId = ${userId} AND la.isActive = 1 AND la.role = 'collaborator'
    ORDER BY la.createdAt DESC
  `);
  return (rows as any)[0] ?? [];
}

export async function getMyWatchingLeads(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT l.*, la.role as assignmentRole, la.permissions as assignmentPermissions,
           la.createdAt as assignedAt, la.reason as assignmentReason,
           u.name as ownerName
    FROM lead_assignments la
    JOIN leads l ON l.id = la.leadId AND l.deletedAt IS NULL
    LEFT JOIN users u ON u.id = l.ownerId
    WHERE la.userId = ${userId} AND la.isActive = 1 AND la.role = 'observer'
    ORDER BY la.createdAt DESC
  `);
  return (rows as any)[0] ?? [];
}

export async function createLeadAssignment(data: {
  leadId: number;
  userId: number;
  role: string;
  permissions: string;
  assignedBy: number;
  reason?: string;
  notes?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // Check if assignment already exists
  const existing = await db.execute(sql`
    SELECT id FROM lead_assignments
    WHERE leadId = ${data.leadId} AND userId = ${data.userId} AND role = ${data.role} AND isActive = 1
  `);
  const existingRows = (existing as any)[0] ?? [];
  if (existingRows.length > 0) {
    // Update existing
    await db.execute(sql`
      UPDATE lead_assignments SET reason = ${data.reason ?? null}, notes = ${data.notes ?? null}, assignedBy = ${data.assignedBy}
      WHERE id = ${existingRows[0].id}
    `);
    return existingRows[0].id;
  }
  const result = await db.insert(leadAssignments).values({
    leadId: data.leadId,
    userId: data.userId,
    role: data.role as any,
    permissions: data.permissions as any,
    assignedBy: data.assignedBy,
    reason: data.reason,
    notes: data.notes,
  });
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function smartHandover(data: {
  leadId: number;
  fromUserId: number;
  toUserId: number;
  reason?: string;
  notes?: string;
}): Promise<{ success: boolean; transferId: number; assignmentId: number }> {
  const db = await getDb();
  if (!db) return { success: false, transferId: 0, assignmentId: 0 };

  // 1. Create transfer record (keep history)
  const transferId = await createLeadTransfer({
    leadId: data.leadId,
    fromUserId: data.fromUserId,
    toUserId: data.toUserId,
    reason: data.reason,
    notes: data.notes,
  });

  // Note: createLeadTransfer already updates ownerId

  // 2. Deactivate old owner assignment
  await db.execute(sql`
    UPDATE lead_assignments SET isActive = 0
    WHERE leadId = ${data.leadId} AND userId = ${data.fromUserId} AND role = 'owner'
  `);

  // 3. Create observer assignment for old owner (they can still see the lead)
  await createLeadAssignment({
    leadId: data.leadId,
    userId: data.fromUserId,
    role: 'observer',
    permissions: 'view',
    assignedBy: data.fromUserId,
    reason: data.reason ?? 'Handover - previous owner',
    notes: data.notes,
  });

  // 4. Create owner assignment for new owner
  const assignmentId = await createLeadAssignment({
    leadId: data.leadId,
    userId: data.toUserId,
    role: 'owner',
    permissions: 'full',
    assignedBy: data.fromUserId,
    reason: data.reason,
    notes: data.notes,
  });

  return { success: true, transferId, assignmentId };
}

export async function addCollaborator(data: {
  leadId: number;
  userId: number;
  role: string;
  assignedBy: number;
  reason?: string;
  notes?: string;
}): Promise<number> {
  const permissionsMap: Record<string, string> = {
    collaborator: 'edit',
    client_success: 'edit',
    account_manager: 'full',
    observer: 'view',
  };
  return createLeadAssignment({
    leadId: data.leadId,
    userId: data.userId,
    role: data.role,
    permissions: permissionsMap[data.role] ?? 'view',
    assignedBy: data.assignedBy,
    reason: data.reason,
    notes: data.notes,
  });
}

export async function removeLeadAssignment(assignmentId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE lead_assignments SET isActive = 0 WHERE id = ${assignmentId}`);
}

export async function checkLeadAccess(leadId: number, userId: number): Promise<{ hasAccess: boolean; role: string | null; permissions: string | null }> {
  const db = await getDb();
  if (!db) return { hasAccess: false, role: null, permissions: null };
  
  // Check if user is the owner
  const lead = await getLeadById(leadId);
  if (lead && lead.ownerId === userId) {
    return { hasAccess: true, role: 'owner', permissions: 'full' };
  }
  
  // Check assignments
  const rows = await db.execute(sql`
    SELECT role, permissions FROM lead_assignments
    WHERE leadId = ${leadId} AND userId = ${userId} AND isActive = 1
    ORDER BY FIELD(role, 'owner', 'collaborator', 'client_success', 'account_manager', 'observer')
    LIMIT 1
  `);
  const result = (rows as any)[0] ?? [];
  if (result.length > 0) {
    return { hasAccess: true, role: result[0].role, permissions: result[0].permissions };
  }
  return { hasAccess: false, role: null, permissions: null };
}

// ─── Meeting Notification Config ──────────────────────────────────────────────
export async function getMeetingNotificationConfig(): Promise<MeetingNotificationConfig | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(meetingNotificationConfig).limit(1);
  if (result.length === 0) {
    // Insert default config
    await db.insert(meetingNotificationConfig).values({
      reminderMinutes: [30, 10],
      repeatCount: 1,
      soundEnabled: 1,
      popupEnabled: 1,
      autoCalendarForMeeting: 1,
      autoCalendarForCall: 1,
    });
    const newResult = await db.select().from(meetingNotificationConfig).limit(1);
    return newResult[0] || null;
  }
  return result[0];
}

export async function updateMeetingNotificationConfig(data: {
  reminderMinutes?: number[];
  repeatCount?: number;
  soundEnabled?: boolean;
  popupEnabled?: boolean;
  autoCalendarForMeeting?: boolean;
  autoCalendarForCall?: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(meetingNotificationConfig).limit(1);
  const updateData: any = {};
  if (data.reminderMinutes !== undefined) updateData.reminderMinutes = data.reminderMinutes;
  if (data.repeatCount !== undefined) updateData.repeatCount = data.repeatCount;
  if (data.soundEnabled !== undefined) updateData.soundEnabled = data.soundEnabled ? 1 : 0;
  if (data.popupEnabled !== undefined) updateData.popupEnabled = data.popupEnabled ? 1 : 0;
  if (data.autoCalendarForMeeting !== undefined) updateData.autoCalendarForMeeting = data.autoCalendarForMeeting ? 1 : 0;
  if (data.autoCalendarForCall !== undefined) updateData.autoCalendarForCall = data.autoCalendarForCall ? 1 : 0;
  if (existing.length > 0) {
    await db.update(meetingNotificationConfig).set(updateData);
  } else {
    await db.insert(meetingNotificationConfig).values({
      reminderMinutes: data.reminderMinutes ?? [30, 10],
      repeatCount: data.repeatCount ?? 1,
      soundEnabled: data.soundEnabled !== undefined ? (data.soundEnabled ? 1 : 0) : 1,
      popupEnabled: data.popupEnabled !== undefined ? (data.popupEnabled ? 1 : 0) : 1,
      autoCalendarForMeeting: data.autoCalendarForMeeting !== undefined ? (data.autoCalendarForMeeting ? 1 : 0) : 1,
      autoCalendarForCall: data.autoCalendarForCall !== undefined ? (data.autoCalendarForCall ? 1 : 0) : 1,
    });
  }
}

// ─── Lead Reminders ─────────────────────────────────────────────────────────

export async function getLeadReminders(leadId: number) {
  const db = await getDb();
  return db.select({
    id: leadReminders.id,
    leadId: leadReminders.leadId,
    userId: leadReminders.userId,
    userName: users.name,
    title: leadReminders.title,
    description: leadReminders.description,
    reminderDate: leadReminders.reminderDate,
    reminderTime: leadReminders.reminderTime,
    priority: leadReminders.priority,
    status: leadReminders.status,
    color: leadReminders.color,
    createdAt: leadReminders.createdAt,
    completedAt: leadReminders.completedAt,
  })
  .from(leadReminders)
  .leftJoin(users, eq(users.id, leadReminders.userId))
  .where(eq(leadReminders.leadId, leadId))
  .orderBy(desc(leadReminders.reminderDate));
}

export async function getRemindersByUser(userId: number, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  const conditions: any[] = [eq(leadReminders.userId, userId)];
  if (dateFrom) conditions.push(gte(leadReminders.reminderDate, dateFrom));
  if (dateTo) conditions.push(lte(leadReminders.reminderDate, dateTo));
  return db.select({
    id: leadReminders.id,
    leadId: leadReminders.leadId,
    leadName: leads.name,
    leadPhone: leads.phone,
    userId: leadReminders.userId,
    title: leadReminders.title,
    description: leadReminders.description,
    reminderDate: leadReminders.reminderDate,
    reminderTime: leadReminders.reminderTime,
    priority: leadReminders.priority,
    status: leadReminders.status,
    color: leadReminders.color,
    createdAt: leadReminders.createdAt,
    completedAt: leadReminders.completedAt,
  })
  .from(leadReminders)
  .leftJoin(leads, eq(leads.id, leadReminders.leadId))
  .where(and(...conditions))
  .orderBy(asc(leadReminders.reminderDate));
}

export async function getTodayReminders(userId: number) {
  const db = await getDb();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 19).replace('T', ' ');
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString().slice(0, 19).replace('T', ' ');
  return db.select({
    id: leadReminders.id,
    leadId: leadReminders.leadId,
    leadName: leads.name,
    leadPhone: leads.phone,
    userId: leadReminders.userId,
    title: leadReminders.title,
    description: leadReminders.description,
    reminderDate: leadReminders.reminderDate,
    reminderTime: leadReminders.reminderTime,
    priority: leadReminders.priority,
    status: leadReminders.status,
    color: leadReminders.color,
    completedAt: leadReminders.completedAt,
  })
  .from(leadReminders)
  .leftJoin(leads, eq(leads.id, leadReminders.leadId))
  .where(and(
    eq(leadReminders.userId, userId),
    gte(leadReminders.reminderDate, startOfDay),
    lte(leadReminders.reminderDate, endOfDay),
  ))
  .orderBy(asc(leadReminders.reminderTime));
}

export async function getRemindersForCalendar(userId: number, month: number, year: number) {
  const db = await getDb();
  const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 19).replace('T', ' ');
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString().slice(0, 19).replace('T', ' ');
  return db.select({
    id: leadReminders.id,
    leadId: leadReminders.leadId,
    leadName: leads.name,
    leadPhone: leads.phone,
    title: leadReminders.title,
    description: leadReminders.description,
    reminderDate: leadReminders.reminderDate,
    reminderTime: leadReminders.reminderTime,
    priority: leadReminders.priority,
    status: leadReminders.status,
    color: leadReminders.color,
  })
  .from(leadReminders)
  .leftJoin(leads, eq(leads.id, leadReminders.leadId))
  .where(and(
    eq(leadReminders.userId, userId),
    gte(leadReminders.reminderDate, startDate),
    lte(leadReminders.reminderDate, endDate),
  ))
  .orderBy(asc(leadReminders.reminderDate), asc(leadReminders.reminderTime));
}

export async function createLeadReminder(data: {
  leadId: number;
  userId: number;
  title: string;
  description?: string | null;
  reminderDate: Date;
  reminderTime?: string;
  priority?: string;
  color?: string;
}) {
  const db = await getDb();
  const [result] = await db.insert(leadReminders).values({
    leadId: data.leadId,
    userId: data.userId,
    title: data.title,
    description: data.description ?? null,
    reminderDate: data.reminderDate.toISOString().slice(0, 19).replace('T', ' '),
    reminderTime: data.reminderTime ?? '09:00',
    priority: (data.priority ?? 'Medium') as any,
    color: data.color ?? '#6366f1',
    status: 'Pending' as any,
  });
  return result.insertId;
}

export async function updateLeadReminder(id: number, data: {
  title?: string;
  description?: string | null;
  reminderDate?: Date;
  reminderTime?: string;
  priority?: string;
  status?: string;
  color?: string;
}) {
  const db = await getDb();
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.reminderDate !== undefined) updateData.reminderDate = data.reminderDate.toISOString().slice(0, 19).replace('T', ' ');
  if (data.reminderTime !== undefined) updateData.reminderTime = data.reminderTime;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.status === 'Done') updateData.completedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await db.update(leadReminders).set(updateData).where(eq(leadReminders.id, id));
}

export async function deleteLeadReminder(id: number) {
  const db = await getDb();
  await db.delete(leadReminders).where(eq(leadReminders.id, id));
}

// ─── User Notification Preferences ────────────────────────────────────────────

export async function getUserNotificationPreferences(userId: number): Promise<UserNotificationPreference[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, userId));
}

export async function upsertUserNotificationPreference(userId: number, notificationType: string, soundEnabled: boolean, popupEnabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(userNotificationPreferences)
    .where(and(eq(userNotificationPreferences.userId, userId), eq(userNotificationPreferences.notificationType, notificationType)));
  if (existing.length > 0) {
    await db.update(userNotificationPreferences)
      .set({ soundEnabled: soundEnabled ? 1 : 0, popupEnabled: popupEnabled ? 1 : 0 } as any)
      .where(and(eq(userNotificationPreferences.userId, userId), eq(userNotificationPreferences.notificationType, notificationType)));
  } else {
    await db.insert(userNotificationPreferences).values({
      userId,
      notificationType,
      soundEnabled: soundEnabled ? 1 : 0,
      popupEnabled: popupEnabled ? 1 : 0,
    } as any);
  }
}

export async function bulkUpsertUserNotificationPreferences(userId: number, prefs: Array<{ notificationType: string; soundEnabled: boolean; popupEnabled: boolean }>): Promise<void> {
  for (const pref of prefs) {
    await upsertUserNotificationPreference(userId, pref.notificationType, pref.soundEnabled, pref.popupEnabled);
  }
}

// ─── Notification Sound Config ────────────────────────────────────────────────

export async function getNotificationSoundConfig(): Promise<NotificationSoundConfig | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(notificationSoundConfig).limit(1);
  return rows[0] ?? null;
}

export async function updateNotificationSoundConfig(soundFileUrl: string | null, soundFileName: string | null, uploadedBy: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(notificationSoundConfig).limit(1);
  if (existing.length > 0) {
    await db.update(notificationSoundConfig)
      .set({ soundFileUrl, soundFileName, uploadedBy } as any)
      .where(eq(notificationSoundConfig.id, existing[0].id));
  } else {
    await db.insert(notificationSoundConfig).values({ soundFileUrl, soundFileName, uploadedBy } as any);
  }
}


// ─── Exchange Rates ──────────────────────────────────────────────────────────
export async function getExchangeRates(): Promise<ExchangeRate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(exchangeRates);
}

export async function upsertExchangeRate(fromCurrency: string, toCurrency: string, rate: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    INSERT INTO exchange_rates (fromCurrency, toCurrency, rate)
    VALUES (${fromCurrency}, ${toCurrency}, ${rate})
    ON DUPLICATE KEY UPDATE rate = VALUES(rate), updatedAt = CURRENT_TIMESTAMP
  `);
}

// ─── Dynamic Campaign Names (union of all sources) ────────────────────────────
export async function getDistinctCampaignNames(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT DISTINCT name AS campaignName FROM (
      -- 1) Campaigns table
      SELECT name FROM campaigns WHERE deletedAt IS NULL AND name IS NOT NULL AND name != ''
      UNION
      -- 2) Lead campaignName
      SELECT campaignName AS name FROM leads WHERE deletedAt IS NULL AND campaignName IS NOT NULL AND campaignName != ''
      UNION
      -- 3) Meta campaign snapshots
      SELECT campaignName AS name FROM meta_campaign_snapshots WHERE campaignName IS NOT NULL AND campaignName != ''
      UNION
      -- 4) TikTok campaign snapshots
      SELECT campaign_name AS name FROM tiktok_campaign_snapshots WHERE campaign_name IS NOT NULL AND campaign_name != ''
    ) AS all_campaigns
    ORDER BY campaignName
  `);
  return ((rows as any)[0] as any[]).map((r: any) => r.campaignName);
}

// ─── Get Entity By ID (for audit log details) ────────────────────────────────
export async function getActivityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getCampaignById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result[0];
}

export async function getInternalNoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(internalNotes).where(eq(internalNotes.id, id)).limit(1);
  return result[0];
}

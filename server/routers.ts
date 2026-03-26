import { storageDelete, storagePut } from "./storage";
import { syncExchangeRates } from "./exchangeRateSync";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { rakanRouter } from "./rakanRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createSessionToken } from "./auth";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  listCalendarEvents,
  getFreeBusy,
} from "./googleCalendar";
import { buildPasswordResetEmail, sendEmail } from "./email";
import {
  assignLeadRoundRobin,
  bulkCreateLeads,
  checkAndUpdateSLA,
  createActivity,
  createCampaign,
  createCustomField,
  createDeal,
  createLead,
  normalizePhone,
  createPipelineStage,
  createPasswordResetToken,
  createUser,
  deleteActivity,
  deleteCampaign,
  deleteCustomField,
  deleteLead,
  deletePipelineStage,
  getActivitiesByLead,
  getActivitiesByUser,
  getAgentStats,
  getAllUsers,
  getCampaigns,
  getCustomFields,
  getDealByLead,
  getDealsByUser,
  getLeadById,
  getLeads,
  getLeadsCount,
  getPipelineStages,
  getSlaConfig,
  getTeamStats,
  getThemeSettings,
  getPasswordResetToken,
  getUserByEmail,
  markPasswordResetTokenUsed,
  updateActivity,
  updateCampaign,
  updateDeal,
  updateLead,
  updatePipelineStage,
  updateSlaConfig,
  updateUser,
  deleteUser,
  upsertThemeSetting,
  upsertUser,
  getNotificationSubscribers,
  addNotificationSubscriber,
  updateNotificationSubscriber,
  deleteNotificationSubscriber,
  getReportData,
  getLeadsForExport,
  getCampaignStats,
  getCampaignDetail,
  getInternalNotesByLead,
  createInternalNote,
  deleteInternalNote,
  getLeadTransfersByLead,
  createLeadTransfer,
  getChatMessages,
  getAllChatConversations,
  getUnreadMessageCount,
  markMessagesAsRead,
  createAuditLog,
  getAuditLogs,
  getAuditLogById,
  getTrashItems,
  getTrashStats,
  restoreLead,
  restoreUser,
  restoreCampaign,
  restoreActivity,
  restoreDeal,
  restoreInternalNote,
  softDeleteDeal,
  permanentDeleteEntity,
  createInAppNotification,
  createBulkInAppNotifications,
  getInAppNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getLeadByPhone,
  getSalesFunnelData,
  getTaskSlaDashboardData,
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  listAccountManagers,
  getContractsByClient,
  createContract,
  updateContract,
  getServicePackages,
  createServicePackage,
  getClientProfileById,
  getContractById,
  getRenewals,
  updateRenewalStage,
  getFollowUps,
  createFollowUp,
  getFollowUpMeta,
  completeFollowUp,
  getClientTasks,
  createClientTask,
  updateClientTask,
  getClientTaskMeta,
  getOnboardingItems,
  getOnboardingItemMeta,
  updateOnboardingItem,
  initializeOnboarding,
  listAllUsers,
  getAMDashboardStats,
  getAMLeadDashboardStats,
  calculateHealthScore,
  updateAllHealthScores,
  getObjectives,
  createObjective,
  createKeyResult,
  updateKeyResult,
  getDeliverables,
  createDeliverable,
  updateDeliverable,
  getUpsellOpportunities,
  createUpsellOpportunity,
  updateUpsellOpportunity,
  getClientCommunications,
  createClientCommunication,
  submitCSAT,
  getCSATScores,
  getLeadAssignments,
  getLeadAssignmentHistory,
  getLeadsByAssignment,
  getMyCollaboratedLeads,
  getMyWatchingLeads,
  createLeadAssignment,
  smartHandover,
  addCollaborator,
  removeLeadAssignment,
  checkLeadAccess,
  getMeetingNotificationConfig,
  updateMeetingNotificationConfig,
  getLeadReminders,
  getRemindersByUser,
  getTodayReminders,
  getRemindersForCalendar,
  createLeadReminder,
  updateLeadReminder,
  deleteLeadReminder,
  getUserNotificationPreferences,
  bulkUpsertUserNotificationPreferences,
  getNotificationSoundConfig,
  updateNotificationSoundConfig,
  getDb,
  getExchangeRates,
  upsertExchangeRate,
} from "./db";
import { buildReportEmail } from "./emailReports";
import { createLeadSourcesRouter } from "./leadSourcesRouter";
import {
  createBackupProcedure,
  getBackupsProcedure,
  deleteBackupProcedure,
  archiveDataProcedure,
  getArchiveStatsProcedure,
} from "./backup_procedures";
import { getConversationMetaForUser } from "./services/chat";
import {
  getMetaIntegration,
  upsertMetaIntegration,
  deleteMetaIntegration as deleteMetaIntegrationFn,
  getAdAccounts as getMetaAdAccounts,
  getActiveAdAccount as getActiveMetaAdAccount,
  addAdAccount as addMetaAdAccount,
  selectAdAccount as selectMetaAdAccount,
  updateAdAccountToken as updateMetaAdAccountToken,
  deleteAdAccount as deleteMetaAdAccountFn,
  fetchAdAccountInfo as fetchAdAccountInfoFn,
  syncCampaigns as syncMetaCampaigns,
  getActiveCampaignSnapshots as getActiveMetaCampaignSnapshots,
  changeCampaignStatus as changeMetaCampaignStatus,
  changeCampaignBudget as changeMetaCampaignBudget,
  fetchAllCampaignInsights as fetchAllMetaCampaignInsights,
} from "./services/MetaService";
import { MetaLeadgenService } from "./services/MetaLeadgenService";
import { getMetaCombinedAnalytics } from "./services/metaCombinedAnalyticsService";
import { getTikTokCampaignAnalytics } from "./services/tiktok/tiktokCampaignsService";
import { getTikTokIntegration, upsertTikTokIntegration, deleteTikTokIntegration, getTikTokAdAccounts, addTikTokAdAccount, selectTikTokAdAccount, updateTikTokAdAccountToken, deleteTikTokAdAccount, syncTikTokCampaigns, getActiveTikTokAdAccount } from "./services/tiktok/tiktokSettingsService";

// ─── Role Guards ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "Admin" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["Admin", "SalesManager", "admin"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager access required" });
  }
  return next({ ctx });
});

const notMediaBuyerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "MediaBuyer") {
    throw new TRPCError({ code: "FORBIDDEN", message: "MediaBuyer cannot edit" });


  }
  return next({ ctx });
});

const mediaBuyerOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["Admin", "admin", "MediaBuyer"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only Admin or Media Buyer can manage campaigns" });
  }
  return next({ ctx });
});

const accountManagerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["Admin", "admin", "AccountManager", "AccountManagerLead", "SalesManager"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account Management access required" });
  }
  return next({ ctx });
});

const PRIMARY_SUPER_ADMIN_EMAIL = "admin@tamiyouz.com";
const MAX_SUPPORT_SCREENSHOTS = 5;
const MAX_SUPPORT_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024;

const supportRequestTypeSchema = z.enum(["Ticket", "Suggestion"]);
const supportCategorySchema = z.enum(["Bug", "Complaint", "Access", "Data", "Feature", "Improvement", "Other"]);
const supportPrioritySchema = z.enum(["Low", "Medium", "High"]);
const supportStatusSchema = z.enum(["New", "UnderReview", "WaitingUser", "Resolved", "Closed", "Rejected"]);
const supportScreenshotInputSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileBase64: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().positive().max(MAX_SUPPORT_SCREENSHOT_SIZE_BYTES).optional(),
});

function isPrimarySuperAdmin(user: { email?: string | null }): boolean {
  return String(user.email ?? "").toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;
}

const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isPrimarySuperAdmin(ctx.user)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the primary super admin can access this resource" });
  }
  return next({ ctx });
});

function sanitizeUploadedFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(-120);
  return cleaned || `file-${Date.now()}.bin`;
}

async function getPrimarySuperAdminOrThrow() {
  const user = await getUserByEmail(PRIMARY_SUPER_ADMIN_EMAIL);
  if (!user) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Primary super admin account (${PRIMARY_SUPER_ADMIN_EMAIL}) was not found`,
    });
  }
  return user;
}

function buildSupportRequestCode(): string {
  return `SC-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
}


// ─── App Router ───────────────────────────────────────────────────────────────


function getAuditStage(value: unknown): string | null {
  if (!value) return null;

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (parsed && typeof parsed === "object" && "stage" in (parsed as Record<string, unknown>)) {
      const stage = (parsed as Record<string, unknown>).stage;
      return typeof stage === "string" ? stage : null;
    }
  } catch {
    return null;
  }

  return null;
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        if (!user.isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Account is deactivated" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        // Create JWT session using standalone auth
        const token = await createSessionToken(user.openId, { name: user.name ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          password: z.string().min(6),
          role: z.enum(["Admin", "SalesManager", "SalesAgent", "MediaBuyer", "AccountManager", "AccountManagerLead"]).default("SalesAgent"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByEmail(input.email.toLowerCase().trim());
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const openId = "local_" + nanoid(16);
        const user = await createUser({
          openId,
          name: input.name,
          email: input.email.toLowerCase().trim(),
          loginMethod: "email",
          role: input.role,
          passwordHash,
          lastSignedIn: new Date(),
        });
        const token = await createSessionToken(user.openId, { name: user.name ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(6),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user.passwordHash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No password set for this account" });
        }
        const valid = await bcrypt.compare(input.currentPassword, ctx.user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        }
        const newHash = await bcrypt.hash(input.newPassword, 12);
        await updateUser(ctx.user.id, { passwordHash: newHash });
        return { success: true };
      }),

    adminSetPassword: adminProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const hash = await bcrypt.hash(input.newPassword, 12);
        await updateUser(input.userId, { passwordHash: hash });
        return { success: true };
      }),

    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email(), origin: z.string().optional() }))
      .mutation(async ({ input }) => {
        // Always return success to prevent email enumeration
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user) return { success: true };
        const token = nanoid(48);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await createPasswordResetToken(user.id, token, expiresAt);
        const origin = input.origin ?? "https://tamiyouzplaform.com";
        const resetUrl = `${origin}/reset-password?token=${token}`;
        const emailContent = buildPasswordResetEmail({
          name: user.name ?? user.email ?? "User",
          resetUrl,
          lang: "ar",
        });
        const result = await sendEmail({ to: user.email!, ...emailContent });
        console.log(`[Auth] Password reset for ${user.email}: ${resetUrl}`);
        if (!result.success) {
          console.error("[Auth] Failed to send reset email:", result.info);
        }
        return { success: true, resetUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined };
      }),

    resetPassword: publicProcedure
      .input(z.object({ token: z.string(), newPassword: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const record = await getPasswordResetToken(input.token);
        if (!record) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset token" });
        }
        if (record.usedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link has already been used" });
        }
        if (new Date() > record.expiresAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Reset link has expired. Please request a new one." });
        }
        const newHash = await bcrypt.hash(input.newPassword, 12);
        await updateUser(record.userId, { passwordHash: newHash });
        await markPasswordResetTokenUsed(input.token);
        return { success: true };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Users ────────────────────────────────────────────────────────────────
  users: router({
    list: protectedProcedure.query(() => getAllUsers()),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          password: z.string().min(6),
          role: z.enum(["Admin", "SalesManager", "SalesAgent", "MediaBuyer", "AccountManager", "AccountManagerLead"]).default("SalesAgent"),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await getUserByEmail(input.email.toLowerCase().trim());
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const openId = "local_" + nanoid(16);
        const user = await createUser({
          openId,
          name: input.name,
          email: input.email.toLowerCase().trim(),
          loginMethod: "email",
          role: input.role,
          passwordHash,
          lastSignedIn: new Date(),
        });
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          email: z.string().email().optional(),
          role: z.enum(["Admin", "SalesManager", "SalesAgent", "MediaBuyer", "AccountManager", "AccountManagerLead"]).optional(),
          teamId: z.number().nullable().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        // Get existing user for audit trail
        const allUsers = await getAllUsers();
        const existingUser = allUsers.find((u: any) => u.id === id);
        const changedFields = Object.keys(data);
        const previousValue: Record<string, any> = {};
        const newValue: Record<string, any> = {};
        if (existingUser) {
          for (const key of changedFields) {
            previousValue[key] = (existingUser as any)[key] ?? null;
            newValue[key] = (data as any)[key] ?? null;
          }
        }
        await updateUser(id, data as any);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "update",
          entityType: "users",
          entityId: id,
          entityName: existingUser?.name ?? "Unknown",
          details: { changedFields },
          previousValue,
          newValue,
        });
        return { success: true };
      }),

    promoteOwner: adminProcedure.mutation(async ({ ctx }) => {
      await updateUser(ctx.user.id, { role: "Admin" });
      return { success: true };
    }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (input.id === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account" });
        }
        await deleteUser(input.id, ctx.user.id);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "soft_delete",
          entityType: "users",
          entityId: input.id,
        });
        return { success: true };
      }),
  }),

  // ─── Leads (with strict row-level security) ─────────────────────────────
  leads: router({
    list: protectedProcedure
      .input(
        z.object({
          stage: z.string().optional(),
          leadQuality: z.string().optional(),
          campaignName: z.string().optional(),
          dateFrom: z.date().optional(),
          dateTo: z.date().optional(),
          search: z.string().optional(),
          slaBreached: z.boolean().optional(),
          ownerId: z.number().optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        const filters: any = { ...input };
        // ── ROW-LEVEL SECURITY ──
        if (ctx.user.role === "SalesAgent") {
          // SalesAgent sees ONLY their own leads
          filters.ownerId = ctx.user.id;
        }
        // SalesManager sees all leads (no team filter needed for now since teamId is not widely used)
        const [items, total] = await Promise.all([
          getLeads(filters),
          getLeadsCount(filters),
        ]);
        return { items, total };
      }),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const lead = await getLeadById(input.id);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
        // ── ROW-LEVEL SECURITY ──
        if (ctx.user.role === "SalesAgent" && lead.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied: this lead is not assigned to you" });
        }
        return lead;
      }),

    create: notMediaBuyerProcedure
      .input(
        z.object({
          name: z.string().optional(),
          phone: z.string().min(3),
          country: z.string().optional(),
          businessProfile: z.string().optional(),
          leadQuality: z.enum(["Hot", "Warm", "Cold", "Bad", "Unknown"]).default("Unknown"),
          campaignName: z.string().optional(),
          adCreative: z.string().optional(),
          ownerId: z.number().optional(),
          stage: z.string().default("New"),
          notes: z.string().optional(),
          leadTime: z.date().optional(),
          contactTime: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        let ownerId = input.ownerId;

        // For manual lead creation (from any role), assign to the creator
        // Round-robin is reserved for auto-imported leads (e.g., Meta sync)
        if (!ownerId) {
          ownerId = ctx.user.id;
        }

        // ── Duplicate phone check ──
        const normalizedPhone = normalizePhone(input.phone);
        const existingLead = await getLeadByPhone(normalizedPhone);
        if (existingLead) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `رقم الهاتف موجود بالفعل للعميل: ${existingLead.name || existingLead.phone}`,
          });
        }

        const id = await createLead({ ...input, ownerId } as any);
        return { id };
      }),

    update: notMediaBuyerProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          phone: z.string().optional(),
          country: z.string().optional(),
          businessProfile: z.string().optional(),
          leadQuality: z.enum(["Hot", "Warm", "Cold", "Bad", "Unknown"]).optional(),
          campaignName: z.string().optional(),
          adCreative: z.string().optional(),
          ownerId: z.number().nullable().optional(),
          stage: z.string().optional(),
          notes: z.string().optional(),
          mediaBuyerNotes: z.string().optional(),
          serviceIntroduced: z.string().optional(),
          priceOfferSent: z.boolean().optional(),
          priceOfferLink: z.string().optional(),
          contactTime: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        // ── ROW-LEVEL SECURITY ──
        const existingLead = await getLeadById(id);
        if (ctx.user.role === "SalesAgent") {
          if (!existingLead || existingLead.ownerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit leads assigned to you" });
          }
          // SalesAgent cannot reassign leads to other agents
          if (data.ownerId !== undefined && data.ownerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You cannot reassign leads to other agents" });
          }
        }
        // Build previousValue and newValue for audit trail
        const changedFields = Object.keys(data);
        const previousValue: Record<string, any> = {};
        const newValue: Record<string, any> = {};
        if (existingLead) {
          for (const key of changedFields) {
            previousValue[key] = (existingLead as any)[key] ?? null;
            newValue[key] = (data as any)[key] ?? null;
          }
        }
        await updateLead(id, data as any);
        // Create audit log with previousValue/newValue for undo support
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "update",
          entityType: "leads",
          entityId: id,
          entityName: existingLead?.name ?? "Unknown",
          details: { changedFields },
          previousValue,
          newValue,
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // SalesAgent can only delete their own leads
        if (ctx.user.role === "SalesAgent") {
          const lead = await getLeadById(input.id);
          if (!lead || lead.ownerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete leads assigned to you" });
          }
        }
        await deleteLead(input.id, ctx.user.id);
        const lead = await getLeadById(input.id);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "soft_delete",
          entityType: "leads",
          entityId: input.id,
          entityName: lead?.name ?? "Unknown",
        });
        return { success: true };
      }),

    checkSLA: adminProcedure.mutation(() => checkAndUpdateSLA()),

    // ── Export leads to Google Sheet (one-way reporting) ──
    export: adminProcedure
      .input(
        z.object({
          filters: z.object({
            stage: z.string().optional(),
            leadQuality: z.string().optional(),
            campaignName: z.string().optional(),
            dateFrom: z.date().optional(),
            dateTo: z.date().optional(),
            ownerId: z.number().optional(),
            limit: z.number().max(5000).default(1000),
          }).optional(),
        })
      )
      .query(async ({ input }) => {
        return getLeadsForExport(input.filters ?? {});
      }),

    import: protectedProcedure
      .input(
        z.object({
          leads: z.array(z.record(z.string(), z.string())),
          ownerId: z.number().optional(),
          useRoundRobin: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Resolve ownerName to ownerId if provided per-row
        const allUsers = await getAllUsers();
        const userNameMap = new Map<string, number>();
        for (const u of allUsers) {
          userNameMap.set(u.name.toLowerCase().trim(), u.id);
        }

        const leadsData = input.leads.map((row) => {
          // Determine ownerId: per-row ownerName takes priority, then global ownerId
          let ownerId = input.ownerId || undefined;
          if (row.ownerName) {
            const resolvedId = userNameMap.get(row.ownerName.toLowerCase().trim());
            if (resolvedId) ownerId = resolvedId;
          }

          // Use leadTime as createdAt if provided, otherwise use current time
          const createdAt = row.leadTime ? new Date(row.leadTime) : new Date();
          
          return {
            name: row.name || undefined,
            phone: row.phone || "",
            country: row.country || undefined,
            businessProfile: row.businessProfile || undefined,
            leadQuality: (["Hot","Warm","Cold","Bad","Unknown"].includes(row.leadQuality ?? "") ? row.leadQuality : "Unknown") as any,
            campaignName: row.campaignName || undefined,
            adCreative: row.adCreative || undefined,
            stage: row.stage || "New",
            notes: row.notes || undefined,
            mediaBuyerNotes: row.mediaBuyerNotes || undefined,
            serviceIntroduced: row.serviceIntroduced || undefined,
            leadTime: row.leadTime ? new Date(row.leadTime) : undefined,
            createdAt,
            ownerId,
          };
        });
        const result = await bulkCreateLeads(leadsData as any);
        return result;
      }),
  }),

  // ─── Activities (with row-level security) ─────────────────────────────────
  activities: router({
    byLead: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        // ── ROW-LEVEL SECURITY ──
        if (ctx.user.role === "SalesAgent") {
          const lead = await getLeadById(input.leadId);
          if (!lead || lead.ownerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        return getActivitiesByLead(input.leadId);
      }),

    byUser: protectedProcedure
      .input(z.object({ userId: z.number().optional(), limit: z.number().default(20) }))
      .query(({ ctx, input }) => {
        const userId = input.userId ?? ctx.user.id;
        // ── ROW-LEVEL SECURITY ──
        if (ctx.user.role === "SalesAgent" && userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return getActivitiesByUser(userId, input.limit);
      }),

    create: notMediaBuyerProcedure
      .input(
        z.object({
          leadId: z.number(),
          type: z.enum(["WhatsApp", "Call", "SMS", "Meeting", "Offer", "Email", "Note"]),
          activityTime: z.date().optional(),
          outcome: z
            .enum(["Contacted", "NoAnswer", "Interested", "NotInterested", "Meeting", "Offer", "Won", "Lost", "Callback"])
            .optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // ── ROW-LEVEL SECURITY ──
        if (ctx.user.role === "SalesAgent") {
          const lead = await getLeadById(input.leadId);
          if (!lead || lead.ownerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        const id = await createActivity({
          ...input,
          userId: ctx.user.id,
          activityTime: input.activityTime ?? new Date(),
        } as any);

        // ── Auto-create calendar event for Meeting/Call activities ──
        if (input.type === "Meeting" || input.type === "Call") {
          try {
            const config = await getMeetingNotificationConfig();
            const shouldCreate = input.type === "Meeting"
              ? (config?.autoCalendarForMeeting ?? true)
              : (config?.autoCalendarForCall ?? true);

            if (shouldCreate && input.activityTime) {
              const lead = await getLeadById(input.leadId);
              const leadName = lead?.name || `Lead #${input.leadId}`;
              const startTime = new Date(input.activityTime);
              const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour default

              // Check agent free/busy
              const busy = await getFreeBusy(startTime.toISOString(), endTime.toISOString());
              const isAgentBusy = busy.some((slot: any) => {
                const slotStart = new Date(slot.start).getTime();
                const slotEnd = new Date(slot.end).getTime();
                return startTime.getTime() < slotEnd && endTime.getTime() > slotStart;
              });

              if (!isAgentBusy) {
                // Build attendees - include the agent's email
                const attendees: string[] = [];
                if (ctx.user.email) attendees.push(ctx.user.email);

                const agentDisplayName = ctx.user.name || "Unknown Agent";
                const summary = input.type === "Meeting"
                  ? `اجتماع: ${leadName} [${agentDisplayName}]`
                  : `مكالمة: ${leadName} [${agentDisplayName}]`;

                await createCalendarEvent({
                  summary,
                  description: input.notes || "",
                  startDateTime: start
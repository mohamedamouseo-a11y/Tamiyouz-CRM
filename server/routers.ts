import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
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
                  startDateTime: startTime.toISOString(),
                  endDateTime: endTime.toISOString(),
                  attendees,
                  leadId: input.leadId,
                  leadName,
                  agentName: agentDisplayName,
                });
                console.log(`[AutoCalendar] Created ${input.type} event for lead ${leadName}`);
              } else {
                console.log(`[AutoCalendar] Agent busy at ${startTime.toISOString()}, skipping calendar event`);
              }
            }
          } catch (err) {
            console.error("[AutoCalendar] Error creating calendar event:", err);
            // Don't fail the activity creation if calendar fails
          }
        }

        return { id };
      }),

    update: notMediaBuyerProcedure
      .input(
        z.object({
          id: z.number(),
          type: z.enum(["WhatsApp", "Call", "SMS", "Meeting", "Offer", "Email", "Note"]).optional(),
          activityTime: z.date().optional(),
          outcome: z
            .enum(["Contacted", "NoAnswer", "Interested", "NotInterested", "Meeting", "Offer", "Won", "Lost", "Callback"])
            .optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateActivity(id, data as any);
      }),

    delete: notMediaBuyerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteActivity(input.id, ctx.user.id);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "soft_delete",
          entityType: "activities",
          entityId: input.id,
        });
        return { success: true };
      }),
  }),

  // ─── Deals (with row-level security) ─────────────────────────────────────
  deals: router({
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
        return getDealByLead(input.leadId);
      }),

    byUser: protectedProcedure
      .input(z.object({ userId: z.number().optional() }))
      .query(({ ctx, input }) => {
        const userId = input.userId ?? ctx.user.id;
        // ── ROW-LEVEL SECURITY ──
        if (ctx.user.role === "SalesAgent" && userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return getDealsByUser(userId);
      }),

    create: notMediaBuyerProcedure
      .input(
        z.object({
          leadId: z.number(),
          valueSar: z.string().optional(),
          status: z.enum(["Won", "Lost", "Pending"]).default("Pending"),
          dealType: z.enum(["New", "Contract", "Renewal", "Upsell"]).optional(),
          lossReason: z.string().optional(),
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
        const id = await createDeal(input as any);
        return { id };
      }),

    update: notMediaBuyerProcedure
      .input(
        z.object({
          id: z.number(),
          leadId: z.number().optional(),
          valueSar: z.string().optional(),
          status: z.enum(["Won", "Lost", "Pending"]).optional(),
          closedAt: z.date().optional(),
          dealType: z.enum(["New", "Contract", "Renewal", "Upsell"]).optional(),
          lossReason: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateDeal(id, data as any);
      }),
  }),

  // ─── Campaigns ────────────────────────────────────────────────────────────
  campaigns: router({
    list: protectedProcedure.query(() => getCampaigns()),

    create: mediaBuyerOrAdminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          platform: z.enum(["Messages", "LeadForm", "Meta", "Google", "Snapchat", "TikTok", "Other"]).default("Meta"),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          notes: z.string().optional(),
          roundRobinEnabled: z.boolean().default(false),
        })
      )
      .mutation(({ input }) => createCampaign(input as any)),

    update: mediaBuyerOrAdminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          platform: z.enum(["Messages", "LeadForm", "Meta", "Google", "Snapchat", "TikTok", "Other"]).optional(),
          notes: z.string().optional(),
          roundRobinEnabled: z.boolean().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateCampaign(id, data as any);
      }),

    delete: mediaBuyerOrAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCampaign(input.id, ctx.user.id);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "soft_delete",
          entityType: "campaigns",
          entityId: input.id,
        });
        return { success: true };
      }),

    stats: protectedProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(({ input }) => getCampaignStats(input?.dateFrom, input?.dateTo)),

    detail: protectedProcedure
      .input(z.object({
        campaignName: z.string(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }))
      .query(({ input }) => getCampaignDetail(input.campaignName, input.dateFrom, input.dateTo)),
  }),

  // ─── Pipeline Stages ──────────────────────────────────────────────────────
  pipeline: router({
    list: publicProcedure.query(() => getPipelineStages()),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          nameAr: z.string().optional(),
          color: z.string().default("#6366f1"),
          order: z.number().default(0),
        })
      )
      .mutation(({ input }) => createPipelineStage(input as any)),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          nameAr: z.string().optional(),
          color: z.string().optional(),
          order: z.number().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updatePipelineStage(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deletePipelineStage(input.id)),
    toggle: adminProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(({ input }) => updatePipelineStage(input.id, { isActive: input.isActive })),
    reorder: adminProcedure
      .input(z.object({ items: z.array(z.object({ id: z.number(), order: z.number() })) }))
      .mutation(async ({ input }) => {
        for (const item of input.items) {
          await updatePipelineStage(item.id, { order: item.order });
        }
        return { success: true };
      }),
  }),
  // ─── Custom Fields ────────────────────────────────────────────────────────
  customFields: router({
    list: protectedProcedure
      .input(z.object({ entity: z.string().optional() }))
      .query(({ input }) => getCustomFields(input.entity)),

    create: adminProcedure
      .input(
        z.object({
          entity: z.enum(["Lead", "Deal", "Activity", "Campaign"]),
          fieldName: z.string().min(1),
          fieldLabel: z.string().optional(),
          fieldLabelAr: z.string().optional(),
          fieldType: z.enum(["text", "number", "date", "select", "boolean"]),
          options: z.array(z.string()).optional(),
          isRequired: z.boolean().default(false),
          order: z.number().default(0),
        })
      )
      .mutation(({ input }) => createCustomField(input as any)),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCustomField(input.id)),
  }),

  // ─── Theme Settings ───────────────────────────────────────────────────────
  theme: router({
    get: publicProcedure.query(() => getThemeSettings()),

    set: adminProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(({ input }) => upsertThemeSetting(input.key, input.value)),

    setBulk: adminProcedure
      .input(z.array(z.object({ key: z.string(), value: z.string() })))
      .mutation(async ({ input }) => {
        for (const item of input) {
          await upsertThemeSetting(item.key, item.value);
        }
        return { success: true };
      }),
  }),

  // ─── SLA Config ───────────────────────────────────────────────────────────
  sla: router({
    get: protectedProcedure.query(() => getSlaConfig()),

    update: adminProcedure
      .input(z.object({ hoursThreshold: z.number().min(1).max(720), isEnabled: z.boolean() }))
      .mutation(({ input }) => updateSlaConfig(input.hoursThreshold, input.isEnabled)),

    check: adminProcedure.mutation(() => checkAndUpdateSLA()),
  }),

  // ─── Dashboard Stats ──────────────────────────────────────────────────────
  dashboard: router({
    salesFunnel: protectedProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(({ ctx, input }) => getSalesFunnelData(input?.dateFrom, input?.dateTo, ctx.user.role, ctx.user.id)),
    taskSla: protectedProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        agentId: z.number().optional(),
      }).optional())
      .query(({ ctx, input }) => {
        // If agentId is specified by a manager, use it to filter; otherwise use current user for agents
        const isManagerRole = ["Admin", "SalesManager", "admin"].includes(ctx.user.role);
        const effectiveRole = (isManagerRole && input?.agentId) ? 'SalesAgent' : ctx.user.role;
        const effectiveUserId = (isManagerRole && input?.agentId) ? input.agentId : ctx.user.id;
        return getTaskSlaDashboardData(input?.dateFrom, input?.dateTo, effectiveRole, effectiveUserId);
      }),
     agentStats: protectedProcedure
      .input(z.object({
        userId: z.number().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }))
      .query(({ ctx, input }) => {
        const userId = input.userId ?? ctx.user.id;
        // ── ROW-LEVEL SECURITY ──
        if (ctx.user.role === "SalesAgent" && userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return getAgentStats(userId, input.dateFrom, input.dateTo, ctx.user.role);
      }),
    teamStats: managerProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(({ input }) => getTeamStats(input?.dateFrom, input?.dateTo)),
  }),

  // ─── Notifications ─────────────────────────────────────────────────────────
  notifications: router({
    getSubscribers: adminProcedure
      .query(async () => {
        return getNotificationSubscribers();
      }),
    addSubscriber: adminProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        frequency: z.enum(["daily", "weekly"]),
        reportTypes: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await addNotificationSubscriber({
          email: input.email,
          name: input.name ?? null,
          frequency: input.frequency,
          reportTypes: input.reportTypes ?? ["sla", "performance"],
          isActive: true,
        });
        return { id };
      }),
    updateSubscriber: adminProcedure
      .input(z.object({
        id: z.number(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        frequency: z.enum(["daily", "weekly"]).optional(),
        isActive: z.boolean().optional(),
        reportTypes: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, reportTypes, ...rest } = input;
        await updateNotificationSubscriber(id, {
          ...rest,
          ...(reportTypes !== undefined ? { reportTypes: reportTypes } : {}),
        });
        return { success: true };
      }),
    deleteSubscriber: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteNotificationSubscriber(input.id);
        return { success: true };
      }),
    sendTestReport: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const reportData = await getReportData();
        if (!reportData) return { success: false, info: "No data available" };
        const { subject, html, text } = buildReportEmail(reportData, "daily");
        const result = await sendEmail({ to: input.email, subject, html, text });
        return result;
      }),
    getReportData: adminProcedure
      .input(z.object({
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getReportData(input?.dateFrom, input?.dateTo);
      }),
  }),

  // ─── Excel Import ─────────────────────────────────────────────────────────
  import: router({
    leads: adminProcedure
      .input(
        z.object({
          rows: z.array(
            z.object({
              name: z.string().optional(),
              phone: z.string(),
              country: z.string().optional(),
              businessProfile: z.string().optional(),
              leadQuality: z.enum(["Hot", "Warm", "Cold", "Bad", "Unknown"]).optional(),
              campaignName: z.string().optional(),
              adCreative: z.string().optional(),
              stage: z.string().optional(),
              notes: z.string().optional(),
              mediaBuyerNotes: z.string().optional(),
              serviceIntroduced: z.string().optional(),
              leadTime: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        // Convert leadTime strings to Date objects for DB insertion
        const rows = input.rows.map((row) => ({
          ...row,
          leadTime: row.leadTime ? new Date(row.leadTime) : undefined,
        }));
        const result = await bulkCreateLeads(rows as any);
        return result;
      }),
  }),

  // ─── Internal Notes ──────────────────────────────────────────────────────
  notes: router({
    byLead: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "SalesAgent") {
          const lead = await getLeadById(input.leadId);
          if (!lead || lead.ownerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        return getInternalNotesByLead(input.leadId);
      }),

    create: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "SalesAgent") {
          const lead = await getLeadById(input.leadId);
          if (!lead || lead.ownerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        const id = await createInternalNote({
          leadId: input.leadId,
          userId: ctx.user.id,
          content: input.content,
        });
        return { id };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteInternalNote(input.id, ctx.user.id);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "soft_delete",
          entityType: "internalNotes",
          entityId: input.id,
        });
        return { success: true };
      }),
  }),



// ─── Lead Attachments ─────────────────────────────────────────────────────
attachments: router({
  byLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "SalesAgent") {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
      }

      const db = await (await import("./db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { leadAttachments } = await import("../drizzle/schema");

      return db
        .select()
        .from(leadAttachments)
        .where(eq(leadAttachments.leadId, input.leadId))
        .orderBy(desc(leadAttachments.createdAt));
    }),

  create: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      fileName: z.string().min(1),
      fileUrl: z.string().url(),
      fileSize: z.number().optional(),
      fileType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "SalesAgent") {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
      }

      const db = await (await import("./db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { leadAttachments } = await import("../drizzle/schema");

      await db.insert(leadAttachments).values({
        leadId: input.leadId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileSize: input.fileSize ?? null,
        fileType: input.fileType ?? null,
        uploadedBy: ctx.user.id,
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("./db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { leadAttachments } = await import("../drizzle/schema");

      const rows = await db
        .select()
        .from(leadAttachments)
        .where(eq(leadAttachments.id, input.id))
        .limit(1);

      const attachment = rows[0];
      if (!attachment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attachment not found" });
      }

      if (ctx.user.role === "SalesAgent") {
        const lead = await getLeadById(attachment.leadId);
        if (!lead || lead.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
      }

      await db.delete(leadAttachments).where(eq(leadAttachments.id, input.id));
      return { success: true };
    }),
}),

  // ─── Lead Transfers ──────────────────────────────────────────────────────
  transfers: router({
    byLead: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "SalesAgent") {
          const access = await checkLeadAccess(input.leadId, ctx.user.id);
          if (!access.hasAccess) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        return getLeadTransfersByLead(input.leadId);
      }),

    create: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        toUserId: z.number(),
        reason: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
        }
        if (ctx.user.role === "SalesAgent" && lead.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only transfer leads assigned to you" });
        }
        if (input.toUserId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot transfer lead to yourself" });
        }
        const result = await smartHandover({
          leadId: input.leadId,
          fromUserId: ctx.user.id,
          toUserId: input.toUserId,
          reason: input.reason,
          notes: input.notes,
        });
        return { id: result.transferId, success: true };
      }),
  }),

  // ─── Chat System ──────────────────────────────────────────────────────────
  // ─── Lead Assignments (Collaboration Model) ────────────────────────────────
  assignments: router({
    byLead: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getLeadAssignments(input.leadId);
      }),
    history: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getLeadAssignmentHistory(input.leadId);
      }),
    myCollaborated: protectedProcedure
      .query(async ({ ctx }) => {
        return getMyCollaboratedLeads(ctx.user.id);
      }),
    myWatching: protectedProcedure
      .query(async ({ ctx }) => {
        return getMyWatchingLeads(ctx.user.id);
      }),
    myByRole: protectedProcedure
      .input(z.object({ role: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return getLeadsByAssignment(ctx.user.id, input.role);
      }),
    checkAccess: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        return checkLeadAccess(input.leadId, ctx.user.id);
      }),
    handover: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        toUserId: z.number(),
        reason: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
        }
        if (ctx.user.role === "SalesAgent" && lead.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only handover leads assigned to you" });
        }
        if (input.toUserId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot handover lead to yourself" });
        }
        return smartHandover({
          leadId: input.leadId,
          fromUserId: ctx.user.id,
          toUserId: input.toUserId,
          reason: input.reason,
          notes: input.notes,
        });
      }),
    addCollaborator: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        userId: z.number(),
        role: z.enum(["collaborator", "client_success", "account_manager", "observer"]),
        reason: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
        }
        // Only owner, admin, or manager can add collaborators
        if (ctx.user.role === "SalesAgent" && lead.ownerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the lead owner can add collaborators" });
        }
        if (input.userId === lead.ownerId && input.role !== "observer") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot add the owner as a collaborator" });
        }
        const id = await addCollaborator({
          leadId: input.leadId,
          userId: input.userId,
          role: input.role,
          assignedBy: ctx.user.id,
          reason: input.reason,
          notes: input.notes,
        });
        return { id, success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ assignmentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Admin/Manager can remove any, SalesAgent can only remove from their own leads
        await removeLeadAssignment(input.assignmentId);
        return { success: true };
      }),
  }),
  chat: router({
    getHistory: protectedProcedure
      .input(z.object({
        toUserId: z.number().optional(),
        roomId: z.string().optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ ctx, input }) => {
        return getChatMessages({
          fromUserId: ctx.user.id,
          toUserId: input.toUserId,
          roomId: input.roomId,
          limit: input.limit,
        });
      }),
    getConversations: adminProcedure
      .query(async () => {
        return getAllChatConversations();
      }),
    // NEW: last message preview + per-conversation unread badges + total unread
    getConversationMeta: protectedProcedure.query(async ({ ctx }) => {
      return getConversationMetaForUser(ctx.user.id);
    }),
    // Keep this for backward compatibility (now derived from meta)
    getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
      const meta = await getConversationMetaForUser(ctx.user.id);
      return meta.totalUnread;
    }),
    markAsRead: protectedProcedure
      .input(z.object({ fromUserId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markMessagesAsRead(input.fromUserId, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Lead Sources (Google Sheets Integration) ─────────────────────────────
  leadSources: createLeadSourcesRouter(adminProcedure),

  // ─── Backup & Restore ─────────────────────────────────────────────────────
  admin: router({
    createBackup: adminProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
          format: z.enum(["json", "csv", "both"]),
          confirmed: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createBackupProcedure(input, ctx.user.id);
      }),

    getBackups: adminProcedure.query(async () => {
      return getBackupsProcedure();
    }),

    deleteBackup: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteBackupProcedure(input.id);
      }),

    archiveData: adminProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
          cleanupMode: z.enum(["archive", "delete"]),
          dryRun: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return archiveDataProcedure(input);
      }),

    getArchiveStats: adminProcedure.query(async () => {
      return getArchiveStatsProcedure();
    }),
  }),

  // ─── Trash & Data Protection ────────────────────────────────────────────
  trash: router({
    stats: adminProcedure.query(async () => {
      return getTrashStats();
    }),

    items: adminProcedure
      .input(z.object({ entityType: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return getTrashItems(input?.entityType);
      }),

    restore: adminProcedure
      .input(z.object({
        entityType: z.enum(["leads", "users", "campaigns", "activities", "deals", "internalNotes"]),
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const restoreMap: Record<string, (id: number) => Promise<void>> = {
          leads: restoreLead,
          users: restoreUser,
          campaigns: restoreCampaign,
          activities: restoreActivity,
          deals: restoreDeal,
          internalNotes: restoreInternalNote,
        };
        const fn = restoreMap[input.entityType];
        if (!fn) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid entity type" });
        await fn(input.id);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "restore",
          entityType: input.entityType,
          entityId: input.id,
        });
        return { success: true };
      }),

    permanentDelete: adminProcedure
      .input(z.object({
        entityType: z.enum(["leads", "users", "campaigns", "activities", "deals", "internalNotes"]),
        id: z.number(),
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify the special deletion password
        const DELETION_PASSWORD = "AY2001131ay**yearlyremovecrm";
        if (input.password !== DELETION_PASSWORD) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Incorrect deletion password" });
        }
        const result = await permanentDeleteEntity(input.entityType, input.id);
        if (!result.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.reason ?? "Cannot delete" });
        }
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "permanent_delete",
          entityType: input.entityType,
          entityId: input.id,
          details: { reason: "Password-verified permanent deletion" },
        });
        return { success: true };
      }),
  }),

  // ─── Audit Logs ─────────────────────────────────────────────────────────
  auditLogs: router({
    list: adminProcedure
      .input(z.object({
        entityType: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input }) => {
        return getAuditLogs({
          entityType: input?.entityType,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),


byLeadStageChanges: protectedProcedure
  .input(z.object({ leadId: z.number() }))
  .query(async ({ ctx, input }) => {
    if (ctx.user.role === "SalesAgent") {
      const lead = await getLeadById(input.leadId);
      if (!lead || lead.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
    }

    const db = await (await import("./db")).getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const { auditLogs } = await import("../drizzle/schema");

    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "leads"), eq(auditLogs.entityId, input.leadId)))
      .orderBy(desc(auditLogs.createdAt));

    return rows
      .map((row) => ({
        ...row,
        previousStage: getAuditStage(row.previousValue),
        newStage: getAuditStage(row.newValue),
      }))
      .filter((row) => row.previousStage || row.newStage)
      .reverse();
  }),

    undo: adminProcedure
      .input(z.object({ auditLogId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const log = await getAuditLogById(input.auditLogId);
        if (!log) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Audit log entry not found" });
        }
        if (!log.previousValue) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No previous value stored for this change - cannot undo" });
        }

        const { sql } = await import("drizzle-orm");
        const db = await (await import("./db")).getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

                // Build the update from previousValue
        const prev = typeof log.previousValue === "string" ? JSON.parse(log.previousValue) : log.previousValue;
        const entityType = log.entityType;
        const entityId = log.entityId;

        // Generic undo: update the entity with previous values using parameterized query
        const updateFields = Object.entries(prev)
          .filter(([key]) => key !== "id" && key !== "createdAt");

        if (updateFields.length > 0) {
          const setParts: string[] = [];
          for (const [key, value] of updateFields) {
            if (value === null) {
              setParts.push(key + " = NULL");
            } else if (typeof value === "string") {
              setParts.push(key + " = " + JSON.stringify(value).replace(/\\/g, "\\\\"));
            } else if (typeof value === "number" || typeof value === "boolean") {
              setParts.push(key + " = " + String(value));
            } else {
              setParts.push(key + " = " + JSON.stringify(JSON.stringify(value)));
            }
          }
          const setClause = setParts.join(", ");
          const query = "UPDATE " + entityType + " SET " + setClause + " WHERE id = " + entityId;
          await db.execute(sql.raw(query));
        }

        // Log the undo action
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "undo",
          entityType: entityType,
          entityId: entityId,
          entityName: log.entityName ?? undefined,
          details: { undoneAuditLogId: input.auditLogId, undoneAction: log.action },
          previousValue: log.newValue,
          newValue: log.previousValue,
        });

        // Notify all admins about the undo
        try {
          const allUsers = await getAllUsers();
          const admins = allUsers.filter((u: any) => u.role === "Admin" || u.role === "admin");
          for (const admin of admins) {
            if (admin.id !== ctx.user.id) {
              await createInAppNotification({
                userId: admin.id,
                type: "data_undo" as any,
                title: `Undo: ${log.action} on ${entityType} #${entityId}`,
                titleAr: `تراجع: ${log.action} على ${entityType} #${entityId}`,
                body: `${ctx.user.name} undid a ${log.action} action on ${entityType} "${log.entityName ?? entityId}"`,
                bodyAr: `${ctx.user.name} تراجع عن عملية ${log.action} على ${entityType} "${log.entityName ?? entityId}"`,
                link: null,
                metadata: { auditLogId: input.auditLogId },
              } as any);
            }
          }
        } catch (e) {
          console.error("[Undo] Failed to send notifications:", e);
        }

        return { success: true, message: "Change undone successfully" };
      }),
  }),

  // ─── Google Calendar ──────────────────────────────────────────────────
  calendar: router({
    list: protectedProcedure
      .input(z.object({
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        maxResults: z.number().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return listCalendarEvents({
          timeMin: input?.timeMin,
          timeMax: input?.timeMax,
          maxResults: input?.maxResults,
          search: input?.search,
        });
      }),

    get: protectedProcedure
      .input(z.object({ eventId: z.string() }))
      .query(async ({ input }) => {
        return getCalendarEvent(input.eventId);
      }),

    create: protectedProcedure
      .input(z.object({
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        startDateTime: z.string(),
        endDateTime: z.string(),
        attendees: z.array(z.string().email()).optional(),
        leadId: z.number().optional(),
        leadName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Include creator's email in attendees list (will be added to description, not as Google Calendar attendees)
        let attendees = input.attendees || [];
        if (ctx.user.email && !attendees.includes(ctx.user.email)) {
          attendees = [ctx.user.email, ...attendees];
        }
        // Add agent name to summary for visibility on shared calendar
        const agentName = ctx.user.name || "Unknown Agent";
        const summaryWithAgent = `${input.summary} [${agentName}]`;
        const result = await createCalendarEvent({
          ...input,
          summary: summaryWithAgent,
          attendees,
          agentName,
        });
        // Log the calendar event creation
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "calendar_event_created",
          entityType: "calendar",
          entityId: 0,
          details: { eventId: result.id, summary: input.summary, leadId: input.leadId },
        });
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        eventId: z.string(),
        summary: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        startDateTime: z.string().optional(),
        endDateTime: z.string().optional(),
        attendees: z.array(z.string().email()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { eventId, ...updateData } = input;
        const result = await updateCalendarEvent(eventId, updateData);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "calendar_event_updated",
          entityType: "calendar",
          entityId: 0,
          details: { eventId, summary: input.summary },
        });
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ eventId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCalendarEvent(input.eventId);
        await createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name,
          userRole: ctx.user.role,
          action: "calendar_event_deleted",
          entityType: "calendar",
          entityId: 0,
          details: { eventId: input.eventId },
        });
        return { success: true };
      }),

    freeBusy: protectedProcedure
      .input(z.object({
        timeMin: z.string(),
        timeMax: z.string(),
      }))
      .query(async ({ input }) => {
        return getFreeBusy(input.timeMin, input.timeMax);
      }),
  }),


  // ─── In-App Notifications ──────────────────────────────────────────────
  inAppNotifications: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(30),
        offset: z.number().min(0).default(0),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return getInAppNotifications(ctx.user.id, input?.limit ?? 30, input?.offset ?? 0, input?.dateFrom, input?.dateTo);
      }),

    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return getUnreadNotificationCount(ctx.user.id);
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationRead(input.id, ctx.user.id);
        return { success: true };
      }),

    markAllRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await markAllNotificationsRead(ctx.user.id);
        return { success: true };
      }),

    create: adminProcedure
      .input(z.object({
        userId: z.number(),
        type: z.enum(["meeting_reminder", "lead_assigned", "sla_breach", "lead_transfer", "mention", "system"]).default("system"),
        title: z.string(),
        titleAr: z.string().optional(),
        body: z.string().optional(),
        bodyAr: z.string().optional(),
        link: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createInAppNotification({
          userId: input.userId,
          type: input.type,
          title: input.title,
          titleAr: input.titleAr ?? null,
          body: input.body ?? null,
          bodyAr: input.bodyAr ?? null,
          link: input.link ?? null,
          isRead: false,
        });
        return { id };
      }),
  }),


  // ─── Meeting Notification Config ────────────────────────────────────────
  meetingNotificationConfig: router({
    get: protectedProcedure
      .query(async () => {
        const config = await getMeetingNotificationConfig();
        return config ? {
          reminderMinutes: config.reminderMinutes as number[],
          repeatCount: config.repeatCount,
          soundEnabled: !!config.soundEnabled,
          popupEnabled: !!config.popupEnabled,
          autoCalendarForMeeting: !!config.autoCalendarForMeeting,
          autoCalendarForCall: !!config.autoCalendarForCall,
        } : {
          reminderMinutes: [30, 10],
          repeatCount: 1,
          soundEnabled: true,
          popupEnabled: true,
          autoCalendarForMeeting: true,
          autoCalendarForCall: true,
        };
      }),

    update: adminProcedure
      .input(z.object({
        reminderMinutes: z.array(z.number().int().min(1).max(120)).optional(),
        repeatCount: z.number().int().min(1).max(10).optional(),
        soundEnabled: z.boolean().optional(),
        popupEnabled: z.boolean().optional(),
        autoCalendarForMeeting: z.boolean().optional(),
        autoCalendarForCall: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateMeetingNotificationConfig(input);
        return { success: true };
      }),
  }),

  // ─── Account Management ─────────────────────────────────────────────────
  accountManagement: router({
    listClients: accountManagerProcedure
      .input(z.object({
        planStatus: z.string().optional(),
        renewalStatus: z.string().optional(),
        accountManagerId: z.number().optional(),
        search: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input, ctx }) => {
        return getClients({
          ...input,
          userRole: ctx.user.role,
          userId: ctx.user.id,
        });
      }),

    getClient: accountManagerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getClientById(input.id);
      }),

    getClientProfile: accountManagerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const data = await getClientProfileById(input.id);
        if (ctx.user.role === "AccountManager" && data.client.accountManagerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return data;
      }),

    createClient: accountManagerProcedure
      .input(z.object({
        leadId: z.number().optional().nullable(),
        dealId: z.number().optional().nullable(),
        businessProfile: z.string().optional(),
        group: z.string().optional(),
        planStatus: z.enum(["Active", "Paused", "Cancelled", "Pending"]).default("Active"),
        renewalStatus: z.enum(["Renewed", "Pending", "Expired", "Cancelled"]).default("Pending"),
        accountManagerId: z.number().optional().nullable(),
        competentPerson: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        leadName: z.string().optional(),
        phone: z.string().optional(),
        otherPhones: z.string().optional(),
        contractLink: z.string().optional(),
        marketingObjective: z.string().optional(),
        servicesNeeded: z.string().optional(),
        socialMedia: z.string().optional(),
        feedback: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createClient(input as any);
        return { id };
      }),

    updateClient: accountManagerProcedure
      .input(z.object({
        id: z.number(),
        businessProfile: z.string().optional(),
        group: z.string().optional(),
        planStatus: z.enum(["Active", "Paused", "Cancelled", "Pending"]).optional(),
        renewalStatus: z.enum(["Renewed", "Pending", "Expired", "Cancelled"]).optional(),
        accountManagerId: z.number().optional().nullable(),
        competentPerson: z.string().optional().nullable(),
        contactEmail: z.string().optional().nullable(),
        contactPhone: z.string().optional().nullable(),
        leadName: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        otherPhones: z.string().optional().nullable(),
        contractLink: z.string().optional().nullable(),
        marketingObjective: z.string().optional(),
        servicesNeeded: z.string().optional(),
        socialMedia: z.string().optional(),
        feedback: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateClient(id, data as any);
        return { success: true };
      }),

    deleteClient: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteClient(input.id, ctx.user.id);
        return { success: true };
      }),

    listAccountManagers: accountManagerProcedure
      .query(async () => {
        return listAccountManagers();
      }),

    // Contracts
    getContracts: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return getContractsByClient(input.clientId);
      }),

    createContract: accountManagerProcedure
      .input(z.object({
        clientId: z.number(),
        packageId: z.number().optional().nullable(),
        contractName: z.string().optional(),
        contractFile: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        period: z.string().optional(),
        charges: z.string().optional(),
        currency: z.string().optional(),
        monthlyCharges: z.string().optional(),
        status: z.enum(["Active", "Expired", "Cancelled", "PendingRenewal"]).default("Active"),
        contractRenewalStatus: z.enum(["New", "Negotiation", "SentOffer", "Won", "Lost", "Renewed", "NotRenewed"]).optional(),
        renewalAssignedTo: z.number().optional().nullable(),
        priceOffer: z.string().optional(),
        upselling: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const contractData: any = { ...input };
        if (input.startDate) contractData.startDate = new Date(input.startDate);
        if (input.endDate) contractData.endDate = new Date(input.endDate);
        // Fix: remove null/empty packageId and renewalAssignedTo to avoid DB insert errors
        if (contractData.packageId === null || contractData.packageId === undefined) delete contractData.packageId;
        if (contractData.renewalAssignedTo === null || contractData.renewalAssignedTo === undefined) delete contractData.renewalAssignedTo;
        const id = await createContract(contractData);
        return { id };
      }),

    updateContract: accountManagerProcedure
      .input(z.object({
        id: z.number(),
        contractName: z.string().optional(),
        contractFile: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        period: z.string().optional(),
        charges: z.string().optional(),
        currency: z.string().optional(),
        monthlyCharges: z.string().optional(),
        status: z.enum(["Active", "Expired", "Cancelled", "PendingRenewal"]).optional(),
        contractRenewalStatus: z.enum(["New", "Negotiation", "SentOffer", "Won", "Lost", "Renewed", "NotRenewed"]).optional(),
        renewalAssignedTo: z.number().optional().nullable(),
        priceOffer: z.string().optional(),
        upselling: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const contractData: any = { ...data };
        if (data.startDate) contractData.startDate = new Date(data.startDate);
        if (data.endDate) contractData.endDate = new Date(data.endDate);
        // Fix: remove undefined packageId and renewalAssignedTo to avoid DB update errors
        if (contractData.packageId === undefined) delete contractData.packageId;
        if (contractData.renewalAssignedTo === undefined) delete contractData.renewalAssignedTo;
        await updateContract(id, contractData);
        return { success: true };
      }),

    // Service Packages
    listPackages: accountManagerProcedure
      .query(async () => {
        return getServicePackages();
      }),

    createPackage: adminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        price: z.string().optional(),
        period: z.string().optional(),
        services: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createServicePackage(input as any);
        return { id };
      }),
  }),

  // ─── Phase 3: Follow-ups ──────────────────────────────────────────────
  followUps: router({
    list: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input, ctx }) => {
        // RBAC: AccountManager can only see their own clients
        if (ctx.user.role === "AccountManager") {
          const client = await getClientProfileById(input.clientId);
          if (client.client.accountManagerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        return getFollowUps(input.clientId);
      }),

    create: accountManagerProcedure
      .input(z.object({
        clientId: z.number(),
        type: z.enum(["Call", "Meeting", "WhatsApp", "Email"]),
        followUpDate: z.string(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role === "AccountManager") {
          const client = await getClientProfileById(input.clientId);
          if (client.client.accountManagerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        await createFollowUp({
          clientId: input.clientId,
          userId: ctx.user.id,
          type: input.type,
          followUpDate: new Date(input.followUpDate),
          notes: input.notes ?? null,
          status: "Pending",
        });

        // ── Auto-create calendar event for Meeting/Call follow-ups ──
        if (input.type === "Meeting" || input.type === "Call") {
          try {
            const config = await getMeetingNotificationConfig();
            const shouldCreate = input.type === "Meeting"
              ? (config?.autoCalendarForMeeting ?? true)
              : (config?.autoCalendarForCall ?? true);
            if (shouldCreate) {
              const client = await getClientProfileById(input.clientId);
              const clientName = client?.client?.companyName || `Client #${input.clientId}`;
              const startTime = new Date(input.followUpDate);
              const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour default
              // Check free/busy
              const busy = await getFreeBusy(startTime.toISOString(), endTime.toISOString());
              const isAgentBusy = busy.some((slot: any) => {
                const slotStart = new Date(slot.start).getTime();
                const slotEnd = new Date(slot.end).getTime();
                return startTime.getTime() < slotEnd && endTime.getTime() > slotStart;
              });
              if (!isAgentBusy) {
                const attendees: string[] = [];
                if (ctx.user.email) attendees.push(ctx.user.email);
                const agentDisplayName = ctx.user.name || "Unknown";
                const summary = input.type === "Meeting"
                  ? `[Meeting] متابعة: ${clientName} [${agentDisplayName}]`
                  : `[Call] متابعة: ${clientName} [${agentDisplayName}]`;
                await createCalendarEvent({
                  summary,
                  description: input.notes || "",
                  startDateTime: startTime.toISOString(),
                  endDateTime: endTime.toISOString(),
                  attendees,
                  leadId: input.clientId,
                  leadName: clientName,
                  agentName: agentDisplayName,
                });
                console.log(`[AutoCalendar] Created follow-up ${input.type} event for client ${clientName}`);
              } else {
                console.log(`[AutoCalendar] Agent busy at ${startTime.toISOString()}, skipping follow-up calendar event`);
              }
            }
          } catch (err) {
            console.error("[AutoCalendar] Error creating follow-up calendar event:", err);
          }
        }
        return { success: true };
      }),

    complete: accountManagerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const meta = await getFollowUpMeta(input.id);
        if (ctx.user.role === "AccountManager") {
          const client = await getClientProfileById(meta.clientId);
          if (client.client.accountManagerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        await completeFollowUp(input.id);
        return { success: true };
      }),
  }),

  // ─── Phase 3: Client Tasks ─────────────────────────────────────────────
  clientTasks: router({
    list: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role === "AccountManager") {
          const client = await getClientProfileById(input.clientId);
          if (client.client.accountManagerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        return getClientTasks(input.clientId);
      }),

    create: accountManagerProcedure
      .input(z.object({
        clientId: z.number(),
        title: z.string().min(1),
        assignedTo: z.number().optional().nullable(),
        dueDate: z.string().optional().nullable(),
        priority: z.enum(["Low", "Medium", "High"]).optional(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role === "AccountManager") {
          const client = await getClientProfileById(input.clientId);
          if (client.client.accountManagerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        await createClientTask({
          clientId: input.clientId,
          title: input.title,
          assignedTo: input.assignedTo ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          priority: input.priority ?? "Medium",
          status: "ToDo",
          notes: input.notes ?? null,
          createdBy: ctx.user.id,
        });
        return { success: true };
      }),

    update: accountManagerProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          title: z.string().optional(),
          assignedTo: z.number().optional().nullable(),
          dueDate: z.string().optional().nullable(),
          priority: z.enum(["Low", "Medium", "High"]).optional(),
          status: z.enum(["ToDo", "InProgress", "Done", "Cancelled"]).optional(),
          notes: z.string().optional().nullable(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const meta = await getClientTaskMeta(input.id);
        if (ctx.user.role === "AccountManager") {
          const client = await getClientProfileById(meta.clientId);
          if (client.client.accountManagerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        const patch: any = { ...input.data };
        if (patch.dueDate) patch.dueDate = new Date(patch.dueDate);
        await updateClientTask(input.id, patch);
        return { success: true };
      }),
  }),

  // ─── Phase 3: Onboarding ───────────────────────────────────────────────
  onboarding: router({
    getItems: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role === "AccountManager") {
          const client = await getClientProfileById(input.clientId);
          if (client.client.accountManagerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        return getOnboardingItems(input.clientId);
      }),

    updateItem: accountManagerProcedure
      .input(z.object({ id: z.number(), isChecked: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const meta = await getOnboardingItemMeta(input.id);
        if (ctx.user.role === "AccountManager") {
          const client = await getClientProfileById(meta.clientId);
          if (client.client.accountManagerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        await updateOnboardingItem(input.id, input.isChecked);
        return { success: true };
      }),

    initialize: accountManagerProcedure
      .input(z.object({ clientId: z.number(), checklistId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role === "AccountManager") {
          const client = await getClientProfileById(input.clientId);
          if (client.client.accountManagerId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
          }
        }
        await initializeOnboarding(input.clientId, input.checklistId);
        return { success: true };
      }),
  }),

  // ─── Phase 3: Users list (for task assignment) ─────────────────────────
  usersList: router({
    list: accountManagerProcedure.query(async () => {
      return listAllUsers();
    }),
  }),

  // ─── Renewals Pipeline ──────────────────────────────────────────────────
  renewals: router({
    list: accountManagerProcedure.query(async ({ ctx }) => {
      const rows = await getRenewals();
      if (ctx.user.role === "AccountManager") {
        return rows.filter((r) => r.accountManagerId === ctx.user.id);
      }
      return rows;
    }),

    updateStage: accountManagerProcedure
      .input(z.object({
        contractId: z.number(),
        stage: z.enum(["New", "Negotiation", "SentOffer", "Won", "Lost", "Renewed", "NotRenewed"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const contract = await getContractById(input.contractId);
        if (ctx.user.role === "AccountManager" && contract.accountManagerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        await updateRenewalStage(input.contractId, input.stage);
        return { success: true };
      }),
  }),

  // ─── Phase 4: AM Dashboards ─────────────────────────────────────────────
  amDashboard: router({
    getStats: accountManagerProcedure.query(async ({ ctx }) => {
      return getAMDashboardStats(ctx.user.id, ctx.user.role);
    }),
    getLeadStats: protectedProcedure.query(async ({ ctx }) => {
      if (!["AccountManagerLead", "Admin"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return getAMLeadDashboardStats();
    }),
    recalcHealthScores: adminProcedure.mutation(async () => {
      return updateAllHealthScores();
    }),
    calcHealthScore: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ input }) => {
        return calculateHealthScore(input.clientId);
      }),
  }),

  // ─── Phase 4: OKRs (Objectives & Key Results) ─────────────────────────
  objectives: router({
    list: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return getObjectives(input.clientId);
      }),
    create: accountManagerProcedure
      .input(z.object({
        clientId: z.number(),
        title: z.string().min(1).max(255),
        status: z.enum(["OnTrack", "AtRisk", "OffTrack"]).default("OnTrack"),
      }))
      .mutation(async ({ input }) => {
        return createObjective({ clientId: input.clientId, title: input.title, status: input.status });
      }),
    createKeyResult: accountManagerProcedure
      .input(z.object({
        objectiveId: z.number(),
        title: z.string().min(1).max(255),
        targetValue: z.number().nonnegative().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        return createKeyResult({
          objectiveId: input.objectiveId,
          title: input.title,
          targetValue: input.targetValue ?? null,
        });
      }),
    updateKeyResult: accountManagerProcedure
      .input(z.object({ id: z.number(), currentValue: z.number().nonnegative() }))
      .mutation(async ({ input }) => {
        return updateKeyResult(input.id, input.currentValue);
      }),
  }),

  // ─── Phase 5: Deliverables ────────────────────────────────────────────
  deliverables: router({
    list: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return getDeliverables(input.clientId);
      }),
    create: accountManagerProcedure
      .input(z.object({
        clientId: z.number(),
        contractId: z.number().nullable().optional(),
        name: z.string().min(1).max(255),
        description: z.string().nullable().optional(),
        status: z.enum(["Pending", "InProgress", "Delivered", "Approved", "Rejected"]).default("Pending"),
        dueDate: z.string().optional().nullable(),
        assignedTo: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        return createDeliverable({
          clientId: input.clientId,
          contractId: input.contractId ?? null,
          name: input.name,
          description: input.description ?? null,
          status: input.status,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          assignedTo: input.assignedTo ?? null,
        });
      }),
    update: accountManagerProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          name: z.string().optional(),
          description: z.string().nullable().optional(),
          status: z.enum(["Pending", "InProgress", "Delivered", "Approved", "Rejected"]).optional(),
          dueDate: z.string().nullable().optional(),
          assignedTo: z.number().nullable().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const patch: any = { ...input.data };
        if (patch.dueDate) patch.dueDate = new Date(patch.dueDate);
        return updateDeliverable(input.id, patch);
      }),
  }),

  // ─── Phase 5: Upsell Opportunities ────────────────────────────────────
  upsell: router({
    list: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return getUpsellOpportunities(input.clientId);
      }),
    create: accountManagerProcedure
      .input(z.object({
        clientId: z.number(),
        servicePackageId: z.number().nullable().optional(),
        title: z.string().min(1).max(255),
        potentialValue: z.string().nullable().optional(),
        status: z.enum(["Prospecting", "ProposalSent", "Negotiation", "Won", "Lost"]).default("Prospecting"),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return createUpsellOpportunity({
          clientId: input.clientId,
          servicePackageId: input.servicePackageId ?? null,
          title: input.title,
          potentialValue: input.potentialValue ?? null,
          status: input.status,
          notes: input.notes ?? null,
          createdBy: ctx.user.id,
        });
      }),
    update: accountManagerProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          title: z.string().optional(),
          potentialValue: z.string().nullable().optional(),
          status: z.enum(["Prospecting", "ProposalSent", "Negotiation", "Won", "Lost"]).optional(),
          notes: z.string().nullable().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        return updateUpsellOpportunity(input.id, input.data);
      }),
  }),

  // ─── Phase 5: Client Communications ───────────────────────────────────
  communications: router({
    list: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return getClientCommunications(input.clientId);
      }),
    create: accountManagerProcedure
      .input(z.object({
        clientId: z.number(),
        channelName: z.string().min(1).max(100),
        channelType: z.enum(["EmailThread", "WhatsAppGroup", "SlackChannel", "Other"]),
        link: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        return createClientCommunication({
          clientId: input.clientId,
          channelName: input.channelName,
          channelType: input.channelType,
          link: input.link ?? null,
          notes: input.notes ?? null,
        });
      }),
  }),

  // ─── Phase 5: CSAT Surveys ────────────────────────────────────────────
  // ─── Lead Reminders ────────────────────────────────────────────────────
  leadReminders: router({
    getByLead: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ input }) => {
        return getLeadReminders(input.leadId);
      }),
    getByUser: protectedProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return getRemindersByUser(ctx.user.id, input?.dateFrom, input?.dateTo);
      }),
    getToday: protectedProcedure
      .query(async ({ ctx }) => {
        return getTodayReminders(ctx.user.id);
      }),
    getCalendar: protectedProcedure
      .input(z.object({ month: z.number().min(1).max(12), year: z.number() }))
      .query(async ({ ctx, input }) => {
        return getRemindersForCalendar(ctx.user.id, input.month, input.year);
      }),
    create: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        reminderDate: z.string(),
        reminderTime: z.string().optional(),
        priority: z.enum(["Low", "Medium", "High"]).optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createLeadReminder({
          leadId: input.leadId,
          userId: ctx.user.id,
          title: input.title,
          description: input.description ?? null,
          reminderDate: new Date(input.reminderDate),
          reminderTime: input.reminderTime,
          priority: input.priority,
          color: input.color,
        });
        return { id };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        reminderDate: z.string().optional(),
        reminderTime: z.string().optional(),
        priority: z.enum(["Low", "Medium", "High"]).optional(),
        status: z.enum(["Pending", "Done", "Cancelled"]).optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateLeadReminder(input.id, {
          title: input.title,
          description: input.description,
          reminderDate: input.reminderDate ? new Date(input.reminderDate) : undefined,
          reminderTime: input.reminderTime,
          priority: input.priority,
          status: input.status,
          color: input.color,
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteLeadReminder(input.id);
        return { success: true };
      }),
    markDone: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateLeadReminder(input.id, { status: "Done" });
        return { success: true };
      }),
  }),
  csat: router({
    submit: publicProcedure
      .input(z.object({
        clientId: z.number(),
        contractId: z.number().nullable().optional(),
        score: z.number().int().min(1).max(5),
        feedback: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        return submitCSAT({
          clientId: input.clientId,
          contractId: input.contractId ?? null,
          score: input.score,
          feedback: input.feedback ?? null,
        });
      }),
    getScores: accountManagerProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return getCSATScores(input.clientId);
      }),
  }),


  // ─── Notification Preferences (per-user) ──────────────────────────────────
  notificationPreferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserNotificationPreferences(ctx.user.id);
    }),

    update: protectedProcedure
      .input(z.object({
        preferences: z.array(z.object({
          notificationType: z.string(),
          soundEnabled: z.boolean(),
          popupEnabled: z.boolean(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        await bulkUpsertUserNotificationPreferences(ctx.user.id, input.preferences);
        return { success: true };
      }),

    getSoundConfig: protectedProcedure.query(async () => {
      return getNotificationSoundConfig();
    }),

    uploadSound: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admin@tamiyouz.com (user ID 1) can upload sound files
        if (ctx.user.id !== 1) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the primary admin can upload notification sounds" });
        }
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `notification-sounds/${Date.now()}-${input.fileName}`;
        const result = await storagePut(key, buffer, input.contentType);
        await updateNotificationSoundConfig(result.url, input.fileName, ctx.user.id);
        return { url: result.url, fileName: input.fileName };
      }),

    removeSound: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.id !== 1) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the primary admin can manage notification sounds" });
        }
        await updateNotificationSoundConfig(null, null, ctx.user.id);
        return { success: true };
      }),
  }),
// ─── Meta Ads Integration ──────────────────────────────────────────────────
  metaCombined: router({    getAnalytics: mediaBuyerOrAdminProcedure      .input(z.object({        dateFrom: z.string().optional(),        dateTo: z.string().optional(),        campaignIds: z.array(z.number()).optional(),        minSpend: z.number().optional(),        datePreset: z.string().optional().default("last_30d"),      }))      .query(async ({ input }) => {        return getMetaCombinedAnalytics({          dateFrom: input.dateFrom,          dateTo: input.dateTo,          campaignIds: input.campaignIds,          minSpend: input.minSpend,          datePreset: input.datePreset,        });      }),  }),
  meta: router({
    // Get integration config
    getIntegration: protectedProcedure
      .query(async () => {
        return getMetaIntegration();
      }),

    // Save/update integration config (app id + secret)
    upsertIntegration: mediaBuyerOrAdminProcedure
      .input(z.object({
        appId: z.string().min(1),
        appSecret: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const id = await upsertMetaIntegration(input.appId, input.appSecret);
        return { id };
      }),

    // Delete integration and all related data
    deleteIntegration: adminProcedure
      .mutation(async () => {
        await deleteMetaIntegrationFn();
        return { success: true };
      }),

    // List all ad accounts
    getAdAccounts: protectedProcedure
      .query(async () => {
        return getMetaAdAccounts();
      }),

    // Get active ad account
    getActiveAdAccount: protectedProcedure
      .query(async () => {
        return getActiveMetaAdAccount();
      }),

    // Add a new ad account
    addAdAccount: mediaBuyerOrAdminProcedure
      .input(z.object({
        adAccountId: z.string().min(1),
        accountName: z.string().optional().default(""),
        accessToken: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const integration = await getMetaIntegration();
        if (!integration) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Meta integration not configured. Please set App ID and App Secret first." });
        }
        // Try to fetch account info to validate
        try {
          const actId = input.adAccountId.startsWith("act_") ? input.adAccountId : `act_${input.adAccountId}`;
          const info = await fetchAdAccountInfoFn(actId, input.accessToken);
          const name = input.accountName || info.name || actId;
          const id = await addMetaAdAccount(integration.id, input.adAccountId, name, input.accessToken);
          return { id, name };
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Failed to validate ad account: ${err.message}` });
        }
      }),

    // Select/switch active ad account
    selectAdAccount: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        await selectMetaAdAccount(input.accountId);
        return { success: true };
      }),

    // Update ad account access token
    updateAdAccountToken: adminProcedure
      .input(z.object({
        accountId: z.number(),
        accessToken: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        await updateMetaAdAccountToken(input.accountId, input.accessToken);
        return { success: true };
      }),

    // Delete an ad account
    deleteAdAccount: adminProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteMetaAdAccountFn(input.accountId);
        return { success: true };
      }),

    // Get campaign snapshots for active account
    getCampaigns: protectedProcedure
      .query(async () => {
        return getActiveMetaCampaignSnapshots();
      }),

    // Sync campaigns from Meta API
    syncCampaigns: mediaBuyerOrAdminProcedure
      .mutation(async () => {
        const active = await getActiveMetaAdAccount();
        if (!active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No active ad account selected" });
        }
        const count = await syncMetaCampaigns(active.id);
        return { synced: count };
      }),

    // Change campaign status (ACTIVE/PAUSED)
    changeCampaignStatus: mediaBuyerOrAdminProcedure
      .input(z.object({
        snapshotId: z.number(),
        newStatus: z.enum(["ACTIVE", "PAUSED"]),
      }))
      .mutation(async ({ input }) => {
        return changeMetaCampaignStatus(input.snapshotId, input.newStatus);
      }),

    // Change campaign budget
    changeBudget: mediaBuyerOrAdminProcedure
      .input(z.object({
        snapshotId: z.number(),
        budgetType: z.enum(["daily", "lifetime"]),
        amount: z.number().positive(),
      }))
      .mutation(async ({ input }) => {
        return changeMetaCampaignBudget(input.snapshotId, input.budgetType, input.amount);
      }),

    // Get campaign insights/metrics
    getInsights: mediaBuyerOrAdminProcedure
      .input(z.object({
        datePreset: z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month", "last_month"]).optional().default("last_30d"),
      }))
      .query(async ({ input }) => {
        const active = await getActiveMetaAdAccount();
        if (!active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No active ad account selected" });
        }
        return fetchAllMetaCampaignInsights(active.id, input.datePreset);
      }),

    // ─── Meta Leadgen Webhook Integration ──────────────────────────────────────
    leadgen: router({
      getConfigs: protectedProcedure.query(async () => {
        return MetaLeadgenService.getLeadgenConfigs();
      }),

      getStats: protectedProcedure.query(async () => {
        return MetaLeadgenService.getLeadgenStats();
      }),

      upsertConfig: mediaBuyerOrAdminProcedure
        .input(z.object({
          id: z.number().optional(),
          pageId: z.string().min(1),
          pageName: z.string().optional().nullable(),
          pageAccessToken: z.string().min(1),
          isEnabled: z.union([z.boolean(), z.number()]).optional(),
          assignmentRule: z.enum(["round_robin", "fixed_owner", "by_campaign"]).optional(),
          fixedOwnerId: z.number().optional().nullable(),
          fieldMapping: z.record(z.string()).optional().nullable(),
        }))
        .mutation(async ({ input }) => {
          return MetaLeadgenService.upsertLeadgenConfig(input);
        }),

      deleteConfig: mediaBuyerOrAdminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          return MetaLeadgenService.deleteLeadgenConfig(input.id);
        }),

      testConnection: mediaBuyerOrAdminProcedure
        .input(z.object({
          pageId: z.string().min(1),
          accessToken: z.string().min(1),
        }))
        .mutation(async ({ input }) => {
          return MetaLeadgenService.testPageConnection(input.pageId, input.accessToken);
        }),

      subscribeWebhook: mediaBuyerOrAdminProcedure
        .input(z.object({
          pageId: z.string().min(1),
          accessToken: z.string().min(1),
        }))
        .mutation(async ({ input }) => {
          return MetaLeadgenService.subscribePageWebhook(input.pageId, input.accessToken);
        }),

      getForms: mediaBuyerOrAdminProcedure
        .input(z.object({
          pageId: z.string().min(1),
          accessToken: z.string().min(1),
        }))
        .query(async ({ input }) => {
          return MetaLeadgenService.fetchLeadgenForms(input.pageId, input.accessToken);
        }),
    }),
  }),
  tiktok: router({
    campaigns: router({
      getAnalytics: mediaBuyerOrAdminProcedure
        .input(z.object({
          dateFrom: z.string().min(1),
          dateTo: z.string().min(1),
          minSpend: z.number().optional(),
          maxSpend: z.number().optional(),
          status: z.array(z.string()).optional(),
          objectives: z.array(z.string()).optional(),
        }))
        .query(async ({ input }) => {
          return getTikTokCampaignAnalytics(input);
        }),
    }),
    settings: router({
      getIntegration: mediaBuyerOrAdminProcedure
        .query(async () => getTikTokIntegration()),
      upsertIntegration: mediaBuyerOrAdminProcedure
        .input(z.object({ appId: z.string().min(1), appSecret: z.string().min(1) }))
        .mutation(async ({ input }) => {
          const id = await upsertTikTokIntegration(input.appId, input.appSecret);
          return { id };
        }),
      deleteIntegration: mediaBuyerOrAdminProcedure
        .mutation(async () => { await deleteTikTokIntegration(); return { success: true }; }),
      getAdAccounts: mediaBuyerOrAdminProcedure
        .query(async () => getTikTokAdAccounts()),
      addAdAccount: mediaBuyerOrAdminProcedure
        .input(z.object({ advertiserId: z.string().min(1), accountName: z.string().optional().default(""), accessToken: z.string().min(1) }))
        .mutation(async ({ input }) => {
          const integration = await getTikTokIntegration();
          if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "TikTok integration not configured" });
          return addTikTokAdAccount(integration.id, input.advertiserId, input.accountName, input.accessToken);
        }),
      selectAdAccount: mediaBuyerOrAdminProcedure
        .input(z.object({ accountId: z.number() }))
        .mutation(async ({ input }) => { await selectTikTokAdAccount(input.accountId); return { success: true }; }),
      updateToken: mediaBuyerOrAdminProcedure
        .input(z.object({ accountId: z.number(), accessToken: z.string().min(1) }))
        .mutation(async ({ input }) => { await updateTikTokAdAccountToken(input.accountId, input.accessToken); return { success: true }; }),
      deleteAdAccount: mediaBuyerOrAdminProcedure
        .input(z.object({ accountId: z.number() }))
        .mutation(async ({ input }) => { await deleteTikTokAdAccount(input.accountId); return { success: true }; }),
      syncCampaigns: mediaBuyerOrAdminProcedure
        .mutation(async () => {
          const account = await getActiveTikTokAdAccount();
          if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "No active TikTok ad account" });
          const synced = await syncTikTokCampaigns(account.id);
          return { synced };
        }),
    }),
  }),
  rakan: rakanRouter,
});
export type AppRouter = typeof appRouter;

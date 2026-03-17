import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import {
  rakanChat,
  getRakanSetting,
  upsertRakanSetting,
  getAllGlobalSettings,
  getUserRakanSettings,
  getChatHistory,
  clearChatHistory,
  type UserRole,
} from "./services/rakanService";

// ─── Rakan Router ──────────────────────────────────────────────────────────────
export const rakanRouter = router({

  // ── Send message to Rakan ──────────────────────────────────────────────────
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      ttsVoice: z.enum(["ar_formal", "ar_egyptian", "ar_gulf", "en", "none"]).default("ar_formal"),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = ctx.user;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Check if Rakan is enabled
      const enabled = await getRakanSetting("rakan_enabled");
      if (enabled === "false") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Rakan is currently disabled." });
      }

      try {
        const result = await rakanChat(
          user.id,
          user.role as UserRole,
          user.name ?? "مستخدم",
          input.message,
          input.ttsVoice
        );
        return result;
      } catch (err: any) {
        console.error("[Rakan ERROR]", err?.message, err?.stack?.slice(0,500));
        if (err.message?.includes("API key not configured")) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Rakan encountered an error. Please try again." });
      }
    }),

  // ── Get chat history ───────────────────────────────────────────────────────
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }))
    .query(async ({ ctx, input }) => {
      const user = ctx.user;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getChatHistory(user.id, input.limit);
    }),

  // ── Clear chat history ─────────────────────────────────────────────────────
  clearHistory: protectedProcedure
    .mutation(async ({ ctx }) => {
      const user = ctx.user;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await clearChatHistory(user.id);
      return { success: true };
    }),

  // ── Get global settings (Admin: all including API keys; others: non-sensitive) ──
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const global = await getAllGlobalSettings();
      const userSettings = await getUserRakanSettings(user.id);

      const isAdmin = user.role === "Admin";

      // Non-admin: hide API keys and instructions
      const safeGlobal = isAdmin ? global : Object.fromEntries(
        Object.entries(global).filter(([k]) =>
          !["gemini_api_key", "google_tts_api_key", "rakan_instructions"].includes(k)
        )
      );

      return {
        global: safeGlobal,
        user: userSettings,
        isAdmin,
      };
    }),

  // ── Update global settings (Admin only for API keys & instructions) ────────
  updateGlobalSetting: protectedProcedure
    .input(z.object({
      key: z.string().min(1),
      value: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Only Admin can update API keys and instructions
      const adminOnlyKeys = ["gemini_api_key", "google_tts_api_key", "rakan_instructions"];
      if (adminOnlyKeys.includes(input.key) && user.role !== "Admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update this setting." });
      }

      // Prevent non-admins from updating rakan_enabled globally
      if (input.key === "rakan_enabled" && user.role !== "Admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can enable/disable Rakan globally." });
      }

      await upsertRakanSetting(input.key, input.value, null);
      return { success: true };
    }),

  // ── Update user-specific settings (any user for their own preferences) ─────
  updateUserSetting: protectedProcedure
    .input(z.object({
      key: z.enum(["tts_voice_preference", "tts_enabled", "rakan_language"]),
      value: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      await upsertRakanSetting(input.key, input.value, user.id);
      return { success: true };
    }),

  // ── Get user's own preferences ─────────────────────────────────────────────
  getMyPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const prefs = await getUserRakanSettings(user.id);
      return {
        ttsVoicePreference: prefs["tts_voice_preference"] ?? "ar_formal",
        ttsEnabled: prefs["tts_enabled"] ?? "true",
        rakanLanguage: prefs["rakan_language"] ?? "auto",
      };
    }),
});

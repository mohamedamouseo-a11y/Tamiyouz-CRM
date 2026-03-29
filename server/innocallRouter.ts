import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getInnoCallSettings,
  updateInnoCallSettings,
} from "./services/innocallService";
const innocallSettingsSchema = z.object({
  innocall_api_key: z.string().default(""),
  innocall_extension: z.string().default(""),
  innocall_webrtc_secret: z.string().default(""),
  innocall_base_color: z.string().default("#6366f1"),
  innocall_enabled: z.boolean().default(false),
  innocall_script_url: z.string().default(""),
});
function assertAdmin(ctx: any) {
  const role = ctx?.user?.role;
  if (!role || (role !== "Admin" && role !== "admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only Admin can manage InnoCall settings.",
    });
  }
}
export const innocallRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    return await getInnoCallSettings();
  }),
  updateSettings: protectedProcedure
    .input(innocallSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      return await updateInnoCallSettings(input);
    }),
  isEnabled: protectedProcedure.query(async () => {
    const settings = await getInnoCallSettings();
    return { enabled: settings.innocall_enabled };
  }),
  // Public config endpoint for the InnoCallProvider to read settings
  getConfig: protectedProcedure.query(async () => {
    const settings = await getInnoCallSettings();
    if (!settings.innocall_enabled) {
      return {
        enabled: false,
        apiKey: "",
        extension: "",
        webrtcSecret: "",
        baseColor: "#6366f1",
        scriptUrl: "",
      };
    }
    return {
      enabled: true,
      apiKey: settings.innocall_api_key,
      extension: settings.innocall_extension,
      webrtcSecret: settings.innocall_webrtc_secret,
      baseColor: settings.innocall_base_color,
      scriptUrl: settings.innocall_script_url,
    };
  }),
});

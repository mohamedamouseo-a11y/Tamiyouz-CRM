import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "./_core/trpc";
import {
  createTamaraCheckoutSession,
  getTamaraSettings,
  updateTamaraSettings,
} from "./services/tamaraService";

const tamaraSettingsSchema = z.object({
  tamara_api_token: z.string().default(""),
  tamara_public_key: z.string().default(""),
  tamara_notification_token: z.string().default(""),
  tamara_merchant_id: z.string().default(""),
  tamara_enabled: z.boolean().default(false),
});

function assertAdmin(ctx: any) {
  const role = ctx?.user?.role;

  if (!role || (role !== "Admin" && role !== "admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only Admin can manage Tamara settings.",
    });
  }
}

export const tamaraRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    return await getTamaraSettings();
  }),

  updateSettings: protectedProcedure
    .input(tamaraSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      return await updateTamaraSettings(input);
    }),

  createCheckout: protectedProcedure
    .input(
      z.object({
        dealId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      const session = await createTamaraCheckoutSession(input.dealId);

      return {
        order_id: session.order_id,
        checkout_id: session.checkout_id,
        checkout_url: session.checkout_url,
        status: session.status,
      };
    }),
});

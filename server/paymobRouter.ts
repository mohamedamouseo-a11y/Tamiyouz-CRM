import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "./_core/trpc";
import {
  createPaymobCheckoutForContract,
  createPaymobCheckoutForDeal,
  getPaymobSettings,
  updatePaymobSettings,
} from "./services/paymobService";

const paymobSettingsSchema = z.object({
  paymob_api_key: z.string().default(""),
  paymob_hmac_secret: z.string().default(""),
  paymob_integration_id_card_eg: z.string().default(""),
  paymob_integration_id_card_sa: z.string().default(""),
  paymob_integration_id_wallet_eg: z.string().default(""),
  paymob_iframe_id: z.string().default(""),
  paymob_enabled: z.boolean().default(false),
});

const checkoutSchema = z.object({
  paymentMethod: z.enum(["card", "wallet"]).default("card"),
  walletPhone: z.string().optional(),
});

function assertAdmin(ctx: any) {
  const role =
    ctx?.session?.user?.role ||
    ctx?.user?.role ||
    ctx?.req?.user?.role ||
    ctx?.auth?.user?.role ||
    null;

  if (!role || !["Admin", "admin", "SUPER_ADMIN", "Super Admin", "super_admin"].includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only Admin can manage Paymob settings.",
    });
  }
}

export const paymobRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx);
    return await getPaymobSettings();
  }),

  updateSettings: protectedProcedure
    .input(paymobSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx);
      return await updatePaymobSettings(input);
    }),

  isEnabled: protectedProcedure.query(async () => {
    const settings = await getPaymobSettings();
    return { enabled: settings.paymob_enabled };
  }),

  createCheckout: protectedProcedure
    .input(
      z.object({
        dealId: z.number().int().positive(),
        paymentMethod: checkoutSchema.shape.paymentMethod.optional(),
        walletPhone: checkoutSchema.shape.walletPhone,
      }),
    )
    .mutation(async ({ input }) => {
      const session = await createPaymobCheckoutForDeal(input.dealId, {
        paymentMethod: input.paymentMethod || "card",
        walletPhone: input.walletPhone,
      });

      return {
        order_id: session.order_id,
        payment_token: session.payment_token,
        iframe_url: session.iframe_url,
        merchant_order_id: session.merchant_order_id,
        payment_method: session.payment_method,
      };
    }),

  createContractCheckout: protectedProcedure
    .input(
      z.object({
        contractId: z.number().int().positive(),
        paymentMethod: checkoutSchema.shape.paymentMethod.optional(),
        walletPhone: checkoutSchema.shape.walletPhone,
      }),
    )
    .mutation(async ({ input }) => {
      const session = await createPaymobCheckoutForContract(input.contractId, {
        paymentMethod: input.paymentMethod || "card",
        walletPhone: input.walletPhone,
      });

      return {
        order_id: session.order_id,
        payment_token: session.payment_token,
        iframe_url: session.iframe_url,
        merchant_order_id: session.merchant_order_id,
        payment_method: session.payment_method,
      };
    }),
});

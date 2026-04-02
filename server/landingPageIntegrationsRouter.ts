import { z } from "zod";
import { router } from "./_core/trpc";
import { landingPageIntegrationInputSchema } from "../shared/landingPageIntegration.types";
import {
  createLandingPageIntegration,
  getLandingPageIntegrationById,
  getLandingPageSubmissionLogs,
  listLandingPageIntegrations,
  softDeleteLandingPageIntegration,
  updateLandingPageIntegration,
} from "./services/landingPageIntegrationService";

export function createLandingPageIntegrationsRouter(adminProcedure: any) {
  return router({
    list: adminProcedure.query(async () => listLandingPageIntegrations()),

    byId: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }: any) => getLandingPageIntegrationById(input.id)),

    create: adminProcedure
      .input(landingPageIntegrationInputSchema)
      .mutation(async ({ input }: any) => {
        const id = await createLandingPageIntegration(input);
        return { success: true, id };
      }),

    update: adminProcedure
      .input(z.object({ id: z.number(), data: landingPageIntegrationInputSchema.partial() }))
      .mutation(async ({ input }: any) => {
        await updateLandingPageIntegration(input.id, input.data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: any) => {
        await softDeleteLandingPageIntegration(input.id);
        return { success: true };
      }),

    logs: adminProcedure
      .input(z.object({ integrationId: z.number(), limit: z.number().min(1).max(200).default(50) }))
      .query(async ({ input }: any) => {
        return getLandingPageSubmissionLogs(input.integrationId, input.limit);
      }),
  });
}

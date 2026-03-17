/**
 * Lead Sources tRPC Router
 * Admin-only endpoints for managing Google Sheet lead sources.
 */
import { z } from "zod";
import { router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  testSheetConnection,
  previewSheetData,
  suggestFieldMapping,
  extractSpreadsheetId,
} from "./googleSheets";
import {
  getLeadSources,
  getLeadSourceById,
  createLeadSource,
  updateLeadSource,
  softDeleteLeadSource,
  syncLeadSource,
  getSyncLogs,
} from "./syncEngine";

// This will be imported and used with adminProcedure in routers.ts
export function createLeadSourcesRouter(adminProcedure: any) {
  return router({
    // List all lead sources
    list: adminProcedure.query(async () => {
      return getLeadSources();
    }),

    // Get a single lead source by ID
    byId: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }: any) => {
        const source = await getLeadSourceById(input.id);
        if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Lead source not found" });
        return source;
      }),

    // Create a new lead source
    create: adminProcedure
      .input(z.object({
        sourceName: z.string().min(1),
        sheetUrl: z.string().optional(),
        worksheetMode: z.enum(["pick", "all"]).default("pick"),
        worksheetName: z.string().optional(),
        syncFrequencyMinutes: z.number().min(1).max(60).default(5),
        uniqueKeyPriority: z.enum(["meta_lead_id", "phone"]).default("meta_lead_id"),
        assignmentRule: z.enum(["round_robin", "fixed_owner", "by_campaign"]).default("round_robin"),
        fixedOwnerId: z.number().optional(),
      }))
      .mutation(async ({ input }: any) => {
        let spreadsheetId: string | undefined;
        if (input.sheetUrl) {
          spreadsheetId = extractSpreadsheetId(input.sheetUrl) ?? undefined;
        }
        const id = await createLeadSource({
          ...input,
          spreadsheetId,
          status: "Disabled",
          isEnabled: false,
        } as any);
        return { id };
      }),

    // Update a lead source
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        sourceName: z.string().optional(),
        sheetUrl: z.string().optional(),
        worksheetMode: z.enum(["pick", "all"]).optional(),
        worksheetName: z.string().optional(),
        syncFrequencyMinutes: z.number().min(1).max(60).optional(),
        uniqueKeyPriority: z.enum(["meta_lead_id", "phone"]).optional(),
        assignmentRule: z.enum(["round_robin", "fixed_owner", "by_campaign"]).optional(),
        fixedOwnerId: z.number().nullable().optional(),
        fieldMapping: z.record(z.string(), z.string()).optional(),
        isEnabled: z.boolean().optional(),
        status: z.enum(["Connected", "PermissionMissing", "MappingError", "Disabled"]).optional(),
      }))
      .mutation(async ({ input }: any) => {
        const { id, sheetUrl, ...data } = input;
        if (sheetUrl !== undefined) {
          (data as any).sheetUrl = sheetUrl;
          (data as any).spreadsheetId = sheetUrl ? (extractSpreadsheetId(sheetUrl) ?? undefined) : undefined;
        }
        await updateLeadSource(id, data);
        return { success: true };
      }),

    // Soft delete a lead source
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: any) => {
        await softDeleteLeadSource(input.id);
        return { success: true };
      }),

    // Test connection to a Google Sheet (public link)
    testConnection: adminProcedure
      .input(z.object({ sheetUrl: z.string() }))
      .mutation(async ({ input }: any) => {
        try {
          const info = await testSheetConnection(input.sheetUrl);
          return { success: true, ...info };
        } catch (err: any) {
          return {
            success: false,
            error: err.message,
            spreadsheetId: "",
            title: "",
            worksheets: [],
          };
        }
      }),

    // Preview sheet data (headers + last N rows)
    preview: adminProcedure
      .input(z.object({
        spreadsheetId: z.string(),
        worksheetName: z.string(),
        maxRows: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ input }: any) => {
        try {
          const data = await previewSheetData(input.spreadsheetId, input.worksheetName, input.maxRows);
          return { success: true, ...data };
        } catch (err: any) {
          return { success: false, error: err.message, headers: [], rows: [], totalRows: 0 };
        }
      }),

    // Auto-suggest field mapping based on sheet headers
    suggestMapping: adminProcedure
      .input(z.object({ headers: z.array(z.string()) }))
      .query(({ input }: any) => {
        return suggestFieldMapping(input.headers);
      }),

    // Trigger manual sync for a source
    syncNow: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: any) => {
        const source = await getLeadSourceById(input.id);
        if (!source) throw new TRPCError({ code: "NOT_FOUND" });
        const result = await syncLeadSource(source, false);
        return result;
      }),

    // Dry run import (test with 5 rows)
    dryRun: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: any) => {
        const source = await getLeadSourceById(input.id);
        if (!source) throw new TRPCError({ code: "NOT_FOUND" });
        const result = await syncLeadSource(source, true, 5);
        return result;
      }),

    // Get sync logs for a source
    syncLogs: adminProcedure
      .input(z.object({ sourceId: z.number(), limit: z.number().max(100).default(20) }))
      .query(async ({ input }: any) => {
        return getSyncLogs(input.sourceId, input.limit);
      }),
  });
}

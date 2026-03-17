/**
 * Lead Source Sync Engine
 * Handles scheduled sync, deduplication, assignment, and error logging.
 */
import { getDb } from "./db";
import {
  leads,
  leadSources,
  leadSourceSyncLog,
  users,
  campaigns,
  type LeadSource,
  type InsertLeadSourceSyncLog,
} from "../drizzle/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { fetchAllSheetRows, normalizeSaudiPhone } from "./googleSheets";
import cron from "node-cron";

// ─── Lead Source CRUD ─────────────────────────────────────────────────────────

export async function getLeadSources(): Promise<LeadSource[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leadSources).where(eq(leadSources.isDeleted, false)).orderBy(leadSources.createdAt);
}

export async function getLeadSourceById(id: number): Promise<LeadSource | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leadSources).where(and(eq(leadSources.id, id), eq(leadSources.isDeleted, false))).limit(1);
  return result[0];
}

export async function createLeadSource(data: Partial<LeadSource>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(leadSources).values(data as any);
  return (result as any)[0]?.insertId ?? 0;
}

export async function updateLeadSource(id: number, data: Partial<LeadSource>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(leadSources).set(data as any).where(eq(leadSources.id, id));
}

export async function softDeleteLeadSource(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(leadSources).set({ isDeleted: true, isEnabled: false }).where(eq(leadSources.id, id));
}

export async function createSyncLog(data: InsertLeadSourceSyncLog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(leadSourceSyncLog).values(data);
}

export async function getSyncLogs(sourceId: number, limit = 20): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leadSourceSyncLog)
    .where(eq(leadSourceSyncLog.sourceId, sourceId))
    .orderBy(sql`${leadSourceSyncLog.createdAt} DESC`)
    .limit(limit);
}

// ─── Sync Logic ───────────────────────────────────────────────────────────────

interface SyncResult {
  rowsProcessed: number;
  rowsImported: number;
  rowsSkipped: number;
  rowsError: number;
  errors: string[];
}

export async function syncLeadSource(
  source: LeadSource,
  dryRun: boolean = false,
  maxRows?: number
): Promise<SyncResult> {
  const result: SyncResult = {
    rowsProcessed: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    rowsError: 0,
    errors: [],
  };

  if (!source.spreadsheetId || !source.worksheetName) {
    result.errors.push("Missing spreadsheet ID or worksheet name");
    return result;
  }

  if (!source.fieldMapping) {
    result.errors.push("No field mapping configured");
    return result;
  }

  const db = await getDb();
  if (!db) {
    result.errors.push("Database not available");
    return result;
  }

  // 1) Fetch data from Google Sheet
  let sheetData: { headers: string[]; rows: Record<string, string>[] };
  try {
    sheetData = await fetchAllSheetRows(source.spreadsheetId, source.worksheetName);
  } catch (err: any) {
    result.errors.push(`Sheet fetch error: ${err.message}`);
    return result;
  }

  if (sheetData.rows.length === 0) {
    return result;
  }

  // Validate mapping against current headers
  const mapping = source.fieldMapping as Record<string, string>;
  const currentHeaders = sheetData.headers;
  const mappedHeaders = Object.keys(mapping);
  const missingHeaders = mappedHeaders.filter(h => !currentHeaders.includes(h));
  if (missingHeaders.length > 0) {
    // Mark source as MappingError
    await updateLeadSource(source.id, { status: "MappingError" });
    result.errors.push(`Mapping error: columns no longer exist in sheet: ${missingHeaders.join(", ")}`);
    return result;
  }

  // 2) Get existing leads for deduplication
  const existingExternalIds = new Set<string>();
  const existingPhones = new Set<string>();

  const allExisting = await db.select({
    externalId: leads.externalId,
    phone: leads.phone,
  }).from(leads);

  for (const row of allExisting) {
    if (row.externalId) existingExternalIds.add(row.externalId);
    if (row.phone) existingPhones.add(normalizeSaudiPhone(row.phone));
  }

  // 3) Get assignment data
  const activeAgents = await db.select().from(users)
    .where(and(eq(users.role, "SalesAgent"), eq(users.isActive, true)));

  let roundRobinIndex = 0;

  // If by_campaign, get campaign round-robin data
  const campaignList = await db.select().from(campaigns);
  const campaignMap = new Map(campaignList.map(c => [c.name, c]));

  // 4) Process rows
  const rows = maxRows ? sheetData.rows.slice(0, maxRows) : sheetData.rows;

  for (const row of rows) {
    result.rowsProcessed++;

    try {
      // Apply field mapping
      const leadData: Record<string, any> = {};
      const sourceMetadata: Record<string, string> = {};
      const customFields: Record<string, string> = {};
      let externalId: string | null = null;

      for (const [sheetCol, crmField] of Object.entries(mapping)) {
        const value = row[sheetCol] ?? "";
        if (!value && crmField !== "externalId") continue;

        if (crmField === "externalId") {
          externalId = value || null;
          leadData.externalId = externalId;
        } else if (crmField.startsWith("_sourceMetadata.")) {
          const key = crmField.replace("_sourceMetadata.", "");
          sourceMetadata[key] = value;
        } else if (crmField.startsWith("_customField.")) {
          const key = crmField.replace("_customField.", "");
          customFields[key] = value;
        } else if (crmField === "phone") {
          leadData.phone = normalizeSaudiPhone(value);
        } else if (crmField === "leadTime") {
          try {
            leadData.leadTime = value ? new Date(value) : null;
          } catch {
            leadData.leadTime = null;
          }
        } else if (crmField === "leadQuality") {
          const validQualities = ["Hot", "Warm", "Cold", "Bad", "Unknown"];
          leadData.leadQuality = validQualities.includes(value) ? value : "Unknown";
        } else {
          leadData[crmField] = value;
        }
      }

      // Ensure phone exists
      if (!leadData.phone) {
        result.rowsSkipped++;
        continue;
      }

      // Deduplication check
      const normalizedPhone = normalizeSaudiPhone(leadData.phone);
      const isDuplicate =
        (source.uniqueKeyPriority === "meta_lead_id" && externalId && existingExternalIds.has(externalId)) ||
        existingPhones.has(normalizedPhone);

      if (isDuplicate) {
        result.rowsSkipped++;
        continue;
      }

      // Determine owner assignment
      let ownerId: number | null = null;
      if (source.assignmentRule === "fixed_owner" && source.fixedOwnerId) {
        ownerId = source.fixedOwnerId;
      } else if (source.assignmentRule === "by_campaign" && leadData.campaignName) {
        const campaign = campaignMap.get(leadData.campaignName);
        if (campaign && campaign.roundRobinEnabled && activeAgents.length > 0) {
          const idx = campaign.roundRobinIndex % activeAgents.length;
          ownerId = activeAgents[idx].id;
          // Update campaign round-robin index
          if (!dryRun) {
            await db.update(campaigns)
              .set({ roundRobinIndex: idx + 1 })
              .where(eq(campaigns.id, campaign.id));
          }
        }
      } else if (source.assignmentRule === "round_robin" && activeAgents.length > 0) {
        ownerId = activeAgents[roundRobinIndex % activeAgents.length].id;
        roundRobinIndex++;
      }

      // Build final lead record
      const newLead = {
        name: leadData.name || null,
        phone: normalizedPhone,
        country: leadData.country || "Saudi Arabia",
        businessProfile: leadData.businessProfile || null,
        leadQuality: leadData.leadQuality || "Unknown",
        campaignName: leadData.campaignName || sourceMetadata.campaign_name || null,
        adCreative: sourceMetadata.ad_name || null,
        ownerId,
        stage: leadData.stage || "New",
        notes: leadData.notes || null,
        mediaBuyerNotes: leadData.mediaBuyerNotes || null,
        externalId: externalId,
        sourceId: source.id,
        sourceMetadata: Object.keys(sourceMetadata).length > 0 ? sourceMetadata : null,
        customFieldsData: Object.keys(customFields).length > 0 ? customFields : null,
        leadTime: leadData.leadTime || null,
      };

      if (!dryRun) {
        await db.insert(leads).values(newLead as any);
        // Track for dedup within this batch
        if (externalId) existingExternalIds.add(externalId);
        existingPhones.add(normalizedPhone);
      }

      result.rowsImported++;
    } catch (err: any) {
      result.rowsError++;
      result.errors.push(`Row ${result.rowsProcessed}: ${err.message}`);
    }
  }

  // 5) Update source status
  if (!dryRun) {
    await updateLeadSource(source.id, {
      lastSyncTime: new Date(),
      lastSyncResult: result.errors.length > 0
        ? `Partial: ${result.rowsImported} imported, ${result.rowsError} errors`
        : `Success: ${result.rowsImported} imported`,
      lastSyncRowCount: result.rowsImported,
      status: result.errors.length > 0 && result.rowsImported === 0 ? "MappingError" : "Connected",
    });

    // Log sync result
    await createSyncLog({
      sourceId: source.id,
      status: result.rowsError > 0 ? (result.rowsImported > 0 ? "partial" : "error") : "success",
      rowsProcessed: result.rowsProcessed,
      rowsImported: result.rowsImported,
      rowsSkipped: result.rowsSkipped,
      rowsError: result.rowsError,
      errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
      details: { errors: result.errors },
    });
  }

  return result;
}

// ─── Scheduled Sync ───────────────────────────────────────────────────────────

let syncIntervals: Map<number, ReturnType<typeof setInterval>> = new Map();

export async function startSyncScheduler(): Promise<void> {
  console.log("[SyncEngine] Starting sync scheduler...");

  // Run every minute to check for sources that need syncing
  cron.schedule("* * * * *", async () => {
    try {
      const sources = await getLeadSources();
      const now = Date.now();

      for (const source of sources) {
        if (!source.isEnabled || source.status === "Disabled") continue;
        if (!source.spreadsheetId || !source.fieldMapping) continue;

        const lastSync = source.lastSyncTime ? new Date(source.lastSyncTime).getTime() : 0;
        const intervalMs = (source.syncFrequencyMinutes || 5) * 60 * 1000;

        if (now - lastSync >= intervalMs) {
          console.log(`[SyncEngine] Syncing source: ${source.sourceName} (ID: ${source.id})`);
          try {
            const result = await syncLeadSource(source);
            console.log(`[SyncEngine] Sync complete for ${source.sourceName}: ${result.rowsImported} imported, ${result.rowsSkipped} skipped, ${result.rowsError} errors`);
          } catch (err: any) {
            console.error(`[SyncEngine] Sync failed for ${source.sourceName}:`, err.message);
            await updateLeadSource(source.id, {
              lastSyncTime: new Date(),
              lastSyncResult: `Error: ${err.message}`,
            });
          }
        }
      }
    } catch (err: any) {
      console.error("[SyncEngine] Scheduler error:", err.message);
    }
  });

  console.log("[SyncEngine] Sync scheduler started.");
}

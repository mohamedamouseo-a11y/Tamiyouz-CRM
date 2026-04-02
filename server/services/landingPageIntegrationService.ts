import { sql } from "drizzle-orm";
import { getDb } from "../db";
import type { LandingPageIntegrationInput } from "../../shared/landingPageIntegration.types";

export interface LandingPageIntegrationRecord extends LandingPageIntegrationInput {
  id: number;
  type: "landing_page";
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

function parseJson<T>(value: any, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try { return JSON.parse(value); } catch { return fallback; }
}

function rowToRecord(row: any): LandingPageIntegrationRecord {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    type: "landing_page",
    status: row.status,
    isEnabled: Boolean(row.isEnabled),
    allowedDomains: parseJson<string[]>(row.allowedDomains, []),
    endpointPath: row.endpointPath,
    sourceName: row.sourceName ?? undefined,
    defaultPageTitle: row.defaultPageTitle ?? undefined,
    defaultStage: row.defaultStage,
    assignmentRule: row.assignmentRule,
    fixedOwnerId: row.fixedOwnerId ?? null,
    dedupRule: row.dedupRule,
    attributionMode: row.attributionMode,
    fieldMapping: parseJson(row.fieldMapping, {} as any),
    securityConfig: parseJson(row.securityConfig, {} as any),
    notificationConfig: parseJson(row.notificationConfig, {} as any),
    tags: parseJson<string[]>(row.tags, []),
    scoringRules: parseJson<any[]>(row.scoringRules, []),
    successMessage: row.successMessage ?? undefined,
    redirectUrl: row.redirectUrl ?? undefined,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
  };
}

export async function listLandingPageIntegrations(): Promise<LandingPageIntegrationRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const rows: any = await db.execute(sql`
    SELECT * FROM landing_page_integrations
    WHERE deletedAt IS NULL
    ORDER BY updatedAt DESC
  `);
  return ((rows as any)[0] ?? rows).map(rowToRecord);
}

export async function getLandingPageIntegrationById(id: number): Promise<LandingPageIntegrationRecord | null> {
  const db = await getDb();
  if (!db) return null;
  const rows: any = await db.execute(sql`
    SELECT * FROM landing_page_integrations
    WHERE id = ${id} AND deletedAt IS NULL
    LIMIT 1
  `);
  const row = ((rows as any)[0] ?? rows)[0];
  return row ? rowToRecord(row) : null;
}

export async function getLandingPageIntegrationBySlug(slug: string): Promise<LandingPageIntegrationRecord | null> {
  const db = await getDb();
  if (!db) return null;
  const rows: any = await db.execute(sql`
    SELECT * FROM landing_page_integrations
    WHERE slug = ${slug} AND deletedAt IS NULL AND isEnabled = 1 AND status = 'Active'
    LIMIT 1
  `);
  const row = ((rows as any)[0] ?? rows)[0];
  return row ? rowToRecord(row) : null;
}

export async function createLandingPageIntegration(input: LandingPageIntegrationInput): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.execute(sql`
    INSERT INTO landing_page_integrations (
      name, slug, type, status, isEnabled, allowedDomains, endpointPath,
      sourceName, defaultPageTitle, defaultStage, assignmentRule,
      fixedOwnerId, dedupRule, attributionMode, fieldMapping,
      securityConfig, notificationConfig, tags, scoringRules,
      successMessage, redirectUrl
    ) VALUES (
      ${input.name},
      ${input.slug},
      'landing_page',
      ${input.status},
      ${input.isEnabled ? 1 : 0},
      ${JSON.stringify(input.allowedDomains ?? [])},
      ${input.endpointPath},
      ${input.sourceName ?? null},
      ${input.defaultPageTitle ?? null},
      ${input.defaultStage},
      ${input.assignmentRule},
      ${input.fixedOwnerId ?? null},
      ${input.dedupRule},
      ${input.attributionMode},
      ${JSON.stringify(input.fieldMapping ?? {})},
      ${JSON.stringify(input.securityConfig ?? {})},
      ${JSON.stringify(input.notificationConfig ?? {})},
      ${JSON.stringify(input.tags ?? [])},
      ${JSON.stringify(input.scoringRules ?? [])},
      ${input.successMessage ?? null},
      ${input.redirectUrl || null}
    )
  `);
  return Number((result as any)[0]?.insertId ?? (result as any).insertId ?? 0);
}

export async function updateLandingPageIntegration(id: number, input: Partial<LandingPageIntegrationInput>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await getLandingPageIntegrationById(id);
  if (!current) throw new Error("Integration not found");
  const next = { ...current, ...input };
  await db.execute(sql`
    UPDATE landing_page_integrations
    SET
      name = ${next.name},
      slug = ${next.slug},
      status = ${next.status},
      isEnabled = ${next.isEnabled ? 1 : 0},
      allowedDomains = ${JSON.stringify(next.allowedDomains ?? [])},
      endpointPath = ${next.endpointPath},
      sourceName = ${next.sourceName ?? null},
      defaultPageTitle = ${next.defaultPageTitle ?? null},
      defaultStage = ${next.defaultStage},
      assignmentRule = ${next.assignmentRule},
      fixedOwnerId = ${next.fixedOwnerId ?? null},
      dedupRule = ${next.dedupRule},
      attributionMode = ${next.attributionMode},
      fieldMapping = ${JSON.stringify(next.fieldMapping ?? {})},
      securityConfig = ${JSON.stringify(next.securityConfig ?? {})},
      notificationConfig = ${JSON.stringify(next.notificationConfig ?? {})},
      tags = ${JSON.stringify(next.tags ?? [])},
      scoringRules = ${JSON.stringify(next.scoringRules ?? [])},
      successMessage = ${next.successMessage ?? null},
      redirectUrl = ${next.redirectUrl || null},
      updatedAt = NOW()
    WHERE id = ${id}
  `);
}

export async function softDeleteLandingPageIntegration(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(sql`UPDATE landing_page_integrations SET deletedAt = NOW(), isEnabled = 0, status = 'Disabled' WHERE id = ${id}`);
}

export async function logLandingPageSubmission(params: {
  integrationId: number;
  status: "received" | "validated" | "blocked" | "pushed_to_crm" | "duplicate" | "failed";
  ipAddress?: string | null;
  userAgent?: string | null;
  origin?: string | null;
  payloadJson?: any;
  trackingJson?: any;
  errorMessage?: string | null;
  leadId?: number | null;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.execute(sql`
    INSERT INTO landing_page_submission_logs (
      integrationId, status, ipAddress, userAgent, origin, payloadJson, trackingJson, errorMessage, leadId, processedAt
    ) VALUES (
      ${params.integrationId},
      ${params.status},
      ${params.ipAddress ?? null},
      ${params.userAgent ?? null},
      ${params.origin ?? null},
      ${JSON.stringify(params.payloadJson ?? {})},
      ${JSON.stringify(params.trackingJson ?? {})},
      ${params.errorMessage ?? null},
      ${params.leadId ?? null},
      NOW()
    )
  `);
  return Number((result as any)[0]?.insertId ?? (result as any).insertId ?? 0);
}

export async function getLandingPageSubmissionLogs(integrationId: number, limit = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const rows: any = await db.execute(sql`
    SELECT * FROM landing_page_submission_logs
    WHERE integrationId = ${integrationId}
    ORDER BY createdAt DESC
    LIMIT ${limit}
  `);
  return (rows as any)[0] ?? rows;
}

import axios from "axios";
import crypto from "crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { getDb } from "../db";
import {
  campaigns,
  leads,
  metaIntegrations,
  metaLeadgenConfig,
  users,
} from "../../drizzle/schema";
import { normalizeSaudiPhone } from "../googleSheets";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

type AssignmentRule = "round_robin" | "fixed_owner" | "by_campaign";
type LeadgenConfigRow = typeof metaLeadgenConfig.$inferSelect;
type UpsertLeadgenConfigInput = {
  id?: number;
  pageId: string;
  pageName?: string | null;
  pageAccessToken: string;
  isEnabled?: number | boolean;
  assignmentRule?: AssignmentRule;
  fixedOwnerId?: number | null;
  fieldMapping?: Record<string, string> | null;
};

type GraphLeadField = {
  name: string;
  values?: string[];
};

type GraphLeadResponse = {
  id: string;
  created_time?: string;
  field_data?: GraphLeadField[];
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  campaign_id?: string;
  campaign_name?: string;
};

function generateVerifyToken() {
  return crypto.randomBytes(24).toString("hex");
}

function normalizeBool(value: unknown): number {
  return value ? 1 : 0;
}

function getFieldValue(fieldMap: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = fieldMap[name];
    if (value) return value;
  }
  return undefined;
}

function mapMetaFields(
  fieldData: GraphLeadField[] = [],
  mapping?: Record<string, string> | null,
) {
  const byName: Record<string, string> = {};
  for (const field of fieldData) {
    byName[field.name] = field.values?.[0] ?? "";
  }

  const configuredMapping = mapping ?? {};

  const crmLead: Record<string, any> = {
    name: null,
    phone: null,
    businessProfile: null,
    notes: null,
  };
  const customFieldsData: Record<string, any> = {};

  for (const [metaField, value] of Object.entries(byName)) {
    const target = configuredMapping[metaField];
    if (target === "name") crmLead.name = value;
    else if (target === "phone") crmLead.phone = value;
    else if (target === "businessProfile") crmLead.businessProfile = value;
    else if (target === "notes") crmLead.notes = value;
    else if (target?.startsWith("_customField.")) customFieldsData[target.replace("_customField.", "")] = value;
    else customFieldsData[metaField] = value;
  }

  if (!crmLead.name) crmLead.name = getFieldValue(byName, ["full_name", "name", "first_name"]);
  if (!crmLead.phone) crmLead.phone = getFieldValue(byName, ["phone_number", "phone", "mobile_number"]);
  if (!crmLead.businessProfile) crmLead.businessProfile = getFieldValue(byName, ["company_name", "company", "business_name"]);
  if (!crmLead.notes) {
    const email = getFieldValue(byName, ["email"]);
    crmLead.notes = email ? `Email: ${email}` : null;
  }

  return {
    ...crmLead,
    customFieldsData,
  };
}

async function getActiveSalesAgents() {
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name, teamId: users.teamId })
    .from(users)
    .where(and(eq(users.role, "SalesAgent"), eq(users.isActive, 1), isNull(users.deletedAt)));
}

async function assignRoundRobinLead(agentIds: number[]) {
  if (!agentIds.length) return null;
  const db = await getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(leads);
  const nextIndex = Number(count || 0) % agentIds.length;
  return agentIds[nextIndex] ?? null;
}

async function assignByCampaign(campaignName?: string | null) {
  if (!campaignName) return null;
  const db = await getDb();
  const [campaign] = await db
    .select({ id: campaigns.id, roundRobinIndex: campaigns.roundRobinIndex, roundRobinEnabled: campaigns.roundRobinEnabled })
    .from(campaigns)
    .where(eq(campaigns.name, campaignName))
    .limit(1);

  if (!campaign || !campaign.roundRobinEnabled) return null;

  const salesAgents = await getActiveSalesAgents();
  if (!salesAgents.length) return null;

  const owner = salesAgents[campaign.roundRobinIndex % salesAgents.length];

  await db
    .update(campaigns)
    .set({ roundRobinIndex: (campaign.roundRobinIndex ?? 0) + 1 })
    .where(eq(campaigns.id, campaign.id));

  return owner?.id ?? null;
}

async function assignOwner(config: LeadgenConfigRow, campaignName?: string | null) {
  if (config.assignmentRule === "fixed_owner") {
    return config.fixedOwnerId ?? null;
  }

  if (config.assignmentRule === "by_campaign") {
    const ownerId = await assignByCampaign(campaignName);
    if (ownerId) return ownerId;
  }

  const salesAgents = await getActiveSalesAgents();
  return assignRoundRobinLead(salesAgents.map((agent) => agent.id));
}

async function verifyWebhookSignature(rawBody: string, signatureHeader?: string | null) {
  if (!signatureHeader) return true;
  const db = await getDb();
  const [integration] = await db.select().from(metaIntegrations).where(eq(metaIntegrations.isActive, 1)).limit(1);
  if (!integration?.appSecret) return true;

  const expected =
    "sha256=" + crypto.createHmac("sha256", integration.appSecret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

export class MetaLeadgenService {
  static getDefaultWebhookUrl() {
    return "https://sales.tamiyouzplaform.com/api/meta/webhook";
  }

  static async getLeadgenConfigs() {
    const db = await getDb();
    return db.select().from(metaLeadgenConfig);
  }

  static async getLeadgenStats() {
    const db = await getDb();
    const configs = await db.select().from(metaLeadgenConfig);
    const totalPages = configs.length;
    const enabledPages = configs.filter((c) => c.isEnabled).length;
    const totalLeadsReceived = configs.reduce((sum, c) => sum + (c.totalLeadsReceived || 0), 0);
    const lastLeadReceivedAt = configs
      .map((c) => c.lastLeadReceivedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    return {
      totalPages,
      enabledPages,
      totalLeadsReceived,
      lastLeadReceivedAt,
      webhookUrl: this.getDefaultWebhookUrl(),
    };
  }

  static async upsertLeadgenConfig(input: UpsertLeadgenConfigInput) {
    const payload = {
      pageId: input.pageId,
      pageName: input.pageName ?? null,
      pageAccessToken: input.pageAccessToken,
      isEnabled: normalizeBool(input.isEnabled ?? true),
      assignmentRule: (input.assignmentRule ?? "round_robin") as AssignmentRule,
      fixedOwnerId: input.fixedOwnerId ?? null,
      fieldMapping: input.fieldMapping ?? {},
    };

    const db = await getDb();
    if (input.id) {
      await db.update(metaLeadgenConfig).set(payload).where(eq(metaLeadgenConfig.id, input.id));
      const [row] = await db.select().from(metaLeadgenConfig).where(eq(metaLeadgenConfig.id, input.id)).limit(1);
      return row;
    }

    const verifyToken = generateVerifyToken();
    const insertResult = await db.insert(metaLeadgenConfig).values({
      ...payload,
      webhookVerifyToken: verifyToken,
      totalLeadsReceived: 0,
    });

    const insertedId = Number((insertResult as any).insertId);
    const [row] = await db.select().from(metaLeadgenConfig).where(eq(metaLeadgenConfig.id, insertedId)).limit(1);
    return row;
  }

  static async deleteLeadgenConfig(id: number) {
    const db = await getDb();
    await db.delete(metaLeadgenConfig).where(eq(metaLeadgenConfig.id, id));
    return { success: true };
  }

  static async findConfigByVerifyToken(token: string) {
    const db = await getDb();
    const [config] = await db
      .select()
      .from(metaLeadgenConfig)
      .where(eq(metaLeadgenConfig.webhookVerifyToken, token))
      .limit(1);

    return config ?? null;
  }

  static async fetchLeadData(leadgenId: string, accessToken: string): Promise<GraphLeadResponse> {
    const response = await axios.get(`${GRAPH_API_BASE}/${leadgenId}`, {
      params: {
        fields: "id,created_time,field_data,ad_id,ad_name,form_id,campaign_id,campaign_name",
        access_token: accessToken,
      },
    });

    return response.data;
  }

  static async fetchLeadgenForms(pageId: string, accessToken: string) {
    const response = await axios.get(`${GRAPH_API_BASE}/${pageId}/leadgen_forms`, {
      params: {
        fields: "id,name,status,created_time",
        access_token: accessToken,
      },
    });

    return response.data?.data ?? [];
  }

  static async testPageConnection(pageId: string, accessToken: string) {
    const response = await axios.get(`${GRAPH_API_BASE}/${pageId}`, {
      params: {
        fields: "id,name",
        access_token: accessToken,
      },
    });

    return response.data;
  }

  static async subscribePageWebhook(pageId: string, accessToken: string) {
    const response = await axios.post(
      `${GRAPH_API_BASE}/${pageId}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: "leadgen",
          access_token: accessToken,
        },
      },
    );

    return response.data;
  }

  static async validateWebhookSignature(rawBody: string, signatureHeader?: string | null) {
    return verifyWebhookSignature(rawBody, signatureHeader);
  }

  static async processLeadgenWebhook(body: any) {
    if (!body || body.object !== "page") return { processed: 0, skipped: 0 };

    let processed = 0;
    let skipped = 0;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "leadgen") {
          skipped += 1;
          continue;
        }

        const value = change.value ?? {};
        const leadgenId = String(value.leadgen_id ?? "").trim();
        const pageId = String(value.page_id ?? "").trim();

        if (!leadgenId || !pageId) {
          skipped += 1;
          continue;
        }

        const db = await getDb();
        const [config] = await db
          .select()
          .from(metaLeadgenConfig)
          .where(and(eq(metaLeadgenConfig.pageId, pageId), eq(metaLeadgenConfig.isEnabled, 1)))
          .limit(1);

        if (!config) {
          skipped += 1;
          continue;
        }

        try {
          const graphLead = await this.fetchLeadData(leadgenId, config.pageAccessToken);
          const mappedLead = mapMetaFields(graphLead.field_data ?? [], (config.fieldMapping as Record<string, string>) ?? {});
          const normalizedPhone = normalizeSaudiPhone(mappedLead.phone);

          const duplicateFilters = [eq(leads.externalId, leadgenId)];
          if (normalizedPhone) duplicateFilters.push(eq(leads.phone, normalizedPhone));

          const existing = await db
            .select({ id: leads.id })
            .from(leads)
            .where(or(...duplicateFilters))
            .limit(1);

          if (existing.length) {
            skipped += 1;
            continue;
          }

          const ownerId = await assignOwner(config, graphLead.campaign_name ?? null);

          // Convert Meta's ISO date to MySQL-compatible format
          let leadTimeValue: string | null = null;
          if (graphLead.created_time) {
            try {
              leadTimeValue = new Date(graphLead.created_time).toISOString().slice(0, 19).replace("T", " ");
            } catch {
              leadTimeValue = null;
            }
          }

          await db.insert(leads).values({
            name: mappedLead.name || null,
            phone: normalizedPhone || null,
            country: "Saudi Arabia",
            businessProfile: mappedLead.businessProfile || null,
            leadQuality: "Unknown",
            campaignName: graphLead.campaign_name || null,
            adCreative: graphLead.ad_name || null,
            ownerId,
            stage: "New",
            notes: mappedLead.notes || null,
            externalId: leadgenId,
            sourceId: null as any,
            sourceMetadata: {
              page_id: pageId,
              form_id: graphLead.form_id || value.form_id || null,
              ad_id: graphLead.ad_id || value.ad_id || null,
              adgroup_id: value.adgroup_id || null,
              campaign_id: graphLead.campaign_id || null,
              provider: "meta_leadgen",
            },
            customFieldsData: mappedLead.customFieldsData,
            leadTime: leadTimeValue,
          });

          await db
            .update(metaLeadgenConfig)
            .set({
              lastLeadReceivedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
              totalLeadsReceived: (config.totalLeadsReceived ?? 0) + 1,
            })
            .where(eq(metaLeadgenConfig.id, config.id));

          processed += 1;
        } catch (err) {
          console.error(`[MetaLeadgen] Failed to process lead ${leadgenId} from page ${pageId}:`, err);
          skipped += 1;
          continue;
        }
      }
    }

    return { processed, skipped };
  }
}

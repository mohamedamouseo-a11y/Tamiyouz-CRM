import { createLead, getAllUsers, getLeadByPhone, normalizePhone } from "../db";
import { sendEmail } from "../email";
import { publicLeadPayloadSchema, type PublicLeadPayload } from "../../shared/landingPageIntegration.types";
import {
  getLandingPageIntegrationBySlug,
  logLandingPageSubmission,
  type LandingPageIntegrationRecord,
} from "./landingPageIntegrationService";
import { sendSlackNotification } from "./slackNotificationService";

interface IntakeContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  origin?: string | null;
}

function pickByPath(source: Record<string, any>, path?: string | null) {
  if (!path) return undefined;
  return source[path];
}

function buildSourceMetadata(payload: PublicLeadPayload, integration: LandingPageIntegrationRecord) {
  const mapping = integration.fieldMapping?.sourceMetadata ?? {};
  const out: Record<string, any> = {
    integrationSlug: integration.slug,
    integrationName: integration.name,
  };
  Object.entries(mapping).forEach(([targetKey, sourceKey]) => {
    out[targetKey] = pickByPath(payload as any, sourceKey as string) ?? null;
  });
  return out;
}

function buildCustomFieldsData(payload: PublicLeadPayload, integration: LandingPageIntegrationRecord) {
  const mapping = integration.fieldMapping?.customFields ?? {};
  const out: Record<string, any> = {};
  Object.entries(mapping).forEach(([targetKey, sourceKey]) => {
    out[targetKey] = pickByPath(payload as any, sourceKey as string) ?? null;
  });
  return out;
}

function scoreLead(payload: PublicLeadPayload, integration: LandingPageIntegrationRecord): number {
  const rules = integration.scoringRules ?? [];
  let score = 0;
  for (const rule of rules) {
    const value = String((payload as any)[rule.field] ?? "");
    if (rule.operator === "equals" && value === rule.value) score += Number(rule.score || 0);
    if (rule.operator === "includes" && value.includes(rule.value)) score += Number(rule.score || 0);
  }
  if (payload.decisionMaker === "نعم") score += 10;
  return score;
}

async function assignOwner(integration: LandingPageIntegrationRecord, payload: PublicLeadPayload): Promise<number | null> {
  if (integration.assignmentRule === "fixed_owner" && integration.fixedOwnerId) return integration.fixedOwnerId;

  const users = await getAllUsers();
  const salesUsers = users.filter((u: any) => u.isActive && ["Admin", "SalesManager", "SalesAgent"].includes(String(u.role)));
  if (salesUsers.length === 0) return null;

  if (integration.assignmentRule === "by_campaign") {
    const campaign = payload.utm_campaign || payload.pageSlug || integration.slug;
    const index = Math.abs(hashString(campaign)) % salesUsers.length;
    return Number(salesUsers[index].id);
  }

  const index = Math.floor(Date.now() / 60000) % salesUsers.length;
  return Number(salesUsers[index].id);
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function validateOrigin(integration: LandingPageIntegrationRecord, origin?: string | null): string | null {
  const allowed = integration.securityConfig?.allowedOrigins ?? integration.allowedDomains ?? [];
  if (!allowed.length || !origin) return null;
  const isAllowed = allowed.some((entry: string) => origin.includes(entry));
  return isAllowed ? null : "Origin is not allowed for this integration";
}

function validateAntiSpam(payload: PublicLeadPayload, integration: LandingPageIntegrationRecord): string | null {
  const honeypotField = integration.securityConfig?.honeypotField || "website";
  if ((payload as any)[honeypotField]) return "Honeypot was filled";
  const minSubmitSeconds = Number(integration.securityConfig?.minSubmitSeconds ?? 0);
  if (minSubmitSeconds > 0 && payload.submitted_at) {
    const submittedAt = Date.parse(payload.submitted_at);
    if (Number.isFinite(submittedAt)) {
      const diffSeconds = Math.abs(Date.now() - submittedAt) / 1000;
      if (diffSeconds < minSubmitSeconds) return `Submission too fast (${diffSeconds.toFixed(1)}s)`;
    }
  }
  return null;
}

function buildEmailHtml(input: {
  integration: LandingPageIntegrationRecord;
  payload: PublicLeadPayload;
  sourceMetadata: Record<string, any>;
  leadId: number;
  score: number;
}) {
  const rows = [
    ["الصفحة", input.integration.name],
    ["الاسم", input.payload.name || "—"],
    ["الجوال", input.payload.phone || "—"],
    ["النشاط", input.payload.businessType || "—"],
    ["الميزانية", input.payload.budget || "—"],
    ["التحدي", input.payload.challenge || "—"],
    ["صاحب القرار", input.payload.decisionMaker || "—"],
    ["وقت التواصل", input.payload.preferredContactTime || "—"],
    ["UTM Source", input.payload.utm_source || "—"],
    ["UTM Campaign", input.payload.utm_campaign || "—"],
    ["Landing URL", input.payload.landingUrl || "—"],
    ["Lead ID", String(input.leadId)],
    ["Lead Score", String(input.score)],
  ];
  return `
    <div style="font-family:Arial,sans-serif;direction:rtl">
      <h2>Lead جديد من ${input.integration.name}</h2>
      <table style="border-collapse:collapse;width:100%">
        ${rows.map(([k, v]) => `<tr><td style="border:1px solid #ddd;padding:8px;font-weight:bold">${k}</td><td style="border:1px solid #ddd;padding:8px">${v}</td></tr>`).join("")}
      </table>
      <pre style="margin-top:16px;background:#f8fafc;padding:12px;border-radius:8px">${JSON.stringify(input.sourceMetadata, null, 2)}</pre>
    </div>
  `;
}

async function dispatchNotifications(params: {
  integration: LandingPageIntegrationRecord;
  payload: PublicLeadPayload;
  sourceMetadata: Record<string, any>;
  leadId: number;
  duplicate: boolean;
  score: number;
}) {
  const notifyType = params.duplicate ? "duplicate" : "lead_created";
  const emailCfg = params.integration.notificationConfig?.email;
  if (emailCfg?.enabled && Array.isArray(emailCfg.recipients) && emailCfg.recipients.length && (emailCfg.notifyOn ?? []).includes(notifyType)) {
    const subject = `${params.duplicate ? "Duplicate" : "New"} Lead • ${params.integration.name} • ${params.payload.name || params.payload.phone}`;
    const html = buildEmailHtml(params);
    await Promise.all(emailCfg.recipients.map((recipient: string) => sendEmail({ to: recipient, subject, html })));
  }

  const slackCfg = params.integration.notificationConfig?.slack;
  if (slackCfg?.enabled && slackCfg.webhookUrl && (slackCfg.notifyOn ?? []).includes(notifyType)) {
    await sendSlackNotification({
      webhookUrl: slackCfg.webhookUrl,
      channel: slackCfg.channel,
      mention: slackCfg.mention,
      title: `${params.duplicate ? "Duplicate" : "New"} Lead • ${params.integration.name}`,
      text: `${params.payload.name || "بدون اسم"} • ${params.payload.phone} • ${params.payload.utm_source || "direct"}`,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `*${params.integration.name}*\n*الاسم:* ${params.payload.name || "—"}\n*الجوال:* ${params.payload.phone}\n*الميزانية:* ${params.payload.budget || "—"}\n*UTM:* ${params.payload.utm_source || "direct"} / ${params.payload.utm_campaign || "—"}` } },
        { type: "context", elements: [{ type: "mrkdwn", text: `Lead ID: ${params.leadId} • Score: ${params.score}` }] },
      ],
    });
  }
}

export async function intakeLandingPageLead(slug: string, rawPayload: unknown, context: IntakeContext = {}) {
  const integration = await getLandingPageIntegrationBySlug(slug);
  if (!integration) {
    throw new Error("Landing page integration not found or not active");
  }

  const payload = publicLeadPayloadSchema.parse(rawPayload);

  const originError = validateOrigin(integration, context.origin);
  if (originError) {
    await logLandingPageSubmission({ integrationId: integration.id, status: "blocked", payloadJson: payload, origin: context.origin, ipAddress: context.ipAddress, userAgent: context.userAgent, errorMessage: originError });
    throw new Error(originError);
  }

  const antiSpamError = validateAntiSpam(payload, integration);
  if (antiSpamError) {
    await logLandingPageSubmission({ integrationId: integration.id, status: "blocked", payloadJson: payload, origin: context.origin, ipAddress: context.ipAddress, userAgent: context.userAgent, errorMessage: antiSpamError });
    throw new Error(antiSpamError);
  }

  const phone = normalizePhone(payload.phone || "");
  const existingLead = phone ? await getLeadByPhone(phone) : null;

  const ownerId = await assignOwner(integration, payload);
  const sourceMetadata = buildSourceMetadata(payload, integration);
  const customFieldsData = buildCustomFieldsData(payload, integration);
  const score = scoreLead(payload, integration);

  const leadId = await createLead({
    name: payload.name || null,
    phone,
    businessProfile: payload.businessLink || null,
    campaignName: payload.utm_campaign || payload.pageTitle || integration.name,
    ownerId: ownerId ?? null,
    stage: integration.defaultStage || "New",
    sourceId: null,
    sourceMetadata,
    customFieldsData: {
      ...customFieldsData,
      pageScore: score,
      integrationSlug: integration.slug,
      acquisitionChannels: payload.acquisitionChannels || [],
    },
    externalId: payload.externalSubmissionId || null,
    isDuplicate: existingLead ? true : false,
    duplicateOfId: existingLead?.id ?? null,
  } as any);

  await logLandingPageSubmission({
    integrationId: integration.id,
    status: existingLead ? "duplicate" : "pushed_to_crm",
    payloadJson: payload,
    trackingJson: sourceMetadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    origin: context.origin,
    leadId,
  });

  await dispatchNotifications({
    integration,
    payload,
    sourceMetadata,
    leadId,
    duplicate: Boolean(existingLead),
    score,
  });

  return {
    success: true,
    leadId,
    duplicate: Boolean(existingLead),
    message: integration.successMessage || "Lead received successfully",
    redirectUrl: integration.redirectUrl || null,
  };
}

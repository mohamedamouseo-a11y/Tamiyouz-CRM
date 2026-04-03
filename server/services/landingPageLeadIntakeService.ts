import { createLead, getAllUsers, getLeadByPhone, normalizePhone } from "../db";
import { publicLeadPayloadSchema, type PublicLeadPayload } from "../../shared/landingPageIntegration.types";
import {
  getLandingPageIntegrationBySlug,
  logLandingPageSubmission,
  type LandingPageIntegrationRecord,
} from "./landingPageIntegrationService";

interface IntakeContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  origin?: string | null;
}

/* ── Automatic field mapping ─────────────────────────────────────────── */

const KNOWN_SOURCE_METADATA_KEYS = [
  "pageSlug", "pageTitle", "landingUrl", "referrer",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "gclid", "fbclid", "ttclid", "msclkid",
  "first_touch_source", "first_touch_medium", "first_touch_campaign",
  "last_touch_source", "last_touch_medium", "last_touch_campaign",
  "session_id", "visitor_id", "submitted_at",
];

const KNOWN_CUSTOM_FIELD_KEYS = [
  "businessType", "acquisitionChannels", "budget", "challenge",
  "decisionMaker", "preferredContactTime", "businessLink",
];

const CORE_KEYS = ["name", "phone", "turnstileToken", "website", "externalSubmissionId"];
const RESERVED_KEYS = new Set([...CORE_KEYS, ...KNOWN_SOURCE_METADATA_KEYS, ...KNOWN_CUSTOM_FIELD_KEYS]);

/**
 * Automatically build sourceMetadata from the payload.
 * Picks all known tracking keys that have a value.
 */
function buildSourceMetadataAuto(payload: PublicLeadPayload, integration: LandingPageIntegrationRecord) {
  const out: Record<string, any> = {
    integrationSlug: integration.slug,
    integrationName: integration.name,
  };
  for (const key of KNOWN_SOURCE_METADATA_KEYS) {
    const val = (payload as any)[key];
    if (val !== undefined && val !== null && val !== "") {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Automatically build customFieldsData from the payload.
 * Picks all known custom field keys, plus any extra unknown keys from the form.
 */
function buildCustomFieldsDataAuto(payload: PublicLeadPayload) {
  const out: Record<string, any> = {};
  // Known custom fields
  for (const key of KNOWN_CUSTOM_FIELD_KEYS) {
    const val = (payload as any)[key];
    if (val !== undefined && val !== null && val !== "") {
      out[key] = val;
    }
  }
  // Auto-detect extra form fields (passthrough fields not in any known set)
  for (const [key, val] of Object.entries(payload as any)) {
    if (!RESERVED_KEYS.has(key) && val !== undefined && val !== null && val !== "") {
      out[key] = val;
    }
  }
  return out;
}

/* ── Scoring ─────────────────────────────────────────────────────────── */

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

/* ── Owner assignment ────────────────────────────────────────────────── */

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

/* ── Security (automatic from allowedDomains + sensible defaults) ──── */

function validateOrigin(integration: LandingPageIntegrationRecord, origin?: string | null): string | null {
  const allowed = integration.allowedDomains ?? [];
  if (!allowed.length || !origin) return null;
  const isAllowed = allowed.some((entry: string) => origin.includes(entry));
  return isAllowed ? null : "Origin is not allowed for this integration";
}

function validateAntiSpam(payload: PublicLeadPayload): string | null {
  // Honeypot: if "website" field is filled, it's a bot
  if ((payload as any).website) return "Honeypot was filled";
  // Minimum submit time: 3 seconds
  if (payload.submitted_at) {
    const submittedAt = Date.parse(payload.submitted_at);
    if (Number.isFinite(submittedAt)) {
      const diffSeconds = Math.abs(Date.now() - submittedAt) / 1000;
      if (diffSeconds < 3) return `Submission too fast (${diffSeconds.toFixed(1)}s)`;
    }
  }
  return null;
}

/* ── Turnstile verification ───────────────────────────────────────────── */
async function verifyTurnstileToken(token: string | undefined | null, ipAddress?: string | null): Promise<string | null> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return null; // Skip verification if no secret key configured
  if (!token) return "Turnstile token is missing";

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        remoteip: ipAddress || undefined,
      }),
    });
    const data = await response.json() as { success: boolean; "error-codes"?: string[] };
    if (!data.success) {
      return `Turnstile verification failed: ${(data["error-codes"] || []).join(", ")}`;
    }
    return null;
  } catch (err: any) {
    console.error("Turnstile verification error:", err);
    return null; // Allow submission if Turnstile API is unreachable
  }
}

/* ── Main intake function ────────────────────────────────────────────── */

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

  const antiSpamError = validateAntiSpam(payload);
  if (antiSpamError) {
    await logLandingPageSubmission({ integrationId: integration.id, status: "blocked", payloadJson: payload, origin: context.origin, ipAddress: context.ipAddress, userAgent: context.userAgent, errorMessage: antiSpamError });
    throw new Error(antiSpamError);
  }

  // Turnstile verification
  const turnstileError = await verifyTurnstileToken((payload as any).cf_turnstile_response, context.ipAddress);
  if (turnstileError) {
    await logLandingPageSubmission({ integrationId: integration.id, status: "blocked", payloadJson: payload, origin: context.origin, ipAddress: context.ipAddress, userAgent: context.userAgent, errorMessage: turnstileError });
    throw new Error(turnstileError);
  }

  const phone = normalizePhone(payload.phone || "");
  const existingLead = phone ? await getLeadByPhone(phone) : null;

  const ownerId = await assignOwner(integration, payload);
  const sourceMetadata = buildSourceMetadataAuto(payload, integration);
  const customFieldsData = buildCustomFieldsDataAuto(payload);
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

  return {
    success: true,
    leadId,
    duplicate: Boolean(existingLead),
    message: integration.successMessage || "Lead received successfully",
    redirectUrl: integration.redirectUrl || null,
  };
}

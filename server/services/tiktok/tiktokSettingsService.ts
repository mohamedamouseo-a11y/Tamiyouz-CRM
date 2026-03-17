/**
 * TikTok Settings Service
 * DB operations for managing TikTok integrations and ad accounts.
 * Follows the same pattern as Meta integration functions in db.ts
 */
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
  tiktokIntegrations,
  tiktokAdAccounts,
  tiktokCampaignSnapshots,
} from "../../../drizzle/schema";
import { fetchAdvertiserInfo } from "./tiktokApiClient";

// ─── Integration CRUD ────────────────────────────────────────────────────────

export async function getTikTokIntegration() {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(tiktokIntegrations).where(eq(tiktokIntegrations.isActive, 1)).limit(1);
  return row ?? null;
}

export async function upsertTikTokIntegration(appId: string, appSecret: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getTikTokIntegration();
  if (existing) {
    await db
      .update(tiktokIntegrations)
      .set({ appId, appSecret })
      .where(eq(tiktokIntegrations.id, existing.id));
    return existing.id;
  }

  const [result] = await db.insert(tiktokIntegrations).values({ appId, appSecret });
  return result.insertId;
}

export async function deleteTikTokIntegration(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const integration = await getTikTokIntegration();
  if (!integration) return;

  // Cascade: delete snapshots → accounts → integration
  const accounts = await db
    .select({ id: tiktokAdAccounts.id })
    .from(tiktokAdAccounts)
    .where(eq(tiktokAdAccounts.integrationId, integration.id));

  for (const account of accounts) {
    await db.delete(tiktokCampaignSnapshots).where(eq(tiktokCampaignSnapshots.adAccountId, account.id));
  }
  await db.delete(tiktokAdAccounts).where(eq(tiktokAdAccounts.integrationId, integration.id));
  await db.delete(tiktokIntegrations).where(eq(tiktokIntegrations.id, integration.id));
}

// ─── Ad Account CRUD ─────────────────────────────────────────────────────────

export async function getTikTokAdAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tiktokAdAccounts).orderBy(asc(tiktokAdAccounts.accountName));
}

export async function getActiveTikTokAdAccount() {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(tiktokAdAccounts)
    .where(eq(tiktokAdAccounts.isActive, 1))
    .limit(1);
  return row ?? null;
}

export async function addTikTokAdAccount(
  integrationId: number,
  advertiserId: string,
  accountName: string,
  accessToken: string,
): Promise<{ id: number; name: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Validate the advertiser by calling TikTok API
  const info = await fetchAdvertiserInfo(advertiserId, accessToken);
  const name = accountName || info.advertiser_name || advertiserId;

  const [result] = await db.insert(tiktokAdAccounts).values({
    integrationId,
    advertiserId,
    accountName: name,
    accessToken,
  });

  return { id: result.insertId, name };
}

export async function selectTikTokAdAccount(accountId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Deselect all, then select the target
  await db.update(tiktokAdAccounts).set({ isActive: 0 });
  await db
    .update(tiktokAdAccounts)
    .set({ isActive: 1 })
    .where(eq(tiktokAdAccounts.id, accountId));
}

export async function updateTikTokAdAccountToken(accountId: number, accessToken: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(tiktokAdAccounts)
    .set({ accessToken })
    .where(eq(tiktokAdAccounts.id, accountId));
}

export async function deleteTikTokAdAccount(accountId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(tiktokCampaignSnapshots).where(eq(tiktokCampaignSnapshots.adAccountId, accountId));
  await db.delete(tiktokAdAccounts).where(eq(tiktokAdAccounts.id, accountId));
}

// ─── Sync Campaigns ──────────────────────────────────────────────────────────

export async function syncTikTokCampaigns(adAccountId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [account] = await db
    .select()
    .from(tiktokAdAccounts)
    .where(eq(tiktokAdAccounts.id, adAccountId))
    .limit(1);

  if (!account || !account.accessToken) {
    throw new Error("Ad account not found or missing access token");
  }

  const { fetchCampaigns } = await import("./tiktokApiClient");
  const res = await fetchCampaigns(account.advertiserId, account.accessToken, { page: 1, pageSize: 100 });

  if (res.code !== 0 || !res.data?.list) {
    throw new Error(`TikTok API error: ${res.message}`);
  }

  // Clear old snapshots
  await db.delete(tiktokCampaignSnapshots).where(eq(tiktokCampaignSnapshots.adAccountId, adAccountId));

  const { mapTikTokStatus } = await import("./tiktokApiClient");
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (res.data.list.length > 0) {
    await db.insert(tiktokCampaignSnapshots).values(
      res.data.list.map((c) => ({
        adAccountId,
        campaignId: c.campaign_id,
        campaignName: c.campaign_name,
        status: mapTikTokStatus(c.status),
        objective: c.objective_type || null,
        dailyBudget: c.budget_mode === "BUDGET_MODE_DAY" ? c.budget.toString() : null,
        lifetimeBudget: c.budget_mode === "BUDGET_MODE_TOTAL" ? c.budget.toString() : null,
        rawJson: c as any,
        syncedAt: now,
      })),
    );
  }

  // Update lastSyncAt
  await db
    .update(tiktokAdAccounts)
    .set({ lastSyncAt: now })
    .where(eq(tiktokAdAccounts.id, adAccountId));

  return res.data.list.length;
}

// ─── Get Campaign Snapshots ──────────────────────────────────────────────────

export async function getActiveTikTokCampaignSnapshots() {
  const db = await getDb();
  if (!db) return [];

  const active = await getActiveTikTokAdAccount();
  if (!active) return [];

  return db
    .select()
    .from(tiktokCampaignSnapshots)
    .where(eq(tiktokCampaignSnapshots.adAccountId, active.id))
    .orderBy(asc(tiktokCampaignSnapshots.campaignName));
}

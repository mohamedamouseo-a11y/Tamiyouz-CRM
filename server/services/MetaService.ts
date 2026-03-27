import { getDb } from "../db";
import { metaIntegrations, metaAdAccounts, metaCampaignSnapshots } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

const META_GRAPH_API = "https://graph.facebook.com/v21.0";

// ─── Integration CRUD ──────────────────────────────────────────────────────

export async function getMetaIntegration() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(metaIntegrations).limit(1);
  return rows[0] ?? null;
}

export async function upsertMetaIntegration(appId: string, appSecret: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMetaIntegration();
  if (existing) {
    await db.update(metaIntegrations).set({ appId, appSecret }).where(eq(metaIntegrations.id, existing.id));
    return existing.id;
  }
  const [result] = await db.insert(metaIntegrations).values({ appId, appSecret });
  return result.insertId;
}

export async function deleteMetaIntegration() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(metaCampaignSnapshots);
  await db.delete(metaAdAccounts);
  await db.delete(metaIntegrations);
}

// ─── Ad Accounts CRUD ──────────────────────────────────────────────────────

export async function getAdAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(metaAdAccounts).orderBy(desc(metaAdAccounts.createdAt));
}

export async function getActiveAdAccount() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(metaAdAccounts).where(eq(metaAdAccounts.isActive, 1)).limit(1);
  return rows[0] ?? null;
}

export async function addAdAccount(integrationId: number, adAccountId: string, accountName: string, accessToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(metaAdAccounts).values({
    integrationId,
    adAccountId: adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`,
    accountName,
    accessToken,
    isActive: 0,
  });
  return result.insertId;
}

export async function selectAdAccount(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Deactivate all
  await db.update(metaAdAccounts).set({ isActive: 0 });
  // Activate selected
  await db.update(metaAdAccounts).set({ isActive: 1 }).where(eq(metaAdAccounts.id, accountId));
}

export async function updateAdAccountToken(accountId: number, accessToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(metaAdAccounts).set({ accessToken }).where(eq(metaAdAccounts.id, accountId));
}

export async function deleteAdAccount(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(metaCampaignSnapshots).where(eq(metaCampaignSnapshots.adAccountId, accountId));
  await db.delete(metaAdAccounts).where(eq(metaAdAccounts.id, accountId));
}

// ─── Meta API Calls ────────────────────────────────────────────────────────

async function metaFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const url = `${META_GRAPH_API}${endpoint}`;
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}access_token=${accessToken}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Meta API error");
  }
  return data;
}

export async function fetchMetaCampaigns(adAccountId: string, accessToken: string) {
  const data = await metaFetch(
    `/${adAccountId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,objective,created_time,updated_time&limit=100`,
    accessToken
  );
  return data.data || [];
}

export async function updateMetaCampaignStatus(campaignId: string, accessToken: string, newStatus: string) {
  const data = await metaFetch(
    `/${campaignId}`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ status: newStatus }),
    }
  );
  return data;
}

// ─── Update Campaign Budget via Meta API ───────────────────────────────────

export async function updateMetaCampaignBudget(campaignId: string, accessToken: string, budgetType: "daily_budget" | "lifetime_budget", amountCents: number) {
  const data = await metaFetch(
    `/${campaignId}`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ [budgetType]: amountCents }),
    }
  );
  return data;
}

// ─── Fetch Campaign Insights (Metrics) from Meta API ───────────────────────

export async function fetchCampaignInsights(campaignId: string, accessToken: string, datePreset: string = "last_30d", dateFrom?: string, dateTo?: string) {
  try {
    let dateParam = '';
    if (dateFrom && dateTo) {
      // Custom date range: use time_range instead of date_preset
      dateParam = `time_range={"since":"${dateFrom}","until":"${dateTo}"}`;
    } else {
      dateParam = `date_preset=${datePreset}`;
    }
    const data = await metaFetch(
      `/${campaignId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type,purchase_roas&${dateParam}`,
      accessToken
    );
    return data.data?.[0] || null;
  } catch (err: any) {
    console.error(`[MetaService] Failed to fetch insights for campaign ${campaignId}:`, err.message);
    return null;
  }
}

// ─── Fetch Insights for All Active Campaigns ───────────────────────────────

export async function fetchAllCampaignInsights(accountDbId: number, datePreset: string = "last_30d", dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const account = await db.select().from(metaAdAccounts).where(eq(metaAdAccounts.id, accountDbId)).limit(1);
  if (!account[0] || !account[0].accessToken) {
    throw new Error("Ad account not found or missing access token");
  }

  const campaigns = await db.select().from(metaCampaignSnapshots)
    .where(eq(metaCampaignSnapshots.adAccountId, accountDbId));

  const insightsMap: Record<string, any> = {};

  // Fetch insights for each campaign (batch)
  for (const c of campaigns) {
    const insights = await fetchCampaignInsights(c.campaignId, account[0].accessToken, datePreset, dateFrom, dateTo);
    if (insights) {
      // Extract leads count from actions
      // Find leads from all possible lead action types
      const leadActionTypes = ["lead", "leadgen.other", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];
      const leadAction = insights.actions?.find((a: any) => leadActionTypes.includes(a.action_type));
      const purchaseAction = insights.actions?.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
      const messagingAction = insights.actions?.find((a: any) => a.action_type === "onsite_conversion.messaging_conversation_started_7d");

      // Extract CPL from cost_per_action_type
      const cplAction = insights.cost_per_action_type?.find((a: any) => leadActionTypes.includes(a.action_type));
      const costPerPurchase = insights.cost_per_action_type?.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
      const costPerMessage = insights.cost_per_action_type?.find((a: any) => a.action_type === "onsite_conversion.messaging_conversation_started_7d");

      // ROAS from purchase_roas
      const roas = insights.purchase_roas?.[0]?.value || null;

      insightsMap[c.campaignId] = {
        spend: insights.spend || "0",
        impressions: insights.impressions || "0",
        clicks: insights.clicks || "0",
        ctr: insights.ctr || "0",
        cpc: insights.cpc || "0",
        cpm: insights.cpm || "0",
        leads: leadAction?.value || "0",
        purchases: purchaseAction?.value || "0",
        messages: messagingAction?.value || "0",
        cpl: cplAction?.value || null,
        costPerPurchase: costPerPurchase?.value || null,
        costPerMessage: costPerMessage?.value || null,
        roas: roas,
      };
    }
  }

  return insightsMap;
}

export async function fetchAdAccountInfo(adAccountId: string, accessToken: string) {
  const data = await metaFetch(
    `/${adAccountId}?fields=name,account_id,account_status,currency,timezone_name`,
    accessToken
  );
  return data;
}

// ─── Sync Campaigns ────────────────────────────────────────────────────────

export async function syncCampaigns(accountDbId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const account = await db.select().from(metaAdAccounts).where(eq(metaAdAccounts.id, accountDbId)).limit(1);
  if (!account[0] || !account[0].accessToken) {
    throw new Error("Ad account not found or missing access token");
  }

  const campaigns = await fetchMetaCampaigns(account[0].adAccountId, account[0].accessToken);

  for (const c of campaigns) {
    const existing = await db.select().from(metaCampaignSnapshots)
      .where(and(
        eq(metaCampaignSnapshots.adAccountId, accountDbId),
        eq(metaCampaignSnapshots.campaignId, c.id)
      ))
      .limit(1);

    const dailyBudget = c.daily_budget ? (parseFloat(c.daily_budget) / 100).toFixed(2) : null;
    const lifetimeBudget = c.lifetime_budget ? (parseFloat(c.lifetime_budget) / 100).toFixed(2) : null;

    if (existing[0]) {
      await db.update(metaCampaignSnapshots).set({
        campaignName: c.name,
        status: c.status,
        dailyBudget: dailyBudget,
        lifetimeBudget: lifetimeBudget,
        objective: c.objective,
        rawJson: c,
        syncedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      }).where(eq(metaCampaignSnapshots.id, existing[0].id));
    } else {
      await db.insert(metaCampaignSnapshots).values({
        adAccountId: accountDbId,
        campaignId: c.id,
        campaignName: c.name,
        status: c.status,
        dailyBudget: dailyBudget,
        lifetimeBudget: lifetimeBudget,
        objective: c.objective,
        rawJson: c,
      });
    }
  }

  // Update last sync time
  await db.update(metaAdAccounts).set({
    lastSyncAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  }).where(eq(metaAdAccounts.id, accountDbId));

  return campaigns.length;
}

// ─── Get Campaigns from DB ─────────────────────────────────────────────────

export async function getCampaignSnapshots(accountDbId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(metaCampaignSnapshots)
    .where(eq(metaCampaignSnapshots.adAccountId, accountDbId))
    .orderBy(desc(metaCampaignSnapshots.syncedAt));
}

export async function getActiveCampaignSnapshots() {
  const active = await getActiveAdAccount();
  if (!active) return [];
  return getCampaignSnapshots(active.id);
}

// ─── Update Campaign Status via Meta API + DB ──────────────────────────────

export async function changeCampaignStatus(snapshotId: number, newStatus: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const snapshot = await db.select().from(metaCampaignSnapshots)
    .where(eq(metaCampaignSnapshots.id, snapshotId))
    .limit(1);

  if (!snapshot[0]) throw new Error("Campaign snapshot not found");

  const account = await db.select().from(metaAdAccounts)
    .where(eq(metaAdAccounts.id, snapshot[0].adAccountId))
    .limit(1);

  if (!account[0] || !account[0].accessToken) {
    throw new Error("Ad account not found or missing access token");
  }

  // Update on Meta
  await updateMetaCampaignStatus(snapshot[0].campaignId, account[0].accessToken, newStatus);

  // Update in DB
  await db.update(metaCampaignSnapshots).set({
    status: newStatus,
    syncedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  }).where(eq(metaCampaignSnapshots.id, snapshotId));

  return { success: true };
}

// ─── Update Campaign Budget via Meta API + DB ──────────────────────────────

export async function changeCampaignBudget(snapshotId: number, budgetType: "daily" | "lifetime", amount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const snapshot = await db.select().from(metaCampaignSnapshots)
    .where(eq(metaCampaignSnapshots.id, snapshotId))
    .limit(1);

  if (!snapshot[0]) throw new Error("Campaign snapshot not found");

  const account = await db.select().from(metaAdAccounts)
    .where(eq(metaAdAccounts.id, snapshot[0].adAccountId))
    .limit(1);

  if (!account[0] || !account[0].accessToken) {
    throw new Error("Ad account not found or missing access token");
  }

  // Meta API expects budget in cents
  const amountCents = Math.round(amount * 100);
  const metaBudgetField = budgetType === "daily" ? "daily_budget" : "lifetime_budget";

  // Update on Meta
  await updateMetaCampaignBudget(snapshot[0].campaignId, account[0].accessToken, metaBudgetField, amountCents);

  // Update in DB
  const updateData: any = {
    syncedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
  if (budgetType === "daily") {
    updateData.dailyBudget = amount.toFixed(2);
  } else {
    updateData.lifetimeBudget = amount.toFixed(2);
  }
  await db.update(metaCampaignSnapshots).set(updateData).where(eq(metaCampaignSnapshots.id, snapshotId));

  return { success: true };
}

/**
 * TikTok Campaign Analytics Service
 * Adapted from ChatGPT's service: SQLite → MySQL, mock → real API, tenant → CRM auth
 * Follows the same pattern as metaCombinedAnalyticsService.ts
 */
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import {
  tiktokAdAccounts,
  tiktokCampaignSnapshots,
  tiktokIntegrations,
} from "../../../drizzle/schema";
import {
  fetchCampaigns,
  fetchCampaignReport,
  mapTikTokStatus,
} from "./tiktokApiClient";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TikTokCampaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  dailyBudget: number | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface TikTokCampaignFilters {
  dateFrom: string;
  dateTo: string;
  minSpend?: number;
  maxSpend?: number;
  status?: string[];
  objectives?: string[];
}

export interface TikTokCampaignAnalyticsSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  avgCpa: number;
}

export interface TikTokCampaignAnalyticsResponse {
  data: TikTokCampaign[];
  summary: TikTokCampaignAnalyticsSummary;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

function round(value: number): number {
  return Number(value.toFixed(2));
}

function emptyAnalyticsResponse(): TikTokCampaignAnalyticsResponse {
  return {
    data: [],
    summary: {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      avgCtr: 0,
      avgCpc: 0,
      avgCpa: 0,
    },
  };
}

function applyFilters(campaigns: TikTokCampaign[], filters: TikTokCampaignFilters): TikTokCampaign[] {
  return campaigns.filter((campaign) => {
    if (filters.minSpend !== undefined && campaign.spend < filters.minSpend) return false;
    if (filters.maxSpend !== undefined && campaign.spend > filters.maxSpend) return false;
    if (filters.status?.length && !filters.status.includes(campaign.status)) return false;
    if (filters.objectives?.length) {
      if (!campaign.objective || !filters.objectives.includes(campaign.objective)) return false;
    }
    return true;
  });
}

function buildSummary(campaigns: TikTokCampaign[]): TikTokCampaignAnalyticsSummary {
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);

  return {
    totalSpend: round(totalSpend),
    totalImpressions,
    totalClicks,
    totalConversions,
    avgCtr: totalImpressions > 0 ? round((totalClicks / totalImpressions) * 100) : 0,
    avgCpc: totalClicks > 0 ? round(totalSpend / totalClicks) : 0,
    avgCpa: totalConversions > 0 ? round(totalSpend / totalConversions) : 0,
  };
}

// ─── Main Service Function ───────────────────────────────────────────────────

export async function getTikTokCampaignAnalytics(
  filters: TikTokCampaignFilters,
): Promise<TikTokCampaignAnalyticsResponse> {
  const db = await getDb();
  if (!db) return emptyAnalyticsResponse();

  // Get active TikTok integration
  const [integration] = await db
    .select()
    .from(tiktokIntegrations)
    .where(eq(tiktokIntegrations.isActive, 1))
    .limit(1);

  if (!integration) return emptyAnalyticsResponse();

  // Get active ad account
  const [activeAccount] = await db
    .select()
    .from(tiktokAdAccounts)
    .where(
      and(
        eq(tiktokAdAccounts.integrationId, integration.id),
        eq(tiktokAdAccounts.isActive, 1),
      )
    )
    .limit(1);

  if (!activeAccount || !activeAccount.accessToken) return emptyAnalyticsResponse();

  // Check for fresh snapshots (TTL cache)
  const freshnessCutoff = new Date(Date.now() - SNAPSHOT_TTL_MS).toISOString().slice(0, 19).replace("T", " ");
  const freshSnapshots = await db
    .select()
    .from(tiktokCampaignSnapshots)
    .where(
      and(
        eq(tiktokCampaignSnapshots.adAccountId, activeAccount.id),
        gte(tiktokCampaignSnapshots.syncedAt, freshnessCutoff),
      )
    )
    .orderBy(desc(tiktokCampaignSnapshots.syncedAt));

  let campaigns: TikTokCampaign[];

  if (freshSnapshots.length > 0) {
    // Use cached snapshots
    campaigns = freshSnapshots.map((s) => ({
      id: s.campaignId,
      name: s.campaignName ?? "",
      status: s.status ?? "UNKNOWN",
      objective: s.objective,
      dailyBudget: s.dailyBudget ? Number(s.dailyBudget) : null,
      impressions: s.impressions,
      clicks: s.clicks,
      spend: Number(s.spend),
      conversions: s.conversions,
      ctr: Number(s.ctr),
      cpc: Number(s.cpc),
      cpa: Number(s.cpa),
    }));
  } else {
    // Fetch from TikTok API
    try {
      // 1. Get campaign list
      const campaignsRes = await fetchCampaigns(
        activeAccount.advertiserId,
        activeAccount.accessToken,
        { page: 1, pageSize: 100 },
      );

      if (campaignsRes.code !== 0 || !campaignsRes.data?.list?.length) {
        return emptyAnalyticsResponse();
      }

      // 2. Get campaign report/insights
      const reportRes = await fetchCampaignReport(
        activeAccount.advertiserId,
        activeAccount.accessToken,
        filters.dateFrom,
        filters.dateTo,
        { page: 1, pageSize: 100 },
      );

      // Build metrics map from report
      const metricsMap = new Map<string, {
        spend: number; impressions: number; clicks: number;
        conversions: number; ctr: number; cpc: number; cpa: number;
      }>();

      if (reportRes.code === 0 && reportRes.data?.list) {
        for (const item of reportRes.data.list) {
          const m = item.metrics;
          metricsMap.set(item.dimensions.campaign_id, {
            spend: parseFloat(m.spend) || 0,
            impressions: parseInt(m.impressions) || 0,
            clicks: parseInt(m.clicks) || 0,
            conversions: parseInt(m.conversion) || 0,
            ctr: parseFloat(m.ctr) || 0,
            cpc: parseFloat(m.cpc) || 0,
            cpa: parseFloat(m.cost_per_conversion) || 0,
          });
        }
      }

      // 3. Merge campaign info + metrics
      campaigns = campaignsRes.data.list.map((c) => {
        const metrics = metricsMap.get(c.campaign_id);
        const impressions = metrics?.impressions ?? 0;
        const clicks = metrics?.clicks ?? 0;
        const spend = metrics?.spend ?? 0;
        const conversions = metrics?.conversions ?? 0;

        return {
          id: c.campaign_id,
          name: c.campaign_name,
          status: mapTikTokStatus(c.status),
          objective: c.objective_type || null,
          dailyBudget: c.budget_mode === "BUDGET_MODE_DAY" ? c.budget : null,
          impressions,
          clicks,
          spend,
          conversions,
          ctr: metrics?.ctr ?? (impressions > 0 ? round((clicks / impressions) * 100) : 0),
          cpc: metrics?.cpc ?? (clicks > 0 ? round(spend / clicks) : 0),
          cpa: metrics?.cpa ?? (conversions > 0 ? round(spend / conversions) : 0),
        };
      });

      // 4. Save snapshots to DB (clear old + insert new)
      await db
        .delete(tiktokCampaignSnapshots)
        .where(eq(tiktokCampaignSnapshots.adAccountId, activeAccount.id));

      if (campaigns.length > 0) {
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        await db.insert(tiktokCampaignSnapshots).values(
          campaigns.map((c) => ({
            adAccountId: activeAccount.id,
            campaignId: c.id,
            campaignName: c.name,
            status: c.status,
            objective: c.objective,
            dailyBudget: c.dailyBudget?.toString() ?? null,
            impressions: c.impressions,
            clicks: c.clicks,
            spend: c.spend.toString(),
            conversions: c.conversions,
            ctr: c.ctr.toString(),
            cpc: c.cpc.toString(),
            cpa: c.cpa.toString(),
            rawJson: {
              source: "tiktok_business_api",
              dateFrom: filters.dateFrom,
              dateTo: filters.dateTo,
            },
            syncedAt: now,
          })),
        );

        // Update lastSyncAt on the ad account
        await db
          .update(tiktokAdAccounts)
          .set({ lastSyncAt: now })
          .where(eq(tiktokAdAccounts.id, activeAccount.id));
      }
    } catch (error: any) {
      console.error("[TikTok] API fetch error:", error?.message || error);
      // Fall back to any existing snapshots (even stale)
      const staleSnapshots = await db
        .select()
        .from(tiktokCampaignSnapshots)
        .where(eq(tiktokCampaignSnapshots.adAccountId, activeAccount.id))
        .orderBy(desc(tiktokCampaignSnapshots.syncedAt));

      if (staleSnapshots.length > 0) {
        campaigns = staleSnapshots.map((s) => ({
          id: s.campaignId,
          name: s.campaignName ?? "",
          status: s.status ?? "UNKNOWN",
          objective: s.objective,
          dailyBudget: s.dailyBudget ? Number(s.dailyBudget) : null,
          impressions: s.impressions,
          clicks: s.clicks,
          spend: Number(s.spend),
          conversions: s.conversions,
          ctr: Number(s.ctr),
          cpc: Number(s.cpc),
          cpa: Number(s.cpa),
        }));
      } else {
        return emptyAnalyticsResponse();
      }
    }
  }

  // Apply client-side filters
  const filteredCampaigns = applyFilters(campaigns, filters);

  return {
    data: filteredCampaigns,
    summary: buildSummary(filteredCampaigns),
  };
}

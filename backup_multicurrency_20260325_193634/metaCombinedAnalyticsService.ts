import { getDb } from "../db";
import { sql } from "drizzle-orm";
import {
  campaigns,
  leads,
  deals,
  metaCampaignSnapshots,
  metaAdAccounts,
} from "../../drizzle/schema";
import { eq, and, gte, lte, isNull, desc, inArray } from "drizzle-orm";
import Decimal from "decimal.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetaCombinedFilters {
  dateFrom?: string;
  dateTo?: string;
  campaignIds?: number[];
  minSpend?: number;
  datePreset?: string;
}

export interface MetaCombinedCampaign {
  campaignId: number;
  campaignName: string;
  platform: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  // Lead metrics from CRM
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  badLeads: number;
  unknownLeads: number;
  // Deal metrics
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  pendingDeals: number;
  totalRevenue: number;
  // Meta Ad metrics (from insights API)
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  metaLeads: number;
  // Calculated KPIs
  cpl: number;
  roi: number;
  conversionRate: number;
}

export interface MetaCombinedSummary {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpend: number;
  totalRevenue: number;
  totalLeads: number;
  totalDeals: number;
  wonDeals: number;
  overallROI: number;
  averageCPL: number;
  averageCTR: number;
  averageConversionRate: number;
  totalImpressions: number;
  totalClicks: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  badLeads: number;
}

export interface MetaCombinedResponse {
  campaigns: MetaCombinedCampaign[];
  summary: MetaCombinedSummary;
}

// ─── Helper: Fetch Meta Insights ──────────────────────────────────────────────

const META_GRAPH_API = "https://graph.facebook.com/v21.0";

async function fetchCampaignInsightsInternal(
  campaignId: string,
  accessToken: string,
  datePreset: string = "last_30d"
) {
  try {
    const url = `${META_GRAPH_API}/${campaignId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type,purchase_roas&date_preset=${datePreset}&access_token=${accessToken}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (data.error) return null;
    return data.data?.[0] || null;
  } catch {
    return null;
  }
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export async function getMetaCombinedAnalytics(
  filters: MetaCombinedFilters = {}
): Promise<MetaCombinedResponse> {
  const db = await getDb();
  if (!db) {
    return { campaigns: [], summary: getEmptySummary() };
  }

  const { dateFrom, dateTo, campaignIds, minSpend, datePreset = "last_30d" } = filters;

  // 1. Get all campaigns from CRM
  let campaignRows: any[];
  if (campaignIds && campaignIds.length > 0) {
    campaignRows = await db
      .select()
      .from(campaigns)
      .where(
        and(isNull(campaigns.deletedAt), inArray(campaigns.id, campaignIds))
      );
  } else {
    campaignRows = await db
      .select()
      .from(campaigns)
      .where(isNull(campaigns.deletedAt));
  }

  // 2. Get active Meta ad account and its campaign snapshots
  const activeAccount = await db
    .select()
    .from(metaAdAccounts)
    .where(eq(metaAdAccounts.isActive, 1))
    .limit(1);

  const metaAccount = activeAccount[0] ?? null;
  let metaSnapshots: any[] = [];
  let insightsMap: Record<string, any> = {};

  if (metaAccount) {
    metaSnapshots = await db
      .select()
      .from(metaCampaignSnapshots)
      .where(eq(metaCampaignSnapshots.adAccountId, metaAccount.id));

    // Fetch insights for each Meta campaign
    if (metaAccount.accessToken) {
      for (const snap of metaSnapshots) {
        const insights = await fetchCampaignInsightsInternal(
          snap.campaignId,
          metaAccount.accessToken,
          datePreset
        );
        if (insights) {
          const leadAction = insights.actions?.find(
            (a: any) =>
              a.action_type === "lead" ||
              a.action_type === "onsite_conversion.lead_grouped"
          );
          const cplAction = insights.cost_per_action_type?.find(
            (a: any) =>
              a.action_type === "lead" ||
              a.action_type === "onsite_conversion.lead_grouped"
          );
          insightsMap[snap.campaignName?.toLowerCase() ?? ""] = {
            spend: parseFloat(insights.spend || "0"),
            impressions: parseInt(insights.impressions || "0"),
            clicks: parseInt(insights.clicks || "0"),
            ctr: parseFloat(insights.ctr || "0"),
            cpc: parseFloat(insights.cpc || "0"),
            cpm: parseFloat(insights.cpm || "0"),
            metaLeads: parseInt(leadAction?.value || "0"),
            cpl: parseFloat(cplAction?.value || "0"),
          };
        }
      }
    }
  }

  // 3. For each CRM campaign, get leads and deals
  const result: MetaCombinedCampaign[] = [];

  for (const camp of campaignRows) {
    // Get leads for this campaign (linked by campaignName)
    let leadConditions: any[] = [
      isNull(leads.deletedAt),
      eq(leads.campaignName, camp.name),
    ];
    if (dateFrom) {
      leadConditions.push(gte(leads.createdAt, dateFrom));
    }
    if (dateTo) {
      leadConditions.push(lte(leads.createdAt, dateTo));
    }

    const campaignLeads = await db
      .select()
      .from(leads)
      .where(and(...leadConditions));

    // Count lead quality
    let hotLeads = 0,
      warmLeads = 0,
      coldLeads = 0,
      badLeads = 0,
      unknownLeads = 0;
    const leadIds: number[] = [];

    for (const lead of campaignLeads) {
      leadIds.push(lead.id);
      switch (lead.leadQuality) {
        case "Hot":
          hotLeads++;
          break;
        case "Warm":
          warmLeads++;
          break;
        case "Cold":
          coldLeads++;
          break;
        case "Bad":
          badLeads++;
          break;
        default:
          unknownLeads++;
          break;
      }
    }

    // Get deals for these leads (deals linked by leadId)
    let campaignDeals: any[] = [];
    if (leadIds.length > 0) {
      campaignDeals = await db
        .select()
        .from(deals)
        .where(and(isNull(deals.deletedAt), inArray(deals.leadId, leadIds)));
    }

    let wonDeals = 0,
      lostDeals = 0,
      pendingDeals = 0,
      totalRevenue = 0;
    for (const deal of campaignDeals) {
      switch (deal.status) {
        case "Won":
          wonDeals++;
          totalRevenue += parseFloat(deal.valueSar || "0");
          break;
        case "Lost":
          lostDeals++;
          break;
        default:
          pendingDeals++;
          break;
      }
    }

    // Match with Meta insights by campaign name
    const metaInsight =
      insightsMap[camp.name?.toLowerCase() ?? ""] || null;

    const spend = metaInsight?.spend || 0;
    const impressions = metaInsight?.impressions || 0;
    const clicks = metaInsight?.clicks || 0;
    const ctr = metaInsight?.ctr || 0;
    const cpc = metaInsight?.cpc || 0;
    const cpm = metaInsight?.cpm || 0;
    const metaLeads = metaInsight?.metaLeads || 0;

    // Calculate KPIs
    const totalLeads = campaignLeads.length;
    const cpl =
      totalLeads > 0
        ? new Decimal(spend).div(totalLeads).toDecimalPlaces(2).toNumber()
        : 0;
    const roi =
      spend > 0
        ? new Decimal(totalRevenue)
            .minus(spend)
            .div(spend)
            .times(100)
            .toDecimalPlaces(2)
            .toNumber()
        : 0;
    const conversionRate =
      totalLeads > 0
        ? new Decimal(wonDeals)
            .div(totalLeads)
            .times(100)
            .toDecimalPlaces(2)
            .toNumber()
        : 0;

    // Apply minSpend filter
    if (minSpend && spend < minSpend) continue;

    const metaSnap = metaSnapshots.find(
      (s) => s.campaignName?.toLowerCase() === camp.name?.toLowerCase()
    );

    result.push({
      campaignId: camp.id,
      campaignName: camp.name,
      platform: camp.platform || "Meta",
      status: metaSnap?.status || (camp.isActive ? "ACTIVE" : "PAUSED"),
      startDate: camp.startDate || null,
      endDate: camp.endDate || null,
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      badLeads,
      unknownLeads,
      totalDeals: campaignDeals.length,
      wonDeals,
      lostDeals,
      pendingDeals,
      totalRevenue,
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      cpm,
      metaLeads,
      cpl,
      roi,
      conversionRate,
    });
  }

  // 4. Build summary
  const summary = buildSummary(result);

  return { campaigns: result, summary };
}

// ─── Summary Builder ──────────────────────────────────────────────────────────

function buildSummary(campaigns: MetaCombinedCampaign[]): MetaCombinedSummary {
  if (campaigns.length === 0) return getEmptySummary();

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(
    (c) => c.status === "ACTIVE" || c.status === "active"
  ).length;

  let totalSpend = new Decimal(0);
  let totalRevenue = new Decimal(0);
  let totalLeads = 0;
  let totalDeals = 0;
  let wonDeals = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let hotLeads = 0;
  let warmLeads = 0;
  let coldLeads = 0;
  let badLeads = 0;
  let ctrSum = new Decimal(0);
  let ctrCount = 0;

  for (const c of campaigns) {
    totalSpend = totalSpend.plus(c.spend);
    totalRevenue = totalRevenue.plus(c.totalRevenue);
    totalLeads += c.totalLeads;
    totalDeals += c.totalDeals;
    wonDeals += c.wonDeals;
    totalImpressions += c.impressions;
    totalClicks += c.clicks;
    hotLeads += c.hotLeads;
    warmLeads += c.warmLeads;
    coldLeads += c.coldLeads;
    badLeads += c.badLeads;
    if (c.ctr > 0) {
      ctrSum = ctrSum.plus(c.ctr);
      ctrCount++;
    }
  }

  const totalSpendNum = totalSpend.toNumber();
  const totalRevenueNum = totalRevenue.toNumber();

  const overallROI =
    totalSpendNum > 0
      ? new Decimal(totalRevenueNum)
          .minus(totalSpendNum)
          .div(totalSpendNum)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber()
      : 0;

  const averageCPL =
    totalLeads > 0
      ? totalSpend.div(totalLeads).toDecimalPlaces(2).toNumber()
      : 0;

  const averageCTR =
    ctrCount > 0
      ? ctrSum.div(ctrCount).toDecimalPlaces(2).toNumber()
      : 0;

  const averageConversionRate =
    totalLeads > 0
      ? new Decimal(wonDeals)
          .div(totalLeads)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber()
      : 0;

  return {
    totalCampaigns,
    activeCampaigns,
    totalSpend: totalSpendNum,
    totalRevenue: totalRevenueNum,
    totalLeads,
    totalDeals,
    wonDeals,
    overallROI,
    averageCPL,
    averageCTR,
    averageConversionRate,
    totalImpressions,
    totalClicks,
    hotLeads,
    warmLeads,
    coldLeads,
    badLeads,
  };
}

function getEmptySummary(): MetaCombinedSummary {
  return {
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalSpend: 0,
    totalRevenue: 0,
    totalLeads: 0,
    totalDeals: 0,
    wonDeals: 0,
    overallROI: 0,
    averageCPL: 0,
    averageCTR: 0,
    averageConversionRate: 0,
    totalImpressions: 0,
    totalClicks: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    badLeads: 0,
  };
}

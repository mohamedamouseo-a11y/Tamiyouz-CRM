/**
 * MetaAuditService
 * - Compares Meta leads (from Graph API) vs CRM leads to find missing/mismatched leads
 * - Calculates ROAS per campaign and per ad/creative using CRM deal values and Meta spend
 * - Optimized: uses account-level insights to avoid rate limits
 */
import { and, eq, isNull, isNotNull, sql, ne, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  leads,
  deals,
  metaAdAccounts,
  metaCampaignSnapshots,
  metaLeadgenConfig,
} from "../../drizzle/schema";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

async function graphFetch(endpoint: string, accessToken: string) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${GRAPH_API_BASE}${endpoint}${sep}access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API error ${res.status}: ${body}`);
  }
  return res.json();
}

// Helper: delay between API calls to avoid rate limits
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Leads Comparison ──────────────────────────────────────────────────────────

interface MetaLead {
  id: string;
  created_time: string;
  field_data?: { name: string; values: string[] }[];
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
}

interface ComparisonResult {
  summary: {
    metaTotal: number;
    crmTotal: number;
    matched: number;
    missingInCrm: number;
    extraInCrm: number;
    syncRate: string;
  };
  missingLeads: {
    metaLeadId: string;
    name: string;
    phone: string;
    createdTime: string;
    formName: string;
    campaignName: string;
    adName: string;
  }[];
  formBreakdown: {
    formId: string;
    formName: string;
    metaCount: number;
    crmCount: number;
    missing: number;
    syncRate: string;
  }[];
}

export async function compareMetaVsCrmLeads(
  dateFrom?: string,
  dateTo?: string,
): Promise<ComparisonResult> {
  const db = await getDb();

  // 1. Get all leadgen configs (pages)
  const configs = await db
    .select()
    .from(metaLeadgenConfig)
    .where(eq(metaLeadgenConfig.isEnabled, 1));

  if (!configs.length) {
    return {
      summary: { metaTotal: 0, crmTotal: 0, matched: 0, missingInCrm: 0, extraInCrm: 0, syncRate: "0%" },
      missingLeads: [],
      formBreakdown: [],
    };
  }

  // 2. Fetch all leads from Meta for each page's forms
  const allMetaLeads: (MetaLead & { formName: string })[] = [];
  const formMap: Record<string, { formName: string; metaCount: number }> = {};

  for (const config of configs) {
    try {
      // Get forms for this page
      const formsData = await graphFetch(
        `/${config.pageId}/leadgen_forms?fields=id,name,status&limit=100`,
        config.pageAccessToken,
      );
      const forms = formsData.data || [];

      for (const form of forms) {
        const formId = form.id;
        const formName = form.name || formId;
        formMap[formId] = { formName, metaCount: 0 };

        // Fetch leads from this form
        let url = `/${formId}/leads?fields=id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform&limit=100`;
        if (dateFrom) {
          const fromTs = Math.floor(new Date(dateFrom).getTime() / 1000);
          url += `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${fromTs}}]`;
        }

        let hasMore = true;
        while (hasMore) {
          const data = await graphFetch(url, config.pageAccessToken);
          const pageLeads: MetaLead[] = data.data || [];

          for (const lead of pageLeads) {
            // Filter by dateTo if specified
            if (dateTo && new Date(lead.created_time) > new Date(dateTo + "T23:59:59")) continue;
            // Skip test leads
            if (lead.field_data?.some((f) => f.values?.[0]?.toLowerCase() === "test")) continue;

            allMetaLeads.push({ ...lead, formName });
            formMap[formId].metaCount++;
          }

          if (data.paging?.next) {
            const nextUrl = new URL(data.paging.next);
            url = nextUrl.pathname.replace("/v21.0", "") + nextUrl.search;
            url = url.replace(/[&?]access_token=[^&]+/, "");
          } else {
            hasMore = false;
          }
        }
        // Small delay between form fetches
        await delay(200);
      }
    } catch (err: any) {
      console.error(`[MetaAudit] Error fetching leads for page ${config.pageId}:`, err.message);
    }
  }

  // 3. Get CRM leads with externalId (Meta leads)
  const crmLeads = await db
    .select({
      id: leads.id,
      externalId: leads.externalId,
      name: leads.name,
      campaignName: leads.campaignName,
    })
    .from(leads)
    .where(and(isNotNull(leads.externalId), ne(leads.externalId, ""), isNull(leads.deletedAt)));

  const crmExternalIds = new Set(crmLeads.map((l) => l.externalId));

  // 4. Compare
  const matched = allMetaLeads.filter((ml) => crmExternalIds.has(ml.id));
  const missingInCrm = allMetaLeads.filter((ml) => !crmExternalIds.has(ml.id));

  // 5. Build form breakdown
  const formBreakdown = Object.entries(formMap).map(([formId, info]) => {
    const formMetaLeads = allMetaLeads.filter(
      (ml) => ml.form_id === formId || ml.formName === info.formName,
    );
    const formCrmCount = formMetaLeads.filter((ml) => crmExternalIds.has(ml.id)).length;
    const missing = info.metaCount - formCrmCount;
    return {
      formId,
      formName: info.formName,
      metaCount: info.metaCount,
      crmCount: formCrmCount,
      missing,
      syncRate: info.metaCount > 0 ? ((formCrmCount / info.metaCount) * 100).toFixed(1) + "%" : "N/A",
    };
  });

  // 6. Build missing leads details
  const missingLeadDetails = missingInCrm.map((ml) => {
    const nameField = ml.field_data?.find((f) => f.name === "full_name" || f.name === "name");
    const phoneField = ml.field_data?.find((f) => f.name === "phone_number" || f.name === "phone");
    return {
      metaLeadId: ml.id,
      name: nameField?.values?.[0] || "N/A",
      phone: phoneField?.values?.[0] || "N/A",
      createdTime: ml.created_time,
      formName: ml.formName,
      campaignName: ml.campaign_name || "N/A",
      adName: ml.ad_name || "N/A",
    };
  });

  const metaTotal = allMetaLeads.length;
  const crmTotal = crmLeads.length;
  const matchedCount = matched.length;

  return {
    summary: {
      metaTotal,
      crmTotal,
      matched: matchedCount,
      missingInCrm: missingInCrm.length,
      extraInCrm: Math.max(0, crmTotal - matchedCount),
      syncRate: metaTotal > 0 ? ((matchedCount / metaTotal) * 100).toFixed(1) + "%" : "N/A",
    },
    missingLeads: missingLeadDetails,
    formBreakdown,
  };
}

// ─── ROAS Calculation (Optimized - Account-Level Batch) ──────────────────────

interface AdRoas {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  metaLeads: number;
  crmLeads: number;
  dealsCount: number;
  wonDealsCount: number;
  totalRevenue: number;
  wonRevenue: number;
  roas: number | null;
  cpl: number | null;
  costPerDeal: number | null;
}

interface CampaignRoas {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  metaLeads: number;
  crmLeads: number;
  dealsCount: number;
  wonDealsCount: number;
  totalRevenue: number;
  wonRevenue: number;
  roas: number | null;
  cpl: number | null;
  costPerDeal: number | null;
  ads: AdRoas[];
}

interface RoasResult {
  summary: {
    totalSpend: number;
    totalRevenue: number;
    totalWonRevenue: number;
    overallRoas: number | null;
    totalLeads: number;
    totalCrmLeads: number;
    totalDeals: number;
    totalWonDeals: number;
    avgCpl: number | null;
    totalImpressions: number;
    totalClicks: number;
  };
  campaigns: CampaignRoas[];
}

export async function calculateRoas(
  dateFrom?: string,
  dateTo?: string,
  datePreset: string = "last_30d",
): Promise<RoasResult> {
  const db = await getDb();

  // 1. Get active ad account
  const [account] = await db
    .select()
    .from(metaAdAccounts)
    .where(eq(metaAdAccounts.isActive, 1))
    .limit(1);

  if (!account || !account.accessToken) {
    return {
      summary: {
        totalSpend: 0, totalRevenue: 0, totalWonRevenue: 0, overallRoas: null,
        totalLeads: 0, totalCrmLeads: 0, totalDeals: 0, totalWonDeals: 0, avgCpl: null,
        totalImpressions: 0, totalClicks: 0,
      },
      campaigns: [],
    };
  }

  // 2. Build date params for Meta API
  let dateParam = "";
  if (dateFrom && dateTo) {
    dateParam = `time_range={"since":"${dateFrom}","until":"${dateTo}"}`;
  } else {
    dateParam = `date_preset=${datePreset}`;
  }

  // 3. Fetch ALL ad-level insights in ONE request at account level
  // This avoids rate limits by making 1 request instead of N requests per campaign
  console.log("[MetaAudit] Fetching account-level ad insights (single batch request)...");
  
  const adInsightsMap: Record<string, any> = {};
  const campaignMap: Record<string, { id: string; name: string; ads: any[] }> = {};

  try {
    let url = `/${account.adAccountId}/insights?fields=ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,actions,cost_per_action_type&level=ad&${dateParam}&limit=500`;
    let hasMore = true;

    while (hasMore) {
      const data = await graphFetch(url, account.accessToken);
      const insights = data.data || [];

      for (const insight of insights) {
        const adId = insight.ad_id;
        const campaignId = insight.campaign_id;
        const campaignName = insight.campaign_name || campaignId;

        adInsightsMap[adId] = insight;

        if (!campaignMap[campaignId]) {
          campaignMap[campaignId] = { id: campaignId, name: campaignName, ads: [] };
        }
        campaignMap[campaignId].ads.push(insight);
      }

      if (data.paging?.next) {
        const nextUrl = new URL(data.paging.next);
        url = nextUrl.pathname.replace("/v21.0", "") + nextUrl.search;
        url = url.replace(/[&?]access_token=[^&]+/, "");
      } else {
        hasMore = false;
      }
    }
  } catch (err: any) {
    console.error("[MetaAudit] Error fetching account-level insights:", err.message);
  }

  console.log(`[MetaAudit] Got insights for ${Object.keys(adInsightsMap).length} ads across ${Object.keys(campaignMap).length} campaigns`);

  // 4. Get ALL CRM leads with their sourceMetadata for ad_id matching
  const allCrmLeads = await db
    .select({
      id: leads.id,
      name: leads.name,
      campaignName: leads.campaignName,
      sourceMetadata: leads.sourceMetadata,
    })
    .from(leads)
    .where(and(isNotNull(leads.externalId), ne(leads.externalId, ""), isNull(leads.deletedAt)));

  // Build a map of ad_id -> lead IDs
  const adIdToLeadIds: Record<string, number[]> = {};
  const campaignNameToLeadIds: Record<string, number[]> = {};

  for (const lead of allCrmLeads) {
    try {
      const meta = typeof lead.sourceMetadata === "string"
        ? JSON.parse(lead.sourceMetadata || "{}")
        : (lead.sourceMetadata || {});
      
      if (meta.ad_id) {
        if (!adIdToLeadIds[meta.ad_id]) adIdToLeadIds[meta.ad_id] = [];
        adIdToLeadIds[meta.ad_id].push(lead.id);
      }
      if (meta.campaign_name) {
        if (!campaignNameToLeadIds[meta.campaign_name]) campaignNameToLeadIds[meta.campaign_name] = [];
        campaignNameToLeadIds[meta.campaign_name].push(lead.id);
      }
    } catch {}
    
    // Also map by campaignName field
    if (lead.campaignName) {
      if (!campaignNameToLeadIds[lead.campaignName]) campaignNameToLeadIds[lead.campaignName] = [];
      campaignNameToLeadIds[lead.campaignName].push(lead.id);
    }
  }

  // 5. Get ALL deals in one query
  const allDeals = await db
    .select({
      leadId: deals.leadId,
      valueSar: deals.valueSar,
      status: deals.status,
    })
    .from(deals)
    .where(isNull(deals.deletedAt));

  // Build a map of leadId -> deals
  const leadIdToDeals: Record<number, { valueSar: any; status: string | null }[]> = {};
  for (const deal of allDeals) {
    if (deal.leadId) {
      if (!leadIdToDeals[deal.leadId]) leadIdToDeals[deal.leadId] = [];
      leadIdToDeals[deal.leadId].push(deal);
    }
  }

  // 6. Build ROAS results per campaign and per ad
  const leadActionTypes = ["lead", "leadgen.other", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];

  const campaignResults: CampaignRoas[] = [];

  for (const [campaignId, campaign] of Object.entries(campaignMap)) {
    const adResults: AdRoas[] = [];

    for (const insight of campaign.ads) {
      const adId = insight.ad_id;
      const adName = insight.ad_name || adId;
      const spend = parseFloat(insight.spend || "0");
      const impressions = parseInt(insight.impressions || "0");
      const clicks = parseInt(insight.clicks || "0");

      const leadAction = insight.actions?.find((a: any) => leadActionTypes.includes(a.action_type));
      const metaLeadsCount = leadAction ? parseInt(leadAction.value) : 0;

      // Get CRM leads for this ad
      const adLeadIds = adIdToLeadIds[adId] || [];
      const crmLeadsCount = adLeadIds.length;

      // Get deals for these leads
      let dealsCount = 0;
      let wonDealsCount = 0;
      let totalRevenue = 0;
      let wonRevenue = 0;

      for (const leadId of adLeadIds) {
        const leadDeals = leadIdToDeals[leadId] || [];
        dealsCount += leadDeals.length;
        for (const d of leadDeals) {
          const val = parseFloat(String(d.valueSar || 0));
          totalRevenue += val;
          if (d.status === "Won") {
            wonDealsCount++;
            wonRevenue += val;
          }
        }
      }

      adResults.push({
        adId,
        adName,
        campaignId,
        campaignName: campaign.name,
        spend,
        impressions,
        clicks,
        metaLeads: metaLeadsCount,
        crmLeads: crmLeadsCount,
        dealsCount,
        wonDealsCount,
        totalRevenue,
        wonRevenue,
        roas: spend > 0 ? wonRevenue / spend : null,
        cpl: spend > 0 && metaLeadsCount > 0 ? spend / metaLeadsCount : null,
        costPerDeal: spend > 0 && wonDealsCount > 0 ? spend / wonDealsCount : null,
      });
    }

    // Aggregate campaign totals
    const campaignSpend = adResults.reduce((s, a) => s + a.spend, 0);
    const campaignImpressions = adResults.reduce((s, a) => s + a.impressions, 0);
    const campaignClicks = adResults.reduce((s, a) => s + a.clicks, 0);
    const campaignMetaLeads = adResults.reduce((s, a) => s + a.metaLeads, 0);
    const campaignCrmLeads = adResults.reduce((s, a) => s + a.crmLeads, 0);
    const campaignDeals = adResults.reduce((s, a) => s + a.dealsCount, 0);
    const campaignWonDeals = adResults.reduce((s, a) => s + a.wonDealsCount, 0);
    const campaignRevenue = adResults.reduce((s, a) => s + a.totalRevenue, 0);
    const campaignWonRevenue = adResults.reduce((s, a) => s + a.wonRevenue, 0);

    // Also check campaign-level CRM leads by campaign name
    const campaignNameLeadIds = campaignNameToLeadIds[campaign.name] || [];
    let extraCrmLeads = 0;
    let extraDeals = 0;
    let extraWonDeals = 0;
    let extraRevenue = 0;
    let extraWonRevenue = 0;

    // Find leads that are in campaign but not matched to any ad
    const allAdLeadIds = new Set(adResults.flatMap((a) => adIdToLeadIds[a.adId] || []));
    for (const leadId of campaignNameLeadIds) {
      if (!allAdLeadIds.has(leadId)) {
        extraCrmLeads++;
        const leadDeals = leadIdToDeals[leadId] || [];
        extraDeals += leadDeals.length;
        for (const d of leadDeals) {
          const val = parseFloat(String(d.valueSar || 0));
          extraRevenue += val;
          if (d.status === "Won") {
            extraWonDeals++;
            extraWonRevenue += val;
          }
        }
      }
    }

    const totalCrmLeads = campaignCrmLeads + extraCrmLeads;
    const totalDeals = campaignDeals + extraDeals;
    const totalWonDeals = campaignWonDeals + extraWonDeals;
    const totalRevenue = campaignRevenue + extraRevenue;
    const totalWonRevenue = campaignWonRevenue + extraWonRevenue;

    campaignResults.push({
      campaignId,
      campaignName: campaign.name,
      spend: campaignSpend,
      impressions: campaignImpressions,
      clicks: campaignClicks,
      metaLeads: campaignMetaLeads,
      crmLeads: totalCrmLeads,
      dealsCount: totalDeals,
      wonDealsCount: totalWonDeals,
      totalRevenue,
      wonRevenue: totalWonRevenue,
      roas: campaignSpend > 0 ? totalWonRevenue / campaignSpend : null,
      cpl: campaignSpend > 0 && campaignMetaLeads > 0 ? campaignSpend / campaignMetaLeads : null,
      costPerDeal: campaignSpend > 0 && totalWonDeals > 0 ? campaignSpend / totalWonDeals : null,
      ads: adResults.sort((a, b) => b.spend - a.spend),
    });
  }

  // Filter out campaigns with no activity
  const activeCampaigns = campaignResults.filter((c) => c.spend > 0 || c.metaLeads > 0 || c.crmLeads > 0 || c.dealsCount > 0);

  // 7. Build summary
  const totalSpend = activeCampaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = activeCampaigns.reduce((s, c) => s + c.totalRevenue, 0);
  const totalWonRevenue = activeCampaigns.reduce((s, c) => s + c.wonRevenue, 0);
  const totalLeads = activeCampaigns.reduce((s, c) => s + c.metaLeads, 0);
  const totalCrmLeads = activeCampaigns.reduce((s, c) => s + c.crmLeads, 0);
  const totalDeals = activeCampaigns.reduce((s, c) => s + c.dealsCount, 0);
  const totalWonDeals = activeCampaigns.reduce((s, c) => s + c.wonDealsCount, 0);
  const totalImpressions = activeCampaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = activeCampaigns.reduce((s, c) => s + c.clicks, 0);

  return {
    summary: {
      totalSpend,
      totalRevenue,
      totalWonRevenue,
      overallRoas: totalSpend > 0 ? totalWonRevenue / totalSpend : null,
      totalLeads,
      totalCrmLeads,
      totalDeals,
      totalWonDeals,
      avgCpl: totalSpend > 0 && totalLeads > 0 ? totalSpend / totalLeads : null,
      totalImpressions,
      totalClicks,
    },
    campaigns: activeCampaigns.sort((a, b) => b.spend - a.spend),
  };
}

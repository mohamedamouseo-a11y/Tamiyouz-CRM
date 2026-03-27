/**
 * MetaAuditService
 * - Compares Meta leads (from Graph API) vs CRM leads to find missing/mismatched leads
 * - Calculates ROAS per campaign and per ad/creative using CRM deal values and Meta spend
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
            // Use the full next URL but extract the path
            const nextUrl = new URL(data.paging.next);
            url = nextUrl.pathname.replace("/v21.0", "") + nextUrl.search;
            // Remove access_token from url since graphFetch adds it
            url = url.replace(/[&?]access_token=[^&]+/, "");
          } else {
            hasMore = false;
          }
        }
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

// ─── ROAS Calculation ──────────────────────────────────────────────────────────

interface AdRoas {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  leadsCount: number;
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
  leadsCount: number;
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
    totalDeals: number;
    totalWonDeals: number;
    avgCpl: number | null;
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
        totalLeads: 0, totalDeals: 0, totalWonDeals: 0, avgCpl: null,
      },
      campaigns: [],
    };
  }

  // 2. Get campaigns from snapshots
  const campaignSnapshots = await db
    .select()
    .from(metaCampaignSnapshots)
    .where(eq(metaCampaignSnapshots.adAccountId, account.id));

  if (!campaignSnapshots.length) {
    return {
      summary: {
        totalSpend: 0, totalRevenue: 0, totalWonRevenue: 0, overallRoas: null,
        totalLeads: 0, totalDeals: 0, totalWonDeals: 0, avgCpl: null,
      },
      campaigns: [],
    };
  }

  // 3. Build date params for Meta API
  let dateParam = "";
  if (dateFrom && dateTo) {
    dateParam = `time_range={"since":"${dateFrom}","until":"${dateTo}"}`;
  } else {
    dateParam = `date_preset=${datePreset}`;
  }

  // 4. Fetch ad-level insights for each campaign
  const campaignResults: CampaignRoas[] = [];

  for (const cs of campaignSnapshots) {
    try {
      // Fetch ad-level insights for this campaign
      const adsData = await graphFetch(
        `/${cs.campaignId}/ads?fields=id,name,status&limit=100`,
        account.accessToken,
      );
      const ads = adsData.data || [];

      const adResults: AdRoas[] = [];

      for (const ad of ads) {
        try {
          // Fetch insights for this specific ad
          const insightsData = await graphFetch(
            `/${ad.id}/insights?fields=spend,impressions,clicks,actions,cost_per_action_type&${dateParam}`,
            account.accessToken,
          );
          const insights = insightsData.data?.[0];

          const spend = insights ? parseFloat(insights.spend || "0") : 0;
          const leadActionTypes = ["lead", "leadgen.other", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];
          const leadAction = insights?.actions?.find((a: any) => leadActionTypes.includes(a.action_type));
          const metaLeadsCount = leadAction ? parseInt(leadAction.value) : 0;
          const cplAction = insights?.cost_per_action_type?.find((a: any) => leadActionTypes.includes(a.action_type));
          const cpl = cplAction ? parseFloat(cplAction.value) : null;

          // Get CRM leads for this ad (via sourceMetadata->ad_id)
          const crmAdLeads = await db
            .select({
              id: leads.id,
              name: leads.name,
            })
            .from(leads)
            .where(
              and(
                sql`JSON_UNQUOTE(JSON_EXTRACT(${leads.sourceMetadata}, '$.ad_id')) = ${ad.id}`,
                isNull(leads.deletedAt),
              ),
            );

          // Get deals for these leads
          let dealsCount = 0;
          let wonDealsCount = 0;
          let totalRevenue = 0;
          let wonRevenue = 0;

          if (crmAdLeads.length > 0) {
            const leadIds = crmAdLeads.map((l) => l.id);
            const adDeals = await db
              .select({
                valueSar: deals.valueSar,
                status: deals.status,
              })
              .from(deals)
              .where(
                and(
                  inArray(deals.leadId, leadIds),
                  isNull(deals.deletedAt),
                ),
              );

            dealsCount = adDeals.length;
            wonDealsCount = adDeals.filter((d) => d.status === "Won").length;
            totalRevenue = adDeals.reduce((sum, d) => sum + parseFloat(String(d.valueSar || 0)), 0);
            wonRevenue = adDeals
              .filter((d) => d.status === "Won")
              .reduce((sum, d) => sum + parseFloat(String(d.valueSar || 0)), 0);
          }

          adResults.push({
            adId: ad.id,
            adName: ad.name || ad.id,
            campaignId: cs.campaignId,
            campaignName: cs.campaignName || cs.campaignId,
            spend,
            leadsCount: crmAdLeads.length || metaLeadsCount,
            dealsCount,
            wonDealsCount,
            totalRevenue,
            wonRevenue,
            roas: spend > 0 ? wonRevenue / spend : null,
            cpl: cpl || (spend > 0 && metaLeadsCount > 0 ? spend / metaLeadsCount : null),
            costPerDeal: spend > 0 && wonDealsCount > 0 ? spend / wonDealsCount : null,
          });
        } catch (adErr: any) {
          console.error(`[MetaAudit] Error fetching ad ${ad.id} insights:`, adErr.message);
        }
      }

      // Aggregate campaign totals from ads
      const campaignSpend = adResults.reduce((s, a) => s + a.spend, 0);
      const campaignLeads = adResults.reduce((s, a) => s + a.leadsCount, 0);
      const campaignDeals = adResults.reduce((s, a) => s + a.dealsCount, 0);
      const campaignWonDeals = adResults.reduce((s, a) => s + a.wonDealsCount, 0);
      const campaignRevenue = adResults.reduce((s, a) => s + a.totalRevenue, 0);
      const campaignWonRevenue = adResults.reduce((s, a) => s + a.wonRevenue, 0);

      // If no ads found, try campaign-level insights
      if (ads.length === 0) {
        try {
          const insightsData = await graphFetch(
            `/${cs.campaignId}/insights?fields=spend,actions,cost_per_action_type&${dateParam}`,
            account.accessToken,
          );
          const insights = insightsData.data?.[0];
          if (insights) {
            const spend = parseFloat(insights.spend || "0");
            const leadActionTypes = ["lead", "leadgen.other", "onsite_conversion.lead_grouped"];
            const leadAction = insights.actions?.find((a: any) => leadActionTypes.includes(a.action_type));
            const metaLeadsCount = leadAction ? parseInt(leadAction.value) : 0;

            campaignResults.push({
              campaignId: cs.campaignId,
              campaignName: cs.campaignName || cs.campaignId,
              spend,
              leadsCount: metaLeadsCount,
              dealsCount: 0,
              wonDealsCount: 0,
              totalRevenue: 0,
              wonRevenue: 0,
              roas: null,
              cpl: spend > 0 && metaLeadsCount > 0 ? spend / metaLeadsCount : null,
              costPerDeal: null,
              ads: [],
            });
          }
        } catch {}
        continue;
      }

      campaignResults.push({
        campaignId: cs.campaignId,
        campaignName: cs.campaignName || cs.campaignId,
        spend: campaignSpend,
        leadsCount: campaignLeads,
        dealsCount: campaignDeals,
        wonDealsCount: campaignWonDeals,
        totalRevenue: campaignRevenue,
        wonRevenue: campaignWonRevenue,
        roas: campaignSpend > 0 ? campaignWonRevenue / campaignSpend : null,
        cpl: campaignSpend > 0 && campaignLeads > 0 ? campaignSpend / campaignLeads : null,
        costPerDeal: campaignSpend > 0 && campaignWonDeals > 0 ? campaignSpend / campaignWonDeals : null,
        ads: adResults,
      });
    } catch (err: any) {
      console.error(`[MetaAudit] Error processing campaign ${cs.campaignId}:`, err.message);
    }
  }

  // Filter out campaigns with no spend
  const activeCampaigns = campaignResults.filter((c) => c.spend > 0 || c.leadsCount > 0 || c.dealsCount > 0);

  // 5. Build summary
  const totalSpend = activeCampaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = activeCampaigns.reduce((s, c) => s + c.totalRevenue, 0);
  const totalWonRevenue = activeCampaigns.reduce((s, c) => s + c.wonRevenue, 0);
  const totalLeads = activeCampaigns.reduce((s, c) => s + c.leadsCount, 0);
  const totalDeals = activeCampaigns.reduce((s, c) => s + c.dealsCount, 0);
  const totalWonDeals = activeCampaigns.reduce((s, c) => s + c.wonDealsCount, 0);

  return {
    summary: {
      totalSpend,
      totalRevenue,
      totalWonRevenue,
      overallRoas: totalSpend > 0 ? totalWonRevenue / totalSpend : null,
      totalLeads,
      totalDeals,
      totalWonDeals,
      avgCpl: totalSpend > 0 && totalLeads > 0 ? totalSpend / totalLeads : null,
    },
    campaigns: activeCampaigns.sort((a, b) => b.spend - a.spend),
  };
}

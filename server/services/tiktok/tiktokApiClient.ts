/**
 * TikTok Business API Client
 * Real API integration replacing ChatGPT's mock data.
 * Docs: https://business-api.tiktok.com/marketing_api/docs
 */

const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TikTokApiPaging {
  page?: number;
  pageSize?: number;
}

export interface TikTokCampaignApiItem {
  campaign_id: string;
  campaign_name: string;
  campaign_type: string;
  status: string;       // "CAMPAIGN_STATUS_ENABLE" | "CAMPAIGN_STATUS_DISABLE" etc.
  objective_type: string;
  budget: number;
  budget_mode: string;  // "BUDGET_MODE_DAY" | "BUDGET_MODE_TOTAL"
  create_time: string;
  modify_time: string;
}

export interface TikTokReportMetrics {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  conversion: string;
  ctr: string;
  cpc: string;
  cost_per_conversion: string;
}

export interface TikTokCampaignsResponse {
  code: number;
  message: string;
  data: {
    list: TikTokCampaignApiItem[];
    page_info: {
      page: number;
      page_size: number;
      total_number: number;
      total_page: number;
    };
  };
}

export interface TikTokReportResponse {
  code: number;
  message: string;
  data: {
    list: Array<{
      dimensions: { campaign_id: string };
      metrics: {
        campaign_name: string;
        spend: string;
        impressions: string;
        clicks: string;
        conversion: string;
        ctr: string;
        cpc: string;
        cost_per_conversion: string;
      };
    }>;
    page_info: {
      page: number;
      page_size: number;
      total_number: number;
      total_page: number;
    };
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function tiktokGet<T>(endpoint: string, accessToken: string, params: Record<string, any> = {}): Promise<T> {
  const url = new URL(`${TIKTOK_API_BASE}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ─── Campaign List ───────────────────────────────────────────────────────────

export async function fetchCampaigns(
  advertiserId: string,
  accessToken: string,
  paging: TikTokApiPaging = {},
): Promise<TikTokCampaignsResponse> {
  const page = paging.page ?? 1;
  const pageSize = paging.pageSize ?? 100;

  return tiktokGet<TikTokCampaignsResponse>("/campaign/get/", accessToken, {
    advertiser_id: advertiserId,
    page,
    page_size: pageSize,
  });
}

// ─── Campaign Report / Insights ──────────────────────────────────────────────

export async function fetchCampaignReport(
  advertiserId: string,
  accessToken: string,
  dateFrom: string,
  dateTo: string,
  paging: TikTokApiPaging = {},
): Promise<TikTokReportResponse> {
  const page = paging.page ?? 1;
  const pageSize = paging.pageSize ?? 100;

  return tiktokGet<TikTokReportResponse>("/report/integrated/get/", accessToken, {
    advertiser_id: advertiserId,
    report_type: "BASIC",
    dimensions: ["campaign_id"],
    data_level: "AUCTION_CAMPAIGN",
    start_date: dateFrom,
    end_date: dateTo,
    metrics: [
      "campaign_name", "spend", "impressions", "clicks",
      "conversion", "ctr", "cpc", "cost_per_conversion",
    ],
    page,
    page_size: pageSize,
  });
}

// ─── Advertiser Info (for validation) ────────────────────────────────────────

export async function fetchAdvertiserInfo(
  advertiserId: string,
  accessToken: string,
): Promise<{ advertiser_id: string; advertiser_name: string }> {
  const res = await tiktokGet<{
    code: number;
    message: string;
    data: { list: Array<{ advertiser_id: string; advertiser_name: string }> };
  }>("/advertiser/info/", accessToken, {
    advertiser_ids: [advertiserId],
  });

  if (res.code !== 0 || !res.data?.list?.length) {
    throw new Error(`Failed to fetch advertiser info: ${res.message}`);
  }

  return res.data.list[0];
}

// ─── Status Mapping ──────────────────────────────────────────────────────────

export function mapTikTokStatus(apiStatus: string): string {
  const statusMap: Record<string, string> = {
    CAMPAIGN_STATUS_ENABLE: "ACTIVE",
    CAMPAIGN_STATUS_DISABLE: "DISABLED",
    CAMPAIGN_STATUS_DELETE: "DELETED",
    CAMPAIGN_STATUS_ADVERTISER_AUDIT_DENY: "REJECTED",
    CAMPAIGN_STATUS_ADVERTISER_AUDIT: "PENDING",
    CAMPAIGN_STATUS_BUDGET_EXCEED: "BUDGET_EXCEEDED",
    CAMPAIGN_STATUS_NOT_DELETE: "ACTIVE",
  };
  return statusMap[apiStatus] || apiStatus;
}

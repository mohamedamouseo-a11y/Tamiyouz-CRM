import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import CRMLayout from "@/components/CRMLayout";
import TikTokCampaignFilters from "@/components/tiktok/TikTokCampaignFilters";
import TikTokCampaignSummaryCards from "@/components/tiktok/TikTokCampaignSummaryCards";
import TikTokCampaignsTable from "@/components/tiktok/TikTokCampaignsTable";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, BarChart3, Table2, LayoutGrid } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type ViewMode = "all" | "table";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function TikTokCampaignsPage() {
  const { isRTL, t } = useLanguage();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  const defaultFilters = useMemo(() => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    return {
      dateFrom: toDateInputValue(lastWeek),
      dateTo: toDateInputValue(today),
      minSpend: undefined as number | undefined,
      maxSpend: undefined as number | undefined,
      status: [] as string[],
      objectives: [] as string[],
    };
  }, []);

  const [filters, setFilters] = useState(defaultFilters);

  // Role check: Admin or MediaBuyer only
  const role = user?.role ?? "";
  const hasAccess = ["Admin", "admin", "MediaBuyer"].includes(role);

  const { data, isLoading, refetch, isFetching } =
    trpc.tiktok.campaigns.getAnalytics.useQuery(filters, {
      enabled: hasAccess,
      placeholderData: (prev: any) => prev,
    });

  if (!hasAccess) {
    return (
      <CRMLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <BarChart3 size={48} className="mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {isRTL ? "غير مصرح" : "Access Denied"}
            </h2>
            <p className="text-muted-foreground">
              {isRTL
                ? "هذه الصفحة متاحة فقط للمسؤولين ومشتري الإعلانات"
                : "This page is only available for Admins and Media Buyers"}
            </p>
          </div>
        </div>
      </CRMLayout>
    );
  }

  const campaigns = data?.data ?? [];
  const summary = data?.summary ?? {
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    avgCtr: 0,
    avgCpc: 0,
    avgCpa: 0,
  };

  return (
    <CRMLayout>
      <div className="space-y-4 p-4 md:p-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {isRTL ? "تحليلات حملات TikTok" : "TikTok Campaign Analytics"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? "فلترة ومراجعة أداء حملات TikTok مع مؤشرات الأداء الرئيسية"
                : "Filter and review TikTok campaign performance with key metrics"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "all" ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded-none"
                onClick={() => setViewMode("all")}
              >
                <LayoutGrid size={14} />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded-none"
                onClick={() => setViewMode("table")}
              >
                <Table2 size={14} />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8"
            >
              {isFetching ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <RefreshCw size={14} className="mr-1" />
              )}
              {isRTL ? "تحديث" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <TikTokCampaignFilters value={filters} onChange={setFilters} />

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {(viewMode === "all") && (
              <TikTokCampaignSummaryCards summary={summary} isLoading={isFetching} />
            )}

            {/* Table */}
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <TikTokCampaignsTable data={campaigns} isLoading={isFetching} />
            </div>
          </>
        )}
      </div>
    </CRMLayout>
  );
}

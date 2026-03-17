import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import CRMLayout from "@/components/CRMLayout";
import MetaCombinedFilters from "@/components/MetaCombinedFilters";
import MetaCombinedSummaryCards from "@/components/MetaCombinedSummaryCards";
import MetaCombinedCharts from "@/components/MetaCombinedCharts";
import MetaCombinedTable from "@/components/MetaCombinedTable";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, BarChart3, Table2, LayoutGrid } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type ViewMode = "all" | "charts" | "table";

export default function MetaCombinedPage() {
  const { isRTL, t } = useLanguage();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [filters, setFilters] = useState<{
    dateFrom?: string;
    dateTo?: string;
    minSpend?: number;
    datePreset?: string;
  }>({ datePreset: "last_30d" });

  // Role check: Admin or MediaBuyer only
  const role = user?.role ?? "";
  const hasAccess = ["Admin", "admin", "MediaBuyer"].includes(role);

  const { data, isLoading, refetch, isFetching } =
    trpc.metaCombined.getAnalytics.useQuery(
      {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        minSpend: filters.minSpend,
        datePreset: filters.datePreset || "last_30d",
      },
      { enabled: hasAccess }
    );

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

  const campaigns = data?.campaigns ?? [];
  const summary = data?.summary ?? {
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

  return (
    <CRMLayout>
      <div className="space-y-4 p-4 md:p-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {isRTL ? "تحليلات Meta المدمجة" : "Meta Combined Analytics"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? "تحليلات شاملة تجمع بين بيانات Meta والـ CRM"
                : "Comprehensive analytics combining Meta Ads with CRM data"}
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
                variant={viewMode === "charts" ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded-none"
                onClick={() => setViewMode("charts")}
              >
                <BarChart3 size={14} />
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
        <MetaCombinedFilters
          onApply={(f) => setFilters(f)}
          isLoading={isLoading || isFetching}
        />

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <MetaCombinedSummaryCards
              summary={summary}
              isLoading={isFetching}
            />

            {/* Charts */}
            {(viewMode === "all" || viewMode === "charts") && (
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                <MetaCombinedCharts campaigns={campaigns} summary={summary} />
              </div>
            )}

            {/* Table */}
            {(viewMode === "all" || viewMode === "table") && (
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                <MetaCombinedTable
                  campaigns={campaigns}
                  isLoading={isFetching}
                />
              </div>
            )}
          </>
        )}
      </div>
    </CRMLayout>
  );
}

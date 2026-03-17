import CRMLayout from "@/components/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Megaphone,
  TrendingUp,
  Users,
  BarChart3,
  Eye,
} from "lucide-react";
import { useState } from "react";
import { subDays } from "date-fns";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";

const COLORS = ["#6366f1", "#f97316", "#22c55e", "#ef4444", "#3b82f6", "#8b5cf6", "#06b6d4", "#ec4899"];

const QUALITY_COLORS: Record<string, string> = {
  Hot: "#ef4444",
  Warm: "#f97316",
  Cold: "#3b82f6",
  Bad: "#9ca3af",
  Unknown: "#cbd5e1",
};

export default function CampaignAnalytics() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  const { data: stats, isLoading } = trpc.campaigns.stats.useQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const { data: detail, isLoading: detailLoading } = trpc.campaigns.detail.useQuery(
    {
      campaignName: selectedCampaign ?? "",
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
    },
    { enabled: !!selectedCampaign }
  );

  const totalLeads = (stats ?? []).reduce((s: number, c: any) => s + c.totalLeads, 0);
  const totalHot = (stats ?? []).reduce((s: number, c: any) => s + c.hot, 0);
  const totalWarm = (stats ?? []).reduce((s: number, c: any) => s + c.warm, 0);
  const totalCold = (stats ?? []).reduce((s: number, c: any) => s + c.cold, 0);

  const qualityOverview = [
    { name: isRTL ? "ساخن" : "Hot", value: totalHot, fill: QUALITY_COLORS.Hot },
    { name: isRTL ? "دافئ" : "Warm", value: totalWarm, fill: QUALITY_COLORS.Warm },
    { name: isRTL ? "بارد" : "Cold", value: totalCold, fill: QUALITY_COLORS.Cold },
    { name: isRTL ? "سيء" : "Bad", value: (stats ?? []).reduce((s: number, c: any) => s + c.bad, 0), fill: QUALITY_COLORS.Bad },
    { name: isRTL ? "غير معروف" : "Unknown", value: (stats ?? []).reduce((s: number, c: any) => s + c.unknown, 0), fill: QUALITY_COLORS.Unknown },
  ].filter((q) => q.value > 0);

  const campaignChartData = (stats ?? []).slice(0, 10).map((c: any) => ({
    name: c.campaignName.length > 18 ? c.campaignName.slice(0, 18) + "…" : c.campaignName,
    fullName: c.campaignName,
    total: c.totalLeads,
    hot: c.hot,
    warm: c.warm,
    cold: c.cold,
  }));

  const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`bg-muted rounded animate-pulse ${className}`} />
  );

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? "تحليلات الحملات" : "Campaign Analytics"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isRTL
                ? "أداء الحملات الإعلانية وجودة العملاء المحتملين"
                : "Ad campaign performance & lead quality analysis"}
            </p>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} isRTL={isRTL} />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              title: isRTL ? "إجمالي العملاء" : "Total Leads",
              value: totalLeads,
              icon: <Users size={18} />,
              color: tokens.primaryColor,
            },
            {
              title: isRTL ? "الحملات النشطة" : "Active Campaigns",
              value: (stats ?? []).length,
              icon: <Megaphone size={18} />,
              color: tokens.accentColor,
            },
            {
              title: isRTL ? "عملاء ساخنون" : "Hot Leads",
              value: totalHot,
              subtitle: totalLeads > 0 ? `${((totalHot / totalLeads) * 100).toFixed(1)}%` : "0%",
              icon: <TrendingUp size={18} />,
              color: "#ef4444",
            },
            {
              title: isRTL ? "عملاء دافئون" : "Warm Leads",
              value: totalWarm,
              subtitle: totalLeads > 0 ? `${((totalWarm / totalLeads) * 100).toFixed(1)}%` : "0%",
              icon: <BarChart3 size={18} />,
              color: "#f97316",
            },
          ].map((card, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ background: card.color }}
                  >
                    {card.icon}
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : card.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
                {"subtitle" in card && !isLoading && (
                  <p className="text-xs text-orange-600 font-medium mt-0.5">{(card as any).subtitle}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campaign Performance Chart + Quality Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Megaphone size={16} />
                {isRTL ? "أداء الحملات" : "Campaign Performance"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : campaignChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={campaignChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="hot" stackId="quality" fill={QUALITY_COLORS.Hot} name={isRTL ? "ساخن" : "Hot"} />
                    <Bar dataKey="warm" stackId="quality" fill={QUALITY_COLORS.Warm} name={isRTL ? "دافئ" : "Warm"} />
                    <Bar dataKey="cold" stackId="quality" fill={QUALITY_COLORS.Cold} name={isRTL ? "بارد" : "Cold"} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Quality Distribution Pie */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye size={16} />
                {isRTL ? "توزيع الجودة" : "Quality Distribution"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : qualityOverview.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={qualityOverview}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      nameKey="name"
                    >
                      {qualityOverview.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Campaign Details Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {isRTL ? "تفاصيل الحملات" : "Campaign Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "الحملة" : "Campaign"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "إجمالي" : "Total"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: QUALITY_COLORS.Hot }} />
                        {isRTL ? "ساخن" : "Hot"}
                      </span>
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: QUALITY_COLORS.Warm }} />
                        {isRTL ? "دافئ" : "Warm"}
                      </span>
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: QUALITY_COLORS.Cold }} />
                        {isRTL ? "بارد" : "Cold"}
                      </span>
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: QUALITY_COLORS.Bad }} />
                        {isRTL ? "سيء" : "Bad"}
                      </span>
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "نسبة الجودة" : "Quality Rate"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "تفاصيل" : "Details"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (stats ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        {isRTL ? "لا توجد بيانات" : "No data available"}
                      </td>
                    </tr>
                  ) : (
                    (stats ?? []).map((c: any) => {
                      const qualityRate = c.totalLeads > 0
                        ? (((c.hot + c.warm) / c.totalLeads) * 100)
                        : 0;
                      return (
                        <tr key={c.campaignName} className="border-b border-border hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{c.campaignName}</td>
                          <td className="px-4 py-3 font-bold">{c.totalLeads}</td>
                          <td className="px-4 py-3">
                            <span className="text-red-500 font-medium">{c.hot}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-orange-500">{c.warm}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-blue-500">{c.cold}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-400">{c.bad}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-1.5 max-w-16">
                                <div
                                  className="h-1.5 rounded-full"
                                  style={{
                                    width: `${Math.min(qualityRate, 100)}%`,
                                    background: qualityRate >= 50 ? tokens.successColor : "#f59e0b",
                                  }}
                                />
                              </div>
                              <span className="text-xs">{qualityRate.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedCampaign(
                                selectedCampaign === c.campaignName ? null : c.campaignName
                              )}
                              className="text-xs text-primary hover:underline"
                            >
                              {selectedCampaign === c.campaignName
                                ? (isRTL ? "إخفاء" : "Hide")
                                : (isRTL ? "عرض" : "View")}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Detail (Ad Creative Breakdown) */}
        {selectedCampaign && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye size={16} />
                {isRTL ? "تفاصيل الإعلانات" : "Ad Creative Breakdown"} — {selectedCampaign}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <Skeleton className="h-48" />
              ) : !detail || (detail.adCreatives ?? []).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {isRTL ? "لا توجد بيانات إعلانية" : "No ad creative data available"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {isRTL ? "الإعلان" : "Ad Creative"}
                        </th>
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {isRTL ? "إجمالي" : "Total"}
                        </th>
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {isRTL ? "ساخن" : "Hot"}
                        </th>
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {isRTL ? "دافئ" : "Warm"}
                        </th>
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {isRTL ? "بارد" : "Cold"}
                        </th>
                        <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                          {isRTL ? "سيء" : "Bad"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.adCreatives ?? []).map((ad: any) => (
                        <tr key={ad.adCreative} className="border-b border-border hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{ad.adCreative || (isRTL ? "غير محدد" : "Unspecified")}</td>
                          <td className="px-4 py-3 font-bold">{ad.totalLeads}</td>
                          <td className="px-4 py-3 text-red-500">{ad.hot}</td>
                          <td className="px-4 py-3 text-orange-500">{ad.warm}</td>
                          <td className="px-4 py-3 text-blue-500">{ad.cold}</td>
                          <td className="px-4 py-3 text-gray-400">{ad.bad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </CRMLayout>
  );
}

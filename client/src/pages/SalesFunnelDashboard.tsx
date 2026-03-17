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
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  ArrowDown,
  DollarSign,
  Filter,
  TrendingUp,
  Users,
  Clock,
  Target,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { subDays, format } from "date-fns";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";

const FUNNEL_COLORS = [
  "#6366f1", "#8b5cf6", "#3b82f6", "#06b6d4", "#f59e0b",
  "#ec4899", "#22c55e", "#ef4444", "#9ca3af", "#f97316",
];

const QUALITY_COLORS: Record<string, string> = {
  Hot: "#ef4444",
  Warm: "#f97316",
  Cold: "#3b82f6",
  Bad: "#9ca3af",
  Unknown: "#cbd5e1",
};

export default function SalesFunnelDashboard() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data, isLoading } = trpc.dashboard.salesFunnel.useQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const isManager = ["Admin", "SalesManager", "admin"].includes(user?.role ?? "");
  const isMediaBuyer = user?.role === "MediaBuyer";

  // Media Buyers should not see this page (they have their own campaign view)
  if (isMediaBuyer) {
    return (
      <CRMLayout>
        <div className="p-6 text-center text-muted-foreground">
          {isRTL ? "غير مصرح لك بالوصول" : "Access denied"}
        </div>
      </CRMLayout>
    );
  }

  const wonDeals = data?.dealSummary?.won;
  const pendingDeals = data?.dealSummary?.pending;
  const lostDeals = data?.dealSummary?.lost;

  // Prepare funnel data sorted by count descending for visual funnel
  const funnelChartData = [...(data?.funnelData ?? [])]
    .sort((a, b) => b.count - a.count)
    .map((s, i) => ({
      name: isRTL ? s.stageAr : s.stage,
      value: s.count,
      fill: s.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    }));

  // Lead trend data
  const trendData = (data?.leadTrend ?? []).map((d: any) => ({
    date: typeof d.date === "string" ? d.date : format(new Date(d.date), "MM/dd"),
    count: d.count,
  }));

  // Campaign data for chart
  const campaignChartData = (data?.campaignPerformance ?? []).slice(0, 8).map((c: any) => ({
    name: c.campaignName.length > 15 ? c.campaignName.slice(0, 15) + "…" : c.campaignName,
    fullName: c.campaignName,
    total: c.totalLeads,
    won: c.wonLeads,
    progressed: c.progressedLeads,
    conversionRate: c.conversionRate,
  }));

  const kpiGradients = ["kpi-gradient-blue", "kpi-gradient-green", "kpi-gradient-yellow", "kpi-gradient-blue"];

  const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`bg-muted rounded animate-pulse ${className}`} />
  );

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap slide-up">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isManager
                ? (isRTL ? "قمع المبيعات" : "Sales Funnel")
                : (isRTL ? "قمع مبيعاتي" : "My Sales Funnel")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isManager
                ? (isRTL ? "تحليل مسار تحويل العملاء المحتملين" : "Lead conversion pipeline analysis")
                : (isRTL ? "تحليل مسار تحويل عملائك" : "Your personal lead conversion pipeline")}
            </p>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} isRTL={isRTL} />
        </div>

        {/* KPI Cards - Staggered */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
          {[
            {
              title: isRTL ? "إجمالي العملاء" : "Total Leads",
              value: data?.totalLeads ?? 0,
              icon: <Users size={18} />,
              color: tokens.primaryColor,
            },
            {
              title: isRTL ? "الصفقات الناجحة" : "Won Deals",
              value: wonDeals?.count ?? 0,
              subtitle: `${(wonDeals?.totalValue ?? 0).toLocaleString()} ${isRTL ? "ر.س" : "SAR"}`,
              icon: <DollarSign size={18} />,
              color: tokens.successColor,
            },
            {
              title: isRTL ? "معدل التحويل" : "Conversion Rate",
              value: data?.totalLeads && (wonDeals?.count ?? 0) > 0
                ? `${((wonDeals!.count / data.totalLeads) * 100).toFixed(1)}%`
                : "0%",
              icon: <Target size={18} />,
              color: tokens.accentColor,
            },
            {
              title: isRTL ? "متوسط وقت التواصل" : "Avg Contact Time",
              value: data?.avgContactTimeHours
                ? `${Math.round(data.avgContactTimeHours)}h`
                : "—",
              icon: <Clock size={18} />,
              color: "#f59e0b",
            },
          ].map((card, i) => (
            <Card key={i} className={kpiGradients[i]}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="kpi-icon w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm"
                    style={{ background: card.color }}
                  >
                    {card.icon}
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : card.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
                {card.subtitle && !isLoading && (
                  <p className="text-xs text-green-600 font-medium mt-0.5">{card.subtitle}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Funnel Visualization + Stage Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visual Funnel */}
          <Card className="chart-container">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter size={16} />
                {isRTL ? "قمع المبيعات" : "Sales Funnel"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : funnelChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </div>
              ) : (
                <div className="space-y-2">
                  {(data?.funnelData ?? []).map((stage, i) => {
                    const maxCount = Math.max(...(data?.funnelData ?? []).map(s => s.count), 1);
                    const widthPct = Math.max((stage.count / maxCount) * 100, 8);
                    return (
                      <div key={stage.stage} className="flex items-center gap-3 group" style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="w-28 text-xs text-end truncate text-muted-foreground">
                          {isRTL ? stage.stageAr : stage.stage}
                        </div>
                        <div className="flex-1 relative">
                          <div
                            className="h-8 rounded-md flex items-center justify-center text-white text-xs font-medium transition-all duration-500 group-hover:opacity-90"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: stage.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                              minWidth: 40,
                              animation: `slideRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms both`,
                            }}
                          >
                            {stage.count}
                          </div>
                        </div>
                        <div className="w-14 text-xs text-muted-foreground text-end">
                          {data?.totalLeads && data.totalLeads > 0
                            ? `${((stage.count / data.totalLeads) * 100).toFixed(0)}%`
                            : "0%"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Trend */}
          <Card className="chart-container">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp size={16} />
                {isRTL ? "اتجاه العملاء المحتملين" : "Lead Trend"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : trendData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={tokens.primaryColor}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5, strokeWidth: 2 }}
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Campaign Performance + Deal Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Performance Chart */}
          <Card className="lg:col-span-2 chart-container">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap size={16} />
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
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={campaignChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      formatter={(value: any, name: string) => [
                        value,
                        name === "total"
                          ? isRTL ? "إجمالي" : "Total"
                          : name === "won"
                          ? isRTL ? "مكتسب" : "Won"
                          : isRTL ? "متقدم" : "Progressed",
                      ]}
                    />
                    <Bar dataKey="total" fill={tokens.primaryColor} radius={[4, 4, 0, 0]} name="total" animationDuration={800} />
                    <Bar dataKey="progressed" fill={tokens.accentColor} radius={[4, 4, 0, 0]} name="progressed" animationDuration={800} animationBegin={200} />
                    <Bar dataKey="won" fill={tokens.successColor} radius={[4, 4, 0, 0]} name="won" animationDuration={800} animationBegin={400} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Deal Summary */}
          <Card className="slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign size={16} />
                {isRTL ? "ملخص الصفقات" : "Deal Summary"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <>
                  {[
                    {
                      label: isRTL ? "ناجحة" : "Won",
                      count: wonDeals?.count ?? 0,
                      value: wonDeals?.totalValue ?? 0,
                      avg: wonDeals?.avgValue ?? 0,
                      color: "#22c55e",
                    },
                    {
                      label: isRTL ? "معلقة" : "Pending",
                      count: pendingDeals?.count ?? 0,
                      value: pendingDeals?.totalValue ?? 0,
                      avg: pendingDeals?.avgValue ?? 0,
                      color: "#f59e0b",
                    },
                    {
                      label: isRTL ? "خاسرة" : "Lost",
                      count: lostDeals?.count ?? 0,
                      value: lostDeals?.totalValue ?? 0,
                      avg: lostDeals?.avgValue ?? 0,
                      color: "#ef4444",
                    },
                  ].map((deal) => (
                    <div key={deal.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors duration-200">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: deal.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{deal.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {deal.count}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {isRTL ? "القيمة" : "Value"}: {deal.value.toLocaleString()} {isRTL ? "ر.س" : "SAR"}
                        </div>
                        {deal.avg > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {isRTL ? "المتوسط" : "Avg"}: {Math.round(deal.avg).toLocaleString()} {isRTL ? "ر.س" : "SAR"}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Campaign Performance Table */}
        <Card className="slide-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {isRTL ? "تفاصيل أداء الحملات" : "Campaign Performance Details"}
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
                      {isRTL ? "إجمالي العملاء" : "Total Leads"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "متقدمون" : "Progressed"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "مكتسب" : "Won"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "مفقود" : "Lost"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "معدل التحويل" : "Conversion Rate"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (data?.campaignPerformance ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        {isRTL ? "لا توجد بيانات" : "No data available"}
                      </td>
                    </tr>
                  ) : (
                    (data?.campaignPerformance ?? []).map((c: any) => (
                      <tr key={c.campaignName} className="border-b border-border hover:bg-muted/30 transition-colors duration-200">
                        <td className="px-4 py-3 font-medium">{c.campaignName}</td>
                        <td className="px-4 py-3">{c.totalLeads}</td>
                        <td className="px-4 py-3">
                          <span className="text-blue-600">{c.progressedLeads}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-green-600 font-medium">{c.wonLeads}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-red-500">{c.lostLeads}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5 max-w-16">
                              <div
                                className="h-1.5 rounded-full progress-bar-animated"
                                style={{
                                  width: `${Math.min(c.conversionRate, 100)}%`,
                                  background: tokens.successColor,
                                }}
                              />
                            </div>
                            <span className="text-xs">{c.conversionRate.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rates Stage-by-Stage */}
        <Card className="slide-up" style={{ animationDelay: '0.4s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowDown size={16} />
              {isRTL ? "معدلات التحويل حسب المرحلة" : "Stage Conversion Rates"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="flex flex-wrap gap-3 stagger-children">
                {(data?.conversionRates ?? []).map((stage: any, i: number) => (
                  <div
                    key={stage.stage}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card min-w-[140px] hover:shadow-sm transition-all duration-200"
                  >
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{
                        backgroundColor:
                          data?.funnelData?.[i]?.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                      }}
                    />
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {isRTL ? stage.stageAr : stage.stage}
                      </div>
                      <div className="text-sm font-bold">{stage.count}</div>
                      <div className="text-xs text-muted-foreground">
                        {stage.percentage.toFixed(1)}%
                        {i > 0 && stage.dropOff > 0 && (
                          <span className="text-red-500 ms-1">
                            ↓{stage.dropOff.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}

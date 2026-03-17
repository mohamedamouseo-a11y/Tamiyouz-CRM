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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  Activity,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { subDays, format } from "date-fns";
import { Link } from "wouter";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";

const COLORS = ["#6366f1", "#f97316", "#22c55e", "#ef4444", "#3b82f6", "#8b5cf6", "#06b6d4", "#ec4899", "#f59e0b"];

const ACTIVITY_COLORS: Record<string, string> = {
  Call: "#3b82f6",
  WhatsApp: "#22c55e",
  Meeting: "#f59e0b",
  Email: "#8b5cf6",
  SMS: "#06b6d4",
  Offer: "#ec4899",
  Note: "#9ca3af",
};

const OUTCOME_COLORS: Record<string, string> = {
  Contacted: "#3b82f6",
  NoAnswer: "#9ca3af",
  Interested: "#22c55e",
  NotInterested: "#ef4444",
  Meeting: "#f59e0b",
  Offer: "#ec4899",
  Won: "#10b981",
  Lost: "#ef4444",
  Callback: "#6366f1",
  Unknown: "#cbd5e1",
};

export default function TaskSlaDashboard() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data, isLoading } = trpc.dashboard.taskSla.useQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const isManager = ["Admin", "SalesManager", "admin"].includes(user?.role ?? "");
  const isMediaBuyer = user?.role === "MediaBuyer";

  // Media Buyers should not see this page
  if (isMediaBuyer) {
    return (
      <CRMLayout>
        <div className="p-6 text-center text-muted-foreground">
          {isRTL ? "غير مصرح لك بالوصول" : "Access denied"}
        </div>
      </CRMLayout>
    );
  }

  const sla = data?.slaOverview;
  const totalActivities = (data?.activityByType ?? []).reduce((s: number, a: any) => s + a.count, 0);

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)}m`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`bg-muted rounded animate-pulse ${className}`} />
  );

  // Prepare activity type chart data
  const activityTypeData = (data?.activityByType ?? []).map((a: any) => ({
    name: a.type,
    value: a.count,
    fill: ACTIVITY_COLORS[a.type] ?? "#9ca3af",
  }));

  // Prepare outcome chart data
  const outcomeData = (data?.activityOutcomes ?? []).map((o: any) => ({
    name: o.outcome,
    value: o.count,
    fill: OUTCOME_COLORS[o.outcome] ?? "#9ca3af",
  }));

  // SLA trend data
  const slaTrendData = (data?.slaDailyTrend ?? []).map((d: any) => ({
    date: typeof d.date === "string" ? d.date : format(new Date(d.date), "MM/dd"),
    breached: d.breached,
    total: d.total,
    rate: d.total > 0 ? (((d.total - d.breached) / d.total) * 100) : 100,
  }));

  // Activity trend data
  const activityTrendData = (data?.activityDailyTrend ?? []).map((d: any) => ({
    date: typeof d.date === "string" ? d.date : format(new Date(d.date), "MM/dd"),
    count: d.count,
  }));

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isManager
                ? (isRTL ? "المهام و SLA" : "Tasks & SLA")
                : (isRTL ? "مهامي و SLA" : "My Tasks & SLA")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isManager
                ? (isRTL ? "مراقبة الأنشطة والالتزام باتفاقية مستوى الخدمة" : "Activity monitoring & SLA compliance tracking")
                : (isRTL ? "مراقبة أنشطتك والتزامك باتفاقية مستوى الخدمة" : "Your activity monitoring & SLA compliance")}
            </p>
            {data?.slaSettings && (
              <Badge variant="outline" className="mt-2 text-xs">
                {isRTL ? "حد SLA" : "SLA Threshold"}: {data.slaSettings.hoursThreshold}h
                {" — "}
                {data.slaSettings.isEnabled
                  ? isRTL ? "مفعل" : "Enabled"
                  : isRTL ? "معطل" : "Disabled"}
              </Badge>
            )}
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} isRTL={isRTL} />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              title: isRTL ? "معدل الالتزام" : "SLA Compliance",
              value: sla ? `${sla.complianceRate.toFixed(1)}%` : "—",
              icon: <Shield size={18} />,
              color: (sla?.complianceRate ?? 100) >= 80 ? tokens.successColor : "#ef4444",
            },
            {
              title: isRTL ? "تجاوزات SLA" : "SLA Breaches",
              value: sla?.breachedCount ?? 0,
              icon: <AlertTriangle size={18} />,
              color: "#ef4444",
            },
            {
              title: isRTL ? "متوسط وقت الاستجابة" : "Avg Response Time",
              value: sla ? formatMinutes(sla.avgResponseMinutes) : "—",
              icon: <Clock size={18} />,
              color: "#f59e0b",
            },
            {
              title: isRTL ? "إجمالي الأنشطة" : "Total Activities",
              value: totalActivities,
              icon: <Activity size={18} />,
              color: tokens.primaryColor,
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
              </CardContent>
            </Card>
          ))}
        </div>

        {/* SLA Trend + Activity Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SLA Compliance Trend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield size={16} />
                {isRTL ? "اتجاه الالتزام بـ SLA" : "SLA Compliance Trend"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : slaTrendData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={slaTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="breached"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name={isRTL ? "تجاوزات" : "Breached"}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke={tokens.primaryColor}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name={isRTL ? "إجمالي" : "Total"}
                    />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Activity Trend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp size={16} />
                {isRTL ? "اتجاه الأنشطة" : "Activity Trend"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64" />
              ) : activityTrendData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={activityTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={tokens.accentColor}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name={isRTL ? "أنشطة" : "Activities"}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Type + Outcome Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity by Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Phone size={16} />
                {isRTL ? "الأنشطة حسب النوع" : "Activities by Type"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : activityTypeData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={activityTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                    >
                      {activityTypeData.map((entry: any, i: number) => (
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

          {/* Outcome Distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle size={16} />
                {isRTL ? "نتائج الأنشطة" : "Activity Outcomes"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : outcomeData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={outcomeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {outcomeData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Agent SLA Performance Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield size={16} />
              {isRTL ? "أداء SLA حسب الوكيل" : "Agent SLA Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "الوكيل" : "Agent"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "إجمالي العملاء" : "Total Leads"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "تم التواصل" : "Contacted"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "تجاوزات SLA" : "SLA Breaches"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "متوسط الاستجابة" : "Avg Response"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "معدل الالتزام" : "Compliance"}
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
                  ) : (data?.agentSlaPerformance ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        {isRTL ? "لا توجد بيانات" : "No data available"}
                      </td>
                    </tr>
                  ) : (
                    (data?.agentSlaPerformance ?? []).map((agent: any) => (
                      <tr key={agent.agentId} className="border-b border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3">{agent.totalLeads}</td>
                        <td className="px-4 py-3">
                          <span className="text-green-600">{agent.contactedCount}</span>
                        </td>
                        <td className="px-4 py-3">
                          {agent.breachedCount > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              {agent.breachedCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {agent.avgResponseMinutes > 0 ? formatMinutes(agent.avgResponseMinutes) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5 max-w-16">
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: `${Math.min(agent.complianceRate, 100)}%`,
                                  background: agent.complianceRate >= 80 ? tokens.successColor : "#ef4444",
                                }}
                              />
                            </div>
                            <span className="text-xs">{agent.complianceRate.toFixed(1)}%</span>
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

        {/* Agent Activity Breakdown Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity size={16} />
              {isRTL ? "تفاصيل أنشطة الوكلاء" : "Agent Activity Breakdown"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "الوكيل" : "Agent"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "الإجمالي" : "Total"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_COLORS.Call }} />
                        {isRTL ? "مكالمات" : "Calls"}
                      </span>
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_COLORS.WhatsApp }} />
                        WhatsApp
                      </span>
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_COLORS.Meeting }} />
                        {isRTL ? "اجتماعات" : "Meetings"}
                      </span>
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_COLORS.Email }} />
                        {isRTL ? "بريد" : "Email"}
                      </span>
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_COLORS.Offer }} />
                        {isRTL ? "عروض" : "Offers"}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-12" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (data?.agentActivityBreakdown ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        {isRTL ? "لا توجد بيانات" : "No data available"}
                      </td>
                    </tr>
                  ) : (
                    (data?.agentActivityBreakdown ?? []).map((agent: any) => (
                      <tr key={agent.agentId} className="border-b border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 font-bold">{agent.totalActivities}</td>
                        <td className="px-4 py-3">{agent.calls || "—"}</td>
                        <td className="px-4 py-3">{agent.whatsapp || "—"}</td>
                        <td className="px-4 py-3">{agent.meetings || "—"}</td>
                        <td className="px-4 py-3">{agent.emails || "—"}</td>
                        <td className="px-4 py-3">{agent.offers || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* SLA Breached Leads List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              {isRTL ? "العملاء المتجاوزون لـ SLA (بدون تواصل)" : "SLA Breached Leads (No Contact)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "العميل" : "Lead"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "المرحلة" : "Stage"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "الحملة" : "Campaign"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "الوكيل" : "Agent"}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {isRTL ? "الوقت المنقضي" : "Time Elapsed"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (data?.breachedLeadsList ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {isRTL ? "لا توجد تجاوزات" : "No SLA breaches"}
                      </td>
                    </tr>
                  ) : (
                    (data?.breachedLeadsList ?? []).map((lead: any) => (
                      <tr key={lead.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link href={`/leads/${lead.id}`} className="text-primary hover:underline font-medium">
                            {lead.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">{lead.stage}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.campaignName}</td>
                        <td className="px-4 py-3">{lead.ownerName}</td>
                        <td className="px-4 py-3">
                          <Badge variant="destructive" className="text-xs">
                            {lead.hoursElapsed}h
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}

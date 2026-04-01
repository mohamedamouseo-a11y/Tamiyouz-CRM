import CRMLayout from "@/components/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertTriangle, CheckCircle, TrendingUp, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { subDays } from "date-fns";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";

const COLORS = ["#6366f1", "#f97316", "#22c55e", "#ef4444", "#3b82f6", "#8b5cf6", "#06b6d4"];

export default function TeamDashboard() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: stats, isLoading } = trpc.dashboard.teamStats.useQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  if (!["Admin", "SalesManager", "admin"].includes(user?.role ?? "")) {
    return (
      <CRMLayout>
        <div className="p-6 text-center text-muted-foreground">
          {isRTL ? "غير مصرح لك بالوصول" : "Access denied"}
        </div>
      </CRMLayout>
    );
  }

  const kpiGradients = ["kpi-gradient-blue", "kpi-gradient-green", "kpi-gradient-yellow", "kpi-gradient-red"];

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap slide-up">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("teamDashboard")}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isRTL ? "نظرة عامة على أداء الفريق" : "Team performance overview"}
            </p>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} isRTL={isRTL} />
        </div>

        {/* Summary Cards - Staggered */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
          {[
            { title: t("totalLeads"), value: stats?.totalLeads ?? 0, icon: <Users size={18} />, color: tokens.primaryColor, href: "/leads" },
            { title: t("wonDeals"), value: stats?.wonDeals ?? 0, icon: <CheckCircle size={18} />, color: tokens.successColor, href: "/leads?stage=Won" },
            { title: t("totalRevenue"), value: `${(stats?.totalRevenue ?? 0).toLocaleString()} ${t("currency")}`, subtitle: (() => { const bd = (stats as any)?.revenueBreakdown; if (!bd || !Array.isArray(bd) || bd.length <= 1) return undefined; return bd.map((b: any) => `${Number(b.total).toLocaleString()} ${b.currency}`).join(" + "); })(), icon: <TrendingUp size={18} />, color: tokens.accentColor, href: "/leads?stage=Won" },
            { title: t("slaAlerts"), value: stats?.slaBreached ?? 0, icon: <AlertTriangle size={18} />, color: "#ef4444", href: "/leads?slaBreached=true" },
          ].map((card, i) => (
            <Link key={i} href={(card as any).href}><Card className={`cursor-pointer group ${kpiGradients[i]}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="kpi-icon w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ background: card.color }}>
                    {card.icon}
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <div className="h-8 w-16 bg-muted rounded animate-pulse" /> : card.value}
                </div>
                {(card as any).subtitle && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate" title={(card as any).subtitle}>{(card as any).subtitle}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
              </CardContent>
            </Card></Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leads by Agent */}
          <Card className="chart-container">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {isRTL ? "العملاء حسب الوكيل" : "Leads by Agent"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 bg-muted rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats?.leadsByAgent ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="agentName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    />
                    <Bar dataKey="count" fill={tokens.primaryColor} radius={[4, 4, 0, 0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Leads by Stage */}
          <Card className="chart-container">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {isRTL ? "العملاء حسب المرحلة" : "Leads by Stage"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 bg-muted rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={stats?.leadsByStage ?? []}
                      cx="50%"
                      cy="45%"
                      outerRadius={75}
                      innerRadius={30}
                      dataKey="count"
                      nameKey="stage"
                      animationDuration={800}
                      animationBegin={200}
                      label={({ stage, percent, x, y, midAngle }) => {
                        const p = (percent * 100);
                        if (p < 3) return null;
                        return (
                          <text x={x} y={y} textAnchor={midAngle > 180 ? "start" : "end"} dominantBaseline="central" style={{ fontSize: 11, fill: "var(--foreground)" }}>
                            {`${stage} ${p.toFixed(0)}%`}
                          </text>
                        );
                      }}
                      labelLine={({ percent }: any) => (percent * 100) >= 3}
                    >
                      {(stats?.leadsByStage ?? []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                      formatter={(value: any, name: any) => [value, name]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconSize={10}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Won Deals by Agent */}
          <Card className="chart-container">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {isRTL ? "الصفقات المكتسبة حسب الوكيل" : "Won Deals by Agent"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 bg-muted rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats?.dealsByAgent ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="agentName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    />
                    <Bar dataKey="wonDeals" fill={tokens.successColor} radius={[4, 4, 0, 0]} name={t("wonDeals")} animationDuration={800} />
                    <Bar dataKey="revenue" fill={tokens.accentColor} radius={[4, 4, 0, 0]} name={t("totalRevenue")} animationDuration={800} animationBegin={200} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Lead Quality Distribution */}
          <Card className="chart-container">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {isRTL ? "توزيع جودة العملاء" : "Lead Quality Distribution"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 bg-muted rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stats?.leadsByQuality ?? []}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="count"
                      nameKey="quality"
                      animationDuration={800}
                      animationBegin={200}
                    >
                      {(stats?.leadsByQuality ?? []).map((entry: any, i: number) => {
                        const qColors: Record<string, string> = {
                          Hot: "#ef4444", Warm: "#f97316", Cold: "#3b82f6", Bad: "#9ca3af", Unknown: "#cbd5e1",
                        };
                        return <Cell key={i} fill={qColors[entry.quality] ?? COLORS[i % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Agent Performance Table */}
        <Card className="slide-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t("agentPerformance")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("name")}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("totalLeads")}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("totalActivities")}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("wonDeals")}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("totalRevenue")}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("conversionRate")}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{isRTL ? "تواصل ← اجتماع" : "Contact → Meeting"}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{isRTL ? "اجتماع ← إغلاق" : "Meeting → Close"}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("slaAlerts")}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-muted rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (stats?.agentPerformance ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">{t("noData")}</td>
                    </tr>
                  ) : (
                    (stats?.agentPerformance ?? []).map((agent: any) => (
                      <tr key={agent.agentId} className="border-b border-border hover:bg-muted/30 transition-colors duration-200">
                        <td className="px-4 py-3 font-medium">
                          <span>{agent.agentName}</span>
                          {!agent.isActive && (
                            <span className="ml-2 text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{agent.totalLeads}</td>
                        <td className="px-4 py-3">{agent.totalActivities}</td>
                        <td className="px-4 py-3">
                          <span className="text-green-600 font-medium">{agent.wonDeals}</span>
                        </td>
                        <td className="px-4 py-3">
                          {agent.revenue > 0 ? `${agent.revenue.toLocaleString()} ${t("currency")}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5 max-w-16">
                              <div
                                className="h-1.5 rounded-full progress-bar-animated"
                                style={{
                                  width: `${Math.min(agent.conversionRate, 100)}%`,
                                  background: tokens.successColor,
                                }}
                              />
                            </div>
                            <span className="text-xs">{agent.conversionRate.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">{(agent.contactToMeetingRate ?? 0).toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">{(agent.meetingToCloseRate ?? 0).toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3">
                          {agent.slaBreached > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              {agent.slaBreached}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
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

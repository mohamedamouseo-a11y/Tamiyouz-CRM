import CRMLayout from "@/components/CRMLayout";
import LeadQualityBadge from "@/components/LeadQualityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle,
  Clock,
  DollarSign,
  Phone,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { format, subDays } from "date-fns";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";
import { useState } from "react";

export default function AgentDashboard() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();
  const isAdmin = ["Admin", "SalesManager", "admin"].includes(user?.role ?? "");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.agentStats.useQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });
  const { data: teamStats } = trpc.dashboard.teamStats.useQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  }, { enabled: isAdmin });
  const { data: myLeads } = trpc.leads.list.useQuery({ limit: 5, offset: 0 });
  const { data: myActivities } = trpc.activities.byUser.useQuery({ limit: 5 });
  const { data: slaLeads } = trpc.leads.list.useQuery({ slaBreached: true, limit: 5 });

  const statCards = [
    {
      title: t("totalLeads"),
      value: isAdmin ? (teamStats?.totalLeads ?? 0) : (stats?.totalLeads ?? 0),
      icon: <Users size={20} />,
      color: tokens.primaryColor,
      href: "/leads",
    },
    {
      title: t("totalActivities"),
      value: isAdmin ? (teamStats?.agentPerformance?.reduce((acc: any, curr: any) => acc + curr.totalActivities, 0) ?? 0) : (stats?.totalActivities ?? 0),
      icon: <Activity size={20} />,
      color: "#6366f1",
      href: "/leads?activities=true",
    },
    {
      title: t("wonDeals"),
      value: isAdmin ? (teamStats?.totalDeals?.find((d: any) => d.status === 'Won')?.count ?? 0) : (stats?.wonDeals ?? 0),
      icon: <CheckCircle size={20} />,
      color: tokens.successColor,
      href: "/leads?stage=Won",
    },
    {
      title: t("totalRevenue"),
      value: `${(isAdmin ? (teamStats?.totalDeals?.find((d: any) => d.status === 'Won')?.totalValue ?? 0) : (stats?.totalRevenue ?? 0)).toLocaleString()} ${t("currency")}`,
      icon: <DollarSign size={20} />,
      color: tokens.accentColor,
      href: "/leads?stage=Won",
    },
    {
      title: t("slaAlerts"),
      value: isAdmin ? (teamStats?.agentPerformance?.reduce((acc: any, curr: any) => acc + curr.slaBreached, 0) ?? 0) : (stats?.slaBreached ?? 0),
      icon: <AlertTriangle size={20} />,
      color: "#ef4444",
      href: "/leads?slaBreached=true",
    },
  ];

  const activityTypeIcons: Record<string, string> = {
    WhatsApp: "💬",
    Call: "📞",
    SMS: "📱",
    Meeting: "🤝",
    Offer: "📄",
    Email: "📧",
    Note: "📝",
  };

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("dashboard")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isRTL
                ? `مرحباً، ${user?.name ?? ""}! هذا ملخص أنشطتك`
                : `Welcome back, ${user?.name ?? ""}! Here's your activity summary`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <DateRangePicker value={dateRange} onChange={setDateRange} isRTL={isRTL} />
            <Link href="/leads">
              <Button style={{ background: tokens.primaryColor }} className="text-white gap-2">
                <Users size={16} />
                {t("myLeads")}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((card, i) => (
            <Link key={i} href={card.href}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                      style={{ background: card.color }}
                    >
                      {card.icon}
                    </div>
                    <ArrowUpRight size={14} className="text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {statsLoading ? (
                      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                    ) : (
                      card.value
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Leads */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold">{t("myLeads")}</CardTitle>
                <Link href="/leads">
                  <Button variant="ghost" size="sm" className="text-xs gap-1">
                    {t("view")} <ArrowUpRight size={12} />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {!myLeads?.items?.length ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    {t("noData")}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {myLeads.items.map((lead) => (
                      <Link key={lead.id} href={`/leads/${lead.id}`}>
                        <div
                          className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                            lead.slaBreached ? "sla-breached-row" : ""
                          }`}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                            style={{ background: tokens.primaryColor }}
                          >
                            {(lead.name ?? lead.phone)?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {lead.name ?? lead.phone}
                              </p>
                              {lead.slaBreached && (
                                <AlertTriangle size={12} className="text-destructive shrink-0" />
                              )}
                              {lead.isDuplicate && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  {t("duplicate")}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Phone size={10} className="text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{lead.phone}</span>
                              {lead.campaignName && (
                                <span className="text-xs text-muted-foreground truncate">
                                  · {lead.campaignName}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <LeadQualityBadge quality={lead.leadQuality} size="sm" />
                            <span className="text-xs text-muted-foreground">
                              {lead.stage}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* SLA Alerts */}
            {(slaLeads?.items?.length ?? 0) > 0 && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle size={14} />
                    {t("slaAlerts")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {slaLeads?.items?.map((lead) => (
                      <Link key={lead.id} href={`/leads/${lead.id}`}>
                        <div className="px-4 py-2.5 hover:bg-muted/50 cursor-pointer">
                          <p className="text-sm font-medium truncate">{lead.name ?? lead.phone}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock size={10} className="text-destructive" />
                            <span className="text-xs text-destructive">
                              {format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activities */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t("myActivities")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!myActivities?.length ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    {t("noActivities")}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {myActivities.map((activity) => (
                      <div key={activity.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {activityTypeIcons[activity.type] ?? "📌"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">{t(activity.type as any)}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {activity.notes ?? t(activity.outcome as any)}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(activity.activityTime), "dd/MM")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}

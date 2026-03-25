import ReminderCalendar from "@/components/ReminderCalendar";
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
  Eye,
  UserPlus,
  Handshake,
  HelpCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useLocation } from "wouter";
import { format, subDays } from "date-fns";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";
import { useState, useEffect } from "react";

export default function AgentDashboard() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = ["Admin", "SalesManager", "admin"].includes(user?.role ?? "");

  // Redirect Account Managers to their own dashboard
  useEffect(() => {
    if (user?.role === "AccountManager" || user?.role === "AccountManagerLead") {
      navigate("/am-dashboard");
    }
  }, [user?.role, navigate]);

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
  const { data: collaboratedLeads } = trpc.assignments.myCollaborated.useQuery();
  const { data: watchingLeads } = trpc.assignments.myWatching.useQuery();
  const { data: myActivities } = trpc.activities.byUser.useQuery({ limit: 5 });
  const { data: slaLeads } = trpc.leads.list.useQuery({ slaBreached: true, limit: 5 });

  const kpiGradients = [
    "kpi-gradient-blue",
    "kpi-gradient-blue",
    "kpi-gradient-green",
    "kpi-gradient-yellow",
    "kpi-gradient-red",
    "kpi-gradient-blue",
    "kpi-gradient-green",
  ];

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
      subtitle: (() => {
        const breakdown = isAdmin ? (teamStats as any)?.revenueBreakdown : (stats as any)?.revenueBreakdown;
        if (!breakdown || !Array.isArray(breakdown) || breakdown.length <= 1) return undefined;
        return breakdown.map((b: any) => `${Number(b.total).toLocaleString()} ${b.currency}`).join(" + ");
      })(),
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
    {
      title: isRTL ? "تحويل التواصل للاجتماع" : "Contact to Meeting",
      value: `${isAdmin ? (teamStats?.contactToMeetingRate ?? 0) : (stats?.contactToMeetingRate ?? 0)}%`,
      icon: <Phone size={20} />,
      color: "#8b5cf6",
      href: "/leads?stage=Meeting Scheduled",
      tooltip: isRTL ? "نسبة العملاء اللي تم التواصل معاهم ووصلوا لمرحلة الاجتماع" : "Percentage of contacted leads that reached the Meeting Scheduled stage",
    },
    {
      title: isRTL ? "تحويل الاجتماع للإغلاق" : "Meeting to Close",
      value: `${isAdmin ? (teamStats?.meetingToCloseRate ?? 0) : (stats?.meetingToCloseRate ?? 0)}%`,
      icon: <Handshake size={20} />,
      color: "#059669",
      href: "/leads?stage=Won",
      tooltip: isRTL ? "نسبة العملاء اللي حضروا اجتماع وتم إغلاق الصفقة معاهم" : "Percentage of leads with meetings that resulted in a Won deal",
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
        <div className="flex items-center justify-between slide-up">
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
              <Button style={{ background: tokens.primaryColor }} className="text-white gap-2 hover:opacity-90 transition-opacity">
                <Users size={16} />
                {t("myLeads")}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards - Staggered Animation */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 stagger-children">
          {statCards.map((card, i) => (
            <Link key={i} href={card.href}>
              <Card className={`cursor-pointer group ${kpiGradients[i] || ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="kpi-icon w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm"
                      style={{ background: card.color }}
                    >
                      {card.icon}
                    </div>
                    <div className="flex items-center gap-1">
                      {(card as any).tooltip && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle size={14} className="text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-xs">
                            {(card as any).tooltip}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {statsLoading ? (
                      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                    ) : (
                      card.value
                    )}
                  </div>
                  {(card as any).subtitle && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate" title={(card as any).subtitle}>{(card as any).subtitle}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leads with Collaboration Tabs */}
          <div className="lg:col-span-2 slide-up" style={{ animationDelay: '0.1s' }}>
            <Card>
              <CardContent className="p-4">
                <Tabs defaultValue="my-leads">
                  <div className="flex items-center justify-between mb-3">
                    <TabsList className="grid grid-cols-3 w-full max-w-md">
                      <TabsTrigger value="my-leads" className="gap-1.5 text-xs">
                        <Users size={14} /> {isRTL ? "الليدز" : "My Leads"}
                      </TabsTrigger>
                      <TabsTrigger value="shared" className="gap-1.5 text-xs">
                        <Handshake size={14} /> {isRTL ? "مشترك معي" : "Shared"}
                        {(collaboratedLeads as any[])?.length ? (
                          <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">{(collaboratedLeads as any[]).length}</Badge>
                        ) : null}
                      </TabsTrigger>
                      <TabsTrigger value="watching" className="gap-1.5 text-xs">
                        <Eye size={14} /> {isRTL ? "متابعة" : "Watching"}
                        {(watchingLeads as any[])?.length ? (
                          <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">{(watchingLeads as any[]).length}</Badge>
                        ) : null}
                      </TabsTrigger>
                    </TabsList>
                    <Link href="/leads">
                      <Button variant="ghost" size="sm" className="text-xs gap-1 hover:scale-105 transition-transform">
                        {t("view")} <ArrowUpRight size={12} />
                      </Button>
                    </Link>
                  </div>
                  <TabsContent value="my-leads" className="mt-0">
                    {!myLeads?.items?.length ? (
                      <div className="py-12 text-center text-muted-foreground text-sm">
                        {t("noData")}
                      </div>
                    ) : (
                      <div className="divide-y divide-border rounded-lg border">
                        {myLeads.items.map((lead, idx) => (
                          <Link key={lead.id} href={`/leads/${lead.id}`}>
                            <div
                              className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-all duration-200 ${
                                lead.slaBreached ? "sla-breached-row" : ""
                              }`}
                              style={{ animationDelay: `${idx * 50}ms` }}
                            >
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-sm"
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
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">
                                      SLA
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Phone size={10} className="text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{lead.phone}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <LeadQualityBadge quality={lead.leadQuality} size="sm" />
                                <span className="text-xs text-muted-foreground">{lead.stage}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="shared" className="mt-0">
                    {!(collaboratedLeads as any[])?.length ? (
                      <div className="py-12 text-center text-muted-foreground text-sm">
                        <Handshake size={32} className="mx-auto mb-2 opacity-30" />
                        <p>{isRTL ? "لا يوجد ليدز مشتركة معك حالياً" : "No shared leads yet"}</p>
                        <p className="text-xs mt-1">{isRTL ? "عندما يتم تعيينك كمتعاون على ليد، سيظهر هنا" : "When you're assigned as a collaborator, leads will appear here"}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border rounded-lg border">
                        {(collaboratedLeads as any[])?.map((lead: any) => (
                          <Link key={lead.id} href={`/leads/${lead.id}`}>
                            <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-all duration-200">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {lead.name ?? lead.phone}
                                  </p>
                                  <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-300" variant="outline">
                                    {isRTL ? "متعاون" : "Collaborator"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{isRTL ? "المالك:" : "Owner:"} {lead.ownerName}</span>
                                  {lead.assignmentReason && (
                                    <span className="text-xs text-muted-foreground truncate">· {lead.assignmentReason}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <LeadQualityBadge quality={lead.leadQuality} size="sm" />
                                <span className="text-xs text-muted-foreground">{lead.stage}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="watching" className="mt-0">
                    {!(watchingLeads as any[])?.length ? (
                      <div className="py-12 text-center text-muted-foreground text-sm">
                        <Eye size={32} className="mx-auto mb-2 opacity-30" />
                        <p>{isRTL ? "لا يوجد ليدز في المتابعة" : "No leads being watched"}</p>
                        <p className="text-xs mt-1">{isRTL ? "الليدز اللي سلمتها لحد تاني هتظهر هنا" : "Leads you handed over will appear here"}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border rounded-lg border">
                        {(watchingLeads as any[])?.map((lead: any) => (
                          <Link key={lead.id} href={`/leads/${lead.id}`}>
                            <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-all duration-200">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {lead.name ?? lead.phone}
                                  </p>
                                  <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 border-gray-300" variant="outline">
                                    <Eye size={10} className="mr-0.5" /> {isRTL ? "مراقب" : "Watching"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{isRTL ? "المالك الحالي:" : "Current owner:"} {lead.ownerName}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <LeadQualityBadge quality={lead.leadQuality} size="sm" />
                                <span className="text-xs text-muted-foreground">{lead.stage}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          {/* Right Column */}
          <div className="space-y-4">
            <ReminderCalendar />
            {/* SLA Alerts */}
            {(slaLeads?.items?.length ?? 0) > 0 && (
              <Card className="border-destructive/30 slide-up" style={{ animationDelay: '0.2s' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle size={14} className="animate-pulse" />
                    {t("slaAlerts")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {slaLeads?.items?.map((lead) => (
                      <Link key={lead.id} href={`/leads/${lead.id}`}>
                        <div className="px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-all duration-200">
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
            <Card className="slide-up" style={{ animationDelay: '0.3s' }}>
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
                      <div key={activity.id} className="px-4 py-2.5 hover:bg-muted/30 transition-colors duration-200">
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

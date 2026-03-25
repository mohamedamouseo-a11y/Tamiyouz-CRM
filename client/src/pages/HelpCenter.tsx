import React, { useMemo, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import CRMLayout from "@/components/CRMLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { Activity, ArrowRightLeft, BarChart3, Bell, Briefcase, Calendar, ClipboardList, Clock, Database, DollarSign, FileSpreadsheet, Filter, Globe, HelpCircle, LifeBuoy, LayoutDashboard, Lock, Megaphone, MessageSquare, Moon, Search, Settings, Shield, Sparkles, Star, Target, Trash2, TrendingUp, Users, Webhook, Zap } from "lucide-react";

interface HelpSection {
  id: string;
  slug: string;
  titleKey: string;
  icon: React.ReactNode;
  color: string;
  items: {
    questionKey: string;
    answerKey: string;
  }[];
}

const sections: HelpSection[] = [
    {
      id: "dashboard" ,
      slug: "dashboard" ,
      titleKey: "helpDashboard" ,
      icon: <LayoutDashboard className="h-5 w-5" />,
      color: "#6366f1" ,
      items: [
        { questionKey: "helpDashboardQ1", answerKey: "helpDashboardA1" },
        { questionKey: "helpDashboardQ2", answerKey: "helpDashboardA2" },
        { questionKey: "helpDashboardQ3", answerKey: "helpDashboardA3" },
        { questionKey: "helpDashboardQ4", answerKey: "helpDashboardA4" },
      ],
    },
    {
      id: "leads" ,
      slug: "leads" ,
      titleKey: "helpLeads" ,
      icon: <Users className="h-5 w-5" />,
      color: "#3b82f6" ,
      items: [
        { questionKey: "helpLeadsQ1", answerKey: "helpLeadsA1" },
        { questionKey: "helpLeadsQ2", answerKey: "helpLeadsA2" },
        { questionKey: "helpLeadsQ3", answerKey: "helpLeadsA3" },
        { questionKey: "helpLeadsQ4", answerKey: "helpLeadsA4" },
        { questionKey: "helpLeadsQ5", answerKey: "helpLeadsA5" },
      ],
    },
    {
      id: "leadProfile" ,
      slug: "lead-profile" ,
      titleKey: "helpLeadProfile" ,
      icon: <Target className="h-5 w-5" />,
      color: "#8b5cf6" ,
      items: [
        { questionKey: "helpLeadProfileQ1", answerKey: "helpLeadProfileA1" },
        { questionKey: "helpLeadProfileQ2", answerKey: "helpLeadProfileA2" },
        { questionKey: "helpLeadProfileQ3", answerKey: "helpLeadProfileA3" },
        { questionKey: "helpLeadProfileQ4", answerKey: "helpLeadProfileA4" },
        { questionKey: "helpLeadProfileQ5", answerKey: "helpLeadProfileA5" },
        { questionKey: "helpLeadProfileQ6", answerKey: "helpLeadProfileA6" },
        { questionKey: "helpLeadProfileQ7", answerKey: "helpLeadProfileA7" },
        { questionKey: "helpLeadProfileQ8", answerKey: "helpLeadProfileA8" },
      ],
    },
    {
      id: "activities" ,
      slug: "activities" ,
      titleKey: "helpActivities" ,
      icon: <MessageSquare className="h-5 w-5" />,
      color: "#10b981" ,
      items: [
        { questionKey: "helpActivitiesQ1", answerKey: "helpActivitiesA1" },
        { questionKey: "helpActivitiesQ2", answerKey: "helpActivitiesA2" },
        { questionKey: "helpActivitiesQ3", answerKey: "helpActivitiesA3" },
      ],
    },
    {
      id: "deals" ,
      slug: "deals" ,
      titleKey: "helpDeals" ,
      icon: <TrendingUp className="h-5 w-5" />,
      color: "#f59e0b" ,
      items: [
        { questionKey: "helpDealsQ1", answerKey: "helpDealsA1" },
        { questionKey: "helpDealsQ2", answerKey: "helpDealsA2" },
        { questionKey: "helpDealsQ3", answerKey: "helpDealsA3" },
      ],
    },
    {
      id: "sla" ,
      slug: "sla" ,
      titleKey: "helpSla" ,
      icon: <Clock className="h-5 w-5" />,
      color: "#ef4444" ,
      items: [
        { questionKey: "helpSlaQ1", answerKey: "helpSlaA1" },
        { questionKey: "helpSlaQ2", answerKey: "helpSlaA2" },
        { questionKey: "helpSlaQ3", answerKey: "helpSlaA3" },
      ],
    },
    {
      id: "salesFunnel" ,
      slug: "sales-funnel" ,
      titleKey: "helpSalesFunnel" ,
      icon: <Filter className="h-5 w-5" />,
      color: "#06b6d4" ,
      items: [
        { questionKey: "helpSalesFunnelQ1", answerKey: "helpSalesFunnelA1" },
        { questionKey: "helpSalesFunnelQ2", answerKey: "helpSalesFunnelA2" },
      ],
    },
    {
      id: "campaigns" ,
      slug: "campaigns" ,
      titleKey: "helpCampaigns" ,
      icon: <Megaphone className="h-5 w-5" />,
      color: "#ec4899" ,
      items: [
        { questionKey: "helpCampaignsQ1", answerKey: "helpCampaignsA1" },
        { questionKey: "helpCampaignsQ2", answerKey: "helpCampaignsA2" },
        { questionKey: "helpCampaignsQ3", answerKey: "helpCampaignsA3" },
      ],
    },
    {
      id: "campaignAnalytics" ,
      slug: "campaign-analytics" ,
      titleKey: "helpCampaignAnalytics" ,
      icon: <BarChart3 className="h-5 w-5" />,
      color: "#d946ef" ,
      items: [
        { questionKey: "helpCampaignAnalyticsQ1", answerKey: "helpCampaignAnalyticsA1" },
        { questionKey: "helpCampaignAnalyticsQ2", answerKey: "helpCampaignAnalyticsA2" },
      ],
    },
    {
      id: "metaCampaigns" ,
      slug: "meta-campaigns" ,
      titleKey: "helpMetaCampaigns" ,
      icon: <Megaphone className="h-5 w-5" />,
      color: "#1877F2" ,
      items: [
        { questionKey: "helpMetaCampaignsQ1", answerKey: "helpMetaCampaignsA1" },
        { questionKey: "helpMetaCampaignsQ2", answerKey: "helpMetaCampaignsA2" },
        { questionKey: "helpMetaCampaignsQ3", answerKey: "helpMetaCampaignsA3" },
      ],
    },
    {
      id: "metaCombinedAnalytics" ,
      slug: "meta-combined-analytics" ,
      titleKey: "helpMetaCombined" ,
      icon: <Activity className="h-5 w-5" />,
      color: "#4267B2" ,
      items: [
        { questionKey: "helpMetaCombinedQ1", answerKey: "helpMetaCombinedA1" },
        { questionKey: "helpMetaCombinedQ2", answerKey: "helpMetaCombinedA2" },
        { questionKey: "helpMetaCombinedQ3", answerKey: "helpMetaCombinedA3" },
      ],
    },
    {
      id: "metaLeadgen" ,
      slug: "meta-leadgen" ,
      titleKey: "helpMetaLeadgen" ,
      icon: <Webhook className="h-5 w-5" />,
      color: "#0866FF" ,
      items: [
        { questionKey: "helpMetaLeadgenQ1", answerKey: "helpMetaLeadgenA1" },
        { questionKey: "helpMetaLeadgenQ2", answerKey: "helpMetaLeadgenA2" },
        { questionKey: "helpMetaLeadgenQ3", answerKey: "helpMetaLeadgenA3" },
        { questionKey: "helpMetaLeadgenQ4", answerKey: "helpMetaLeadgenA4" },
        { questionKey: "helpMetaLeadgenQ5", answerKey: "helpMetaLeadgenA5" },
        { questionKey: "helpMetaLeadgenQ6", answerKey: "helpMetaLeadgenA6" },
        { questionKey: "helpMetaLeadgenQ7", answerKey: "helpMetaLeadgenA7" },
        { questionKey: "helpMetaLeadgenQ8", answerKey: "helpMetaLeadgenA8" },
      ],
    },
    {
      id: "tiktokCampaigns" ,
      slug: "tiktok-campaigns" ,
      titleKey: "helpTikTok" ,
      icon: <Activity className="h-5 w-5" />,
      color: "#010101" ,
      items: [
        { questionKey: "helpTikTokQ1", answerKey: "helpTikTokA1" },
        { questionKey: "helpTikTokQ2", answerKey: "helpTikTokA2" },
        { questionKey: "helpTikTokQ3", answerKey: "helpTikTokA3" },
      ],
    },
    {
      id: "calendar" ,
      slug: "calendar" ,
      titleKey: "helpCalendar" ,
      icon: <Calendar className="h-5 w-5" />,
      color: "#14b8a6" ,
      items: [
        { questionKey: "helpCalendarQ1", answerKey: "helpCalendarA1" },
        { questionKey: "helpCalendarQ2", answerKey: "helpCalendarA2" },
      ],
    },
    {
      id: "amDashboard" ,
      slug: "am-dashboard" ,
      titleKey: "helpAMDashboard" ,
      icon: <Zap className="h-5 w-5" />,
      color: "#7c3aed" ,
      items: [
        { questionKey: "helpAMDashboardQ1", answerKey: "helpAMDashboardA1" },
        { questionKey: "helpAMDashboardQ2", answerKey: "helpAMDashboardA2" },
        { questionKey: "helpAMDashboardQ3", answerKey: "helpAMDashboardA3" },
      ],
    },
    {
      id: "amCalendar" ,
      slug: "am-calendar" ,
      titleKey: "helpAMCalendar" ,
      icon: <Calendar className="h-5 w-5" />,
      color: "#8b5cf6" ,
      items: [
        { questionKey: "helpAMCalendarQ1", answerKey: "helpAMCalendarA1" },
        { questionKey: "helpAMCalendarQ2", answerKey: "helpAMCalendarA2" },
      ],
    },
    {
      id: "clients" ,
      slug: "clients" ,
      titleKey: "helpClients" ,
      icon: <Briefcase className="h-5 w-5" />,
      color: "#a855f7" ,
      items: [
        { questionKey: "helpClientsQ1", answerKey: "helpClientsA1" },
        { questionKey: "helpClientsQ2", answerKey: "helpClientsA2" },
        { questionKey: "helpClientsQ3", answerKey: "helpClientsA3" },
      ],
    },
    {
      id: "clientProfile" ,
      slug: "client-profile" ,
      titleKey: "helpClientProfile" ,
      icon: <Briefcase className="h-5 w-5" />,
      color: "#9333ea" ,
      items: [
        { questionKey: "helpClientProfileQ1", answerKey: "helpClientProfileA1" },
        { questionKey: "helpClientProfileQ2", answerKey: "helpClientProfileA2" },
        { questionKey: "helpClientProfileQ3", answerKey: "helpClientProfileA3" },
        { questionKey: "helpClientProfileQ4", answerKey: "helpClientProfileA4" },
      ],
    },
    {
      id: "renewals" ,
      slug: "renewals" ,
      titleKey: "helpRenewals" ,
      icon: <Activity className="h-5 w-5" />,
      color: "#f97316" ,
      items: [
        { questionKey: "helpRenewalsQ1", answerKey: "helpRenewalsA1" },
        { questionKey: "helpRenewalsQ2", answerKey: "helpRenewalsA2" },
      ],
    },
    {
      id: "teamDashboard" ,
      slug: "team-dashboard" ,
      titleKey: "helpTeamDashboard" ,
      icon: <BarChart3 className="h-5 w-5" />,
      color: "#0ea5e9" ,
      items: [
        { questionKey: "helpTeamDashboardQ1", answerKey: "helpTeamDashboardA1" },
        { questionKey: "helpTeamDashboardQ2", answerKey: "helpTeamDashboardA2" },
      ],
    },
    {
      id: "amLeadDashboard" ,
      slug: "am-lead-dashboard" ,
      titleKey: "helpAMLeadDashboard" ,
      icon: <BarChart3 className="h-5 w-5" />,
      color: "#6d28d9" ,
      items: [
        { questionKey: "helpAMLeadDashboardQ1", answerKey: "helpAMLeadDashboardA1" },
        { questionKey: "helpAMLeadDashboardQ2", answerKey: "helpAMLeadDashboardA2" },
      ],
    },
    {
      id: "csatSurvey" ,
      slug: "csat-survey" ,
      titleKey: "helpCSAT" ,
      icon: <Star className="h-5 w-5" />,
      color: "#eab308" ,
      items: [
        { questionKey: "helpCSATQ1", answerKey: "helpCSATA1" },
        { questionKey: "helpCSATQ2", answerKey: "helpCSATA2" },
      ],
    },
    {
      id: "import" ,
      slug: "import" ,
      titleKey: "helpImport" ,
      icon: <FileSpreadsheet className="h-5 w-5" />,
      color: "#22c55e" ,
      items: [
        { questionKey: "helpImportQ1", answerKey: "helpImportA1" },
        { questionKey: "helpImportQ2", answerKey: "helpImportA2" },
      ],
    },
    {
      id: "transfers" ,
      slug: "transfers" ,
      titleKey: "helpTransfers" ,
      icon: <ArrowRightLeft className="h-5 w-5" />,
      color: "#64748b" ,
      items: [
        { questionKey: "helpTransfersQ1", answerKey: "helpTransfersA1" },
        { questionKey: "helpTransfersQ2", answerKey: "helpTransfersA2" },
      ],
    },
    {
      id: "trash" ,
      slug: "trash" ,
      titleKey: "helpTrash" ,
      icon: <Trash2 className="h-5 w-5" />,
      color: "#dc2626" ,
      items: [
        { questionKey: "helpTrashQ1", answerKey: "helpTrashA1" },
        { questionKey: "helpTrashQ2", answerKey: "helpTrashA2" },
        { questionKey: "helpTrashQ3", answerKey: "helpTrashA3" },
      ],
    },
    {
      id: "auditLog" ,
      slug: "audit-log" ,
      titleKey: "helpAuditLog" ,
      icon: <ClipboardList className="h-5 w-5" />,
      color: "#475569" ,
      items: [
        { questionKey: "helpAuditLogQ1", answerKey: "helpAuditLogA1" },
        { questionKey: "helpAuditLogQ2", answerKey: "helpAuditLogA2" },
        { questionKey: "helpAuditLogQ3", answerKey: "helpAuditLogA3" },
      ],
    },
    {
      id: "chatMonitor" ,
      slug: "chat-monitor" ,
      titleKey: "helpChatMonitor" ,
      icon: <MessageSquare className="h-5 w-5" />,
      color: "#1e40af" ,
      items: [
        { questionKey: "helpChatMonitorQ1", answerKey: "helpChatMonitorA1" },
        { questionKey: "helpChatMonitorQ2", answerKey: "helpChatMonitorA2" },
      ],
    },
    {
      id: "supportCenter" ,
      slug: "support-center" ,
      titleKey: "helpSupportCenter" ,
      icon: <LifeBuoy className="h-5 w-5" />,
      color: "#6366f1" ,
      items: [
        { questionKey: "helpSupportCenterQ1", answerKey: "helpSupportCenterA1" },
        { questionKey: "helpSupportCenterQ2", answerKey: "helpSupportCenterA2" },
        { questionKey: "helpSupportCenterQ3", answerKey: "helpSupportCenterA3" },
      ],
    },
    {
      id: "admin" ,
      slug: "admin" ,
      titleKey: "helpAdmin" ,
      icon: <Settings className="h-5 w-5" />,
      color: "#78716c" ,
      items: [
        { questionKey: "helpAdminQ1", answerKey: "helpAdminA1" },
        { questionKey: "helpAdminQ2", answerKey: "helpAdminA2" },
        { questionKey: "helpAdminQ3", answerKey: "helpAdminA3" },
        { questionKey: "helpAdminQ4", answerKey: "helpAdminA4" },
      ],
    },
    {
      id: "customFields" ,
      slug: "custom-fields" ,
      titleKey: "helpCustomFields" ,
      icon: <Settings className="h-5 w-5" />,
      color: "#7c3aed" ,
      items: [
        { questionKey: "helpCustomFieldsQ1", answerKey: "helpCustomFieldsA1" },
        { questionKey: "helpCustomFieldsQ2", answerKey: "helpCustomFieldsA2" },
      ],
    },
    {
      id: "leadSources" ,
      slug: "lead-sources" ,
      titleKey: "helpLeadSources" ,
      icon: <Globe className="h-5 w-5" />,
      color: "#0891b2" ,
      items: [
        { questionKey: "helpLeadSourcesQ1", answerKey: "helpLeadSourcesA1" },
        { questionKey: "helpLeadSourcesQ2", answerKey: "helpLeadSourcesA2" },
      ],
    },
    {
      id: "backup" ,
      slug: "backup" ,
      titleKey: "helpBackup" ,
      icon: <Database className="h-5 w-5" />,
      color: "#059669" ,
      items: [
        { questionKey: "helpBackupQ1", answerKey: "helpBackupA1" },
        { questionKey: "helpBackupQ2", answerKey: "helpBackupA2" },
      ],
    },
    {
      id: "notifications" ,
      slug: "notifications" ,
      titleKey: "helpNotifications" ,
      icon: <Bell className="h-5 w-5" />,
      color: "#f59e0b" ,
      items: [
        { questionKey: "helpNotificationsQ1", answerKey: "helpNotificationsA1" },
        { questionKey: "helpNotificationsQ2", answerKey: "helpNotificationsA2" },
      ],
    },
    {
      id: "meetingNotifications" ,
      slug: "meeting-notifications" ,
      titleKey: "helpMeetingNotifs" ,
      icon: <Bell className="h-5 w-5" />,
      color: "#8b5cf6" ,
      items: [
        { questionKey: "helpMeetingNotifsQ1", answerKey: "helpMeetingNotifsA1" },
        { questionKey: "helpMeetingNotifsQ2", answerKey: "helpMeetingNotifsA2" },
      ],
    },
    {
      id: "metaIntegration" ,
      slug: "meta-integration" ,
      titleKey: "helpMetaIntegration" ,
      icon: <Settings className="h-5 w-5" />,
      color: "#1877F2" ,
      items: [
        { questionKey: "helpMetaIntegrationQ1", answerKey: "helpMetaIntegrationA1" },
        { questionKey: "helpMetaIntegrationQ2", answerKey: "helpMetaIntegrationA2" },
        { questionKey: "helpMetaIntegrationQ3", answerKey: "helpMetaIntegrationA3" },
      ],
    },
    {
      id: "tiktokIntegration" ,
      slug: "tiktok-integration" ,
      titleKey: "helpTikTokIntegration" ,
      icon: <Settings className="h-5 w-5" />,
      color: "#010101" ,
      items: [
        { questionKey: "helpTikTokIntegrationQ1", answerKey: "helpTikTokIntegrationA1" },
        { questionKey: "helpTikTokIntegrationQ2", answerKey: "helpTikTokIntegrationA2" },
      ],
    },
    {
      id: "rakanAI" ,
      slug: "rakan-ai" ,
      titleKey: "helpRakanAI" ,
      icon: <Sparkles className="h-5 w-5" />,
      color: "#7c3aed" ,
      items: [
        { questionKey: "helpRakanAIQ1", answerKey: "helpRakanAIA1" },
        { questionKey: "helpRakanAIQ2", answerKey: "helpRakanAIA2" },
        { questionKey: "helpRakanAIQ3", answerKey: "helpRakanAIA3" },
      ],
    },
    {
      id: "roles" ,
      slug: "roles" ,
      titleKey: "helpRoles" ,
      icon: <Shield className="h-5 w-5" />,
      color: "#0d9488" ,
      items: [
        { questionKey: "helpRolesQ1", answerKey: "helpRolesA1" },
        { questionKey: "helpRolesQ2", answerKey: "helpRolesA2" },
      ],
    },
    {
      id: "darkMode" ,
      slug: "dark-mode" ,
      titleKey: "helpDarkMode" ,
      icon: <Moon className="h-5 w-5" />,
      color: "#334155" ,
      items: [
        { questionKey: "helpDarkModeQ1", answerKey: "helpDarkModeA1" },
        { questionKey: "helpDarkModeQ2", answerKey: "helpDarkModeA2" },
      ],
    },
    {
      id: "language" ,
      slug: "language" ,
      titleKey: "helpLanguage" ,
      icon: <Globe className="h-5 w-5" />,
      color: "#2563eb" ,
      items: [
        { questionKey: "helpLanguageQ1", answerKey: "helpLanguageA1" },
        { questionKey: "helpLanguageQ2", answerKey: "helpLanguageA2" },
      ],
    },
    {
      id: "leadIntelligence" ,
      slug: "lead-intelligence" ,
      titleKey: "helpLeadIntelligence" ,
      icon: <Sparkles className="h-5 w-5" />,
      color: "#059669" ,
      items: [
        { questionKey: "helpLIQ1", answerKey: "helpLIA1" },
        { questionKey: "helpLIQ2", answerKey: "helpLIA2" },
        { questionKey: "helpLIQ3", answerKey: "helpLIA3" },
        { questionKey: "helpLIQ4", answerKey: "helpLIA4" },
        { questionKey: "helpLIQ5", answerKey: "helpLIA5" },
        { questionKey: "helpLIQ6", answerKey: "helpLIA6" },
        { questionKey: "helpLIQ7", answerKey: "helpLIA7" },
        { questionKey: "helpLIQ8", answerKey: "helpLIA8" },
        { questionKey: "helpLIQ9", answerKey: "helpLIA9" },
        { questionKey: "helpLIQ10", answerKey: "helpLIA10" },
        { questionKey: "helpLIQ11", answerKey: "helpLIA11" },
        { questionKey: "helpLIQ12", answerKey: "helpLIA12" },
      ],
    },
    {
      id: "passwordReset" ,
      slug: "password-reset" ,
      titleKey: "helpPasswordReset" ,
      icon: <Lock className="h-5 w-5" />,
      color: "#dc2626" ,
      items: [
        { questionKey: "helpPasswordResetQ1", answerKey: "helpPasswordResetA1" },
        { questionKey: "helpPasswordResetQ2", answerKey: "helpPasswordResetA2" },
      ],
    },
];

export default function HelpCenter() {
  const [searchTerm, setSearchTerm] = useState("");
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const [, params] = useRoute("/help-center/:slug");
  const [, navigate] = useLocation();
  const activeSlug = params?.slug || null;
  const activeSection = activeSlug ? sections.find(s => s.slug === activeSlug) : null;

  const filteredSections = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return sections;

    return sections
      .map((section) => {
        const title = String(t(section.titleKey) || "").toLowerCase();
        const matchedItems = section.items.filter((item) => {
          const question = String(t(item.questionKey) || "").toLowerCase();
          const answer = String(t(item.answerKey) || "").toLowerCase();
          return title.includes(term) || question.includes(term) || answer.includes(term);
        });

        if (title.includes(term)) {
          return section;
        }

        if (matchedItems.length > 0) {
          return { ...section, items: matchedItems };
        }

        return null;
      })
      .filter(Boolean) as HelpSection[];
  }, [searchTerm, t]);

  const totalVisibleQuestions = useMemo(
    () => filteredSections.reduce((sum, section) => sum + section.items.length, 0),
    [filteredSections]
  );

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <CRMLayout>
      <div className={`min-h-full space-y-6 p-4 md:p-6 ${isRTL ? "font-sans" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
        <Card className="overflow-hidden border-0 shadow-sm">
          <div
            className="relative"
            style={{
              background: `linear-gradient(135deg, ${tokens.primaryColor || "#0f172a"} 0%, ${tokens.accentColor || "#6366f1"} 100%)`,
            }}
          >
            <div className="absolute inset-0 bg-black/10" />
            <CardContent className="relative flex flex-col gap-4 p-6 text-white md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
                  <HelpCircle className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold md:text-3xl">{t("helpCenterTitle")}</h1>
                  <p className="max-w-3xl text-sm text-white/90 md:text-base">{t("helpCenterSubtitle")}</p>
                </div>
              </div>

              <div className="flex min-w-[180px] items-center gap-3 self-start rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm md:self-auto">
                <LifeBuoy className="h-5 w-5" />
                <div>
                  <div className="text-sm font-semibold">{filteredSections.length}</div>
                  <div className="text-xs text-white/80">
                    {totalVisibleQuestions} {totalVisibleQuestions === 1 ? t("helpQuestionSingular") : t("helpQuestionPlural")}
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.6fr,1fr]">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" style={{ [isRTL ? "right" : "left"]: "12px" }} />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("helpSearchPlaceholder")}
                  className={`h-11 rounded-xl border-muted bg-background/70 ${isRTL ? "pr-10 text-right" : "pl-10"}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("helpCenter")}</CardTitle>
              <CardDescription>Quick access</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0">
              {[
                { key: "helpQuickLeads", sectionId: "leads", icon: <Users className="h-4 w-4" /> },
                { key: "helpQuickActivities", sectionId: "activities", icon: <MessageSquare className="h-4 w-4" /> },
                { key: "helpQuickDeals", sectionId: "deals", icon: <TrendingUp className="h-4 w-4" /> },
                { key: "helpQuickSettings", sectionId: "admin", icon: <Settings className="h-4 w-4" /> },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => scrollToSection(item.sectionId)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted"
                >
                  {item.icon}
                  <span className="truncate">{t(item.key)}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {activeSection ? (
          /* === Single Section Detail View === */
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => navigate("/help-center")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                {t("helpBackToAll" as any) || "Back to Help Center"}
              </button>
            </div>
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: activeSection.color }} />
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl p-4 text-white" style={{ backgroundColor: activeSection.color }}>
                    {activeSection.icon}
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{t(activeSection.titleKey)}</CardTitle>
                    <CardDescription className="mt-1">
                      {activeSection.items.length} {activeSection.items.length === 1 ? t("helpQuestionSingular") : t("helpQuestionPlural")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {activeSection.items.map((item, idx) => (
                  <Accordion key={item.questionKey} type="single" collapsible>
                    <AccordionItem value={item.questionKey} className="border rounded-lg px-4">
                      <AccordionTrigger className="text-sm font-medium hover:no-underline py-4">
                        <span className="flex items-center gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ backgroundColor: activeSection.color }}>
                            {idx + 1}
                          </span>
                          {t(item.questionKey)}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 ps-10">
                        {t(item.answerKey)}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : filteredSections.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {t("helpNoResults")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredSections.map((section) => (
              <Card key={section.id} id={section.id} className="border-0 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]" onClick={() => navigate(`/help-center/${section.slug}`)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl p-3 text-white" style={{ backgroundColor: section.color }}>
                        {section.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{t(section.titleKey)}</CardTitle>
                        <CardDescription>
                          {section.items.length} {section.items.length === 1 ? t("helpQuestionSingular") : t("helpQuestionPlural")}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-3 py-1" style={{ color: section.color, borderColor: `${section.color}22`, backgroundColor: `${section.color}12` }}>
                      {section.items.length} {section.items.length === 1 ? t("helpQuestionSingular") : t("helpQuestionPlural")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {section.items.slice(0, 3).map((item) => (
                      <span key={item.questionKey} className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5 truncate max-w-[200px]">
                        {t(item.questionKey)}
                      </span>
                    ))}
                    {section.items.length > 3 && (
                      <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">+{section.items.length - 3}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            {t("helpFooter")}
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}

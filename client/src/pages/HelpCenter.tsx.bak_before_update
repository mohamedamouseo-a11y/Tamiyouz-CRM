import CRMLayout from "@/components/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  ClipboardList,
  FileSpreadsheet,
  Filter,
  HelpCircle,
  LayoutDashboard,
  Megaphone,
  Search,
  Settings,
  Trash2,
  Users,
  Zap,
  Activity,
  Phone,
  MessageSquare,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  Paperclip,
  Target,
  TrendingUp,
  Shield,
  Star,
} from "lucide-react";
import { useState, useMemo } from "react";

interface HelpSection {
  id: string;
  titleKey: string;
  icon: React.ReactNode;
  color: string;
  items: {
    questionKey: string;
    answerKey: string;
  }[];
}

export default function HelpCenter() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const [searchQuery, setSearchQuery] = useState("");

  const sections: HelpSection[] = useMemo(
    () => [
      {
        id: "dashboard",
        titleKey: "helpDashboard",
        icon: <LayoutDashboard size={20} />,
        color: "#6366f1",
        items: [
          { questionKey: "helpDashboardQ1", answerKey: "helpDashboardA1" },
          { questionKey: "helpDashboardQ2", answerKey: "helpDashboardA2" },
          { questionKey: "helpDashboardQ3", answerKey: "helpDashboardA3" },
          { questionKey: "helpDashboardQ4", answerKey: "helpDashboardA4" },
        ],
      },
      {
        id: "leads",
        titleKey: "helpLeads",
        icon: <Users size={20} />,
        color: "#3b82f6",
        items: [
          { questionKey: "helpLeadsQ1", answerKey: "helpLeadsA1" },
          { questionKey: "helpLeadsQ2", answerKey: "helpLeadsA2" },
          { questionKey: "helpLeadsQ3", answerKey: "helpLeadsA3" },
          { questionKey: "helpLeadsQ4", answerKey: "helpLeadsA4" },
          { questionKey: "helpLeadsQ5", answerKey: "helpLeadsA5" },
        ],
      },
      {
        id: "leadProfile",
        titleKey: "helpLeadProfile",
        icon: <Target size={20} />,
        color: "#8b5cf6",
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
        id: "activities",
        titleKey: "helpActivities",
        icon: <MessageSquare size={20} />,
        color: "#10b981",
        items: [
          { questionKey: "helpActivitiesQ1", answerKey: "helpActivitiesA1" },
          { questionKey: "helpActivitiesQ2", answerKey: "helpActivitiesA2" },
          { questionKey: "helpActivitiesQ3", answerKey: "helpActivitiesA3" },
        ],
      },
      {
        id: "deals",
        titleKey: "helpDeals",
        icon: <TrendingUp size={20} />,
        color: "#f59e0b",
        items: [
          { questionKey: "helpDealsQ1", answerKey: "helpDealsA1" },
          { questionKey: "helpDealsQ2", answerKey: "helpDealsA2" },
          { questionKey: "helpDealsQ3", answerKey: "helpDealsA3" },
        ],
      },
      {
        id: "sla",
        titleKey: "helpSla",
        icon: <Clock size={20} />,
        color: "#ef4444",
        items: [
          { questionKey: "helpSlaQ1", answerKey: "helpSlaA1" },
          { questionKey: "helpSlaQ2", answerKey: "helpSlaA2" },
          { questionKey: "helpSlaQ3", answerKey: "helpSlaA3" },
        ],
      },
      {
        id: "salesFunnel",
        titleKey: "helpSalesFunnel",
        icon: <Filter size={20} />,
        color: "#06b6d4",
        items: [
          { questionKey: "helpSalesFunnelQ1", answerKey: "helpSalesFunnelA1" },
          { questionKey: "helpSalesFunnelQ2", answerKey: "helpSalesFunnelA2" },
        ],
      },
      {
        id: "campaigns",
        titleKey: "helpCampaigns",
        icon: <Megaphone size={20} />,
        color: "#ec4899",
        items: [
          { questionKey: "helpCampaignsQ1", answerKey: "helpCampaignsA1" },
          { questionKey: "helpCampaignsQ2", answerKey: "helpCampaignsA2" },
          { questionKey: "helpCampaignsQ3", answerKey: "helpCampaignsA3" },
        ],
      },
      {
        id: "calendar",
        titleKey: "helpCalendar",
        icon: <Calendar size={20} />,
        color: "#14b8a6",
        items: [
          { questionKey: "helpCalendarQ1", answerKey: "helpCalendarA1" },
          { questionKey: "helpCalendarQ2", answerKey: "helpCalendarA2" },
        ],
      },
      {
        id: "clients",
        titleKey: "helpClients",
        icon: <Briefcase size={20} />,
        color: "#a855f7",
        items: [
          { questionKey: "helpClientsQ1", answerKey: "helpClientsA1" },
          { questionKey: "helpClientsQ2", answerKey: "helpClientsA2" },
          { questionKey: "helpClientsQ3", answerKey: "helpClientsA3" },
        ],
      },
      {
        id: "renewals",
        titleKey: "helpRenewals",
        icon: <Activity size={20} />,
        color: "#f97316",
        items: [
          { questionKey: "helpRenewalsQ1", answerKey: "helpRenewalsA1" },
          { questionKey: "helpRenewalsQ2", answerKey: "helpRenewalsA2" },
        ],
      },
      {
        id: "teamDashboard",
        titleKey: "helpTeamDashboard",
        icon: <BarChart3 size={20} />,
        color: "#0ea5e9",
        items: [
          { questionKey: "helpTeamDashboardQ1", answerKey: "helpTeamDashboardA1" },
          { questionKey: "helpTeamDashboardQ2", answerKey: "helpTeamDashboardA2" },
        ],
      },
      {
        id: "import",
        titleKey: "helpImport",
        icon: <FileSpreadsheet size={20} />,
        color: "#22c55e",
        items: [
          { questionKey: "helpImportQ1", answerKey: "helpImportA1" },
          { questionKey: "helpImportQ2", answerKey: "helpImportA2" },
        ],
      },
      {
        id: "transfers",
        titleKey: "helpTransfers",
        icon: <ArrowRightLeft size={20} />,
        color: "#64748b",
        items: [
          { questionKey: "helpTransfersQ1", answerKey: "helpTransfersA1" },
          { questionKey: "helpTransfersQ2", answerKey: "helpTransfersA2" },
        ],
      },
      {
        id: "admin",
        titleKey: "helpAdmin",
        icon: <Settings size={20} />,
        color: "#78716c",
        items: [
          { questionKey: "helpAdminQ1", answerKey: "helpAdminA1" },
          { questionKey: "helpAdminQ2", answerKey: "helpAdminA2" },
          { questionKey: "helpAdminQ3", answerKey: "helpAdminA3" },
          { questionKey: "helpAdminQ4", answerKey: "helpAdminA4" },
        ],
      },
      {
        id: "roles",
        titleKey: "helpRoles",
        icon: <Shield size={20} />,
        color: "#0d9488",
        items: [
          { questionKey: "helpRolesQ1", answerKey: "helpRolesA1" },
          { questionKey: "helpRolesQ2", answerKey: "helpRolesA2" },
        ],
      },
    ],
    []
  );

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            t(item.questionKey as any).toLowerCase().includes(query) ||
            t(item.answerKey as any).toLowerCase().includes(query) ||
            t(section.titleKey as any).toLowerCase().includes(query)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery, sections, t]);

  return (
    <CRMLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3 pb-2">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto"
            style={{ background: `${tokens.accentColor}15` }}
          >
            <BookOpen size={32} style={{ color: tokens.accentColor }} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {t("helpCenterTitle" as any)}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
            {t("helpCenterSubtitle" as any)}
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto">
          <Search
            size={16}
            className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${
              isRTL ? "right-3" : "left-3"
            }`}
          />
          <Input
            placeholder={t("helpSearchPlaceholder" as any)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={isRTL ? "pr-9" : "pl-9"}
          />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              icon: <Users size={18} />,
              labelKey: "helpQuickLeads",
              color: "#3b82f6",
            },
            {
              icon: <MessageSquare size={18} />,
              labelKey: "helpQuickActivities",
              color: "#10b981",
            },
            {
              icon: <TrendingUp size={18} />,
              labelKey: "helpQuickDeals",
              color: "#f59e0b",
            },
            {
              icon: <Settings size={18} />,
              labelKey: "helpQuickSettings",
              color: "#78716c",
            },
          ].map((item) => (
            <button
              key={item.labelKey}
              onClick={() => {
                const sectionId =
                  item.labelKey === "helpQuickLeads"
                    ? "leads"
                    : item.labelKey === "helpQuickActivities"
                    ? "activities"
                    : item.labelKey === "helpQuickDeals"
                    ? "deals"
                    : "admin";
                document
                  .getElementById(`help-section-${sectionId}`)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex items-center gap-2 p-3 rounded-xl border border-border/60 bg-card hover:bg-accent/50 transition-colors text-start"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${item.color}15`, color: item.color }}
              >
                {item.icon}
              </div>
              <span className="text-xs font-medium text-foreground truncate">
                {t(item.labelKey as any)}
              </span>
            </button>
          ))}
        </div>

        {/* Sections */}
        {filteredSections.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={40} className="text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">
                {t("helpNoResults" as any)}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSections.map((section) => (
              <Card
                key={section.id}
                id={`help-section-${section.id}`}
                className="overflow-hidden"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: `${section.color}15`,
                        color: section.color,
                      }}
                    >
                      {section.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">
                        {t(section.titleKey as any)}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {section.items.length}{" "}
                        {section.items.length === 1
                          ? t("helpQuestionSingular" as any)
                          : t("helpQuestionPlural" as any)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-xs shrink-0"
                      style={{
                        background: `${section.color}15`,
                        color: section.color,
                      }}
                    >
                      {section.items.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Accordion type="single" collapsible className="w-full">
                    {section.items.map((item, idx) => (
                      <AccordionItem
                        key={idx}
                        value={`${section.id}-${idx}`}
                      >
                        <AccordionTrigger className="text-sm font-medium hover:no-underline">
                          <div className="flex items-center gap-2">
                            <HelpCircle
                              size={14}
                              className="text-muted-foreground/50 shrink-0"
                            />
                            <span>{t(item.questionKey as any)}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div
                            className={`text-sm text-muted-foreground leading-relaxed ${
                              isRTL ? "pr-6" : "pl-6"
                            }`}
                          >
                            {t(item.answerKey as any)}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            {t("helpFooter" as any)}
          </p>
        </div>
      </div>
    </CRMLayout>
  );
}

export interface HelpCenterRouteEntry {
  slug: string;
  priority: string;
  changefreq: string;
}

const baseSectionSlugs = [
  "getting-started--dashboard",
  "getting-started--settings",
  "getting-started--roles-permissions",
  "getting-started--data-import",
  "getting-started--backup",
  "sales-customers--leads",
  "sales-customers--deals",
  "sales-customers--sales-funnel",
  "sales-customers--activities",
  "sales-customers--renewals",
  "sales-customers--customers",
  "sales-customers--customer-profile",
  "sales-customers--tamara-payments",
  "sales-customers--client-handover",
  "marketing-campaigns--campaigns",
  "marketing-campaigns--meta-campaigns",
  "marketing-campaigns--tiktok-campaigns",
  "marketing-campaigns--campaign-analytics",
  "marketing-campaigns--meta-integration",
  "marketing-campaigns--tiktok-integration",
  "reports-analytics--team-dashboard",
  "reports-analytics--audit-log",
  "reports-analytics--meta-aggregated-analytics",
  "reports-analytics--account-manager-dashboard",
  "smart-tools-ai--rakan-ai",
  "smart-tools-ai--lead-intelligence",
  "smart-tools-ai--conversation-monitoring",
  "settings-advanced--custom-fields",
  "settings-advanced--lead-sources",
  "settings-advanced--notifications",
  "settings-advanced--dark-mode",
  "settings-advanced--language",
  "settings-advanced--reset-password",
];

const extraSectionSlugs = [
  "reports-analytics--task-sla",
  "sales-customers--lead-profile",
  "sales-customers--sales-calendar",
  "sales-customers--inbox",
  "settings-advanced--trash",
  "settings-advanced--support-center",
  "sales-customers--am-calendar",
  "reports-analytics--am-lead-dashboard",
  "reports-analytics--tam-dashboard",
  "sales-customers--csat-survey",
  "settings-advanced--forgot-password",
  "settings-advanced--meeting-reminders",
  "marketing-campaigns--landing-page-integrations",
  "marketing-campaigns--meta-leadgen",
  "settings-advanced--paymob",
  "settings-advanced--innocall",
  "settings-advanced--currency-settings",
  "settings-advanced--packages",
  "reports-analytics--dashboard-audit",
  "settings-advanced--developer-hub",
  "settings-advanced--demo-sync",
];

export const HELP_CENTER_ROUTES: HelpCenterRouteEntry[] = [
  { slug: "", priority: "1.0", changefreq: "weekly" },
  ...[...baseSectionSlugs, ...extraSectionSlugs].map((slug) => ({
    slug,
    priority: "0.8",
    changefreq: "monthly",
  })),
];

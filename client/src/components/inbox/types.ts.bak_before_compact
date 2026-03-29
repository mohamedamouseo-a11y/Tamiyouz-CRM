// client/src/components/inbox/types.ts

export type InboxTab = "all" | "priority" | "unread" | "sla" | "leads" | "reminders" | "campaigns";
export type InboxBaseTab = Exclude<InboxTab, "priority">;
export type InboxDateRange = "all" | "today" | "week" | "month";

export type InboxMessage = {
  id: number;
  type: string;
  title: string;
  titleAr?: string | null;
  body: string;
  bodyAr?: string | null;
  isRead: boolean;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type InboxCounts = {
  all: number;
  unread: number;
  sla: number;
  leads: number;
  reminders: number;
  campaigns: number;
  priority?: number;
};

export type InboxTypeOption = {
  value: string;
  label: string;
  labelAr: string;
};

export type InboxSidebarItem = {
  key: InboxTab;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  countKey: keyof InboxCounts;
  route?: string;
  tone?: "default" | "danger" | "success" | "priority";
};

export const TYPE_OPTIONS: readonly InboxTypeOption[] = [
  { value: "all", label: "All Types", labelAr: "كل الأنواع" },
  { value: "new_lead", label: "New Lead", labelAr: "عميل جديد" },
  { value: "lead_assigned", label: "Lead Assigned", labelAr: "تم تعيين عميل" },
  { value: "lead_distribution", label: "Lead Distribution", labelAr: "توزيع عملاء" },
  { value: "sla_breach", label: "SLA Breach", labelAr: "تجاوز SLA" },
  { value: "reminder", label: "Reminder", labelAr: "تذكير" },
  { value: "meeting_reminder", label: "Meeting Reminder", labelAr: "تذكير اجتماع" },
  { value: "follow_up_reminder", label: "Follow-up Reminder", labelAr: "تذكير متابعة" },
  { value: "campaign_alert", label: "Campaign Alert", labelAr: "تنبيه حملة" },
] as const;

export const DATE_RANGE_OPTIONS: readonly { value: InboxDateRange; label: string; labelAr: string }[] = [
  { value: "all", label: "All Time", labelAr: "الكل" },
  { value: "today", label: "Today", labelAr: "اليوم" },
  { value: "week", label: "This Week", labelAr: "هذا الأسبوع" },
  { value: "month", label: "This Month", labelAr: "هذا الشهر" },
] as const;

export const SIDEBAR_ITEMS: readonly InboxSidebarItem[] = [
  {
    key: "priority",
    label: "Priority",
    labelAr: "عاجل",
    description: "Unread SLA + fresh new leads",
    descriptionAr: "تنبيهات SLA غير المقروءة والليدز الجديدة",
    countKey: "priority",
    tone: "priority",
  },
  {
    key: "all",
    label: "Inbox",
    labelAr: "صندوق الوارد",
    description: "Everything in one place",
    descriptionAr: "كل الإشعارات في مكان واحد",
    countKey: "all",
    tone: "default",
  },
  {
    key: "unread",
    label: "Unread",
    labelAr: "غير مقروء",
    description: "Items that still need attention",
    descriptionAr: "إشعارات ما زالت تحتاج انتباهًا",
    countKey: "unread",
    tone: "default",
  },
  {
    key: "sla",
    label: "SLA Alerts",
    labelAr: "تنبيهات SLA",
    description: "Time-sensitive lead follow-up alerts",
    descriptionAr: "تنبيهات المتابعة الحرجة زمنيًا",
    countKey: "sla",
    tone: "danger",
  },
  {
    key: "leads",
    label: "New Leads",
    labelAr: "عملاء جدد",
    description: "Related to the Leads workspace",
    descriptionAr: "مرتبطة مباشرة بصفحة العملاء المحتملين",
    countKey: "leads",
    route: "/leads",
    tone: "success",
  },
  {
    key: "reminders",
    label: "Reminders",
    labelAr: "التذكيرات",
    description: "Meetings and follow-ups",
    descriptionAr: "الاجتماعات والمتابعات القادمة",
    countKey: "reminders",
    tone: "default",
  },
  {
    key: "campaigns",
    label: "Campaigns",
    labelAr: "الحملات",
    description: "Connected to campaign monitoring",
    descriptionAr: "مرتبطة بصفحة الحملات والإعلانات",
    countKey: "campaigns",
    route: "/campaigns",
    tone: "default",
  },
] as const;

export function formatInboxCount(count: number) {
  if (count < 1000) return String(count);
  const compact = Math.floor(count / 1000);
  return `${compact}K+`;
}

export function getMessageTitle(message: InboxMessage, isArabic?: boolean) {
  return isArabic ? message.titleAr || message.title : message.title;
}

export function getMessageBody(message: InboxMessage, isArabic?: boolean) {
  return isArabic ? message.bodyAr || message.body : message.body;
}

export function formatInboxTime(value: string, isArabic?: boolean) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return isArabic ? "الآن" : "Just now";
  if (diffMins < 60) return isArabic ? `منذ ${diffMins} د` : `${diffMins}m ago`;
  if (diffHours < 24) return isArabic ? `منذ ${diffHours} س` : `${diffHours}h ago`;

  return new Intl.DateTimeFormat(isArabic ? "ar" : undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function getMessageGroupLabel(value: string, isArabic?: boolean): string {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (date >= today) return isArabic ? "اليوم" : "Today";
  if (date >= yesterday) return isArabic ? "أمس" : "Yesterday";
  if (date >= weekAgo) return isArabic ? "هذا الأسبوع" : "This Week";
  return isArabic ? "أقدم" : "Older";
}

export function matchesDateRange(value: string, range: InboxDateRange) {
  if (range === "all") return true;
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === "today") {
    return date >= today;
  }

  if (range === "week") {
    const weekStart = new Date(today.getTime() - 6 * 86400000);
    return date >= weekStart;
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return date >= monthStart;
}

export function getMessageLeadId(message: InboxMessage): number | null {
  const leadId = message.metadata?.leadId;
  const parsed = Number(leadId ?? NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getMessageLeadName(message: InboxMessage): string {
  return String(message.metadata?.leadName ?? message.metadata?.clientName ?? "").trim();
}

export function getMessagePhone(message: InboxMessage): string {
  return String(message.metadata?.phone ?? message.metadata?.contactPhone ?? "").trim();
}

export function getMessageCampaignName(message: InboxMessage): string {
  return String(message.metadata?.campaignName ?? "").trim();
}

export function getMessageAssignedTo(message: InboxMessage): string {
  return String(message.metadata?.assignedToName ?? "").trim();
}

export function getMessageLink(message: InboxMessage): string | null {
  if (message.link) return message.link;
  const leadId = getMessageLeadId(message);
  if (leadId) return `/leads/${leadId}`;
  return null;
}

export function getSearchableText(message: InboxMessage) {
  const textParts = [
    message.title,
    message.titleAr,
    message.body,
    message.bodyAr,
    getMessageLeadName(message),
    getMessagePhone(message),
    getMessageCampaignName(message),
    getMessageAssignedTo(message),
    String(message.metadata?.status ?? ""),
    String(message.metadata?.platform ?? ""),
  ];

  return textParts.filter(Boolean).join(" ").toLowerCase();
}

export function isLeadType(type: string) {
  return ["new_lead", "lead_assigned", "lead_distribution"].includes(type);
}

export function isReminderType(type: string) {
  return ["reminder", "meeting_reminder", "follow_up_reminder"].includes(type);
}

export function isPriorityMessage(message: InboxMessage) {
  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  const isFreshLead = message.type === "new_lead" && ageMs <= 48 * 60 * 60 * 1000;
  const isUnreadSla = message.type === "sla_breach" && !message.isRead;
  return isUnreadSla || isFreshLead;
}

export function getEmptyStateCopy(tab: InboxTab, isArabic?: boolean) {
  const map: Record<InboxTab, { title: string; titleAr: string; body: string; bodyAr: string }> = {
    all: {
      title: "Inbox is clear",
      titleAr: "صندوق الوارد هادئ الآن",
      body: "No notifications match the current filters.",
      bodyAr: "لا توجد إشعارات تطابق الفلاتر الحالية.",
    },
    priority: {
      title: "No urgent items",
      titleAr: "لا توجد عناصر عاجلة",
      body: "Unread SLA alerts and fresh leads will appear here.",
      bodyAr: "ستظهر هنا تنبيهات SLA غير المقروءة والليدز الجديدة.",
    },
    unread: {
      title: "Everything is read",
      titleAr: "جميع الإشعارات مقروءة",
      body: "You are all caught up for now.",
      bodyAr: "أنت متابع لكل شيء حاليًا.",
    },
    sla: {
      title: "No SLA alerts",
      titleAr: "لا توجد تنبيهات SLA",
      body: "Time-sensitive alerts will appear here.",
      bodyAr: "ستظهر هنا التنبيهات الحساسة زمنيًا.",
    },
    leads: {
      title: "No new lead notifications",
      titleAr: "لا توجد إشعارات لعملاء جدد",
      body: "New lead events will appear here.",
      bodyAr: "ستظهر هنا إشعارات العملاء الجدد.",
    },
    reminders: {
      title: "No reminders",
      titleAr: "لا توجد تذكيرات",
      body: "Meeting and follow-up reminders will appear here.",
      bodyAr: "ستظهر هنا تذكيرات الاجتماعات والمتابعات.",
    },
    campaigns: {
      title: "No campaign alerts",
      titleAr: "لا توجد تنبيهات حملات",
      body: "Campaign performance notifications will appear here.",
      bodyAr: "ستظهر هنا تنبيهات أداء الحملات.",
    },
  };

  const item = map[tab];
  return {
    title: isArabic ? item.titleAr : item.title,
    body: isArabic ? item.bodyAr : item.body,
  };
}

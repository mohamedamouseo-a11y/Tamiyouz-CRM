import {
  AlertTriangle,
  BellDot,
  CalendarClock,
  Clock,
  Inbox,
  Megaphone,
  Search,
  UserCheck,
  UserPlus,
  UserRoundSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "./types";

type Props = {
  items: InboxMessage[];
  selectedId?: number | null;
  onSelect: (item: InboxMessage) => void;
  isArabic?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
};

/* ── Time helpers ───────────────────────────────────────────── */

function formatMessageTime(value: string, isArabic?: boolean) {
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

function getTimeGroup(value: string, isArabic?: boolean): string {
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

/* ── Icon & color config per type ──────────────────────────── */

type TypeConfig = {
  icon: typeof AlertTriangle;
  color: string;
  bg: string;
  border: string;
  borderLeft: string;
  label: string;
  labelAr: string;
  tagBg: string;
  tagText: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  new_lead: {
    icon: UserPlus,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    borderLeft: "border-l-emerald-500",
    label: "New Lead",
    labelAr: "عميل جديد",
    tagBg: "bg-emerald-100 dark:bg-emerald-900/40",
    tagText: "text-emerald-700 dark:text-emerald-300",
  },
  lead_assigned: {
    icon: UserCheck,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    borderLeft: "border-l-blue-500",
    label: "Lead Assigned",
    labelAr: "تم تعيين عميل",
    tagBg: "bg-blue-100 dark:bg-blue-900/40",
    tagText: "text-blue-700 dark:text-blue-300",
  },
  lead_distribution: {
    icon: UserRoundSearch,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    border: "border-cyan-200 dark:border-cyan-800",
    borderLeft: "border-l-cyan-500",
    label: "Distribution",
    labelAr: "توزيع",
    tagBg: "bg-cyan-100 dark:bg-cyan-900/40",
    tagText: "text-cyan-700 dark:text-cyan-300",
  },
  sla_breach: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    borderLeft: "border-l-red-500",
    label: "SLA Breach",
    labelAr: "تجاوز SLA",
    tagBg: "bg-red-100 dark:bg-red-900/40",
    tagText: "text-red-700 dark:text-red-300",
  },
  follow_up_reminder: {
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    borderLeft: "border-l-amber-500",
    label: "Follow-up",
    labelAr: "متابعة",
    tagBg: "bg-amber-100 dark:bg-amber-900/40",
    tagText: "text-amber-700 dark:text-amber-300",
  },
  meeting_reminder: {
    icon: CalendarClock,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    borderLeft: "border-l-purple-500",
    label: "Meeting",
    labelAr: "اجتماع",
    tagBg: "bg-purple-100 dark:bg-purple-900/40",
    tagText: "text-purple-700 dark:text-purple-300",
  },
  reminder: {
    icon: CalendarClock,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    borderLeft: "border-l-orange-500",
    label: "Reminder",
    labelAr: "تذكير",
    tagBg: "bg-orange-100 dark:bg-orange-900/40",
    tagText: "text-orange-700 dark:text-orange-300",
  },
  campaign_alert: {
    icon: Megaphone,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800",
    borderLeft: "border-l-indigo-500",
    label: "Campaign",
    labelAr: "حملة",
    tagBg: "bg-indigo-100 dark:bg-indigo-900/40",
    tagText: "text-indigo-700 dark:text-indigo-300",
  },
};

const DEFAULT_CONFIG: TypeConfig = {
  icon: Inbox,
  color: "text-gray-600 dark:text-gray-400",
  bg: "bg-gray-50 dark:bg-gray-950/30",
  border: "border-gray-200 dark:border-gray-800",
  borderLeft: "border-l-gray-400",
  label: "Notification",
  labelAr: "إشعار",
  tagBg: "bg-gray-100 dark:bg-gray-900/40",
  tagText: "text-gray-700 dark:text-gray-300",
};

function getConfig(type: string): TypeConfig {
  return TYPE_CONFIG[type] ?? DEFAULT_CONFIG;
}

/* ── Component ─────────────────────────────────────────────── */

export function MessageList({ items, selectedId, onSelect, isArabic, searchQuery, onSearchChange }: Props) {
  /* ── Search bar ── */
  const searchBar = onSearchChange != null && (
    <div className="border-b px-3 py-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={isArabic ? "بحث بالاسم أو الرقم أو الحملة..." : "Search by name, phone, or campaign..."}
          className="w-full rounded-lg border bg-muted/30 py-2 pe-3 ps-9 text-sm placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </div>
  );

  if (!items.length) {
    return (
      <div className="flex h-full flex-col">
        {searchBar}
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          {isArabic ? "لا توجد رسائل تطابق الفلاتر الحالية." : "No messages match the current filters."}
        </div>
      </div>
    );
  }

  /* ── Group items by time ── */
  const groups: { label: string; items: InboxMessage[] }[] = [];
  let lastGroup = "";
  for (const item of items) {
    const group = getTimeGroup(item.createdAt, isArabic);
    if (group !== lastGroup) {
      groups.push({ label: group, items: [item] });
      lastGroup = group;
    } else {
      groups[groups.length - 1].items.push(item);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {searchBar}
      <div className="flex-1 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label}>
            {/* Time group header */}
            <div className="sticky top-0 z-10 border-b bg-muted/60 px-4 py-1.5 backdrop-blur-sm">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </span>
            </div>

            {group.items.map((item) => {
              const cfg = getConfig(item.type);
              const Icon = cfg.icon;
              const isSelected = item.id === selectedId;
              const isUnread = !item.isRead;
              const title = isArabic ? item.titleAr || item.title : item.title;
              const body = isArabic ? item.bodyAr || item.body : item.body;
              const isRecent = Date.now() - new Date(item.createdAt).getTime() < 15 * 60 * 1000;
              const isLeadType = ["new_lead", "lead_assigned", "lead_distribution"].includes(item.type);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={cn(
                    "group w-full border-b border-l-4 px-4 py-3.5 text-start transition-all hover:bg-muted/60",
                    cfg.borderLeft,
                    isSelected && "bg-muted/80 ring-1 ring-inset ring-primary/10",
                    isUnread && !isSelected && "bg-white dark:bg-background",
                    !isUnread && !isSelected && "opacity-75",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={cn(
                        "mt-0.5 flex-shrink-0 rounded-lg border p-2",
                        cfg.bg,
                        cfg.border,
                        cfg.color,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {/* Top row: type tag + time */}
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              cfg.tagBg,
                              cfg.tagText,
                            )}
                          >
                            {isArabic ? cfg.labelAr : cfg.label}
                          </span>
                          {isRecent && isLeadType && (
                            <span className="inline-flex animate-pulse items-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-emerald-200">
                              NEW
                            </span>
                          )}
                          {isUnread && !isRecent && (
                            <BellDot className="h-3 w-3 text-blue-500" />
                          )}
                        </div>
                        <span className="flex-shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                          {formatMessageTime(item.createdAt, isArabic)}
                        </span>
                      </div>

                      {/* Title */}
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          isUnread ? "font-bold text-foreground" : "font-medium text-foreground/80",
                        )}
                      >
                        {title}
                      </p>

                      {/* Body / subtitle */}
                      {body && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{body}</p>
                      )}

                      {/* Metadata chips for lead types */}
                      {isLeadType && item.metadata && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {(item.metadata as any).phone && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              📱 {String((item.metadata as any).phone)}
                            </span>
                          )}
                          {(item.metadata as any).campaignName && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              🏷 {String((item.metadata as any).campaignName)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

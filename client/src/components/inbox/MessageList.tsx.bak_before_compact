// client/src/components/inbox/MessageList.tsx

import {
  AlertTriangle,
  BellDot,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Inbox,
  Loader2,
  Megaphone,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  UserRoundSearch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  DATE_RANGE_OPTIONS,
  formatInboxTime,
  getEmptyStateCopy,
  getMessageBody,
  getMessageGroupLabel,
  getMessageLeadName,
  getMessageTitle,
  TYPE_OPTIONS,
  type InboxDateRange,
  type InboxMessage,
  type InboxTab,
} from "./types";

type Props = {
  items: InboxMessage[];
  selectedId?: number | null;
  selectedIds: Set<number>;
  onSelect: (item: InboxMessage) => void;
  onToggleSelect: (itemId: number, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  allVisibleSelected: boolean;
  isArabic?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  dateRange: InboxDateRange;
  onDateRangeChange: (value: InboxDateRange) => void;
  selectedCount: number;
  onBulkMarkRead: () => void;
  onBulkMarkUnread: () => void;
  onBulkArchive: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading?: boolean;
  isFetchingMore?: boolean;
  currentTab: InboxTab;
};

type TypeConfig = {
  icon: typeof AlertTriangle;
  borderClass: string;
  tintClass: string;
  badgeClass: string;
  label: string;
  labelAr: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  new_lead: {
    icon: UserPlus,
    borderClass: "border-s-emerald-500",
    tintClass: "bg-emerald-50/90 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "New Lead",
    labelAr: "عميل جديد",
  },
  lead_assigned: {
    icon: UserCheck,
    borderClass: "border-s-blue-500",
    tintClass: "bg-blue-50/90 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "Lead Assigned",
    labelAr: "تم تعيين عميل",
  },
  lead_distribution: {
    icon: UserRoundSearch,
    borderClass: "border-s-cyan-500",
    tintClass: "bg-cyan-50/90 hover:bg-cyan-50 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/30",
    badgeClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    label: "Distribution",
    labelAr: "توزيع",
  },
  sla_breach: {
    icon: AlertTriangle,
    borderClass: "border-s-red-500",
    tintClass: "bg-red-50/90 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "SLA Breach",
    labelAr: "تجاوز SLA",
  },
  follow_up_reminder: {
    icon: Clock,
    borderClass: "border-s-amber-500",
    tintClass: "bg-amber-50/90 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "Follow-up",
    labelAr: "متابعة",
  },
  meeting_reminder: {
    icon: CalendarClock,
    borderClass: "border-s-purple-500",
    tintClass: "bg-purple-50/90 hover:bg-purple-50 dark:bg-purple-950/20 dark:hover:bg-purple-950/30",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    label: "Meeting",
    labelAr: "اجتماع",
  },
  reminder: {
    icon: CalendarClock,
    borderClass: "border-s-orange-500",
    tintClass: "bg-orange-50/90 hover:bg-orange-50 dark:bg-orange-950/20 dark:hover:bg-orange-950/30",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    label: "Reminder",
    labelAr: "تذكير",
  },
  campaign_alert: {
    icon: Megaphone,
    borderClass: "border-s-indigo-500",
    tintClass: "bg-indigo-50/90 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/30",
    badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    label: "Campaign",
    labelAr: "حملة",
  },
};

const FALLBACK_TYPE: TypeConfig = {
  icon: Inbox,
  borderClass: "border-s-slate-400",
  tintClass: "bg-muted/40 hover:bg-muted/60",
  badgeClass: "bg-muted text-muted-foreground",
  label: "Notification",
  labelAr: "إشعار",
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? FALLBACK_TYPE;
}

function ListSkeleton() {
  return (
    <div className="space-y-3 px-3 py-3">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border/70 p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageList({
  items,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onToggleSelectAll,
  allVisibleSelected,
  isArabic,
  searchQuery,
  onSearchChange,
  type,
  onTypeChange,
  dateRange,
  onDateRangeChange,
  selectedCount,
  onBulkMarkRead,
  onBulkMarkUnread,
  onBulkArchive,
  onLoadMore,
  hasMore,
  isLoading,
  isFetchingMore,
  currentTab,
}: Props) {
  const groups = items.reduce<Record<string, InboxMessage[]>>((acc, item) => {
    const key = getMessageGroupLabel(item.createdAt, isArabic);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const groupEntries = Object.entries(groups);
  const emptyState = getEmptyStateCopy(currentTab, isArabic);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background">
      <div className="border-b bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-10 rounded-xl bg-muted/40 ps-9"
                placeholder={isArabic ? "ابحث بالاسم أو الرقم أو الحملة..." : "Search by lead, phone, campaign..."}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {isArabic ? "النوع:" : "Type:"}
              </span>
              <Select value={type} onValueChange={onTypeChange}>
                <SelectTrigger className="h-10 min-w-[160px] rounded-xl bg-background">
                  <SelectValue placeholder={isArabic ? "كل الأنواع" : "All Types"} />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {isArabic ? option.labelAr : option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={(value) => onDateRangeChange(value as InboxDateRange)}>
                <SelectTrigger className="h-10 min-w-[150px] rounded-xl bg-background">
                  <SelectValue placeholder={isArabic ? "الفترة" : "Range"} />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {isArabic ? option.labelAr : option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allVisibleSelected && items.length > 0}
                onCheckedChange={(checked) => onToggleSelectAll(Boolean(checked))}
                aria-label={isArabic ? "تحديد الكل" : "Select all"}
              />
              <span>{isArabic ? "تحديد الكل" : "Select all"}</span>
            </label>

            <span className="text-xs font-medium text-muted-foreground">
              {isArabic ? `${items.length} إشعار` : `${items.length} notifications`}
            </span>
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex justify-center">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
            <span className="text-sm font-semibold">
              {isArabic ? `تم تحديد ${selectedCount}` : `${selectedCount} selected`}
            </span>
            <Button size="sm" className="rounded-xl" onClick={onBulkMarkRead}>
              <CheckCheck className="me-2 h-4 w-4" />
              {isArabic ? "تعليم كمقروء" : "Mark as read"}
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={onBulkMarkUnread}>
              <Check className="me-2 h-4 w-4" />
              {isArabic ? "تعليم كغير مقروء" : "Mark unread"}
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={onBulkArchive}>
              <Trash2 className="me-2 h-4 w-4" />
              {isArabic ? "أرشفة" : "Archive"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : !items.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold">{emptyState.title}</h3>
              <p className="max-w-sm text-sm text-muted-foreground">{emptyState.body}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-3 py-3">
            {groupEntries.map(([groupLabel, groupItems]) => (
              <section key={groupLabel} className="space-y-2">
                <div className="sticky top-0 z-10 -mx-3 border-y bg-background/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {groupLabel} ({groupItems.length})
                  </span>
                </div>

                {groupItems.map((item) => {
                  const config = getTypeConfig(item.type);
                  const Icon = config.icon;
                  const title = getMessageTitle(item, isArabic);
                  const body = getMessageBody(item, isArabic);
                  const leadName = getMessageLeadName(item);
                  const isSelected = item.id === selectedId;
                  const isChecked = selectedIds.has(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item)}
                      className={cn(
                        "group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-border/80 border-s-4 px-3 py-3 text-start transition-all",
                        config.borderClass,
                        config.tintClass,
                        isSelected && "ring-2 ring-primary/25",
                      )}
                    >
                      <div className="pt-1">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => onToggleSelect(item.id, Boolean(checked))}
                          onClick={(event) => event.stopPropagation()}
                          className={cn(
                            "transition-opacity data-[state=checked]:opacity-100",
                            isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          )}
                          aria-label={isArabic ? "تحديد الإشعار" : "Select notification"}
                        />
                      </div>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-background/80 text-foreground shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("rounded-full px-2 py-0 text-[10px] font-semibold", config.badgeClass)}>
                            {isArabic ? config.labelAr : config.label}
                          </Badge>

                          {leadName && (
                            <span className={cn("truncate text-sm", !item.isRead ? "font-bold" : "font-semibold")}>{leadName}</span>
                          )}

                          {!item.isRead && <BellDot className="h-3.5 w-3.5 shrink-0 text-blue-500" />}

                          <span className="ms-auto shrink-0 text-[11px] text-muted-foreground">
                            {formatInboxTime(item.createdAt, isArabic)}
                          </span>
                        </div>

                        {!leadName && (
                          <p className={cn("truncate text-sm", !item.isRead ? "font-bold" : "font-semibold")}>{title}</p>
                        )}

                        <p className="truncate text-xs text-muted-foreground">
                          {leadName ? title : body || title}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </section>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" className="rounded-xl" onClick={onLoadMore} disabled={isFetchingMore}>
                  {isFetchingMore ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="me-2 h-4 w-4" />
                  )}
                  {isArabic ? "تحميل المزيد" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

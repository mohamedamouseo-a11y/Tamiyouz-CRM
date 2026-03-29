// client/src/components/inbox/MessageList.tsx

import {
  AlertTriangle,
  BellDot,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
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
  isLoading?: boolean;
  isFetchingMore?: boolean;
  currentTab: InboxTab;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
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
    tintClass: "bg-emerald-50/60 hover:bg-emerald-50 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    label: "New Lead",
    labelAr: "عميل جديد",
  },
  lead_assigned: {
    icon: UserCheck,
    borderClass: "border-s-blue-500",
    tintClass: "bg-blue-50/60 hover:bg-blue-50 dark:bg-blue-950/10 dark:hover:bg-blue-950/20",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    label: "Assigned",
    labelAr: "تعيين",
  },
  lead_distribution: {
    icon: UserRoundSearch,
    borderClass: "border-s-cyan-500",
    tintClass: "bg-cyan-50/60 hover:bg-cyan-50 dark:bg-cyan-950/10 dark:hover:bg-cyan-950/20",
    badgeClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    label: "Distribution",
    labelAr: "توزيع",
  },
  sla_breach: {
    icon: AlertTriangle,
    borderClass: "border-s-red-500",
    tintClass: "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/10 dark:hover:bg-red-950/20",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    label: "SLA",
    labelAr: "SLA",
  },
  follow_up_reminder: {
    icon: Clock,
    borderClass: "border-s-amber-500",
    tintClass: "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/10 dark:hover:bg-amber-950/20",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    label: "Follow-up",
    labelAr: "متابعة",
  },
  meeting_reminder: {
    icon: CalendarClock,
    borderClass: "border-s-purple-500",
    tintClass: "bg-purple-50/60 hover:bg-purple-50 dark:bg-purple-950/10 dark:hover:bg-purple-950/20",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    label: "Meeting",
    labelAr: "اجتماع",
  },
  reminder: {
    icon: CalendarClock,
    borderClass: "border-s-orange-500",
    tintClass: "bg-orange-50/60 hover:bg-orange-50 dark:bg-orange-950/10 dark:hover:bg-orange-950/20",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    label: "Reminder",
    labelAr: "تذكير",
  },
  campaign_alert: {
    icon: Megaphone,
    borderClass: "border-s-indigo-500",
    tintClass: "bg-indigo-50/60 hover:bg-indigo-50 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/20",
    badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    label: "Campaign",
    labelAr: "حملة",
  },
};

const FALLBACK_TYPE: TypeConfig = {
  icon: Inbox,
  borderClass: "border-s-slate-400",
  tintClass: "bg-muted/30 hover:bg-muted/50",
  badgeClass: "bg-muted text-muted-foreground",
  label: "Notification",
  labelAr: "إشعار",
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? FALLBACK_TYPE;
}

function ListSkeleton() {
  return (
    <div className="space-y-1 px-2 py-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2 rounded-lg border border-border/50 p-2">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-12" />
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
  isLoading,
  isFetchingMore,
  currentTab,
  currentPage,
  totalPages,
  onPageChange,
}: Props) {
  const emptyState = getEmptyStateCopy(currentTab, isArabic);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background">
      {/* Compact toolbar: search + filters on one row */}
      <div className="border-b bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 rounded-lg bg-muted/40 ps-8 text-xs"
              placeholder={isArabic ? "بحث..." : "Search..."}
            />
          </div>

          <Select value={type} onValueChange={onTypeChange}>
            <SelectTrigger className="h-8 w-[120px] rounded-lg text-xs">
              <SelectValue placeholder={isArabic ? "النوع" : "Type"} />
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
            <SelectTrigger className="h-8 w-[110px] rounded-lg text-xs">
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

        {/* Select all + count on a compact row */}
        <div className="mt-1.5 flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={allVisibleSelected && items.length > 0}
              onCheckedChange={(checked) => onToggleSelectAll(Boolean(checked))}
              aria-label={isArabic ? "تحديد الكل" : "Select all"}
              className="h-3.5 w-3.5"
            />
            <span>{isArabic ? "تحديد الكل" : "Select all"}</span>
          </label>
          <span className="text-[10px] text-muted-foreground">
            {isArabic ? `${items.length} إشعار` : `${items.length} items`}
          </span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="pointer-events-none absolute inset-x-2 bottom-12 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border bg-background/95 px-2.5 py-1.5 shadow-lg backdrop-blur">
            <span className="text-xs font-semibold">
              {isArabic ? `${selectedCount} محدد` : `${selectedCount} selected`}
            </span>
            <Button size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={onBulkMarkRead}>
              <CheckCheck className="me-1 h-3.5 w-3.5" />
              {isArabic ? "مقروء" : "Read"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-xs" onClick={onBulkMarkUnread}>
              <Check className="me-1 h-3.5 w-3.5" />
              {isArabic ? "غير مقروء" : "Unread"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-xs" onClick={onBulkArchive}>
              <Trash2 className="me-1 h-3.5 w-3.5" />
              {isArabic ? "أرشفة" : "Archive"}
            </Button>
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : !items.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold">{emptyState.title}</h3>
              <p className="max-w-xs text-xs text-muted-foreground">{emptyState.body}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-px px-1.5 py-1.5">
            {items.map((item) => {
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
                    "group relative flex w-full items-center gap-2 rounded-lg border-s-[3px] px-2 py-1.5 text-start transition-all hover:bg-accent/50",
                    config.borderClass,
                    isSelected && "bg-accent ring-1 ring-primary/20",
                    !isSelected && !item.isRead && config.tintClass,
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => onToggleSelect(item.id, Boolean(checked))}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-opacity",
                      isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                    aria-label={isArabic ? "تحديد" : "Select"}
                  />

                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "truncate text-xs",
                        !item.isRead ? "font-bold text-foreground" : "font-medium text-foreground/80",
                      )}>
                        {leadName || title}
                      </span>

                      {!item.isRead && <BellDot className="h-3 w-3 shrink-0 text-blue-500" />}

                      <span className="ms-auto shrink-0 text-[10px] text-muted-foreground">
                        {formatInboxTime(item.createdAt, isArabic)}
                      </span>
                    </div>

                    <p className="truncate text-[11px] text-muted-foreground">
                      {leadName ? title : (body || title)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Standard pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t bg-background px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-lg px-2 text-xs"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isFetchingMore}
          >
            <ChevronLeft className="me-1 h-3.5 w-3.5" />
            {isArabic ? "السابق" : "Previous"}
          </Button>

          <span className="text-xs text-muted-foreground">
            {isArabic
              ? `صفحة ${currentPage} من ${totalPages}`
              : `Page ${currentPage} of ${totalPages}`}
          </span>

          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-lg px-2 text-xs"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isFetchingMore}
          >
            {isArabic ? "التالي" : "Next"}
            <ChevronRight className="ms-1 h-3.5 w-3.5" />
          </Button>

          {isFetchingMore && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}

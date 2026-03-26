import { AlertTriangle, BellDot, CalendarClock, Inbox, Megaphone, UserRoundSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "./types";

type Props = {
  items: InboxMessage[];
  selectedId?: number | null;
  onSelect: (item: InboxMessage) => void;
  isArabic?: boolean;
};

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

function getIcon(type: string) {
  if (type === "sla_breach") return AlertTriangle;
  if (["new_lead", "lead_assigned", "lead_distribution"].includes(type)) return UserRoundSearch;
  if (["reminder", "meeting_reminder", "follow_up_reminder"].includes(type)) return CalendarClock;
  if (type === "campaign_alert") return Megaphone;
  return Inbox;
}

export function MessageList({ items, selectedId, onSelect, isArabic }: Props) {
  if (!items.length) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {isArabic ? "لا توجد رسائل تطابق الفلاتر الحالية." : "No messages match the current filters."}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {items.map((item) => {
        const Icon = getIcon(item.type);
        const isSla = item.type === "sla_breach";
        const isSelected = item.id === selectedId;
        const isUnread = !item.isRead;
        const title = isArabic ? item.titleAr || item.title : item.title;
        const body = isArabic ? item.bodyAr || item.body : item.body;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "w-full border-b px-4 py-3.5 text-start transition-colors hover:bg-muted/60",
              isSelected && "bg-muted/80 ring-1 ring-inset ring-primary/10",
              isUnread && !isSla && "bg-blue-50/40 dark:bg-blue-950/10",
              isSla && "bg-red-50/80 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex-shrink-0 rounded-lg border p-2 text-muted-foreground",
                  isSla && "border-red-200 bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
                  isUnread && !isSla && "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-sm",
                      isUnread ? "font-bold" : "font-medium",
                      isSla && "text-red-700 dark:text-red-300",
                    )}
                  >
                    {title}
                  </p>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {isUnread && <BellDot className="h-3.5 w-3.5 text-blue-500" />}
                    <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                      {formatMessageTime(item.createdAt, isArabic)}
                    </span>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{body}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

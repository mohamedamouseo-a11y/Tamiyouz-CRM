import { AlertTriangle, BellDot, CalendarClock, Inbox, Megaphone, UserRoundSearch } from "lucide-react";

import { cn } from "@/lib/utils";

import type { InboxMessage } from "./types";

type Props = {
  items: InboxMessage[];
  selectedId?: number | null;
  onSelect: (item: InboxMessage) => void;
  isArabic?: boolean;
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Intl.DateTimeFormat(undefined, {
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
        No messages match the current filters.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {items.map((item) => {
        const Icon = getIcon(item.type);
        const isSla = item.type === "sla_breach";
        const isSelected = item.id === selectedId;
        const title = isArabic ? item.titleAr || item.title : item.title;
        const body = isArabic ? item.bodyAr || item.body : item.body;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "w-full border-b p-4 text-left transition-colors hover:bg-muted/60",
              isSelected && "bg-muted",
              isSla && "bg-red-50/80 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 rounded-xl border p-2 text-muted-foreground",
                  isSla && "border-red-200 bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className={cn("truncate text-sm font-semibold", isSla && "text-red-700 dark:text-red-300")}>{title}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    {!item.isRead ? <BellDot className="h-4 w-4 text-blue-500" /> : null}
                    <span className="text-xs text-muted-foreground">{formatMessageTime(item.createdAt)}</span>
                  </div>
                </div>

                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

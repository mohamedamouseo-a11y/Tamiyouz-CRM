// client/src/components/inbox/InboxSidebar.tsx

import {
  AlertTriangle,
  BellRing,
  Inbox as InboxIcon,
  Megaphone,
  Sparkles,
  TimerReset,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInboxCount, SIDEBAR_ITEMS, type InboxCounts, type InboxTab } from "./types";

type Props = {
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  counts?: Partial<InboxCounts>;
  isAccountManager?: boolean;
  isArabic?: boolean;
  collapsed?: boolean;
  className?: string;
};

function getTabIcon(tab: InboxTab) {
  switch (tab) {
    case "priority":
      return Sparkles;
    case "all":
      return InboxIcon;
    case "unread":
      return BellRing;
    case "sla":
      return AlertTriangle;
    case "leads":
      return UserPlus;
    case "reminders":
      return TimerReset;
    case "campaigns":
      return Megaphone;
    default:
      return InboxIcon;
  }
}

export function InboxSidebar({
  activeTab,
  onTabChange,
  counts,
  isAccountManager,
  isArabic,
  collapsed = false,
  className,
}: Props) {
  return (
    <aside className={cn("flex h-full flex-col border-b bg-background md:border-b-0 md:border-e", className)}>
      <div className={cn("flex-1 space-y-0.5 p-1.5", collapsed && "px-1 py-1.5")}>
        {SIDEBAR_ITEMS
          .filter((item) => !(isAccountManager && item.key === "campaigns"))
          .map((item) => {
            const Icon = getTabIcon(item.key);
            const isActive = activeTab === item.key;
            const count = Number(counts?.[item.countKey] ?? 0);
            const isDanger = item.tone === "danger";
            const isSuccess = item.tone === "success";
            const isPriority = item.tone === "priority";

            return (
              <Button
                key={item.key}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                onClick={() => onTabChange(item.key)}
                className={cn(
                  "h-9 w-full rounded-lg px-2 py-1.5 text-sm transition-all",
                  collapsed ? "justify-center px-0" : "justify-between",
                  isActive && isSuccess && "bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:ring-emerald-800",
                  isActive && isDanger && "bg-red-50 ring-1 ring-red-200 hover:bg-red-100 dark:bg-red-950/20 dark:ring-red-800",
                  isActive && isPriority && "bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:ring-amber-800",
                )}
              >
                <span className={cn("flex items-center gap-2", collapsed && "justify-center")}>
                  <Icon className={cn(
                    "h-4 w-4 shrink-0",
                    isDanger && "text-red-500",
                    isSuccess && "text-emerald-500",
                    isPriority && "text-amber-500",
                    isActive && !isDanger && !isSuccess && !isPriority && "text-primary",
                  )} />

                  {!collapsed && (
                    <span className="truncate text-xs font-medium">
                      {isArabic ? item.labelAr : item.label}
                    </span>
                  )}
                </span>

                {!collapsed && count > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-semibold",
                      isDanger && "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                      isSuccess && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                      isPriority && "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                    )}
                  >
                    {formatInboxCount(count)}
                  </Badge>
                )}
              </Button>
            );
          })}
      </div>
    </aside>
  );
}

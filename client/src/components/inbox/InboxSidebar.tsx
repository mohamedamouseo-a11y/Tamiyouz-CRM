// client/src/components/inbox/InboxSidebar.tsx

import {
  AlertTriangle,
  BellRing,
  ExternalLink,
  Inbox as InboxIcon,
  Megaphone,
  Sparkles,
  TimerReset,
  UserPlus,
} from "lucide-react";
import { useLocation } from "wouter";
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
  const [, navigate] = useLocation();

  return (
    <aside className={cn("flex h-full flex-col border-b bg-background md:border-b-0 md:border-e", className)}>
      <div className={cn("flex-1 space-y-1.5 p-2.5", collapsed && "px-2 py-2")}> 
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
              <div key={item.key} className="group">
                <Button
                  type="button"
                  variant={isActive ? "secondary" : "ghost"}
                  onClick={() => onTabChange(item.key)}
                  className={cn(
                    "h-auto min-h-12 w-full rounded-2xl px-3 py-3 transition-all",
                    collapsed ? "justify-center px-0" : "justify-between",
                    isActive && isSuccess && "bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:ring-emerald-800 dark:hover:bg-emerald-950/30",
                    isActive && isDanger && "bg-red-50 ring-1 ring-red-200 hover:bg-red-100 dark:bg-red-950/20 dark:ring-red-800 dark:hover:bg-red-950/30",
                    isActive && isPriority && "bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:ring-amber-800 dark:hover:bg-amber-950/30",
                  )}
                >
                  <span className={cn("flex min-w-0 items-center gap-3", collapsed && "justify-center")}> 
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                        isDanger && "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
                        isSuccess && "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
                        isPriority && "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
                        !isDanger && !isSuccess && !isPriority && "border-border bg-muted/30 text-muted-foreground",
                        isActive && !isDanger && !isSuccess && !isPriority && "text-primary",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    {!collapsed && (
                      <span className="min-w-0 flex-1 text-start">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {isArabic ? item.labelAr : item.label}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {isArabic ? item.descriptionAr : item.description}
                        </span>
                      </span>
                    )}
                  </span>

                  {!collapsed && count > 0 && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        isDanger && "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                        isSuccess && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                        isPriority && "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                      )}
                    >
                      {formatInboxCount(count)}
                    </Badge>
                  )}
                </Button>

                {!collapsed && item.route && (
                  <button
                    type="button"
                    onClick={() => navigate(item.route!)}
                    className="mt-1 flex w-full items-center gap-1.5 px-4 py-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {isArabic ? "الانتقال للصفحة المرتبطة" : "Go to related page"}
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </aside>
  );
}

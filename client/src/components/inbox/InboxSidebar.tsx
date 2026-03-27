import {
  AlertTriangle,
  BellRing,
  Inbox,
  Megaphone,
  Siren,
  TimerReset,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InboxCounts, InboxTab } from "./types";

type Props = {
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  counts?: Partial<InboxCounts>;
  isAccountManager?: boolean;
  isArabic?: boolean;
};

const folders: {
  key: InboxTab;
  label: string;
  labelAr: string;
  icon: typeof Inbox;
  countKey: keyof InboxCounts;
  variant?: "danger" | "success" | "default";
}[] = [
  { key: "all", label: "Inbox", labelAr: "صندوق الوارد", icon: Inbox, countKey: "all" },
  { key: "unread", label: "Unread", labelAr: "غير مقروء", icon: BellRing, countKey: "unread" },
  { key: "sla", label: "SLA Alerts", labelAr: "تنبيهات SLA", icon: Siren, countKey: "sla", variant: "danger" },
  { key: "leads", label: "New Leads", labelAr: "عملاء جدد", icon: UserPlus, countKey: "leads", variant: "success" },
  { key: "reminders", label: "Reminders", labelAr: "التذكيرات", icon: TimerReset, countKey: "reminders" },
  { key: "campaigns", label: "Campaigns", labelAr: "الحملات", icon: Megaphone, countKey: "campaigns" },
];

export function InboxSidebar({ activeTab, onTabChange, counts, isAccountManager, isArabic }: Props) {
  return (
    <aside className="flex h-full flex-col border-b bg-background md:border-b-0 md:border-e">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">{isArabic ? "صندوق الوارد" : "Inbox"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {isArabic
            ? "التنبيهات، التذكيرات، العملاء، والحملات."
            : "Alerts, reminders, leads, and campaigns."}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex-1 space-y-1 p-3">
        {folders
          .filter((folder) => !(isAccountManager && folder.key === "campaigns"))
          .map((folder) => {
            const Icon = folder.icon;
            const isActive = activeTab === folder.key;
            const count = counts?.[folder.countKey] ?? 0;
            const isDanger = folder.variant === "danger";
            const isSuccess = folder.variant === "success";

            return (
              <Button
                key={folder.key}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                onClick={() => onTabChange(folder.key)}
                className={`h-11 w-full justify-between rounded-xl px-3 ${
                  isActive && isSuccess
                    ? "bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:ring-emerald-800 dark:hover:bg-emerald-950/30"
                    : isActive && isDanger
                      ? "bg-red-50 ring-1 ring-red-200 hover:bg-red-100 dark:bg-red-950/20 dark:ring-red-800 dark:hover:bg-red-950/30"
                      : ""
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <Icon
                    className={`h-4 w-4 ${
                      isDanger
                        ? "text-red-500"
                        : isSuccess
                          ? "text-emerald-500"
                          : isActive
                            ? "text-primary"
                            : "text-muted-foreground"
                    }`}
                  />
                  {isArabic ? folder.labelAr : folder.label}
                </span>
                {count > 0 ? (
                  <Badge
                    variant={isDanger ? "destructive" : "secondary"}
                    className={`rounded-full px-2 text-xs ${
                      isSuccess
                        ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : ""
                    }`}
                  >
                    {count > 9999 ? "9999+" : count}
                  </Badge>
                ) : null}
              </Button>
            );
          })}
      </div>
    </aside>
  );
}

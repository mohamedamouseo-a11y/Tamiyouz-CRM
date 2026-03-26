import { BellRing, Inbox, Megaphone, Siren, TimerReset, UserRoundSearch } from "lucide-react";
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

const folders = [
  { key: "all" as const, label: "Inbox", labelAr: "صندوق الوارد", icon: Inbox, countKey: "all" as const },
  { key: "unread" as const, label: "Unread", labelAr: "غير مقروء", icon: BellRing, countKey: "unread" as const },
  { key: "sla" as const, label: "SLA Alerts", labelAr: "تنبيهات SLA", icon: Siren, countKey: "sla" as const, danger: true },
  { key: "leads" as const, label: "Leads", labelAr: "العملاء", icon: UserRoundSearch, countKey: "leads" as const },
  { key: "reminders" as const, label: "Reminders", labelAr: "التذكيرات", icon: TimerReset, countKey: "reminders" as const },
  { key: "campaigns" as const, label: "Campaigns", labelAr: "الحملات", icon: Megaphone, countKey: "campaigns" as const },
];

export function InboxSidebar({ activeTab, onTabChange, counts, isAccountManager, isArabic }: Props) {
  return (
    <aside className="flex h-full flex-col border-b bg-background md:border-b-0 md:border-e">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">{isArabic ? "صندوق الوارد" : "Inbox"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {isArabic
            ? "التنبيهات، التذكيرات، العملاء، والحملات."
            : "A focused view of alerts, reminders, leads, and campaigns."}
        </p>
      </div>
      <div className="flex-1 space-y-1 p-3">
        {folders
          .filter((folder) => !(isAccountManager && folder.key === "campaigns"))
          .map((folder) => {
            const Icon = folder.icon;
            const isActive = activeTab === folder.key;
            const count = counts?.[folder.countKey] ?? 0;
            return (
              <Button
                key={folder.key}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                onClick={() => onTabChange(folder.key)}
                className="h-10 w-full justify-between rounded-xl px-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className={folder.danger ? "h-4 w-4 text-red-500" : "h-4 w-4"} />
                  {isArabic ? folder.labelAr : folder.label}
                </span>
                {count > 0 ? (
                  <Badge variant={folder.danger ? "destructive" : "secondary"} className="rounded-full px-2 text-xs">
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

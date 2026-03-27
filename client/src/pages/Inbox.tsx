import CRMLayout from "@/components/CRMLayout";
import { useEffect, useMemo, useState } from "react";
import { Filter, MailOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { InboxSidebar } from "../components/inbox/InboxSidebar";
import { MessageDetail } from "../components/inbox/MessageDetail";
import { MessageList } from "../components/inbox/MessageList";
import type { InboxMessage, InboxTab } from "../components/inbox/types";

const typeOptions = [
  { value: "all", label: "All types", labelAr: "كل الأنواع" },
  { value: "new_lead", label: "New lead", labelAr: "عميل جديد" },
  { value: "lead_assigned", label: "Lead assigned", labelAr: "تم تعيين عميل" },
  { value: "lead_distribution", label: "Lead distribution", labelAr: "توزيع عملاء" },
  { value: "sla_breach", label: "SLA breach", labelAr: "تجاوز SLA" },
  { value: "reminder", label: "Reminder", labelAr: "تذكير" },
  { value: "meeting_reminder", label: "Meeting reminder", labelAr: "تذكير اجتماع" },
  { value: "follow_up_reminder", label: "Follow-up reminder", labelAr: "تذكير متابعة" },
  { value: "campaign_alert", label: "Campaign alert", labelAr: "تنبيه حملة" },
] as const;

export default function InboxPage() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const isArabic = isRTL;
  const [activeTab, setActiveTab] = useState<InboxTab>("all");
  const [type, setType] = useState<string>("all");
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const listQuery = trpc.inbox.list.useQuery({
    tab: activeTab,
    type: type as any,
    page,
    pageSize: 20,
  });

  const countsQuery = trpc.inbox.counts.useQuery();

  const markReadMutation = trpc.inbox.markRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.inbox.list.invalidate(),
        utils.inbox.counts.invalidate(),
        utils.inAppNotifications?.unreadCount?.invalidate?.(),
      ]);
    },
  });

  const markAllReadMutation = trpc.inbox.markAllRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.inbox.list.invalidate(),
        utils.inbox.counts.invalidate(),
        utils.inAppNotifications?.unreadCount?.invalidate?.(),
      ]);
    },
  });

  useEffect(() => {
    setPage(1);
    setSearchQuery("");
  }, [activeTab, type]);

  useEffect(() => {
    const first = listQuery.data?.items?.[0] ?? null;
    if (!selectedMessage || !listQuery.data?.items.some((item) => item.id === selectedMessage.id)) {
      setSelectedMessage(first as InboxMessage | null);
    }
  }, [listQuery.data?.items, selectedMessage]);

  const isAccountManager = useMemo(() => {
    const role = user?.role;
    return role === "AccountManager" || role === "AccountManagerLead";
  }, [user?.role]);

  /* ── Client-side search filter ── */
  const filteredItems = useMemo(() => {
    const items = (listQuery.data?.items ?? []) as InboxMessage[];
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const title = (item.titleAr || item.title || "").toLowerCase();
      const body = (item.bodyAr || item.body || "").toLowerCase();
      const meta = item.metadata ?? {};
      const phone = String((meta as any).phone ?? "").toLowerCase();
      const campaign = String((meta as any).campaignName ?? "").toLowerCase();
      const leadName = String((meta as any).leadName ?? "").toLowerCase();
      return (
        title.includes(q) ||
        body.includes(q) ||
        phone.includes(q) ||
        campaign.includes(q) ||
        leadName.includes(q)
      );
    });
  }, [listQuery.data?.items, searchQuery]);

  return (
    <CRMLayout>
      <div className="flex flex-col gap-4 p-4 md:p-6" style={{ minHeight: "calc(100vh - 4rem)" }}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isArabic ? "صندوق الوارد" : "Inbox"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isArabic
                ? "الإشعارات، تنبيهات SLA، التذكيرات، وأحداث الحملات."
                : "Your notifications, SLA alerts, reminders, and campaign events."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[180px] rounded-xl">
                <Filter className="me-2 h-4 w-4" />
                <SelectValue placeholder={isArabic ? "تصفية حسب النوع" : "Filter by type"} />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {isArabic ? option.labelAr : option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                utils.inbox.list.invalidate();
                utils.inbox.counts.invalidate();
              }}
              title={isArabic ? "تحديث" : "Refresh"}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate({ tab: activeTab })}
              disabled={markAllReadMutation.isPending}
            >
              <MailOpen className="me-2 h-4 w-4" />
              {isArabic ? "تعليم الكل كمقروء" : "Mark all as read"}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Card className="flex-1 overflow-hidden rounded-2xl border shadow-sm">
          <ResizablePanelGroup direction="horizontal" className="min-h-[72vh]">
            {/* Sidebar */}
            <ResizablePanel defaultSize={18} minSize={14} maxSize={24}>
              <InboxSidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                counts={countsQuery.data}
                isAccountManager={isAccountManager}
                isArabic={isArabic}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />

            {/* Message List */}
            <ResizablePanel defaultSize={32} minSize={22}>
              <div className="flex h-full flex-col">
                <div className="border-b bg-muted/30 px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {filteredItems.length}
                    {searchQuery.trim() ? ` / ${listQuery.data?.pagination.total ?? 0}` : ""}{" "}
                    {isArabic ? "رسالة" : "message(s)"}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <MessageList
                    items={filteredItems}
                    selectedId={selectedMessage?.id}
                    onSelect={async (item) => {
                      setSelectedMessage(item);
                      if (!item.isRead) {
                        await markReadMutation.mutateAsync({ notificationId: item.id });
                      }
                    }}
                    isArabic={isArabic}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    {isArabic ? "السابق" : "Previous"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {isArabic
                      ? `صفحة ${listQuery.data?.pagination.page ?? 1} من ${listQuery.data?.pagination.totalPages ?? 1}`
                      : `Page ${listQuery.data?.pagination.page ?? 1} of ${listQuery.data?.pagination.totalPages ?? 1}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= (listQuery.data?.pagination.totalPages ?? 1)}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {isArabic ? "التالي" : "Next"}
                  </Button>
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />

            {/* Message Detail */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <MessageDetail
                message={selectedMessage}
                onMarkRead={(id) => markReadMutation.mutate({ notificationId: id })}
                isArabic={isArabic}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </Card>
      </div>
    </CRMLayout>
  );
}

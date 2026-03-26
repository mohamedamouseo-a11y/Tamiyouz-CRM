import { useEffect, useMemo, useState } from "react";
import { Filter, MailOpen } from "lucide-react";

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

import { InboxSidebar } from "../components/inbox/InboxSidebar";
import { MessageDetail } from "../components/inbox/MessageDetail";
import { MessageList } from "../components/inbox/MessageList";
import type { InboxMessage, InboxTab } from "../components/inbox/types";

const typeOptions = [
  { value: "all", label: "All types" },
  { value: "new_lead", label: "New lead" },
  { value: "lead_assigned", label: "Lead assigned" },
  { value: "lead_distribution", label: "Lead distribution" },
  { value: "sla_breach", label: "SLA breach" },
  { value: "reminder", label: "Reminder" },
  { value: "meeting_reminder", label: "Meeting reminder" },
  { value: "follow_up_reminder", label: "Follow-up reminder" },
  { value: "campaign_alert", label: "Campaign alert" },
] as const;

export default function InboxPage() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<InboxTab>("all");
  const [type, setType] = useState<string>("all");
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [page, setPage] = useState(1);

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

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">Your notifications, SLA alerts, reminders, and campaign events.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[180px] rounded-xl">
              <Filter className="me-2 h-4 w-4" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => markAllReadMutation.mutate({ tab: activeTab })}>
            <MailOpen className="me-2 h-4 w-4" />
            Mark current tab as read
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border">
        <ResizablePanelGroup direction="horizontal" className="min-h-[72vh]">
          <ResizablePanel defaultSize={18} minSize={16} maxSize={26}>
            <InboxSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              counts={countsQuery.data}
              isAccountManager={isAccountManager}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={32} minSize={25}>
            <div className="flex h-full flex-col">
              <div className="border-b px-4 py-3 text-sm text-muted-foreground">
                {listQuery.data?.pagination.total ?? 0} message(s)
              </div>
              <div className="flex-1 overflow-hidden">
                <MessageList
                  items={(listQuery.data?.items ?? []) as InboxMessage[]}
                  selectedId={selectedMessage?.id}
                  onSelect={async (item) => {
                    setSelectedMessage(item);
                    if (!item.isRead) {
                      await markReadMutation.mutateAsync({ notificationId: item.id });
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-between border-t p-3 text-sm">
                <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Previous
                </Button>
                <span className="text-muted-foreground">
                  Page {listQuery.data?.pagination.page ?? 1} of {listQuery.data?.pagination.totalPages ?? 1}
                </span>
                <Button
                  variant="ghost"
                  disabled={page >= (listQuery.data?.pagination.totalPages ?? 1)}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={30}>
            <MessageDetail
              message={selectedMessage}
              onMarkRead={(id) => markReadMutation.mutate({ notificationId: id })}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </Card>
    </div>
  );
}

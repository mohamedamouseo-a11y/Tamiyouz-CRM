// client/src/pages/Inbox.tsx

import CRMLayout from "@/components/CRMLayout";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, MailOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { InboxSidebar } from "../components/inbox/InboxSidebar";
import { MessageDetail } from "../components/inbox/MessageDetail";
import { MessageList } from "../components/inbox/MessageList";
import {
  formatInboxCount,
  getMessageLeadId,
  getMessageLeadName,
  getSearchableText,
  isPriorityMessage,
  matchesDateRange,
  type InboxBaseTab,
  type InboxCounts,
  type InboxDateRange,
  type InboxMessage,
  type InboxTab,
} from "../components/inbox/types";

const PAGE_SIZE = 30;

function getInitialSearchParams() {
  const params = new URLSearchParams(window.location.search);
  const tab = (params.get("tab") as InboxTab) || "all";
  const type = params.get("type") || "all";
  const search = params.get("search") || "";
  const range = (params.get("range") as InboxDateRange) || "all";
  const detailId = Number(params.get("detail") || 0);
  const sound = params.get("sound") === "1";
  return {
    tab: (["all", "priority", "unread", "sla", "leads", "reminders", "campaigns"] as InboxTab[]).includes(tab) ? tab : "all",
    type, search,
    range: (["all", "today", "week", "month"] as InboxDateRange[]).includes(range) ? range : "all",
    detailId: Number.isFinite(detailId) && detailId > 0 ? detailId : null,
    sound,
  };
}

function getQueryTab(tab: InboxTab): InboxBaseTab {
  return tab === "priority" ? "all" : tab;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

export default function InboxPage() {
  const initial = useMemo(() => getInitialSearchParams(), []);
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const isArabic = isRTL;
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isCompactSidebar = useMediaQuery("(max-width: 1200px)");

  const [activeTab, setActiveTab] = useState<InboxTab>(initial.tab);
  const [type, setType] = useState<string>(initial.type);
  const [dateRange, setDateRange] = useState<InboxDateRange>(initial.range);
  const [searchQuery, setSearchQuery] = useState(initial.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initial.search);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(initial.detailId);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [forcedUnreadIds, setForcedUnreadIds] = useState<Set<number>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(initial.sound);

  const previousIdsRef = useRef<Set<number>>(new Set());
  const queryTab = getQueryTab(activeTab);

  // Debounce search
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    if (type && type !== "all") params.set("type", type); else params.delete("type");
    if (debouncedSearch) params.set("search", debouncedSearch); else params.delete("search");
    if (dateRange !== "all") params.set("range", dateRange); else params.delete("range");
    if (selectedMessageId) params.set("detail", String(selectedMessageId)); else params.delete("detail");
    if (soundEnabled) params.set("sound", "1"); else params.delete("sound");
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, [activeTab, type, debouncedSearch, dateRange, selectedMessageId, soundEnabled]);

  // Data queries
  const listQuery = trpc.inbox.list.useQuery(
    { tab: queryTab, type, page: currentPage, pageSize: PAGE_SIZE },
    { keepPreviousData: true, refetchOnWindowFocus: true }
  );
  const countsQuery = trpc.inbox.counts.useQuery(undefined, { refetchOnWindowFocus: true });
  const markReadMutation = trpc.inbox.markRead.useMutation();
  const markAllReadMutation = trpc.inbox.markAllRead.useMutation();

  const invalidateInboxData = async () => {
    await Promise.all([
      utils.inbox.list.invalidate(),
      utils.inbox.counts.invalidate(),
      utils.inAppNotifications?.unreadCount?.invalidate?.(),
    ]);
  };

  // Reset on tab/type change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setArchivedIds(new Set());
  }, [queryTab, type]);

  // Standard pagination: use current page data directly
  const pageItems = useMemo(() => {
    if (!listQuery.data?.items) return [];
    return listQuery.data.items as InboxMessage[];
  }, [listQuery.data?.items]);

  const totalPages = useMemo(() => {
    return listQuery.data?.pagination?.totalPages ?? 1;
  }, [listQuery.data?.pagination?.totalPages]);

  const enhancedCounts = useMemo<InboxCounts | undefined>(() => {
    if (!countsQuery.data) return undefined;
    return { ...countsQuery.data, priority: Number(countsQuery.data.sla ?? 0) + Number(countsQuery.data.leads ?? 0) };
  }, [countsQuery.data]);

  // Filter items
  const itemsAfterTab = useMemo(() => {
    let items = [...pageItems];
    if (activeTab === "priority") {
      items = items.filter((item) => {
        const effectiveRead = forcedUnreadIds.has(item.id) ? false : item.isRead;
        return isPriorityMessage({ ...item, isRead: effectiveRead });
      });
    }
    return items.filter((item) => !archivedIds.has(item.id));
  }, [activeTab, pageItems, archivedIds, forcedUnreadIds]);

  const visibleItems = useMemo(() => {
    return itemsAfterTab
      .filter((item) => matchesDateRange(item.createdAt, dateRange))
      .filter((item) => {
        if (!debouncedSearch) return true;
        return getSearchableText(item).includes(debouncedSearch.toLowerCase());
      })
      .map((item) => ({ ...item, isRead: forcedUnreadIds.has(item.id) ? false : item.isRead }));
  }, [itemsAfterTab, dateRange, debouncedSearch, forcedUnreadIds]);

  const selectedMessage = useMemo(
    () => visibleItems.find((item) => item.id === selectedMessageId) ?? null,
    [visibleItems, selectedMessageId]
  );

  useEffect(() => {
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => visibleItems.some((item) => item.id === id))));
  }, [visibleItems]);

  const relatedMessages = useMemo(() => {
    if (!selectedMessage) return [];
    const sLeadId = getMessageLeadId(selectedMessage);
    const sLeadName = getMessageLeadName(selectedMessage);
    return visibleItems.filter((item) => {
      if (item.id === selectedMessage.id) return false;
      return (sLeadId && getMessageLeadId(item) === sLeadId) || (!!sLeadName && getMessageLeadName(item) === sLeadName);
    });
  }, [selectedMessage, visibleItems]);

  // Auto-select first item
  useEffect(() => {
    if (!visibleItems.length) { setSelectedMessageId(null); return; }
    if (!selectedMessageId || !visibleItems.some((item) => item.id === selectedMessageId)) {
      setSelectedMessageId(isMobile ? null : visibleItems[0].id);
    }
  }, [visibleItems, selectedMessageId, isMobile]);

  // Desktop notifications
  useEffect(() => {
    const nextIds = new Set(pageItems.map((item) => item.id));
    const prevIds = previousIdsRef.current;
    if (Array.from(nextIds).some((id) => !prevIds.has(id)) && soundEnabled) {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(isArabic ? "وصلت إشعارات جديدة" : "New inbox notifications", {
          body: isArabic ? "يوجد عناصر جديدة داخل صندوق الوارد." : "You have new items in your inbox.",
        });
      }
    }
    previousIdsRef.current = nextIds;
  }, [pageItems, soundEnabled, isArabic]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!visibleItems.length || !selectedMessageId) return;
      const idx = visibleItems.findIndex((item) => item.id === selectedMessageId);
      if (idx < 0) return;
      if (event.key === "ArrowDown") { event.preventDefault(); const n = visibleItems[idx + 1]; if (n) setSelectedMessageId(n.id); }
      if (event.key === "ArrowUp") { event.preventDefault(); const p = visibleItems[idx - 1]; if (p) setSelectedMessageId(p.id); }
      if (event.key === "Escape" && isMobile) setSelectedMessageId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visibleItems, selectedMessageId, isMobile]);

  const isAccountManager = useMemo(() => {
    const role = user?.role;
    return role === "AccountManager" || role === "AccountManagerLead";
  }, [user?.role]);

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));

  // Handlers
  const handleMarkReadSingle = async (notificationId: number) => {
    await markReadMutation.mutateAsync({ notificationId });
    await invalidateInboxData();
    setForcedUnreadIds((prev) => { const next = new Set(prev); next.delete(notificationId); return next; });
  };

  const handleSelectMessage = async (item: InboxMessage) => {
    setSelectedMessageId(item.id);
    if (!item.isRead && !forcedUnreadIds.has(item.id)) await handleMarkReadSingle(item.id);
  };

  const handleMarkAllRead = async () => {
    if (activeTab === "priority") {
      const ids = visibleItems.filter((i) => !i.isRead).map((i) => i.id);
      await Promise.all(ids.map((id) => markReadMutation.mutateAsync({ notificationId: id })));
    } else {
      await markAllReadMutation.mutateAsync({ tab: queryTab });
    }
    await invalidateInboxData();
    setForcedUnreadIds(new Set());
  };

  const handleBulkMarkRead = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    await Promise.all(ids.map((id) => markReadMutation.mutateAsync({ notificationId: id })));
    await invalidateInboxData();
    setSelectedIds(new Set());
    setForcedUnreadIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
  };

  const handleBulkMarkUnread = () => {
    setForcedUnreadIds((prev) => { const next = new Set(prev); selectedIds.forEach((id) => next.add(id)); return next; });
  };

  const handleBulkArchive = () => {
    setArchivedIds((prev) => { const next = new Set(prev); selectedIds.forEach((id) => next.add(id)); return next; });
    setSelectedIds(new Set());
  };

  const headerStats = useMemo(() => [
    { label: isArabic ? "غير مقروء" : "Unread", value: formatInboxCount(Number(enhancedCounts?.unread ?? 0)) },
    { label: "SLA", value: formatInboxCount(Number(enhancedCounts?.sla ?? 0)) },
    { label: isArabic ? "عملاء جدد" : "Leads", value: formatInboxCount(Number(enhancedCounts?.leads ?? 0)) },
  ], [enhancedCounts, isArabic]);

  const selectedIndex = selectedMessage ? visibleItems.findIndex((item) => item.id === selectedMessage.id) : -1;
  const mobileDetailOpen = isMobile && Boolean(selectedMessage);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setSelectedIds(new Set());
  };

  // Shared MessageList props
  const mlProps = {
    items: visibleItems,
    selectedId: selectedMessageId,
    selectedIds,
    onSelect: (item: InboxMessage) => void handleSelectMessage(item),
    onToggleSelect: (itemId: number, checked: boolean) => {
      setSelectedIds((prev) => { const next = new Set(prev); if (checked) next.add(itemId); else next.delete(itemId); return next; });
    },
    onToggleSelectAll: (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleItems.forEach((item) => { if (checked) next.add(item.id); else next.delete(item.id); });
        return next;
      });
    },
    allVisibleSelected,
    isArabic,
    searchQuery,
    onSearchChange: setSearchQuery,
    type,
    onTypeChange: setType,
    dateRange,
    onDateRangeChange: setDateRange,
    selectedCount: selectedIds.size,
    onBulkMarkRead: () => void handleBulkMarkRead(),
    onBulkMarkUnread: handleBulkMarkUnread,
    onBulkArchive: handleBulkArchive,
    isLoading: listQuery.isLoading,
    isFetchingMore: listQuery.isFetching && !listQuery.isLoading,
    currentTab: activeTab,
    currentPage,
    totalPages,
    onPageChange: handlePageChange,
  };

  // Shared MessageDetail props
  const mdProps = {
    message: selectedMessage,
    isArabic,
    onMarkRead: (id: number) => void handleMarkReadSingle(id),
    onArchive: (id: number) => setArchivedIds((prev) => new Set(prev).add(id)),
    relatedMessages,
    onSelectRelated: (item: InboxMessage) => setSelectedMessageId(item.id),
    onPrev: selectedIndex > 0 ? () => setSelectedMessageId(visibleItems[selectedIndex - 1]?.id ?? null) : undefined,
    onNext: selectedIndex >= 0 && selectedIndex < visibleItems.length - 1 ? () => setSelectedMessageId(visibleItems[selectedIndex + 1]?.id ?? null) : undefined,
    hasPrev: selectedIndex > 0,
    hasNext: selectedIndex >= 0 && selectedIndex < visibleItems.length - 1,
  };

  return (
    <CRMLayout>
      <div className="h-[calc(100vh-4rem)] overflow-hidden p-2 md:p-4">
        <div className="flex h-full flex-col gap-2 overflow-hidden">
          {/* Compact header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-bold tracking-tight">{isArabic ? "صندوق الوارد" : "Inbox"}</h1>

            <div className="flex flex-wrap items-center gap-1.5">
              {headerStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-background px-2 py-1 text-center shadow-sm">
                  <div className="text-[10px] font-medium text-muted-foreground">{stat.label}</div>
                  <div className="text-xs font-bold">{stat.value}</div>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 rounded-lg p-0"
                onClick={() => { setCurrentPage(1); void invalidateInboxData(); }}
                title={isArabic ? "تحديث" : "Refresh"}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-7 rounded-lg px-2 text-xs"
                onClick={handleMarkAllRead}
                disabled={markAllReadMutation.isPending || markReadMutation.isPending}
              >
                <MailOpen className="me-1 h-3.5 w-3.5" />
                {isArabic ? "تعليم الكل مقروء" : "Mark all read"}
              </Button>

              <label className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs shadow-sm">
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={async (checked) => {
                    if (checked && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                      await Notification.requestPermission();
                    }
                    setSoundEnabled(Boolean(checked));
                  }}
                  className="h-4 w-7"
                />
              </label>
            </div>
          </div>

          {/* Main content */}
          <Card className="flex-1 overflow-hidden rounded-2xl border shadow-sm">
            {isMobile ? (
              <div className="flex h-full flex-col overflow-hidden">
                <div className="border-b px-1.5 py-1.5">
                  <InboxSidebar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    counts={enhancedCounts}
                    isAccountManager={isAccountManager}
                    isArabic={isArabic}
                    collapsed
                    className="overflow-x-auto"
                  />
                </div>
                <div className="flex-1 overflow-hidden">
                  {mobileDetailOpen ? (
                    <MessageDetail {...mdProps} onBack={() => setSelectedMessageId(null)} />
                  ) : (
                    <MessageList {...mlProps} />
                  )}
                </div>
              </div>
            ) : (
              <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
                <ResizablePanel defaultSize={isCompactSidebar ? 8 : 14} minSize={6} maxSize={20}>
                  <InboxSidebar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    counts={enhancedCounts}
                    isAccountManager={isAccountManager}
                    isArabic={isArabic}
                    collapsed={isCompactSidebar}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={38} minSize={28}>
                  <MessageList {...mlProps} />
                </ResizablePanel>
                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={48} minSize={32}>
                  <MessageDetail {...mdProps} />
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </Card>
        </div>
      </div>
    </CRMLayout>
  );
}

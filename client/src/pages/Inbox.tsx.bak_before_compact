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
    type,
    search,
    range: (["all", "today", "week", "month"] as InboxDateRange[]).includes(range) ? range : "all",
    detailId: Number.isFinite(detailId) && detailId > 0 ? detailId : null,
    sound,
  };
}

function getQueryTab(tab: InboxTab): InboxBaseTab {
  return tab === "priority" ? "all" : tab;
}

function dedupeMessages(items: InboxMessage[]) {
  const map = new Map<number, InboxMessage>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  const [allLoadedItems, setAllLoadedItems] = useState<InboxMessage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [forcedUnreadIds, setForcedUnreadIds] = useState<Set<number>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(initial.sound);

  const previousIdsRef = useRef<Set<number>>(new Set());
  const queryTab = getQueryTab(activeTab);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    if (type && type !== "all") params.set("type", type);
    else params.delete("type");

    if (debouncedSearch) params.set("search", debouncedSearch);
    else params.delete("search");

    if (dateRange !== "all") params.set("range", dateRange);
    else params.delete("range");

    if (selectedMessageId) params.set("detail", String(selectedMessageId));
    else params.delete("detail");

    if (soundEnabled) params.set("sound", "1");
    else params.delete("sound");

    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, [activeTab, type, debouncedSearch, dateRange, selectedMessageId, soundEnabled]);

  const listQuery = trpc.inbox.list.useQuery(
    {
      tab: queryTab,
      type,
      page: currentPage,
      pageSize: PAGE_SIZE,
    },
    {
      keepPreviousData: true,
      refetchOnWindowFocus: true,
    }
  );

  const countsQuery = trpc.inbox.counts.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const markReadMutation = trpc.inbox.markRead.useMutation();
  const markAllReadMutation = trpc.inbox.markAllRead.useMutation();

  const invalidateInboxData = async () => {
    await Promise.all([
      utils.inbox.list.invalidate(),
      utils.inbox.counts.invalidate(),
      utils.inAppNotifications?.unreadCount?.invalidate?.(),
    ]);
  };

  useEffect(() => {
    setCurrentPage(1);
    setAllLoadedItems([]);
    setSelectedIds(new Set());
    setArchivedIds(new Set());
  }, [queryTab, type]);

  useEffect(() => {
    if (!listQuery.data?.items) return;

    setAllLoadedItems((prev) => {
      if (currentPage === 1) return dedupeMessages(listQuery.data!.items as InboxMessage[]);
      return dedupeMessages([...prev, ...(listQuery.data!.items as InboxMessage[])]);
    });
  }, [listQuery.data?.items, currentPage]);

  const enhancedCounts = useMemo<InboxCounts | undefined>(() => {
    if (!countsQuery.data) return undefined;
    return {
      ...countsQuery.data,
      priority: Number(countsQuery.data.sla ?? 0) + Number(countsQuery.data.leads ?? 0),
    };
  }, [countsQuery.data]);

  const itemsAfterTab = useMemo(() => {
    let items = [...allLoadedItems];

    if (activeTab === "priority") {
      items = items.filter((item) => {
        const effectiveRead = forcedUnreadIds.has(item.id) ? false : item.isRead;
        return isPriorityMessage({ ...item, isRead: effectiveRead });
      });
    }

    return items.filter((item) => !archivedIds.has(item.id));
  }, [activeTab, allLoadedItems, archivedIds, forcedUnreadIds]);

  const visibleItems = useMemo(() => {
    return itemsAfterTab
      .filter((item) => matchesDateRange(item.createdAt, dateRange))
      .filter((item) => {
        if (!debouncedSearch) return true;
        return getSearchableText(item).includes(debouncedSearch.toLowerCase());
      })
      .map((item) => ({
        ...item,
        isRead: forcedUnreadIds.has(item.id) ? false : item.isRead,
      }));
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
    const selectedLeadId = getMessageLeadId(selectedMessage);
    const selectedLeadName = getMessageLeadName(selectedMessage);

    return visibleItems.filter((item) => {
      if (item.id === selectedMessage.id) return false;
      const itemLeadId = getMessageLeadId(item);
      const itemLeadName = getMessageLeadName(item);
      return (selectedLeadId && itemLeadId === selectedLeadId) || (!!selectedLeadName && itemLeadName === selectedLeadName);
    });
  }, [selectedMessage, visibleItems]);

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedMessageId(null);
      return;
    }

    if (!selectedMessageId || !visibleItems.some((item) => item.id === selectedMessageId)) {
      setSelectedMessageId(isMobile ? null : visibleItems[0].id);
    }
  }, [visibleItems, selectedMessageId, isMobile]);

  useEffect(() => {
    const nextIds = new Set(allLoadedItems.map((item) => item.id));
    const prevIds = previousIdsRef.current;
    const hasNewItems = Array.from(nextIds).some((id) => !prevIds.has(id));

    if (hasNewItems && soundEnabled) {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const title = isArabic ? "وصلت إشعارات جديدة" : "New inbox notifications";
        const body = isArabic ? "يوجد عناصر جديدة داخل صندوق الوارد." : "You have new items in your inbox.";
        new Notification(title, { body });
      }
    }

    previousIdsRef.current = nextIds;
  }, [allLoadedItems, soundEnabled, isArabic]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!visibleItems.length || !selectedMessageId) return;
      const currentIndex = visibleItems.findIndex((item) => item.id === selectedMessageId);
      if (currentIndex < 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = visibleItems[currentIndex + 1];
        if (next) setSelectedMessageId(next.id);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = visibleItems[currentIndex - 1];
        if (prev) setSelectedMessageId(prev.id);
      }

      if (event.key === "Escape" && isMobile) {
        setSelectedMessageId(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visibleItems, selectedMessageId, isMobile]);

  const isAccountManager = useMemo(() => {
    const role = user?.role;
    return role === "AccountManager" || role === "AccountManagerLead";
  }, [user?.role]);

  const hasMore = useMemo(() => {
    const totalPages = listQuery.data?.pagination.totalPages ?? 1;
    return currentPage < totalPages;
  }, [currentPage, listQuery.data?.pagination.totalPages]);

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));

  const handleMarkReadSingle = async (notificationId: number) => {
    await markReadMutation.mutateAsync({ notificationId });
    await invalidateInboxData();
    setForcedUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(notificationId);
      return next;
    });
  };

  const handleSelectMessage = async (item: InboxMessage) => {
    setSelectedMessageId(item.id);

    if (!item.isRead && !forcedUnreadIds.has(item.id)) {
      await handleMarkReadSingle(item.id);
    }
  };

  const handleMarkAllRead = async () => {
    if (activeTab === "priority") {
      const unreadPriorityIds = visibleItems.filter((item) => !item.isRead).map((item) => item.id);
      await Promise.all(unreadPriorityIds.map((notificationId) => markReadMutation.mutateAsync({ notificationId })));
    } else {
      await markAllReadMutation.mutateAsync({ tab: queryTab });
    }
    await invalidateInboxData();
    setForcedUnreadIds(new Set());
  };

  const handleBulkMarkRead = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    await Promise.all(ids.map((notificationId) => markReadMutation.mutateAsync({ notificationId })));
    await invalidateInboxData();
    setSelectedIds(new Set());
    setForcedUnreadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleBulkMarkUnread = () => {
    setForcedUnreadIds((prev) => {
      const next = new Set(prev);
      selectedIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleBulkArchive = () => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      selectedIds.forEach((id) => next.add(id));
      return next;
    });
    setSelectedIds(new Set());
  };

  const headerStats = useMemo(() => {
    return [
      {
        label: isArabic ? "غير مقروء" : "Unread",
        value: formatInboxCount(Number(enhancedCounts?.unread ?? 0)),
      },
      {
        label: isArabic ? "SLA" : "SLA",
        value: formatInboxCount(Number(enhancedCounts?.sla ?? 0)),
      },
      {
        label: isArabic ? "عملاء جدد" : "New Leads",
        value: formatInboxCount(Number(enhancedCounts?.leads ?? 0)),
      },
    ];
  }, [enhancedCounts, isArabic]);

  const selectedIndex = selectedMessage ? visibleItems.findIndex((item) => item.id === selectedMessage.id) : -1;

  const mobileDetailOpen = isMobile && Boolean(selectedMessage);

  return (
    <CRMLayout>
      <div className="h-[calc(100vh-4rem)] overflow-hidden p-3 md:p-5">
        <div className="flex h-full flex-col gap-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{isArabic ? "صندوق الوارد" : "Inbox"}</h1>
              <p className="text-sm text-muted-foreground">
                {isArabic
                  ? "لوحة موحدة للتنبيهات، تذكيرات SLA، وإشعارات الليدز والحملات."
                  : "A unified inbox for alerts, SLA reminders, leads, and campaign notifications."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {headerStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border bg-background px-3 py-2 text-center shadow-sm">
                  <div className="text-[11px] font-medium text-muted-foreground">{stat.label}</div>
                  <div className="text-sm font-bold">{stat.value}</div>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setCurrentPage(1);
                  setAllLoadedItems([]);
                  void invalidateInboxData();
                }}
                title={isArabic ? "تحديث" : "Refresh"}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={handleMarkAllRead}
                disabled={markAllReadMutation.isPending || markReadMutation.isPending}
              >
                <MailOpen className="me-2 h-4 w-4" />
                {isArabic ? "تعليم الكل كمقروء" : "Mark all read"}
              </Button>

              <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm shadow-sm">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span>{isArabic ? "تنبيه سطح المكتب" : "Desktop alert"}</span>
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={async (checked) => {
                    if (checked && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                      await Notification.requestPermission();
                    }
                    setSoundEnabled(Boolean(checked));
                  }}
                />
              </label>
            </div>
          </div>

          <Card className="flex-1 overflow-hidden rounded-[24px] border shadow-sm">
            {isMobile ? (
              <div className="flex h-full flex-col overflow-hidden">
                <div className="border-b px-2 py-2">
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
                    <MessageDetail
                      message={selectedMessage}
                      isArabic={isArabic}
                      onBack={() => setSelectedMessageId(null)}
                      onMarkRead={(id) => void handleMarkReadSingle(id)}
                      onArchive={(id) => setArchivedIds((prev) => new Set(prev).add(id))}
                      relatedMessages={relatedMessages}
                      onSelectRelated={(item) => setSelectedMessageId(item.id)}
                      onPrev={selectedIndex > 0 ? () => setSelectedMessageId(visibleItems[selectedIndex - 1]?.id ?? null) : undefined}
                      onNext={selectedIndex >= 0 && selectedIndex < visibleItems.length - 1 ? () => setSelectedMessageId(visibleItems[selectedIndex + 1]?.id ?? null) : undefined}
                      hasPrev={selectedIndex > 0}
                      hasNext={selectedIndex >= 0 && selectedIndex < visibleItems.length - 1}
                    />
                  ) : (
                    <MessageList
                      items={visibleItems}
                      selectedId={selectedMessageId}
                      selectedIds={selectedIds}
                      onSelect={(item) => void handleSelectMessage(item)}
                      onToggleSelect={(itemId, checked) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(itemId);
                          else next.delete(itemId);
                          return next;
                        });
                      }}
                      onToggleSelectAll={(checked) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          visibleItems.forEach((item) => {
                            if (checked) next.add(item.id);
                            else next.delete(item.id);
                          });
                          return next;
                        });
                      }}
                      allVisibleSelected={allVisibleSelected}
                      isArabic={isArabic}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      type={type}
                      onTypeChange={setType}
                      dateRange={dateRange}
                      onDateRangeChange={setDateRange}
                      selectedCount={selectedIds.size}
                      onBulkMarkRead={() => void handleBulkMarkRead()}
                      onBulkMarkUnread={handleBulkMarkUnread}
                      onBulkArchive={handleBulkArchive}
                      onLoadMore={() => setCurrentPage((prev) => prev + 1)}
                      hasMore={hasMore}
                      isLoading={listQuery.isLoading && currentPage === 1}
                      isFetchingMore={listQuery.isFetching && currentPage > 1}
                      currentTab={activeTab}
                    />
                  )}
                </div>
              </div>
            ) : (
              <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
                <ResizablePanel defaultSize={isCompactSidebar ? 10 : 18} minSize={8} maxSize={24}>
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

                <ResizablePanel defaultSize={36} minSize={28}>
                  <MessageList
                    items={visibleItems}
                    selectedId={selectedMessageId}
                    selectedIds={selectedIds}
                    onSelect={(item) => void handleSelectMessage(item)}
                    onToggleSelect={(itemId, checked) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(itemId);
                        else next.delete(itemId);
                        return next;
                      });
                    }}
                    onToggleSelectAll={(checked) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        visibleItems.forEach((item) => {
                          if (checked) next.add(item.id);
                          else next.delete(item.id);
                        });
                        return next;
                      });
                    }}
                    allVisibleSelected={allVisibleSelected}
                    isArabic={isArabic}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    type={type}
                    onTypeChange={setType}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    selectedCount={selectedIds.size}
                    onBulkMarkRead={() => void handleBulkMarkRead()}
                    onBulkMarkUnread={handleBulkMarkUnread}
                    onBulkArchive={handleBulkArchive}
                    onLoadMore={() => setCurrentPage((prev) => prev + 1)}
                    hasMore={hasMore}
                    isLoading={listQuery.isLoading && currentPage === 1}
                    isFetchingMore={listQuery.isFetching && currentPage > 1}
                    currentTab={activeTab}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={46} minSize={32}>
                  <MessageDetail
                    message={selectedMessage}
                    isArabic={isArabic}
                    onMarkRead={(id) => void handleMarkReadSingle(id)}
                    onArchive={(id) => setArchivedIds((prev) => new Set(prev).add(id))}
                    relatedMessages={relatedMessages}
                    onSelectRelated={(item) => setSelectedMessageId(item.id)}
                    onPrev={selectedIndex > 0 ? () => setSelectedMessageId(visibleItems[selectedIndex - 1]?.id ?? null) : undefined}
                    onNext={selectedIndex >= 0 && selectedIndex < visibleItems.length - 1 ? () => setSelectedMessageId(visibleItems[selectedIndex + 1]?.id ?? null) : undefined}
                    hasPrev={selectedIndex > 0}
                    hasNext={selectedIndex >= 0 && selectedIndex < visibleItems.length - 1}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </Card>

          <div className={cn("text-xs text-muted-foreground", isArabic ? "text-right" : "text-left")}>
            {isArabic
              ? "ملاحظة: البحث ونطاق التاريخ والأرشفة/التعليم كغير مقروء يتمان داخل الواجهة الحالية مع الحفاظ على نفس واجهات tRPC المتاحة."
              : "Note: search, date range, archive, and mark-unread operate within the current UI while preserving the existing tRPC API shape."}
          </div>
        </div>
      </div>
    </CRMLayout>
  );
}

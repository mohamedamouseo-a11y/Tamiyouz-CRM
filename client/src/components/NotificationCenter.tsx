import React from 'react';
import { createPortal } from 'react-dom';
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, Check, CheckCheck, Calendar, UserPlus, AlertTriangle, ArrowRightLeft, AtSign, Info, X, ChevronDown, Filter, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import { useLocation } from "wouter";

interface Props {
  isRTL: boolean;
  primaryColor: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  meeting_reminder: <Calendar size={14} className="text-blue-500" />,
  lead_assigned: <UserPlus size={14} className="text-green-500" />,
  sla_breach: <AlertTriangle size={14} className="text-red-500" />,
  lead_transfer: <ArrowRightLeft size={14} className="text-orange-500" />,
  mention: <AtSign size={14} className="text-purple-500" />,
  system: <Info size={14} className="text-gray-500" />,
};

const typeBgColors: Record<string, string> = {
  meeting_reminder: "bg-blue-50 dark:bg-blue-950/30",
  lead_assigned: "bg-green-50 dark:bg-green-950/30",
  sla_breach: "bg-red-50 dark:bg-red-950/30",
  lead_transfer: "bg-orange-50 dark:bg-orange-950/30",
  mention: "bg-purple-50 dark:bg-purple-950/30",
  system: "bg-gray-50 dark:bg-gray-950/30",
};

type DateFilterKey = "all" | "today" | "week" | "month" | "3months";

// ─── Sound helper ───────────────────────────────────────────────────────────
function playDefaultChime() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + startTime + duration);
      osc.start(audioCtx.currentTime + startTime);
      osc.stop(audioCtx.currentTime + startTime + duration);
    };
    playTone(880, 0, 0.15);
    playTone(1100, 0.18, 0.15);
    playTone(1320, 0.36, 0.25);
  } catch (e) {
    console.warn("[NotificationCenter] Could not play default chime:", e);
  }
}

function playCustomSound(url: string) {
  try {
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(() => playDefaultChime());
  } catch {
    playDefaultChime();
  }
}

// ─── Browser notification helper ────────────────────────────────────────────
function showBrowserNotification(title: string, body: string, link?: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    const notif = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "crm-notification-" + Date.now(),
      requireInteraction: true,
    });
    if (link) {
      notif.onclick = () => {
        window.focus();
        if (link.startsWith("http")) {
          window.open(link, "_blank");
        } else {
          window.location.href = link;
        }
        notif.close();
      };
    }
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

const alertedNotificationIds = new Set<number>();

export default function NotificationCenter({ isRTL, primaryColor }: Props) {
  const [open, setOpen] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("all");
  const [displayLimit, setDisplayLimit] = useState(30);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { dateFrom: startOfDay(now), dateTo: endOfDay(now) };
      case "week":
        return { dateFrom: startOfDay(subDays(now, 7)), dateTo: endOfDay(now) };
      case "month":
        return { dateFrom: startOfDay(subMonths(now, 1)), dateTo: endOfDay(now) };
      case "3months":
        return { dateFrom: startOfDay(subMonths(now, 3)), dateTo: endOfDay(now) };
      default:
        return {};
    }
  }, [dateFilter]);

  const dateRange = getDateRange();

  const { data: unreadCount = 0 } = trpc.inAppNotifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: notificationsResult, refetch } = trpc.inAppNotifications.list.useQuery(
    {
      limit: displayLimit,
      offset: 0,
      ...(dateRange.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
      ...(dateRange.dateTo ? { dateTo: dateRange.dateTo } : {}),
    },
    { refetchInterval: 15000 }
  );

  // Fetch user notification preferences
  const { data: userPrefs } = trpc.notificationPreferences.get.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // Fetch custom sound config
  const { data: soundConfig } = trpc.notificationPreferences.getSoundConfig.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // Build preferences map
  const prefsMap = useMemo(() => {
    const map: Record<string, { soundEnabled: boolean; popupEnabled: boolean }> = {};
    if (userPrefs) {
      for (const p of userPrefs) {
        map[(p as any).notificationType] = {
          soundEnabled: Boolean((p as any).soundEnabled),
          popupEnabled: Boolean((p as any).popupEnabled),
        };
      }
    }
    return map;
  }, [userPrefs]);

  const notifications = notificationsResult?.data ?? (Array.isArray(notificationsResult) ? notificationsResult : []);
  const totalCount = notificationsResult?.total ?? notifications.length;
  const hasMore = notifications.length < totalCount;

  const markRead = trpc.inAppNotifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });

  const markAllRead = trpc.inAppNotifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ─── Handle new notifications with sound + popup based on user preferences ──
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    for (const notif of notifications) {
      if (!notif.isRead && !alertedNotificationIds.has(notif.id)) {
        alertedNotificationIds.add(notif.id);

        const notifType = notif.type || "system";
        const userPref = prefsMap[notifType];

        // Default: enabled if no preference saved
        const soundEnabled = userPref ? userPref.soundEnabled : false;
        const popupEnabled = userPref ? userPref.popupEnabled : false;

        if (soundEnabled) {
          if (soundConfig?.soundFileUrl) {
            playCustomSound(soundConfig.soundFileUrl);
          } else {
            playDefaultChime();
          }
        }

        if (popupEnabled) {
          const title = isRTL ? (notif.titleAr || notif.title) : notif.title;
          const body = isRTL ? (notif.bodyAr || notif.body || "") : (notif.body || "");
          showBrowserNotification(title, body, notif.link || undefined);
        }
      }
    }
  }, [notifications, isRTL, prefsMap, soundConfig]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target) && bellRef.current && !bellRef.current.contains(target)) {
        setOpen(false);
        setShowDateFilter(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleNotificationClick = (notif: any) => {
    if (!notif.isRead) {
      markRead.mutate({ id: notif.id });
    }
    if (notif.link) {
      if (notif.link.startsWith("http")) {
        window.open(notif.link, "_blank");
      } else {
        window.location.href = notif.link;
      }
    }
    setOpen(false);
  };

  const handleLoadMore = () => {
    setDisplayLimit((prev) => prev + 30);
  };

  const handleDateFilterChange = (key: DateFilterKey) => {
    setDateFilter(key);
    setDisplayLimit(30);
    setShowDateFilter(false);
  };

  const formatTime = (date: string | Date) => {
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: isRTL ? ar : undefined,
      });
    } catch {
      return "";
    }
  };

  const dateFilterLabels: Record<DateFilterKey, { en: string; ar: string }> = {
    all: { en: "All Time", ar: "الكل" },
    today: { en: "Today", ar: "اليوم" },
    week: { en: "Last 7 Days", ar: "آخر 7 أيام" },
    month: { en: "Last Month", ar: "آخر شهر" },
    "3months": { en: "Last 3 Months", ar: "آخر 3 أشهر" },
  };

  const bellRef = React.useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = React.useState<{top:number; left:number}>({top:0, left:0});

  React.useEffect(() => {
    if (open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom + 8,
        left: isRTL ? rect.left : Math.max(0, rect.right - 380),
      });
    }
  }, [open, isRTL]);

  return (
    <div className="relative">
      {/* Bell Button */}
      <Button
        variant="ghost"
        ref={bellRef}
        size="icon"
        className="relative h-8 w-8"
        onClick={() => setOpen(!open)}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 text-[10px] rounded-full flex items-center justify-center font-bold text-white"
            style={{ background: primaryColor || "#ef4444" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-[380px] max-h-[520px] bg-card border border-border rounded-xl shadow-xl z-[9999] flex flex-col overflow-hidden"
          style={{ top: dropPos.top, left: dropPos.left }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell size={15} />
              <span className="font-semibold text-sm">
                {isRTL ? "الإشعارات" : "Notifications"}
              </span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Settings Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setOpen(false);
                  navigate("/notification-settings");
                }}
                title={isRTL ? "إعدادات الإشعارات" : "Notification Settings"}
              >
                <Settings size={12} />
              </Button>

              {/* Date Filter Button */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 text-xs gap-1",
                    dateFilter !== "all" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setShowDateFilter(!showDateFilter)}
                >
                  <Filter size={12} />
                  {isRTL ? dateFilterLabels[dateFilter].ar : dateFilterLabels[dateFilter].en}
                </Button>
                {showDateFilter && (
                  <div className={cn(
                    "absolute top-full mt-1 w-36 bg-card border border-border rounded-lg shadow-lg z-[10000] py-1",
                    isRTL ? "left-0" : "right-0"
                  )}>
                    {(Object.keys(dateFilterLabels) as DateFilterKey[]).map((key) => (
                      <button
                        key={key}
                        className={cn(
                          "w-full text-start px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors",
                          dateFilter === key && "font-semibold bg-muted/30"
                        )}
                        onClick={() => handleDateFilterChange(key)}
                      >
                        {isRTL ? dateFilterLabels[key].ar : dateFilterLabels[key].en}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                >
                  <CheckCheck size={12} />
                  {isRTL ? "قراءة الكل" : "Mark all read"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
              >
                <X size={14} />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell size={32} className="mb-3 opacity-20" />
                <p className="text-sm">{isRTL ? "لا توجد إشعارات" : "No notifications yet"}</p>
                {dateFilter !== "all" && (
                  <button
                    className="text-xs mt-2 underline hover:no-underline"
                    onClick={() => handleDateFilterChange("all")}
                  >
                    {isRTL ? "عرض كل الإشعارات" : "Show all notifications"}
                  </button>
                )}
              </div>
            ) : (
              <>
                {notifications.map((notif: any) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "flex gap-3 px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/50",
                      !notif.isRead && (typeBgColors[notif.type] || "bg-blue-50/50 dark:bg-blue-950/20")
                    )}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      {typeIcons[notif.type] || typeIcons.system}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm leading-snug", !notif.isRead && "font-semibold")}>
                        {isRTL ? (notif.titleAr || notif.title) : notif.title}
                      </p>
                      {(notif.body || notif.bodyAr) && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {isRTL ? (notif.bodyAr || notif.body) : notif.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatTime(notif.createdAt)}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div className="mt-2 shrink-0">
                        <div className="w-2 h-2 rounded-full" style={{ background: primaryColor || "#3b82f6" }} />
                      </div>
                    )}
                  </div>
                ))}

                {/* Load More Button */}
                {hasMore && (
                  <div className="px-4 py-3 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={handleLoadMore}
                    >
                      <ChevronDown size={14} />
                      {isRTL
                        ? `تحميل المزيد (${notifications.length} من ${totalCount})`
                        : `Load More (${notifications.length} of ${totalCount})`}
                    </Button>
                  </div>
                )}

                {!hasMore && notifications.length > 0 && (
                  <div className="px-4 py-2 text-center">
                    <p className="text-[10px] text-muted-foreground/50">
                      {isRTL
                        ? `عرض ${notifications.length} إشعار`
                        : `Showing all ${notifications.length} notifications`}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
}

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { Bell, AlertTriangle, ExternalLink, Phone, Clock, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface Props {
  isRTL: boolean;
  total: number;
}

export default function SLAAlertBell({ isRTL, total }: Props) {
  const [open, setOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const bellRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Fetch SLA breached leads when dropdown is open
  const { data: slaData } = trpc.leads.list.useQuery(
    { slaBreached: true, limit: displayLimit, offset: 0 },
    { enabled: open, refetchInterval: open ? 30000 : false }
  );

  const leads = slaData?.items ?? [];
  const totalCount = slaData?.total ?? total;
  const hasMore = leads.length < totalCount;

  // Position the dropdown
  useEffect(() => {
    if (open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom + 8,
        left: isRTL ? rect.left : Math.max(0, rect.right - 400),
      });
    }
  }, [open, isRTL]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        bellRef.current &&
        !bellRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleLeadClick = (leadId: number) => {
    window.location.href = `/leads?id=${leadId}`;
    setOpen(false);
  };

  const handleViewAll = () => {
    window.location.href = "/leads?slaBreached=true";
    setOpen(false);
  };

  const formatTime = (date: string | Date | null | undefined) => {
    if (!date) return isRTL ? "لم يتم التواصل" : "No contact";
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: isRTL ? ar : undefined,
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative">
      <Button
        ref={bellRef}
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 rounded-xl bg-muted/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        onClick={() => setOpen(!open)}
      >
        <Bell size={17} strokeWidth={1.8} />
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse px-1">
          {total > 9 ? "9+" : total}
        </span>
      </Button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-[400px] max-h-[520px] bg-card border border-border rounded-xl shadow-xl z-[9999] flex flex-col overflow-hidden"
            style={{ top: dropPos.top, left: dropPos.left }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-destructive/5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-destructive" />
                <span className="font-semibold text-sm">
                  {isRTL ? "تنبيهات SLA" : "SLA Alerts"}
                </span>
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                  {totalCount}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={handleViewAll}
                >
                  <ExternalLink size={12} />
                  {isRTL ? "عرض الكل" : "View All"}
                </Button>
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

            {/* Leads List */}
            <div className="flex-1 overflow-y-auto">
              {leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertTriangle size={32} className="mb-3 opacity-20" />
                  <p className="text-sm">
                    {isRTL ? "لا توجد تنبيهات SLA" : "No SLA alerts"}
                  </p>
                </div>
              ) : (
                <>
                  {leads.map((lead: any) => (
                    <div
                      key={lead.id}
                      className="flex gap-3 px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-destructive/5"
                      onClick={() => handleLeadClick(lead.id)}
                    >
                      {/* Avatar */}
                      <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle size={14} className="text-destructive" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">
                            {lead.name || lead.firstName || lead.phone || "—"}
                          </p>
                          {lead.stage && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
                              {lead.stage}
                            </Badge>
                          )}
                        </div>

                        {lead.phone && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Phone size={10} className="text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate" dir="ltr">
                              {lead.phone}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={10} className="text-destructive/60 shrink-0" />
                          <span className="text-[10px] text-destructive/80">
                            {isRTL ? "آخر تواصل: " : "Last contact: "}
                            {formatTime(lead.lastContactDate || lead.contactDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Load More */}
                  {hasMore && (
                    <div className="px-4 py-3 border-t border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => setDisplayLimit((prev) => prev + 20)}
                      >
                        <ChevronDown size={14} />
                        {isRTL
                          ? `تحميل المزيد (${leads.length} من ${totalCount})`
                          : `Load More (${leads.length} of ${totalCount})`}
                      </Button>
                    </div>
                  )}

                  {/* View All Footer */}
                  <div className="px-4 py-2.5 border-t border-border bg-muted/20">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleViewAll}
                    >
                      <ExternalLink size={12} />
                      {isRTL
                        ? `عرض جميع تنبيهات SLA (${totalCount})`
                        : `View All SLA Alerts (${totalCount})`}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

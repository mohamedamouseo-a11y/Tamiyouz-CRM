// client/src/components/inbox/MessageDetail.tsx

import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CheckCheck,
  Clock3,
  ExternalLink,
  Inbox,
  MessageSquare,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  formatInboxTime,
  getMessageBody,
  getMessageLeadId,
  getMessageLeadName,
  getMessageLink,
  getMessagePhone,
  getMessageTitle,
  type InboxMessage,
} from "./types";

type Props = {
  message: InboxMessage | null;
  isArabic?: boolean;
  onMarkRead?: (id: number) => void;
  onArchive?: (id: number) => void;
  onBack?: () => void;
  relatedMessages?: InboxMessage[];
  onSelectRelated?: (message: InboxMessage) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
};

const LABEL_MAP: Record<string, { en: string; ar: string }> = {
  leadId: { en: "Lead ID", ar: "رقم العميل" },
  leadName: { en: "Lead Name", ar: "اسم العميل" },
  phone: { en: "Phone", ar: "الهاتف" },
  campaignName: { en: "Campaign", ar: "الحملة" },
  assignedToName: { en: "Assigned To", ar: "تم التعيين لـ" },
  assignedToId: { en: "Assigned To ID", ar: "رقم الموظف" },
  leadTime: { en: "Form Filled At", ar: "وقت ملء النموذج" },
  createdAt: { en: "Arrived in CRM", ar: "وصل للنظام" },
  breachDuration: { en: "Breach Duration", ar: "مدة التجاوز" },
  slaAlertedAt: { en: "SLA Alerted At", ar: "وقت تنبيه SLA" },
  platform: { en: "Platform", ar: "المنصة" },
  status: { en: "Status", ar: "الحالة" },
  startDate: { en: "Start Date", ar: "تاريخ البدء" },
  visibility: { en: "Visibility", ar: "الظهور" },
  trigger: { en: "Trigger", ar: "المحفز" },
  clientName: { en: "Client Name", ar: "اسم العميل" },
  lastActivityTime: { en: "Last Activity", ar: "آخر نشاط" },
  startTime: { en: "Start Time", ar: "وقت البدء" },
  eventId: { en: "Event ID", ar: "رقم الحدث" },
  repeatTotal: { en: "Repeat Total", ar: "إجمالي التكرار" },
  repeatIndex: { en: "Repeat Index", ar: "رقم التكرار" },
  soundEnabled: { en: "Sound Enabled", ar: "الصوت مفعل" },
  popupEnabled: { en: "Popup Enabled", ar: "النافذة المنبثقة" },
  reminderMinutes: { en: "Reminder Minutes", ar: "دقائق التذكير" },
};

function prettifyLabel(key: string, isArabic?: boolean) {
  if (LABEL_MAP[key]) return isArabic ? LABEL_MAP[key].ar : LABEL_MAP[key].en;
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function renderValue(value: unknown, isArabic?: boolean) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? (isArabic ? "نعم" : "Yes") : (isArabic ? "لا" : "No");
  if (typeof value === "string") {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime()) && value.includes("T")) {
      return new Intl.DateTimeFormat(isArabic ? "ar" : undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(asDate);
    }
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function buildTimeline(message: InboxMessage, relatedMessages: InboxMessage[], isArabic?: boolean) {
  const current = [message, ...relatedMessages]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return current.map((item) => ({
    id: item.id,
    title: getMessageTitle(item, isArabic),
    time: formatInboxTime(item.createdAt, isArabic),
    body: getMessageBody(item, isArabic),
    isCurrent: item.id === message.id,
  }));
}

export function MessageDetail({
  message,
  isArabic,
  onMarkRead,
  onArchive,
  onBack,
  relatedMessages = [],
  onSelectRelated,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Props) {
  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
          <Inbox className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{isArabic ? "اختر إشعارًا" : "Select a notification"}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {isArabic ? "اختر عنصرًا من القائمة لعرض التفاصيل والسياق السريع." : "Choose an item from the list to view context and actions."}
          </p>
        </div>
      </div>
    );
  }

  const title = getMessageTitle(message, isArabic);
  const body = getMessageBody(message, isArabic);
  const phone = getMessagePhone(message);
  const leadName = getMessageLeadName(message);
  const leadId = getMessageLeadId(message);
  const leadLink = getMessageLink(message);
  const metadataEntries = Object.entries(message.metadata ?? {}).filter(([_, value]) => value != null && value !== "");
  const timeline = buildTimeline(message, relatedMessages, isArabic);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="border-b px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              {onBack && (
                <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {!message.isRead && (
                <Badge className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {isArabic ? "غير مقروء" : "Unread"}
                </Badge>
              )}
              <Badge variant="outline" className="rounded-full">
                {formatInboxTime(message.createdAt, isArabic)}
              </Badge>
            </div>
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" disabled={!phone} asChild={Boolean(phone)}>
              {phone ? (
                <a href={`tel:${phone}`}>
                  <Phone className="me-2 h-4 w-4" />
                  {isArabic ? "اتصال" : "Call"}
                </a>
              ) : (
                <span>
                  <Phone className="me-2 inline h-4 w-4" />
                  {isArabic ? "اتصال" : "Call"}
                </span>
              )}
            </Button>

            <Button variant="outline" size="sm" className="rounded-xl" disabled={!phone} asChild={Boolean(phone)}>
              {phone ? (
                <a href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                  <MessageSquare className="me-2 h-4 w-4" />
                  WhatsApp
                </a>
              ) : (
                <span>
                  <MessageSquare className="me-2 inline h-4 w-4" />
                  WhatsApp
                </span>
              )}
            </Button>

            <Button variant="default" size="sm" className="rounded-xl" disabled={!leadLink} asChild={Boolean(leadLink)}>
              {leadLink ? (
                <a href={leadLink}>
                  <ExternalLink className="me-2 h-4 w-4" />
                  {isArabic ? "فتح الملف" : "Open profile"}
                </a>
              ) : (
                <span>
                  <ExternalLink className="me-2 inline h-4 w-4" />
                  {isArabic ? "فتح الملف" : "Open profile"}
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!message.isRead && (
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onMarkRead?.(message.id)}>
              <CheckCheck className="me-2 h-4 w-4" />
              {isArabic ? "تعليم كمقروء" : "Mark as read"}
            </Button>
          )}
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onArchive?.(message.id)}>
            <Archive className="me-2 h-4 w-4" />
            {isArabic ? "أرشفة" : "Archive"}
          </Button>
          <div className="ms-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={onPrev} disabled={!hasPrev}>
              {isArabic ? "السابق" : "Prev"}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={onNext} disabled={!hasNext}>
              {isArabic ? "التالي" : "Next"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{isArabic ? "ملخص سريع" : "Quick context"}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {isArabic ? "اسم العميل" : "Lead name"}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{leadName || (isArabic ? "غير متوفر" : "Unavailable")}</p>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {isArabic ? "رقم العميل" : "Lead ID"}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{leadId ?? "—"}</p>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {isArabic ? "الهاتف" : "Phone"}
                  </p>
                  <p className="mt-1 text-sm font-semibold" dir="ltr">{phone || "—"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{isArabic ? "الجدول الزمني المصغر" : "Mini timeline"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {timeline.map((item, index) => (
                    <div key={item.id} className="relative flex gap-3">
                      <div className="flex w-5 flex-col items-center">
                        <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", item.isCurrent ? "bg-primary" : "bg-muted-foreground/30")} />
                        {index < timeline.length - 1 && <span className="mt-1 h-full w-px bg-border" />}
                      </div>
                      <div className="min-w-0 flex-1 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{item.time}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{isArabic ? "تفاصيل الإشعار" : "Notification details"}</CardTitle>
              </CardHeader>
              <CardContent>
                {metadataEntries.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    {metadataEntries.map(([key, value]) => (
                      <div key={key} className="rounded-2xl border bg-muted/30 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {prettifyLabel(key, isArabic)}
                        </p>
                        <p className="mt-1 break-words text-sm font-medium">{renderValue(value, isArabic)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isArabic ? "لا توجد تفاصيل إضافية لهذا الإشعار." : "No extra metadata for this notification."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{isArabic ? "إشعارات أخرى مرتبطة" : "Other related notifications"}</CardTitle>
              </CardHeader>
              <CardContent>
                {relatedMessages.length ? (
                  <div className="space-y-2">
                    {relatedMessages.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectRelated?.(item)}
                        className="w-full rounded-2xl border p-3 text-start transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold">{getMessageTitle(item, isArabic)}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatInboxTime(item.createdAt, isArabic)}</span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{getMessageBody(item, isArabic)}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isArabic ? "لا توجد إشعارات أخرى مرتبطة داخل العناصر المحملة حاليًا." : "No related notifications found in the currently loaded items."}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="text-center text-[11px] text-muted-foreground">
              <Clock3 className="me-1 inline h-3.5 w-3.5" />
              {new Intl.DateTimeFormat(isArabic ? "ar" : undefined, {
                dateStyle: "full",
                timeStyle: "short",
              }).format(new Date(message.createdAt))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

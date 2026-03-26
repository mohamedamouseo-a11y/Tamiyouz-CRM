import { Clock, ExternalLink, Inbox, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { InboxMessage } from "./types";

type Props = {
  message: InboxMessage | null;
  isArabic?: boolean;
  onMarkRead?: (id: number) => void;
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
  trigger: { en: "Trigger", ar: "المُحفِّز" },
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

function renderValue(value: unknown) {
  if (value == null || value === "") return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime()) && value.includes("T")) {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(asDate);
    }
  }
  return String(value);
}

function computeTimeDiff(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;
  const leadTime = metadata.leadTime as string | null;
  const createdAt = metadata.createdAt as string | null;
  if (!leadTime || !createdAt) return null;
  const diff = new Date(createdAt).getTime() - new Date(leadTime).getTime();
  if (isNaN(diff) || diff < 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min(s)`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return `${hours}h ${remainMins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function getTypeBadge(type: string, isArabic?: boolean) {
  const map: Record<string, { label: string; labelAr: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
    sla_breach: { label: "SLA Breach", labelAr: "تجاوز SLA", variant: "destructive" },
    new_lead: { label: "New Lead", labelAr: "عميل جديد", variant: "default" },
    lead_assigned: { label: "Lead Assigned", labelAr: "تم تعيين عميل", variant: "default" },
    lead_distribution: { label: "Lead Distribution", labelAr: "توزيع عملاء", variant: "secondary" },
    meeting_reminder: { label: "Meeting", labelAr: "اجتماع", variant: "outline" },
    follow_up_reminder: { label: "Follow-up", labelAr: "متابعة", variant: "outline" },
    reminder: { label: "Reminder", labelAr: "تذكير", variant: "outline" },
    campaign_alert: { label: "Campaign", labelAr: "حملة", variant: "secondary" },
  };
  const info = map[type] ?? { label: type, labelAr: type, variant: "secondary" as const };
  return (
    <Badge variant={info.variant} className="text-xs">
      {isArabic ? info.labelAr : info.label}
    </Badge>
  );
}

export function MessageDetail({ message, isArabic, onMarkRead }: Props) {
  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <Inbox className="h-12 w-12 opacity-30" />
        <p className="text-sm">
          {isArabic ? "اختر رسالة لعرض تفاصيلها." : "Select a message to view its details."}
        </p>
      </div>
    );
  }

  const title = isArabic ? message.titleAr || message.title : message.title;
  const body = isArabic ? message.bodyAr || message.body : message.body;
  const metadataEntries = Object.entries(message.metadata ?? {});
  const timeDiff = computeTimeDiff(message.metadata);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            {getTypeBadge(message.type, isArabic)}
            {!message.isRead && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-600">
                {isArabic ? "غير مقروء" : "Unread"}
              </Badge>
            )}
          </div>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {!message.isRead && (
            <Button type="button" variant="outline" size="sm" onClick={() => onMarkRead?.(message.id)}>
              <MailCheck className="me-2 h-4 w-4" />
              {isArabic ? "تعليم كمقروء" : "Mark as read"}
            </Button>
          )}
          {message.link && (
            <Button type="button" size="sm" asChild>
              <a href={message.link}>
                <ExternalLink className="me-2 h-4 w-4" />
                {isArabic ? "فتح" : "Open link"}
              </a>
            </Button>
          )}
        </div>
      </div>

      <Separator className="my-5" />

      {/* Time to CRM indicator */}
      {timeDiff && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
          <Clock className="h-5 w-5 text-blue-500" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
              {isArabic ? "الوقت حتى وصول الـ CRM" : "Time to CRM"}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-blue-700 dark:text-blue-300">{timeDiff}</p>
          </div>
        </div>
      )}

      {/* Metadata */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isArabic ? "التفاصيل" : "Metadata"}</CardTitle>
        </CardHeader>
        <CardContent>
          {metadataEntries.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key} className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {prettifyLabel(key, isArabic)}
                  </p>
                  <p className="mt-1 break-words text-sm font-medium">{renderValue(value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isArabic ? "لا توجد تفاصيل إضافية لهذه الرسالة." : "No metadata found for this message."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timestamp footer */}
      <div className="mt-4 text-center">
        <p className="text-[11px] text-muted-foreground">
          {new Intl.DateTimeFormat(isArabic ? "ar" : undefined, {
            dateStyle: "full",
            timeStyle: "short",
          }).format(new Date(message.createdAt))}
        </p>
      </div>
    </div>
  );
}

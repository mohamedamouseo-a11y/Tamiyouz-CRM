import {
  AlertTriangle,
  CalendarClock,
  Clock,
  ExternalLink,
  Inbox,
  MailCheck,
  Megaphone,
  MessageSquare,
  Phone,
  UserCheck,
  UserPlus,
  UserRoundSearch,
} from "lucide-react";
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

/* ── Label map ─────────────────────────────────────────────── */

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

/* ── Type badge config ─────────────────────────────────────── */

type BadgeConfig = {
  label: string;
  labelAr: string;
  icon: typeof AlertTriangle;
  className: string;
};

const BADGE_MAP: Record<string, BadgeConfig> = {
  sla_breach: {
    label: "SLA Breach",
    labelAr: "تجاوز SLA",
    icon: AlertTriangle,
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  },
  new_lead: {
    label: "New Lead",
    labelAr: "عميل جديد",
    icon: UserPlus,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  lead_assigned: {
    label: "Lead Assigned",
    labelAr: "تم تعيين عميل",
    icon: UserCheck,
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  },
  lead_distribution: {
    label: "Lead Distribution",
    labelAr: "توزيع عملاء",
    icon: UserRoundSearch,
    className: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300",
  },
  meeting_reminder: {
    label: "Meeting",
    labelAr: "اجتماع",
    icon: CalendarClock,
    className: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300",
  },
  follow_up_reminder: {
    label: "Follow-up",
    labelAr: "متابعة",
    icon: Clock,
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  },
  reminder: {
    label: "Reminder",
    labelAr: "تذكير",
    icon: CalendarClock,
    className: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300",
  },
  campaign_alert: {
    label: "Campaign",
    labelAr: "حملة",
    icon: Megaphone,
    className: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300",
  },
};

function getTypeBadge(type: string, isArabic?: boolean) {
  const cfg = BADGE_MAP[type] ?? {
    label: type,
    labelAr: type,
    icon: Inbox,
    className: "border-gray-200 bg-gray-50 text-gray-700",
  };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {isArabic ? cfg.labelAr : cfg.label}
    </Badge>
  );
}

/* ── Lead card component ───────────────────────────────────── */

function LeadCard({ message, isArabic }: { message: InboxMessage; isArabic?: boolean }) {
  const meta = message.metadata as Record<string, unknown> | null;
  if (!meta) return null;

  const leadName = (meta.leadName as string) || null;
  const phone = (meta.phone as string) || null;
  const campaignName = (meta.campaignName as string) || null;
  const assignedToName = (meta.assignedToName as string) || null;

  if (!leadName && !phone) return null;

  return (
    <Card className="mb-4 overflow-hidden rounded-2xl border-emerald-200 dark:border-emerald-800">
      {/* Green header bar */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-white">
        <UserPlus className="h-4 w-4" />
        <span className="text-sm font-semibold">
          {isArabic ? "بيانات العميل" : "Lead Information"}
        </span>
      </div>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Lead name */}
          {leadName && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <span className="text-sm font-bold">
                  {leadName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-base font-bold">{leadName}</p>
                {assignedToName && (
                  <p className="text-xs text-muted-foreground">
                    {isArabic ? `معيّن لـ: ${assignedToName}` : `Assigned to: ${assignedToName}`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Info chips */}
          <div className="flex flex-wrap gap-2">
            {phone && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium" dir="ltr">{phone}</span>
              </div>
            )}
            {campaignName && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5">
                <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{campaignName}</span>
              </div>
            )}
          </div>

          {/* Quick actions */}
          {phone && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-lg">
                <a href={`tel:${phone}`}>
                  <Phone className="h-3.5 w-3.5" />
                  {isArabic ? "اتصال" : "Call"}
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-lg">
                <a
                  href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {isArabic ? "واتساب" : "WhatsApp"}
                </a>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main component ────────────────────────────────────────── */

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
  const isLeadType = ["new_lead", "lead_assigned", "lead_distribution"].includes(message.type);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            {getTypeBadge(message.type, isArabic)}
            {!message.isRead && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-600 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
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
                {isArabic ? "فتح الصفحة" : "Open lead"}
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

      {/* Rich lead card for lead-type notifications */}
      {isLeadType && <LeadCard message={message} isArabic={isArabic} />}

      {/* Metadata */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isArabic ? "التفاصيل" : "Details"}</CardTitle>
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
              {isArabic ? "لا توجد تفاصيل إضافية لهذه الرسالة." : "No additional details for this message."}
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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import CRMLayout from "@/components/CRMLayout";
import { toast } from "sonner";
import {
  ArchiveRestore,
  CalendarDays,
  CalendarPlus2,
  CalendarClock,
  CalendarX2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  ClipboardList,
  Eye,
  FileJson2,
  PencilLine,
  Plus,
  RedoDot,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Undo2,
} from "lucide-react";

type AuditLog = {
  id: number;
  createdAt: string;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId?: number | string | null;
  entityName?: string | null;
  details?: unknown;
  previousValue?: unknown;
  newValue?: unknown;
};

type ObjectLike = Record<string, unknown>;

type DiffRow = {
  key: string;
  previous: unknown;
  next: unknown;
};

const actionLabels: Record<string, { en: string; ar: string; color: string; icon: ReactNode; tone: string }> = {
  soft_delete: {
    en: "Deleted",
    ar: "حذف",
    color: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300",
    icon: <Trash2 size={12} />,
    tone: "bg-amber-500",
  },
  restore: {
    en: "Restored",
    ar: "استعادة",
    color: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300",
    icon: <ArchiveRestore size={12} />,
    tone: "bg-emerald-500",
  },
  permanent_delete: {
    en: "Permanently Deleted",
    ar: "حذف نهائي",
    color: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300",
    icon: <Trash2 size={12} />,
    tone: "bg-red-500",
  },
  undo: {
    en: "Undone",
    ar: "تم التراجع",
    color: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300",
    icon: <Undo2 size={12} />,
    tone: "bg-sky-500",
  },
  data_edit: {
    en: "Edited",
    ar: "تعديل",
    color: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-300",
    icon: <PencilLine size={12} />,
    tone: "bg-violet-500",
  },
  calendar_event_created: {
    en: "Calendar Created",
    ar: "إنشاء موعد",
    color: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300",
    icon: <CalendarPlus2 size={12} />,
    tone: "bg-emerald-500",
  },
  calendar_event_updated: {
    en: "Calendar Updated",
    ar: "تعديل موعد",
    color: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300",
    icon: <CalendarClock size={12} />,
    tone: "bg-blue-500",
  },
  calendar_event_deleted: {
    en: "Calendar Deleted",
    ar: "حذف موعد",
    color: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300",
    icon: <CalendarX2 size={12} />,
    tone: "bg-red-500",
  },
  update: {
    en: "Updated",
    ar: "تحديث",
    color: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300",
    icon: <PencilLine size={12} />,
    tone: "bg-blue-500",
  },
  create: {
    en: "Created",
    ar: "إنشاء",
    color: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300",
    icon: <Plus size={12} />,
    tone: "bg-emerald-500",
  },
};

const entityLabels: Record<string, { en: string; ar: string }> = {
  leads: { en: "Lead", ar: "عميل محتمل" },
  users: { en: "User", ar: "مستخدم" },
  campaigns: { en: "Campaign", ar: "حملة" },
  activities: { en: "Activity", ar: "نشاط" },
  deals: { en: "Deal", ar: "صفقة" },
  internalNotes: { en: "Internal Note", ar: "ملاحظة داخلية" },
  clients: { en: "Client", ar: "عميل" },
  contracts: { en: "Contract", ar: "عقد" },
  calendar: { en: "Calendar", ar: "تقويم" },
  follow_ups: { en: "Follow-up", ar: "متابعة" },
  client_tasks: { en: "Task", ar: "مهمة" },
  client_objectives: { en: "Objective", ar: "هدف" },
  deliverables: { en: "Deliverable", ar: "مخرج" },
  upsell_opportunities: { en: "Upsell", ar: "فرصة بيع" },
  client_communications: { en: "Channel", ar: "قناة تواصل" },
  support_request: { en: "Support Request", ar: "طلب دعم" },
  support_request_reply: { en: "Support Reply", ar: "رد دعم" },
  support_request_status: { en: "Support Status", ar: "حالة الدعم" },
};

const fieldLabels: Record<string, { en: string; ar: string }> = {
  status: { en: "Status", ar: "الحالة" },
  stage: { en: "Stage", ar: "المرحلة" },
  phone: { en: "Phone", ar: "الهاتف" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  name: { en: "Name", ar: "الاسم" },
  title: { en: "Title", ar: "العنوان" },
  description: { en: "Description", ar: "الوصف" },
  userName: { en: "User Name", ar: "اسم المستخدم" },
  userRole: { en: "User Role", ar: "دور المستخدم" },
  ownerId: { en: "Owner", ar: "المسؤول" },
  accountManagerId: { en: "Account Manager", ar: "مدير الحساب" },
  leadQuality: { en: "Lead Quality", ar: "جودة العميل" },
  fitStatus: { en: "Fit Status", ar: "حالة الملاءمة" },
  createdAt: { en: "Created At", ar: "تاريخ الإنشاء" },
  updatedAt: { en: "Updated At", ar: "تاريخ التحديث" },
  endDate: { en: "End Date", ar: "تاريخ الانتهاء" },
  contractRenewalStatus: { en: "Renewal Status", ar: "حالة التجديد" },
  isSuperAdmin: { en: "Super Admin", ar: "مشرف أعلى" },
};

const roleColorMap: Record<string, string> = {
  Admin: "bg-blue-600 text-white",
  admin: "bg-blue-600 text-white",
  SalesAgent: "bg-emerald-600 text-white",
  sales: "bg-emerald-600 text-white",
  SalesManager: "bg-teal-600 text-white",
  AccountManager: "bg-orange-500 text-white",
  AccountManagerLead: "bg-amber-500 text-white",
  MediaBuyer: "bg-violet-600 text-white",
};

const searchableActions = [
  "all",
  "create",
  "update",
  "data_edit",
  "soft_delete",
  "permanent_delete",
  "restore",
  "undo",
  "calendar_event_created",
  "calendar_event_updated",
  "calendar_event_deleted",
] as const;

function parseMaybeJson(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function toObject(value: unknown): ObjectLike | null {
  const parsed = parseMaybeJson(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return null;
  return parsed as ObjectLike;
}

function humanizeKey(key: string, lang: "ar" | "en") {
  if (fieldLabels[key]) return fieldLabels[key][lang];
  const result = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function formatValue(value: unknown, lang: "ar" | "en"): string {
  const parsed = parseMaybeJson(value);
  if (parsed === null || parsed === undefined || parsed === "") {
    return lang === "ar" ? "غير متوفر" : "Not available";
  }
  if (typeof parsed === "boolean") {
    return parsed ? (lang === "ar" ? "نعم" : "Yes") : (lang === "ar" ? "لا" : "No");
  }
  if (typeof parsed === "number") {
    return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(parsed);
  }
  if (typeof parsed === "string") {
    return parsed;
  }
  if (Array.isArray(parsed)) {
    return lang === "ar"
      ? `${parsed.length} عناصر`
      : `${parsed.length} items`;
  }
  if (typeof parsed === "object") {
    const candidate = parsed as Record<string, unknown>;
    const smartValue = candidate.name ?? candidate.title ?? candidate.label ?? candidate.status ?? candidate.id;
    if (smartValue !== undefined) return String(smartValue);
    return lang === "ar" ? "بيانات مركبة" : "Structured data";
  }
  return String(parsed);
}

function buildDiffRows(log: AuditLog): DiffRow[] {
  const previous = toObject(log.previousValue) ?? {};
  const next = toObject(log.newValue) ?? {};
  const details = toObject(log.details) ?? {};
  const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(next), ...Object.keys(details)]));

  return keys
    .map((key) => {
      const previousValue = previous[key];
      const nextValue = key in next ? next[key] : details[key];
      return { key, previous: previousValue, next: nextValue };
    })
    .filter((row) => JSON.stringify(parseMaybeJson(row.previous)) !== JSON.stringify(parseMaybeJson(row.next)));
}

function getSummaryObject(log: AuditLog): ObjectLike | null {
  return toObject(log.newValue) ?? toObject(log.previousValue) ?? toObject(log.details);
}

function getEntityDisplay(log: AuditLog, lang: "ar" | "en") {
  return log.entityName || `#${log.entityId ?? (lang === "ar" ? "غير معروف" : "Unknown")}`;
}

function getEntityLabel(entityType: string, lang: "ar" | "en") {
  return entityLabels[entityType]?.[lang] ?? entityType;
}

function getActionLabel(action: string, lang: "ar" | "en") {
  return actionLabels[action]?.[lang] ?? action;
}

function getActionSentence(log: AuditLog, lang: "ar" | "en") {
  const userName = log.userName || (lang === "ar" ? "مستخدم غير معروف" : "Unknown user");
  const entityLabel = getEntityLabel(log.entityType, lang);
  const entityDisplay = getEntityDisplay(log, lang);
  const action = log.action;

  if (lang === "ar") {
    const verbMap: Record<string, string> = {
      create: "أنشأ",
      update: "حدّث",
      data_edit: "عدّل",
      soft_delete: "حذف",
      permanent_delete: "حذف نهائيًا",
      restore: "استعاد",
      undo: "تراجع عن",
      calendar_event_created: "أنشأ موعدًا في",
      calendar_event_updated: "حدّث موعدًا في",
      calendar_event_deleted: "حذف موعدًا من",
    };

    return {
      userName,
      actionText: verbMap[action] ?? "أجرى تحديثًا على",
      entityLabel,
      entityDisplay,
    };
  }

  const verbMap: Record<string, string> = {
    create: "created",
    update: "updated",
    data_edit: "edited",
    soft_delete: "deleted",
    permanent_delete: "permanently deleted",
    restore: "restored",
    undo: "undid",
    calendar_event_created: "created a calendar entry for",
    calendar_event_updated: "updated a calendar entry for",
    calendar_event_deleted: "deleted a calendar entry from",
  };

  return {
    userName,
    actionText: verbMap[action] ?? "updated",
    entityLabel,
    entityDisplay,
  };
}

function getDateGroupLabel(dateValue: string, lang: "ar" | "en") {
  const date = new Date(dateValue);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return lang === "ar" ? "اليوم" : "Today";
  if (isSameDay(date, yesterday)) return lang === "ar" ? "أمس" : "Yesterday";

  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function getTimeLabel(dateValue: string, lang: "ar" | "en") {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function getDateTimeLabel(dateValue: string, lang: "ar" | "en") {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function getAvatarClasses(userRole?: string | null) {
  return roleColorMap[userRole || ""] ?? "bg-slate-600 text-white";
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

function canUndoLog(log: AuditLog) {
  return !!log.previousValue && log.action !== "undo";
}

function timelineSkeleton() {
  return (
    <div className="relative flex gap-4 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="relative flex w-14 shrink-0 flex-col items-center">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="mt-3 h-5 w-5 rounded-full" />
        <div className="absolute top-12 bottom-[-20px] w-px bg-border" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-1/2" />
        <div className="grid gap-2 md:grid-cols-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function buildPagination(currentPage: number, hasMore: boolean) {
  const lastKnownPage = hasMore ? currentPage + 1 : currentPage;
  const pages: Array<number | "ellipsis"> = [];
  const totalKnown = lastKnownPage + 1;

  if (totalKnown <= 7) {
    for (let i = 0; i < totalKnown; i += 1) pages.push(i);
    return pages;
  }

  pages.push(0);
  if (currentPage > 2) pages.push("ellipsis");
  for (let page = Math.max(1, currentPage - 1); page <= Math.min(lastKnownPage - 1, currentPage + 1); page += 1) {
    pages.push(page);
  }
  if (currentPage < lastKnownPage - 2) pages.push("ellipsis");
  if (lastKnownPage > 0) pages.push(lastKnownPage);
  return pages;
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isRTL = lang === "ar";
  const role = user?.role ?? "";

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [detailsLog, setDetailsLog] = useState<AuditLog | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [showRawMap, setShowRawMap] = useState<Record<number, boolean>>({});

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = trpc.auditLogs.list.useQuery({
    entityType: entityFilter !== "all" ? entityFilter : undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  useEffect(() => {
    if (error?.message) toast.error(error.message);
  }, [error?.message]);

  const undoMutation = trpc.auditLogs.undo.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم التراجع عن العملية بنجاح" : "Change undone successfully");
      void refetch();
    },
    onError: (mutationError) => {
      toast.error(mutationError.message);
    },
  });

  const handleUndo = (logId: number) => {
    const confirmation = window.confirm(
      isRTL
        ? "هل أنت متأكد من التراجع عن هذه العملية؟ سيتم استعادة القيم السابقة."
        : "Are you sure you want to undo this change? Previous values will be restored."
    );
    if (!confirmation) return;
    undoMutation.mutate({ auditLogId: logId });
  };

  const filteredLogs = useMemo(() => {
    const logs = (data ?? []) as AuditLog[];
    const normalizedSearch = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;

      if (normalizedSearch) {
        const haystack = [
          log.userName,
          log.entityName,
          String(log.entityId ?? ""),
          String(log.id),
          log.userRole,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      if (dateFrom) {
        const logDate = new Date(log.createdAt);
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (logDate < from) return false;
      }

      if (dateTo) {
        const logDate = new Date(log.createdAt);
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (logDate > to) return false;
      }

      return true;
    });
  }, [actionFilter, data, dateFrom, dateTo, search]);

  const groupedLogs = useMemo(() => {
    const result: Array<{ label: string; items: AuditLog[] }> = [];

    filteredLogs.forEach((log) => {
      const label = getDateGroupLabel(log.createdAt, isRTL ? "ar" : "en");
      const existing = result.find((group) => group.label === label);
      if (existing) {
        existing.items.push(log);
      } else {
        result.push({ label, items: [log] });
      }
    });

    return result;
  }, [filteredLogs, isRTL]);

  const hasMore = (data?.length ?? 0) === pageSize;
  const pagination = buildPagination(page, hasMore);
  const rangeStart = filteredLogs.length > 0 ? page * pageSize + 1 : 0;
  const rangeEnd = filteredLogs.length > 0 ? page * pageSize + filteredLogs.length : 0;

  if (role !== "Admin" && role !== "admin") {
    return (
      <CRMLayout>
        <div className="flex min-h-[70vh] items-center justify-center p-6" dir={isRTL ? "rtl" : "ltr"}>
          <Card className="max-w-md border-destructive/20 shadow-sm">
            <CardContent className="pt-8 text-center">
              <ShieldAlert className="mx-auto mb-4 text-destructive" size={48} />
              <h2 className="mb-2 text-lg font-semibold">
                {isRTL ? "غير مصرح" : "Unauthorized"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "هذه الصفحة متاحة للأدمن فقط" : "This page is only available to admins"}
              </p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <TooltipProvider>
        <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <ClipboardList size={14} />
                  {isRTL ? "سجل العمليات" : "Audit Log"}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {isRTL ? "نشاط النظام" : "System Activity"}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                    {isRTL
                      ? "عرض زمني واضح لكل العمليات مع تفاصيل ذكية، تراجع سريع، وتجربة أقرب إلى أدوات SaaS الاحترافية."
                      : "A cleaner timeline of every important operation with smart details, fast undo, and a premium SaaS feel."}
                  </p>
                </div>
              </div>

              <Card className="w-full border-border/60 bg-card/80 shadow-sm lg:max-w-sm">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {isRTL ? "الصفحة الحالية" : "Current Page"}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {isRTL ? `صفحة ${page + 1}` : `Page ${page + 1}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {isRTL ? "النتائج المعروضة" : "Shown Results"}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {filteredLogs.length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Search size={16} />
                  {isRTL ? "فلاتر النشاط" : "Activity Filters"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
                    <Input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(0);
                      }}
                      placeholder={
                        isRTL
                          ? "ابحث بالاسم، المستخدم، أو الرقم التعريفي"
                          : "Search by entity, user, or ID"
                      }
                      className={isRTL ? "pr-9" : "pl-9"}
                    />
                  </div>

                  <Select
                    value={actionFilter}
                    onValueChange={(value) => {
                      setActionFilter(value);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="min-w-[170px]">
                      <SelectValue placeholder={isRTL ? "نوع العملية" : "Action Type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {searchableActions.map((action) => (
                        <SelectItem key={action} value={action}>
                          {action === "all"
                            ? isRTL
                              ? "كل العمليات"
                              : "All Actions"
                            : getActionLabel(action, isRTL ? "ar" : "en")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={entityFilter}
                    onValueChange={(value) => {
                      setEntityFilter(value);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="min-w-[170px]">
                      <SelectValue placeholder={isRTL ? "نوع الكيان" : "Entity Type"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRTL ? "كل الكيانات" : "All Entities"}</SelectItem>
                      {Object.entries(entityLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {isRTL ? label.ar : label.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex min-w-[260px] flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[120px]">
                      <CalendarDays className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => {
                          setDateFrom(event.target.value);
                          setPage(0);
                        }}
                        className={isRTL ? "pr-9" : "pl-9"}
                      />
                    </div>
                    <div className="relative flex-1 min-w-[120px]">
                      <CalendarDays className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(event) => {
                          setDateTo(event.target.value);
                          setPage(0);
                        }}
                        className={isRTL ? "pr-9" : "pl-9"}
                      />
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setActionFilter("all");
                      setEntityFilter("all");
                      setDateFrom("");
                      setDateTo("");
                      setPage(0);
                    }}
                  >
                    {isRTL ? "إعادة الضبط" : "Reset"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {filteredLogs.length > 0
                  ? isRTL
                    ? `عرض ${rangeStart}-${rangeEnd} من ${hasMore ? "المزيد من السجلات المتاحة" : "السجلات المتاحة"}`
                    : `Showing ${rangeStart}-${rangeEnd} of ${hasMore ? "available activity" : "available activity"}`
                  : isRTL
                    ? "لا توجد نتائج مطابقة للفلاتر الحالية"
                    : "No results match the current filters"}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isRTL ? "لكل صفحة" : "Per page"}
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="overflow-hidden border-border/60 bg-card/80 shadow-sm">
              <CardContent className="p-0">
                <div className="border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold sm:text-base">
                        {isRTL ? "الخلاصة الزمنية للعمليات" : "Activity Timeline"}
                      </h2>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {isRTL
                          ? "اضغط على أي حدث لفتح لوحة التفاصيل، أو استعرض المعاينة السريعة مباشرة من الخط الزمني."
                          : "Click any event to open the detail panel, or review the smart preview inline."}
                      </p>
                    </div>
                    {isFetching && !isLoading ? (
                      <Badge variant="outline" className="gap-2 rounded-full px-3 py-1 text-xs">
                        <RedoDot size={12} className="animate-spin" />
                        {isRTL ? "جارٍ التحديث" : "Refreshing"}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="px-4 py-5 sm:px-6">
                  {isLoading ? (
                    <div className="space-y-5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index}>{timelineSkeleton()}</div>
                      ))}
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
                      <CircleAlert className="mb-4 text-muted-foreground/60" size={40} />
                      <h3 className="text-lg font-semibold">
                        {isRTL ? "لا توجد عمليات مطابقة" : "No activity found"}
                      </h3>
                      <p className="mt-2 max-w-md text-sm text-muted-foreground">
                        {isRTL
                          ? "جرّب تغيير الفلاتر أو توسيع نطاق التاريخ للحصول على نتائج أكثر."
                          : "Try adjusting the filters or widening the date range to surface more activity."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {groupedLogs.map((group) => (
                        <section key={group.label} className="space-y-4">
                          <div className="sticky top-0 z-10 flex items-center gap-3 bg-card/95 py-1 backdrop-blur supports-[backdrop-filter]:bg-card/75">
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                              {group.label}
                            </Badge>
                            <Separator className="flex-1" />
                          </div>

                          <div className="space-y-4">
                            {group.items.map((log, index) => {
                              const diffRows = buildDiffRows(log);
                              const summaryObject = getSummaryObject(log);
                              const isExpanded = !!expandedItems[log.id];
                              const showRaw = !!showRawMap[log.id];
                              const sentence = getActionSentence(log, isRTL ? "ar" : "en");
                              const actionMeta = actionLabels[log.action] ?? actionLabels.update;
                              const isLast = index === group.items.length - 1;

                              return (
                                <div key={log.id} className="relative flex gap-4">
                                  <div className="relative flex w-14 shrink-0 flex-col items-center">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm ${getAvatarClasses(log.userRole)}`}>
                                      {getInitials(log.userName)}
                                    </div>
                                    <div className={`relative z-10 mt-3 flex h-6 w-6 items-center justify-center rounded-full border border-background text-white shadow-sm ${actionMeta.tone}`}>
                                      {actionMeta.icon}
                                    </div>
                                    {!isLast ? <div className="absolute bottom-[-26px] top-12 w-px bg-border" /> : null}
                                  </div>

                                  <Card
                                    className="group flex-1 cursor-pointer border-border/60 bg-card/70 shadow-sm transition-all duration-200 hover:border-primary/30 hover:bg-card hover:shadow-md"
                                    onClick={() => setDetailsLog(log)}
                                  >
                                    <CardContent className="p-4 sm:p-5">
                                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1 space-y-3">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${actionMeta.color}`}>
                                              {getActionLabel(log.action, isRTL ? "ar" : "en")}
                                            </Badge>
                                            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                                              {getEntityLabel(log.entityType, isRTL ? "ar" : "en")}
                                            </Badge>
                                            {log.userRole ? (
                                              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                                                {log.userRole}
                                              </Badge>
                                            ) : null}
                                          </div>

                                          <div className="text-sm leading-7 text-foreground sm:text-[15px]">
                                            {isRTL ? (
                                              <>
                                                قام <span className="font-semibold">{sentence.userName}</span> {sentence.actionText}{" "}
                                                <span className="font-semibold text-foreground/90">{sentence.entityLabel}</span>{" "}
                                                <span className="font-semibold">{sentence.entityDisplay}</span>
                                              </>
                                            ) : (
                                              <>
                                                <span className="font-semibold">{sentence.userName}</span> {sentence.actionText}{" "}
                                                <span className="font-semibold text-foreground/90">{sentence.entityLabel}</span>{" "}
                                                <span className="font-semibold">{sentence.entityDisplay}</span>
                                              </>
                                            )}
                                          </div>

                                          <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-3 sm:p-4">
                                            {diffRows.length > 0 ? (
                                              <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    {isRTL ? "معاينة التغييرات" : "Change Preview"}
                                                  </p>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 gap-1 px-2 text-xs"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      setExpandedItems((current) => ({ ...current, [log.id]: !current[log.id] }));
                                                    }}
                                                  >
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    {isRTL ? (isExpanded ? "إخفاء" : "إظهار") : isExpanded ? "Hide" : "Show"}
                                                  </Button>
                                                </div>

                                                <div className="grid gap-2">
                                                  {(isExpanded ? diffRows : diffRows.slice(0, 2)).map((row) => (
                                                    <div key={row.key} className="grid gap-2 rounded-xl border border-border/50 bg-background/80 p-3 md:grid-cols-[160px_1fr_24px_1fr] md:items-center">
                                                      <div className="text-xs font-medium text-muted-foreground">
                                                        {humanizeKey(row.key, isRTL ? "ar" : "en")}
                                                      </div>
                                                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300">
                                                        {formatValue(row.previous, isRTL ? "ar" : "en")}
                                                      </div>
                                                      <div className="hidden justify-center text-muted-foreground md:flex">→</div>
                                                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-950/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                                                        {formatValue(row.next, isRTL ? "ar" : "en")}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            ) : summaryObject ? (
                                              <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    {log.action === "create" || log.action === "calendar_event_created"
                                                      ? isRTL
                                                        ? "بيانات العنصر المنشأ"
                                                        : "Created Entity"
                                                      : log.action === "soft_delete" || log.action === "permanent_delete" || log.action === "calendar_event_deleted"
                                                        ? isRTL
                                                          ? "ملخص العنصر المحذوف"
                                                          : "Deleted Entity Summary"
                                                        : isRTL
                                                          ? "ملخص العملية"
                                                          : "Operation Summary"}
                                                  </p>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 gap-1 px-2 text-xs"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      setExpandedItems((current) => ({ ...current, [log.id]: !current[log.id] }));
                                                    }}
                                                  >
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    {isRTL ? (isExpanded ? "إخفاء" : "إظهار") : isExpanded ? "Hide" : "Show"}
                                                  </Button>
                                                </div>
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                  {Object.entries(summaryObject)
                                                    .slice(0, isExpanded ? undefined : 4)
                                                    .map(([key, value]) => (
                                                      <div key={key} className="rounded-xl border border-border/50 bg-background/80 p-3">
                                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                          {humanizeKey(key, isRTL ? "ar" : "en")}
                                                        </p>
                                                        <p className="mt-1 text-sm font-medium leading-6">
                                                          {formatValue(value, isRTL ? "ar" : "en")}
                                                        </p>
                                                      </div>
                                                    ))}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <CircleAlert size={14} />
                                                {isRTL ? "لا توجد معاينة ذكية متاحة لهذا الحدث" : "No smart preview available for this event"}
                                              </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 gap-2 px-3 text-xs"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  setDetailsLog(log);
                                                }}
                                              >
                                                <Eye size={14} />
                                                {isRTL ? "عرض التفاصيل" : "View Details"}
                                              </Button>

                                              {(log.previousValue || log.newValue || log.details) ? (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 gap-2 px-3 text-xs"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    setShowRawMap((current) => ({ ...current, [log.id]: !current[log.id] }));
                                                  }}
                                                >
                                                  <FileJson2 size={14} />
                                                  {isRTL ? "عرض البيانات الخام" : "View Raw Data"}
                                                </Button>
                                              ) : null}
                                            </div>

                                            {showRaw ? (
                                              <div className="rounded-2xl border border-border/50 bg-background p-3">
                                                <ScrollArea className="max-h-56">
                                                  <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
                                                    {JSON.stringify(
                                                      {
                                                        details: parseMaybeJson(log.details),
                                                        previousValue: parseMaybeJson(log.previousValue),
                                                        newValue: parseMaybeJson(log.newValue),
                                                      },
                                                      null,
                                                      2
                                                    )}
                                                  </pre>
                                                </ScrollArea>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>

                                        <div className="flex shrink-0 flex-row items-start justify-between gap-3 lg:w-[160px] lg:flex-col lg:items-end">
                                          <div className="text-xs font-medium text-muted-foreground">
                                            {getTimeLabel(log.createdAt, isRTL ? "ar" : "en")}
                                          </div>

                                          {canUndoLog(log) ? (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-8 gap-2 rounded-full border-primary/20 bg-background/80 px-3 text-xs transition-colors hover:border-primary/30 hover:bg-primary/5"
                                                  disabled={undoMutation.isPending}
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleUndo(log.id);
                                                  }}
                                                >
                                                  <RotateCcw size={14} />
                                                  {isRTL ? "تراجع" : "Undo"}
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                {isRTL ? "العودة إلى القيم السابقة" : "Restore the previous values"}
                                              </TooltipContent>
                                            </Tooltip>
                                          ) : null}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {isRTL ? `صفحة ${page + 1}` : `Page ${page + 1}`}
                </span>
                <span>•</span>
                <span>{isRTL ? `عدد العناصر في هذه الصفحة: ${filteredLogs.length}` : `Items on this page: ${filteredLogs.length}`}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                >
                  {isRTL ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                  {isRTL ? "السابق" : "Previous"}
                </Button>

                <div className="flex items-center gap-1">
                  {pagination.map((item, index) =>
                    item === "ellipsis" ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
                        …
                      </span>
                    ) : (
                      <Button
                        key={item}
                        variant={item === page ? "default" : "outline"}
                        size="sm"
                        className="min-w-9"
                        onClick={() => setPage(item)}
                      >
                        {item + 1}
                      </Button>
                    )
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {isRTL ? "التالي" : "Next"}
                  {isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={!!detailsLog} onOpenChange={(open) => !open && setDetailsLog(null)}>
          <DialogContent
            dir={isRTL ? "rtl" : "ltr"}
            className="h-[90vh] w-[96vw] max-w-4xl overflow-hidden border-border/60 p-0 sm:h-[88vh]"
          >
            {detailsLog ? (
              <div className="flex h-full flex-col bg-background">
                <DialogHeader className="border-b border-border/60 px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2 text-left">
                      <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                        <ClipboardList size={18} />
                        {isRTL ? "تفاصيل العملية" : "Operation Details"}
                      </DialogTitle>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${actionLabels[detailsLog.action]?.color || actionLabels.update.color}`}>
                          {getActionLabel(detailsLog.action, isRTL ? "ar" : "en")}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                          {getEntityLabel(detailsLog.entityType, isRTL ? "ar" : "en")}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getDateTimeLabel(detailsLog.createdAt, isRTL ? "ar" : "en")}
                    </div>
                  </div>
                </DialogHeader>

                <ScrollArea className="flex-1">
                  <div className="space-y-6 px-5 py-5 sm:px-6">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Card className="border-border/60 shadow-none">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {isRTL ? "المستخدم" : "User"}
                          </p>
                          <p className="mt-1 text-sm font-semibold">{detailsLog.userName || (isRTL ? "غير معروف" : "Unknown")}</p>
                          {detailsLog.userRole ? <p className="mt-1 text-xs text-muted-foreground">{detailsLog.userRole}</p> : null}
                        </CardContent>
                      </Card>
                      <Card className="border-border/60 shadow-none">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {isRTL ? "الكيان" : "Entity"}
                          </p>
                          <p className="mt-1 text-sm font-semibold">{getEntityLabel(detailsLog.entityType, isRTL ? "ar" : "en")}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{getEntityDisplay(detailsLog, isRTL ? "ar" : "en")}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-border/60 shadow-none">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {isRTL ? "المعرف" : "Identifier"}
                          </p>
                          <p className="mt-1 text-sm font-semibold">#{detailsLog.entityId ?? detailsLog.id}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-border/60 shadow-none">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {isRTL ? "وقت العملية" : "Operation Time"}
                          </p>
                          <p className="mt-1 text-sm font-semibold">{getTimeLabel(detailsLog.createdAt, isRTL ? "ar" : "en")}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-border/60 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {isRTL ? "الوصف المختصر" : "Narrative Summary"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-7 text-foreground/90">
                          {(() => {
                            const sentence = getActionSentence(detailsLog, isRTL ? "ar" : "en");
                            return isRTL
                              ? `قام ${sentence.userName} ${sentence.actionText} ${sentence.entityLabel} ${sentence.entityDisplay}`
                              : `${sentence.userName} ${sentence.actionText} ${sentence.entityLabel} ${sentence.entityDisplay}`;
                          })()}
                        </p>
                      </CardContent>
                    </Card>

                    {buildDiffRows(detailsLog).length > 0 ? (
                      <Card className="border-border/60 shadow-none">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">
                            {isRTL ? "قبل وبعد" : "Before → After"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {buildDiffRows(detailsLog).map((row) => (
                            <div key={row.key} className="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 lg:grid-cols-[180px_1fr_28px_1fr] lg:items-center">
                              <div className="text-sm font-medium text-muted-foreground">
                                {humanizeKey(row.key, isRTL ? "ar" : "en")}
                              </div>
                              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300">
                                {formatValue(row.previous, isRTL ? "ar" : "en")}
                              </div>
                              <div className="hidden justify-center text-muted-foreground lg:flex">→</div>
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-950/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                                {formatValue(row.next, isRTL ? "ar" : "en")}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ) : getSummaryObject(detailsLog) ? (
                      <Card className="border-border/60 shadow-none">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">
                            {detailsLog.action === "create" || detailsLog.action === "calendar_event_created"
                              ? isRTL
                                ? "تفاصيل العنصر المنشأ"
                                : "Created Entity Details"
                              : detailsLog.action === "soft_delete" || detailsLog.action === "permanent_delete" || detailsLog.action === "calendar_event_deleted"
                                ? isRTL
                                  ? "العنصر المحذوف"
                                  : "Deleted Entity"
                                : isRTL
                                  ? "تفاصيل العملية"
                                  : "Operation Details"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3 md:grid-cols-2">
                            {Object.entries(getSummaryObject(detailsLog) as ObjectLike).map(([key, value]) => (
                              <div key={key} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {humanizeKey(key, isRTL ? "ar" : "en")}
                                </p>
                                <p className="mt-1 text-sm font-medium leading-7">
                                  {formatValue(value, isRTL ? "ar" : "en")}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card className="border-border/60 shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {isRTL ? "البيانات الخام" : "Raw Data"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                          <ScrollArea className="max-h-72">
                            <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
                              {JSON.stringify(
                                {
                                  details: parseMaybeJson(detailsLog.details),
                                  previousValue: parseMaybeJson(detailsLog.previousValue),
                                  newValue: parseMaybeJson(detailsLog.newValue),
                                },
                                null,
                                2
                              )}
                            </pre>
                          </ScrollArea>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>

                {canUndoLog(detailsLog) ? (
                  <div className="border-t border-border/60 px-5 py-4 sm:px-6">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        className="gap-2"
                        disabled={undoMutation.isPending}
                        onClick={() => {
                          handleUndo(detailsLog.id);
                          setDetailsLog(null);
                        }}
                      >
                        <RotateCcw size={16} />
                        {isRTL ? "تراجع عن هذا التغيير" : "Undo this change"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </CRMLayout>
  );
}

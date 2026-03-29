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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import CRMLayout from "@/components/CRMLayout";
import {
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const actionLabels: Record<string, { en: string; ar: string; color: string }> = {
  soft_delete: { en: "Deleted", ar: "حذف", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  restore: { en: "Restored", ar: "استعادة", color: "bg-green-100 text-green-800 border-green-200" },
  permanent_delete: { en: "Permanently Deleted", ar: "حذف نهائي", color: "bg-red-100 text-red-800 border-red-200" },
  undo: { en: "Undone", ar: "تم التراجع", color: "bg-blue-100 text-blue-800 border-blue-200" },
  data_edit: { en: "Edited", ar: "تعديل", color: "bg-purple-100 text-purple-800 border-purple-200" },
  calendar_event_created: { en: "Calendar Created", ar: "إنشاء موعد", color: "bg-green-100 text-green-800 border-green-200" },
  calendar_event_updated: { en: "Calendar Updated", ar: "تعديل موعد", color: "bg-blue-100 text-blue-800 border-blue-200" },
  calendar_event_deleted: { en: "Calendar Deleted", ar: "حذف موعد", color: "bg-red-100 text-red-800 border-red-200" },
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
};

const actionIcons: Record<string, React.ReactNode> = {
  soft_delete: <Trash2 size={14} />,
  restore: <ArchiveRestore size={14} />,
  permanent_delete: <Trash2 size={14} />,
  undo: <Undo2 size={14} />,
  data_edit: <Eye size={14} />,
};

export default function AuditLogPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [detailsLog, setDetailsLog] = useState<any>(null);
  const limit = 50;

  const { data, isLoading, refetch } = trpc.auditLogs.list.useQuery({
    entityType: entityFilter !== "all" ? entityFilter : undefined,
    limit,
    offset: page * limit,
  });

  const undoMutation = trpc.auditLogs.undo.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم التراجع عن العملية بنجاح" : "Change undone successfully");
      refetch();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const handleUndo = (logId: number) => {
    if (!window.confirm(
      lang === "ar"
        ? "هل أنت متأكد من التراجع عن هذه العملية؟ سيتم استعادة القيم السابقة."
        : "Are you sure you want to undo this change? Previous values will be restored."
    )) return;
    undoMutation.mutate({ auditLogId: logId });
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatJsonForDisplay = (obj: any): string => {
    if (!obj) return "-";
    if (typeof obj === "string") {
      try { obj = JSON.parse(obj); } catch { return obj; }
    }
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value === null ? "null" : typeof value === "object" ? JSON.stringify(value) : String(value)}`)
      .join("\n");
  };

  const role = user?.role ?? "";
  if (role !== "Admin" && role !== "admin") {
    return (
      <CRMLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <ShieldAlert className="mx-auto mb-4 text-destructive" size={48} />
              <h2 className="text-lg font-semibold mb-2">
                {lang === "ar" ? "غير مصرح" : "Unauthorized"}
              </h2>
              <p className="text-muted-foreground">
                {lang === "ar"
                  ? "هذه الصفحة متاحة للأدمن فقط"
                  : "This page is only available to admins"}
              </p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList size={24} />
            {lang === "ar" ? "سجل العمليات" : "Audit Log"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {lang === "ar"
              ? "سجل كامل بكل العمليات مع إمكانية التراجع عن أي تغيير"
              : "Complete operations log with the ability to undo any change"}
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {lang === "ar" ? "تصفية حسب النوع:" : "Filter by type:"}
          </span>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {lang === "ar" ? "الكل" : "All"}
              </SelectItem>
              {Object.entries(entityLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {lang === "ar" ? label.ar : label.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {lang === "ar" ? "سجل العمليات" : "Operations Log"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !data || data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="mx-auto mb-3 opacity-30" size={48} />
                <p>{lang === "ar" ? "لا توجد عمليات مسجلة" : "No operations logged"}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{lang === "ar" ? "التاريخ" : "Date"}</TableHead>
                        <TableHead>{lang === "ar" ? "المستخدم" : "User"}</TableHead>
                        <TableHead>{lang === "ar" ? "الدور" : "Role"}</TableHead>
                        <TableHead>{lang === "ar" ? "الإجراء" : "Action"}</TableHead>
                        <TableHead>{lang === "ar" ? "النوع" : "Type"}</TableHead>
                        <TableHead>{lang === "ar" ? "العنصر" : "Item"}</TableHead>
                        <TableHead>{lang === "ar" ? "التفاصيل" : "Details"}</TableHead>
                        <TableHead>{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.userName || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.userRole || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`gap-1 text-xs border ${
                                actionLabels[log.action]?.color || "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {actionIcons[log.action]}
                              {lang === "ar"
                                ? actionLabels[log.action]?.ar || log.action
                                : actionLabels[log.action]?.en || log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {lang === "ar"
                                ? entityLabels[log.entityType]?.ar || log.entityType
                                : entityLabels[log.entityType]?.en || log.entityType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.entityName || `#${log.entityId}`}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            <div className="flex items-center gap-1">
                              <span className="truncate">
                                {log.details ? JSON.stringify(log.details).substring(0, 50) + "..." : "-"}
                              </span>
                              {(log.previousValue || log.newValue || log.details) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => setDetailsLog(log)}
                                  title={lang === "ar" ? "عرض التفاصيل" : "View details"}
                                >
                                  <Eye size={12} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.previousValue && log.action !== "undo" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                onClick={() => handleUndo(log.id)}
                                disabled={undoMutation.isPending}
                                title={lang === "ar" ? "تراجع عن هذا التغيير" : "Undo this change"}
                              >
                                <Undo2 size={12} />
                                {lang === "ar" ? "تراجع" : "Undo"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {lang === "ar"
                      ? `صفحة ${page + 1}`
                      : `Page ${page + 1}`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft size={14} />
                      {lang === "ar" ? "السابق" : "Previous"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!data || data.length < limit}
                      onClick={() => setPage(page + 1)}
                    >
                      {lang === "ar" ? "التالي" : "Next"}
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!detailsLog} onOpenChange={(open) => !open && setDetailsLog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList size={18} />
              {lang === "ar" ? "تفاصيل العملية" : "Operation Details"}
            </DialogTitle>
          </DialogHeader>
          {detailsLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-medium text-muted-foreground">{lang === "ar" ? "المستخدم:" : "User:"}</span>
                  <p>{detailsLog.userName}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">{lang === "ar" ? "التاريخ:" : "Date:"}</span>
                  <p>{formatDate(detailsLog.createdAt)}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">{lang === "ar" ? "الإجراء:" : "Action:"}</span>
                  <p>{detailsLog.action}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">{lang === "ar" ? "النوع:" : "Type:"}</span>
                  <p>{detailsLog.entityType} #{detailsLog.entityId}</p>
                </div>
              </div>

              {detailsLog.details && (
                <div>
                  <h4 className="font-medium text-muted-foreground mb-1">{lang === "ar" ? "التفاصيل:" : "Details:"}</h4>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap" dir="ltr">
                    {JSON.stringify(detailsLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {detailsLog.previousValue && (
                <div>
                  <h4 className="font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <RotateCcw size={14} />
                    {lang === "ar" ? "القيمة السابقة:" : "Previous Value:"}
                  </h4>
                  <pre className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap border border-red-200 dark:border-red-800" dir="ltr">
                    {formatJsonForDisplay(detailsLog.previousValue)}
                  </pre>
                </div>
              )}

              {detailsLog.newValue && (
                <div>
                  <h4 className="font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Eye size={14} />
                    {lang === "ar" ? "القيمة الجديدة:" : "New Value:"}
                  </h4>
                  <pre className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap border border-green-200 dark:border-green-800" dir="ltr">
                    {formatJsonForDisplay(detailsLog.newValue)}
                  </pre>
                </div>
              )}

              {detailsLog.previousValue && detailsLog.action !== "undo" && (
                <div className="pt-2 border-t">
                  <Button
                    className="w-full gap-2"
                    variant="outline"
                    onClick={() => {
                      handleUndo(detailsLog.id);
                      setDetailsLog(null);
                    }}
                    disabled={undoMutation.isPending}
                  >
                    <Undo2 size={16} />
                    {lang === "ar" ? "تراجع عن هذا التغيير" : "Undo this change"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

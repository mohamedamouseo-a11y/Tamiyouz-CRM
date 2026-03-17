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
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import CRMLayout from "@/components/CRMLayout";
import {
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";

const actionLabels: Record<string, { en: string; ar: string; color: string }> = {
  soft_delete: { en: "Deleted", ar: "حذف", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  restore: { en: "Restored", ar: "استعادة", color: "bg-green-100 text-green-800 border-green-200" },
  permanent_delete: { en: "Permanently Deleted", ar: "حذف نهائي", color: "bg-red-100 text-red-800 border-red-200" },
};

const entityLabels: Record<string, { en: string; ar: string }> = {
  leads: { en: "Lead", ar: "عميل محتمل" },
  users: { en: "User", ar: "مستخدم" },
  campaigns: { en: "Campaign", ar: "حملة" },
  activities: { en: "Activity", ar: "نشاط" },
  deals: { en: "Deal", ar: "صفقة" },
  internalNotes: { en: "Internal Note", ar: "ملاحظة داخلية" },
};

const actionIcons: Record<string, React.ReactNode> = {
  soft_delete: <Trash2 size={14} />,
  restore: <ArchiveRestore size={14} />,
  permanent_delete: <Trash2 size={14} />,
};

export default function AuditLogPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = trpc.auditLogs.list.useQuery({
    entityType: entityFilter !== "all" ? entityFilter : undefined,
    limit,
    offset: page * limit,
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
              ? "سجل كامل بكل عمليات الحذف والاستعادة"
              : "Complete log of all delete and restore operations"}
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
                                ? actionLabels[log.action]?.ar
                                : actionLabels[log.action]?.en}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {lang === "ar"
                                ? entityLabels[log.entityType]?.ar
                                : entityLabels[log.entityType]?.en}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.entityName || `#${log.entityId}`}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.details ? JSON.stringify(log.details) : "-"}
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
    </CRMLayout>
  );
}

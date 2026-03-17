import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Download, Upload, Trash2, RefreshCw, Calendar, FileJson, FileText, CheckCircle, AlertCircle } from "lucide-react";

export default function BackupTab() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();

  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [backupStartDate, setBackupStartDate] = useState("");
  const [backupEndDate, setBackupEndDate] = useState("");
  const [backupFormat, setBackupFormat] = useState("json");
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Fetch backup logs
  const { data: backupData, refetch: refetchBackups } = trpc.admin.getBackups.useQuery();

  // Normalize: handle both array and { backups: [...] } formats
  const backups = Array.isArray(backupData) ? backupData : (backupData as any)?.backups ?? [];

  // Create backup mutation
  const createBackup = trpc.admin.createBackup.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم إنشاء النسخة الاحتياطية بنجاح" : "Backup created successfully");
      setShowBackupDialog(false);
      setBackupStartDate("");
      setBackupEndDate("");
      setBackupFormat("json");
      setBackupConfirmed(false);
      refetchBackups();
    },
    onError: (error) => {
      toast.error(error.message || (isRTL ? "فشل إنشاء النسخة الاحتياطية" : "Backup creation failed"));
    },
  });

  // Delete backup mutation
  const deleteBackup = trpc.admin.deleteBackup.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف النسخة الاحتياطية" : "Backup deleted");
      refetchBackups();
    },
    onError: (error) => {
      toast.error(error.message || (isRTL ? "فشل حذف النسخة الاحتياطية" : "Delete failed"));
    },
  });

  const handleCreateBackup = async () => {
    if (!backupStartDate || !backupEndDate) {
      toast.error(isRTL ? "يرجى تحديد تاريخ البداية والنهاية" : "Please select start and end dates");
      return;
    }

    const start = new Date(backupStartDate);
    const end = new Date(backupEndDate);

    if (start > end) {
      toast.error(isRTL ? "تاريخ البداية يجب أن يكون قبل تاريخ النهاية" : "Start date must be before end date");
      return;
    }

    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365 && !backupConfirmed) {
      toast.error(isRTL ? "يرجى تأكيد النسخة الاحتياطية للفترة الطويلة" : "Please confirm backup for date range > 1 year");
      return;
    }

    setIsBackingUp(true);
    createBackup.mutate({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      format: backupFormat as "json" | "csv" | "both",
      confirmed: backupConfirmed,
    });
    setIsBackingUp(false);
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) {
      toast.error(isRTL ? "يرجى اختيار ملف النسخة الاحتياطية" : "Please select a backup file");
      return;
    }

    if (!restoreConfirmed) {
      toast.error(isRTL ? "يرجى تأكيد استعادة البيانات" : "Please confirm data restoration");
      return;
    }

    setIsRestoring(true);
    try {
      // Read the file content
      const fileContent = await restoreFile.text();
      const backupData = JSON.parse(fileContent);

      // Send to restore endpoint
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupData, confirmed: true }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(
          isRTL
            ? `تم استعادة البيانات بنجاح - Leads: ${result.recordsRestored?.leads || 0}, Deals: ${result.recordsRestored?.deals || 0}`
            : `Data restored successfully - Leads: ${result.recordsRestored?.leads || 0}, Deals: ${result.recordsRestored?.deals || 0}`
        );
        setShowRestoreDialog(false);
        setRestoreFile(null);
        setRestoreConfirmed(false);
      } else {
        toast.error(result.error || (isRTL ? "فشلت استعادة البيانات" : "Restore failed"));
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? "فشلت استعادة البيانات" : "Restore failed"));
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDownloadBackup = (fileName: string) => {
    window.location.href = `/admin/backup/download/${fileName}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">{t("success")}</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500">{isRTL ? "جزئي" : "Partial"}</Badge>;
      case "error":
        return <Badge className="bg-red-500">{t("error")}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Backup Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">
            {isRTL ? "النسخ الاحتياطية والاستعادة" : "Backup & Restore"}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              style={{ background: tokens.primaryColor }}
              className="text-white gap-1.5"
              onClick={() => setShowBackupDialog(true)}
            >
              <FileJson size={14} /> {isRTL ? "إنشاء نسخة احتياطية" : "Create Backup"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowRestoreDialog(true)}
            >
              <Upload size={14} /> {isRTL ? "استعادة" : "Restore"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            {isRTL ? "سجل النسخ الاحتياطية" : "Backup History"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!backups || backups.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {isRTL ? "لا توجد نسخ احتياطية حتى الآن" : "No backups yet"}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "الملف" : "File"}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "الصيغة" : "Format"}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "الحالة" : "Status"}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "الحجم" : "Size"}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "التاريخ" : "Date"}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "الإجراءات" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup: any) => (
                  <tr key={backup.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-sm">{backup.fileName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {backup.format}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(backup.status)}</td>
                    <td className="px-4 py-3 text-xs">
                      {(Number(backup.fileSize) / 1024 / 1024).toFixed(2)} MB
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {new Date(backup.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleDownloadBackup(backup.fileName)}
                        title={isRTL ? "تحميل" : "Download"}
                      >
                        <Download size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (window.confirm(isRTL ? "هل أنت متأكد من حذف هذه النسخة الاحتياطية؟" : "Delete this backup?")) {
                            deleteBackup.mutate({ id: backup.id });
                          }
                        }}
                        title={isRTL ? "حذف" : "Delete"}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create Backup Dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "إنشاء نسخة احتياطية" : "Create Backup"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? "تاريخ البداية" : "Start Date"}</Label>
              <Input
                type="date"
                value={backupStartDate}
                onChange={(e) => setBackupStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{isRTL ? "تاريخ النهاية" : "End Date"}</Label>
              <Input
                type="date"
                value={backupEndDate}
                onChange={(e) => setBackupEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{isRTL ? "صيغة الملف" : "File Format"}</Label>
              <Select value={backupFormat} onValueChange={setBackupFormat}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON (Recommended)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="both">Both JSON & CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="confirm"
                checked={backupConfirmed}
                onChange={(e) => setBackupConfirmed(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="confirm" className="text-xs cursor-pointer">
                {isRTL ? "تأكيد إنشاء النسخة الاحتياطية" : "Confirm backup creation"}
              </Label>
            </div>
            <Button
              onClick={handleCreateBackup}
              style={{ background: tokens.primaryColor }}
              className="w-full text-white"
              disabled={isBackingUp || createBackup.isPending}
            >
              {createBackup.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin mr-2" />
                  {isRTL ? "جاري الإنشاء..." : "Creating..."}
                </>
              ) : (
                <>
                  <FileJson size={14} className="mr-2" />
                  {isRTL ? "إنشاء نسخة احتياطية" : "Create Backup"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "استعادة البيانات" : "Restore Data"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-2">
              <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800">
                {isRTL
                  ? "تحذير: استعادة البيانات قد تؤدي إلى إضافة سجلات مكررة. تأكد من أن الملف صحيح."
                  : "Warning: Restoring may add duplicate records. Ensure the file is correct."}
              </p>
            </div>
            <div>
              <Label>{isRTL ? "اختر ملف النسخة الاحتياطية" : "Select Backup File"}</Label>
              <Input
                type="file"
                accept=".json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "ملفات JSON فقط" : "JSON files only"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="restore-confirm"
                checked={restoreConfirmed}
                onChange={(e) => setRestoreConfirmed(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="restore-confirm" className="text-xs cursor-pointer">
                {isRTL ? "أؤكد استعادة البيانات" : "I confirm data restoration"}
              </Label>
            </div>
            <Button
              onClick={handleRestoreBackup}
              style={{ background: tokens.primaryColor }}
              className="w-full text-white"
              disabled={isRestoring || !restoreFile || !restoreConfirmed}
            >
              {isRestoring ? (
                <>
                  <RefreshCw size={14} className="animate-spin mr-2" />
                  {isRTL ? "جاري الاستعادة..." : "Restoring..."}
                </>
              ) : (
                <>
                  <Upload size={14} className="mr-2" />
                  {isRTL ? "استعادة البيانات" : "Restore Data"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

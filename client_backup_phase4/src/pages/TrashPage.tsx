import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertTriangle,
  ArchiveRestore,
  Clock,
  FileText,
  Megaphone,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const entityTypeConfig: Record<string, { en: string; ar: string; icon: React.ReactNode; restoreKey: string }> = {
  leads: { en: "Leads", ar: "العملاء المحتملون", icon: <Users size={16} />, restoreKey: "leads" },
  users: { en: "Users", ar: "المستخدمون", icon: <Users size={16} />, restoreKey: "users" },
  campaigns: { en: "Campaigns", ar: "الحملات", icon: <Megaphone size={16} />, restoreKey: "campaigns" },
  activities: { en: "Activities", ar: "الأنشطة", icon: <Zap size={16} />, restoreKey: "activities" },
  deals: { en: "Deals", ar: "الصفقات", icon: <FileText size={16} />, restoreKey: "deals" },
  notes: { en: "Internal Notes", ar: "الملاحظات الداخلية", icon: <FileText size={16} />, restoreKey: "internalNotes" },
};

interface TrashItem {
  id: number;
  entityType: string;
  restoreEntityType: string;
  name: string;
  deletedByName?: string;
  deletedAt?: string;
}

export default function TrashPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [filter, setFilter] = useState<string>("all");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrashItem | null>(null);
  const [deletePassword, setDeletePassword] = useState("");

  const utils = trpc.useUtils();

  const { data: stats } = trpc.trash.stats.useQuery();
  const { data: rawItems, isLoading: itemsLoading } = trpc.trash.items.useQuery(
    filter !== "all" ? { entityType: filter } : undefined
  );

  // Flatten the items object into a single array with entityType tagged
  const items = useMemo(() => {
    if (!rawItems) return [];
    const flat: TrashItem[] = [];
    const data = rawItems as Record<string, any[]>;
    for (const [key, arr] of Object.entries(data)) {
      if (!Array.isArray(arr)) continue;
      const config = entityTypeConfig[key];
      if (!config) continue;
      for (const item of arr) {
        flat.push({
          id: item.id,
          entityType: key,
          restoreEntityType: config.restoreKey,
          name: item.name || item.title || item.email || item.type || item.notes || `#${item.id}`,
          deletedByName: item.deletedByName,
          deletedAt: item.deletedAt,
        });
      }
    }
    // Sort by deletedAt descending
    flat.sort((a, b) => {
      if (!a.deletedAt || !b.deletedAt) return 0;
      return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
    });
    return flat;
  }, [rawItems]);

  const restoreMutation = trpc.trash.restore.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم الاستعادة بنجاح" : "Restored successfully");
      utils.trash.stats.invalidate();
      utils.trash.items.invalidate();
      setRestoreDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const permanentDeleteMutation = trpc.trash.permanentDelete.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم الحذف النهائي" : "Permanently deleted");
      utils.trash.stats.invalidate();
      utils.trash.items.invalidate();
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      setDeletePassword("");
    },
    onError: (err: any) => {
      toast.error(err.message);
      setDeletePassword("");
    },
  });

  const handleRestore = () => {
    if (!selectedItem) return;
    restoreMutation.mutate({
      entityType: selectedItem.restoreEntityType as any,
      id: selectedItem.id,
    });
  };

  const handlePermanentDelete = () => {
    if (!selectedItem || !deletePassword) return;
    permanentDeleteMutation.mutate({
      entityType: selectedItem.restoreEntityType as any,
      id: selectedItem.id,
      password: deletePassword,
    });
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

  const canPermanentDelete = (deletedAt?: string) => {
    if (!deletedAt) return false;
    const deletedDate = new Date(deletedAt);
    const oneYearLater = new Date(deletedDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    return new Date() >= oneYearLater;
  };

  const daysUntilDeletable = (deletedAt?: string) => {
    if (!deletedAt) return 365;
    const deletedDate = new Date(deletedAt);
    const oneYearLater = new Date(deletedDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const diff = oneYearLater.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
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

  // Build stats entries safely
  const statsEntries = stats
    ? Object.entries(stats as Record<string, number>).filter(([key]) => entityTypeConfig[key])
    : [];

  return (
    <CRMLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trash2 size={24} />
              {lang === "ar" ? "سلة المحذوفات" : "Trash"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {lang === "ar"
                ? "العناصر المحذوفة محفوظة هنا ويمكن استعادتها"
                : "Deleted items are kept here and can be restored"}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statsEntries.map(([key, count]) => {
            const label = entityTypeConfig[key];
            return (
              <Card
                key={key}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  filter === key ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setFilter(filter === key ? "all" : key)}
              >
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-muted-foreground">{label.icon}</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {lang === "ar" ? label.ar : label.en}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">
            {lang === "ar" ? "تصفية حسب النوع:" : "Filter by type:"}
          </Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {lang === "ar" ? "الكل" : "All"}
              </SelectItem>
              {Object.entries(entityTypeConfig).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {lang === "ar" ? label.ar : label.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {lang === "ar" ? "العناصر المحذوفة" : "Deleted Items"}
              <Badge variant="secondary" className="ms-2">
                {items.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trash2 className="mx-auto mb-3 opacity-30" size={48} />
                <p>{lang === "ar" ? "سلة المحذوفات فارغة" : "Trash is empty"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{lang === "ar" ? "النوع" : "Type"}</TableHead>
                      <TableHead>{lang === "ar" ? "الاسم" : "Name"}</TableHead>
                      <TableHead>{lang === "ar" ? "حذف بواسطة" : "Deleted By"}</TableHead>
                      <TableHead>{lang === "ar" ? "تاريخ الحذف" : "Deleted At"}</TableHead>
                      <TableHead>{lang === "ar" ? "الحذف النهائي متاح بعد" : "Permanent Delete Available"}</TableHead>
                      <TableHead>{lang === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const config = entityTypeConfig[item.entityType];
                      return (
                        <TableRow key={`${item.entityType}-${item.id}`}>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {config?.icon}
                              {lang === "ar" ? config?.ar : config?.en}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.deletedByName || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.deletedAt ? formatDate(item.deletedAt) : "-"}
                          </TableCell>
                          <TableCell>
                            {canPermanentDelete(item.deletedAt) ? (
                              <Badge variant="destructive" className="text-xs">
                                {lang === "ar" ? "متاح الآن" : "Available Now"}
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock size={12} />
                                {lang === "ar"
                                  ? `بعد ${daysUntilDeletable(item.deletedAt)} يوم`
                                  : `In ${daysUntilDeletable(item.deletedAt)} days`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setRestoreDialogOpen(true);
                                }}
                              >
                                <ArchiveRestore size={14} />
                                {lang === "ar" ? "استعادة" : "Restore"}
                              </Button>
                              {canPermanentDelete(item.deletedAt) && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 size={14} />
                                  {lang === "ar" ? "حذف نهائي" : "Delete Forever"}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restore Confirmation Dialog */}
        <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw size={20} className="text-green-600" />
                {lang === "ar" ? "تأكيد الاستعادة" : "Confirm Restore"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {lang === "ar"
                  ? `هل أنت متأكد من استعادة "${selectedItem?.name}"؟ سيتم إرجاعه إلى مكانه الأصلي.`
                  : `Are you sure you want to restore "${selectedItem?.name}"? It will be returned to its original location.`}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleRestore}
                  disabled={restoreMutation.isPending}
                >
                  {restoreMutation.isPending
                    ? lang === "ar" ? "جاري الاستعادة..." : "Restoring..."
                    : lang === "ar" ? "استعادة" : "Restore"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Permanent Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeletePassword("");
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={20} />
                {lang === "ar" ? "تحذير: حذف نهائي" : "Warning: Permanent Delete"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive font-medium">
                  {lang === "ar"
                    ? "هذا الإجراء لا يمكن التراجع عنه! سيتم حذف البيانات نهائياً من قاعدة البيانات."
                    : "This action cannot be undone! The data will be permanently removed from the database."}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {lang === "ar"
                  ? `أنت على وشك حذف "${selectedItem?.name}" نهائياً.`
                  : `You are about to permanently delete "${selectedItem?.name}".`}
              </p>
              <div className="space-y-2">
                <Label>
                  {lang === "ar" ? "أدخل كلمة مرور الحذف:" : "Enter deletion password:"}
                </Label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder={lang === "ar" ? "كلمة مرور الحذف النهائي" : "Permanent deletion password"}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeletePassword("");
                }}>
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handlePermanentDelete}
                  disabled={!deletePassword || permanentDeleteMutation.isPending}
                >
                  {permanentDeleteMutation.isPending
                    ? lang === "ar" ? "جاري الحذف..." : "Deleting..."
                    : lang === "ar" ? "حذف نهائي" : "Delete Forever"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </CRMLayout>
  );
}

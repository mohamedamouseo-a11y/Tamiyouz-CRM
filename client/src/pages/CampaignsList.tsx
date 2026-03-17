import CRMLayout from "@/components/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { format, subDays } from "date-fns";
import { BarChart2, Edit2, Eye, Plus, Trash2, Users, Flame, ThermometerSun, Snowflake, ThumbsDown, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import DateRangePicker from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";

const PLATFORMS = ["Meta", "Messages", "LeadForm", "Google", "Snapchat", "TikTok", "Other"] as const;

type CampaignForm = {
  name: string;
  platform: (typeof PLATFORMS)[number];
  startDate: string;
  endDate: string;
  notes: string;
  roundRobinEnabled: boolean;
};

const defaultForm: CampaignForm = {
  name: "",
  platform: "Meta",
  startDate: "",
  endDate: "",
  notes: "",
  roundRobinEnabled: false,
};

// Quality badge component
function QualityPill({ label, count, color, bgColor }: { label: string; count: number; color: string; bgColor: string }) {
  if (count === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color, backgroundColor: bgColor }}
    >
      {label}: {count}
    </span>
  );
}

export default function CampaignsList() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();
  const canManageCampaigns = ["Admin", "admin", "MediaBuyer"].includes(user?.role ?? "");
  const utils = trpc.useUtils();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CampaignForm>(defaultForm);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery();
  const { data: campaignStats } = trpc.campaigns.stats.useQuery({
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
  });

  // Build a map of campaign name -> stats
  const statsMap = new Map<string, { totalLeads: number; hot: number; warm: number; cold: number; bad: number; unknown: number }>();
  if (campaignStats) {
    for (const s of campaignStats) {
      statsMap.set(s.campaignName, s);
    }
  }

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم إضافة الحملة بنجاح" : "Campaign created successfully");
      utils.campaigns.list.invalidate();
      utils.campaigns.stats.invalidate();
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تحديث الحملة" : "Campaign updated");
      utils.campaigns.list.invalidate();
      utils.campaigns.stats.invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف الحملة" : "Campaign deleted");
      utils.campaigns.list.invalidate();
      utils.campaigns.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (camp: NonNullable<typeof campaigns>[number]) => {
    setEditingId(camp.id);
    setForm({
      name: camp.name,
      platform: (PLATFORMS.includes(camp.platform as any) ? camp.platform : "Meta") as (typeof PLATFORMS)[number],
      startDate: camp.startDate ? format(new Date(camp.startDate), "yyyy-MM-dd") : "",
      endDate: camp.endDate ? format(new Date(camp.endDate), "yyyy-MM-dd") : "",
      notes: camp.notes ?? "",
      roundRobinEnabled: camp.roundRobinEnabled ?? false,
    });
    setDialogOpen(true);
  };

  // Clamp a date string to valid MySQL TIMESTAMP range (1970-2037)
  const clampDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    const minDate = new Date("1970-01-01");
    const maxDate = new Date("2037-12-31");
    if (d < minDate) return minDate;
    if (d > maxDate) return maxDate;
    return d;
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error(isRTL ? "اسم الحملة مطلوب" : "Campaign name is required");
      return;
    }
    const payload = {
      name: form.name,
      platform: form.platform,
      startDate: clampDate(form.startDate),
      endDate: clampDate(form.endDate),
      notes: form.notes || undefined,
      roundRobinEnabled: form.roundRobinEnabled,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Compute total stats across all campaigns
  const totalStats = campaignStats
    ? campaignStats.reduce(
        (acc, s) => ({
          totalLeads: acc.totalLeads + s.totalLeads,
          hot: acc.hot + s.hot,
          warm: acc.warm + s.warm,
          cold: acc.cold + s.cold,
          bad: acc.bad + s.bad,
          unknown: acc.unknown + s.unknown,
        }),
        { totalLeads: 0, hot: 0, warm: 0, cold: 0, bad: 0, unknown: 0 }
      )
    : null;

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("campaigns")}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isRTL ? "إدارة الحملات الإعلانية" : "Manage advertising campaigns"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <DateRangePicker date={dateRange} setDate={setDateRange} />
{canManageCampaigns && (
              <Button
                onClick={openCreate}
                style={{ background: tokens.primaryColor }}
                className="text-white gap-2"
              >
                <Plus size={16} /> {t("addCampaign")}
              </Button>
            )}
          </div>
        </div>

        {/* Summary Stats Cards */}
        {totalStats && totalStats.totalLeads > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3 text-center">
                <Users size={18} className="mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalStats.totalLeads}</p>
                <p className="text-[11px] text-blue-600 dark:text-blue-400">{isRTL ? "إجمالي العملاء" : "Total Leads"}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
              <CardContent className="p-3 text-center">
                <Flame size={18} className="mx-auto mb-1 text-red-500" />
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{totalStats.hot}</p>
                <p className="text-[11px] text-red-500">Hot</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
              <CardContent className="p-3 text-center">
                <ThermometerSun size={18} className="mx-auto mb-1 text-orange-500" />
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{totalStats.warm}</p>
                <p className="text-[11px] text-orange-500">Warm</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 border-cyan-200 dark:border-cyan-800">
              <CardContent className="p-3 text-center">
                <Snowflake size={18} className="mx-auto mb-1 text-cyan-500" />
                <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{totalStats.cold}</p>
                <p className="text-[11px] text-cyan-500">Cold</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 border-gray-200 dark:border-gray-700">
              <CardContent className="p-3 text-center">
                <ThumbsDown size={18} className="mx-auto mb-1 text-gray-500" />
                <p className="text-lg font-bold text-gray-600 dark:text-gray-400">{totalStats.bad}</p>
                <p className="text-[11px] text-gray-500">Bad</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900 border-violet-200 dark:border-violet-800">
              <CardContent className="p-3 text-center">
                <HelpCircle size={18} className="mx-auto mb-1 text-violet-500" />
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{totalStats.unknown}</p>
                <p className="text-[11px] text-violet-500">Unknown</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Campaign Cards */}
        <div className="flex flex-col gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                  </CardContent>
                </Card>
              ))
            : (campaigns ?? []).map((camp) => {
                const stats = statsMap.get(camp.name);
                return (
                <Card key={camp.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Campaign Info - Left Section */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <CardTitle className="text-sm font-semibold">{camp.name}</CardTitle>
                          <Badge variant="secondary" className="text-xs">{camp.platform}</Badge>
                          {camp.isActive ? (
                            <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">
                              {isRTL ? "نشط" : "Active"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {isRTL ? "موقف" : "Paused"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {camp.startDate && (
                            <span>{isRTL ? "تاريخ البدء: " : "Start: "}{format(new Date(camp.startDate), "dd/MM/yyyy")}</span>
                          )}
                          {camp.endDate && (
                            <span>{isRTL ? "تاريخ الانتهاء: " : "End: "}{format(new Date(camp.endDate), "dd/MM/yyyy")}</span>
                          )}
                          {camp.roundRobinEnabled && (
                            <span className="text-indigo-600 font-medium">
                              🔄 {isRTL ? "توزيع دوري مفعّل" : "Round-robin enabled"}
                            </span>
                          )}
                        </div>
                        {camp.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{camp.notes}</p>}
                      </div>

                      {/* Campaign Lead Stats - Middle Section */}
                      <div className="flex items-center gap-3 shrink-0">
                        {stats && stats.totalLeads > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1">
                              <Users size={13} />
                              {isRTL ? "العملاء" : "Leads"}
                            </span>
                            <span className="text-sm font-bold" style={{ color: tokens.primaryColor }}>
                              {stats.totalLeads}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              <QualityPill label="Hot" count={stats.hot} color="#dc2626" bgColor="#fef2f2" />
                              <QualityPill label="Warm" count={stats.warm} color="#ea580c" bgColor="#fff7ed" />
                              <QualityPill label="Cold" count={stats.cold} color="#0891b2" bgColor="#ecfeff" />
                              <QualityPill label="Bad" count={stats.bad} color="#6b7280" bgColor="#f3f4f6" />
                              <QualityPill label="?" count={stats.unknown} color="#7c3aed" bgColor="#f5f3ff" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions - Right Section */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/campaigns/${encodeURIComponent(camp.name)}`}>
                          <Button size="sm" className="gap-1.5 text-xs h-7 text-white" style={{ background: tokens.primaryColor }}>
                            <Eye size={12} /> {isRTL ? "تفاصيل الحملة" : "Campaign Details"}
                          </Button>
                        </Link>
                        <Link href={`/leads?campaign=${encodeURIComponent(camp.name)}`}>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                            <BarChart2 size={12} /> {isRTL ? "عرض العملاء" : "View Leads"}
                          </Button>
                        </Link>
                        {canManageCampaigns && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-xs h-7"
                              onClick={() => openEdit(camp)}
                            >
                              <Edit2 size={12} /> {t("edit")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-xs h-7 text-red-500 hover:text-red-600"
                              onClick={() => {
                                if (confirm(isRTL ? "هل تريد حذف هذه الحملة؟" : "Delete this campaign?")) {
                                  deleteMutation.mutate({ id: camp.id });
                                }
                              }}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              })}
        </div>

        {/* Empty State */}
        {!isLoading && (campaigns ?? []).length === 0 && (
          <div className="text-center py-16">
            <BarChart2 size={48} className="mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">{t("noData")}</p>
{canManageCampaigns && (
              <Button
                className="mt-4 gap-2 text-white"
                style={{ background: tokens.primaryColor }}
                onClick={openCreate}
              >
                <Plus size={14} /> {t("addCampaign")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Campaign Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? (isRTL ? "تعديل الحملة" : "Edit Campaign")
                : (isRTL ? "إضافة حملة جديدة" : "Add New Campaign")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>{isRTL ? "اسم الحملة *" : "Campaign Name *"}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={isRTL ? "مثال: حملة رمضان 2025" : "e.g. Ramadan Campaign 2025"}
              />
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <Label>{isRTL ? "المنصة" : "Platform"}</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => setForm((f) => ({ ...f, platform: v as (typeof PLATFORMS)[number] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isRTL ? "تاريخ البدء" : "Start Date"}</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  min="1970-01-01"
                  max="2037-12-31"
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "تاريخ الانتهاء" : "End Date"}</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  min="1970-01-01"
                  max="2037-12-31"
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Round Robin */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{isRTL ? "التوزيع الدوري" : "Round-Robin Assignment"}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "توزيع العملاء تلقائياً على الوكلاء" : "Auto-distribute leads to agents"}
                </p>
              </div>
              <Switch
                checked={form.roundRobinEnabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, roundRobinEnabled: v }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={isRTL ? "ملاحظات اختيارية..." : "Optional notes..."}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className={isRTL ? "flex-row-reverse" : ""}>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              style={{ background: tokens.primaryColor }}
              className="text-white"
            >
              {isSaving
                ? (isRTL ? "جاري الحفظ..." : "Saving...")
                : editingId
                  ? (isRTL ? "حفظ التعديلات" : "Save Changes")
                  : (isRTL ? "إضافة الحملة" : "Add Campaign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

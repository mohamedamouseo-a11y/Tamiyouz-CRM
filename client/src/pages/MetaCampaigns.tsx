import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import CRMLayout from "@/components/CRMLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  RefreshCw,
  Loader2,
  Megaphone,
  AlertTriangle,
  Play,
  Pause,
  Target,
  DollarSign,
  Clock,
  TrendingUp,
  Eye,
  MousePointer,
  BarChart3,
  Pencil,
  Users,
  MessageSquare,
} from "lucide-react";

type DatePreset = "today" | "yesterday" | "last_7d" | "last_14d" | "last_30d" | "this_month" | "last_month";

export default function MetaCampaigns() {
  const { isRTL, t } = useLanguage();
  const utils = trpc.useUtils();
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [editBudget, setEditBudget] = useState<{
    snapshotId: number;
    campaignName: string;
    budgetType: "daily" | "lifetime";
    currentAmount: string;
  } | null>(null);
  const [newBudgetAmount, setNewBudgetAmount] = useState("");

  // ─── Queries ───────────────────────────────────────────────────────────
  const activeAccountQ = trpc.meta.getActiveAdAccount.useQuery();
  const campaignsQ = trpc.meta.getCampaigns.useQuery();
  const adAccountsQ = trpc.meta.getAdAccounts.useQuery();
  const insightsQ = trpc.meta.getInsights.useQuery(
    { datePreset },
    { enabled: !!activeAccountQ.data }
  );

  // ─── Mutations ─────────────────────────────────────────────────────────
  const syncCampaigns = trpc.meta.syncCampaigns.useMutation({
    onSuccess: (data) => {
      toast.success(isRTL ? `تم مزامنة ${data.synced} حملة` : `Synced ${data.synced} campaigns`);
      utils.meta.getCampaigns.invalidate();
      utils.meta.getActiveAdAccount.invalidate();
      utils.meta.getInsights.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const changeCampaignStatus = trpc.meta.changeCampaignStatus.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تحديث حالة الحملة" : "Campaign status updated");
      utils.meta.getCampaigns.invalidate();
      setUpdatingId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setUpdatingId(null);
    },
  });

  const changeBudget = trpc.meta.changeBudget.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تحديث الميزانية بنجاح" : "Budget updated successfully");
      utils.meta.getCampaigns.invalidate();
      setEditBudget(null);
      setNewBudgetAmount("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const selectAdAccount = trpc.meta.selectAdAccount.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تغيير الحساب النشط" : "Active account changed");
      utils.meta.getAdAccounts.invalidate();
      utils.meta.getActiveAdAccount.invalidate();
      utils.meta.getCampaigns.invalidate();
      utils.meta.getInsights.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const activeAccount = activeAccountQ.data;
  const campaigns = campaignsQ.data || [];
  const adAccounts = adAccountsQ.data || [];
  const insights = insightsQ.data || {};

  const handleStatusChange = (snapshotId: number, newStatus: "ACTIVE" | "PAUSED") => {
    setUpdatingId(snapshotId);
    changeCampaignStatus.mutate({ snapshotId, newStatus });
  };

  const handleBudgetSave = () => {
    if (!editBudget || !newBudgetAmount) return;
    const amount = parseFloat(newBudgetAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(isRTL ? "يرجى إدخال مبلغ صحيح" : "Please enter a valid amount");
      return;
    }
    changeBudget.mutate({
      snapshotId: editBudget.snapshotId,
      budgetType: editBudget.budgetType,
      amount,
    });
  };

  const openBudgetEdit = (snapshotId: number, campaignName: string, budgetType: "daily" | "lifetime", currentAmount: string | null) => {
    setEditBudget({ snapshotId, campaignName, budgetType, currentAmount: currentAmount || "0" });
    setNewBudgetAmount(currentAmount && currentAmount !== "0.00" ? currentAmount : "");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-600"><Play size={10} className="mr-1" />{isRTL ? "نشط" : "Active"}</Badge>;
      case "PAUSED":
        return <Badge variant="secondary"><Pause size={10} className="mr-1" />{isRTL ? "متوقف" : "Paused"}</Badge>;
      case "DELETED":
        return <Badge variant="destructive">{isRTL ? "محذوف" : "Deleted"}</Badge>;
      case "ARCHIVED":
        return <Badge variant="outline">{isRTL ? "مؤرشف" : "Archived"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatBudget = (amount: string | null) => {
    if (!amount || amount === "0.00") return "—";
    return `$${parseFloat(amount).toLocaleString()}`;
  };

  const formatNumber = (val: string | number | null | undefined) => {
    if (!val || val === "0") return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "—";
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatCurrency = (val: string | number | null | undefined) => {
    if (!val) return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "—";
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (val: string | number | null | undefined) => {
    if (!val || val === "0") return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "—";
    return `${num.toFixed(2)}%`;
  };

  // ─── Aggregate Metrics ─────────────────────────────────────────────────
  const aggregateMetrics = () => {
    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalLeads = 0, totalMessages = 0;
    Object.values(insights).forEach((i: any) => {
      totalSpend += parseFloat(i.spend || "0");
      totalImpressions += parseInt(i.impressions || "0");
      totalClicks += parseInt(i.clicks || "0");
      totalLeads += parseInt(i.leads || "0");
      totalMessages += parseInt(i.messages || "0");
    });
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    return { totalSpend, totalImpressions, totalClicks, totalLeads, totalMessages, avgCTR, avgCPC, avgCPL, avgCPM };
  };

  const agg = Object.keys(insights).length > 0 ? aggregateMetrics() : null;

  const datePresetOptions: { value: DatePreset; labelAr: string; labelEn: string }[] = [
    { value: "today", labelAr: "اليوم", labelEn: "Today" },
    { value: "yesterday", labelAr: "أمس", labelEn: "Yesterday" },
    { value: "last_7d", labelAr: "آخر 7 أيام", labelEn: "Last 7 Days" },
    { value: "last_14d", labelAr: "آخر 14 يوم", labelEn: "Last 14 Days" },
    { value: "last_30d", labelAr: "آخر 30 يوم", labelEn: "Last 30 Days" },
    { value: "this_month", labelAr: "هذا الشهر", labelEn: "This Month" },
    { value: "last_month", labelAr: "الشهر الماضي", labelEn: "Last Month" },
  ];

  return (
    <CRMLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone size={24} />
              {isRTL ? "حملات Meta" : "Meta Campaigns"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isRTL ? "إدارة ومزامنة حملات Meta الإعلانية" : "Manage and sync your Meta advertising campaigns"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Preset Selector */}
            <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {datePresetOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {isRTL ? opt.labelAr : opt.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Account Selector */}
            {adAccounts.length > 1 && (
              <Select
                value={activeAccount?.id?.toString() || ""}
                onValueChange={(val) => selectAdAccount.mutate({ accountId: parseInt(val) })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={isRTL ? "اختر حساب" : "Select account"} />
                </SelectTrigger>
                <SelectContent>
                  {adAccounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.accountName || acc.adAccountId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={() => syncCampaigns.mutate()}
              disabled={syncCampaigns.isPending || !activeAccount}
            >
              {syncCampaigns.isPending ? (
                <Loader2 size={16} className="animate-spin mr-1" />
              ) : (
                <RefreshCw size={16} className="mr-1" />
              )}
              {isRTL ? "مزامنة" : "Sync"}
            </Button>
          </div>
        </div>

        {/* ─── Active Account Info ────────────────────────────────────── */}
        {activeAccount && (
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isRTL ? "الحساب النشط:" : "Active Account:"}
                  <span className="font-medium text-foreground ml-2">
                    {activeAccount.accountName || activeAccount.adAccountId}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground ml-2">
                    ({activeAccount.adAccountId})
                  </span>
                </span>
                {activeAccount.lastSyncAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={12} />
                    {isRTL ? "آخر مزامنة:" : "Last sync:"} {new Date(activeAccount.lastSyncAt).toLocaleString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Aggregate Metrics Cards ────────────────────────────────── */}
        {activeAccount && agg && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign size={14} />
                  {isRTL ? "إجمالي الإنفاق" : "Total Spend"}
                </div>
                <p className="text-xl font-bold">{formatCurrency(agg.totalSpend)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Eye size={14} />
                  {isRTL ? "مرات الظهور" : "Impressions"}
                </div>
                <p className="text-xl font-bold">{formatNumber(agg.totalImpressions)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <MousePointer size={14} />
                  {isRTL ? "النقرات" : "Clicks"}
                </div>
                <p className="text-xl font-bold">{formatNumber(agg.totalClicks)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  CTR: {formatPercent(agg.avgCTR)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Users size={14} />
                  {isRTL ? "العملاء المحتملين" : "Leads"}
                </div>
                <p className="text-xl font-bold">{formatNumber(agg.totalLeads)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  CPL: {formatCurrency(agg.avgCPL)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <BarChart3 size={14} />
                  {isRTL ? "متوسطات" : "Averages"}
                </div>
                <div className="space-y-1">
                  <p className="text-sm"><span className="text-muted-foreground">CPC:</span> <span className="font-semibold">{formatCurrency(agg.avgCPC)}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">CPM:</span> <span className="font-semibold">{formatCurrency(agg.avgCPM)}</span></p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── No Account Warning ─────────────────────────────────────── */}
        {!activeAccount && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertTriangle size={40} className="mx-auto text-amber-500 mb-3" />
              <h3 className="font-semibold text-lg">
                {isRTL ? "لا يوجد حساب إعلانات نشط" : "No Active Ad Account"}
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                {isRTL
                  ? "يرجى الذهاب إلى الإعدادات > Meta لإضافة وتفعيل حساب إعلانات"
                  : "Please go to Settings > Meta to add and activate an ad account"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ─── Campaigns Table ────────────────────────────────────────── */}
        {activeAccount && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {isRTL ? "الحملات" : "Campaigns"} ({campaigns.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Megaphone size={40} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    {isRTL
                      ? "لا توجد حملات. اضغط مزامنة لجلب الحملات من Meta."
                      : "No campaigns found. Click Sync to fetch campaigns from Meta."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? "اسم الحملة" : "Campaign Name"}</TableHead>
                        <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                        <TableHead>{isRTL ? "الهدف" : "Objective"}</TableHead>
                        <TableHead>{isRTL ? "الميزانية اليومية" : "Daily Budget"}</TableHead>
                        <TableHead>{isRTL ? "الميزانية الإجمالية" : "Lifetime Budget"}</TableHead>
                        <TableHead>{isRTL ? "الإنفاق" : "Spend"}</TableHead>
                        <TableHead>{isRTL ? "مرات الظهور" : "Impr."}</TableHead>
                        <TableHead>{isRTL ? "النقرات" : "Clicks"}</TableHead>
                        <TableHead>CTR</TableHead>
                        <TableHead>CPC</TableHead>
                        <TableHead>CPL</TableHead>
                        <TableHead>ROAS</TableHead>
                        <TableHead>{isRTL ? "العملاء" : "Leads"}</TableHead>
                        <TableHead>{isRTL ? "إجراء" : "Action"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((c: any) => {
                        const ci = insights[c.campaignId] || {};
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {c.campaignName}
                            </TableCell>
                            <TableCell>{getStatusBadge(c.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-xs">
                                <Target size={11} className="text-muted-foreground shrink-0" />
                                {c.objective || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <span>{formatBudget(c.dailyBudget)}</span>
                                {c.dailyBudget && c.dailyBudget !== "0.00" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => openBudgetEdit(c.id, c.campaignName, "daily", c.dailyBudget)}
                                  >
                                    <Pencil size={10} />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <span>{formatBudget(c.lifetimeBudget)}</span>
                                {c.lifetimeBudget && c.lifetimeBudget !== "0.00" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => openBudgetEdit(c.id, c.campaignName, "lifetime", c.lifetimeBudget)}
                                  >
                                    <Pencil size={10} />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {formatCurrency(ci.spend)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatNumber(ci.impressions)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatNumber(ci.clicks)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatPercent(ci.ctr)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatCurrency(ci.cpc)}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {ci.cpl ? formatCurrency(ci.cpl) : (ci.costPerMessage ? formatCurrency(ci.costPerMessage) : "—")}
                            </TableCell>
                            <TableCell className="text-xs">
                              {ci.roas ? (
                                <Badge variant={parseFloat(ci.roas) >= 1 ? "default" : "destructive"} className="text-xs">
                                  {parseFloat(ci.roas).toFixed(2)}x
                                </Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {ci.leads && ci.leads !== "0" ? ci.leads : (ci.messages && ci.messages !== "0" ? `${ci.messages} 💬` : "—")}
                            </TableCell>
                            <TableCell>
                              {(c.status === "ACTIVE" || c.status === "PAUSED") && (
                                <Select
                                  value={c.status}
                                  onValueChange={(val) => handleStatusChange(c.id, val as "ACTIVE" | "PAUSED")}
                                  disabled={updatingId === c.id}
                                >
                                  <SelectTrigger className="w-[110px] h-8 text-xs">
                                    {updatingId === c.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <SelectValue />
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ACTIVE">
                                      <span className="flex items-center gap-1">
                                        <Play size={10} /> {isRTL ? "تشغيل" : "Active"}
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="PAUSED">
                                      <span className="flex items-center gap-1">
                                        <Pause size={10} /> {isRTL ? "إيقاف" : "Paused"}
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
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
        )}

        {/* ─── Loading indicator for insights ─────────────────────────── */}
        {insightsQ.isLoading && activeAccount && campaigns.length > 0 && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 size={16} className="animate-spin" />
            {isRTL ? "جاري تحميل المقاييس..." : "Loading metrics..."}
          </div>
        )}
      </div>

      {/* ─── Edit Budget Dialog ───────────────────────────────────────── */}
      <Dialog open={editBudget !== null} onOpenChange={() => { setEditBudget(null); setNewBudgetAmount(""); }}>
        <DialogContent className="max-w-sm" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {isRTL ? "تعديل الميزانية" : "Edit Budget"}
            </DialogTitle>
          </DialogHeader>
          {editBudget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {editBudget.campaignName}
              </p>
              <div>
                <Label>
                  {editBudget.budgetType === "daily"
                    ? (isRTL ? "الميزانية اليومية ($)" : "Daily Budget ($)")
                    : (isRTL ? "الميزانية الإجمالية ($)" : "Lifetime Budget ($)")}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={newBudgetAmount}
                  onChange={(e) => setNewBudgetAmount(e.target.value)}
                  placeholder={editBudget.currentAmount}
                  className="mt-1"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isRTL ? `الميزانية الحالية: $${editBudget.currentAmount}` : `Current: $${editBudget.currentAmount}`}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditBudget(null); setNewBudgetAmount(""); }}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleBudgetSave} disabled={changeBudget.isPending}>
              {changeBudget.isPending ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <DollarSign size={14} className="mr-1" />
              )}
              {isRTL ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

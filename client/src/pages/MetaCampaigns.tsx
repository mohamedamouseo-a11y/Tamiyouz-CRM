import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import CRMLayout from "@/components/CRMLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  RefreshCw, Loader2, Megaphone, AlertTriangle, Play, Pause, Target, DollarSign,
  Clock, TrendingUp, TrendingDown, Eye, MousePointer, BarChart3, Pencil, Users,
  MessageSquare, Search, Download, Settings2, ChevronUp, ChevronDown, ChevronLeft,
  ChevronRight, ArrowUpRight, ArrowDownRight, X, Filter, Columns3, MoreHorizontal,
  Zap, Activity, PieChart, ExternalLink,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────
type DatePreset = "today" | "yesterday" | "last_7d" | "last_14d" | "last_30d" | "this_month" | "last_month";
type SortField = "name" | "status" | "objective" | "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpl" | "roas" | "leads" | "dailyBudget";
type SortDir = "asc" | "desc";

const VISIBLE_COLUMNS_DEFAULT = ["name", "status", "objective", "dailyBudget", "spend", "impressions", "clicks", "ctr", "cpl", "leads", "action"];

const ALL_COLUMNS: { key: string; labelEn: string; labelAr: string }[] = [
  { key: "name", labelEn: "Campaign", labelAr: "الحملة" },
  { key: "status", labelEn: "Status", labelAr: "الحالة" },
  { key: "objective", labelEn: "Objective", labelAr: "الهدف" },
  { key: "dailyBudget", labelEn: "Daily Budget", labelAr: "الميزانية اليومية" },
  { key: "lifetimeBudget", labelEn: "Lifetime Budget", labelAr: "الميزانية الإجمالية" },
  { key: "spend", labelEn: "Spend", labelAr: "الإنفاق" },
  { key: "impressions", labelEn: "Impressions", labelAr: "مرات الظهور" },
  { key: "clicks", labelEn: "Clicks", labelAr: "النقرات" },
  { key: "ctr", labelEn: "CTR", labelAr: "نسبة النقر" },
  { key: "cpc", labelEn: "CPC", labelAr: "تكلفة النقرة" },
  { key: "cpm", labelEn: "CPM", labelAr: "تكلفة الألف ظهور" },
  { key: "cpl", labelEn: "CPL", labelAr: "تكلفة العميل" },
  { key: "roas", labelEn: "ROAS", labelAr: "العائد" },
  { key: "leads", labelEn: "Leads", labelAr: "العملاء" },
  { key: "messages", labelEn: "Messages", labelAr: "الرسائل" },
  { key: "action", labelEn: "Action", labelAr: "إجراء" },
];

const PAGE_SIZE = 15;

export default function MetaCampaigns() {
  const { isRTL, t } = useLanguage();
  const utils = trpc.useUtils();

  // ─── State ─────────────────────────────────────────────────────────────
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [editBudget, setEditBudget] = useState<{
    snapshotId: number; campaignName: string; budgetType: "daily" | "lifetime"; currentAmount: string;
  } | null>(null);
  const [newBudgetAmount, setNewBudgetAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [objectiveFilter, setObjectiveFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(VISIBLE_COLUMNS_DEFAULT);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    onError: (err) => { toast.error(err.message); setUpdatingId(null); },
  });

  const changeBudget = trpc.meta.changeBudget.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تحديث الميزانية بنجاح" : "Budget updated successfully");
      utils.meta.getCampaigns.invalidate();
      setEditBudget(null);
      setNewBudgetAmount("");
    },
    onError: (err) => toast.error(err.message),
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

  // ─── Derived Data ──────────────────────────────────────────────────────
  const activeAccount = activeAccountQ.data;
  const campaigns = campaignsQ.data || [];
  const adAccounts = adAccountsQ.data || [];
  const insights: Record<string, any> = insightsQ.data || {};

  // ─── Handlers ──────────────────────────────────────────────────────────
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
    changeBudget.mutate({ snapshotId: editBudget.snapshotId, budgetType: editBudget.budgetType, amount });
  };

  const openBudgetEdit = (snapshotId: number, campaignName: string, budgetType: "daily" | "lifetime", currentAmount: string | null) => {
    setEditBudget({ snapshotId, campaignName, budgetType, currentAmount: currentAmount || "0" });
    setNewBudgetAmount(currentAmount && currentAmount !== "0.00" ? currentAmount : "");
  };

  const openDrawer = (campaign: any) => {
    setSelectedCampaign(campaign);
    setDrawerOpen(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  // ─── Format Helpers ────────────────────────────────────────────────────
  const fmt = {
    budget: (amount: string | null) => {
      if (!amount || amount === "0.00") return "—";
      return `${parseFloat(amount).toLocaleString()} ج.م`;
    },
    number: (val: string | number | null | undefined) => {
      if (!val || val === "0") return "—";
      const num = typeof val === "string" ? parseFloat(val) : val;
      if (isNaN(num)) return "—";
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    },
    currency: (val: string | number | null | undefined) => {
      if (!val) return "—";
      const num = typeof val === "string" ? parseFloat(val) : val;
      if (isNaN(num)) return "—";
      return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
    },
    percent: (val: string | number | null | undefined) => {
      if (!val || val === "0") return "—";
      const num = typeof val === "string" ? parseFloat(val) : val;
      if (isNaN(num)) return "—";
      return `${num.toFixed(2)}%`;
    },
    compact: (val: number) => {
      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
      return val.toLocaleString();
    },
  };

  // ─── Aggregate Metrics ─────────────────────────────────────────────────
  const agg = useMemo(() => {
    if (Object.keys(insights).length === 0) return null;
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
  }, [insights]);

  // ─── Filter & Sort & Paginate ──────────────────────────────────────────
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c: any) => c.campaignName?.toLowerCase().includes(q) || c.campaignId?.toLowerCase().includes(q));
    }
    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((c: any) => c.status === statusFilter);
    }
    // Objective filter
    if (objectiveFilter !== "ALL") {
      result = result.filter((c: any) => c.objective === objectiveFilter);
    }
    // Sort
    result.sort((a: any, b: any) => {
      const ci_a = insights[a.campaignId] || {};
      const ci_b = insights[b.campaignId] || {};
      let valA: any, valB: any;
      switch (sortField) {
        case "name": valA = a.campaignName || ""; valB = b.campaignName || ""; break;
        case "status": valA = a.status || ""; valB = b.status || ""; break;
        case "objective": valA = a.objective || ""; valB = b.objective || ""; break;
        case "dailyBudget": valA = parseFloat(a.dailyBudget || "0"); valB = parseFloat(b.dailyBudget || "0"); break;
        case "spend": valA = parseFloat(ci_a.spend || "0"); valB = parseFloat(ci_b.spend || "0"); break;
        case "impressions": valA = parseInt(ci_a.impressions || "0"); valB = parseInt(ci_b.impressions || "0"); break;
        case "clicks": valA = parseInt(ci_a.clicks || "0"); valB = parseInt(ci_b.clicks || "0"); break;
        case "ctr": valA = parseFloat(ci_a.ctr || "0"); valB = parseFloat(ci_b.ctr || "0"); break;
        case "cpc": valA = parseFloat(ci_a.cpc || "0"); valB = parseFloat(ci_b.cpc || "0"); break;
        case "cpl": valA = parseFloat(ci_a.cpl || "0"); valB = parseFloat(ci_b.cpl || "0"); break;
        case "leads": valA = parseInt(ci_a.leads || "0"); valB = parseInt(ci_b.leads || "0"); break;
        default: valA = 0; valB = 0;
      }
      if (typeof valA === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
    return result;
  }, [campaigns, searchQuery, statusFilter, objectiveFilter, sortField, sortDir, insights]);

  const totalPages = Math.ceil(filteredCampaigns.length / PAGE_SIZE);
  const paginatedCampaigns = filteredCampaigns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ─── Unique objectives for filter ──────────────────────────────────────
  const uniqueObjectives = useMemo(() => {
    const objs = new Set<string>();
    campaigns.forEach((c: any) => { if (c.objective) objs.add(c.objective); });
    return Array.from(objs);
  }, [campaigns]);

  // ─── CSV Export ────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Campaign", "Status", "Objective", "Daily Budget", "Lifetime Budget", "Spend", "Impressions", "Clicks", "CTR", "CPC", "CPL", "ROAS", "Leads", "Messages"];
    const rows = filteredCampaigns.map((c: any) => {
      const ci = insights[c.campaignId] || {};
      return [
        c.campaignName, c.status, c.objective || "", c.dailyBudget || "", c.lifetimeBudget || "",
        ci.spend || "", ci.impressions || "", ci.clicks || "", ci.ctr || "", ci.cpc || "",
        ci.cpl || "", ci.roas || "", ci.leads || "", ci.messages || "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `meta-campaigns-${datePreset}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? "تم تصدير البيانات" : "Data exported successfully");
  };

  // ─── Status Badge ──────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />{isRTL ? "نشط" : "Active"}</Badge>;
      case "PAUSED":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200"><Pause size={10} className="mr-1" />{isRTL ? "متوقف" : "Paused"}</Badge>;
      case "DELETED":
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200">{isRTL ? "محذوف" : "Deleted"}</Badge>;
      case "ARCHIVED":
        return <Badge variant="outline" className="text-slate-500">{isRTL ? "مؤرشف" : "Archived"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ─── Date Preset Options ───────────────────────────────────────────────
  const datePresetOptions: { value: DatePreset; labelAr: string; labelEn: string }[] = [
    { value: "today", labelAr: "اليوم", labelEn: "Today" },
    { value: "yesterday", labelAr: "أمس", labelEn: "Yesterday" },
    { value: "last_7d", labelAr: "آخر 7 أيام", labelEn: "Last 7 Days" },
    { value: "last_14d", labelAr: "آخر 14 يوم", labelEn: "Last 14 Days" },
    { value: "last_30d", labelAr: "آخر 30 يوم", labelEn: "Last 30 Days" },
    { value: "this_month", labelAr: "هذا الشهر", labelEn: "This Month" },
    { value: "last_month", labelAr: "الشهر الماضي", labelEn: "Last Month" },
  ];

  // ─── Sortable Header ──────────────────────────────────────────────────
  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDir === "asc" ? <ChevronUp size={14} className="text-primary" /> : <ChevronDown size={14} className="text-primary" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground/30" />
        )}
      </span>
    </TableHead>
  );

  // ─── KPI Card Component ────────────────────────────────────────────────
  const KPICard = ({ icon: Icon, title, value, subtitle, color, iconBg }: {
    icon: any; title: string; value: string; subtitle?: string; color: string; iconBg: string;
  }) => (
    <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-[0.03]`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${iconBg}`}>
            <Icon size={20} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // ─── RENDER ────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <CRMLayout>
      <div className="space-y-5 p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>

        {/* ═══ Hero Header ═══════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-6 text-white shadow-xl">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                <Megaphone size={14} />
                Meta Campaigns Dashboard
              </div>
              <h1 className="text-2xl font-bold">
                {isRTL ? "إدارة حملات Meta الإعلانية" : "Manage Meta Ad Campaigns"}
              </h1>
              <p className="mt-1.5 text-sm text-blue-100 max-w-2xl">
                {isRTL
                  ? "تتبع الإنفاق والعملاء المحتملين وعائد الإنفاق. تحكم في حالة الحملات والميزانيات مباشرة."
                  : "Track spend, leads, CPL & ROAS. Control campaign status and budgets with live API sync."}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Preset */}
              <Select value={datePreset} onValueChange={(v) => { setDatePreset(v as DatePreset); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors">
                  <Clock size={14} className="mr-1.5" />
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
                  <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors">
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
              {/* Sync Button */}
              <Button
                onClick={() => syncCampaigns.mutate()}
                disabled={syncCampaigns.isPending || !activeAccount}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                variant="outline"
              >
                {syncCampaigns.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-1.5" />
                ) : (
                  <RefreshCw size={16} className="mr-1.5" />
                )}
                {isRTL ? "مزامنة" : "Sync"}
              </Button>
            </div>
          </div>
          {/* Active Account Info */}
          {activeAccount && (
            <div className="mt-4 flex items-center gap-3 text-xs text-blue-200">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {activeAccount.accountName || activeAccount.adAccountId}
              </span>
              {activeAccount.lastSyncAt && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {isRTL ? "آخر مزامنة:" : "Last sync:"} {new Date(activeAccount.lastSyncAt).toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ═══ KPI Cards ═════════════════════════════════════════════════ */}
        {activeAccount && agg && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              icon={DollarSign}
              title={isRTL ? "إجمالي الإنفاق" : "Total Spend"}
              value={fmt.currency(agg.totalSpend)}
              iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
              color="from-blue-500 to-blue-600"
            />
            <KPICard
              icon={Users}
              title={isRTL ? "العملاء المحتملين" : "Total Leads"}
              value={fmt.compact(agg.totalLeads)}
              subtitle={`CPL: ${fmt.currency(agg.avgCPL)}`}
              iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
              color="from-emerald-500 to-emerald-600"
            />
            <KPICard
              icon={MousePointer}
              title={isRTL ? "النقرات" : "Total Clicks"}
              value={fmt.compact(agg.totalClicks)}
              subtitle={`CTR: ${fmt.percent(agg.avgCTR)}`}
              iconBg="bg-gradient-to-br from-violet-500 to-violet-600"
              color="from-violet-500 to-violet-600"
            />
            <KPICard
              icon={Eye}
              title={isRTL ? "مرات الظهور" : "Impressions"}
              value={fmt.compact(agg.totalImpressions)}
              subtitle={`CPM: ${fmt.currency(agg.avgCPM)}`}
              iconBg="bg-gradient-to-br from-amber-500 to-amber-600"
              color="from-amber-500 to-amber-600"
            />
            <KPICard
              icon={MessageSquare}
              title={isRTL ? "الرسائل" : "Messages"}
              value={fmt.compact(agg.totalMessages)}
              subtitle={`CPC: ${fmt.currency(agg.avgCPC)}`}
              iconBg="bg-gradient-to-br from-rose-500 to-rose-600"
              color="from-rose-500 to-rose-600"
            />
          </div>
        )}

        {/* ═══ No Account Warning ════════════════════════════════════════ */}
        {!activeAccount && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="py-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle size={28} className="text-amber-600" />
              </div>
              <h3 className="font-semibold text-lg">
                {isRTL ? "لا يوجد حساب إعلانات نشط" : "No Active Ad Account"}
              </h3>
              <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
                {isRTL
                  ? "يرجى الذهاب إلى الإعدادات > Meta لإضافة وتفعيل حساب إعلانات"
                  : "Please go to Settings > Meta to add and activate an ad account"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ═══ Filter Bar ════════════════════════════════════════════════ */}
        {activeAccount && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={isRTL ? "بحث باسم الحملة..." : "Search campaigns..."}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9 h-10 bg-muted/30 border-0 focus-visible:ring-1"
                    dir="ltr"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[140px] h-10 bg-muted/30 border-0">
                    <Filter size={14} className="mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{isRTL ? "كل الحالات" : "All Status"}</SelectItem>
                    <SelectItem value="ACTIVE">{isRTL ? "نشط" : "Active"}</SelectItem>
                    <SelectItem value="PAUSED">{isRTL ? "متوقف" : "Paused"}</SelectItem>
                    <SelectItem value="DELETED">{isRTL ? "محذوف" : "Deleted"}</SelectItem>
                    <SelectItem value="ARCHIVED">{isRTL ? "مؤرشف" : "Archived"}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Objective Filter */}
                <Select value={objectiveFilter} onValueChange={(v) => { setObjectiveFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[160px] h-10 bg-muted/30 border-0">
                    <Target size={14} className="mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{isRTL ? "كل الأهداف" : "All Objectives"}</SelectItem>
                    {uniqueObjectives.map(obj => (
                      <SelectItem key={obj} value={obj}>{obj}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Separator orientation="vertical" className="h-8 hidden lg:block" />

                {/* Column Visibility */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 bg-muted/30 border-0">
                      <Columns3 size={14} className="mr-1.5" />
                      {isRTL ? "الأعمدة" : "Columns"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{isRTL ? "الأعمدة المرئية" : "Visible Columns"}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ALL_COLUMNS.filter(c => c.key !== "action").map(col => (
                      <DropdownMenuCheckboxItem
                        key={col.key}
                        checked={visibleColumns.includes(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      >
                        {isRTL ? col.labelAr : col.labelEn}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Export CSV */}
                <Button variant="outline" size="sm" className="h-10 bg-muted/30 border-0" onClick={exportCSV}>
                  <Download size={14} className="mr-1.5" />
                  {isRTL ? "تصدير" : "Export"}
                </Button>
              </div>

              {/* Active Filters Count */}
              {(searchQuery || statusFilter !== "ALL" || objectiveFilter !== "ALL") && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Filter size={12} />
                  {isRTL ? `عرض ${filteredCampaigns.length} من ${campaigns.length} حملة` : `Showing ${filteredCampaigns.length} of ${campaigns.length} campaigns`}
                  <button
                    onClick={() => { setSearchQuery(""); setStatusFilter("ALL"); setObjectiveFilter("ALL"); setCurrentPage(1); }}
                    className="text-primary hover:underline ml-2"
                  >
                    {isRTL ? "مسح الفلاتر" : "Clear filters"}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ Campaigns Table ════════════════════════════════════════════ */}
        {activeAccount && (
          <Card className="border-0 shadow-md overflow-hidden">
            <CardHeader className="pb-0 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity size={18} className="text-primary" />
                  {isRTL ? "الحملات" : "Campaigns"}
                  <Badge variant="secondary" className="text-xs ml-1">{filteredCampaigns.length}</Badge>
                </CardTitle>
                {insightsQ.isLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    {isRTL ? "تحميل المقاييس..." : "Loading metrics..."}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              {campaigns.length === 0 ? (
                <div className="text-center py-16">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Megaphone size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">
                    {isRTL ? "لا توجد حملات" : "No campaigns found"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRTL ? "اضغط مزامنة لجلب الحملات من Meta" : "Click Sync to fetch campaigns from Meta"}
                  </p>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Search size={28} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">{isRTL ? "لا توجد نتائج مطابقة" : "No matching campaigns"}</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          {visibleColumns.includes("name") && <SortableHeader field="name">{isRTL ? "الحملة" : "Campaign"}</SortableHeader>}
                          {visibleColumns.includes("status") && <SortableHeader field="status">{isRTL ? "الحالة" : "Status"}</SortableHeader>}
                          {visibleColumns.includes("objective") && <SortableHeader field="objective">{isRTL ? "الهدف" : "Objective"}</SortableHeader>}
                          {visibleColumns.includes("dailyBudget") && <SortableHeader field="dailyBudget">{isRTL ? "يومي" : "Daily"}</SortableHeader>}
                          {visibleColumns.includes("lifetimeBudget") && <TableHead className="whitespace-nowrap">{isRTL ? "إجمالي" : "Lifetime"}</TableHead>}
                          {visibleColumns.includes("spend") && <SortableHeader field="spend">{isRTL ? "الإنفاق" : "Spend"}</SortableHeader>}
                          {visibleColumns.includes("impressions") && <SortableHeader field="impressions">{isRTL ? "الظهور" : "Impr."}</SortableHeader>}
                          {visibleColumns.includes("clicks") && <SortableHeader field="clicks">{isRTL ? "النقرات" : "Clicks"}</SortableHeader>}
                          {visibleColumns.includes("ctr") && <SortableHeader field="ctr">CTR</SortableHeader>}
                          {visibleColumns.includes("cpc") && <SortableHeader field="cpc">CPC</SortableHeader>}
                          {visibleColumns.includes("cpm") && <TableHead>CPM</TableHead>}
                          {visibleColumns.includes("cpl") && <SortableHeader field="cpl">CPL</SortableHeader>}
                          {visibleColumns.includes("roas") && <TableHead>ROAS</TableHead>}
                          {visibleColumns.includes("leads") && <SortableHeader field="leads">{isRTL ? "العملاء" : "Leads"}</SortableHeader>}
                          {visibleColumns.includes("messages") && <TableHead>{isRTL ? "رسائل" : "Msgs"}</TableHead>}
                          {visibleColumns.includes("action") && <TableHead className="text-center">{isRTL ? "إجراءات" : "Actions"}</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedCampaigns.map((c: any) => {
                          const ci = insights[c.campaignId] || {};
                          return (
                            <TableRow
                              key={c.id}
                              className="cursor-pointer hover:bg-primary/5 transition-colors group"
                              onClick={() => openDrawer(c)}
                            >
                              {visibleColumns.includes("name") && (
                                <TableCell className="font-medium max-w-[220px]">
                                  <div className="truncate">{c.campaignName}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">{c.campaignId}</div>
                                </TableCell>
                              )}
                              {visibleColumns.includes("status") && (
                                <TableCell>{getStatusBadge(c.status)}</TableCell>
                              )}
                              {visibleColumns.includes("objective") && (
                                <TableCell>
                                  <Badge variant="outline" className="text-xs font-normal">
                                    <Target size={10} className="mr-1" />
                                    {c.objective || "—"}
                                  </Badge>
                                </TableCell>
                              )}
                              {visibleColumns.includes("dailyBudget") && (
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm">
                                    <span className="font-medium">{fmt.budget(c.dailyBudget)}</span>
                                    {c.dailyBudget && c.dailyBudget !== "0.00" && (
                                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); openBudgetEdit(c.id, c.campaignName, "daily", c.dailyBudget); }}>
                                        <Pencil size={10} />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.includes("lifetimeBudget") && (
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm">
                                    <span>{fmt.budget(c.lifetimeBudget)}</span>
                                    {c.lifetimeBudget && c.lifetimeBudget !== "0.00" && (
                                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); openBudgetEdit(c.id, c.campaignName, "lifetime", c.lifetimeBudget); }}>
                                        <Pencil size={10} />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              )}
                              {visibleColumns.includes("spend") && (
                                <TableCell className="text-sm font-semibold">{fmt.currency(ci.spend)}</TableCell>
                              )}
                              {visibleColumns.includes("impressions") && (
                                <TableCell className="text-sm">{fmt.number(ci.impressions)}</TableCell>
                              )}
                              {visibleColumns.includes("clicks") && (
                                <TableCell className="text-sm">{fmt.number(ci.clicks)}</TableCell>
                              )}
                              {visibleColumns.includes("ctr") && (
                                <TableCell className="text-sm">{fmt.percent(ci.ctr)}</TableCell>
                              )}
                              {visibleColumns.includes("cpc") && (
                                <TableCell className="text-sm">{fmt.currency(ci.cpc)}</TableCell>
                              )}
                              {visibleColumns.includes("cpm") && (
                                <TableCell className="text-sm">{fmt.currency(ci.cpm)}</TableCell>
                              )}
                              {visibleColumns.includes("cpl") && (
                                <TableCell className="text-sm font-semibold">
                                  {ci.cpl ? fmt.currency(ci.cpl) : (ci.costPerMessage ? fmt.currency(ci.costPerMessage) : "—")}
                                </TableCell>
                              )}
                              {visibleColumns.includes("roas") && (
                                <TableCell>
                                  {ci.roas ? (
                                    <Badge variant={parseFloat(ci.roas) >= 1 ? "default" : "destructive"} className="text-xs">
                                      {parseFloat(ci.roas).toFixed(2)}x
                                    </Badge>
                                  ) : "—"}
                                </TableCell>
                              )}
                              {visibleColumns.includes("leads") && (
                                <TableCell className="text-sm font-semibold text-emerald-600">
                                  {ci.leads && ci.leads !== "0" ? ci.leads : "—"}
                                </TableCell>
                              )}
                              {visibleColumns.includes("messages") && (
                                <TableCell className="text-sm">
                                  {ci.messages && ci.messages !== "0" ? ci.messages : "—"}
                                </TableCell>
                              )}
                              {visibleColumns.includes("action") && (
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal size={16} />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openDrawer(c)}>
                                        <Eye size={14} className="mr-2" />
                                        {isRTL ? "عرض التفاصيل" : "View Details"}
                                      </DropdownMenuItem>
                                      {c.dailyBudget && c.dailyBudget !== "0.00" && (
                                        <DropdownMenuItem onClick={() => openBudgetEdit(c.id, c.campaignName, "daily", c.dailyBudget)}>
                                          <Pencil size={14} className="mr-2" />
                                          {isRTL ? "تعديل الميزانية اليومية" : "Edit Daily Budget"}
                                        </DropdownMenuItem>
                                      )}
                                      {c.lifetimeBudget && c.lifetimeBudget !== "0.00" && (
                                        <DropdownMenuItem onClick={() => openBudgetEdit(c.id, c.campaignName, "lifetime", c.lifetimeBudget)}>
                                          <Pencil size={14} className="mr-2" />
                                          {isRTL ? "تعديل الميزانية الإجمالية" : "Edit Lifetime Budget"}
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      {(c.status === "ACTIVE" || c.status === "PAUSED") && (
                                        <DropdownMenuItem
                                          onClick={() => handleStatusChange(c.id, c.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
                                          disabled={updatingId === c.id}
                                        >
                                          {c.status === "ACTIVE" ? (
                                            <><Pause size={14} className="mr-2" />{isRTL ? "إيقاف الحملة" : "Pause Campaign"}</>
                                          ) : (
                                            <><Play size={14} className="mr-2" />{isRTL ? "تشغيل الحملة" : "Activate Campaign"}</>
                                          )}
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* ─── Pagination ──────────────────────────────────────── */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/20">
                      <p className="text-xs text-muted-foreground">
                        {isRTL
                          ? `صفحة ${currentPage} من ${totalPages}`
                          : `Page ${currentPage} of ${totalPages}`}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline" size="icon" className="h-8 w-8"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => p - 1)}
                        >
                          <ChevronLeft size={14} />
                        </Button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let page: number;
                          if (totalPages <= 5) { page = i + 1; }
                          else if (currentPage <= 3) { page = i + 1; }
                          else if (currentPage >= totalPages - 2) { page = totalPages - 4 + i; }
                          else { page = currentPage - 2 + i; }
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8 text-xs"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline" size="icon" className="h-8 w-8"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => p + 1)}
                        >
                          <ChevronRight size={14} />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ Campaign Details Drawer ════════════════════════════════════ */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side={isRTL ? "left" : "right"}>
            {selectedCampaign && (() => {
              const ci = insights[selectedCampaign.campaignId] || {};
              return (
                <>
                  <SheetHeader className="pb-4">
                    <SheetTitle className="text-lg">
                      {selectedCampaign.campaignName}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(selectedCampaign.status)}
                      <Badge variant="outline" className="text-xs">
                        <Target size={10} className="mr-1" />
                        {selectedCampaign.objective || "—"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ID: {selectedCampaign.campaignId}
                    </p>
                  </SheetHeader>

                  <Separator className="my-4" />

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mb-6">
                    {(selectedCampaign.status === "ACTIVE" || selectedCampaign.status === "PAUSED") && (
                      <Button
                        size="sm"
                        variant={selectedCampaign.status === "ACTIVE" ? "destructive" : "default"}
                        onClick={() => handleStatusChange(selectedCampaign.id, selectedCampaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
                        disabled={updatingId === selectedCampaign.id}
                      >
                        {updatingId === selectedCampaign.id ? (
                          <Loader2 size={14} className="animate-spin mr-1" />
                        ) : selectedCampaign.status === "ACTIVE" ? (
                          <Pause size={14} className="mr-1" />
                        ) : (
                          <Play size={14} className="mr-1" />
                        )}
                        {selectedCampaign.status === "ACTIVE"
                          ? (isRTL ? "إيقاف" : "Pause")
                          : (isRTL ? "تشغيل" : "Activate")}
                      </Button>
                    )}
                    {selectedCampaign.dailyBudget && selectedCampaign.dailyBudget !== "0.00" && (
                      <Button size="sm" variant="outline"
                        onClick={() => openBudgetEdit(selectedCampaign.id, selectedCampaign.campaignName, "daily", selectedCampaign.dailyBudget)}>
                        <DollarSign size={14} className="mr-1" />
                        {isRTL ? "تعديل الميزانية" : "Edit Budget"}
                      </Button>
                    )}
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <Card className="border bg-blue-50/50">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isRTL ? "الإنفاق" : "Spend"}</p>
                        <p className="text-lg font-bold mt-1">{fmt.currency(ci.spend)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border bg-emerald-50/50">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isRTL ? "العملاء" : "Leads"}</p>
                        <p className="text-lg font-bold mt-1 text-emerald-600">{ci.leads && ci.leads !== "0" ? ci.leads : (ci.messages && ci.messages !== "0" ? `${ci.messages} msg` : "—")}</p>
                      </CardContent>
                    </Card>
                    <Card className="border bg-violet-50/50">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CPL</p>
                        <p className="text-lg font-bold mt-1">{ci.cpl ? fmt.currency(ci.cpl) : (ci.costPerMessage ? fmt.currency(ci.costPerMessage) : "—")}</p>
                      </CardContent>
                    </Card>
                    <Card className="border bg-amber-50/50">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ROAS</p>
                        <p className="text-lg font-bold mt-1">{ci.roas ? `${parseFloat(ci.roas).toFixed(2)}x` : "—"}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Detailed Metrics */}
                  <Card className="mb-6">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 size={16} />
                        {isRTL ? "المقاييس التفصيلية" : "Detailed Metrics"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="space-y-3">
                        {[
                          { label: isRTL ? "مرات الظهور" : "Impressions", value: fmt.number(ci.impressions), icon: Eye },
                          { label: isRTL ? "النقرات" : "Clicks", value: fmt.number(ci.clicks), icon: MousePointer },
                          { label: "CTR", value: fmt.percent(ci.ctr), icon: TrendingUp },
                          { label: "CPC", value: fmt.currency(ci.cpc), icon: DollarSign },
                          { label: "CPM", value: fmt.currency(ci.cpm), icon: BarChart3 },
                          { label: isRTL ? "الميزانية اليومية" : "Daily Budget", value: fmt.budget(selectedCampaign.dailyBudget), icon: Zap },
                          { label: isRTL ? "الميزانية الإجمالية" : "Lifetime Budget", value: fmt.budget(selectedCampaign.lifetimeBudget), icon: DollarSign },
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 border-b border-dashed last:border-0">
                            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                              <item.icon size={14} />
                              {item.label}
                            </span>
                            <span className="text-sm font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Campaign Info */}
                  <Card>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Megaphone size={16} />
                        {isRTL ? "معلومات الحملة" : "Campaign Info"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="space-y-3">
                        {[
                          { label: isRTL ? "معرف الحملة" : "Campaign ID", value: selectedCampaign.campaignId },
                          { label: isRTL ? "الحالة" : "Status", value: selectedCampaign.status },
                          { label: isRTL ? "الهدف" : "Objective", value: selectedCampaign.objective || "—" },
                          { label: isRTL ? "تاريخ الإنشاء" : "Created", value: selectedCampaign.createdAt ? new Date(selectedCampaign.createdAt).toLocaleDateString() : "—" },
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 border-b border-dashed last:border-0">
                            <span className="text-sm text-muted-foreground">{item.label}</span>
                            <span className="text-sm font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        {/* ═══ Edit Budget Dialog ════════════════════════════════════════ */}
        <Dialog open={editBudget !== null} onOpenChange={() => { setEditBudget(null); setNewBudgetAmount(""); }}>
          <DialogContent className="max-w-sm" dir={isRTL ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign size={18} />
                {isRTL ? "تعديل الميزانية" : "Edit Budget"}
              </DialogTitle>
            </DialogHeader>
            {editBudget && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{editBudget.campaignName}</p>
                <div>
                  <Label>
                    {editBudget.budgetType === "daily"
                      ? (isRTL ? "الميزانية اليومية (ج.م)" : "Daily Budget (EGP)")
                      : (isRTL ? "الميزانية الإجمالية (ج.م)" : "Lifetime Budget (EGP)")}
                  </Label>
                  <Input
                    type="number" step="0.01" min="1"
                    value={newBudgetAmount}
                    onChange={(e) => setNewBudgetAmount(e.target.value)}
                    placeholder={editBudget.currentAmount}
                    className="mt-1" dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRTL ? `الميزانية الحالية: ${editBudget.currentAmount} ج.م` : `Current: ${editBudget.currentAmount} EGP`}
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

      </div>
    </CRMLayout>
  );
}

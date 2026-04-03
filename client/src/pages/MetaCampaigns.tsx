import React, { useState, useMemo } from "react";
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
  Zap, Activity, PieChart, ExternalLink, Flame, ThermometerSun, Snowflake, XCircle,
  CheckCircle, UserCheck, UserX, Briefcase, Award, Star,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────
type DatePreset = "today" | "yesterday" | "last_7d" | "last_14d" | "last_30d" | "last_90d" | "last_year" | "maximum" | "this_month" | "last_month" | "custom";
type SortField = "name" | "status" | "objective" | "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpl" | "roas" | "leads" | "dailyBudget" | "crmLeads" | "hotLeads" | "qualityPercent";
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

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];

export default function MetaCampaigns() {
  const { isRTL, t } = useLanguage();
  const utils = trpc.useUtils();

  // ─── State ─────────────────────────────────────────────────────────────
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("maximum");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [showCustomDate, setShowCustomDate] = useState(false);
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
  const [pageSize, setPageSize] = useState(10);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedCrm, setExpandedCrm] = useState<Record<string, boolean>>({});
  const [showCrmRow, setShowCrmRow] = useState(true);

  // ─── Queries ───────────────────────────────────────────────────────────
  const activeAccountQ = trpc.meta.getActiveAdAccount.useQuery();
  const campaignsQ = trpc.meta.getCampaigns.useQuery();
  const adAccountsQ = trpc.meta.getAdAccounts.useQuery();
  const insightsQ = trpc.meta.getInsights.useQuery(
    {
      datePreset: datePreset === "custom" ? "maximum" : datePreset,
      ...(datePreset === "custom" && customDateFrom && customDateTo ? { dateFrom: customDateFrom, dateTo: customDateTo } : {}),
    },
    { enabled: !!activeAccountQ.data }
  );

  // ─── CRM Stats Query ──────────────────────────────────────────────────
  const crmStatsQ = trpc.meta.getCrmStatsByCampaign.useQuery(
    {
      ...(datePreset === "custom" && customDateFrom && customDateTo ? { dateFrom: customDateFrom, dateTo: customDateTo } : {}),
    },
    { enabled: !!activeAccountQ.data }
  );

  // ─── Mutations ─────────────────────────────────────────────────────────
  const syncCampaigns = trpc.meta.syncCampaigns.useMutation({
    onSuccess: (data) => {
      toast.success(isRTL ? `تم مزامنة ${data.synced} حملة` : `Synced ${data.synced} campaigns`);
      utils.meta.getCampaigns.invalidate();
      utils.meta.getActiveAdAccount.invalidate();
      utils.meta.getInsights.invalidate();
      utils.meta.getCrmStatsByCampaign.invalidate();
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
      utils.meta.getCrmStatsByCampaign.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Derived Data ──────────────────────────────────────────────────────
  const activeAccount = activeAccountQ.data;
  const campaigns = campaignsQ.data || [];
  const adAccounts = adAccountsQ.data || [];
  const insights: Record<string, any> = insightsQ.data || {};
  const crmStats: any[] = crmStatsQ.data || [];

  // Build CRM stats lookup by campaign name (case-insensitive)
  const crmLookup = useMemo(() => {
    const map: Record<string, any> = {};
    for (const stat of crmStats) {
      if (stat.campaignName) {
        map[stat.campaignName.toLowerCase()] = stat;
      }
    }
    return map;
  }, [crmStats]);

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

  const toggleCrmExpand = (campaignId: string) => {
    setExpandedCrm(prev => ({ ...prev, [campaignId]: !prev[campaignId] }));
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
    currencySar: (val: number | null | undefined) => {
      if (!val) return "—";
      return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
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

  // ─── CRM Aggregate Metrics ────────────────────────────────────────────
  const crmAgg = useMemo(() => {
    if (crmStats.length === 0) return null;
    let totalCrmLeads = 0, totalHot = 0, totalWarm = 0, totalCold = 0, totalBad = 0;
    let totalFit = 0, totalNotFit = 0;
    let totalWonDeals = 0, totalWonRevenue = 0;
    let totalLeadClass = 0, totalProspect = 0, totalOpportunity = 0;
    for (const s of crmStats) {
      totalCrmLeads += s.totalLeads;
      totalHot += s.hot;
      totalWarm += s.warm;
      totalCold += s.cold;
      totalBad += s.bad;
      totalFit += s.fitCount;
      totalNotFit += s.notFitCount;
      totalWonDeals += s.wonDeals;
      totalWonRevenue += s.wonRevenue;
      totalLeadClass += s.leadCount;
      totalProspect += s.prospectCount;
      totalOpportunity += s.opportunityCount;
    }
    const qualityPercent = totalCrmLeads > 0 ? ((totalHot + totalWarm) / totalCrmLeads) * 100 : 0;
    const fitPercent = totalCrmLeads > 0 ? (totalFit / totalCrmLeads) * 100 : 0;
    return { totalCrmLeads, totalHot, totalWarm, totalCold, totalBad, totalFit, totalNotFit, totalWonDeals, totalWonRevenue, qualityPercent, fitPercent, totalLeadClass, totalProspect, totalOpportunity };
  }, [crmStats]);

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
      const crm_a = crmLookup[a.campaignName?.toLowerCase()] || {};
      const crm_b = crmLookup[b.campaignName?.toLowerCase()] || {};
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
        case "crmLeads": valA = crm_a.totalLeads || 0; valB = crm_b.totalLeads || 0; break;
        case "hotLeads": valA = crm_a.hot || 0; valB = crm_b.hot || 0; break;
        case "qualityPercent":
          valA = crm_a.totalLeads > 0 ? ((crm_a.hot + crm_a.warm) / crm_a.totalLeads) * 100 : 0;
          valB = crm_b.totalLeads > 0 ? ((crm_b.hot + crm_b.warm) / crm_b.totalLeads) * 100 : 0;
          break;
        default: valA = 0; valB = 0;
      }
      if (typeof valA === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
    return result;
  }, [campaigns, searchQuery, statusFilter, objectiveFilter, sortField, sortDir, insights, crmLookup]);

  const totalPages = Math.ceil(filteredCampaigns.length / pageSize);
  const paginatedCampaigns = filteredCampaigns.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ─── Unique objectives for filter ──────────────────────────────────────
  const uniqueObjectives = useMemo(() => {
    const objs = new Set<string>();
    campaigns.forEach((c: any) => { if (c.objective) objs.add(c.objective); });
    return Array.from(objs);
  }, [campaigns]);

  // ─── CSV Export ────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Campaign", "Status", "Objective", "Daily Budget", "Spend", "Impressions", "Clicks", "CTR", "CPC", "CPL", "ROAS", "Meta Leads", "CRM Leads", "Hot", "Warm", "Cold", "Bad", "Fit%", "Avg Score", "Lead", "Prospect", "Opportunity", "Won Deals", "Won Revenue (SAR)", "Cost/Hot Lead"];
    const rows = filteredCampaigns.map((c: any) => {
      const ci = insights[c.campaignId] || {};
      const crm = crmLookup[c.campaignName?.toLowerCase()] || {};
      const spend = parseFloat(ci.spend || "0");
      const costPerHot = crm.hot > 0 ? (spend / crm.hot).toFixed(2) : "";
      const qualityPct = crm.totalLeads > 0 ? (((crm.hot || 0) + (crm.warm || 0)) / crm.totalLeads * 100).toFixed(1) : "";
      const fitPct = crm.totalLeads > 0 ? ((crm.fitCount || 0) / crm.totalLeads * 100).toFixed(1) : "";
      return [
        c.campaignName, c.status, c.objective || "", c.dailyBudget || "",
        ci.spend || "", ci.impressions || "", ci.clicks || "", ci.ctr || "", ci.cpc || "",
        ci.cpl || "", ci.roas || "", ci.leads || "",
        crm.totalLeads || "", crm.hot || "", crm.warm || "", crm.cold || "", crm.bad || "",
        fitPct, crm.avgScore || "",
        crm.leadCount || "", crm.prospectCount || "", crm.opportunityCount || "",
        crm.wonDeals || "", crm.wonRevenue || "", costPerHot,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `meta-campaigns-crm-${datePreset === "custom" ? `${customDateFrom}_${customDateTo}` : datePreset}.csv`; a.click();
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
  const datePresetOptions: { value: DatePreset; labelAr: string; labelEn: string; icon?: string }[] = [
    { value: "today", labelAr: "اليوم", labelEn: "Today" },
    { value: "yesterday", labelAr: "أمس", labelEn: "Yesterday" },
    { value: "last_7d", labelAr: "آخر 7 أيام", labelEn: "Last 7 Days" },
    { value: "last_14d", labelAr: "آخر 14 يوم", labelEn: "Last 14 Days" },
    { value: "last_30d", labelAr: "آخر 30 يوم", labelEn: "Last 30 Days" },
    { value: "last_90d", labelAr: "آخر 90 يوم", labelEn: "Last 90 Days" },
    { value: "this_month", labelAr: "هذا الشهر", labelEn: "This Month" },
    { value: "last_month", labelAr: "الشهر الماضي", labelEn: "Last Month" },
    { value: "last_year", labelAr: "آخر سنة", labelEn: "Last Year" },
    { value: "maximum", labelAr: "كل الفترة", labelEn: "Lifetime" },
    { value: "custom", labelAr: "فترة مخصصة", labelEn: "Custom Range" },
  ];

  // ─── Sortable Header ──────────────────────────────────────────────────
  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronDown size={12} className="opacity-30" />
        )}
      </div>
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

  // ─── Quality Color Helper ─────────────────────────────────────────────
  const getQualityColor = (percent: number) => {
    if (percent >= 60) return "text-emerald-600";
    if (percent >= 30) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-emerald-600 bg-emerald-50";
    if (score >= 30) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

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
                Meta Campaigns + CRM Analytics
              </div>
              <h1 className="text-2xl font-bold">
                {isRTL ? "حملات Meta + تحليلات CRM" : "Meta Campaigns + CRM Analytics"}
              </h1>
              <p className="mt-1.5 text-sm text-blue-100 max-w-2xl">
                {isRTL
                  ? "تتبع الإنفاق وجودة العملاء والعائد. قارن بيانات Meta مع بيانات CRM لكل حملة."
                  : "Track spend, lead quality & ROAS. Compare Meta data with CRM data for each campaign."}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Professional Date Filter */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors min-w-[180px] justify-start">
                      <Clock size={14} className="mr-2 shrink-0" />
                      <span className="truncate">
                        {datePreset === "custom" && customDateFrom && customDateTo
                          ? `${customDateFrom} → ${customDateTo}`
                          : (isRTL
                            ? datePresetOptions.find(o => o.value === datePreset)?.labelAr
                            : datePresetOptions.find(o => o.value === datePreset)?.labelEn)
                        }
                      </span>
                      <ChevronDown size={14} className="ml-auto shrink-0 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[220px]">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {isRTL ? "فترات سريعة" : "Quick Presets"}
                    </DropdownMenuLabel>
                    {datePresetOptions.filter(o => o.value !== "custom").map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        className={`cursor-pointer ${datePreset === opt.value ? "bg-primary/10 text-primary font-medium" : ""}`}
                        onClick={() => { setDatePreset(opt.value); setShowCustomDate(false); setCurrentPage(1); }}
                      >
                        {datePreset === opt.value && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
                        {isRTL ? opt.labelAr : opt.labelEn}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className={`cursor-pointer ${datePreset === "custom" ? "bg-primary/10 text-primary font-medium" : ""}`}
                      onClick={() => { setDatePreset("custom" as DatePreset); setShowCustomDate(true); }}
                    >
                      <Filter size={14} className="mr-2" />
                      {isRTL ? "فترة مخصصة..." : "Custom Range..."}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Custom Date Range Inputs */}
                {showCustomDate && (
                  <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1 border border-white/20">
                    <input
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      className="bg-transparent text-white text-xs border-0 outline-none w-[110px] [color-scheme:dark]"
                      placeholder="From"
                    />
                    <span className="text-white/50 text-xs">→</span>
                    <input
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      className="bg-transparent text-white text-xs border-0 outline-none w-[110px] [color-scheme:dark]"
                      placeholder="To"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-white hover:bg-white/20 text-xs"
                      onClick={() => {
                        if (customDateFrom && customDateTo) {
                          utils.meta.getInsights.invalidate();
                          utils.meta.getCrmStatsByCampaign.invalidate();
                          setCurrentPage(1);
                          toast.success(isRTL ? "تم تطبيق الفترة المخصصة" : "Custom range applied");
                        } else {
                          toast.error(isRTL ? "يرجى اختيار تاريخ البداية والنهاية" : "Please select start and end dates");
                        }
                      }}
                    >
                      {isRTL ? "تطبيق" : "Apply"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-white/60 hover:bg-white/20 hover:text-white"
                      onClick={() => { setShowCustomDate(false); setDatePreset("maximum"); setCustomDateFrom(""); setCustomDateTo(""); }}
                    >
                      <X size={12} />
                    </Button>
                  </div>
                )}
              </div>
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

        {/* ═══ KPI Cards — Meta ══════════════════════════════════════════ */}
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
              title={isRTL ? "عملاء Meta" : "Meta Leads"}
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

        {/* ═══ KPI Cards — CRM ═══════════════════════════════════════════ */}
        {activeAccount && crmAgg && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              icon={Users}
              title={isRTL ? "عملاء CRM" : "CRM Leads"}
              value={fmt.compact(crmAgg.totalCrmLeads)}
              subtitle={isRTL ? `Fit: ${crmAgg.fitPercent.toFixed(0)}%` : `Fit: ${crmAgg.fitPercent.toFixed(0)}%`}
              iconBg="bg-gradient-to-br from-cyan-500 to-cyan-600"
              color="from-cyan-500 to-cyan-600"
            />
            <KPICard
              icon={Flame}
              title={isRTL ? "عملاء ساخنين" : "Hot Leads"}
              value={fmt.compact(crmAgg.totalHot)}
              subtitle={agg && agg.totalSpend > 0 && crmAgg.totalHot > 0 ? `${isRTL ? "تكلفة:" : "Cost:"} ${fmt.currency(agg.totalSpend / crmAgg.totalHot)}` : "—"}
              iconBg="bg-gradient-to-br from-red-500 to-orange-500"
              color="from-red-500 to-orange-500"
            />
            <KPICard
              icon={TrendingUp}
              title={isRTL ? "نسبة الجودة" : "Quality %"}
              value={`${crmAgg.qualityPercent.toFixed(1)}%`}
              subtitle={`${isRTL ? "ساخن+دافئ" : "Hot+Warm"}: ${crmAgg.totalHot + crmAgg.totalWarm}`}
              iconBg="bg-gradient-to-br from-teal-500 to-teal-600"
              color="from-teal-500 to-teal-600"
            />
            <KPICard
              icon={Award}
              title={isRTL ? "صفقات مكسوبة" : "Won Deals"}
              value={String(crmAgg.totalWonDeals)}
              subtitle={fmt.currencySar(crmAgg.totalWonRevenue)}
              iconBg="bg-gradient-to-br from-yellow-500 to-yellow-600"
              color="from-yellow-500 to-yellow-600"
            />
            <KPICard
              icon={BarChart3}
              title="ROAS"
              value={agg && agg.totalSpend > 0 && crmAgg.totalWonRevenue > 0 ? `${(crmAgg.totalWonRevenue / agg.totalSpend).toFixed(2)}x` : "—"}
              subtitle={isRTL ? "العائد على الإنفاق" : "Return on Ad Spend"}
              iconBg="bg-gradient-to-br from-indigo-500 to-indigo-600"
              color="from-indigo-500 to-indigo-600"
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

                {/* Toggle CRM Row */}
                <Button
                  variant={showCrmRow ? "default" : "outline"}
                  size="sm"
                  className="h-10"
                  onClick={() => setShowCrmRow(!showCrmRow)}
                >
                  <BarChart3 size={14} className="mr-1.5" />
                  {isRTL ? "بيانات CRM" : "CRM Data"}
                </Button>

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
                <div className="flex items-center gap-2">
                  {crmStatsQ.isLoading && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      {isRTL ? "تحميل CRM..." : "Loading CRM..."}
                    </span>
                  )}
                  {insightsQ.isLoading && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      {isRTL ? "تحميل Meta..." : "Loading Meta..."}
                    </span>
                  )}
                </div>
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
                    <Table className="min-w-[1400px]">
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30 text-xs">
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
                          const crm = crmLookup[c.campaignName?.toLowerCase()] || null;
                          const spend = parseFloat(ci.spend || "0");
                          const qualityPct = crm && crm.totalLeads > 0 ? ((crm.hot + crm.warm) / crm.totalLeads) * 100 : 0;
                          const fitPct = crm && crm.totalLeads > 0 ? (crm.fitCount / crm.totalLeads) * 100 : 0;
                          const costPerHot = crm && crm.hot > 0 && spend > 0 ? spend / crm.hot : 0;
                          const roas = crm && crm.wonRevenue > 0 && spend > 0 ? crm.wonRevenue / spend : 0;

                          return (
                            <React.Fragment key={c.id}>
                              {/* ─── Row 1: Meta API Data ─── */}
                              <TableRow
                                className={`cursor-pointer hover:bg-primary/5 transition-colors group h-10 ${showCrmRow && crm ? "border-b-0" : ""}`}
                                onClick={() => openDrawer(c)}
                              >
                                {visibleColumns.includes("name") && (
                                  <TableCell className="font-medium min-w-[250px] max-w-[300px] py-1.5 text-xs" rowSpan={showCrmRow && crm ? 1 : 1}>
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200 shrink-0">Meta</Badge>
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate font-semibold">{c.campaignName}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">{c.campaignId}</div>
                                      </div>
                                    </div>
                                  </TableCell>
                                )}
                                {visibleColumns.includes("status") && (
                                  <TableCell className="whitespace-nowrap">{getStatusBadge(c.status)}</TableCell>
                                )}
                                {visibleColumns.includes("objective") && (
                                  <TableCell className="whitespace-nowrap">
                                    <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
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
                                  <TableCell className="text-xs font-semibold py-1.5 whitespace-nowrap">{fmt.currency(ci.spend)}</TableCell>
                                )}
                                {visibleColumns.includes("impressions") && (
                                  <TableCell className="text-xs py-1.5">{fmt.number(ci.impressions)}</TableCell>
                                )}
                                {visibleColumns.includes("clicks") && (
                                  <TableCell className="text-xs py-1.5">{fmt.number(ci.clicks)}</TableCell>
                                )}
                                {visibleColumns.includes("ctr") && (
                                  <TableCell className="text-xs py-1.5">{fmt.percent(ci.ctr)}</TableCell>
                                )}
                                {visibleColumns.includes("cpc") && (
                                  <TableCell className="text-xs py-1.5 whitespace-nowrap">{fmt.currency(ci.cpc)}</TableCell>
                                )}
                                {visibleColumns.includes("cpm") && (
                                  <TableCell className="text-xs py-1.5">{fmt.currency(ci.cpm)}</TableCell>
                                )}
                                {visibleColumns.includes("cpl") && (
                                  <TableCell className="text-xs font-semibold py-1.5 whitespace-nowrap">
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
                                  <TableCell className="text-xs font-semibold text-emerald-600 py-1.5">
                                    {ci.leads && ci.leads !== "0" ? ci.leads : "—"}
                                  </TableCell>
                                )}
                                {visibleColumns.includes("messages") && (
                                  <TableCell className="text-xs py-1.5">
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

                              {/* ─── Row 2: CRM Data ─── */}
                              {showCrmRow && (
                                <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-900/30 dark:to-blue-900/10 border-b-2 border-muted/40">
                                  <TableCell colSpan={visibleColumns.filter(c => ALL_COLUMNS.some(ac => ac.key === c)).length + (visibleColumns.includes("action") ? 1 : 0)} className="py-4 px-5">
                                    {crm ? (
                                      <div className="space-y-3">
                                        {/* Header */}
                                        <div className="flex items-center gap-2">
                                          <Badge className="text-xs px-3 py-1 bg-emerald-500 text-white border-0 font-semibold">
                                            <Users size={14} className="mr-1.5" />
                                            {isRTL ? "بيانات CRM" : "CRM Data"}
                                          </Badge>
                                        </div>

                                        {/* Cards Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">

                                          {/* Total Leads Card */}
                                          <div className="bg-white dark:bg-slate-800 rounded-lg px-4 py-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <div className="text-[11px] text-muted-foreground mb-1 whitespace-nowrap">{isRTL ? "إجمالي العملاء" : "Total Leads"}</div>
                                            <div className="text-lg font-bold flex items-center gap-1.5">
                                              <Users size={16} className="text-slate-500" />
                                              {crm.totalLeads}
                                            </div>
                                          </div>

                                          {/* Hot Leads Card */}
                                          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3 border border-red-200 dark:border-red-800 shadow-sm">
                                            <div className="text-[11px] text-red-500 mb-1 whitespace-nowrap">{isRTL ? "ساخن" : "Hot"}</div>
                                            <div className="text-lg font-bold text-red-600 flex items-center gap-1.5">
                                              <Flame size={16} className="text-red-500" />
                                              {crm.hot}
                                            </div>
                                          </div>

                                          {/* Warm Leads Card */}
                                          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg px-4 py-3 border border-orange-200 dark:border-orange-800 shadow-sm">
                                            <div className="text-[11px] text-orange-500 mb-1 whitespace-nowrap">{isRTL ? "دافئ" : "Warm"}</div>
                                            <div className="text-lg font-bold text-orange-600 flex items-center gap-1.5">
                                              <ThermometerSun size={16} className="text-orange-500" />
                                              {crm.warm}
                                            </div>
                                          </div>

                                          {/* Cold Leads Card */}
                                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3 border border-blue-200 dark:border-blue-800 shadow-sm">
                                            <div className="text-[11px] text-blue-500 mb-1 whitespace-nowrap">{isRTL ? "بارد" : "Cold"}</div>
                                            <div className="text-lg font-bold text-blue-600 flex items-center gap-1.5">
                                              <Snowflake size={16} className="text-blue-500" />
                                              {crm.cold}
                                            </div>
                                          </div>

                                          {/* Quality % Card */}
                                          <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg px-4 py-3 border border-teal-200 dark:border-teal-800 shadow-sm">
                                            <div className="text-[11px] text-teal-500 mb-1 whitespace-nowrap">{isRTL ? "نسبة الجودة" : "Quality %"}</div>
                                            <div className={`text-lg font-bold ${getQualityColor(qualityPct)}`}>
                                              {qualityPct.toFixed(0)}%
                                            </div>
                                          </div>

                                          {/* Fit Status Card */}
                                          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-4 py-3 border border-emerald-200 dark:border-emerald-800 shadow-sm">
                                            <div className="text-[11px] text-emerald-500 mb-1 whitespace-nowrap">{isRTL ? "مناسب / غير مناسب" : "Fit / Not Fit"}</div>
                                            <div className="text-lg font-bold flex items-center gap-2">
                                              <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={14} />{crm.fitCount}</span>
                                              <span className="text-slate-300">/</span>
                                              <span className="flex items-center gap-1 text-red-500"><XCircle size={14} />{crm.notFitCount}</span>
                                            </div>
                                          </div>

                                          {/* Pipeline Card */}
                                          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-4 py-3 border border-indigo-200 dark:border-indigo-800 shadow-sm">
                                            <div className="text-[11px] text-indigo-500 mb-1 whitespace-nowrap">{isRTL ? "المراحل" : "Pipeline"}</div>
                                            <div className="text-sm font-bold flex items-center gap-2">
                                              <span className="text-slate-600">{isRTL ? "عميل" : "Lead"} {crm.leadCount}</span>
                                              <span className="text-blue-600">{isRTL ? "محتمل" : "Prospect"} {crm.prospectCount}</span>
                                              <span className="text-emerald-600">{isRTL ? "فرصة" : "Opp"} {crm.opportunityCount}</span>
                                            </div>
                                          </div>

                                          {/* Avg Score Card */}
                                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-3 border border-amber-200 dark:border-amber-800 shadow-sm">
                                            <div className="text-[11px] text-amber-500 mb-1 whitespace-nowrap">{isRTL ? "متوسط التقييم" : "Avg Score"}</div>
                                            <div className="text-lg font-bold flex items-center gap-1.5">
                                              <Star size={16} className="text-amber-500" />
                                              <span className={getScoreColor(crm.avgScore)}>{crm.avgScore}</span>
                                            </div>
                                          </div>

                                          {/* Cost per Hot Lead Card */}
                                          {costPerHot > 0 && (
                                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3 border border-red-200 dark:border-red-800 shadow-sm">
                                              <div className="text-[11px] text-red-500 mb-1 whitespace-nowrap">{isRTL ? "تكلفة العميل الساخن" : "Cost/Hot Lead"}</div>
                                              <div className="text-lg font-bold text-red-600 flex items-center gap-1.5">
                                                <Flame size={16} className="text-red-500" />
                                                <span className="whitespace-nowrap">{fmt.currency(costPerHot)}</span>
                                              </div>
                                            </div>
                                          )}

                                          {/* Won Deals Card */}
                                          {crm.wonDeals > 0 && (
                                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-4 py-3 border border-yellow-200 dark:border-yellow-800 shadow-sm">
                                              <div className="text-[11px] text-yellow-600 mb-1 whitespace-nowrap">{isRTL ? "صفقات مكسوبة" : "Won Deals"}</div>
                                              <div className="text-lg font-bold text-yellow-600 flex items-center gap-1.5">
                                                <Award size={16} className="text-yellow-500" />
                                                {crm.wonDeals}
                                              </div>
                                            </div>
                                          )}

                                          {/* Revenue Card */}
                                          {crm.wonRevenue > 0 && (
                                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-4 py-3 border border-emerald-200 dark:border-emerald-800 shadow-sm">
                                              <div className="text-[11px] text-emerald-500 mb-1 whitespace-nowrap">{isRTL ? "الإيرادات" : "Revenue"}</div>
                                              <div className="text-base font-bold text-emerald-600 whitespace-nowrap">
                                                {fmt.currencySar(crm.wonRevenue)}
                                              </div>
                                            </div>
                                          )}

                                          {/* ROAS Card */}
                                          {roas > 0 && (
                                            <div className={`rounded-lg px-4 py-3 border shadow-sm ${roas >= 1 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                                              <div className="text-[11px] text-muted-foreground mb-1 whitespace-nowrap">ROAS</div>
                                              <div className={`text-lg font-bold ${roas >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {roas.toFixed(2)}x
                                              </div>
                                            </div>
                                          )}

                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
                                        <Badge variant="outline" className="text-xs px-3 py-1 bg-slate-50 text-slate-400 border-slate-200">CRM</Badge>
                                        {isRTL ? "لا توجد بيانات CRM لهذه الحملة" : "No CRM data for this campaign"}
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* ─── Pagination ──────────────────────────────────────── */}
                  <div className="flex items-center justify-between px-5 py-2.5 border-t bg-muted/20">
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        {isRTL
                          ? `عرض ${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, filteredCampaigns.length)} من ${filteredCampaigns.length}`
                          : `Showing ${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, filteredCampaigns.length)} of ${filteredCampaigns.length}`}
                      </p>
                      <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[70px] h-7 text-xs bg-transparent border-muted-foreground/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map(size => (
                            <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline" size="icon" className="h-7 w-7"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                        >
                          <ChevronLeft size={12} /><ChevronLeft size={12} className="-ml-2" />
                        </Button>
                        <Button
                          variant="outline" size="icon" className="h-7 w-7"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => p - 1)}
                        >
                          <ChevronLeft size={12} />
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
                              className="h-7 w-7 text-xs"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline" size="icon" className="h-7 w-7"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => p + 1)}
                        >
                          <ChevronRight size={12} />
                        </Button>
                        <Button
                          variant="outline" size="icon" className="h-7 w-7"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                        >
                          <ChevronRight size={12} /><ChevronRight size={12} className="-ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ Campaign Details Drawer ════════════════════════════════════ */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0" side={isRTL ? "left" : "right"}>
            {selectedCampaign && (() => {
              const ci = insights[selectedCampaign.campaignId] || {};
              const crm = crmLookup[selectedCampaign.campaignName?.toLowerCase()] || null;
              const spend = parseFloat(ci.spend || "0");
              const qualityPct = crm && crm.totalLeads > 0 ? ((crm.hot + crm.warm) / crm.totalLeads) * 100 : 0;
              const costPerHot = crm && crm.hot > 0 && spend > 0 ? spend / crm.hot : 0;
              const roas = crm && crm.wonRevenue > 0 && spend > 0 ? crm.wonRevenue / spend : 0;

              return (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white">
                    <SheetHeader className="p-0">
                      <SheetTitle className="text-base font-bold text-white leading-tight">
                        {selectedCampaign.campaignName}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`text-[10px] px-2 py-0.5 ${
                        selectedCampaign.status === "ACTIVE" 
                          ? "bg-emerald-400/20 text-emerald-100 border-emerald-300/30" 
                          : "bg-white/15 text-white/80 border-white/20"
                      }`}>
                        {selectedCampaign.status === "ACTIVE" && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-300 inline-block animate-pulse" />}
                        {selectedCampaign.status === "ACTIVE" ? (isRTL ? "نشط" : "Active") : (isRTL ? "متوقف" : "Paused")}
                      </Badge>
                      <Badge className="text-[10px] px-2 py-0.5 bg-white/15 text-white/80 border-white/20">
                        <Target size={9} className="mr-1" />
                        {selectedCampaign.objective || "—"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-blue-200 mt-2 font-mono">{selectedCampaign.campaignId}</p>
                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      {(selectedCampaign.status === "ACTIVE" || selectedCampaign.status === "PAUSED") && (
                        <Button
                          size="sm"
                          className={`h-7 text-xs ${
                            selectedCampaign.status === "ACTIVE"
                              ? "bg-red-500/20 hover:bg-red-500/30 text-white border-red-300/30"
                              : "bg-emerald-500/20 hover:bg-emerald-500/30 text-white border-emerald-300/30"
                          }`}
                          variant="outline"
                          onClick={() => handleStatusChange(selectedCampaign.id, selectedCampaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
                          disabled={updatingId === selectedCampaign.id}
                        >
                          {updatingId === selectedCampaign.id ? (
                            <Loader2 size={12} className="animate-spin mr-1" />
                          ) : selectedCampaign.status === "ACTIVE" ? (
                            <Pause size={12} className="mr-1" />
                          ) : (
                            <Play size={12} className="mr-1" />
                          )}
                          {selectedCampaign.status === "ACTIVE" ? (isRTL ? "إيقاف" : "Pause") : (isRTL ? "تشغيل" : "Activate")}
                        </Button>
                      )}
                      {selectedCampaign.dailyBudget && selectedCampaign.dailyBudget !== "0.00" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20"
                          onClick={() => openBudgetEdit(selectedCampaign.id, selectedCampaign.campaignName, "daily", selectedCampaign.dailyBudget)}>
                          <Pencil size={12} className="mr-1" />
                          {isRTL ? "تعديل الميزانية" : "Edit Budget"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* KPI Mini Cards */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 text-center">
                        <p className="text-[9px] text-blue-500 font-semibold uppercase tracking-wider">{isRTL ? "الإنفاق" : "Spend"}</p>
                        <p className="text-sm font-bold mt-0.5 text-blue-700">{fmt.currency(ci.spend)}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5 text-center">
                        <p className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider">{isRTL ? "العملاء" : "Leads"}</p>
                        <p className="text-sm font-bold mt-0.5 text-emerald-700">{ci.leads && ci.leads !== "0" ? ci.leads : (ci.messages && ci.messages !== "0" ? ci.messages : "—")}</p>
                      </div>
                      <div className="rounded-lg bg-violet-50 border border-violet-100 p-2.5 text-center">
                        <p className="text-[9px] text-violet-500 font-semibold uppercase tracking-wider">CPL</p>
                        <p className="text-sm font-bold mt-0.5 text-violet-700">{ci.cpl ? fmt.currency(ci.cpl) : (ci.costPerMessage ? fmt.currency(ci.costPerMessage) : "—")}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-center">
                        <p className="text-[9px] text-amber-500 font-semibold uppercase tracking-wider">ROAS</p>
                        <p className="text-sm font-bold mt-0.5 text-amber-700">{roas > 0 ? `${roas.toFixed(2)}x` : (ci.roas ? `${parseFloat(ci.roas).toFixed(2)}x` : "—")}</p>
                      </div>
                    </div>

                    {/* Meta Performance Metrics */}
                    <div className="rounded-lg border bg-card">
                      <div className="px-3 py-2.5 border-b bg-blue-50/50">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200">Meta</Badge>
                          {isRTL ? "مقاييس الأداء" : "Performance Metrics"}
                        </h4>
                      </div>
                      <div className="divide-y">
                        {[
                          { label: isRTL ? "مرات الظهور" : "Impressions", value: fmt.number(ci.impressions), icon: Eye, color: "text-sky-500" },
                          { label: isRTL ? "النقرات" : "Clicks", value: fmt.number(ci.clicks), icon: MousePointer, color: "text-indigo-500" },
                          { label: "CTR", value: fmt.percent(ci.ctr), icon: TrendingUp, color: "text-teal-500" },
                          { label: "CPC", value: fmt.currency(ci.cpc), icon: DollarSign, color: "text-orange-500" },
                          { label: "CPM", value: fmt.currency(ci.cpm), icon: BarChart3, color: "text-pink-500" },
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between px-3 py-2">
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              <item.icon size={13} className={item.color} />
                              {item.label}
                            </span>
                            <span className="text-xs font-semibold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CRM Analytics Section */}
                    {crm && (
                      <div className="rounded-lg border bg-card">
                        <div className="px-3 py-2.5 border-b bg-emerald-50/50">
                          <h4 className="text-xs font-semibold flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border-emerald-200">CRM</Badge>
                            {isRTL ? "تحليلات العملاء" : "Lead Analytics"}
                          </h4>
                        </div>
                        <div className="divide-y">
                          {/* Quality Breakdown */}
                          <div className="px-3 py-2.5">
                            <p className="text-[10px] text-muted-foreground mb-2">{isRTL ? "جودة العملاء" : "Lead Quality"}</p>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Flame size={12} className="text-red-500" />
                                <span className="text-xs font-bold text-red-600">{crm.hot}</span>
                                <span className="text-[10px] text-muted-foreground">{isRTL ? "ساخن" : "Hot"}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ThermometerSun size={12} className="text-orange-500" />
                                <span className="text-xs font-bold text-orange-600">{crm.warm}</span>
                                <span className="text-[10px] text-muted-foreground">{isRTL ? "دافئ" : "Warm"}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Snowflake size={12} className="text-blue-500" />
                                <span className="text-xs font-bold text-blue-600">{crm.cold}</span>
                                <span className="text-[10px] text-muted-foreground">{isRTL ? "بارد" : "Cold"}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <XCircle size={12} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-500">{crm.bad}</span>
                                <span className="text-[10px] text-muted-foreground">{isRTL ? "سيء" : "Bad"}</span>
                              </div>
                            </div>
                            {/* Quality Bar */}
                            <div className="flex h-2 rounded-full overflow-hidden mt-2 bg-slate-100">
                              {crm.totalLeads > 0 && (
                                <>
                                  <div className="bg-red-500 transition-all" style={{ width: `${(crm.hot / crm.totalLeads) * 100}%` }} />
                                  <div className="bg-orange-400 transition-all" style={{ width: `${(crm.warm / crm.totalLeads) * 100}%` }} />
                                  <div className="bg-blue-400 transition-all" style={{ width: `${(crm.cold / crm.totalLeads) * 100}%` }} />
                                  <div className="bg-slate-300 transition-all" style={{ width: `${(crm.bad / crm.totalLeads) * 100}%` }} />
                                </>
                              )}
                            </div>
                          </div>

                          {/* Key Metrics */}
                          {[
                            { label: isRTL ? "إجمالي العملاء (CRM)" : "Total CRM Leads", value: String(crm.totalLeads), icon: Users, color: "text-cyan-500" },
                            { label: isRTL ? "نسبة الجودة" : "Quality %", value: `${qualityPct.toFixed(1)}%`, icon: TrendingUp, color: getQualityColor(qualityPct) },
                            { label: "Fit / Not Fit", value: `${crm.fitCount} / ${crm.notFitCount}`, icon: CheckCircle, color: "text-emerald-500" },
                            { label: isRTL ? "متوسط السكور" : "Avg Score", value: String(crm.avgScore), icon: Star, color: "text-amber-500" },
                            { label: "Lead / Prospect / Opportunity", value: `${crm.leadCount} / ${crm.prospectCount} / ${crm.opportunityCount}`, icon: Briefcase, color: "text-indigo-500" },
                            { label: isRTL ? "تكلفة العميل الساخن" : "Cost per Hot Lead", value: costPerHot > 0 ? fmt.currency(costPerHot) : "—", icon: Flame, color: "text-red-500" },
                            { label: isRTL ? "صفقات مكسوبة" : "Won Deals", value: `${crm.wonDeals} (${fmt.currencySar(crm.wonRevenue)})`, icon: Award, color: "text-yellow-500" },
                            { label: "ROAS", value: roas > 0 ? `${roas.toFixed(2)}x` : "—", icon: BarChart3, color: "text-indigo-500" },
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-2">
                              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                <item.icon size={13} className={item.color} />
                                {item.label}
                              </span>
                              <span className="text-xs font-semibold">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No CRM Data */}
                    {!crm && (
                      <div className="rounded-lg border bg-card p-4 text-center">
                        <Users size={24} className="mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {isRTL ? "لا توجد بيانات CRM لهذه الحملة" : "No CRM data for this campaign"}
                        </p>
                      </div>
                    )}

                    {/* Budget Info */}
                    <div className="rounded-lg border bg-card">
                      <div className="px-3 py-2.5 border-b bg-muted/30">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <DollarSign size={13} className="text-primary" />
                          {isRTL ? "الميزانية" : "Budget"}
                        </h4>
                      </div>
                      <div className="divide-y">
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Zap size={13} className="text-yellow-500" />
                            {isRTL ? "يومية" : "Daily"}
                          </span>
                          <span className="text-xs font-semibold">{fmt.budget(selectedCampaign.dailyBudget)}</span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <DollarSign size={13} className="text-green-500" />
                            {isRTL ? "إجمالية" : "Lifetime"}
                          </span>
                          <span className="text-xs font-semibold">{fmt.budget(selectedCampaign.lifetimeBudget)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Campaign Info */}
                    <div className="rounded-lg border bg-card">
                      <div className="px-3 py-2.5 border-b bg-muted/30">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <Megaphone size={13} className="text-primary" />
                          {isRTL ? "معلومات الحملة" : "Campaign Info"}
                        </h4>
                      </div>
                      <div className="divide-y">
                        {[
                          { label: isRTL ? "معرف الحملة" : "Campaign ID", value: selectedCampaign.campaignId },
                          { label: isRTL ? "الحالة" : "Status", value: selectedCampaign.status },
                          { label: isRTL ? "الهدف" : "Objective", value: selectedCampaign.objective || "—" },
                          { label: isRTL ? "تاريخ الإنشاء" : "Created", value: selectedCampaign.createdAt ? new Date(selectedCampaign.createdAt).toLocaleDateString() : "—" },
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between px-3 py-2">
                            <span className="text-xs text-muted-foreground">{item.label}</span>
                            <span className="text-xs font-semibold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
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

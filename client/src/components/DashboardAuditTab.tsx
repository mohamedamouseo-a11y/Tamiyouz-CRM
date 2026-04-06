import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronRight,
  Database, Download, FileSpreadsheet, Info, Layers, RefreshCw,
  Search, Shield, XCircle, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardType = "agentDashboard" | "teamDashboard" | "salesFunnel" | "taskSla";
type DateBasis =
  | "leads.createdAt" | "leads.contactTime" | "deals.createdAt"
  | "activities.createdAt" | "clients.createdAt" | "contracts.createdAt";

const DASHBOARD_LABELS: Record<DashboardType, string> = {
  agentDashboard: "Agent Dashboard",
  teamDashboard: "Team Dashboard",
  salesFunnel: "Sales Funnel",
  taskSla: "Task & SLA",
};

const DATE_BASIS_LABELS: Record<DateBasis, string> = {
  "leads.createdAt": "leads.createdAt (Lead Creation)",
  "leads.contactTime": "leads.contactTime (First Contact)",
  "deals.createdAt": "deals.createdAt (Deal Creation)",
  "activities.createdAt": "activities.createdAt (Activity Time)",
  "clients.createdAt": "clients.createdAt (Client Creation)",
  "contracts.createdAt": "contracts.createdAt (Contract Date)",
};

type MatchStatus = "Match" | "Mismatch" | "Partial" | "NotComparable";

function MatchBadge({ status }: { status: MatchStatus }) {
  const cfg = {
    Match: { color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 size={12} />, label: "Match" },
    Mismatch: { color: "bg-red-100 text-red-800 border-red-200", icon: <XCircle size={12} />, label: "Mismatch" },
    Partial: { color: "bg-amber-100 text-amber-800 border-amber-200", icon: <AlertTriangle size={12} />, label: "Partial" },
    NotComparable: { color: "bg-gray-100 text-gray-700 border-gray-200", icon: <Info size={12} />, label: "N/A" },
  }[status] ?? { color: "bg-gray-100 text-gray-700 border-gray-200", icon: <Info size={12} />, label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: any; sub?: string; accent?: string }) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold truncate ${accent ?? ""}`}>
          {value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ExpandableCell({ value }: { value: any }) {
  const [open, setOpen] = useState(false);
  const str = value == null ? "" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
  if (str.length <= 60) return <span className="text-xs">{str}</span>;
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? "Collapse" : `${str.slice(0, 50)}…`}
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-48 border whitespace-pre-wrap">{str}</pre>
      )}
    </div>
  );
}

function DataTable({ rows, title }: { rows: any[]; title?: string }) {
  const [search, setSearch] = useState("");
  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Database size={32} className="mx-auto mb-2 opacity-30" />
        {title ? `No ${title} data` : "No data"}
      </div>
    );
  }
  const keys = Object.keys(rows[0]);
  const filtered = search
    ? rows.filter((r) => keys.some((k) => String(r[k] ?? "").toLowerCase().includes(search.toLowerCase())))
    : rows;

  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>}
      <div className="flex items-center gap-2">
        <Search size={14} className="text-muted-foreground" />
        <Input
          className="h-7 text-xs w-56"
          placeholder="Search rows…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">{filtered.length} / {rows.length} rows</span>
      </div>
      <div className="overflow-auto rounded border max-h-80">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#1E3A5F] text-white">
              {keys.map((k) => (
                <th key={k} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                {keys.map((k) => (
                  <td key={k} className="px-2 py-1.5 border-b border-gray-100 align-top">
                    <ExpandableCell value={row[k]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardAuditTab() {
  const { isRTL } = useLanguage();

  // ── Filter State ──────────────────────────────────────────────────────────
  const [dashboardType, setDashboardType] = useState<DashboardType>("teamDashboard");
  const [metricId, setMetricId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateBasis, setDateBasis] = useState<DateBasis>("leads.createdAt");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [viewerRole, setViewerRole] = useState<string>("Admin");
  const [activeTab, setActiveTab] = useState("summary");

  // ── Queries ───────────────────────────────────────────────────────────────
  const metricDefsQ = trpc.dashboardAudit.listMetricDefinitions.useQuery(undefined, {
    staleTime: 60000,
  });

  const usersQ = trpc.users.list.useQuery(undefined, { staleTime: 60000 });
  const salesAgents = useMemo(
    () => (usersQ.data ?? []).filter((u: any) => ["SalesAgent", "MediaBuyer"].includes(u.role)),
    [usersQ.data],
  );

  const metrics = useMemo(
    () => (metricDefsQ.data ?? []).filter((m: any) => m.dashboardType === dashboardType),
    [metricDefsQ.data, dashboardType],
  );

  // Auto-select first metric when dashboard type changes
  const [auditParams, setAuditParams] = useState<null | {
    dashboardType: DashboardType;
    metricId: string;
    dateFrom: Date;
    dateTo: Date;
    dateBasis: DateBasis;
    targetUserId?: number;
    viewerRole?: string;
  }>(null);

  const auditQ = trpc.dashboardAudit.runAudit.useQuery(
    auditParams as any,
    { enabled: !!auditParams, retry: false },
  );

  const auditResult = auditQ.data;

  const rawRowIds = useMemo(() => {
    if (!auditQ.data) return [];
    // We'll use a separate raw rows query
    return [];
  }, [auditQ.data]);

  const rawRowsQ = trpc.dashboardAudit.getRawRows.useQuery(
    auditParams ? { ...auditParams, limit: 200 } : (null as any),
    { enabled: !!auditParams && !!auditQ.data, retry: false },
  );

  const rowIds = useMemo(
    () => (rawRowsQ.data ?? []).map((r: any) => Number(r.id)).filter(Boolean).slice(0, 100),
    [rawRowsQ.data],
  );

  const storedInputsQ = trpc.dashboardAudit.getStoredInputs.useQuery(
    auditParams && rowIds.length > 0 ? { ...auditParams, rowIds } : (null as any),
    { enabled: !!auditParams && rowIds.length > 0, retry: false },
  );

  const relatedRecordsQ = trpc.dashboardAudit.getRelatedRecords.useQuery(
    auditParams && rowIds.length > 0 ? { ...auditParams, rowIds: rowIds.slice(0, 50) } : (null as any),
    { enabled: !!auditParams && rowIds.length > 0, retry: false },
  );

  const snapshotQ = trpc.dashboardAudit.getSnapshotInputs.useQuery(
    auditParams && rowIds.length > 0 ? { ...auditParams, rowIds } : (null as any),
    { enabled: !!auditParams && rowIds.length > 0, retry: false },
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleRunAudit() {
    if (!metricId) { toast.error("Please select a metric"); return; }
    setAuditParams({
      dashboardType,
      metricId,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      dateBasis,
      targetUserId: targetUserId ? parseInt(targetUserId) : undefined,
      viewerRole: viewerRole || undefined,
    });
    setActiveTab("summary");
  }

  function handleRefresh() {
    auditQ.refetch();
    rawRowsQ.refetch();
    storedInputsQ.refetch();
    relatedRecordsQ.refetch();
    snapshotQ.refetch();
  }

  function handleExportExcel() {
    if (!auditParams) { toast.error("Run audit first"); return; }
    const p = new URLSearchParams({
      dashboardType: auditParams.dashboardType,
      metricId: auditParams.metricId,
      dateFrom: auditParams.dateFrom.toISOString().slice(0, 10),
      dateTo: auditParams.dateTo.toISOString().slice(0, 10),
      dateBasis: auditParams.dateBasis,
    });
    if (auditParams.targetUserId) p.set("targetUserId", String(auditParams.targetUserId));
    if (auditParams.viewerRole) p.set("viewerRole", auditParams.viewerRole);
    const url = `/api/export/dashboard-audit?${p.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Excel export started");
  }

  // ── Match status color helpers ────────────────────────────────────────────

  const matchCardColor = (status?: MatchStatus) => {
    if (!status) return "";
    return { Match: "text-green-700", Mismatch: "text-red-700", Partial: "text-amber-700", NotComparable: "text-gray-500" }[status] ?? "";
  };

  const selectedMetricDef = useMemo(
    () => (metricDefsQ.data ?? []).find((m: any) => m.metricId === metricId),
    [metricDefsQ.data, metricId],
  );

  const isLoading = auditQ.isLoading || rawRowsQ.isLoading;

  // ── Related records display ───────────────────────────────────────────────
  const relatedEntries = useMemo(
    () => Object.entries(relatedRecordsQ.data ?? {}),
    [relatedRecordsQ.data],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield size={20} className="text-violet-600" />
        <div>
          <h2 className="text-sm font-semibold">Dashboard Audit & Data Reconciliation</h2>
          <p className="text-xs text-muted-foreground">Compare dashboard metrics vs direct DB truth • Super Admin Only</p>
        </div>
      </div>

      {/* ── Filter Panel ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <Layers size={14} /> Filter & Scope Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Dashboard Type */}
            <div className="space-y-1">
              <Label className="text-xs">Dashboard Type</Label>
              <Select value={dashboardType} onValueChange={(v) => { setDashboardType(v as DashboardType); setMetricId(""); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DASHBOARD_LABELS) as DashboardType[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{DASHBOARD_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Metric */}
            <div className="space-y-1">
              <Label className="text-xs">Metric</Label>
              <Select value={metricId} onValueChange={setMetricId} disabled={metrics.length === 0}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select metric…" />
                </SelectTrigger>
                <SelectContent>
                  {metrics.map((m: any) => (
                    <SelectItem key={m.metricId} value={m.metricId} className="text-xs">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-1">
              <Label className="text-xs">Date From</Label>
              <Input type="date" className="h-8 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            {/* Date To */}
            <div className="space-y-1">
              <Label className="text-xs">Date To</Label>
              <Input type="date" className="h-8 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            {/* Date Basis */}
            <div className="space-y-1">
              <Label className="text-xs">Date Basis</Label>
              <Select value={dateBasis} onValueChange={(v) => setDateBasis(v as DateBasis)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DATE_BASIS_LABELS) as DateBasis[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{DATE_BASIS_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target User (for agent-scoped metrics) */}
            <div className="space-y-1">
              <Label className="text-xs">Target User (optional)</Label>
              <Select value={targetUserId || "__none__"} onValueChange={(v) => setTargetUserId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Global scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs">Global scope</SelectItem>
                  {salesAgents.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)} className="text-xs">{u.name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Viewer Role */}
            <div className="space-y-1">
              <Label className="text-xs">Viewer Role Context</Label>
              <Select value={viewerRole} onValueChange={setViewerRole}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Admin", "SalesManager", "SalesAgent", "MediaBuyer"].map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1">
              <Label className="text-xs">Date Presets</Label>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: "Today", fn: () => { const d = new Date().toISOString().slice(0,10); setDateFrom(d); setDateTo(d); } },
                  { label: "Last 7d", fn: () => { const to = new Date(); const fr = new Date(); fr.setDate(fr.getDate()-6); setDateFrom(fr.toISOString().slice(0,10)); setDateTo(to.toISOString().slice(0,10)); } },
                  { label: "Last 30d", fn: () => { const to = new Date(); const fr = new Date(); fr.setDate(fr.getDate()-29); setDateFrom(fr.toISOString().slice(0,10)); setDateTo(to.toISOString().slice(0,10)); } },
                  { label: "This Month", fn: () => { const to = new Date(); const fr = new Date(to.getFullYear(), to.getMonth(), 1); setDateFrom(fr.toISOString().slice(0,10)); setDateTo(to.toISOString().slice(0,10)); } },
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn} className="px-2 py-0.5 rounded text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors">{label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t">
            <Button size="sm" onClick={handleRunAudit} disabled={isLoading || !metricId} className="gap-1.5 text-xs h-8">
              {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <BarChart3 size={12} />}
              Run Audit
            </Button>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={!auditParams} className="gap-1.5 text-xs h-8">
              <RefreshCw size={12} />
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={!auditResult} className="gap-1.5 text-xs h-8">
              <FileSpreadsheet size={12} />
              Export Excel
            </Button>
            {auditQ.isError && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <XCircle size={12} /> {String(auditQ.error)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Results Area ─────────────────────────────────────────────────── */}
      {!auditResult && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Configure filters above and click <strong>Run Audit</strong> to begin</p>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12">
          <RefreshCw size={32} className="mx-auto mb-3 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground">Running audit queries…</p>
        </div>
      )}

      {auditResult && !isLoading && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="flex gap-3 flex-wrap">
            <SummaryCard
              label="Dashboard Logic Value"
              value={typeof auditResult.dashboardLogicValue === "object"
                ? `[${Array.isArray(auditResult.dashboardLogicValue) ? auditResult.dashboardLogicValue.length + " items" : "object"}]`
                : auditResult.dashboardLogicValue}
              sub="From existing dashboard logic"
            />
            <SummaryCard
              label="Direct DB Value"
              value={typeof auditResult.databaseValue === "object"
                ? `[${Array.isArray(auditResult.databaseValue) ? auditResult.databaseValue.length + " items" : "object"}]`
                : auditResult.databaseValue}
              sub="From independent DB query"
            />
            <SummaryCard
              label="Difference"
              value={auditResult.difference != null ? (auditResult.difference > 0 ? `+${auditResult.difference}` : String(auditResult.difference)) : "—"}
              accent={auditResult.difference !== 0 && auditResult.difference != null ? "text-red-600" : "text-green-600"}
              sub="Dashboard minus DB"
            />
            <Card className="flex-1 min-w-0">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">Match Status</p>
                <div className="flex items-center gap-2">
                  <MatchBadge status={auditResult.matchStatus as MatchStatus} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{auditResult.rawRowCount} raw rows</p>
              </CardContent>
            </Card>
          </div>

          {/* Mismatch reasons banner */}
          {auditResult.mismatchReasons && auditResult.mismatchReasons.length > 0 && auditResult.matchStatus !== "Match" && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-800">Mismatch Findings</p>
                    {auditResult.mismatchReasons.map((r: string, i: number) => (
                      <p key={i} className="text-xs text-amber-700">• {r}</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Drill-down Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="text-xs h-8">
              <TabsTrigger value="summary" className="text-xs px-3 h-7">Summary</TabsTrigger>
              <TabsTrigger value="definition" className="text-xs px-3 h-7">Definition</TabsTrigger>
              <TabsTrigger value="rawRows" className="text-xs px-3 h-7">
                Raw DB Rows {rawRowsQ.data ? `(${rawRowsQ.data.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="storedInputs" className="text-xs px-3 h-7">Stored Inputs</TabsTrigger>
              <TabsTrigger value="related" className="text-xs px-3 h-7">Related Records</TabsTrigger>
              <TabsTrigger value="snapshots" className="text-xs px-3 h-7">Snapshots</TabsTrigger>
              <TabsTrigger value="mismatch" className="text-xs px-3 h-7">Mismatch Analysis</TabsTrigger>
            </TabsList>

            {/* ── Summary Tab ────────────────────────────────────────────── */}
            <TabsContent value="summary" className="mt-3">
              <Card>
                <CardContent className="py-4 px-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      ["Dashboard Type", DASHBOARD_LABELS[dashboardType]],
                      ["Metric", auditResult.definition?.label ?? metricId],
                      ["Date Range", `${dateFrom} → ${dateTo}`],
                      ["Date Basis", dateBasis],
                      ["Target User", targetUserId ? `User #${targetUserId}` : "Global"],
                      ["Viewer Role", viewerRole],
                      ["Dashboard Value", String(typeof auditResult.dashboardLogicValue === "object" ? JSON.stringify(auditResult.dashboardLogicValue) : auditResult.dashboardLogicValue)],
                      ["DB Value", String(typeof auditResult.databaseValue === "object" ? JSON.stringify(auditResult.databaseValue) : auditResult.databaseValue)],
                      ["Difference", String(auditResult.difference ?? "N/A")],
                      ["Match Status", auditResult.matchStatus],
                      ["Raw Row Count", String(auditResult.rawRowCount)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <span className="text-muted-foreground w-36 shrink-0">{label}:</span>
                        <span className="font-medium break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Definition Tab ──────────────────────────────────────────── */}
            <TabsContent value="definition" className="mt-3">
              <Card>
                <CardContent className="py-4 px-4">
                  {selectedMetricDef ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {[
                        ["Metric ID", selectedMetricDef.metricId],
                        ["Dashboard Type", selectedMetricDef.dashboardType],
                        ["Metric Kind", selectedMetricDef.metricKind],
                        ["Primary Entity", selectedMetricDef.primaryEntity],
                        ["Primary Table", selectedMetricDef.primaryTable],
                        ["Joined Tables", selectedMetricDef.joinedTables?.join(", ") || "None"],
                        ["Default Date Basis", selectedMetricDef.defaultDateBasis],
                        ["Allowed Date Bases", selectedMetricDef.allowedDateBases?.join(", ")],
                        ["Allowed Scopes", selectedMetricDef.allowedScopes?.join(", ")],
                        ["Included Statuses", selectedMetricDef.includedStatuses?.join(", ") || "All"],
                        ["Excluded Statuses", selectedMetricDef.excludedStatuses?.join(", ") || "None"],
                        ["Soft Delete Rule", selectedMetricDef.softDeleteRule],
                        ["Dashboard Source", `trpc.dashboard.${selectedMetricDef.dashboardType}`],
                        ["DB Source", `dashboardAuditService.resolveDbValue("${selectedMetricDef.metricId}")`],
                        ["Caveats", selectedMetricDef.caveats || "None"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex gap-2">
                          <span className="text-muted-foreground w-36 shrink-0">{label}:</span>
                          <span className="font-medium break-all">{String(value ?? "")}</span>
                        </div>
                      ))}
                      <div className="col-span-2 mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Formula</p>
                        <p className="text-xs text-blue-800">{selectedMetricDef.formulaDescription}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No definition available. Select a metric first.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Raw DB Rows Tab ─────────────────────────────────────────── */}
            <TabsContent value="rawRows" className="mt-3">
              <Card>
                <CardContent className="py-4 px-4">
                  {rawRowsQ.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw size={12} className="animate-spin" /> Loading raw rows…
                    </div>
                  ) : (
                    <DataTable rows={rawRowsQ.data ?? []} title="Raw DB Rows (direct database query)" />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Stored Inputs Tab ───────────────────────────────────────── */}
            <TabsContent value="storedInputs" className="mt-3">
              <Card>
                <CardContent className="py-4 px-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Exact field values stored in the database for each primary row.
                  </p>
                  {storedInputsQ.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw size={12} className="animate-spin" /> Loading stored inputs…
                    </div>
                  ) : (
                    <DataTable rows={storedInputsQ.data ?? []} title="Stored Field Values" />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Related Records Tab ─────────────────────────────────────── */}
            <TabsContent value="related" className="mt-3">
              <Card>
                <CardContent className="py-4 px-4 space-y-5">
                  {relatedRecordsQ.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw size={12} className="animate-spin" /> Loading related records…
                    </div>
                  ) : relatedEntries.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      <Database size={28} className="mx-auto mb-2 opacity-25" />
                      No related records
                    </div>
                  ) : (
                    relatedEntries.map(([entity, rows]) => (
                      <DataTable key={entity} rows={rows as any[]} title={`${entity.charAt(0).toUpperCase() + entity.slice(1)} (${(rows as any[]).length} records)`} />
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Snapshots Tab ───────────────────────────────────────────── */}
            <TabsContent value="snapshots" className="mt-3">
              <Card>
                <CardContent className="py-4 px-4">
                  <div className="flex items-start gap-2 mb-3 p-3 bg-gray-50 rounded border">
                    <Clock size={14} className="text-blue-500 mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-semibold text-gray-700 mb-1">About Snapshot Inputs</p>
                      <p>Raw UI input snapshots are logged going forward from when snapshot logging was enabled. Historical records will show <code className="bg-gray-200 px-1 rounded">NO_SNAPSHOT_AVAILABLE</code>.</p>
                    </div>
                  </div>
                  {snapshotQ.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw size={12} className="animate-spin" /> Loading snapshots…
                    </div>
                  ) : (
                    <DataTable rows={snapshotQ.data ?? []} title="UI Input Snapshots" />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Mismatch Analysis Tab ───────────────────────────────────── */}
            <TabsContent value="mismatch" className="mt-3">
              <Card>
                <CardContent className="py-4 px-4 space-y-3">
                  <div className="space-y-2">
                    {[
                      { label: "Dashboard Value", value: String(typeof auditResult.dashboardLogicValue === "object" ? JSON.stringify(auditResult.dashboardLogicValue) : auditResult.dashboardLogicValue), sev: "info" },
                      { label: "DB Truth Value", value: String(typeof auditResult.databaseValue === "object" ? JSON.stringify(auditResult.databaseValue) : auditResult.databaseValue), sev: "info" },
                      { label: "Match Status", value: auditResult.matchStatus, sev: auditResult.matchStatus === "Match" ? "ok" : auditResult.matchStatus === "Partial" ? "warn" : "err" },
                      { label: "Date Range", value: `${dateFrom} 00:00:00 → ${dateTo} 23:59:59`, sev: "info" },
                      { label: "Date Basis Used", value: dateBasis, sev: selectedMetricDef?.defaultDateBasis && dateBasis !== selectedMetricDef.defaultDateBasis ? "warn" : "info" },
                      ...(auditResult.mismatchReasons ?? []).map((r: string) => ({ label: "Finding", value: r, sev: "finding" })),
                      { label: "Formula", value: auditResult.definition?.formulaDescription ?? "", sev: "info" },
                      { label: "Note", value: "Historical records have no snapshot data. Deploy snapshot logging to capture future UI payloads.", sev: "info" },
                    ].map(({ label, value, sev }, i) => {
                      const sevCls = { ok: "bg-green-50 border-green-200", warn: "bg-amber-50 border-amber-200", err: "bg-red-50 border-red-200", finding: "bg-orange-50 border-orange-200", info: "bg-gray-50 border-gray-200" }[sev] ?? "bg-gray-50 border-gray-200";
                      return (
                        <div key={i} className={`flex gap-3 p-2 rounded border text-xs ${sevCls}`}>
                          <span className="font-semibold w-32 shrink-0 text-gray-600">{label}</span>
                          <span className="break-all text-gray-800">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Export hint */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Download size={12} />
            <span>Use <strong>Export Excel</strong> to download a full 8-sheet workbook: Meta / Summary / Definition / Raw Rows / Stored Inputs / Related Records / Snapshots / Mismatch Analysis</span>
          </div>
        </div>
      )}
    </div>
  );
}

import * as React from "react";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import CRMLayout from "../components/CRMLayout";
import { trpc } from "@/lib/trpc";

import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, Clock, CheckCircle2, XCircle, FileText, TrendingUp, DollarSign, CalendarClock } from "lucide-react";

function fmtDate(value: unknown) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(value: unknown) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

type StageKey =
  | "due90"
  | "due60"
  | "due30"
  | "Negotiation"
  | "SentOffer"
  | "Won"
  | "Lost";

const columnConfig: { key: StageKey; title: string; icon: React.ElementType; gradient: string; headerBg: string; badgeBg: string; borderColor: string; emptyBg: string }[] = [
  {
    key: "due90",
    title: "Due in 90 days",
    icon: CalendarClock,
    gradient: "from-blue-50 to-white",
    headerBg: "bg-blue-50",
    badgeBg: "bg-blue-100 text-blue-700",
    borderColor: "border-blue-200",
    emptyBg: "border-blue-200 bg-blue-50/50",
  },
  {
    key: "due60",
    title: "Due in 60 days",
    icon: Clock,
    gradient: "from-amber-50 to-white",
    headerBg: "bg-amber-50",
    badgeBg: "bg-amber-100 text-amber-700",
    borderColor: "border-amber-200",
    emptyBg: "border-amber-200 bg-amber-50/50",
  },
  {
    key: "due30",
    title: "Due in 30 days",
    icon: AlertTriangle,
    gradient: "from-red-50 to-white",
    headerBg: "bg-red-50",
    badgeBg: "bg-red-100 text-red-700",
    borderColor: "border-red-200",
    emptyBg: "border-red-200 bg-red-50/50",
  },
  {
    key: "Negotiation",
    title: "Negotiation",
    icon: RefreshCw,
    gradient: "from-purple-50 to-white",
    headerBg: "bg-purple-50",
    badgeBg: "bg-purple-100 text-purple-700",
    borderColor: "border-purple-200",
    emptyBg: "border-purple-200 bg-purple-50/50",
  },
  {
    key: "SentOffer",
    title: "Sent Offer",
    icon: FileText,
    gradient: "from-indigo-50 to-white",
    headerBg: "bg-indigo-50",
    badgeBg: "bg-indigo-100 text-indigo-700",
    borderColor: "border-indigo-200",
    emptyBg: "border-indigo-200 bg-indigo-50/50",
  },
  {
    key: "Won",
    title: "Won",
    icon: CheckCircle2,
    gradient: "from-emerald-50 to-white",
    headerBg: "bg-emerald-50",
    badgeBg: "bg-emerald-100 text-emerald-700",
    borderColor: "border-emerald-200",
    emptyBg: "border-emerald-200 bg-emerald-50/50",
  },
  {
    key: "Lost",
    title: "Lost",
    icon: XCircle,
    gradient: "from-slate-50 to-white",
    headerBg: "bg-slate-100",
    badgeBg: "bg-slate-200 text-slate-600",
    borderColor: "border-slate-200",
    emptyBg: "border-slate-200 bg-slate-50/50",
  },
];

function daysUntil(endDate: unknown) {
  const d = endDate instanceof Date ? endDate : new Date(String(endDate));
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function normalizeStage(value: any): "New" | "Negotiation" | "SentOffer" | "Won" | "Lost" {
  const s = String(value ?? "New");
  if (s === "Renewed") return "Won";
  if (s === "NotRenewed") return "Lost";
  if (s === "Negotiation") return "Negotiation";
  if (s === "SentOffer") return "SentOffer";
  if (s === "Won") return "Won";
  if (s === "Lost") return "Lost";
  return "New";
}

function bucketFor(item: any): StageKey {
  const stage = normalizeStage(item.contractRenewalStatus);
  if (stage !== "New") return stage;
  const d = daysUntil(item.endDate);
  if (d === null) return "due90";
  if (d <= 30 && d >= 1) return "due30";
  if (d <= 60 && d >= 31) return "due60";
  return "due90";
}

function getUrgencyInfo(days: number | null) {
  if (days === null) return { label: "Unknown", color: "text-slate-400", bg: "bg-slate-100" };
  if (days < 0) return { label: "Overdue!", color: "text-red-600", bg: "bg-red-100" };
  if (days <= 7) return { label: `${days}d left`, color: "text-red-600", bg: "bg-red-100" };
  if (days <= 14) return { label: `${days}d left`, color: "text-orange-600", bg: "bg-orange-100" };
  if (days <= 30) return { label: `${days}d left`, color: "text-amber-600", bg: "bg-amber-100" };
  if (days <= 60) return { label: `${days}d left`, color: "text-blue-600", bg: "bg-blue-100" };
  return { label: `${days}d left`, color: "text-slate-500", bg: "bg-slate-100" };
}

function SortableCard({ id, item, config }: { id: string; item: any; config: typeof columnConfig[0] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? "1.02" : "1",
  };

  const days = daysUntil(item.endDate);
  const urgency = getUrgencyInfo(days);
  const clientName = item.clientName && item.clientName !== "Unknown" ? item.clientName : item.leadName || "—";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group rounded-xl border ${config.borderColor} bg-white p-3.5 shadow-sm cursor-grab active:cursor-grabbing
        hover:shadow-md hover:border-violet-300 transition-all duration-200`}
    >
      {/* Client Name */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800">{clientName}</div>
          {item.accountManagerName && (
            <div className="truncate text-xs text-slate-400 mt-0.5">AM: {item.accountManagerName}</div>
          )}
        </div>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${urgency.bg} ${urgency.color}`}>
          {urgency.label}
        </span>
      </div>

      {/* Divider */}
      <div className={`h-px ${config.borderColor} mb-2.5`} />

      {/* Details Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarClock className="h-3 w-3" />
          <span>{fmtDate(item.endDate)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
          <DollarSign className="h-3 w-3 text-emerald-500" />
          <span>{fmtMoney(item.charges)} {item.currency ?? "SAR"}</span>
        </div>
      </div>

      {/* Progress bar for days remaining */}
      {days !== null && days > 0 && days <= 90 && (
        <div className="mt-2.5">
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                days <= 7 ? "bg-red-500" :
                days <= 14 ? "bg-orange-500" :
                days <= 30 ? "bg-amber-400" :
                days <= 60 ? "bg-blue-400" :
                "bg-emerald-400"
              }`}
              style={{ width: `${Math.max(5, Math.min(100, ((90 - days) / 90) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Column({
  config,
  ids,
  byId,
}: {
  config: typeof columnConfig[0];
  ids: string[];
  byId: Map<string, any>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: config.key });
  const Icon = config.icon;

  // Calculate total value for this column
  const totalValue = ids.reduce((sum, cid) => {
    const item = byId.get(cid);
    if (!item) return sum;
    const val = Number(item.charges);
    return sum + (Number.isNaN(val) ? 0 : val);
  }, 0);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border ${config.borderColor} bg-gradient-to-b ${config.gradient} shadow-sm
        ${isOver ? "ring-2 ring-violet-400/50 border-violet-300 shadow-lg" : ""}
        transition-all duration-200`}
    >
      {/* Column Header */}
      <div className={`flex items-center justify-between ${config.headerBg} rounded-t-2xl px-4 py-3 border-b ${config.borderColor}`}>
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-1.5 ${config.badgeBg}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-700">{config.title}</div>
            {totalValue > 0 && (
              <div className="text-[10px] text-slate-500 mt-0.5">{fmtMoney(totalValue)} SAR</div>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center justify-center rounded-full min-w-[24px] h-6 px-2 text-xs font-bold ${config.badgeBg}`}>
          {ids.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2.5 p-3 min-h-[120px]">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((cid) => {
            const item = byId.get(cid);
            if (!item) return null;
            return <SortableCard key={cid} id={cid} item={item} config={config} />;
          })}
        </SortableContext>
        {ids.length === 0 && (
          <div className={`rounded-xl border border-dashed ${config.emptyBg} p-6 text-center`}>
            <div className="text-slate-300 mb-1">
              <Icon className="h-6 w-6 mx-auto" />
            </div>
            <div className="text-xs text-slate-400">Drop here</div>
          </div>
        )}
      </div>
    </div>
  );
}

// KPI Card Component
function KpiCard({
  title,
  value,
  suffix,
  icon: Icon,
  gradient,
  iconBg,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-sm border border-white/10 ${gradient}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {value}
            {suffix && <span className="text-lg ml-1 text-white/60">{suffix}</span>}
          </p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/5" />
    </div>
  );
}

export default function RenewalPipeline() {
  const renewalsQ = trpc.renewals.list.useQuery();
  const updateStageM = trpc.renewals.updateStage.useMutation({
    onSuccess: async () => {
      await renewalsQ.refetch();
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const items = renewalsQ.data ?? [];

  const byId = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const r of items) map.set(String(r.contractId), r);
    return map;
  }, [items]);

  const grouped = React.useMemo(() => {
    const g: Record<StageKey, string[]> = {
      due90: [],
      due60: [],
      due30: [],
      Negotiation: [],
      SentOffer: [],
      Won: [],
      Lost: [],
    };

    for (const r of items) {
      const key = bucketFor(r);
      g[key].push(String(r.contractId));
    }

    return g;
  }, [items]);

  // Calculate KPI stats
  const stats = React.useMemo(() => {
    const total = items.length;
    const totalValue = items.reduce((sum, r) => sum + (Number(r.charges) || 0), 0);
    const urgentCount = items.filter(r => {
      const d = daysUntil(r.endDate);
      return d !== null && d <= 30 && d >= 0;
    }).length;
    const wonCount = grouped.Won.length;
    const wonValue = grouped.Won.reduce((sum, cid) => {
      const item = byId.get(cid);
      return sum + (Number(item?.charges) || 0);
    }, 0);

    return { total, totalValue, urgentCount, wonCount, wonValue };
  }, [items, grouped, byId]);

  function findColumnForId(id: string): StageKey | null {
    for (const col of columnConfig) {
      if (grouped[col.key].includes(id)) return col.key;
    }
    return null;
  }

  async function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overRaw = e.over?.id ? String(e.over.id) : null;
    if (!overRaw) return;

    const item = byId.get(activeId);
    if (!item) return;

    const fromCol = bucketFor(item);
    const toCol = (columnConfig.some((c) => c.key === (overRaw as any))
      ? (overRaw as StageKey)
      : findColumnForId(overRaw)) as StageKey | null;

    if (!toCol) return;
    if (fromCol === toCol) return;

    let stage: any = "New";
    if (toCol === "Negotiation" || toCol === "SentOffer" || toCol === "Won" || toCol === "Lost") {
      stage = toCol;
    } else {
      stage = "New";
    }

    await updateStageM.mutateAsync({ contractId: Number(activeId), stage });
  }

  return (
    <CRMLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Renewal Pipeline</h1>
            <p className="text-sm text-slate-500 mt-1">Drag cards between columns to update renewal stage</p>
          </div>
          <button
            onClick={() => renewalsQ.refetch()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${renewalsQ.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Total Renewals"
            value={stats.total}
            icon={RefreshCw}
            gradient="bg-gradient-to-br from-violet-600 to-indigo-700"
            iconBg="bg-white/20"
          />
          <KpiCard
            title="Total Value"
            value={fmtMoney(stats.totalValue)}
            suffix="SAR"
            icon={DollarSign}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            iconBg="bg-white/20"
          />
          <KpiCard
            title="Urgent (30 days)"
            value={stats.urgentCount}
            icon={AlertTriangle}
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            iconBg="bg-white/20"
          />
          <KpiCard
            title="Won Renewals"
            value={stats.wonCount}
            suffix={stats.wonValue > 0 ? `(${fmtMoney(stats.wonValue)} SAR)` : ""}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-sky-500 to-blue-600"
            iconBg="bg-white/20"
          />
        </div>

        {/* Pipeline Board */}
        {renewalsQ.isLoading ? (
          <div className="rounded-2xl border bg-white p-16 text-center shadow-sm">
            <RefreshCw className="h-8 w-8 text-violet-400 mx-auto animate-spin mb-3" />
            <div className="text-sm text-slate-500">Loading renewals...</div>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
              {columnConfig.map((c) => (
                <Column key={c.key} config={c} ids={grouped[c.key]} byId={byId} />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </CRMLayout>
  );
}

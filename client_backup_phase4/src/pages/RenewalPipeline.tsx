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

function fmtDate(value: unknown) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function fmtMoney(value: unknown) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

type StageKey =
  | "due90"
  | "due60"
  | "due30"
  | "Negotiation"
  | "SentOffer"
  | "Won"
  | "Lost";

const columns: { key: StageKey; title: string }[] = [
  { key: "due90", title: "Due in 90 days" },
  { key: "due60", title: "Due in 60 days" },
  { key: "due30", title: "Due in 30 days" },
  { key: "Negotiation", title: "Negotiation" },
  { key: "SentOffer", title: "Sent Offer" },
  { key: "Won", title: "Won" },
  { key: "Lost", title: "Lost" },
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
  // Use contractRenewalStatus (our actual column name)
  const stage = normalizeStage(item.contractRenewalStatus);
  if (stage !== "New") return stage;
  const d = daysUntil(item.endDate);
  if (d === null) return "due90";
  if (d <= 30 && d >= 1) return "due30";
  if (d <= 60 && d >= 31) return "due60";
  return "due90";
}

function SortableCard({ id, item }: { id: string; item: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-2xl border bg-background p-3 shadow-sm cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{item.clientName ?? "Unknown"}</div>
          <div className="mt-1 text-xs text-muted-foreground">End: {fmtDate(item.endDate)}</div>
        </div>
        <Badge variant="outline" className="shrink-0">
          {fmtMoney(item.charges)} {item.currency ?? "SAR"}
        </Badge>
      </div>
    </div>
  );
}

function Column({
  colKey,
  title,
  ids,
  byId,
}: {
  colKey: StageKey;
  title: string;
  ids: string[];
  byId: Map<string, any>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });

  return (
    <div ref={setNodeRef} className={`rounded-2xl border bg-card shadow-sm ${isOver ? "ring-2 ring-primary/30" : ""}`}>
      <div className="flex items-center justify-between border-b p-3">
        <div className="text-sm font-semibold">{title}</div>
        <Badge variant="secondary" className="text-xs">{ids.length}</Badge>
      </div>

      <div className="space-y-2 p-3 min-h-[100px]">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((cid) => {
            const item = byId.get(cid);
            if (!item) return null;
            return <SortableCard key={cid} id={cid} item={item} />;
          })}
        </SortableContext>
        {ids.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Drop here</div>
        ) : null}
      </div>
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

  function findColumnForId(id: string): StageKey | null {
    for (const col of columns) {
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
    const toCol = (columns.some((c) => c.key === (overRaw as any))
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
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Renewal Pipeline</h1>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Drag cards between columns to update renewal stage.</div>
        </div>

        {renewalsQ.isLoading ? (
          <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">Loading...</div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
              {columns.map((c) => (
                <Column key={c.key} colKey={c.key} title={c.title} ids={grouped[c.key]} byId={byId} />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </CRMLayout>
  );
}

import CRMLayout from "@/components/CRMLayout";
import LeadQualityBadge from "@/components/LeadQualityBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Copy,
  Download,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { endOfDay, format, startOfDay } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { PhoneInput } from "@/components/PhoneInput";
import { CountrySelect } from "@/components/CountrySelect";
import { countries } from "@/lib/countries-data";

const LEAD_QUALITIES = ["Hot", "Warm", "Cold", "Bad", "Unknown"];

type VisibleColumnKey =
  | "name"
  | "phone"
  | "quality"
  | "fitStatus"
  | "classification"
  | "stage"
  | "campaign"
  | "owner"
  | "contactDate"
  | "createdAt"
  | "actions";

type ClassificationType = "Lead" | "Prospect" | "Opportunity";
const classificationConfig: Record<
  ClassificationType,
  { label: string; labelAr: string; color: string; bg: string; border: string; icon: string }
> = {
  Lead: {
    label: "Lead",
    labelAr: "عميل محتمل",
    color: "#3b82f6",
    bg: "bg-blue-50",
    border: "border-blue-300",
    icon: "🔵",
  },
  Prospect: {
    label: "Prospect",
    labelAr: "عميل مهتم",
    color: "#f59e0b",
    bg: "bg-amber-50",
    border: "border-amber-300",
    icon: "🟡",
  },
  Opportunity: {
    label: "Opportunity",
    labelAr: "فرصة بيع",
    color: "#22c55e",
    bg: "bg-green-50",
    border: "border-green-300",
    icon: "🟢",
  },
};

function getLeadClassificationSimple(
  stage: string,
  quality: string | null | undefined,
  fitStatus: string | null | undefined
): ClassificationType {
  const q = quality ?? "Unknown";
  const fs = fitStatus ?? "Pending";
  if (["Proposal Delivered", "Won"].includes(stage)) return "Opportunity";
  if (["Proposal Delivered"].includes(stage) && q === "Hot") return "Opportunity";
  if (["Meeting Scheduled"].includes(stage) && ["Hot", "Warm"].includes(q)) return "Prospect";
  if (["Leads"].includes(stage) && fs === "Fit") return "Prospect";
  if (["Meeting Scheduled"].includes(stage)) return "Prospect";
  if (["Leads"].includes(stage) && ["Hot", "Warm"].includes(q)) return "Prospect";
  return "Lead";
}

const STAGES = ["New", "Contacted", "Meeting", "Offer Sent", "Won", "Lost", "Follow Up"];

const ALL_COLUMNS: VisibleColumnKey[] = [
  "name",
  "phone",
  "quality",
  "fitStatus",
  "classification",
  "stage",
  "campaign",
  "owner",
  "contactDate",
  "createdAt",
  "actions",
];

const NON_HIDEABLE_COLUMNS: VisibleColumnKey[] = ["name", "actions"];

function getInitialParams() {
  return new URLSearchParams(window.location.search);
}

function getInitialPage() {
  const raw = Number(getInitialParams().get("page") ?? "0");
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function getInitialDateRange(): DateRange | undefined {
  const params = getInitialParams();
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  if (!dateFrom && !dateTo) return undefined;

  return {
    from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined,
    to: dateTo ? new Date(`${dateTo}T00:00:00`) : undefined,
  };
}

function getInitialVisibleColumns(): VisibleColumnKey[] {
  const raw = getInitialParams().get("columns");
  if (!raw) return ALL_COLUMNS;

  const parsed = raw
    .split(",")
    .map((key) => key.trim())
    .filter((key): key is VisibleColumnKey => ALL_COLUMNS.includes(key as VisibleColumnKey));

  if (!parsed.length) return ALL_COLUMNS;

  const merged = Array.from(new Set<VisibleColumnKey>([...NON_HIDEABLE_COLUMNS, ...parsed]));
  return ALL_COLUMNS.filter((key) => merged.includes(key));
}

export default function LeadsList() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();

  const initialParams = useMemo(() => getInitialParams(), []);

  const [search, setSearch] = useState(() => initialParams.get("search") ?? "");
  const [stage, setStage] = useState<string>(() => initialParams.get("stage") ?? "all");
  const [quality, setQuality] = useState<string>(() => initialParams.get("quality") ?? "all");
  const [fitStatusFilter, setFitStatusFilter] = useState<string>(() => initialParams.get("fitStatus") ?? "all");
  const [campaign, setCampaign] = useState<string>(() => initialParams.get("campaign") ?? "");
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [slaBreached, setSlaBreached] = useState(() => initialParams.get("slaBreached") === "true");
  const [page, setPage] = useState(getInitialPage);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportLimit, setExportLimit] = useState(100);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getInitialDateRange);
  const [ownerId, setOwnerId] = useState<string>(() => initialParams.get("ownerId") ?? "all");
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnKey[]>(getInitialVisibleColumns);

  const limit = 20;

  const isAdminOrManager = ["Admin", "SalesManager", "admin"].includes(user?.role ?? "");

  const columnMeta = useMemo(
    () =>
      ({
        name: {
          labelAr: "اسم العميل",
          labelEn: "Lead Name",
          canHide: false,
          minWidth: "min-w-[260px]",
        },
        phone: {
          labelAr: "رقم الهاتف",
          labelEn: "Phone",
          canHide: true,
          minWidth: "min-w-[150px]",
        },
        quality: {
          labelAr: "جودة العميل",
          labelEn: "Lead Quality",
          canHide: true,
          minWidth: "min-w-[140px]",
        },
        fitStatus: {
          labelAr: "حالة الملاءمة",
          labelEn: "Fit Status",
          canHide: true,
          minWidth: "min-w-[150px]",
        },
        classification: {
          labelAr: "التصنيف",
          labelEn: "Classification",
          canHide: true,
          minWidth: "min-w-[140px]",
        },
        stage: {
          labelAr: "المرحلة",
          labelEn: "Stage",
          canHide: true,
          minWidth: "min-w-[130px]",
        },
        campaign: {
          labelAr: "الحملة",
          labelEn: "Campaign",
          canHide: true,
          minWidth: "min-w-[150px]",
        },
        owner: {
          labelAr: "المسؤول",
          labelEn: "Sales Agent",
          canHide: true,
          minWidth: "min-w-[150px]",
        },
        contactDate: {
          labelAr: "تاريخ التواصل",
          labelEn: "Contact Date",
          canHide: true,
          minWidth: "min-w-[155px]",
        },
        createdAt: {
          labelAr: "تاريخ الإنشاء",
          labelEn: "Created At",
          canHide: true,
          minWidth: "min-w-[125px]",
        },
        actions: {
          labelAr: "إجراءات",
          labelEn: "Actions",
          canHide: false,
          minWidth: "min-w-[130px]",
        },
      }) satisfies Record<VisibleColumnKey, { labelAr: string; labelEn: string; canHide: boolean; minWidth: string }>,
    []
  );

  const orderedVisibleColumns = useMemo(() => {
    const middleColumns = ALL_COLUMNS.filter(
      (key) => key !== "name" && key !== "actions" && visibleColumns.includes(key)
    );
    return ["name", ...middleColumns, "actions"] as VisibleColumnKey[];
  }, [visibleColumns]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");

    if (stage !== "all") params.set("stage", stage);
    else params.delete("stage");

    if (quality !== "all") params.set("quality", quality);
    else params.delete("quality");

    if (fitStatusFilter !== "all") params.set("fitStatus", fitStatusFilter);
    else params.delete("fitStatus");

    if (campaign) params.set("campaign", campaign);
    else params.delete("campaign");

    if (ownerId !== "all") params.set("ownerId", ownerId);
    else params.delete("ownerId");

    if (slaBreached) params.set("slaBreached", "true");
    else params.delete("slaBreached");

    if (dateRange?.from) params.set("dateFrom", format(dateRange.from, "yyyy-MM-dd"));
    else params.delete("dateFrom");

    if (dateRange?.to) params.set("dateTo", format(dateRange.to, "yyyy-MM-dd"));
    else params.delete("dateTo");

    params.set("page", String(page));
    params.set("columns", visibleColumns.join(","));

    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [
    campaign,
    dateRange?.from,
    dateRange?.to,
    fitStatusFilter,
    ownerId,
    page,
    quality,
    search,
    slaBreached,
    stage,
    visibleColumns,
  ]);

  useEffect(() => {
    let didReset = false;

    if (!visibleColumns.includes("stage") && stage !== "all") {
      setStage("all");
      didReset = true;
    }
    if (!visibleColumns.includes("quality") && quality !== "all") {
      setQuality("all");
      didReset = true;
    }
    if (!visibleColumns.includes("fitStatus") && fitStatusFilter !== "all") {
      setFitStatusFilter("all");
      didReset = true;
    }
    if (!visibleColumns.includes("campaign") && campaign) {
      setCampaign("");
      didReset = true;
    }
    if (!visibleColumns.includes("owner") && ownerId !== "all") {
      setOwnerId("all");
      didReset = true;
    }

    if (didReset) setPage(0);
  }, [visibleColumns, stage, quality, fitStatusFilter, campaign, ownerId]);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(exportLimit));
      if (stage !== "all") params.set("stage", stage);
      if (quality !== "all") params.set("leadQuality", quality);
      if (fitStatusFilter !== "all") params.set("fitStatus", fitStatusFilter);
      if (campaign) params.set("campaignName", campaign);
      if (slaBreached) params.set("slaBreached", "true");
      if (search) params.set("search", search);
      if (ownerId !== "all") params.set("ownerId", ownerId);
      if (dateRange?.from) params.set("dateFrom", format(startOfDay(dateRange.from), "yyyy-MM-dd'T'HH:mm:ss"));
      if (dateRange?.to) params.set("dateTo", format(endOfDay(dateRange.to), "yyyy-MM-dd'T'HH:mm:ss"));

      const res = await fetch(`/api/export/leads?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        toast.error(isRTL ? "خطأ في التصدير" : "Export failed", { description: err.error });
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success(isRTL ? "تم تصدير الملف بنجاح" : "File exported successfully");
      setShowExport(false);
    } catch (e: any) {
      toast.error(isRTL ? "خطأ" : "Error", { description: e.message });
    } finally {
      setExporting(false);
    }
  }

  const { data, isLoading, refetch } = trpc.leads.list.useQuery({
    search: search || undefined,
    stage: stage !== "all" ? stage : undefined,
    leadQuality: quality !== "all" ? quality : undefined,
    fitStatus: fitStatusFilter !== "all" ? fitStatusFilter : undefined,
    campaignName: campaign || undefined,
    slaBreached: slaBreached || undefined,
    ownerId: ownerId !== "all" ? Number(ownerId) : undefined,
    dateFrom: dateRange?.from ? startOfDay(dateRange.from) : undefined,
    dateTo: dateRange?.to ? endOfDay(dateRange.to) : undefined,
    limit,
    offset: page * limit,
  });

  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: distinctCampaignNames } = trpc.campaigns.distinctNames.useQuery();
  const { data: stages } = trpc.pipeline.list.useQuery();
  const { data: users } = trpc.users.list.useQuery(undefined, {
    enabled: isAdminOrManager,
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [quickActivityLeadId, setQuickActivityLeadId] = useState<number | null>(null);
  const [quickActivityType, setQuickActivityType] = useState("Call");
  const [quickActivityOutcome, setQuickActivityOutcome] = useState("Interested");
  const [quickActivityNotes, setQuickActivityNotes] = useState("");

  const createQuickActivity = trpc.activities.create.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تسجيل النشاط" : "Activity logged");
      setQuickActivityLeadId(null);
      setQuickActivityNotes("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success(t("success"));
      setShowNewLead(false);
      refetch();
      reset();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف العميل بنجاح" : "Lead deleted successfully");
      setDeleteConfirmId(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      name: "",
      phone: "",
      country: "Saudi Arabia",
      businessProfile: "",
      leadQuality: "Unknown" as const,
      campaignName: "",
      adCreative: "",
      ownerId: undefined as number | undefined,
      stage: "New",
      notes: "",
    },
  });

  const [contactDateError, setContactDateError] = useState(false);
  const [phoneValid, setPhoneValid] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [campaignError, setCampaignError] = useState(false);

  const onSubmit = (formData: any) => {
    if (!phoneValid) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);

    if (!formData.campaignName) {
      setCampaignError(true);
      return;
    }
    setCampaignError(false);

    if (!formData.contactTime) {
      setContactDateError(true);
      return;
    }
    setContactDateError(false);

    if (!formData.ownerId && user?.role === "SalesAgent" && user?.id) {
      formData.ownerId = user.id;
    }

    createLead.mutate(formData);
  };

  const stageColor: Record<string, string> = {
    New: "#6366f1",
    Contacted: "#3b82f6",
    Meeting: "#f59e0b",
    "Offer Sent": "#8b5cf6",
    Won: "#22c55e",
    Lost: "#ef4444",
    "Follow Up": "#06b6d4",
  };

  const stickyNameClass = isRTL
    ? "sticky right-0 z-20 bg-background shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.25)]"
    : "sticky left-0 z-20 bg-background shadow-[8px_0_12px_-12px_rgba(15,23,42,0.25)]";
  const stickyNameHeaderClass = isRTL
    ? "sticky right-0 z-30 bg-muted/95 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.25)]"
    : "sticky left-0 z-30 bg-muted/95 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.25)]";
  const stickyActionsClass = isRTL
    ? "sticky left-0 z-20 bg-background shadow-[8px_0_12px_-12px_rgba(15,23,42,0.25)]"
    : "sticky right-0 z-20 bg-background shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.25)]";
  const stickyActionsHeaderClass = isRTL
    ? "sticky left-0 z-30 bg-muted/95 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.25)]"
    : "sticky right-0 z-30 bg-muted/95 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.25)]";

  const hasActiveFilters =
    !!search ||
    stage !== "all" ||
    quality !== "all" ||
    fitStatusFilter !== "all" ||
    !!campaign ||
    slaBreached ||
    !!dateRange?.from ||
    !!dateRange?.to ||
    ownerId !== "all";

  const resetFilters = () => {
    setSearch("");
    setStage("all");
    setQuality("all");
    setFitStatusFilter("all");
    setCampaign("");
    setSlaBreached(false);
    setDateRange(undefined);
    setOwnerId("all");
    setPage(0);
  };

  const toggleColumn = (columnKey: VisibleColumnKey) => {
    if (NON_HIDEABLE_COLUMNS.includes(columnKey)) return;

    setVisibleColumns((prev) => {
      if (prev.includes(columnKey)) {
        return ALL_COLUMNS.filter((key) => key !== columnKey && prev.includes(key));
      }
      const merged = Array.from(new Set<VisibleColumnKey>([...prev, columnKey]));
      return ALL_COLUMNS.filter((key) => merged.includes(key));
    });
  };

  const renderColumnHeader = (columnKey: VisibleColumnKey) => {
    const baseClass = `text-start px-4 py-3 font-medium text-muted-foreground whitespace-nowrap ${columnMeta[columnKey].minWidth}`;

    if (columnKey === "name") {
      return (
        <th className={`${baseClass} ${stickyNameHeaderClass}`}>
          {isRTL ? columnMeta.name.labelAr : columnMeta.name.labelEn}
        </th>
      );
    }

    if (columnKey === "actions") {
      return (
        <th className={`${baseClass} ${stickyActionsHeaderClass}`}>
          {isRTL ? columnMeta.actions.labelAr : columnMeta.actions.labelEn}
        </th>
      );
    }

    return <th className={baseClass}>{isRTL ? columnMeta[columnKey].labelAr : columnMeta[columnKey].labelEn}</th>;
  };

  const renderColumnCell = (lead: any, columnKey: VisibleColumnKey) => {
    const ownerName = lead.ownerId
      ? (users ?? []).find((u: any) => u.id === lead.ownerId)?.name ?? "—"
      : "—";

    if (columnKey === "name") {
      return (
        <td className={`px-4 py-3 ${columnMeta.name.minWidth} ${stickyNameClass}`}>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
              style={{ background: tokens.primaryColor }}
            >
              {(lead.name ?? lead.phone)?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground whitespace-nowrap">{lead.name ?? "—"}</span>
                {lead.slaBreached && <AlertTriangle size={12} className="text-destructive shrink-0" />}
                {lead.isDuplicate && <Copy size={11} className="text-muted-foreground shrink-0" />}
              </div>
              {lead.businessProfile && (
                <span className="text-xs text-muted-foreground truncate max-w-40 block">{lead.businessProfile}</span>
              )}
            </div>
          </div>
        </td>
      );
    }

    if (columnKey === "phone") {
      return (
        <td className={`px-4 py-3 ${columnMeta.phone.minWidth}`}>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Phone size={12} className="text-muted-foreground" />
            <span className="font-mono text-xs">{lead.phone}</span>
          </div>
        </td>
      );
    }

    if (columnKey === "quality") {
      return (
        <td className={`px-4 py-3 ${columnMeta.quality.minWidth}`}>
          <LeadQualityBadge quality={lead.leadQuality} size="sm" />
        </td>
      );
    }

    if (columnKey === "fitStatus") {
      return (
        <td className={`px-4 py-3 ${columnMeta.fitStatus.minWidth}`}>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
              (lead as any).fitStatus === "Fit"
                ? "bg-green-50 border-green-200 text-green-700"
                : (lead as any).fitStatus === "Not Fit"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-yellow-50 border-yellow-200 text-yellow-700"
            }`}
          >
            {(lead as any).fitStatus === "Fit" ? "✅" : (lead as any).fitStatus === "Not Fit" ? "❌" : "⏳"}{" "}
            {(lead as any).fitStatus ?? "Pending"}
          </span>
        </td>
      );
    }

    if (columnKey === "classification") {
      const cls = getLeadClassificationSimple(lead.stage, lead.leadQuality, (lead as any).fitStatus);
      const cfg = classificationConfig[cls];
      return (
        <td className={`px-4 py-3 ${columnMeta.classification.minWidth}`}>
          <span className="text-xs font-bold whitespace-nowrap" style={{ color: cfg.color }}>
            {isRTL ? cfg.labelAr : cfg.label}
          </span>
        </td>
      );
    }

    if (columnKey === "stage") {
      return (
        <td className={`px-4 py-3 ${columnMeta.stage.minWidth}`}>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
            style={{ background: stageColor[lead.stage] ?? "#6366f1" }}
          >
            {t(lead.stage as any)}
          </span>
        </td>
      );
    }

    if (columnKey === "campaign") {
      return (
        <td className={`px-4 py-3 ${columnMeta.campaign.minWidth}`}>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{lead.campaignName ?? "—"}</span>
        </td>
      );
    }

    if (columnKey === "owner") {
      return (
        <td className={`px-4 py-3 ${columnMeta.owner.minWidth}`}>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{ownerName}</span>
        </td>
      );
    }

    if (columnKey === "contactDate") {
      return (
        <td className={`px-4 py-3 ${columnMeta.contactDate.minWidth}`}>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {lead.contactTime ? format(new Date(lead.contactTime), "dd/MM/yyyy HH:mm") : "—"}
          </span>
        </td>
      );
    }

    if (columnKey === "createdAt") {
      return (
        <td className={`px-4 py-3 ${columnMeta.createdAt.minWidth}`}>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(lead.createdAt), "dd/MM/yyyy")}
          </span>
        </td>
      );
    }

    return (
      <td className={`px-4 py-3 ${columnMeta.actions.minWidth} ${stickyActionsClass}`}>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Link href={`/leads/${lead.id}`}>
            <Button variant="ghost" size="sm" className="text-xs h-7">
              {t("view")}
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            title={isRTL ? "إضافة نشاط" : "Add Activity"}
            onClick={(e) => {
              e.stopPropagation();
              setQuickActivityLeadId(lead.id);
            }}
          >
            <MessageSquare size={14} />
          </Button>
          {(user?.role === "Admin" || user?.role === "admin") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteConfirmId(lead.id)}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    );
  };

  return (
    <CRMLayout>
      <div className="p-6 space-y-4 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("leads")}</h1>
            <p className="text-muted-foreground text-sm">
              {data?.total ?? 0} {t("count")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(user?.role === "Admin" || user?.role === "admin" || user?.role === "SalesManager") && (
              <Button variant="outline" onClick={() => setShowExport(true)} className="gap-2">
                <Download size={16} />
                {isRTL ? "تصدير Excel" : "Export Excel"}
              </Button>
            )}
            {user?.role !== "MediaBuyer" && (
              <Button
                onClick={() => setShowNewLead(true)}
                style={{ background: tokens.primaryColor }}
                className="text-white gap-2"
              >
                <Plus size={16} />
                {t("newLead")}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2 flex-1 min-w-[240px]">
                <Label>{t("search")}</Label>
                <div className="relative">
                  <Search
                    size={14}
                    className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${
                      isRTL ? "right-3" : "left-3"
                    }`}
                  />
                  <Input
                    placeholder={t("search")}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    className={isRTL ? "pr-9" : "pl-9"}
                  />
                </div>
              </div>

              <div className="space-y-2 min-w-[250px]">
                <Label>{isRTL ? "النطاق الزمني" : "Date Range"}</Label>
                <DateRangePicker
                  date={dateRange}
                  setDate={(d) => {
                    setDateRange(d);
                    setPage(0);
                  }}
                />
              </div>

              {visibleColumns.includes("stage") && (
                <div className="space-y-2 min-w-[150px]">
                  <Label>{isRTL ? "المرحلة" : "Stage"}</Label>
                  <Select
                    value={stage}
                    onValueChange={(v) => {
                      setStage(v);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder={t("stage")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all")}</SelectItem>
                      {(stages ?? STAGES.map((s) => ({ name: s, nameAr: s }))).map((s: any) => (
                        <SelectItem key={s.name} value={s.name}>
                          {isRTL && s.nameAr ? s.nameAr : s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {visibleColumns.includes("quality") && (
                <div className="space-y-2 min-w-[150px]">
                  <Label>{isRTL ? "جودة العميل" : "Lead Quality"}</Label>
                  <Select
                    value={quality}
                    onValueChange={(v) => {
                      setQuality(v);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder={t("leadQuality")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all")}</SelectItem>
                      {LEAD_QUALITIES.map((q) => (
                        <SelectItem key={q} value={q}>
                          {t(q as any)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {visibleColumns.includes("fitStatus") && (
                <div className="space-y-2 min-w-[150px]">
                  <Label>{isRTL ? "حالة الملاءمة" : "Fit Status"}</Label>
                  <Select
                    value={fitStatusFilter}
                    onValueChange={(v) => {
                      setFitStatusFilter(v);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder={isRTL ? "حالة الملاءمة" : "Fit Status"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all")}</SelectItem>
                      <SelectItem value="Fit">✅ Fit</SelectItem>
                      <SelectItem value="Not Fit">❌ Not Fit</SelectItem>
                      <SelectItem value="Pending">⏳ Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {visibleColumns.includes("campaign") && (
                <div className="space-y-2 min-w-[170px]">
                  <Label>{isRTL ? "الحملة" : "Campaign"}</Label>
                  <Popover open={campaignOpen} onOpenChange={setCampaignOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={campaignOpen}
                        className="w-[220px] justify-between text-sm font-normal h-9 truncate"
                      >
                        <span className="truncate">
                          {campaign
                            ? campaign.length > 24
                              ? campaign.slice(0, 24) + "…"
                              : campaign
                            : isRTL ? "الكل" : "All"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={isRTL ? "ابحث عن حملة..." : "Search campaigns..."} />
                        <CommandList>
                          <CommandEmpty>{isRTL ? "لا توجد نتائج" : "No campaigns found."}</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="__all__"
                              onSelect={() => {
                                setCampaign("");
                                setPage(0);
                                setCampaignOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${!campaign ? "opacity-100" : "opacity-0"}`} />
                              {isRTL ? "الكل" : "All"}
                            </CommandItem>
                            {distinctCampaignNames?.map((name, idx) => (
                              <CommandItem
                                key={`campaign-${idx}-${name}`}
                                value={name}
                                keywords={[name]}
                                onSelect={() => {
                                  setCampaign(name === campaign ? "" : name);
                                  setPage(0);
                                  setCampaignOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${campaign === name ? "opacity-100" : "opacity-0"}`} />
                                {name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {isAdminOrManager && visibleColumns.includes("owner") && (
                <div className="space-y-2 min-w-[180px]">
                  <Label>{isRTL ? "المسؤول" : "Sales Agent"}</Label>
                  <Select
                    value={ownerId}
                    onValueChange={(v) => {
                      setOwnerId(v);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={isRTL ? "المسؤول" : "Sales Agent"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all")}</SelectItem>
                      {users
                        ?.filter((u: any) => u.role === "SalesAgent")
                        .map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                variant={slaBreached ? "destructive" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setSlaBreached(!slaBreached);
                  setPage(0);
                }}
              >
                <AlertTriangle size={14} />
                {t("slaAlerts")}
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <SlidersHorizontal size={14} />
                    {isRTL ? "الأعمدة" : "Columns"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align={isRTL ? "start" : "end"} dir={isRTL ? "rtl" : "ltr"}>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm">{isRTL ? "إظهار/إخفاء الأعمدة" : "Show / hide columns"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRTL ? "يمكنك تخصيص الأعمدة الظاهرة في الجدول." : "Customize which columns are visible in the table."}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {ALL_COLUMNS.map((columnKey) => {
                        const meta = columnMeta[columnKey];
                        const checked = visibleColumns.includes(columnKey);
                        return (
                          <label
                            key={columnKey}
                            className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                              meta.canHide ? "cursor-pointer hover:bg-muted/40" : "bg-muted/40"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="font-medium">{isRTL ? meta.labelAr : meta.labelEn}</div>
                              {!meta.canHide && (
                                <div className="text-[11px] text-muted-foreground">
                                  {isRTL ? "عمود ثابت" : "Always visible"}
                                </div>
                              )}
                            </div>
                            <Checkbox
                              checked={checked}
                              disabled={!meta.canHide}
                              onCheckedChange={() => toggleColumn(columnKey)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={resetFilters}>
                  <X size={14} />
                  {t("clear")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : !data?.items?.length ? (
              <div className="py-16 text-center text-muted-foreground">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p>{t("noData")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm" dir={isRTL ? "rtl" : "ltr"}>
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {orderedVisibleColumns.map((columnKey) => (
                        <Fragment key={columnKey}>{renderColumnHeader(columnKey)}</Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((lead) => (
                      <tr
                        key={lead.id}
                        className={`border-b border-border hover:bg-muted/30 transition-colors ${
                          lead.slaBreached ? "sla-breached-row" : ""
                        }`}
                      >
                        {orderedVisibleColumns.map((columnKey) => (
                          <Fragment key={columnKey}>{renderColumnCell(lead, columnKey)}</Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(data?.total ?? 0) > limit && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {page * limit + 1}–{Math.min((page + 1) * limit, data?.total ?? 0)} {t("count")} {data?.total ?? 0}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  >
                    {t("previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * limit >= (data?.total ?? 0)}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    {t("next")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showNewLead} onOpenChange={setShowNewLead}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Plus size={20} style={{ color: tokens.primaryColor }} />
              {t("newLead")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {isRTL ? "أدخل بيانات العميل المحتمل الجديد" : "Enter the new lead's information"}
            </p>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {isRTL ? "معلومات التواصل" : "Contact Information"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("leadName")}</Label>
                  <Input {...register("name")} placeholder={isRTL ? "اسم العميل" : "Lead name"} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("contactDate")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="datetime-local"
                    className={`h-10 ${contactDateError ? "border-red-500 ring-1 ring-red-500" : ""}`}
                    onChange={(e) => {
                      setValue("contactTime", new Date(e.target.value));
                      setContactDateError(false);
                    }}
                  />
                  {contactDateError && (
                    <p className="text-red-500 text-xs">
                      {isRTL ? "وقت التواصل مطلوب" : "Contact date is required"}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("phone")} <span className="text-red-500">*</span>
                </Label>
                <PhoneInput
                  value={watch("phone")}
                  onChange={(fullPhone, valid) => {
                    setValue("phone", fullPhone);
                    setPhoneValid(valid);
                    if (valid) setPhoneError(false);
                    const sorted = [...countries].sort((a, b) => b.phoneCode.length - a.phoneCode.length);
                    for (const c of sorted) {
                      if (fullPhone.startsWith(c.phoneCode)) {
                        setValue("country", c.name);
                        break;
                      }
                    }
                  }}
                  defaultCountryCode="SA"
                  isRTL={isRTL}
                  error={phoneError}
                />
                {phoneError && (
                  <p className="text-red-500 text-xs">{isRTL ? "رقم الهاتف غير صحيح" : "Invalid phone number"}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("country")}</Label>
                  <CountrySelect value={watch("country")} onChange={(name) => setValue("country", name)} isRTL={isRTL} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("businessProfile")}</Label>
                  <Input
                    {...register("businessProfile")}
                    placeholder={isRTL ? "نشاط العميل" : "Business profile"}
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {isRTL ? "تفاصيل العميل" : "Lead Details"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("leadQuality")}</Label>
                  <Select onValueChange={(v) => setValue("leadQuality", v as any)} defaultValue="Unknown">
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_QUALITIES.map((q) => (
                        <SelectItem key={q} value={q}>
                          {t(q as any)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{isRTL ? "حالة الملاءمة" : "Fit Status"}</Label>
                  <Select onValueChange={(v) => setValue("fitStatus", v as any)} defaultValue="Pending">
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fit">{isRTL ? "✅ مناسب" : "✅ Fit"}</SelectItem>
                      <SelectItem value="Not Fit">{isRTL ? "❌ غير مناسب" : "❌ Not Fit"}</SelectItem>
                      <SelectItem value="Pending">{isRTL ? "⏳ قيد المراجعة" : "⏳ Pending"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("stage")}</Label>
                  <Select onValueChange={(v) => setValue("stage", v)} defaultValue="New">
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(s as any)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("campaign")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(v) => {
                      setValue("campaignName", v === "none" ? "" : v);
                      if (v && v !== "none") setCampaignError(false);
                    }}
                  >
                    <SelectTrigger className={`h-10 ${campaignError ? "border-red-500 ring-1 ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("selectOption")} />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {campaignError && (
                    <p className="text-red-500 text-xs">{isRTL ? "الحملة مطلوبة" : "Campaign is required"}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("adCreative") || "الإعلان"}</Label>
                  <Input {...register("adCreative")} placeholder={isRTL ? "اسم الإعلان" : "Ad creative name"} className="h-10" />
                </div>
              </div>
            </div>

            {isAdminOrManager && (
              <>
                <div className="border-t border-border" />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {isRTL ? "التعيين" : "Assignment"}
                  </h3>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("owner")}</Label>
                    <Select onValueChange={(v) => setValue("ownerId", v === "none" ? undefined : Number(v))}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={t("selectOption")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {users
                          ?.filter((u) => u.role === "SalesAgent")
                          .map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {u.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-border" />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {isRTL ? "ملاحظات" : "Notes"}
              </h3>
              <div className="space-y-2">
                <Textarea
                  {...register("notes")}
                  className="min-h-[80px] resize-y"
                  placeholder={isRTL ? "اكتب ملاحظاتك هنا..." : "Write your notes here..."}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-border">
              <Button type="button" variant="outline" size="lg" onClick={() => setShowNewLead(false)}>
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                size="lg"
                style={{ background: tokens.primaryColor }}
                className="text-white min-w-[120px]"
                disabled={createLead.isPending}
              >
                {createLead.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> {t("loading")}
                  </span>
                ) : (
                  t("save")
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-sm" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download size={18} />
              {isRTL ? "تصدير العملاء إلى Excel" : "Export Leads to Excel"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              {isRTL ? "سيتم تطبيق الفلاتر الحالية على التصدير." : "Current filters will be applied to the export."}
            </p>

            {hasActiveFilters && (
              <div className="text-xs bg-muted rounded-md p-3 space-y-1">
                <p className="font-medium text-foreground">{isRTL ? "الفلاتر المفعلة:" : "Active filters:"}</p>
                {stage !== "all" && <p>• {t("stage")}: {stage}</p>}
                {fitStatusFilter !== "all" && <p>• {isRTL ? "حالة الملاءمة" : "Fit Status"}: {fitStatusFilter}</p>}
                {quality !== "all" && <p>• {t("leadQuality")}: {quality}</p>}
                {campaign && <p>• {t("campaign")}: {campaign}</p>}
                {ownerId !== "all" && (
                  <p>
                    • {isRTL ? "المسؤول" : "Sales Agent"}: {users?.find((u: any) => u.id === Number(ownerId))?.name ?? ownerId}
                  </p>
                )}
                {slaBreached && <p>• {t("slaAlerts")}</p>}
                {search && <p>• {t("search")}: "{search}"</p>}
                {dateRange?.from && (
                  <p>
                    • {isRTL ? "من" : "From"}: {format(dateRange.from, "dd/MM/yyyy")}
                  </p>
                )}
                {dateRange?.to && (
                  <p>
                    • {isRTL ? "إلى" : "To"}: {format(dateRange.to, "dd/MM/yyyy")}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>{isRTL ? "عدد العملاء للتصدير" : "Number of leads to export"}</Label>
              <Input
                type="number"
                min={1}
                max={5000}
                value={exportLimit}
                onChange={(e) => setExportLimit(Math.min(5000, Math.max(1, Number(e.target.value))))}
                dir="ltr"
              />
              <div className="flex gap-2 flex-wrap">
                {[50, 100, 250, 500, 1000, 5000].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`text-xs h-7 ${exportLimit === n ? "border-primary text-primary" : ""}`}
                    onClick={() => setExportLimit(n)}
                  >
                    {n === 5000 ? (isRTL ? "الكل" : "All") : n}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{isRTL ? "الحد الأقصى 5000" : "Max 5,000 rows"}</p>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setShowExport(false)}>
                {t("cancel")}
              </Button>
              <Button
                style={{ background: tokens.primaryColor }}
                className="text-white gap-2"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {isRTL ? "جارٍ التصدير..." : "Exporting..."}
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    {isRTL ? `تصدير ${exportLimit} عميل` : `Export ${exportLimit} leads`}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 size={18} className="text-destructive" />
              {isRTL ? "حذف العميل" : "Delete Lead"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? "هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this lead? This action cannot be undone."}
            </p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmId(null)}>
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                className="gap-1.5"
                onClick={() => deleteConfirmId && deleteLead.mutate({ id: deleteConfirmId })}
                disabled={deleteLead.isPending}
              >
                {deleteLead.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> {t("loading")}
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> {isRTL ? "حذف" : "Delete"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quickActivityLeadId !== null} onOpenChange={(open) => { if (!open) setQuickActivityLeadId(null); }}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "إضافة نشاط سريع" : "Quick Add Activity"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{isRTL ? "النوع" : "Type"}</Label>
              <Select value={quickActivityType} onValueChange={setQuickActivityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Call">{isRTL ? "مكالمة" : "Call"}</SelectItem>
                  <SelectItem value="Meeting">{isRTL ? "اجتماع" : "Meeting"}</SelectItem>
                  <SelectItem value="WhatsApp">{isRTL ? "واتساب" : "WhatsApp"}</SelectItem>
                  <SelectItem value="Email">{isRTL ? "بريد" : "Email"}</SelectItem>
                  <SelectItem value="Note">{isRTL ? "ملاحظة" : "Note"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? "النتيجة" : "Outcome"}</Label>
              <Select value={quickActivityOutcome} onValueChange={setQuickActivityOutcome}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Interested">{isRTL ? "مهتم" : "Interested"}</SelectItem>
                  <SelectItem value="Not Interested">{isRTL ? "غير مهتم" : "Not Interested"}</SelectItem>
                  <SelectItem value="No Answer">{isRTL ? "لم يرد" : "No Answer"}</SelectItem>
                  <SelectItem value="Callback">{isRTL ? "معاودة الاتصال" : "Callback"}</SelectItem>
                  <SelectItem value="Voicemail">{isRTL ? "بريد صوتي" : "Voicemail"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                value={quickActivityNotes}
                onChange={(e) => setQuickActivityNotes(e.target.value)}
                placeholder={isRTL ? "ملاحظات سريعة..." : "Quick notes..."}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setQuickActivityLeadId(null)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={() => {
                  if (quickActivityLeadId) {
                    createQuickActivity.mutate({
                      leadId: quickActivityLeadId,
                      type: quickActivityType as any,
                      outcome: quickActivityOutcome as any,
                      notes: quickActivityNotes,
                      activityTime: new Date(),
                    });
                  }
                }}
                disabled={createQuickActivity.isLoading}
              >
                {createQuickActivity.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRTL ? (
                  "حفظ"
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

function Users(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}


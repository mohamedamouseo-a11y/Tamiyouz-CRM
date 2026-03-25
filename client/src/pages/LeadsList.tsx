import CRMLayout from "@/components/CRMLayout";
import LeadQualityBadge from "@/components/LeadQualityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertTriangle, Copy, Download, Filter, Loader2, Phone, Plus, Search, Trash2, X, MessageSquare } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { format, startOfDay, endOfDay } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { PhoneInput } from "@/components/PhoneInput";
import { CountrySelect } from "@/components/CountrySelect";
import { countries, getCountryByName } from "@/lib/countries-data";

const LEAD_QUALITIES = ["Hot", "Warm", "Cold", "Bad", "Unknown"];

// ── Lead Classification: Lead → Prospect → Opportunity ──
type ClassificationType = "Lead" | "Prospect" | "Opportunity";
const classificationConfig: Record<ClassificationType, { label: string; labelAr: string; color: string; bg: string; border: string; icon: string }> = {
  Lead: { label: "Lead", labelAr: "عميل محتمل", color: "#3b82f6", bg: "bg-blue-50", border: "border-blue-300", icon: "🔵" },
  Prospect: { label: "Prospect", labelAr: "عميل مهتم", color: "#f59e0b", bg: "bg-amber-50", border: "border-amber-300", icon: "🟡" },
  Opportunity: { label: "Opportunity", labelAr: "فرصة بيع", color: "#22c55e", bg: "bg-green-50", border: "border-green-300", icon: "🟢" },
};
function getLeadClassificationSimple(stage: string, quality: string | null | undefined, fitStatus: string | null | undefined): ClassificationType {
  const q = quality ?? "Unknown";
  const fs = fitStatus ?? "Pending";
  // Simplified version for list view (no activity/deal data available)
  if (["Proposal Delivered", "Won"].includes(stage)) return "Opportunity";
  if (["Proposal Delivered"].includes(stage) && q === "Hot") return "Opportunity";
  if (["Meeting Scheduled"].includes(stage) && ["Hot", "Warm"].includes(q)) return "Prospect";
  if (["Leads"].includes(stage) && fs === "Fit") return "Prospect";
  if (["Meeting Scheduled"].includes(stage)) return "Prospect";
  if (["Leads"].includes(stage) && ["Hot", "Warm"].includes(q)) return "Prospect";
  return "Lead";
}

const STAGES = ["New", "Contacted", "Meeting", "Offer Sent", "Won", "Lost", "Follow Up"];

export default function LeadsList() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();
  const [location] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);

  const [search, setSearch] = useState(() => sessionStorage.getItem("leads_search") || "");
  const [stage, setStage] = useState<string>(() => sessionStorage.getItem("leads_stage") || "all");
  const [quality, setQuality] = useState<string>(() => sessionStorage.getItem("leads_quality") || "all");
  const [fitStatusFilter, setFitStatusFilter] = useState<string>(() => sessionStorage.getItem("leads_fitStatus") || "all");
  const [campaign, setCampaign] = useState<string>(urlParams.get("campaign") ?? "");
  const [slaBreached, setSlaBreached] = useState(urlParams.get("slaBreached") === "true");
  const [page, setPage] = useState(0);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportLimit, setExportLimit] = useState(100);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [ownerId, setOwnerId] = useState<string>(() => sessionStorage.getItem("leads_ownerId") || "all");

  // ── Persist filters to sessionStorage ──
  useEffect(() => { sessionStorage.setItem("leads_search", search); }, [search]);
  useEffect(() => { sessionStorage.setItem("leads_stage", stage); }, [stage]);
  useEffect(() => { sessionStorage.setItem("leads_quality", quality); }, [quality]);
  useEffect(() => { sessionStorage.setItem("leads_fitStatus", fitStatusFilter); }, [fitStatusFilter]);
  useEffect(() => { sessionStorage.setItem("leads_ownerId", ownerId); }, [ownerId]);
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

  const limit = 20;

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
  const { data: stages } = trpc.pipeline.list.useQuery();
  const { data: users } = trpc.users.list.useQuery(undefined, {
    enabled: ["Admin", "SalesManager", "admin"].includes(user?.role ?? ""),
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  // Quick Add Activity state
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
  const onSubmit = (data: any) => {
    if (!phoneValid) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    if (!data.campaignName) {
      setCampaignError(true);
      return;
    }
    setCampaignError(false);
    if (!data.contactTime) {
      setContactDateError(true);
      return;
    }
    setContactDateError(false);
    // Auto-assign the current user as owner if they are a SalesAgent
    if (!data.ownerId && user?.role === "SalesAgent" && user?.id) {
      data.ownerId = user.id;
    }
    createLead.mutate(data);
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

  return (
    <CRMLayout>
      <div className="p-6 space-y-4 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("leads")}</h1>
            <p className="text-muted-foreground text-sm">
              {data?.total ?? 0} {t("count")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(user?.role === "Admin" || user?.role === "admin" || user?.role === "SalesManager") && (
              <Button
                variant="outline"
                onClick={() => setShowExport(true)}
                className="gap-2"
              >
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

        {/* Search & Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search
                  size={14}
                  className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${
                    isRTL ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className={isRTL ? "pr-9" : "pl-9"}
                />
              </div>
              <DateRangePicker 
                date={dateRange} 
                setDate={(d) => { setDateRange(d); setPage(0); }} 
              />

              <Select value={stage} onValueChange={(v) => { setStage(v); setPage(0); }}>
                <SelectTrigger className="w-36">
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

              <Select value={quality} onValueChange={(v) => { setQuality(v); setPage(0); }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t("leadQuality")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  {LEAD_QUALITIES.map((q) => (
                    <SelectItem key={q} value={q}>{t(q as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={fitStatusFilter} onValueChange={(v) => { setFitStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={isRTL ? "حالة الملاءمة" : "Fit Status"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  <SelectItem value="Fit">✅ Fit</SelectItem>
                  <SelectItem value="Not Fit">❌ Not Fit</SelectItem>
                  <SelectItem value="Pending">⏳ Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={campaign || "all"} onValueChange={(v) => { setCampaign(v === "all" ? "" : v); setPage(0); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t("campaign")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  {campaigns?.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {["Admin", "SalesManager", "admin"].includes(user?.role ?? "") && (
                <Select value={ownerId} onValueChange={(v) => { setOwnerId(v); setPage(0); }}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder={isRTL ? "المسؤول" : "Sales Agent"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all")}</SelectItem>
                    {users?.filter((u: any) => u.role === "SalesAgent").map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant={slaBreached ? "destructive" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => { setSlaBreached(!slaBreached); setPage(0); }}
              >
                <AlertTriangle size={14} />
                {t("slaAlerts")}
              </Button>

              {(search || stage !== "all" || quality !== "all" || fitStatusFilter !== "all" || campaign || slaBreached || dateRange || ownerId !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => {
                    setSearch(""); setStage("all"); setQuality("all");
                    setCampaign(""); setSlaBreached(false); setPage(0);
                    setDateRange(undefined); setOwnerId("all");
                  }}
                >
                  <X size={14} /> {t("clear")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("leadName")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("phone")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("leadQuality")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("stage")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{isRTL ? "التصنيف" : "Classification"}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("campaign")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{isRTL ? "المسؤول" : "Sales Agent"}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{isRTL ? "تاريخ التواصل" : "Contact Date"}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("createdAt")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("actions")}</th>
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                              style={{ background: tokens.primaryColor }}
                            >
                              {(lead.name ?? lead.phone)?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground">
                                  {lead.name ?? "—"}
                                </span>
                                {lead.slaBreached && (
                                  <AlertTriangle size={12} className="text-destructive" />
                                )}
                                {lead.isDuplicate && (
                                  <Copy size={11} className="text-muted-foreground" />
                                )}
                              </div>
                              {lead.businessProfile && (
                                <span className="text-xs text-muted-foreground truncate max-w-32 block">
                                  {lead.businessProfile}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Phone size={12} className="text-muted-foreground" />
                            <span className="font-mono text-xs">{lead.phone}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <LeadQualityBadge quality={lead.leadQuality} size="sm" />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                        (lead as any).fitStatus === "Fit" ? "bg-green-50 border-green-200 text-green-700" :
                        (lead as any).fitStatus === "Not Fit" ? "bg-red-50 border-red-200 text-red-700" :
                        "bg-yellow-50 border-yellow-200 text-yellow-700"
                      }`}>
                        {(lead as any).fitStatus === "Fit" ? "✅" : (lead as any).fitStatus === "Not Fit" ? "❌" : "⏳"} {(lead as any).fitStatus ?? "Pending"}
                      </span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const cls = getLeadClassificationSimple(lead.stage, lead.leadQuality, (lead as any).fitStatus);
                            const cfg = classificationConfig[cls];
                            return (
                              <span className="text-xs font-bold" style={{ color: cfg.color }}>
                                {isRTL ? cfg.labelAr : cfg.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ background: stageColor[lead.stage] ?? "#6366f1" }}
                          >
                            {t(lead.stage as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {lead.campaignName ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {lead.ownerId
                              ? (users ?? []).find((u: any) => u.id === lead.ownerId)?.name ?? "—"
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {lead.contactTime ? format(new Date(lead.contactTime), "dd/MM/yyyy HH:mm") : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(lead.createdAt), "dd/MM/yyyy")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
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
                              onClick={(e) => { e.stopPropagation(); setQuickActivityLeadId(lead.id); }}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
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
                    onClick={() => setPage(page - 1)}
                  >
                    {t("previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * limit >= (data?.total ?? 0)}
                    onClick={() => setPage(page + 1)}
                  >
                    {t("next")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Lead Dialog */}
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

            {/* ── Section: Contact Info ── */}
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
                  <Label className="text-sm font-medium">{t("contactDate")} <span className="text-red-500">*</span></Label>
                  <Input type="datetime-local" className={`h-10 ${contactDateError ? "border-red-500 ring-1 ring-red-500" : ""}`} onChange={(e) => { setValue("contactTime", new Date(e.target.value)); setContactDateError(false); }} />
                  {contactDateError && <p className="text-red-500 text-xs">{isRTL ? "وقت التواصل مطلوب" : "Contact date is required"}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("phone")} <span className="text-red-500">*</span></Label>
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
                {phoneError && <p className="text-red-500 text-xs">{isRTL ? "رقم الهاتف غير صحيح" : "Invalid phone number"}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("country")}</Label>
                  <CountrySelect
                    value={watch("country")}
                    onChange={(name) => setValue("country", name)}
                    isRTL={isRTL}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("businessProfile")}</Label>
                  <Input {...register("businessProfile")} placeholder={isRTL ? "نشاط العميل" : "Business profile"} className="h-10" />
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* ── Section: Lead Details ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {isRTL ? "تفاصيل العميل" : "Lead Details"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("leadQuality")}</Label>
                  <Select onValueChange={(v) => setValue("leadQuality", v as any)} defaultValue="Unknown">
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_QUALITIES.map((q) => (
                        <SelectItem key={q} value={q}>{t(q as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{isRTL ? "حالة الملاءمة" : "Fit Status"}</Label>
                  <Select onValueChange={(v) => setValue("fitStatus", v as any)} defaultValue="Pending">
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{t(s as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("campaign")} <span className="text-red-500">*</span></Label>
                  <Select onValueChange={(v) => { setValue("campaignName", v === "none" ? "" : v); if (v && v !== "none") setCampaignError(false); }}>
                    <SelectTrigger className={`h-10 ${campaignError ? "border-red-500 ring-1 ring-red-500" : ""}`}><SelectValue placeholder={t("selectOption")} /></SelectTrigger>
                    <SelectContent>
                      {campaigns?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {campaignError && <p className="text-red-500 text-xs">{isRTL ? "الحملة مطلوبة" : "Campaign is required"}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("adCreative") || "الإعلان"}</Label>
                  <Input {...register("adCreative")} placeholder={isRTL ? "اسم الإعلان" : "Ad creative name"} className="h-10" />
                </div>
              </div>
            </div>

            {/* ── Section: Assignment (Admin/Manager only) ── */}
            {["Admin", "SalesManager", "admin"].includes(user?.role ?? "") && (
              <>
                <div className="border-t border-border" />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {isRTL ? "التعيين" : "Assignment"}
                  </h3>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("owner")}</Label>
                    <Select onValueChange={(v) => setValue("ownerId", v === "none" ? undefined : Number(v))}>
                      <SelectTrigger className="h-10"><SelectValue placeholder={t("selectOption")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {users?.filter((u) => u.role === "SalesAgent").map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-border" />

            {/* ── Section: Notes ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {isRTL ? "ملاحظات" : "Notes"}
              </h3>
              <div className="space-y-2">
                <Textarea {...register("notes")} className="min-h-[80px] resize-y" placeholder={isRTL ? "اكتب ملاحظاتك هنا..." : "Write your notes here..."} />
              </div>
            </div>

            {/* ── Actions ── */}
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
                  <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t("loading")}</span>
                ) : t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Export Excel Dialog */}
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
              {isRTL
                ? "سيتم تطبيق الفلاتر الحالية على التصدير."
              : "Current filters will be applied to the export."}
            </p>

            {/* Active filters summary */}
            {(stage !== "all" || quality !== "all" || campaign || slaBreached || search || ownerId !== "all") && (
              <div className="text-xs bg-muted rounded-md p-3 space-y-1">
                <p className="font-medium text-foreground">{isRTL ? "الفلاتر المفعلة:" : "Active filters:"}</p>
                {stage !== "all" && <p>• {t("stage")}: {stage}</p>}
                {fitStatusFilter !== "all" && <p>• {isRTL ? "حالة الملاءمة" : "Fit Status"}: {fitStatusFilter}</p>}
                {quality !== "all" && <p>• {t("leadQuality")}: {quality}</p>}
                {campaign && <p>• {t("campaign")}: {campaign}</p>}
                {ownerId !== "all" && <p>• {isRTL ? "المسؤول" : "Sales Agent"}: {users?.find((u: any) => u.id === Number(ownerId))?.name ?? ownerId}</p>}
                {slaBreached && <p>• {t("slaAlerts")}</p>}
                {search && <p>• {t("search")}: "{search}"</p>}
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
                  <><Loader2 size={14} className="animate-spin" /> {isRTL ? "جارٍ التصدير..." : "Exporting..."}</>
                ) : (
                  <><Download size={14} /> {isRTL ? `تصدير ${exportLimit} عميل` : `Export ${exportLimit} leads`}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
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
                  <><Loader2 size={14} className="animate-spin" /> {t("loading")}</>
                ) : (
                  <><Trash2 size={14} /> {isRTL ? "حذف" : "Delete"}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Activity Dialog */}
      <Dialog open={quickActivityLeadId !== null} onOpenChange={(open) => { if (!open) setQuickActivityLeadId(null); }}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "إضافة نشاط سريع" : "Quick Add Activity"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{isRTL ? "النوع" : "Type"}</Label>
              <Select value={quickActivityType} onValueChange={setQuickActivityType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                {createQuickActivity.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRTL ? "حفظ" : "Save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
function Users(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

import CRMLayout from "@/components/CRMLayout";
import LeadQualityBadge from "@/components/LeadQualityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle,
  Clock,
  Copy,
  Edit,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Save,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

const ACTIVITY_TYPES = ["WhatsApp", "Call", "SMS", "Meeting", "Offer", "Email", "Note"];
const OUTCOMES = ["Contacted", "NoAnswer", "Interested", "NotInterested", "Meeting", "Offer", "Won", "Lost", "Callback"];
const STAGES = ["New", "Contacted", "Meeting", "Offer Sent", "Won", "Lost", "Follow Up"];
const DEAL_TYPES = ["New", "Contract", "Renewal", "Upsell"];
const LOSS_REASONS = ["Price", "Competitor", "NotInterested", "NoResponse", "Budget", "Other"];

const activityIcons: Record<string, string> = {
  WhatsApp: "💬",
  Call: "📞",
  SMS: "📱",
  Meeting: "🤝",
  Offer: "📄",
  Email: "📧",
  Note: "📝",
};

const outcomeColors: Record<string, string> = {
  Won: "text-green-600",
  Lost: "text-red-600",
  Interested: "text-blue-600",
  NotInterested: "text-gray-500",
  Contacted: "text-indigo-600",
  NoAnswer: "text-orange-500",
  Callback: "text-purple-600",
};

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const leadId = Number(id);
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { user } = useAuth();

  const [editMode, setEditMode] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showDeal, setShowDeal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [noteText, setNoteText] = useState("");

  const { data: lead, isLoading, refetch } = trpc.leads.byId.useQuery({ id: leadId });
  const { data: activities, refetch: refetchActivities } = trpc.activities.byLead.useQuery({ leadId });
  const { data: deal, refetch: refetchDeal } = trpc.deals.byLead.useQuery({ leadId });
  const { data: stages } = trpc.pipeline.list.useQuery();
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: users } = trpc.users.list.useQuery(undefined, {
    enabled: ["Admin", "SalesManager", "admin"].includes(user?.role ?? ""),
  });
  const { data: internalNotes, refetch: refetchNotes } = trpc.notes.byLead.useQuery({ leadId });
  const { data: transfers, refetch: refetchTransfers } = trpc.transfers.byLead.useQuery({ leadId });

  // Also fetch users for SalesAgent (for transfer dialog)
  const { data: allUsers } = trpc.users.list.useQuery(undefined, {
    enabled: true,
  });

  const [, navigate] = useLocation();

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => { toast.success(t("success")); setEditMode(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف العميل بنجاح" : "Lead deleted successfully");
      navigate("/leads");
    },
    onError: (e) => toast.error(e.message),
  });

  const createActivity = trpc.activities.create.useMutation({
    onSuccess: () => { toast.success(t("success")); setShowActivity(false); refetchActivities(); actReset(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteActivity = trpc.activities.delete.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchActivities(); },
  });

  const createDeal = trpc.deals.create.useMutation({
    onSuccess: () => { toast.success(t("success")); setShowDeal(false); refetchDeal(); dealReset(); },
    onError: (e) => toast.error(e.message),
  });

  const updateDeal = trpc.deals.update.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchDeal(); },
  });

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      toast.success(t("noteAdded" as any));
      setNoteText("");
      refetchNotes();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      toast.success(t("noteDeleted" as any));
      refetchNotes();
    },
  });

  const transferLead = trpc.transfers.create.useMutation({
    onSuccess: () => {
      toast.success(t("transferSuccess" as any));
      setShowTransfer(false);
      transferReset();
      refetch();
      refetchTransfers();
    },
    onError: (e) => toast.error(e.message),
  });

  const { register, handleSubmit, setValue, watch } = useForm({
    values: lead ? {
      name: lead.name ?? "",
      phone: lead.phone,
      country: lead.country ?? "",
      businessProfile: lead.businessProfile ?? "",
      leadQuality: lead.leadQuality as any,
      campaignName: lead.campaignName ?? "",
      adCreative: lead.adCreative ?? "",
      ownerId: lead.ownerId ?? undefined,
      stage: lead.stage,
      notes: lead.notes ?? "",
      mediaBuyerNotes: lead.mediaBuyerNotes ?? "",
      serviceIntroduced: lead.serviceIntroduced ?? "",
    } : undefined,
  });

  const { register: actRegister, handleSubmit: actHandleSubmit, reset: actReset, setValue: actSetValue } = useForm({
    defaultValues: { type: "Call" as const, outcome: undefined as any, notes: "", activityTime: undefined as any },
  });

  const { register: dealRegister, handleSubmit: dealHandleSubmit, reset: dealReset, setValue: dealSetValue } = useForm({
    defaultValues: { valueSar: "", status: "Pending" as const, dealType: "New" as const, lossReason: "", notes: "" },
  });

  const { register: transferRegister, handleSubmit: transferHandleSubmit, reset: transferReset, setValue: transferSetValue } = useForm({
    defaultValues: { toUserId: 0, reason: "", notes: "" },
  });

  const onSaveLead = (data: any) => {
    updateLead.mutate({ id: leadId, ...data });
  };

  const onAddActivity = (data: any) => {
    createActivity.mutate({ leadId, ...data, activityTime: data.activityTime ? new Date(data.activityTime) : new Date() });
  };

  const onCreateDeal = (data: any) => {
    createDeal.mutate({ leadId, ...data });
  };

  const onTransfer = (data: any) => {
    if (!data.toUserId || data.toUserId === 0) {
      toast.error(isRTL ? "اختر الموظف" : "Select an agent");
      return;
    }
    transferLead.mutate({
      leadId,
      toUserId: Number(data.toUserId),
      reason: data.reason || undefined,
      notes: data.notes || undefined,
    });
  };

  const onAddNote = () => {
    if (!noteText.trim()) return;
    createNote.mutate({ leadId, content: noteText.trim() });
  };

  const canEdit = user?.role !== "MediaBuyer";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  if (isLoading) {
    return (
      <CRMLayout>
        <div className="p-6 flex items-center justify-center min-h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </CRMLayout>
    );
  }

  if (!lead) {
    return (
      <CRMLayout>
        <div className="p-6 text-center text-muted-foreground">{t("noData")}</div>
      </CRMLayout>
    );
  }

  const stageColor: Record<string, string> = {
    New: "#6366f1", Contacted: "#3b82f6", Meeting: "#f59e0b",
    "Offer Sent": "#8b5cf6", Won: "#22c55e", Lost: "#ef4444", "Follow Up": "#06b6d4",
  };

  // Filter agents for transfer (exclude current user and current owner)
  const transferableAgents = (allUsers ?? []).filter(
    (u) => u.id !== user?.id && u.isActive && ["SalesAgent", "SalesManager", "Admin"].includes(u.role)
  );

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/leads">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <BackIcon size={16} />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">
                {lead.name ?? lead.phone}
              </h1>
              <LeadQualityBadge quality={lead.leadQuality} />
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                style={{ background: stageColor[lead.stage] ?? "#6366f1" }}
              >
                {t(lead.stage as any)}
              </span>
              {lead.slaBreached && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle size={11} /> SLA
                </Badge>
              )}
              {lead.isDuplicate && (
                <Badge variant="outline" className="gap-1">
                  <Copy size={11} /> {t("duplicate")}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {t("createdAt")}: {format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm")}
              {lead.leadTime && (
                <span className="mx-2">· {isRTL ? "وقت العميل" : "Lead Time"}: {format(new Date(lead.leadTime), "dd/MM/yyyy HH:mm")}</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <>
                {/* Transfer Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => setShowTransfer(true)}
                >
                  <ArrowRightLeft size={14} /> {t("transferLead" as any)}
                </Button>
                {editMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditMode(false)}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      size="sm"
                      style={{ background: tokens.primaryColor }}
                      className="text-white gap-1.5"
                      onClick={handleSubmit(onSaveLead)}
                      disabled={updateLead.isPending}
                    >
                      <Save size={14} /> {t("save")}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setEditMode(true)}
                  >
                    <Edit size={14} /> {t("edit")}
                  </Button>
                )}
              </>
            )}
            {(user?.role === "Admin" || user?.role === "admin") && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:bg-destructive hover:text-white"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={14} /> {isRTL ? "حذف" : "Delete"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Lead Details */}
          <div className="lg:col-span-2 space-y-4">
            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("basicInfo")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {editMode ? (
                    <>
                      <div>
                        <Label className="text-xs">{t("leadName")}</Label>
                        <Input {...register("name")} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">{t("phone")}</Label>
                        <Input {...register("phone")} className="mt-1" dir="ltr" />
                      </div>
                      <div>
                        <Label className="text-xs">{t("country")}</Label>
                        <Input {...register("country")} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">{t("businessProfile")}</Label>
                        <Input {...register("businessProfile")} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">{t("leadQuality")}</Label>
                        <Select
                          defaultValue={lead.leadQuality}
                          onValueChange={(v) => setValue("leadQuality", v as any)}
                        >
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Hot","Warm","Cold","Bad","Unknown"].map((q) => (
                              <SelectItem key={q} value={q}>{t(q as any)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">{t("stage")}</Label>
                        <Select
                          defaultValue={lead.stage}
                          onValueChange={(v) => setValue("stage", v)}
                        >
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(stages ?? STAGES.map((s) => ({ name: s, nameAr: s }))).map((s: any) => (
                              <SelectItem key={s.name} value={s.name}>
                                {isRTL && s.nameAr ? s.nameAr : s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {["Admin","SalesManager","admin"].includes(user?.role ?? "") && (
                        <div>
                          <Label className="text-xs">{t("owner")}</Label>
                          <Select
                            defaultValue={lead.ownerId ? String(lead.ownerId) : undefined}
                            onValueChange={(v) => setValue("ownerId", v === "none" ? undefined : Number(v))}
                          >
                            <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {users?.filter((u) => u.role === "SalesAgent").map((u) => (
                                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">{t("campaign")}</Label>
                        <Select
                          defaultValue={lead.campaignName ?? "none"}
                          onValueChange={(v) => setValue("campaignName", v === "none" ? "" : v)}
                        >
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {campaigns?.map((c) => (
                              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <InfoRow label={t("leadName")} value={lead.name} />
                      <InfoRow label={t("phone")} value={lead.phone} mono />
                      <InfoRow label={t("country")} value={lead.country} />
                      <InfoRow label={t("businessProfile")} value={lead.businessProfile} />
                      <InfoRow label={t("campaign")} value={lead.campaignName} />
                      <InfoRow label={t("adCreative")} value={lead.adCreative} />
                      <InfoRow label={t("owner")} value={(lead as any).ownerName} />
                    </>
                  )}
                </div>
                <div className="mt-4">
                  <Label className="text-xs">{t("notes")}</Label>
                  {editMode ? (
                    <Textarea {...register("notes")} className="mt-1 text-sm" rows={3} />
                  ) : (
                    <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-md p-2 min-h-12">
                      {lead.notes ?? "—"}
                    </p>
                  )}
                </div>
                {(user?.role === "MediaBuyer" || user?.role === "Admin" || user?.role === "admin") && (
                  <div className="mt-4">
                    <Label className="text-xs">{t("mediaBuyerNotes")}</Label>
                    {editMode && user?.role !== "MediaBuyer" ? (
                      <Textarea {...register("mediaBuyerNotes")} className="mt-1 text-sm" rows={2} />
                    ) : (
                      <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-md p-2 min-h-10">
                        {lead.mediaBuyerNotes ?? "—"}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Internal Notes Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare size={14} />
                  {t("internalNotes" as any)}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {(internalNotes as any)?.length ?? 0}
                </Badge>
              </CardHeader>
              <CardContent>
                {/* Add Note Input */}
                {canEdit && (
                  <div className="flex gap-2 mb-4">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder={t("writeNote" as any)}
                      className="text-sm min-h-[60px] flex-1"
                      rows={2}
                    />
                    <Button
                      size="sm"
                      style={{ background: tokens.primaryColor }}
                      className="text-white self-end gap-1.5 h-9"
                      onClick={onAddNote}
                      disabled={createNote.isPending || !noteText.trim()}
                    >
                      {createNote.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      {t("addNote" as any)}
                    </Button>
                  </div>
                )}

                {/* Notes List */}
                {!(internalNotes as any)?.length ? (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                    <p>{t("noNotes" as any)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(internalNotes as any).map((note: any) => (
                      <div key={note.id} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs font-medium text-primary">{note.userName ?? "—"}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(note.createdAt), "dd/MM/yyyy HH:mm")}
                              </span>
                            </div>
                          </div>
                          {(user?.role === "Admin" || user?.role === "admin" || note.userId === user?.id) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => deleteNote.mutate({ id: note.id })}
                            >
                              <Trash2 size={12} />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold">{t("activityTimeline")}</CardTitle>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => setShowActivity(true)}
                  >
                    <Plus size={12} /> {t("newActivity")}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!activities?.length ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <Clock size={32} className="mx-auto mb-2 opacity-30" />
                    <p>{t("noActivities")}</p>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-1.5"
                        onClick={() => setShowActivity(true)}
                      >
                        <Plus size={12} /> {t("addFirstActivity")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="activity-timeline">
                    {activities.map((act) => (
                      <div key={act.id} className="activity-timeline-item">
                        <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center text-xs`}>
                          {activityIcons[act.type] ?? "📌"}
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{t(act.type as any)}</span>
                                {act.outcome && (
                                  <span className={`text-xs font-medium ${outcomeColors[act.outcome] ?? ""}`}>
                                    · {t(act.outcome as any)}
                                  </span>
                                )}
                              </div>
                              {act.notes && (
                                <p className="text-xs text-muted-foreground mt-1">{act.notes}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                <Clock size={10} className="inline mr-1" />
                                {format(new Date(act.activityTime), "dd/MM/yyyy HH:mm")}
                                {(act as any).userName && ` · ${(act as any).userName}`}
                              </p>
                            </div>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => deleteActivity.mutate({ id: act.id })}
                              >
                                <Trash2 size={12} />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Deal Info + Transfer History */}
          <div className="space-y-4">
            {/* Deal Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("dealInfo")}</CardTitle>
              </CardHeader>
              <CardContent>
                {!deal ? (
                  <div className="py-6 text-center">
                    <p className="text-muted-foreground text-sm mb-3">{t("noDeal")}</p>
                    {canEdit && (
                      <Button
                        size="sm"
                        style={{ background: tokens.primaryColor }}
                        className="text-white gap-1.5"
                        onClick={() => setShowDeal(true)}
                      >
                        <Plus size={12} /> {t("createDeal")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-foreground">
                        {deal.valueSar ? `${Number(deal.valueSar).toLocaleString()} ${t("currency")}` : "—"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          deal.status === "Won"
                            ? "bg-green-100 text-green-700"
                            : deal.status === "Lost"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {deal.status === "Won" ? <CheckCircle size={11} /> : deal.status === "Lost" ? <XCircle size={11} /> : <Clock size={11} />}
                        {t(deal.status as any)}
                      </span>
                    </div>
                    <InfoRow label={t("dealType")} value={t(deal.dealType as any)} />
                    {deal.closedAt && <InfoRow label={t("closedAt")} value={format(new Date(deal.closedAt), "dd/MM/yyyy")} />}
                    {deal.lossReason && <InfoRow label={t("lossReason")} value={deal.lossReason} />}
                    {deal.notes && <InfoRow label={t("notes")} value={deal.notes} />}
                    {canEdit && (
                      <div className="pt-2 flex gap-2">
                        <Select
                          defaultValue={deal.status}
                          onValueChange={(v) => updateDeal.mutate({ id: deal.id, status: v as any })}
                        >
                          <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">{t("Pending")}</SelectItem>
                            <SelectItem value="Won">{t("Won")}</SelectItem>
                            <SelectItem value="Lost">{t("Lost")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transfer History Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowRightLeft size={14} />
                  {t("transferHistory" as any)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!(transfers as any)?.length ? (
                  <div className="py-4 text-center text-muted-foreground text-xs">
                    {t("noTransfers" as any)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(transfers as any).map((tr: any) => (
                      <div key={tr.id} className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-blue-700 dark:text-blue-300">{tr.fromUserName}</span>
                          <ArrowRight size={12} className="text-blue-500" />
                          <span className="font-medium text-blue-700 dark:text-blue-300">{tr.toUserName}</span>
                        </div>
                        {tr.reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">{t("transferReason" as any)}:</span> {tr.reason}
                          </p>
                        )}
                        {tr.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-medium">{t("transferNotes" as any)}:</span> {tr.notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock size={10} className="inline mr-1" />
                          {format(new Date(tr.createdAt), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lead Meta */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("salesInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label={t("serviceIntroduced")} value={lead.serviceIntroduced} />
                <InfoRow label={t("adCreative")} value={lead.adCreative} />
                {lead.priceOfferSent && (
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-600" />
                    <span className="text-xs text-green-600">{t("priceOfferSent")}</span>
                  </div>
                )}
                {lead.priceOfferLink && (
                  <a
                    href={lead.priceOfferLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline block"
                  >
                    {t("priceOfferLink")}
                  </a>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Activity Dialog */}
      <Dialog open={showActivity} onOpenChange={setShowActivity}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("newActivity")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={actHandleSubmit(onAddActivity)} className="space-y-4">
            <div>
              <Label>{t("activityType")}</Label>
              <Select defaultValue="Call" onValueChange={(v) => actSetValue("type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>{t(a as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("outcome")}</Label>
              <Select onValueChange={(v) => actSetValue("outcome", v as any)}>
                <SelectTrigger><SelectValue placeholder={t("selectOption")} /></SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>{t(o as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("activityTime")}</Label>
              <Input type="datetime-local" {...actRegister("activityTime")} />
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Textarea {...actRegister("notes")} rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowActivity(false)}>{t("cancel")}</Button>
              <Button type="submit" style={{ background: tokens.primaryColor }} className="text-white" disabled={createActivity.isPending}>
                {createActivity.isPending ? t("loading") : t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Deal Dialog */}
      <Dialog open={showDeal} onOpenChange={setShowDeal}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("newDeal")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={dealHandleSubmit(onCreateDeal)} className="space-y-4">
            <div>
              <Label>{t("dealValue")} ({t("currency")})</Label>
              <Input {...dealRegister("valueSar")} type="number" placeholder="0" dir="ltr" />
            </div>
            <div>
              <Label>{t("dealStatus")}</Label>
              <Select defaultValue="Pending" onValueChange={(v) => dealSetValue("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">{t("Pending")}</SelectItem>
                  <SelectItem value="Won">{t("Won")}</SelectItem>
                  <SelectItem value="Lost">{t("Lost")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("dealType")}</Label>
              <Select defaultValue="New" onValueChange={(v) => dealSetValue("dealType", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEAL_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>{t(d as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("lossReason")}</Label>
              <Input {...dealRegister("lossReason")} />
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Textarea {...dealRegister("notes")} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowDeal(false)}>{t("cancel")}</Button>
              <Button type="submit" style={{ background: tokens.primaryColor }} className="text-white" disabled={createDeal.isPending}>
                {createDeal.isPending ? t("loading") : t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Lead Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-blue-600" />
              {t("transferLead" as any)}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={transferHandleSubmit(onTransfer)} className="space-y-4">
            <div>
              <Label>{t("transferTo" as any)}</Label>
              <Select onValueChange={(v) => transferSetValue("toUserId", Number(v))}>
                <SelectTrigger><SelectValue placeholder={t("selectAgent" as any)} /></SelectTrigger>
                <SelectContent>
                  {transferableAgents.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("transferReason" as any)}</Label>
              <Input {...transferRegister("reason")} placeholder={isRTL ? "مثال: نهاية الشيفت" : "e.g. End of shift"} />
            </div>
            <div>
              <Label>{t("transferNotes" as any)}</Label>
              <Textarea
                {...transferRegister("notes")}
                rows={3}
                placeholder={isRTL ? "اكتب ملاحظات للزميل عن حالة العميل..." : "Write notes for your colleague about the lead status..."}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowTransfer(false)}>{t("cancel")}</Button>
              <Button
                type="submit"
                className="text-white gap-1.5"
                style={{ background: "#3b82f6" }}
                disabled={transferLead.isPending}
              >
                {transferLead.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> {t("loading")}</>
                ) : (
                  <><ArrowRightLeft size={14} /> {t("transferLead" as any)}</>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
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
                ? "هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع الأنشطة والصفقات المرتبطة. لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this lead? All associated activities and deals will also be deleted. This action cannot be undone."}
            </p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                className="gap-1.5"
                onClick={() => deleteLead.mutate({ id: leadId })}
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
    </CRMLayout>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground block">{label}</span>
      <span className={`text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

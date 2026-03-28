import LeadReminders from "@/components/LeadReminders";
import CRMLayout from "@/components/CRMLayout";
import LeadQualityBadge from "@/components/LeadQualityBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { differenceInDays, differenceInHours, format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle,
  Clock,
  Copy,
  Download,
  Edit,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  Save,
  Send,
  Trash2,
  UserPlus,
  Users,
  Eye,
  XCircle,
  Activity,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Link, useLocation, useParams } from "wouter";
import { useInnoCall } from "@/contexts/InnoCallProvider";

const ACTIVITY_TYPES = ["WhatsApp", "Call", "SMS", "Meeting", "Offer", "Email", "Note"];
const OUTCOMES = ["Contacted", "NoAnswer", "Interested", "NotInterested", "Meeting", "Offer", "Won", "Lost", "Callback"];
const STAGES_FALLBACK = ["Contacted Us", "Contacted", "Leads", "Meeting Scheduled", "Proposal Delivered", "Won", "Contact Again", "Lost"];
const DEAL_TYPES = ["New", "Contract", "Renewal", "Upsell"];

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

const stageColor: Record<string, string> = {
  New: "#6366f1",
  Contacted: "#3b82f6",
  Meeting: "#f59e0b",
  "Offer Sent": "#8b5cf6",
  Won: "#22c55e",
  Lost: "#ef4444",
  "Follow Up": "#06b6d4",
};

const leadQualityScore: Record<string, number> = {
  Hot: 30,
  Warm: 20,
  Cold: 10,
  Bad: 0,
  Unknown: 5,
};

const fitStatusScore: Record<string, number> = {
  Fit: 15,
  "Not Fit": -20,
  Pending: 0,
};

const fitStatusConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  Fit: { label: "Fit", icon: "✅", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  "Not Fit": { label: "Not Fit", icon: "❌", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  Pending: { label: "Pending", icon: "⏳", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
};
// ── Lead Classification: Lead → Prospect → Opportunity ──
type ClassificationType = "Lead" | "Prospect" | "Opportunity";
interface ClassificationConfig {
  label: string;
  labelAr: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
}
const classificationConfig: Record<ClassificationType, ClassificationConfig> = {
  Lead: { label: "Lead", labelAr: "عميل محتمل", color: "#3b82f6", bg: "bg-blue-50", border: "border-blue-300", icon: "🔵" },
  Prospect: { label: "Prospect", labelAr: "عميل مهتم", color: "#f59e0b", bg: "bg-amber-50", border: "border-amber-300", icon: "🟡" },
  Opportunity: { label: "Opportunity", labelAr: "فرصة بيع", color: "#22c55e", bg: "bg-green-50", border: "border-green-300", icon: "🟢" },
};

function getLeadClassification(
  stage: string,
  activitiesCount: number,
  leadQuality: string | null | undefined,
  fitStatus: string | null | undefined,
  hasDeal: boolean,
  priceOfferSent: boolean,
  lastContactDays: number | null
): ClassificationType {
  const q = leadQuality ?? "Unknown";
  const fs = fitStatus ?? "Pending";

  // Check Opportunity first (highest priority)
  let oppScore = 0;
  if (["Proposal Delivered", "Won"].includes(stage)) oppScore++;
  if (hasDeal) oppScore++;
  if (activitiesCount >= 3) oppScore++;
  if (q === "Hot") oppScore++;
  if (priceOfferSent) oppScore++;
  if (oppScore >= 2) return "Opportunity";

  // Check Prospect
  let prospScore = 0;
  if (["Leads", "Meeting Scheduled"].includes(stage)) prospScore++;
  if (activitiesCount >= 2) prospScore++;
  if (["Warm", "Hot"].includes(q)) prospScore++;
  if (fs === "Fit") prospScore++;
  if (lastContactDays !== null && lastContactDays <= 7) prospScore++;
  if (prospScore >= 2) return "Prospect";

  // Default: Lead
  return "Lead";
}


function toDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function relativeTimeLabel(date: Date | null, t: (key: any) => string, isRTL: boolean) {
  if (!date) return t("noContactYet");

  const hours = Math.max(0, differenceInHours(new Date(), date));
  const days = Math.max(0, differenceInDays(new Date(), date));

  if (hours < 1) return t("justNow");

  if (days >= 1) {
    return isRTL
      ? `${days} ${t(days === 1 ? "day" : "days")}`
      : `${days} ${t(days === 1 ? "day" : "days")}`;
  }

  return isRTL
    ? `${hours} ${t(hours === 1 ? "hour" : "hours")}`
    : `${hours} ${t(hours === 1 ? "hour" : "hours")}`;
}

function normalizePhone(phone?: string | null) {
  return (phone ?? "").replace(/[^\d]/g, "");
}

function getLeadScore(activitiesCount: number, quality?: string | null, hasDeal?: boolean, fitStatus?: string | null) {
  const activityScore = Math.min(activitiesCount * 10, 50);
  const qualityScore = leadQualityScore[quality ?? "Unknown"] ?? 5;
  const dealScore = hasDeal ? 20 : 0;
  const fitScore = fitStatusScore[fitStatus ?? "Pending"] ?? 0;
  return Math.max(0, Math.min(100, activityScore + qualityScore + dealScore + fitScore));
}

function getScoreColor(score: number) {
  if (score <= 30) return "#ef4444";
  if (score <= 60) return "#f59e0b";
  return "#22c55e";
}

function getSlaState(progress: number) {
  if (progress > 80) return { labelKey: "slaCriticalState", color: "#ef4444" };
  if (progress >= 50) return { labelKey: "slaWarningState", color: "#f59e0b" };
  return { labelKey: "slaHealthy", color: "#22c55e" };
}

function getAttachmentMeta(fileName?: string | null, fileType?: string | null, fileUrl?: string | null, t?: (key: any) => string) {
  const source = `${fileType ?? ""} ${fileName ?? ""} ${fileUrl ?? ""}`.toLowerCase();

  if (source.includes("pdf")) {
    return { icon: FileText, label: t ? t("fileTypePdf") : "PDF" };
  }

  if (source.includes("xls") || source.includes("xlsx") || source.includes("sheet") || source.includes("csv")) {
    return { icon: FileSpreadsheet, label: t ? t("fileTypeExcel") : "Excel" };
  }

  if (["png", "jpg", "jpeg", "gif", "webp", "image"].some((token) => source.includes(token))) {
    return { icon: ImageIcon, label: t ? t("fileTypeImage") : "Image" };
  }

  return { icon: Paperclip, label: t ? t("fileTypeOther") : "File" };
}

function formatAttachmentSize(size?: number | null) {
  if (!size) return "—";
  if (size >= 1024) return `${(size / 1024).toFixed(1)} MB`;
  return `${size} KB`;
}

function getStageState(stage: string, currentStage: string, stageNames: string[]) {
  if (currentStage === "Won") {
    const wonIdx = stageNames.indexOf("Won");
    const stageIdx = stageNames.indexOf(stage);
    if (stageIdx <= wonIdx) return stage === currentStage ? "current" : "completed";
    return "upcoming";
  }

  if (currentStage === "Lost") {
    const stageIdx = stageNames.indexOf(stage);
    const lostIdx = stageNames.indexOf("Lost");
    if (stage === currentStage) return "current";
    if (stageIdx < lostIdx) return "completed";
    return "upcoming";
  }

  const currentIndex = stageNames.indexOf(currentStage);
  const stageIndex = stageNames.indexOf(stage);
  // Handle stages not in the list
  if (currentIndex === -1) return stage === currentStage ? "current" : "upcoming";
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "current";
  return "upcoming";
}

function LeadScoreRing({ score, t }: { score: number; t: (key: any) => string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-2.5 py-1.5">
      <div className="relative h-11 w-11">
        <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground">{score}</div>
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">{t("leadScore")}</p>
        <p className="text-xs font-semibold text-foreground">/100</p>
      </div>
    </div>
  );
}

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
  const [showAssign, setShowAssign] = useState(false);
  const [assignRole, setAssignRole] = useState<string>("collaborator");
  const [noteText, setNoteText] = useState("");
  const [tamaraLoading, setTamaraLoading] = useState(false);

  const { data: lead, isLoading, refetch } = trpc.leads.byId.useQuery({ id: leadId }, { enabled: Number.isFinite(leadId) });
  const { data: activities, refetch: refetchActivities } = trpc.activities.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: deal, refetch: refetchDeal } = trpc.deals.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: stages } = trpc.pipeline.list.useQuery();
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: users } = trpc.users.list.useQuery(undefined, {
    enabled: ["Admin", "SalesManager", "admin"].includes(user?.role ?? ""),
  });
  const { data: internalNotes, refetch: refetchNotes } = trpc.notes.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: transfers, refetch: refetchTransfers } = trpc.transfers.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: attachments, refetch: refetchAttachments } = trpc.attachments.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: leadAssignments, refetch: refetchAssignments } = trpc.assignments.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: stageChanges } = trpc.auditLogs.byLeadStageChanges.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: tamaraStatus } = trpc.tamara.isEnabled.useQuery();
  const { data: slaConfig } = trpc.sla.get.useQuery();

  const { data: allUsers } = trpc.users.list.useQuery(undefined, { enabled: true });

  const [, navigate] = useLocation();
  const { startCall: innocallStartCall, isReady: innocallReady } = useInnoCall();

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success(t("success"));
      setEditMode(false);
      refetch();
    },
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
    onSuccess: () => {
      toast.success(t("success"));
      setShowActivity(false);
      refetchActivities();
      actReset();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteActivity = trpc.activities.delete.useMutation({
    onSuccess: () => {
      toast.success(t("success"));
      refetchActivities();
    },
  });

  const createDeal = trpc.deals.create.useMutation({
    onSuccess: () => {
      toast.success(t("success"));
      setShowDeal(false);
      refetchDeal();
      dealReset();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDeal = trpc.deals.update.useMutation({
    onSuccess: () => {
      toast.success(t("success"));
      refetchDeal();
    },
  });

  const tamaraCheckout = trpc.tamara.createCheckout.useMutation({
    onSuccess: (data) => {
      setTamaraLoading(false);
      if (data.checkout_url) {
        window.open(data.checkout_url, "_blank");
      } else {
        toast.error(isRTL ? "لم يتم الحصول على رابط الدفع" : "Failed to get checkout URL");
      }
    },
    onError: (e) => {
      setTamaraLoading(false);
      toast.error(e.message);
    },
  });

  const handleTamaraPayment = () => {
    if (!deal?.id) return;
    setTamaraLoading(true);
    tamaraCheckout.mutate({ dealId: deal.id });
  };

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

  const assignCollaborator = trpc.assignments.addCollaborator.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تعيين المتعاون بنجاح" : "Collaborator assigned successfully");
      setShowAssign(false);
      refetchAssignments();
    },
    onError: (e) => toast.error(e.message),
  });
  const removeAssignment = trpc.assignments.remove.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم إزالة التعيين" : "Assignment removed");
      refetchAssignments();
    },
    onError: (e) => toast.error(e.message),
  });
  const createAttachment = trpc.attachments.create.useMutation({
    onSuccess: () => {
      toast.success(t("addAttachmentSuccess" as any));
      attachmentReset({ fileName: "", fileUrl: "", fileType: "", fileSize: "" });
      refetchAttachments();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAttachment = trpc.attachments.delete.useMutation({
    onSuccess: () => {
      toast.success(t("deleteAttachmentSuccess" as any));
      refetchAttachments();
    },
    onError: (e) => toast.error(e.message),
  });

  const { register, handleSubmit, setValue } = useForm({
    values: lead
      ? {
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
        }
      : undefined,
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

  const {
    register: attachmentRegister,
    handleSubmit: attachmentHandleSubmit,
    reset: attachmentReset,
  } = useForm({
    defaultValues: { fileName: "", fileUrl: "", fileType: "", fileSize: "" },
  });

  const onSaveLead = (data: any) => {
    updateLead.mutate({ id: leadId, ...data });
  };

  const onAddActivity = (data: any) => {
    createActivity.mutate({
      leadId,
      ...data,
      activityTime: data.activityTime ? new Date(data.activityTime) : new Date(),
    });
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

  const onAddAttachment = (data: any) => {
    const fileUrl = String(data.fileUrl ?? "").trim();
    const derivedName = fileUrl.split("/").filter(Boolean).pop()?.split("?")[0] ?? t("unknownFile");

    createAttachment.mutate({
      leadId,
      fileUrl,
      fileName: String(data.fileName ?? "").trim() || derivedName,
      fileType: String(data.fileType ?? "").trim() || undefined,
      fileSize: data.fileSize ? Number(data.fileSize) : undefined,
    });
  };

  const onCopyPhone = async () => {
    if (!lead?.phone) {
      toast.error(t("phoneUnavailable" as any));
      return;
    }

    try {
      await navigator.clipboard.writeText(lead.phone);
      toast.success(t("phoneCopied" as any));
    } catch {
      toast.error(t("copyFailed" as any));
    }
  };

  const canEdit = user?.role !== "MediaBuyer";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const lastActivity = useMemo(() => {
    if (!activities?.length) return null;
    return [...activities]
      .map((item) => ({ ...item, activityDate: toDate(item.activityTime) }))
      .filter((item) => item.activityDate)
      .sort((a, b) => (b.activityDate?.getTime() ?? 0) - (a.activityDate?.getTime() ?? 0))[0] ?? null;
  }, [activities]);

  const lastActivityDate = lastActivity?.activityDate ?? null;
  const leadCreatedAt = toDate(lead?.createdAt) ?? new Date();
  const daysSinceLastContact = lastActivityDate ? differenceInDays(new Date(), lastActivityDate) : differenceInDays(new Date(), leadCreatedAt);
  const leadScore = getLeadScore(activities?.length ?? 0, lead?.leadQuality, Boolean(deal), (lead as any)?.fitStatus);
  const leadClassification = getLeadClassification(
    lead?.stage ?? "New",
    activities?.length ?? 0,
    lead?.leadQuality,
    (lead as any)?.fitStatus,
    Boolean(deal),
    Boolean(lead?.priceOfferSent),
    daysSinceLastContact
  );
  const classConfig = classificationConfig[leadClassification];
  const slaThresholdHours = Number((slaConfig as any)?.hoursThreshold ?? 24);
  const slaEnabled = Boolean((slaConfig as any)?.isEnabled ?? true);
  const slaReferenceDate = lastActivityDate ?? leadCreatedAt;
  const slaElapsedHours = Math.max(0, differenceInHours(new Date(), slaReferenceDate));
  const slaProgressValue = slaEnabled && slaThresholdHours > 0 ? Math.min(100, (slaElapsedHours / slaThresholdHours) * 100) : 0;
  const slaStatus = getSlaState(slaProgressValue);
  const isSlaBreached = slaEnabled && (Boolean(lead?.slaBreached) || slaElapsedHours > slaThresholdHours);
  const pendingDealNeedsAttention = Boolean(deal?.status === "Pending" && differenceInDays(new Date(), toDate((deal as any)?.updatedAt) ?? toDate((deal as any)?.createdAt) ?? new Date()) >= 3);
  const phoneDigits = normalizePhone(lead?.phone);
  const whatsappUrl = phoneDigits ? `https://wa.me/${phoneDigits}` : "";

  const stageTimelineDates = useMemo(() => {
    const map: Record<string, string> = { New: lead?.createdAt ?? "" };

    (stageChanges ?? [])
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((change: any) => {
        if (change.newStage && !map[change.newStage]) {
          map[change.newStage] = change.createdAt;
        }
      });

    if (lead?.stage && !map[lead.stage]) {
      map[lead.stage] = lead.updatedAt ?? lead.createdAt;
    }

    return map;
  }, [lead?.createdAt, lead?.stage, lead?.updatedAt, stageChanges]);

  const smartAlerts = [
    daysSinceLastContact >= 3
      ? {
          key: "inactive",
          icon: AlertTriangle,
          title: t("smartAlerts"),
          description: `${t("noContactWithLeadSince" as any)} ${relativeTimeLabel(lastActivityDate ?? leadCreatedAt, t, isRTL)}`,
          className: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
        }
      : null,
    isSlaBreached
      ? {
          key: "sla",
          icon: AlertTriangle,
          title: "SLA",
          description: `${t("slaExceeded" as any)}${slaReferenceDate ? ` · ${t("slaExceededSince" as any)} ${relativeTimeLabel(slaReferenceDate, t, isRTL)}` : ""}`,
          className: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100",
        }
      : null,
    !lead?.ownerId
      ? {
          key: "owner",
          icon: MessageSquare,
          title: t("owner"),
          description: t("unassignedLeadAlert" as any),
          className: "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-100",
        }
      : null,
    pendingDealNeedsAttention
      ? {
          key: "deal",
          icon: Clock,
          title: t("deal"),
          description: t("pendingDealAlert" as any),
          className: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100",
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; icon: any; title: string; description: string; className: string }>;

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

  const transferableAgents = (allUsers ?? []).filter(
    (u: any) => u.id !== user?.id && u.isActive && ["SalesAgent", "SalesManager", "Admin"].includes(u.role)
  );

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/leads">{t("leads")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{lead.name ?? lead.phone}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {smartAlerts.length > 0 && (
          <div className="space-y-3">
            {smartAlerts.map((alert) => {
              const AlertIcon = alert.icon;
              return (
                <Alert key={alert.key} className={alert.className}>
                  <AlertTitle className="flex items-center gap-2">
                    <AlertIcon size={16} />
                    {alert.title}
                  </AlertTitle>
                  <AlertDescription>{alert.description}</AlertDescription>
                </Alert>
              );
            })}
          </div>
        )}

        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${classConfig.color}, ${stageColor[lead.stage] ?? tokens.primaryColor})` }} />
          <CardContent className="p-5 md:p-6 space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/leads">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <BackIcon size={16} />
                    </Button>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl font-bold text-foreground truncate">{lead.name ?? lead.phone}</h1>
                      <LeadQualityBadge quality={lead.leadQuality} />
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                        style={{ background: stageColor[lead.stage] ?? tokens.primaryColor }}
                      >
                        {t(lead.stage as any)}
                      </span>
                      {isSlaBreached && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle size={11} /> SLA
                        </Badge>
                      )}
                      {lead.isDuplicate && (
                        <Badge variant="outline" className="gap-1">
                          <Copy size={11} /> {t("duplicate")}
                        </Badge>
                      )}
                      <LeadScoreRing score={leadScore} t={t} />
                      {(() => {
                        const fs = (lead as any)?.fitStatus ?? "Pending";
                        const cfg = fitStatusConfig[fs] ?? fitStatusConfig.Pending;
                        return (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-medium ${cfg.bg} ${cfg.color}`}>
                            <span>{cfg.icon}</span>
                            <span>{t(fs as any) || fs}</span>
                          </span>
                        );
                      })()}
                      {/* Lead Classification Badge - text only */}
                      <span className="text-sm font-bold" style={{ color: classConfig.color }}>
                        {isRTL ? classConfig.labelAr : classConfig.label}
                      </span>
                    </div>

                    <p className="text-muted-foreground text-sm mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        {t("createdAt")}: {format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm")}
                      </span>
                      {lead.leadTime && (
                        <span>
                          {t("leadTime")}: {format(new Date(lead.leadTime), "dd/MM/yyyy HH:mm")}
                        </span>
                      )}
                      <span>
                        {t("lastContact" as any)}: {lastActivityDate ? `${t("sincePrefix" as any)} ${relativeTimeLabel(lastActivityDate, t, isRTL)}` : t("noContactYet" as any)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">SLA</p>
                      <p className="text-sm font-medium" style={{ color: slaStatus.color }}>
                        {t(slaStatus.labelKey as any)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{t("slaProgress" as any)} {Math.round(slaProgressValue)}%</Badge>
                      <Badge variant={isSlaBreached ? "destructive" : "outline"}>
                        {isSlaBreached
                          ? `${t("slaExceededSince" as any)} ${relativeTimeLabel(slaReferenceDate, t, isRTL)}`
                          : `${slaElapsedHours}/${slaThresholdHours}h`}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={slaProgressValue} className="h-2" />
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => whatsappUrl && window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                    disabled={!whatsappUrl}
                    title={t("whatsapp" as any)}
                  >
                    <MessageCircle size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => lead.phone && innocallStartCall(lead.phone)}
                    disabled={!lead.phone || !innocallReady}
                    title={t("Call" as any)}
                  >
                    <Phone size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={onCopyPhone}
                    disabled={!lead.phone}
                    title={t("copyPhone" as any)}
                  >
                    <Copy size={16} />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => setShowTransfer(true)}
                      >
                        <ArrowRightLeft size={14} /> {isRTL ? "تسليم" : "Handover"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50"
                        onClick={() => setShowAssign(true)}
                      >
                        <UserPlus size={14} /> {isRTL ? "تعيين متعاون" : "Assign"}
                      </Button>
                      {editMode ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
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
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditMode(true)}>
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
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">

              {/* ─── Collaborators / Team ─── */}
              {(leadAssignments as any[])?.length > 0 && (
                <Card className="border-purple-200 bg-purple-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users size={16} className="text-purple-600" />
                      {isRTL ? "فريق العمل على هذا الـ Lead" : "Lead Team"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {(leadAssignments as any[])?.map((a: any) => {
                        const roleLabels: Record<string, string> = {
                          owner: isRTL ? "المالك" : "Owner",
                          collaborator: isRTL ? "متعاون" : "Collaborator",
                          observer: isRTL ? "مراقب" : "Observer",
                          client_success: "Client Success",
                          account_manager: "Account Manager",
                        };
                        const roleColors: Record<string, string> = {
                          owner: "bg-blue-100 text-blue-800 border-blue-300",
                          collaborator: "bg-purple-100 text-purple-800 border-purple-300",
                          observer: "bg-gray-100 text-gray-600 border-gray-300",
                          client_success: "bg-amber-100 text-amber-800 border-amber-300",
                          account_manager: "bg-green-100 text-green-800 border-green-300",
                        };
                        return (
                          <div key={a.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${roleColors[a.role] ?? "bg-gray-100"}`}>
                            {a.role === "observer" ? <Eye size={12} /> : <Users size={12} />}
                            <span>{a.userName}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{roleLabels[a.role] ?? a.role}</Badge>
                            {a.role !== "owner" && canEdit && (
                              <button className="ml-1 text-red-400 hover:text-red-600" onClick={() => removeAssignment.mutate({ assignmentId: a.id })} title={isRTL ? "إزالة" : "Remove"}>
                                <XCircle size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

            <Tabs defaultValue="info" className="space-y-4">
              <TabsList className="grid grid-cols-5 w-full md:w-auto md:inline-grid">
                <TabsTrigger value="info">{t("infoTab" as any)}</TabsTrigger>
                <TabsTrigger value="formData">{t("formDataTab" as any)}</TabsTrigger>
                <TabsTrigger value="activities">{t("activitiesTab" as any)}</TabsTrigger>
                <TabsTrigger value="notes">{t("notesTab" as any)}</TabsTrigger>
                <TabsTrigger value="reminders">{t("remindersTab" as any)}</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">{t("stageJourney" as any)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <div className="min-w-[720px] flex items-start justify-between gap-4">
                        {(stages ?? STAGES_FALLBACK.map((s) => ({ name: s, nameAr: s }))).map((stageItem: any, index: number) => {
                          const stage = stageItem.name ?? stageItem;
                          const stageNames = (stages ?? STAGES_FALLBACK.map((s) => ({ name: s, nameAr: s }))).map((s: any) => s.name ?? s);
                          const state = getStageState(stage, lead.stage, stageNames);
                          const isCompleted = state === "completed";
                          const isCurrent = state === "current";
                          const color = isCompleted ? "#22c55e" : isCurrent ? stageColor[stage] ?? tokens.primaryColor : "#cbd5e1";
                          const stageDate = stageTimelineDates[stage];

                          return (
                            <div key={stage} className="flex-1 min-w-[90px] text-center">
                              <div className="flex items-center">
                                <div className="h-[2px] flex-1" style={{ backgroundColor: index === 0 ? "transparent" : (isCompleted || isCurrent ? color : "#e5e7eb") }} />
                                <div
                                  className="mx-2 flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-semibold text-white"
                                  style={{ borderColor: color, backgroundColor: color }}
                                >
                                  {index + 1}
                                </div>
                                <div className="h-[2px] flex-1" style={{ backgroundColor: isCompleted ? color : "#e5e7eb" }} />
                              </div>
                              <p className="mt-2 text-sm font-medium text-foreground">{isRTL && stageItem.nameAr ? stageItem.nameAr : (t(stage as any) || stage)}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {stageDate ? format(new Date(stageDate), "dd/MM/yyyy") : "—"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">{t("basicInfo")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <Select defaultValue={lead.leadQuality} onValueChange={(v) => setValue("leadQuality", v as any)}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["Hot", "Warm", "Cold", "Bad", "Unknown"].map((q) => (
                                  <SelectItem key={q} value={q}>{t(q as any)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">{isRTL ? "حالة الملاءمة" : "Fit Status"}</Label>
                            <Select defaultValue={(lead as any).fitStatus ?? "Pending"} onValueChange={(v) => setValue("fitStatus", v as any)}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fit">{isRTL ? "✅ مناسب" : "✅ Fit"}</SelectItem>
                                <SelectItem value="Not Fit">{isRTL ? "❌ غير مناسب" : "❌ Not Fit"}</SelectItem>
                                <SelectItem value="Pending">{isRTL ? "⏳ قيد المراجعة" : "⏳ Pending"}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">{t("stage")}</Label>
                            <Select defaultValue={lead.stage} onValueChange={(v) => setValue("stage", v)}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(stages ?? STAGES_FALLBACK.map((s) => ({ name: s, nameAr: s }))).map((stageItem: any) => (
                                  <SelectItem key={stageItem.name} value={stageItem.name}>
                                    {isRTL && stageItem.nameAr ? stageItem.nameAr : stageItem.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {["Admin", "SalesManager", "admin"].includes(user?.role ?? "") && (
                            <div>
                              <Label className="text-xs">{t("owner")}</Label>
                              <Select
                                defaultValue={lead.ownerId ? String(lead.ownerId) : undefined}
                                onValueChange={(v) => setValue("ownerId", v === "none" ? undefined : Number(v))}
                              >
                                <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">—</SelectItem>
                                  {users?.filter((u: any) => u.role === "SalesAgent").map((u: any) => (
                                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div>
                            <Label className="text-xs">{t("campaign")}</Label>
                            <Select defaultValue={lead.campaignName ?? "none"} onValueChange={(v) => setValue("campaignName", v === "none" ? "" : v)}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {campaigns?.map((campaign: any) => (
                                  <SelectItem key={campaign.id} value={campaign.name}>{campaign.name}</SelectItem>
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
                          <InfoRow label={t("owner")} value={(lead as any).ownerName ?? (!lead.ownerId ? t("ownerUnassigned" as any) : undefined)} />
                          <InfoRow label={t("lastContact" as any)} value={lastActivityDate ? `${t("sincePrefix" as any)} ${relativeTimeLabel(lastActivityDate, t, isRTL)}` : t("noContactYet" as any)} />
                        </>
                      )}
                    </div>

                    <div className="mt-4">
                      <Label className="text-xs">{t("notes")}</Label>
                      {editMode ? (
                        <Textarea {...register("notes")} className="mt-1 text-sm" rows={3} />
                      ) : (
                        <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-md p-2 min-h-12">{lead.notes ?? "—"}</p>
                      )}
                    </div>

                    {(user?.role === "MediaBuyer" || user?.role === "Admin" || user?.role === "admin") && (
                      <div className="mt-4">
                        <Label className="text-xs">{t("mediaBuyerNotes")}</Label>
                        {editMode && user?.role !== "MediaBuyer" ? (
                          <Textarea {...register("mediaBuyerNotes")} className="mt-1 text-sm" rows={2} />
                        ) : (
                          <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-md p-2 min-h-10">{lead.mediaBuyerNotes ?? "—"}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="formData" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">{t("formDataTitle" as any)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const customData = (lead as any).customFieldsData;
                      const sourceData = (lead as any).sourceMetadata;
                      if (!customData || Object.keys(customData).length === 0) {
                        return (
                          <div className="py-8 text-center text-muted-foreground text-sm">
                            <FileText size={32} className="mx-auto mb-2 opacity-30" />
                            <p>{t("noFormData" as any)}</p>
                          </div>
                        );
                      }
                      const cleanLabel = (key: string) => {
                        return key
                          .replace(/_/g, " ")
                          .replace(/؟/g, "؟")
                          .replace(/\s+/g, " ")
                          .trim();
                      };
                      return (
                        <div className="space-y-3">
                          {Object.entries(customData)
                            .filter(([key]) => key !== "inbox_url")
                            .map(([key, value]) => (
                            <div key={key} className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0">
                              <span className="text-xs font-medium text-muted-foreground">{cleanLabel(key)}</span>
                              <span className="text-sm text-foreground">{String(value).replace(/_/g, " ") || "—"}</span>
                            </div>
                          ))}
                          {customData.inbox_url && (
                            <div className="flex flex-col gap-1 border-b border-border/50 pb-2">
                              <span className="text-xs font-medium text-muted-foreground">Inbox URL</span>
                              <a href={customData.inbox_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                                <Link2 size={12} /> {t("openInbox" as any)}
                              </a>
                            </div>
                          )}
                          {sourceData && (
                            <div className="mt-4 pt-3 border-t">
                              <span className="text-xs font-semibold text-muted-foreground mb-2 block">{t("sourceInfo" as any)}</span>
                              {sourceData.provider && <InfoRow label={t("provider" as any)} value={sourceData.provider} />}
                              {sourceData.synced_via && <InfoRow label={t("syncMethod" as any)} value={sourceData.synced_via} />}
                              {sourceData.campaign_id && <InfoRow label="Campaign ID" value={sourceData.campaign_id} mono />}
                              {sourceData.form_id && <InfoRow label="Form ID" value={sourceData.form_id} mono />}
                              {sourceData.ad_id && <InfoRow label="Ad ID" value={sourceData.ad_id} mono />}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activities" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-semibold">{t("activityTimeline")}</CardTitle>
                    {canEdit && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => setShowActivity(true)}>
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
                          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setShowActivity(true)}>
                            <Plus size={12} /> {t("addFirstActivity")}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="activity-timeline">
                        {activities.map((act: any) => (
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
                                  {act.notes && <p className="text-xs text-muted-foreground mt-1">{act.notes}</p>}
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
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MessageSquare size={14} />
                      {t("internalNotes" as any)}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">{(internalNotes as any)?.length ?? 0}</Badge>
                  </CardHeader>
                  <CardContent>
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
                          {createNote.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          {t("addNote" as any)}
                        </Button>
                      </div>
                    )}

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
                                  <span className="text-xs text-muted-foreground">{format(new Date(note.createdAt), "dd/MM/yyyy HH:mm")}</span>
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
              </TabsContent>
              <TabsContent value="reminders" className="space-y-4">
                <LeadReminders leadId={leadId} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
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
                        {deal.valueSar ? `${Number(deal.valueSar).toLocaleString()} ${(deal as any).currency || "SAR"}` : "—"}
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
                        <Select defaultValue={deal.status} onValueChange={(v) => updateDeal.mutate({ id: deal.id, status: v as any })}>
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
                    {tamaraStatus?.enabled && deal.status === "Pending" && (
                      <div className="pt-3 border-t border-border/50 mt-3">
                        <Button
                          size="sm"
                          className="w-full gap-2 text-white font-medium"
                          style={{ background: "linear-gradient(135deg, #c084fc 0%, #f472b6 50%, #fb923c 100%)" }}
                          onClick={handleTamaraPayment}
                          disabled={tamaraLoading}
                        >
                          {tamaraLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M4.5 12.5C4.5 12.5 4.5 8 8 8C11.5 8 11.5 12.5 11.5 12.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                              <circle cx="17" cy="10.5" r="4" fill="white" />
                            </svg>
                          )}
                          {isRTL ? "ادفع عبر تمارا" : "Pay with Tamara"}
                          <ExternalLink size={12} />
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                          {isRTL ? "الدفع بالتقسيط عبر تمارا" : "Pay in installments via Tamara"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowRightLeft size={14} />
                  {t("transferHistory" as any)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!(transfers as any)?.length ? (
                  <div className="py-4 text-center text-muted-foreground text-xs">{t("noTransfers" as any)}</div>
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
                  <a href={lead.priceOfferLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline block">
                    {t("priceOfferLink")}
                  </a>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Paperclip size={14} />
                  {t("attachments" as any)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canEdit && (
                  <form onSubmit={attachmentHandleSubmit(onAddAttachment)} className="space-y-3 rounded-lg border border-dashed border-border/70 p-3">
                    <div>
                      <Label className="text-xs">{t("attachmentName" as any)}</Label>
                      <Input {...attachmentRegister("fileName")} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">{t("attachmentUrl" as any)}</Label>
                      <div className="relative mt-1">
                        <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input {...attachmentRegister("fileUrl", { required: true })} className="pl-9" placeholder="https://..." dir="ltr" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">{t("attachmentType" as any)}</Label>
                        <Input {...attachmentRegister("fileType")} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">{t("attachmentSize" as any)}</Label>
                        <Input {...attachmentRegister("fileSize")} type="number" min="0" className="mt-1" dir="ltr" />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t("temporaryUrlField" as any)}</p>
                    <Button
                      type="submit"
                      size="sm"
                      style={{ background: tokens.primaryColor }}
                      className="text-white gap-1.5"
                      disabled={createAttachment.isPending}
                    >
                      {createAttachment.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      {t("addAttachment" as any)}
                    </Button>
                  </form>
                )}

                {!attachments?.length ? (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    <Paperclip size={26} className="mx-auto mb-2 opacity-30" />
                    <p>{t("noAttachments" as any)}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attachments.map((attachment: any) => {
                      const attachmentMeta = getAttachmentMeta(attachment.fileName, attachment.fileType, attachment.fileUrl, t);
                      const AttachmentIcon = attachmentMeta.icon;

                      return (
                        <div key={attachment.id} className="rounded-lg border border-border/60 p-3 bg-muted/20">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/60">
                                <AttachmentIcon size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{attachment.fileName}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                  <span>{attachmentMeta.label}</span>
                                  <span>•</span>
                                  <span>{formatAttachmentSize(attachment.fileSize)}</span>
                                  <span>•</span>
                                  <span>{format(new Date(attachment.createdAt), "dd/MM/yyyy")}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(attachment.fileUrl, "_blank", "noopener,noreferrer")}>
                                <Download size={14} />
                              </Button>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteAttachment.mutate({ id: attachment.id })}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
                  {ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{t(type as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("outcome")}</Label>
              <Select onValueChange={(v) => actSetValue("outcome", v as any)}>
                <SelectTrigger><SelectValue placeholder={t("selectOption")} /></SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((outcome) => (
                    <SelectItem key={outcome} value={outcome}>{t(outcome as any)}</SelectItem>
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

      <Dialog open={showDeal} onOpenChange={setShowDeal}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("newDeal")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={dealHandleSubmit(onCreateDeal)} className="space-y-4">
            <div>
              <Label>{t("dealValue")}</Label>
              <Input {...dealRegister("valueSar")} type="number" placeholder="0" dir="ltr" />
            </div>
            <div>
              <Label>{isRTL ? "العملة" : "Currency"}</Label>
              <Select defaultValue="SAR" onValueChange={(v) => dealSetValue("currency", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">{isRTL ? "ريال سعودي (SAR)" : "Saudi Riyal (SAR)"}</SelectItem>
                  <SelectItem value="EGP">{isRTL ? "جنيه مصري (EGP)" : "Egyptian Pound (EGP)"}</SelectItem>
                  <SelectItem value="USD">{isRTL ? "دولار أمريكي (USD)" : "US Dollar (USD)"}</SelectItem>
                </SelectContent>
              </Select>
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
                  {DEAL_TYPES.map((dealType) => (
                    <SelectItem key={dealType} value={dealType}>{t(dealType as any)}</SelectItem>
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

      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-blue-600" />
              {isRTL ? "تسليم Lead" : "Handover Lead"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={transferHandleSubmit(onTransfer)} className="space-y-4">
            <div>
              <Label>{t("transferTo" as any)}</Label>
              <Select onValueChange={(v) => transferSetValue("toUserId", Number(v))}>
                <SelectTrigger><SelectValue placeholder={t("selectAgent" as any)} /></SelectTrigger>
                <SelectContent>
                  {transferableAgents.map((agent: any) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.name} ({agent.role})
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
              <Button type="submit" className="text-white gap-1.5" style={{ background: "#3b82f6" }} disabled={transferLead.isPending}>
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
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>{t("cancel")}</Button>
              <Button variant="destructive" className="gap-1.5" onClick={() => deleteLead.mutate({ id: leadId })} disabled={deleteLead.isPending}>
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

      {/* ─── Assign Collaborator Dialog ─── */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={18} className="text-purple-600" />
              {isRTL ? "تعيين متعاون" : "Assign Collaborator"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? "اختر الشخص" : "Select Person"}</Label>
              <Select onValueChange={(v) => {
                const el = document.getElementById("assign-user-id") as HTMLInputElement;
                if (el) el.value = v;
              }}>
                <SelectTrigger><SelectValue placeholder={isRTL ? "اختر..." : "Select..."} /></SelectTrigger>
                <SelectContent>
                  {(allUsers ?? []).filter((u: any) => u.id !== lead?.ownerId).map((agent: any) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.name} ({agent.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" id="assign-user-id" />
            </div>
            <div>
              <Label>{isRTL ? "الدور" : "Role"}</Label>
              <Select value={assignRole} onValueChange={setAssignRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="collaborator">{isRTL ? "متعاون (تعديل)" : "Collaborator (Edit)"}</SelectItem>
                  <SelectItem value="client_success">{isRTL ? "Client Success Lead" : "Client Success Lead"}</SelectItem>
                  <SelectItem value="account_manager">{isRTL ? "Account Manager" : "Account Manager"}</SelectItem>
                  <SelectItem value="observer">{isRTL ? "مراقب (عرض فقط)" : "Observer (View Only)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? "السبب" : "Reason"}</Label>
              <Input id="assign-reason" placeholder={isRTL ? "مثال: متابعة الشيفت التاني" : "e.g. Second shift follow-up"} />
            </div>
            <div>
              <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
              <Textarea id="assign-notes" rows={2} placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAssign(false)}>{t("cancel")}</Button>
              <Button
                className="text-white gap-1.5"
                style={{ background: "#8b5cf6" }}
                disabled={assignCollaborator.isPending}
                onClick={() => {
                  const userId = Number((document.getElementById("assign-user-id") as HTMLInputElement)?.value);
                  const reason = (document.getElementById("assign-reason") as HTMLInputElement)?.value;
                  const notes = (document.getElementById("assign-notes") as HTMLTextAreaElement)?.value;
                  if (!userId) { toast.error(isRTL ? "اختر شخص" : "Select a person"); return; }
                  assignCollaborator.mutate({ leadId, userId, role: assignRole as any, reason: reason || undefined, notes: notes || undefined });
                }}
              >
                {assignCollaborator.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> {t("loading")}</>
                ) : (
                  <><UserPlus size={14} /> {isRTL ? "تعيين" : "Assign"}</>
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

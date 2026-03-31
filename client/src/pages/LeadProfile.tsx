import LeadReminders from "@/components/LeadReminders";
import CRMLayout from "@/components/CRMLayout";
import LeadQualityBadge from "@/components/LeadQualityBadge";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { differenceInDays, differenceInHours, format, isToday, isYesterday } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CalendarClock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  CreditCard,
  Download,
  Edit,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mail,
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
  XCircle,
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

const activityIconMap: Record<string, any> = {
  WhatsApp: MessageCircle,
  Call: Phone,
  SMS: MessageSquare,
  Meeting: Users,
  Offer: FileText,
  Email: Mail,
  Note: FileText,
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

const fitStatusConfig: Record<string, { label: string; labelAr: string; color: string; bg: string; icon: any }> = {
  Fit: { label: "Fit", labelAr: "مناسب", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: CheckCircle },
  "Not Fit": { label: "Not Fit", labelAr: "غير مناسب", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
  Pending: { label: "Pending", labelAr: "قيد المراجعة", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", icon: Clock },
};

type ClassificationType = "Lead" | "Prospect" | "Opportunity";
interface ClassificationConfig {
  label: string;
  labelAr: string;
  color: string;
  bg: string;
  border: string;
}
const classificationConfig: Record<ClassificationType, ClassificationConfig> = {
  Lead: { label: "Lead", labelAr: "عميل محتمل", color: "#3b82f6", bg: "bg-blue-50", border: "border-blue-300" },
  Prospect: { label: "Prospect", labelAr: "عميل مهتم", color: "#f59e0b", bg: "bg-amber-50", border: "border-amber-300" },
  Opportunity: { label: "Opportunity", labelAr: "فرصة بيع", color: "#22c55e", bg: "bg-green-50", border: "border-green-300" },
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

  let oppScore = 0;
  if (["Proposal Delivered", "Won"].includes(stage)) oppScore++;
  if (hasDeal) oppScore++;
  if (activitiesCount >= 3) oppScore++;
  if (q === "Hot") oppScore++;
  if (priceOfferSent) oppScore++;
  if (oppScore >= 2) return "Opportunity";

  let prospScore = 0;
  if (["Leads", "Meeting Scheduled"].includes(stage)) prospScore++;
  if (activitiesCount >= 2) prospScore++;
  if (["Warm", "Hot"].includes(q)) prospScore++;
  if (fs === "Fit") prospScore++;
  if (lastContactDays !== null && lastContactDays <= 7) prospScore++;
  if (prospScore >= 2) return "Prospect";

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
    return isRTL ? `${days} ${t(days === 1 ? "day" : "days")}` : `${days} ${t(days === 1 ? "day" : "days")}`;
  }

  return isRTL ? `${hours} ${t(hours === 1 ? "hour" : "hours")}` : `${hours} ${t(hours === 1 ? "hour" : "hours")}`;
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

  if (source.includes("pdf")) return { icon: FileText, label: t ? t("fileTypePdf") : "PDF" };
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
  if (currentIndex === -1) return stage === currentStage ? "current" : "upcoming";
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "current";
  return "upcoming";
}

function isProbablyUrl(value?: string | null) {
  if (!value) return false;
  return /^https?:\/\//i.test(value) || /^www\./i.test(value);
}

function formatFeedDateLabel(date: Date, isRTL: boolean) {
  if (isToday(date)) return isRTL ? "اليوم" : "Today";
  if (isYesterday(date)) return isRTL ? "أمس" : "Yesterday";
  return format(date, "dd/MM/yyyy");
}

function LeadScoreRing({ score, t }: { score: number; t: (key: any) => string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-2.5 py-1.5 shadow-sm">
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
  const [assignUserId, setAssignUserId] = useState<number>(0);
  const [assignReason, setAssignReason] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [noteText, setNoteText] = useState("");
  const [tamaraLoading, setTamaraLoading] = useState(false);
  const [sendViaTamara, setSendViaTamara] = useState(false);
  const [paymobLoading, setPaymobLoading] = useState(false);

  const [composerMode, setComposerMode] = useState<"note" | "activity">("note");
  const [dealOpen, setDealOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const [remindersOpen, setRemindersOpen] = useState(true);
  const [attachmentsOpen, setAttachmentsOpen] = useState(true);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [editingActivity, setEditingActivity] = useState<{ id: number; type: string; outcome?: string; notes?: string; activityTime?: string } | null>(null);

  const { data: lead, isLoading, refetch } = trpc.leads.byId.useQuery({ id: leadId }, { enabled: Number.isFinite(leadId) });
  const { data: activities, refetch: refetchActivities } = trpc.activities.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: deal, refetch: refetchDeal } = trpc.deals.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: stages } = trpc.pipeline.list.useQuery();
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: allUsers } = trpc.users.list.useQuery();
  const users = ["Admin", "SalesManager", "admin"].includes(user?.role ?? "") ? allUsers : undefined;
  const { data: internalNotes, refetch: refetchNotes } = trpc.notes.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: transfers, refetch: refetchTransfers } = trpc.transfers.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: attachments, refetch: refetchAttachments } = trpc.attachments.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: leadAssignments, refetch: refetchAssignments } = trpc.assignments.byLead.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: stageChanges } = trpc.auditLogs.byLeadStageChanges.useQuery({ leadId }, { enabled: Number.isFinite(leadId) });
  const { data: tamaraStatus } = trpc.tamara.isEnabled.useQuery();
  const { data: paymobStatus } = trpc.paymob.isEnabled.useQuery();
  const { data: slaConfig } = trpc.sla.get.useQuery();

  const [, navigate] = useLocation();
  const { startCall: innocallStartCall, isEnabled: innocallEnabled } = useInnoCall();

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

  const updateActivityMutation = trpc.activities.update.useMutation({
    onSuccess: () => {
      toast.success(t("success"));
      setEditingActivity(null);
      refetchActivities();
    },
    onError: (e) => toast.error(e.message),
  });

  const createDeal = trpc.deals.create.useMutation({
    onSuccess: (newDeal) => {
      toast.success(t("success"));
      setShowDeal(false);
      refetchDeal();
      dealReset();
      if (sendViaTamara && tamaraStatus?.enabled && newDeal?.id) {
        setTamaraLoading(true);
        tamaraCheckout.mutate({ dealId: newDeal.id });
        setSendViaTamara(false);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDeal = trpc.deals.update.useMutation({
    onSuccess: () => {
      toast.success(t("success"));
      refetchDeal();
    },
  });

  const cancelDeal = trpc.deals.cancel.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم إلغاء الصفقة بنجاح" : "Deal cancelled successfully");
      refetchDeal();
    },
    onError: (e) => toast.error(e.message),
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

  const paymobCheckout = trpc.paymob.createCheckout.useMutation({
    onSuccess: (data) => {
      setPaymobLoading(false);
      if (data.iframe_url) {
        window.open(data.iframe_url, "_blank", "noopener,noreferrer");
        toast.success(isRTL ? "تم إنشاء جلسة دفع Paymob" : "Paymob checkout created");
      } else {
        toast.error(isRTL ? "لم يتم الحصول على رابط الدفع" : "Failed to get checkout URL");
      }
    },
    onError: (e) => {
      setPaymobLoading(false);
      toast.error(e.message);
    },
  });

  const handlePaymobPayment = () => {
    if (!deal?.id) return;
    setPaymobLoading(true);
    paymobCheckout.mutate({ dealId: deal.id, paymentMethod: "card" });
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
      setAssignUserId(0);
      setAssignReason("");
      setAssignNotes("");
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
          fitStatus: (lead as any).fitStatus ?? "Pending",
        }
      : undefined,
  });

  const { register: actRegister, handleSubmit: actHandleSubmit, reset: actReset, setValue: actSetValue } = useForm({
    defaultValues: { type: "Call" as const, outcome: undefined as any, notes: "", activityTime: undefined as any },
  });

  const { register: dealRegister, handleSubmit: dealHandleSubmit, reset: dealReset, setValue: dealSetValue } = useForm({
    defaultValues: { valueSar: "", status: "Pending" as const, dealType: "New" as const, lossReason: "", notes: "", currency: "SAR" as string },
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

  const feedItems = useMemo(() => {
    const activityItems = (activities ?? []).map((activity: any) => ({
      id: `activity-${activity.id}`,
      itemId: activity.id,
      kind: "activity" as const,
      date: toDate(activity.activityTime ?? activity.createdAt) ?? new Date(),
      data: activity,
    }));

    const noteItems = ((internalNotes as any[]) ?? []).map((note: any) => ({
      id: `note-${note.id}`,
      itemId: note.id,
      kind: "note" as const,
      date: toDate(note.createdAt) ?? new Date(),
      data: note,
    }));

    return [...activityItems, ...noteItems].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [activities, internalNotes]);

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
  const pendingDealNeedsAttention = Boolean(
    deal?.status === "Pending" &&
      differenceInDays(new Date(), toDate((deal as any)?.updatedAt) ?? toDate((deal as any)?.createdAt) ?? new Date()) >= 3
  );
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


  const stageList = useMemo(
    () => {
      const list = stages ?? STAGES_FALLBACK.map((stageName) => ({ name: stageName, nameAr: stageName, color: "#6366f1" }));
      return list.filter((s: any) => s.isActive === undefined || s.isActive === 1 || s.isActive === true);
    },
    [stages]
  );

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
  const fitConfig = fitStatusConfig[(lead as any)?.fitStatus ?? "Pending"] ?? fitStatusConfig.Pending;
  const FitIcon = fitConfig.icon;

  return (
    <CRMLayout>
      <div className="min-h-screen p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-[1800px] space-y-4">
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


          <div className="sticky top-0 z-30 rounded-2xl border border-border/70 bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div
              className="h-1 rounded-t-2xl"
              style={{ background: `linear-gradient(90deg, ${classConfig.color}, ${stageColor[lead.stage] ?? tokens.primaryColor})` }}
            />
            <div className="p-3 md:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start gap-2">
                    <Link href="/leads">
                      <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0 rounded-xl">
                        <BackIcon size={16} />
                      </Button>
                    </Link>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h1 className="min-w-0 break-words text-xl font-bold text-foreground md:text-2xl">{lead.name ?? lead.phone}</h1>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classConfig.bg} ${classConfig.border}`} style={{ color: classConfig.color }}>
                              {isRTL ? classConfig.labelAr : classConfig.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 hover:bg-muted/70"
                              onClick={onCopyPhone}
                            >
                              <Phone size={14} />
                              <span dir="ltr" className="font-medium">{lead.phone || "—"}</span>
                            </button>
                            <span>
                              {t("createdAt")}: {format(new Date(lead.createdAt), "dd/MM/yyyy HH:mm")}
                            </span>
                            {lead.leadTime && (
                              <span>
                                {t("leadTime")}: {format(new Date(lead.leadTime), "dd/MM/yyyy HH:mm")}
                              </span>
                            )}
                            <span>
                              {t("lastContact" as any)}:{" "}
                              {lastActivityDate ? `${t("sincePrefix" as any)} ${relativeTimeLabel(lastActivityDate, t, isRTL)}` : t("noContactYet" as any)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <Button
                            variant="outline"
                            className="gap-2 rounded-xl"
                            onClick={() => whatsappUrl && window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                            disabled={!whatsappUrl}
                          >
                            <MessageCircle size={16} />
                            {isRTL ? "واتساب" : "WhatsApp"}
                          </Button>
                          <Button
                            variant="outline"
                            className="gap-2 rounded-xl"
                            onClick={() => lead.phone && innocallStartCall(lead.phone)}
                            disabled={!lead.phone || !innocallEnabled}
                          >
                            <Phone size={16} />
                            {isRTL ? "اتصال" : "Call"}
                          </Button>
                          {canEdit && (
                            editMode ? (
                              <>
                                <Button variant="outline" className="rounded-xl" onClick={() => setEditMode(false)}>
                                  {t("cancel")}
                                </Button>
                                <Button
                                  className="gap-2 rounded-xl text-white"
                                  style={{ background: tokens.primaryColor }}
                                  onClick={handleSubmit(onSaveLead)}
                                  disabled={updateLead.isPending}
                                >
                                  {updateLead.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                  {t("save")}
                                </Button>
                              </>
                            ) : (
                              <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setEditMode(true)}>
                                <Edit size={16} />
                                {t("edit")}
                              </Button>
                            )
                          )}
                        </div>
                      </div>

                      {!headerCollapsed && (
                        <>
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5">
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                                  style={{ background: stageColor[lead.stage] ?? tokens.primaryColor }}
                                >
                                  {t(lead.stage as any)}
                                </span>
                                <LeadQualityBadge quality={lead.leadQuality} />
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${fitConfig.bg} ${fitConfig.color}`}>
                                  <FitIcon size={12} />
                                  {isRTL ? fitConfig.labelAr : fitConfig.label}
                                </span>
                                {lead.isDuplicate && (
                                  <Badge variant="outline" className="gap-1">
                                    <Copy size={11} />
                                    {t("duplicate")}
                                  </Badge>
                                )}
                                {isSlaBreached && (
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle size={11} />
                                    SLA
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <LeadScoreRing score={leadScore} t={t} />
                              <div className="min-w-[220px] rounded-2xl border border-border/60 bg-muted/20 p-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">SLA</p>
                                    <p className="text-sm font-medium" style={{ color: slaStatus.color }}>
                                      {t(slaStatus.labelKey as any)}
                                    </p>
                                  </div>
                                  <div className="text-right text-xs text-muted-foreground">
                                    <p>{Math.round(slaProgressValue)}%</p>
                                    <p>{slaElapsedHours}/{slaThresholdHours}h</p>
                                  </div>
                                </div>
                                <Progress value={slaProgressValue} className="h-2" />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {canEdit && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50"
                                  onClick={() => setShowTransfer(true)}
                                >
                                  <ArrowRightLeft size={14} />
                                  {isRTL ? "تسليم" : "Handover"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 rounded-xl text-purple-600 border-purple-200 hover:bg-purple-50"
                                  onClick={() => setShowAssign(true)}
                                >
                                  <UserPlus size={14} />
                                  {isRTL ? "تعيين متعاون" : "Assign"}
                                </Button>
                              </>
                            )}
                            {(user?.role === "Admin" || user?.role === "admin") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 rounded-xl text-destructive hover:bg-destructive hover:text-white"
                                onClick={() => setShowDeleteConfirm(true)}
                              >
                                <Trash2 size={14} />
                                {isRTL ? "حذف" : "Delete"}
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-xl self-start mt-1"
                  onClick={() => setHeaderCollapsed(!headerCollapsed)}
                  title={headerCollapsed ? (isRTL ? "توسيع" : "Expand") : (isRTL ? "تصغير" : "Collapse")}
                >
                  {headerCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>


          <div className="lead-profile-grid grid gap-4">
            {/* ═══════════ LEFT COLUMN — Tabs (Info / Stages & Notes / Reminders) ═══════════ */}
            <div className="min-w-0">
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="info" className="flex-1 gap-1.5 text-xs">
                    <Users size={14} />
                    {isRTL ? "المعلومات" : "Info"}
                  </TabsTrigger>
                  <TabsTrigger value="formdata" className="flex-1 gap-1.5 text-xs">
                    <FileText size={14} />
                    {isRTL ? "بيانات النموذج" : "Form Data"}
                  </TabsTrigger>
                  <TabsTrigger value="stages" className="flex-1 gap-1.5 text-xs">
                    <Activity size={14} />
                    {isRTL ? "المراحل والملاحظات" : "Stages & Notes"}
                  </TabsTrigger>
                  <TabsTrigger value="reminders" className="flex-1 gap-1.5 text-xs">
                    <CalendarClock size={14} />
                    {isRTL ? "التذكيرات" : "Reminders"}
                  </TabsTrigger>
                </TabsList>

                {/* ── Tab: Info ── */}
                <TabsContent value="info">
              <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
                <CardContent className="p-4 space-y-4">
                  {editMode ? (
                    <>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("leadName")}</Label>
                          <Input {...register("name")} className="mt-1 h-8 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("phone")}</Label>
                          <Input {...register("phone")} className="mt-1 h-8 text-xs" dir="ltr" />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("country")}</Label>
                          <Input {...register("country")} className="mt-1 h-8 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("businessProfile")}</Label>
                          <Input {...register("businessProfile")} className="mt-1 h-8 text-xs" dir="ltr" />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("leadQuality")}</Label>
                          <Select defaultValue={lead.leadQuality} onValueChange={(v) => setValue("leadQuality", v as any)}>
                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["Hot", "Warm", "Cold", "Bad", "Unknown"].map((q) => (
                                <SelectItem key={q} value={q}>{t(q as any)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "حالة الملاءمة" : "Fit Status"}</Label>
                          <Select defaultValue={(lead as any).fitStatus ?? "Pending"} onValueChange={(v) => setValue("fitStatus", v as any)}>
                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Fit">{isRTL ? "مناسب" : "Fit"}</SelectItem>
                              <SelectItem value="Not Fit">{isRTL ? "غير مناسب" : "Not Fit"}</SelectItem>
                              <SelectItem value="Pending">{isRTL ? "قيد المراجعة" : "Pending"}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("stage")}</Label>
                          <Select defaultValue={lead.stage} onValueChange={(v) => setValue("stage", v)}>
                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {stageList.map((stageItem: any) => (
                                <SelectItem key={stageItem.name} value={stageItem.name}>
                                  {isRTL && stageItem.nameAr ? stageItem.nameAr : stageItem.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {["Admin", "SalesManager", "admin"].includes(user?.role ?? "") && (
                          <div>
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("owner")}</Label>
                            <Select
                              defaultValue={lead.ownerId ? String(lead.ownerId) : undefined}
                              onValueChange={(v) => setValue("ownerId", v === "none" ? undefined : Number(v))}
                            >
                              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
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
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("campaign")}</Label>
                          <Select defaultValue={lead.campaignName ?? "none"} onValueChange={(v) => setValue("campaignName", v === "none" ? "" : v)}>
                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {campaigns?.map((campaign: any) => (
                                <SelectItem key={campaign.id} value={campaign.name}>{campaign.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("notes")}</Label>
                        <Textarea {...register("notes")} className="mt-1 text-xs" rows={2} />
                      </div>
                      {(user?.role === "MediaBuyer" || user?.role === "Admin" || user?.role === "admin") && (
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("mediaBuyerNotes")}</Label>
                          {user?.role !== "MediaBuyer" ? (
                            <Textarea {...register("mediaBuyerNotes")} className="mt-1 text-xs" rows={2} />
                          ) : (
                            <p className="mt-1 rounded-lg bg-muted/30 p-2 text-xs text-foreground">{lead.mediaBuyerNotes ?? "—"}</p>
                          )}
                        </div>
                      )}
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("serviceIntroduced")}</Label>
                        <Input {...register("serviceIntroduced")} className="mt-1 h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("adCreative")}</Label>
                        <Input {...register("adCreative")} className="mt-1 h-8 text-xs" />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Basic Info */}
                      <div className="space-y-2.5">
                        <InfoRow label={t("leadName")} value={lead.name} />
                        <InfoRow label={t("phone")} value={lead.phone} mono />
                        <InfoRow label={t("country")} value={lead.country} />
                        <InfoRow label={t("businessProfile")} value={lead.businessProfile} isLink />
                        <InfoRow label={t("campaign")} value={lead.campaignName} />
                        <InfoRow label={t("adCreative")} value={lead.adCreative} />
                        <InfoRow label={t("owner")} value={(lead as any).ownerName ?? (!lead.ownerId ? t("ownerUnassigned" as any) : undefined)} />
                        <InfoRow
                          label={t("lastContact" as any)}
                          value={lastActivityDate ? `${t("sincePrefix" as any)} ${relativeTimeLabel(lastActivityDate, t, isRTL)}` : t("noContactYet" as any)}
                        />
                        <InfoRow label={isRTL ? "حالة الملاءمة" : "Fit Status"} value={isRTL ? fitConfig.labelAr : fitConfig.label} />
                        <InfoRow label={t("notes")} value={lead.notes} multiline />
                        {(user?.role === "MediaBuyer" || user?.role === "Admin" || user?.role === "admin") && (
                          <InfoRow label={t("mediaBuyerNotes")} value={lead.mediaBuyerNotes} multiline />
                        )}
                      </div>



                      {/* Sales Info */}
                      <div className="space-y-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {isRTL ? "معلومات المبيعات" : "Sales Info"}
                        </p>
                        <InfoRow label={t("serviceIntroduced")} value={lead.serviceIntroduced} />
                        <InfoRow label={t("adCreative")} value={lead.adCreative} />
                        {lead.priceOfferSent && (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
                            <CheckCircle size={12} />
                            {t("priceOfferSent")}
                          </div>
                        )}
                        {lead.priceOfferLink && <InfoRow label={t("priceOfferLink")} value={lead.priceOfferLink} isLink />}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
                </TabsContent>

                {/* ── Tab: Form Data ── */}
                <TabsContent value="formdata">
                  <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
                    <CardContent className="p-4 space-y-4">
                      {(() => {
                        const customData = (lead as any).customFieldsData;
                        const sourceData = (lead as any).sourceMetadata;
                        if (!customData || Object.keys(customData).length === 0) return (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <FileText size={32} className="text-muted-foreground/40 mb-2" />
                            <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد بيانات نموذج" : "No form data available"}</p>
                          </div>
                        );

                        const cleanLabel = (key: string) =>
                          key.replace(/_/g, " ").replace(/؟/g, "؟").replace(/\s+/g, " ").trim();

                        return (
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {isRTL ? "بيانات النموذج" : "Form Data"}
                            </p>
                            {Object.entries(customData)
                              .filter(([key]) => key !== "inbox_url")
                              .map(([key, value]) => (
                                <InfoRow key={key} label={cleanLabel(key)} value={String(value ?? "")} multiline />
                              ))}
                            {customData.inbox_url && (
                              <InfoRow label="Inbox URL" value={customData.inbox_url} isLink />
                            )}
                            {sourceData && (
                              <>
                                <div className="border-t border-border/40" />
                                <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 space-y-2">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {t("sourceInfo" as any)}
                                  </p>
                                  {sourceData.provider && <InfoRow label={t("provider" as any)} value={sourceData.provider} />}
                                  {sourceData.synced_via && <InfoRow label={t("syncMethod" as any)} value={sourceData.synced_via} />}
                                  {sourceData.campaign_id && <InfoRow label="Campaign ID" value={sourceData.campaign_id} mono />}
                                  {sourceData.form_id && <InfoRow label="Form ID" value={sourceData.form_id} mono />}
                                  {sourceData.ad_id && <InfoRow label="Ad ID" value={sourceData.ad_id} mono />}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Tab: Stages & Notes ── */}
                <TabsContent value="stages">
                  <div className="space-y-4">
              <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold">{t("stageJourney" as any)}</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-2 pt-0">
                  <div className="flex flex-wrap items-start justify-center gap-0 pb-1">
                    {stageList.map((stageItem: any, index: number) => {
                      const stage = stageItem.name ?? stageItem;
                      const stageNames = stageList.map((s: any) => s.name ?? s);
                      const state = getStageState(stage, lead.stage, stageNames);
                      const isCompleted = state === "completed";
                      const isCurrent = state === "current";
                      const color = isCompleted ? "#22c55e" : isCurrent ? (stageItem.color ?? stageColor[stage] ?? tokens.primaryColor) : "#cbd5e1";
                      const stageDate = stageTimelineDates[stage];

                      return (
                        <div key={stage} className="flex items-center">
                          <div className="flex flex-col items-center gap-0.5" style={{ width: `${Math.max(45, Math.floor(100 / stageList.length) - 2)}px` }}>
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 bg-background text-[8px] font-bold transition-all ${isCurrent ? 'ring-1 ring-offset-1' : ''}`}
                              style={{ borderColor: color, color, ...(isCurrent ? { ringColor: `${color}40` } : {}) }}
                            >
                              {isCompleted ? <CheckCircle size={10} style={{ color }} /> : index + 1}
                            </div>
                            <p className="text-[8px] font-medium text-foreground text-center whitespace-normal leading-tight max-w-[55px]">
                              {isRTL && stageItem.nameAr ? stageItem.nameAr : (t(stage as any) || stage)}
                            </p>
                            <p className="text-[7px] text-muted-foreground">
                              {stageDate ? format(new Date(stageDate), "dd/MM") : ""}
                            </p>
                          </div>
                          {index !== stageList.length - 1 && (
                            <div
                              className="h-[2px] w-2 rounded-full shrink-0"
                              style={{ backgroundColor: isCompleted ? "#22c55e" : "#e5e7eb" }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {isRTL ? "المساحة العملية" : "Lead Workspace"}
                    </CardTitle>
                    <div className="inline-flex rounded-lg border border-border/40 bg-muted/30 p-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={composerMode === "note" ? "default" : "ghost"}
                        className="rounded-md h-7 text-xs px-2.5"
                        style={composerMode === "note" ? { background: tokens.primaryColor, color: "white" } : {}}
                        onClick={() => setComposerMode("note")}
                      >
                        <MessageSquare size={12} className="me-1" />
                        {isRTL ? "ملاحظة" : "Note"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={composerMode === "activity" ? "default" : "ghost"}
                        className="rounded-md h-7 text-xs px-2.5"
                        style={composerMode === "activity" ? { background: tokens.primaryColor, color: "white" } : {}}
                        onClick={() => setComposerMode("activity")}
                      >
                        <Activity size={12} className="me-1" />
                        {isRTL ? "نشاط" : "Activity"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-4 pb-4 pt-0 space-y-4">
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                    {composerMode === "note" ? (
                      <div className="space-y-2">
                        <Textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder={isRTL ? "اكتب ملاحظة سريعة..." : "Write a quick note..."}
                          className="min-h-[60px] text-xs"
                          rows={2}
                        />
                        <div className="flex items-center justify-end">
                          <Button
                            size="sm"
                            style={{ background: tokens.primaryColor }}
                            className="gap-1.5 rounded-lg text-white h-7 text-xs"
                            onClick={onAddNote}
                            disabled={createNote.isPending || !noteText.trim()}
                          >
                            {createNote.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            {isRTL ? "حفظ" : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Activity size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground">
                              {isRTL ? "سجّل آخر تواصل مع العميل" : "Log the latest touchpoint"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="gap-1.5 rounded-lg h-7 text-xs" onClick={() => setShowActivity(true)}>
                            <Plus size={12} />
                            {t("newActivity")}
                          </Button>
                          {lastActivityDate && (
                            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-background px-2 py-1 text-[10px] text-muted-foreground">
                              <Clock size={11} />
                              {isRTL ? "آخر نشاط:" : "Latest:"} {relativeTimeLabel(lastActivityDate, t, isRTL)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {feedItems.length === 0 ? (
                    <EmptyState
                      icon={Activity}
                      title={isRTL ? "لا يوجد سجل نشاط بعد" : "No activity feed yet"}
                      description={isRTL ? "ابدأ بإضافة ملاحظة أو تسجيل أول نشاط." : "Start by adding a note or logging the first activity."}
                      actionLabel={composerMode === "note" ? (isRTL ? "أضف أول ملاحظة" : "Add first note") : t("newActivity")}
                      onAction={composerMode === "note" ? undefined : () => setShowActivity(true)}
                    />
                  ) : (
                    <div className="relative">
                      <div className={`absolute ${isRTL ? "right-[18px]" : "left-[18px]"} top-0 h-full w-px bg-border/70`} />
                      <div className="space-y-4">
                        {feedItems.map((item, index) => (
                          <FeedItemCard
                            key={item.id}
                            item={item}
                            isRTL={isRTL}
                            t={t}
                            isFirstInDay={
                              index === 0 ||
                              formatFeedDateLabel(item.date, isRTL) !== formatFeedDateLabel(feedItems[index - 1].date, isRTL)
                            }
                            onDeleteActivity={(activityId: number) => deleteActivity.mutate({ id: activityId })}
                            onDeleteNote={(noteId: number) => deleteNote.mutate({ id: noteId })}
                            onEditActivity={(activity) => setEditingActivity(activity)}
                            canEdit={canEdit}
                            userId={user?.id}
                            userRole={user?.role}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
                  </div>
                </TabsContent>

                {/* ── Tab: Reminders ── */}
                <TabsContent value="reminders">
                  <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
                    <CardHeader className="pb-1 pt-3 px-4">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <CalendarClock size={13} className="text-primary" />
                        {isRTL ? "التذكيرات" : "Reminders"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 overflow-hidden">
                      <LeadReminders leadId={leadId} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* ═══════════ RIGHT COLUMN — Sidebar (Deal / Team / Attachments / Transfers) ═══════════ */}
            <div className="space-y-3 lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:scrollbar-thin overflow-hidden">

              {/* ── Deal Section ── */}
              <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard size={13} className="text-blue-600" />
                    {isRTL ? "الصفقة" : "Deal"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-2.5">
                  {!deal ? (
                    <EmptyState
                      icon={CreditCard}
                      title={isRTL ? "لا توجد صفقة" : "No deal yet"}
                      description={isRTL ? "أنشئ أول صفقة لهذا العميل." : "Create the first deal for this lead."}
                      actionLabel={t("createDeal")}
                      onAction={canEdit ? () => setShowDeal(true) : undefined}
                    />
                  ) : (
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-blue-200/50 bg-blue-50/30 p-3 dark:border-blue-800/30 dark:bg-blue-950/20">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dealValue")}</p>
                            <p className="mt-0.5 text-xl font-bold text-foreground">
                              {deal.valueSar ? `${Number(deal.valueSar).toLocaleString()} ${(deal as any).currency || "SAR"}` : "—"}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              deal.status === "Won"
                                ? "bg-green-100 text-green-700"
                                : deal.status === "Lost"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {deal.status === "Won" ? <CheckCircle size={10} /> : deal.status === "Lost" ? <XCircle size={10} /> : <Clock size={10} />}
                            {t(deal.status as any)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <InfoRow label={t("dealType")} value={t(deal.dealType as any)} />
                        {deal.closedAt && <InfoRow label={t("closedAt")} value={format(new Date(deal.closedAt), "dd/MM/yyyy")} />}
                        {deal.lossReason && <InfoRow label={t("lossReason")} value={deal.lossReason} multiline />}
                        {deal.notes && <InfoRow label={t("notes")} value={deal.notes} multiline />}
                      </div>

                      {canEdit && (
                        <div className="rounded-lg border border-border/40 p-2">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("dealStatus")}</Label>
                          <Select defaultValue={deal.status} onValueChange={(v) => updateDeal.mutate({ id: deal.id, status: v as any })}>
                            <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pending">{t("Pending")}</SelectItem>
                              <SelectItem value="Won">{t("Won")}</SelectItem>
                              <SelectItem value="Lost">{t("Lost")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {tamaraStatus?.enabled && deal.status === "Pending" && (
                        <Button
                          size="sm"
                          className="w-full gap-1.5 rounded-lg text-white font-medium h-7 text-xs"
                          style={{ background: "linear-gradient(135deg, #c084fc 0%, #f472b6 50%, #fb923c 100%)" }}
                          onClick={handleTamaraPayment}
                          disabled={tamaraLoading}
                        >
                          {tamaraLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                          {isRTL ? "ادفع عبر تمارا" : "Pay with Tamara"}
                        </Button>
                      )}

                      {((deal as any).currency === "EGP" ? paymobStatus?.eg : paymobStatus?.sa) && deal.status === "Pending" && (
                        <Button
                          size="sm"
                          className="w-full gap-1.5 rounded-lg text-white font-medium h-7 text-xs"
                          style={{ background: "linear-gradient(135deg, #3b82f6 0%, #10b981 100%)" }}
                          onClick={handlePaymobPayment}
                          disabled={paymobLoading}
                        >
                          {paymobLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                          {isRTL ? "ادفع عبر Paymob" : "Pay with Paymob"}
                        </Button>
                      )}

                      {canEdit && deal.status !== "Won" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full gap-1.5 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
                          onClick={() => {
                            if (confirm(isRTL ? "هل أنت متأكد من إلغاء هذه الصفقة؟" : "Are you sure you want to cancel this deal?")) {
                              cancelDeal.mutate({ id: deal.id, leadId });
                            }
                          }}
                          disabled={cancelDeal.isPending}
                        >
                          {cancelDeal.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          {isRTL ? "إلغاء الصفقة" : "Cancel Deal"}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Team & Stakeholders ── */}
              <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users size={13} className="text-purple-600" />
                    {isRTL ? "الفريق والمتعاونون" : "Team & Stakeholders"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-2">
                  {(leadAssignments as any[])?.length ? (
                    <div className="space-y-1.5">
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
                          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 p-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">{a.userName}</p>
                              <Badge variant="outline" className={`mt-0.5 border text-[10px] h-5 ${roleColors[a.role] ?? "bg-gray-100"}`}>
                                {roleLabels[a.role] ?? a.role}
                              </Badge>
                            </div>
                            {a.role !== "owner" && canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-md text-muted-foreground hover:text-destructive"
                                onClick={() => removeAssignment.mutate({ assignmentId: a.id })}
                              >
                                <XCircle size={12} />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Users}
                      title={isRTL ? "لا يوجد متعاونون" : "No collaborators"}
                      description={isRTL ? "أضف شخصًا من الفريق." : "Assign teammates to this lead."}
                      actionLabel={isRTL ? "تعيين" : "Assign"}
                      onAction={canEdit ? () => setShowAssign(true) : undefined}
                    />
                  )}
                  {canEdit && (leadAssignments as any[])?.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 rounded-lg h-7 text-xs"
                      onClick={() => setShowAssign(true)}
                    >
                      <UserPlus size={12} />
                      {isRTL ? "تعيين متعاون" : "Assign"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* ── Attachments ── */}
              <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Paperclip size={13} />
                    {t("attachments" as any)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-2.5">
                  {canEdit && (
                    <form onSubmit={attachmentHandleSubmit(onAddAttachment)} className="space-y-2 rounded-lg border border-dashed border-border/50 p-2.5">
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("attachmentName" as any)}</Label>
                        <Input {...attachmentRegister("fileName")} className="mt-0.5 h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("attachmentUrl" as any)}</Label>
                        <div className="relative mt-0.5">
                          <Link2 size={12} className={`absolute ${isRTL ? "right-2" : "left-2"} top-1/2 -translate-y-1/2 text-muted-foreground`} />
                          <Input
                            id="attachment-url-input"
                            {...attachmentRegister("fileUrl", { required: true })}
                            className={`h-7 text-xs ${isRTL ? "pr-7" : "pl-7"}`}
                            placeholder="https://..."
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("attachmentType" as any)}</Label>
                          <Input {...attachmentRegister("fileType")} className="mt-0.5 h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("attachmentSize" as any)}</Label>
                          <Input {...attachmentRegister("fileSize")} type="number" min="0" className="mt-0.5 h-7 text-xs" dir="ltr" />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        style={{ background: tokens.primaryColor }}
                        className="gap-1.5 rounded-lg text-white h-7 text-xs"
                        disabled={createAttachment.isPending}
                      >
                        {createAttachment.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        {t("addAttachment" as any)}
                      </Button>
                    </form>
                  )}

                  {!attachments?.length ? (
                    <EmptyState
                      icon={FolderOpen}
                      title={isRTL ? "لا توجد مرفقات" : "No attachments"}
                      description={isRTL ? "أضف أول ملف مرتبط بالعميل." : "Add the first file for this lead."}
                      actionLabel={isRTL ? "أضف مرفقًا" : "Add attachment"}
                      onAction={() => {
                        const target = document.getElementById("attachment-url-input");
                        target?.focus();
                      }}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      {attachments.map((attachment: any) => {
                        const attachmentMeta = getAttachmentMeta(attachment.fileName, attachment.fileType, attachment.fileUrl, t);
                        const AttachmentIcon = attachmentMeta.icon;

                        return (
                          <div key={attachment.id} className="rounded-lg border border-border/40 bg-muted/20 p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 items-start gap-2">
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background">
                                  <AttachmentIcon size={13} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-foreground">{attachment.fileName}</p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
                                    <span>{attachmentMeta.label}</span>
                                    <span>·</span>
                                    <span>{formatAttachmentSize(attachment.fileSize)}</span>
                                    <span>·</span>
                                    <span>{format(new Date(attachment.createdAt), "dd/MM")}</span>
                                  </div>
                                  <a
                                    href={attachment.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[10px] text-primary hover:underline"
                                  >
                                    <ExternalLink size={10} />
                                    <span className="truncate" dir="ltr">{attachment.fileUrl}</span>
                                  </a>
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-md"
                                  onClick={() => window.open(attachment.fileUrl, "_blank", "noopener,noreferrer")}
                                >
                                  <Download size={12} />
                                </Button>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-md text-muted-foreground hover:text-destructive"
                                    onClick={() => deleteAttachment.mutate({ id: attachment.id })}
                                  >
                                    <Trash2 size={12} />
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

              {/* ── Transfer History ── */}
              <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ArrowRightLeft size={13} className="text-blue-600" />
                    {isRTL ? "سجل التسليم" : "Handover History"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-1.5">
                  {!(transfers as any)?.length ? (
                    <EmptyState
                      icon={ArrowRightLeft}
                      title={isRTL ? "لا يوجد سجل" : "No history"}
                      description={isRTL ? "سيظهر هنا تاريخ نقل العميل." : "Lead handover events will appear here."}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      {(transfers as any).map((tr: any) => (
                        <div key={tr.id} className="rounded-lg border border-blue-200/50 bg-blue-50/30 p-2 dark:border-blue-800/30 dark:bg-blue-950/20">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-medium text-blue-700 dark:text-blue-300">{tr.fromUserName}</span>
                            <ArrowRight size={10} className="text-blue-500" />
                            <span className="font-medium text-blue-700 dark:text-blue-300">{tr.toUserName}</span>
                          </div>
                          {tr.reason && <p className="mt-1 text-[10px] text-muted-foreground"><span className="font-medium">{t("transferReason" as any)}:</span> {tr.reason}</p>}
                          {tr.notes && <p className="mt-0.5 text-[10px] text-muted-foreground"><span className="font-medium">{t("transferNotes" as any)}:</span> {tr.notes}</p>}
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            <Clock size={9} className="me-0.5 inline" />
                            {format(new Date(tr.createdAt), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
            <div className="flex justify-end gap-2">
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
            {tamaraStatus?.enabled && (
              <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "#c084fc40", background: "linear-gradient(135deg, #c084fc10 0%, #f472b610 50%, #fb923c10 100%)" }}>
                <div>
                  <p className="text-sm font-medium">{isRTL ? "إرسال رابط تمارا" : "Send Tamara Payment Link"}</p>
                  <p className="text-[10px] text-muted-foreground">{isRTL ? "ادفع بالتقسيط عبر تمارا" : "Auto-send installment payment link"}</p>
                </div>
                <Switch checked={sendViaTamara} onCheckedChange={setSendViaTamara} />
              </div>
            )}
            <div className="flex justify-end gap-2">
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowTransfer(false)}>{t("cancel")}</Button>
              <Button type="submit" className="gap-1.5 text-white" style={{ background: "#3b82f6" }} disabled={transferLead.isPending}>
                {transferLead.isPending ? <><Loader2 size={14} className="animate-spin" /> {t("loading")}</> : <><ArrowRightLeft size={14} /> {t("transferLead" as any)}</>}
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>{t("cancel")}</Button>
              <Button variant="destructive" className="gap-1.5" onClick={() => deleteLead.mutate({ id: leadId })} disabled={deleteLead.isPending}>
                {deleteLead.isPending ? <><Loader2 size={14} className="animate-spin" /> {t("loading")}</> : <><Trash2 size={14} /> {isRTL ? "حذف" : "Delete"}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <Select onValueChange={(v) => setAssignUserId(Number(v))}>
                <SelectTrigger><SelectValue placeholder={isRTL ? "اختر..." : "Select..."} /></SelectTrigger>
                <SelectContent>
                  {(allUsers ?? []).filter((u: any) => u.id !== lead?.ownerId).map((agent: any) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.name} ({agent.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Input value={assignReason} onChange={(e) => setAssignReason(e.target.value)} placeholder={isRTL ? "مثال: متابعة الشيفت التاني" : "e.g. Second shift follow-up"} />
            </div>
            <div>
              <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
              <Textarea value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} rows={2} placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowAssign(false); setAssignUserId(0); setAssignReason(""); setAssignNotes(""); }}>{t("cancel")}</Button>
              <Button
                className="gap-1.5 text-white"
                style={{ background: "#8b5cf6" }}
                disabled={assignCollaborator.isPending}
                onClick={() => {
                  if (!assignUserId) {
                    toast.error(isRTL ? "اختر شخص" : "Select a person");
                    return;
                  }
                  assignCollaborator.mutate({ leadId, userId: assignUserId, role: assignRole as any, reason: assignReason || undefined, notes: assignNotes || undefined });
                }}
              >
                {assignCollaborator.isPending ? <><Loader2 size={14} className="animate-spin" /> {t("loading")}</> : <><UserPlus size={14} /> {isRTL ? "تعيين" : "Assign"}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Activity Dialog ── */}
      <Dialog open={!!editingActivity} onOpenChange={(open) => { if (!open) setEditingActivity(null); }}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit size={18} className="text-blue-600" />
              {isRTL ? "تعديل النشاط" : "Edit Activity"}
            </DialogTitle>
          </DialogHeader>
          {editingActivity && (
            <div className="space-y-4">
              <div>
                <Label>{t("activityType")}</Label>
                <Select value={editingActivity.type} onValueChange={(v) => setEditingActivity({ ...editingActivity, type: v })}>
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
                <Select value={editingActivity.outcome ?? ""} onValueChange={(v) => setEditingActivity({ ...editingActivity, outcome: v || undefined })}>
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
                <Input
                  type="datetime-local"
                  value={editingActivity.activityTime ? new Date(editingActivity.activityTime).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditingActivity({ ...editingActivity, activityTime: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                />
              </div>
              <div>
                <Label>{t("notes")}</Label>
                <Textarea
                  value={editingActivity.notes ?? ""}
                  onChange={(e) => setEditingActivity({ ...editingActivity, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingActivity(null)}>{t("cancel")}</Button>
                <Button
                  style={{ background: tokens.primaryColor }}
                  className="text-white"
                  disabled={updateActivityMutation.isPending}
                  onClick={() => {
                    if (!editingActivity) return;
                    updateActivityMutation.mutate({
                      id: editingActivity.id,
                      type: editingActivity.type as any,
                      outcome: editingActivity.outcome as any,
                      notes: editingActivity.notes || undefined,
                      activityTime: editingActivity.activityTime ? new Date(editingActivity.activityTime) : undefined,
                    });
                  }}
                >
                  {updateActivityMutation.isPending ? t("loading") : t("save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

function FeedItemCard({
  item,
  isRTL,
  t,
  isFirstInDay,
  onDeleteActivity,
  onDeleteNote,
  onEditActivity,
  canEdit,
  userId,
  userRole,
}: {
  item: { id: string; itemId: number; kind: "activity" | "note"; date: Date; data: any };
  isRTL: boolean;
  t: (key: any) => string;
  isFirstInDay: boolean;
  onDeleteActivity: (id: number) => void;
  onDeleteNote: (id: number) => void;
  onEditActivity: (activity: { id: number; type: string; outcome?: string; notes?: string; activityTime?: string }) => void;
  canEdit: boolean;
  userId?: number;
  userRole?: string;
}) {
  const isNote = item.kind === "note";
  const Icon = isNote ? MessageSquare : activityIconMap[item.data.type] ?? Activity;
  const title = isNote
    ? (isRTL ? "ملاحظة داخلية" : "Internal note")
    : `${t(item.data.type as any)}${item.data.outcome ? ` · ${t(item.data.outcome as any)}` : ""}`;

  const subtitle = isNote
    ? item.data.userName ?? "—"
    : `${item.data.userName ?? "—"}${item.data.outcome ? ` • ${t(item.data.outcome as any)}` : ""}`;

  const canDeleteCurrentNote = isNote ? (item.data.userId === userId || userRole === "Admin" || userRole === "admin") : false;
  const canDeleteThis = isNote ? canDeleteCurrentNote : canEdit;
  const dayLabel = formatFeedDateLabel(item.date, isRTL);

  return (
    <div className="relative ps-12">
      {isFirstInDay && (
        <div className="mb-3 flex items-center gap-3">
          <div className={`absolute ${isRTL ? "right-[18px]" : "left-[18px]"} top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-primary`} />
          <div className="inline-flex items-center rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
            {dayLabel}
          </div>
        </div>
      )}

      <div className={`absolute ${isRTL ? "right-[18px]" : "left-[18px]"} top-4 -translate-x-1/2`}>
        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl border ${isNote ? "border-violet-200 bg-violet-50 text-violet-600" : "border-blue-200 bg-blue-50 text-blue-600"} shadow-sm`}>
          <Icon size={16} />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              {item.kind === "activity" && item.data.outcome && (
                <span className={`text-xs font-medium ${outcomeColors[item.data.outcome] ?? "text-muted-foreground"}`}>
                  {t(item.data.outcome as any)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{subtitle}</span>
              <span>•</span>
              <span>{format(item.date, "dd/MM/yyyy HH:mm")}</span>
            </div>

            {isNote ? (
              <p className="break-words whitespace-pre-wrap text-sm text-foreground">{item.data.content}</p>
            ) : item.data.notes ? (
              <p className="break-words whitespace-pre-wrap text-sm text-foreground">{item.data.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isRTL ? "تم تسجيل هذا النشاط بدون ملاحظات إضافية." : "This activity was logged without additional notes."}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-1">
              {!isNote && canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => onEditActivity({
                    id: item.itemId,
                    type: item.data.type,
                    outcome: item.data.outcome,
                    notes: item.data.notes,
                    activityTime: item.data.activityTime,
                  })}
                >
                  <Edit size={14} />
                </Button>
              )}
              {canDeleteThis && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive"
                  onClick={() => (isNote ? onDeleteNote(item.itemId) : onDeleteActivity(item.itemId))}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm">
        <Icon size={18} className="text-muted-foreground" />
      </div>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" className="mt-3 gap-1.5 rounded-xl text-xs" onClick={onAction}>
          <Plus size={12} />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  multiline,
  isLink,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  multiline?: boolean;
  isLink?: boolean;
}) {
  const safeValue = value ?? "—";
  const treatAsLink = isLink || isProbablyUrl(value);
  const linkValue = value?.startsWith("http") ? value : value ? `https://${value}` : undefined;

  return (
    <div className="min-w-0 space-y-0.5">
      <span className="block text-[11px] text-muted-foreground">{label}</span>

      {treatAsLink && value ? (
        <a
          href={linkValue}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-lg border border-border/60 bg-muted/20 px-2 py-1 text-xs text-primary transition-colors hover:bg-muted/40"
        >
          <Link2 size={12} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate break-all">{value}</span>
          <ExternalLink size={11} className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
        </a>
      ) : (
        <span
          className={[
            "block min-w-0 text-xs text-foreground",
            mono ? "font-mono" : "",
            multiline ? "break-words whitespace-pre-wrap" : "truncate break-all overflow-hidden",
          ].join(" ")}
        >
          {safeValue}
        </span>
      )}
    </div>
  );
}


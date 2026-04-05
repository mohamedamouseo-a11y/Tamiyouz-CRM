import * as React from "react";

import CRMLayout from "../components/CRMLayout";
import { trpc } from "@/lib/trpc";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Phone, Mail, MessageCircle, Users, CheckCircle, Clock, GripVertical, Loader2, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

function toDateInput(value: unknown) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

const planStatusClass: Record<string, string> = {
  Active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Paused: "border-amber-200 bg-amber-50 text-amber-700",
  Cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  Pending: "border-slate-200 bg-slate-50 text-slate-700",
};

const contractStatusClass: Record<string, string> = {
  Active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Expired: "border-slate-200 bg-slate-50 text-slate-700",
  Cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  PendingRenewal: "border-amber-200 bg-amber-50 text-amber-700",
};

const renewalStatusClass: Record<string, string> = {
  New: "border-slate-200 bg-slate-50 text-slate-700",
  Negotiation: "border-amber-200 bg-amber-50 text-amber-700",
  SentOffer: "border-blue-200 bg-blue-50 text-blue-700",
  Won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Lost: "border-rose-200 bg-rose-50 text-rose-700",
  Renewed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NotRenewed: "border-rose-200 bg-rose-50 text-rose-700",
};

const followUpTypeIcon: Record<string, React.ReactNode> = {
  Call: <Phone size={14} className="text-blue-500" />,
  Meeting: <Users size={14} className="text-purple-500" />,
  WhatsApp: <MessageCircle size={14} className="text-green-500" />,
  Email: <Mail size={14} className="text-orange-500" />,
};

const priorityClass: Record<string, string> = {
  Low: "border-slate-200 bg-slate-50 text-slate-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  High: "border-rose-200 bg-rose-50 text-rose-700",
};

const taskStatusClass: Record<string, string> = {
  ToDo: "border-slate-200 bg-slate-50 text-slate-700",
  InProgress: "border-blue-200 bg-blue-50 text-blue-700",
  Done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

type RouteProps = { params: { id: string } };

export default function ClientProfile({ params }: RouteProps) {
  const id = Number(params.id);

  const managersQ = trpc.accountManagement.listAccountManagers.useQuery();
  const clientQ = trpc.accountManagement.getClientProfile.useQuery({ id }, { enabled: Number.isFinite(id) });
  const followUpsQ = trpc.followUps.list.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });
  const tasksQ = trpc.clientTasks.list.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });
  const onboardingQ = trpc.onboarding.getItems.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });
  const briefQ = trpc.accountManagement.getHandoverBrief.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });
  const usersListQ = trpc.usersList.list.useQuery();

  // ─── Tamara ─────────────────────────────────────────────────────────────────
  const { data: tamaraStatus } = trpc.tamara.isEnabled.useQuery();
  const [tamaraLoadingId, setTamaraLoadingId] = React.useState<number | null>(null);
  const tamaraCheckout = trpc.tamara.createContractCheckout.useMutation({
    onSuccess: (data) => {
      setTamaraLoadingId(null);
      if (data.checkout_url) window.open(data.checkout_url, "_blank");
      toast.success("Tamara checkout created");
    },
    onError: (err) => {
      setTamaraLoadingId(null);
      toast.error("Tamara error", { description: err.message });
    },
  });

  // ─── Paymob ─────────────────────────────────────────────────────────────────
  const { data: paymobStatus } = trpc.paymob.isEnabled.useQuery();
  const [paymobLoadingId, setPaymobLoadingId] = React.useState<number | null>(null);
  const paymobCheckout = trpc.paymob.createContractCheckout.useMutation({
    onSuccess: (data) => {
      setPaymobLoadingId(null);
      if (data.iframe_url) window.open(data.iframe_url, "_blank", "noopener,noreferrer");
      toast.success("Paymob checkout created");
    },
    onError: (err) => {
      setPaymobLoadingId(null);
      toast.error("Paymob error", { description: err.message });
    },
  });

  // Phase 4+5 queries
  const objectivesQ = trpc.objectives.list.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });
  const deliverablesQ = trpc.deliverables.list.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });
  const upsellQ = trpc.upsell.list.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });
  const communicationsQ = trpc.communications.list.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });
  const csatQ = trpc.csat.getScores.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });

  // Phase 4+5 state
  const [objectiveTitle, setObjectiveTitle] = React.useState("");
  const [objectiveStatus, setObjectiveStatus] = React.useState<"OnTrack" | "AtRisk" | "OffTrack">("OnTrack");
  const [keyResultDrafts, setKeyResultDrafts] = React.useState<Record<number, { title: string; targetValue: string }>>({});
  const [progressDrafts, setProgressDrafts] = React.useState<Record<number, string>>({});
  const [deliverableDialogOpen, setDeliverableDialogOpen] = React.useState(false);
  const [deliverableForm, setDeliverableForm] = React.useState({ name: "", description: "", dueDate: "", assignedTo: "" });
  const [upsellDialogOpen, setUpsellDialogOpen] = React.useState(false);
  const [upsellForm, setUpsellForm] = React.useState({ title: "", potentialValue: "", notes: "" });
  const [communicationDialogOpen, setCommunicationDialogOpen] = React.useState(false);
  const [communicationForm, setCommunicationForm] = React.useState({ channelName: "", channelType: "EmailThread" as string, link: "", notes: "" });

  // ─── Edit Client State ──────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = React.useState(false);
  const [editState, setEditState] = React.useState({
    planStatus: "Active",
    group: "",
    accountManagerId: "",
    competentPerson: "",
    contactEmail: "",
    contactPhone: "",
    leadName: "",
    phone: "",
    otherPhones: "",
    businessProfile: "",
    marketingObjective: "",
    servicesNeeded: "",
    socialMedia: "",
    feedback: "",
    notes: "",
    contractLink: "",
  });

  const updateClientM = trpc.accountManagement.updateClient.useMutation({
    onSuccess: async () => {
      setEditOpen(false);
      await clientQ.refetch();
    },
  });

  // ─── Contract State ─────────────────────────────────────────────────────────
  const [contractDialogOpen, setContractDialogOpen] = React.useState(false);
  const [contractEditingId, setContractEditingId] = React.useState<number | null>(null);
  const [contractForm, setContractForm] = React.useState({
    packageIds: [] as number[],
    contractName: "",
    startDate: "",
    endDate: "",
    period: "",
    charges: "",
    currency: "SAR",
    monthlyCharges: "",
    status: "Active",
    contractRenewalStatus: "New",
    renewalAssignedTo: "",
    priceOffer: "",
    upselling: "",
    notes: "",
  });

  const createContractM = trpc.accountManagement.createContract.useMutation({
    onSuccess: async () => {
      setContractDialogOpen(false);
      setContractEditingId(null);
      await clientQ.refetch();
    },
  });

  const updateContractM = trpc.accountManagement.updateContract.useMutation({
    onSuccess: async () => {
      setContractDialogOpen(false);
      setContractEditingId(null);
      await clientQ.refetch();
    },
  });

  // ─── Follow-up State ────────────────────────────────────────────────────────
  const [fuDialogOpen, setFuDialogOpen] = React.useState(false);
  const [fuForm, setFuForm] = React.useState({ type: "Call", followUpDate: "", notes: "" });

  const createFollowUpM = trpc.followUps.create.useMutation({
    onSuccess: async () => {
      setFuDialogOpen(false);
      setFuForm({ type: "Call", followUpDate: "", notes: "" });
      await followUpsQ.refetch();
      await clientQ.refetch();
    },
  });

  const completeFollowUpM = trpc.followUps.complete.useMutation({
    onSuccess: async () => {
      await followUpsQ.refetch();
      await clientQ.refetch();
    },
  });

  // ─── Edit Follow-up State ──────────────────────────────────────────────────
  const [editFuDialogOpen, setEditFuDialogOpen] = React.useState(false);
  const [editFuId, setEditFuId] = React.useState<number | null>(null);
  const [editFuForm, setEditFuForm] = React.useState({ type: "Call", followUpDate: "", notes: "" });

  const updateFollowUpM = trpc.followUps.update.useMutation({
    onSuccess: async () => {
      setEditFuDialogOpen(false);
      setEditFuId(null);
      setEditFuForm({ type: "Call", followUpDate: "", notes: "" });
      await followUpsQ.refetch();
      await clientQ.refetch();
      toast.success("Follow-up updated successfully");
    },
  });

  function openEditFollowUp(fu: any) {
    setEditFuId(fu.id);
    setEditFuForm({
      type: fu.type ?? "Call",
      followUpDate: toDateInput(fu.followUpDate),
      notes: fu.notes ?? "",
    });
    setEditFuDialogOpen(true);
  }

  async function submitEditFollowUp() {
    if (!editFuId) return;
    await updateFollowUpM.mutateAsync({
      id: editFuId,
      type: editFuForm.type as any,
      followUpDate: editFuForm.followUpDate ? `${editFuForm.followUpDate}T00:00:00` : undefined,
      notes: editFuForm.notes.trim() || null,
    });
  }

  // ─── Task State ─────────────────────────────────────────────────────────────
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [taskForm, setTaskForm] = React.useState({ title: "", assignedTo: "", dueDate: "", priority: "Medium", notes: "" });

  const createTaskM = trpc.clientTasks.create.useMutation({
    onSuccess: async () => {
      setTaskDialogOpen(false);
      setTaskForm({ title: "", assignedTo: "", dueDate: "", priority: "Medium", notes: "" });
      await tasksQ.refetch();
    },
  });

  const updateTaskM = trpc.clientTasks.update.useMutation({
    onSuccess: async () => {
      await tasksQ.refetch();
    },
  });

  // ─── Onboarding State ──────────────────────────────────────────────────────
  const initOnboardingM = trpc.onboarding.initialize.useMutation({
    onSuccess: async () => {
      await onboardingQ.refetch();
    },
  });

  const updateOnboardingItemM = trpc.onboarding.updateItem.useMutation({
    onSuccess: async () => {
      await onboardingQ.refetch();
    },
  });

  const initDefaultsM = trpc.onboarding.initializeDefaults.useMutation({
    onSuccess: async () => { await onboardingQ.refetch(); toast.success("Default onboarding checklist created"); },
    onError: (e: any) => toast.error(e?.message || "Failed to initialize"),
  });

  const updateItemWithNotesM = trpc.onboarding.updateItemWithNotes.useMutation({
    onSuccess: async () => { await onboardingQ.refetch(); },
  });

  const addOnboardingItemM = trpc.onboarding.addItem.useMutation({
    onSuccess: async () => { await onboardingQ.refetch(); setNewItemName(""); setNewItemOpen(false); },
    onError: (e: any) => toast.error(e?.message || "Failed to add item"),
  });

  const removeOnboardingItemM = trpc.onboarding.removeItem.useMutation({
    onSuccess: async () => { await onboardingQ.refetch(); },
    onError: (e: any) => toast.error(e?.message || "Failed to remove item"),
  });

  // Handover brief form state
  const [briefForm, setBriefForm] = React.useState({
    companyName: "", contactPersonName: "", phoneOrWhatsapp: "", signedContract: false,
    contractedServiceDetails: "", packageOrPrice: "", contractDuration: "", paymentStatus: "",
    clientGoals: "", painPoints: "", expectations: "", salesPromises: "", dataProvidedByClient: "", extraNotes: "",
  });
  const [briefEditing, setBriefEditing] = React.useState(false);
  const submitBriefM = trpc.accountManagement.submitHandoverBrief.useMutation({
    onSuccess: async () => {
      toast.success("Handover brief submitted successfully");
      setBriefEditing(false);
      await briefQ.refetch();
      await profileQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to submit brief"),
  });

  const deleteBriefM = trpc.accountManagement.deleteHandoverBrief.useMutation({
    onSuccess: async () => {
      toast.success("Brief cleared");
      await briefQ.refetch();
      await profileQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete brief"),
  });

  const updateBriefStatusM = trpc.accountManagement.updateBriefStatus.useMutation({
    onSuccess: async () => {
      toast.success("Brief status updated");
      await briefQ.refetch();
      await profileQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update status"),
  });

  const editItemTitleM = trpc.onboarding.editItemTitle.useMutation({
    onSuccess: async () => { await onboardingQ.refetch(); setEditingItemId(null); setEditingItemName(""); },
    onError: (e: any) => toast.error(e?.message || "Failed to edit item"),
  });

  const clientHistoryQ = trpc.accountManagement.getClientHistory.useQuery({ clientId: id }, { enabled: Number.isFinite(id) });

  const [editingItemId, setEditingItemId] = React.useState<number | null>(null);
  const [editingItemName, setEditingItemName] = React.useState("");

  // Add item dialog state
  const [newItemOpen, setNewItemOpen] = React.useState(false);
  const [newItemName, setNewItemName] = React.useState("");
  const [newItemPhase, setNewItemPhase] = React.useState(2);

  // Phase labels
  const phaseLabels: Record<number, string> = {
    2: "Phase 2: Account Setup", 3: "Phase 3: Creative & Content",
    4: "Phase 4: Campaign Launch", 5: "Phase 5: Reporting & Optimization", 6: "Phase 6: Account Review",
  };

  // Phase 4+5 mutations
  const createObjectiveM = trpc.objectives.create.useMutation({ onSuccess: async () => { setObjectiveTitle(""); await objectivesQ.refetch(); } });
  const createKeyResultM = trpc.objectives.createKeyResult.useMutation({ onSuccess: async () => { await objectivesQ.refetch(); } });
  const updateKeyResultM = trpc.objectives.updateKeyResult.useMutation({ onSuccess: async () => { await objectivesQ.refetch(); await clientQ.refetch(); } });
  const createDeliverableM = trpc.deliverables.create.useMutation({ onSuccess: async () => { setDeliverableDialogOpen(false); setDeliverableForm({ name: "", description: "", dueDate: "", assignedTo: "" }); await deliverablesQ.refetch(); } });
  const updateDeliverableM = trpc.deliverables.update.useMutation({ onSuccess: async () => { await deliverablesQ.refetch(); } });
  const createUpsellM = trpc.upsell.create.useMutation({ onSuccess: async () => { setUpsellDialogOpen(false); setUpsellForm({ title: "", potentialValue: "", notes: "" }); await upsellQ.refetch(); } });
  const updateUpsellM = trpc.upsell.update.useMutation({ onSuccess: async () => { await upsellQ.refetch(); } });

  // ─── Delete Mutations ───────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = React.useState<{ type: string; id: number; name: string } | null>(null);

  const deleteFollowUpM = trpc.followUps.delete.useMutation({
    onSuccess: async () => { await followUpsQ.refetch(); toast.success("Follow-up deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteTaskM = trpc.clientTasks.delete.useMutation({
    onSuccess: async () => { await tasksQ.refetch(); toast.success("Task deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteObjectiveM = trpc.objectives.delete.useMutation({
    onSuccess: async () => { await objectivesQ.refetch(); toast.success("Objective deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteDeliverableM = trpc.deliverables.delete.useMutation({
    onSuccess: async () => { await deliverablesQ.refetch(); toast.success("Deliverable deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteUpsellM = trpc.upsell.delete.useMutation({
    onSuccess: async () => { await upsellQ.refetch(); toast.success("Upsell deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteCommunicationM = trpc.communications.delete.useMutation({
    onSuccess: async () => { await communicationsQ.refetch(); toast.success("Channel deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  function confirmDelete() {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    switch (type) {
      case "followUp": deleteFollowUpM.mutate({ id }); break;
      case "task": deleteTaskM.mutate({ id }); break;
      case "objective": deleteObjectiveM.mutate({ id }); break;
      case "deliverable": deleteDeliverableM.mutate({ id }); break;
      case "upsell": deleteUpsellM.mutate({ id }); break;
      case "communication": deleteCommunicationM.mutate({ id }); break;
    }
    setDeleteConfirm(null);
  }
  const createCommunicationM = trpc.communications.create.useMutation({ onSuccess: async () => { setCommunicationDialogOpen(false); setCommunicationForm({ channelName: "", channelType: "EmailThread", link: "", notes: "" }); await communicationsQ.refetch(); } });

  // ─── Edit Task State ──────────────────────────────────────────────────────
  const [editTaskDialogOpen, setEditTaskDialogOpen] = React.useState(false);
  const [editTaskId, setEditTaskId] = React.useState<number | null>(null);
  const [editTaskForm, setEditTaskForm] = React.useState({ title: "", assignedTo: "", dueDate: "", priority: "Medium", notes: "" });

  function openEditTask(task: any) {
    setEditTaskId(task.id);
    setEditTaskForm({
      title: task.title ?? "",
      assignedTo: task.assignedTo ? String(task.assignedTo) : "",
      dueDate: toDateInput(task.dueDate),
      priority: task.priority ?? "Medium",
      notes: task.notes ?? "",
    });
    setEditTaskDialogOpen(true);
  }

  async function submitEditTask() {
    if (!editTaskId) return;
    await updateTaskM.mutateAsync({
      id: editTaskId,
      data: {
        title: editTaskForm.title.trim() || undefined,
        assignedTo: editTaskForm.assignedTo ? Number(editTaskForm.assignedTo) : null,
        dueDate: editTaskForm.dueDate ? `${editTaskForm.dueDate}T00:00:00` : null,
        priority: editTaskForm.priority as any,
        notes: editTaskForm.notes.trim() || null,
      },
    });
    setEditTaskDialogOpen(false);
    setEditTaskId(null);
    toast.success("Task updated successfully");
  }

  // ─── Edit Objective State ──────────────────────────────────────────────────
  const [editObjDialogOpen, setEditObjDialogOpen] = React.useState(false);
  const [editObjId, setEditObjId] = React.useState<number | null>(null);
  const [editObjForm, setEditObjForm] = React.useState({ title: "", status: "OnTrack" });

  const updateObjectiveM = trpc.objectives.updateObjective.useMutation({
    onSuccess: async () => {
      setEditObjDialogOpen(false);
      setEditObjId(null);
      await objectivesQ.refetch();
      toast.success("Objective updated successfully");
    },
  });

  function openEditObjective(obj: any) {
    setEditObjId(obj.id);
    setEditObjForm({ title: obj.title ?? "", status: obj.status ?? "OnTrack" });
    setEditObjDialogOpen(true);
  }

  async function submitEditObjective() {
    if (!editObjId) return;
    await updateObjectiveM.mutateAsync({
      id: editObjId,
      title: editObjForm.title.trim() || undefined,
      status: editObjForm.status as any,
    });
  }

  // ─── Edit Deliverable State ────────────────────────────────────────────────
  const [editDeliverableDialogOpen, setEditDeliverableDialogOpen] = React.useState(false);
  const [editDeliverableId, setEditDeliverableId] = React.useState<number | null>(null);
  const [editDeliverableForm, setEditDeliverableForm] = React.useState({ name: "", description: "", dueDate: "", assignedTo: "" });

  function openEditDeliverable(item: any) {
    setEditDeliverableId(item.id);
    setEditDeliverableForm({
      name: item.name ?? "",
      description: item.description ?? "",
      dueDate: toDateInput(item.dueDate),
      assignedTo: item.assignedTo ? String(item.assignedTo) : "",
    });
    setEditDeliverableDialogOpen(true);
  }

  async function submitEditDeliverable() {
    if (!editDeliverableId) return;
    await updateDeliverableM.mutateAsync({
      id: editDeliverableId,
      data: {
        name: editDeliverableForm.name.trim() || undefined,
        description: editDeliverableForm.description.trim() || null,
        dueDate: editDeliverableForm.dueDate || null,
        assignedTo: editDeliverableForm.assignedTo ? Number(editDeliverableForm.assignedTo) : null,
      },
    });
    setEditDeliverableDialogOpen(false);
    setEditDeliverableId(null);
    toast.success("Deliverable updated successfully");
  }

  // ─── Edit Upsell State ─────────────────────────────────────────────────────
  const [editUpsellDialogOpen, setEditUpsellDialogOpen] = React.useState(false);
  const [editUpsellId, setEditUpsellId] = React.useState<number | null>(null);
  const [editUpsellForm, setEditUpsellForm] = React.useState({ title: "", potentialValue: "", notes: "" });

  function openEditUpsell(item: any) {
    setEditUpsellId(item.id);
    setEditUpsellForm({
      title: item.title ?? "",
      potentialValue: item.potentialValue ? String(item.potentialValue) : "",
      notes: item.notes ?? "",
    });
    setEditUpsellDialogOpen(true);
  }

  async function submitEditUpsell() {
    if (!editUpsellId) return;
    await updateUpsellM.mutateAsync({
      id: editUpsellId,
      data: {
        title: editUpsellForm.title.trim() || undefined,
        potentialValue: editUpsellForm.potentialValue || null,
        notes: editUpsellForm.notes.trim() || null,
      },
    });
    setEditUpsellDialogOpen(false);
    setEditUpsellId(null);
    toast.success("Upsell updated successfully");
  }

  // ─── Edit Communication State ──────────────────────────────────────────────
  const [editCommDialogOpen, setEditCommDialogOpen] = React.useState(false);
  const [editCommId, setEditCommId] = React.useState<number | null>(null);
  const [editCommForm, setEditCommForm] = React.useState({ channelName: "", channelType: "EmailThread" as string, link: "", notes: "" });

  const updateCommunicationM = trpc.communications.update.useMutation({
    onSuccess: async () => {
      setEditCommDialogOpen(false);
      setEditCommId(null);
      await communicationsQ.refetch();
      toast.success("Channel updated successfully");
    },
  });

  function openEditCommunication(ch: any) {
    setEditCommId(ch.id);
    setEditCommForm({
      channelName: ch.channelName ?? "",
      channelType: ch.channelType ?? "EmailThread",
      link: ch.link ?? "",
      notes: ch.notes ?? "",
    });
    setEditCommDialogOpen(true);
  }

  async function submitEditCommunication() {
    if (!editCommId) return;
    await updateCommunicationM.mutateAsync({
      id: editCommId,
      data: {
        channelName: editCommForm.channelName.trim() || undefined,
        channelType: editCommForm.channelType as any,
        link: editCommForm.link.trim() || null,
        notes: editCommForm.notes.trim() || null,
      },
    });
  }

  // ─── Derived Data ───────────────────────────────────────────────────────────
  const data = clientQ.data;
  const client = data?.client;
  const contractsList = data?.contracts ?? [];
  const packages = data?.servicePackages ?? [];
  const followUpsList = followUpsQ.data ?? [];
  const tasksList = tasksQ.data ?? [];
  const onboardingItems = onboardingQ.data ?? [];

  React.useEffect(() => {
    if (!client) return;
    setEditState({
      planStatus: String(client.planStatus ?? "Active"),
      group: client.group ? String(client.group) : "",
      accountManagerId: client.accountManagerId ? String(client.accountManagerId) : "",
      competentPerson: client.competentPerson ? String(client.competentPerson) : "",
      contactEmail: client.contactEmail ? String(client.contactEmail) : "",
      contactPhone: client.contactPhone ? String(client.contactPhone) : "",
      leadName: client.clientLeadName ? String(client.clientLeadName) : (client.leadName ? String(client.leadName) : ""),
      phone: client.clientPhone ? String(client.clientPhone) : (client.leadPhone ? String(client.leadPhone) : ""),
      otherPhones: client.otherPhones ? String(client.otherPhones) : "",
      businessProfile: client.businessProfile ? String(client.businessProfile) : "",
      marketingObjective: client.marketingObjective ? String(client.marketingObjective) : "",
      servicesNeeded: client.servicesNeeded ? String(client.servicesNeeded) : "",
      socialMedia: client.socialMedia ? String(client.socialMedia) : "",
      feedback: client.feedback ? String(client.feedback) : "",
      notes: client.notes ? String(client.notes) : "",
      contractLink: client.contractLink ? String(client.contractLink) : "",
    });
  }, [client?.id]);

  function resetContractForm() {
    setContractForm({
      packageIds: [],
      contractName: "",
      startDate: "",
      endDate: "",
      period: "",
      charges: "",
      currency: "SAR",
      monthlyCharges: "",
      status: "Active",
      contractRenewalStatus: "New",
      renewalAssignedTo: "",
      priceOffer: "",
      upselling: "",
      notes: "",
    });
  }

  function openAddContract() {
    setContractEditingId(null);
    resetContractForm();
    setContractDialogOpen(true);
  }

  function openEditContract(row: any) {
    setContractEditingId(Number(row.id));
    setContractForm({
      packageIds: row.packageIds && Array.isArray(row.packageIds) ? row.packageIds : (row.packageId ? [row.packageId] : []),
      contractName: row.contractName ? String(row.contractName) : "",
      startDate: toDateInput(row.startDate),
      endDate: toDateInput(row.endDate),
      period: row.period ? String(row.period) : "",
      charges: row.charges === null || row.charges === undefined ? "" : String(row.charges),
      currency: row.currency ? String(row.currency) : "SAR",
      monthlyCharges: row.monthlyCharges === null || row.monthlyCharges === undefined ? "" : String(row.monthlyCharges),
      status: String(row.status ?? "Active"),
      contractRenewalStatus: String(row.contractRenewalStatus ?? "New"),
      renewalAssignedTo: row.renewalAssignedTo ? String(row.renewalAssignedTo) : "",
      priceOffer: row.priceOffer ? String(row.priceOffer) : "",
      upselling: row.upselling ? String(row.upselling) : "",
      notes: row.notes ? String(row.notes) : "",
    });
    setContractDialogOpen(true);
  }

  async function submitClientUpdate() {
    if (!client) return;
    await updateClientM.mutateAsync({
      id: client.id,
      planStatus: editState.planStatus as any,
      group: editState.group.trim() || undefined,
      accountManagerId: editState.accountManagerId ? Number(editState.accountManagerId) : null,
      competentPerson: editState.competentPerson.trim() || null,
      contactEmail: editState.contactEmail.trim() || null,
      contactPhone: editState.contactPhone.trim() || null,
      leadName: editState.leadName.trim() || null,
      phone: editState.phone.trim() || null,
      otherPhones: editState.otherPhones.trim() || null,
      businessProfile: editState.businessProfile.trim() || undefined,
      marketingObjective: editState.marketingObjective.trim() || undefined,
      servicesNeeded: editState.servicesNeeded.trim() || undefined,
      socialMedia: editState.socialMedia.trim() || undefined,
      feedback: editState.feedback.trim() || undefined,
      notes: editState.notes.trim() || undefined,
      contractLink: editState.contractLink.trim() || null,
    });
  }

  async function submitContract() {
    if (!client) return;

    if (contractEditingId) {
      await updateContractM.mutateAsync({
        id: contractEditingId,
        packageIds: contractForm.packageIds.length > 0 ? contractForm.packageIds : null,
        contractName: contractForm.contractName.trim() || undefined,
        startDate: contractForm.startDate ? `${contractForm.startDate}T00:00:00` : undefined,
        endDate: contractForm.endDate ? `${contractForm.endDate}T00:00:00` : undefined,
        period: contractForm.period.trim() || undefined,
        charges: contractForm.charges.trim() || undefined,
        currency: contractForm.currency.trim() || undefined,
        monthlyCharges: contractForm.monthlyCharges.trim() || undefined,
        status: contractForm.status as any,
        contractRenewalStatus: contractForm.contractRenewalStatus as any,
        renewalAssignedTo: contractForm.renewalAssignedTo ? Number(contractForm.renewalAssignedTo) : null,
        priceOffer: contractForm.priceOffer.trim() || undefined,
        upselling: contractForm.upselling.trim() || undefined,
        notes: contractForm.notes.trim() || undefined,
      });
    } else {
      await createContractM.mutateAsync({
        clientId: client.id,
        packageIds: contractForm.packageIds.length > 0 ? contractForm.packageIds : null,
        contractName: contractForm.contractName.trim() || undefined,
        startDate: contractForm.startDate ? `${contractForm.startDate}T00:00:00` : undefined,
        endDate: contractForm.endDate ? `${contractForm.endDate}T00:00:00` : undefined,
        period: contractForm.period.trim() || undefined,
        charges: contractForm.charges.trim() || undefined,
        currency: contractForm.currency.trim() || undefined,
        monthlyCharges: contractForm.monthlyCharges.trim() || undefined,
        status: contractForm.status as any,
        contractRenewalStatus: contractForm.contractRenewalStatus as any,
        renewalAssignedTo: contractForm.renewalAssignedTo ? Number(contractForm.renewalAssignedTo) : null,
        priceOffer: contractForm.priceOffer.trim() || undefined,
        upselling: contractForm.upselling.trim() || undefined,
        notes: contractForm.notes.trim() || undefined,
      });
    }
  }

  async function submitFollowUp() {
    if (!client) return;
    await createFollowUpM.mutateAsync({
      clientId: client.id,
      type: fuForm.type as any,
      followUpDate: fuForm.followUpDate ? `${fuForm.followUpDate}T00:00:00` : new Date().toISOString(),
      notes: fuForm.notes.trim() || null,
    });
  }

  async function submitTask() {
    if (!client) return;
    await createTaskM.mutateAsync({
      clientId: client.id,
      title: taskForm.title.trim(),
      assignedTo: taskForm.assignedTo ? Number(taskForm.assignedTo) : null,
      dueDate: taskForm.dueDate ? `${taskForm.dueDate}T00:00:00` : null,
      priority: taskForm.priority as any,
      notes: taskForm.notes.trim() || null,
    });
  }

  async function moveTask(taskId: number, newStatus: string) {
    await updateTaskM.mutateAsync({ id: taskId, data: { status: newStatus as any } });
  }

  const clientName = client?.clientLeadName || client?.leadName || client?.group || `Client #${id}`;

  // Onboarding progress
  const onboardingTotal = onboardingItems.length;
  const onboardingChecked = onboardingItems.filter((i: any) => i.isChecked).length;
  const onboardingPercent = onboardingTotal > 0 ? Math.round((onboardingChecked / onboardingTotal) * 100) : 0;

  // Tasks grouped by status for Kanban
  const tasksByStatus = {
    ToDo: tasksList.filter((t: any) => t.status === "ToDo"),
    InProgress: tasksList.filter((t: any) => t.status === "InProgress"),
    Done: tasksList.filter((t: any) => t.status === "Done"),
  };

  return (
    <CRMLayout>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/clients">
            <Button variant="ghost" size="icon"><ArrowLeft size={18} /></Button>
          </Link>
          <h1 className="text-xl font-semibold">{clientQ.isLoading ? "Loading..." : clientName}</h1>
        </div>

        {clientQ.isLoading ? (
          <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
            Loading...
          </div>
        ) : !client ? (
          <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
            Client not found
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <TabsList className="grid w-full grid-cols-11 text-xs">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="handover-brief">Handover</TabsTrigger>
                <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="contracts">Contracts</TabsTrigger>
                <TabsTrigger value="followups">Follow-ups</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="okrs">OKRs</TabsTrigger>
                <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
                <TabsTrigger value="upsell">Upsell</TabsTrigger>
                <TabsTrigger value="communication">Communication</TabsTrigger>
              </TabsList>
            </div>

            {/* ── Overview Tab ── */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xl font-semibold">{clientName}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={planStatusClass[String(client.planStatus)] ?? ""}>
                        {String(client.planStatus)}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Account Manager: {client.accountManagerName ?? "—"}
                      </div>
                    </div>
                  </div>

                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Edit</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Client</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Plan Status</Label>
                          <Select value={editState.planStatus} onValueChange={(v) => setEditState((s) => ({ ...s, planStatus: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Paused">Paused</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                              <SelectItem value="Pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Group</Label>
                          <Input value={editState.group} onChange={(e) => setEditState((s) => ({ ...s, group: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Account Manager</Label>
                          <Select
                            value={editState.accountManagerId || "none"}
                            onValueChange={(v) => setEditState((s) => ({ ...s, accountManagerId: v === "none" ? "" : v }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {(managersQ.data ?? []).map((m: any) => (
                                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Lead Name</Label>
                          <Input value={editState.leadName} onChange={(e) => setEditState((s) => ({ ...s, leadName: e.target.value }))} placeholder="Client / Lead name" />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input value={editState.phone} onChange={(e) => setEditState((s) => ({ ...s, phone: e.target.value }))} placeholder="+966..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Competent Person</Label>
                          <Input value={editState.competentPerson} onChange={(e) => setEditState((s) => ({ ...s, competentPerson: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Contact Email</Label>
                          <Input value={editState.contactEmail} onChange={(e) => setEditState((s) => ({ ...s, contactEmail: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Contact Phone</Label>
                          <Input value={editState.contactPhone} onChange={(e) => setEditState((s) => ({ ...s, contactPhone: e.target.value }))} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Other Phone Numbers</Label>
                          <Input value={editState.otherPhones} onChange={(e) => setEditState((s) => ({ ...s, otherPhones: e.target.value }))} placeholder="Additional phone numbers (comma separated)" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Business Profile</Label>
                          <Textarea value={editState.businessProfile} onChange={(e) => setEditState((s) => ({ ...s, businessProfile: e.target.value }))} rows={2} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Marketing Objective</Label>
                          <Textarea value={editState.marketingObjective} onChange={(e) => setEditState((s) => ({ ...s, marketingObjective: e.target.value }))} rows={2} />
                        </div>
                        <div className="space-y-2">
                          <Label>Services Needed</Label>
                          <Input value={editState.servicesNeeded} onChange={(e) => setEditState((s) => ({ ...s, servicesNeeded: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Social Media</Label>
                          <Textarea value={editState.socialMedia} onChange={(e) => setEditState((s) => ({ ...s, socialMedia: e.target.value }))} rows={3} placeholder="Platform: Link (one per line)" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Contract Link</Label>
                          <Input value={editState.contractLink} onChange={(e) => setEditState((s) => ({ ...s, contractLink: e.target.value }))} placeholder="https://drive.google.com/... or contract URL" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Notes</Label>
                          <Textarea value={editState.notes} onChange={(e) => setEditState((s) => ({ ...s, notes: e.target.value }))} rows={3} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updateClientM.isPending}>Cancel</Button>
                        <Button onClick={submitClientUpdate} disabled={updateClientM.isPending}>
                          {updateClientM.isPending ? "Saving..." : "Save"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Client Info Grid */}
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <InfoItem label="Lead Name" value={client.clientLeadName || client.leadName} />
                  <InfoItem label="Phone" value={client.clientPhone || client.leadPhone} />
                  <InfoItem label="Other Phones" value={client.otherPhones} />
                  <InfoItem label="Competent Person" value={client.competentPerson} />
                  <InfoItem label="Contact Email" value={client.contactEmail} />
                  <InfoItem label="Contact Phone" value={client.contactPhone} />
                  <InfoItem label="Group" value={client.group} />
                  <InfoItem label="Business Profile" value={client.businessProfile} />
                  <InfoItem label="Marketing Objective" value={client.marketingObjective} />
                  <InfoItem label="Services Needed" value={client.servicesNeeded} />
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Social Media</div>
                    <div className="text-sm whitespace-pre-line">{client.socialMedia || "\u2014"}</div>
                  </div>
                  <InfoItem label="Feedback" value={client.feedback} />
                  <InfoItem label="Notes" value={client.notes} />
                  {client.contractLink && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Contract Link</div>
                      <a href={String(client.contractLink)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{String(client.contractLink)}</a>
                    </div>
                  )}
                  <InfoItem label="Last Follow-up" value={fmtDate(client.lastFollowUpDate)} />
                  <InfoItem label="Next Follow-up" value={fmtDate(client.nextFollowUpDate)} />
                </div>
              </div>

              {/* Onboarding Progress in Overview */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Onboarding Progress</h2>
                  {onboardingTotal === 0 && (
                    <Button
                      size="sm"
                      onClick={() => initOnboardingM.mutate({ clientId: id, checklistId: 1 })}
                      disabled={initOnboardingM.isPending}
                    >
                      {initOnboardingM.isPending ? "Initializing..." : "Initialize Onboarding"}
                    </Button>
                  )}
                </div>

                {onboardingTotal === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    No onboarding checklist initialized yet. Click "Initialize Onboarding" to start.
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Onboarding: {onboardingPercent}% Complete</span>
                        <span className="text-muted-foreground">{onboardingChecked}/{onboardingTotal}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div
                          className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${onboardingPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {onboardingItems.map((item: any) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={!!item.isChecked}
                            onChange={(e) => updateOnboardingItemM.mutate({ id: item.id, isChecked: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className={`text-sm ${item.isChecked ? "line-through text-muted-foreground" : ""}`}>
                            {item.itemName}
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* ── Handover Brief Tab ── */}
            <TabsContent value="handover-brief" className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Sales Handover Brief</h2>
                    {briefQ.data && (
                      <div className="flex items-center gap-2 mt-1">
                        {(briefQ.data as any).submittedByName && (
                          <span className="text-xs text-muted-foreground">By: {(briefQ.data as any).submittedByName}</span>
                        )}
                        {(briefQ.data as any).updatedAt && (
                          <span className="text-xs text-muted-foreground">· Updated: {new Date((briefQ.data as any).updatedAt).toLocaleDateString()}</span>
                        )}
                        {(() => {
                          const bStatus = (client as any)?.briefStatus ?? (profileQ.data?.client as any)?.briefStatus;
                          const statusMap: Record<string,string> = { Submitted:"bg-blue-100 text-blue-700", Reviewed:"bg-green-100 text-green-700", NeedsInfo:"bg-yellow-100 text-yellow-700", NotStarted:"bg-slate-100 text-slate-600" };
                          const cls = statusMap[bStatus] ?? "bg-slate-100 text-slate-600";
                          return bStatus ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{bStatus}</span> : null;
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {briefQ.data && !briefEditing && (["Admin","SalesManager","admin"] as string[]).includes(user?.role ?? "") && (
                      <>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => updateBriefStatusM.mutate({ clientId: id, status: "Reviewed" })} disabled={updateBriefStatusM.isPending}>✓ Reviewed</Button>
                        <Button size="sm" variant="outline" className="text-yellow-700 border-yellow-300 hover:bg-yellow-50" onClick={() => updateBriefStatusM.mutate({ clientId: id, status: "NeedsInfo" })} disabled={updateBriefStatusM.isPending}>⚠ Needs Info</Button>
                      </>
                    )}
                    {briefQ.data && !briefEditing && (
                      <Button size="sm" variant="outline" onClick={() => {
                        const b = briefQ.data as any;
                        setBriefForm({
                          companyName: b.companyName || "", contactPersonName: b.contactPersonName || "",
                          phoneOrWhatsapp: b.phoneOrWhatsapp || "", signedContract: !!b.signedContract,
                          contractedServiceDetails: b.contractedServiceDetails || "", packageOrPrice: b.packageOrPrice || "",
                          contractDuration: b.contractDuration || "", paymentStatus: b.paymentStatus || "",
                          clientGoals: b.clientGoals || "", painPoints: b.painPoints || "",
                          expectations: b.expectations || "", salesPromises: b.salesPromises || "",
                          dataProvidedByClient: b.dataProvidedByClient || "", extraNotes: b.extraNotes || "",
                        });
                        setBriefEditing(true);
                      }}>Edit</Button>
                    )}
                    {briefQ.data && !briefEditing && (
                      <Button size="sm" variant="destructive" onClick={() => { if (confirm("Clear the handover brief? This will be logged.")) deleteBriefM.mutate({ clientId: id }); }} disabled={deleteBriefM.isPending}>
                        {deleteBriefM.isPending ? "Deleting..." : "Clear"}
                      </Button>
                    )}
                    {!briefQ.data && (
                      <Button size="sm" onClick={() => setBriefEditing(true)}>Submit Brief</Button>
                    )}
                  </div>
                </div>

                {briefEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input value={briefForm.companyName} onChange={e => setBriefForm(s => ({ ...s, companyName: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Person</Label>
                        <Input value={briefForm.contactPersonName} onChange={e => setBriefForm(s => ({ ...s, contactPersonName: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone / WhatsApp</Label>
                        <Input value={briefForm.phoneOrWhatsapp} onChange={e => setBriefForm(s => ({ ...s, phoneOrWhatsapp: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Package / Price</Label>
                        <Input value={briefForm.packageOrPrice} onChange={e => setBriefForm(s => ({ ...s, packageOrPrice: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Contract Duration</Label>
                        <Input value={briefForm.contractDuration} onChange={e => setBriefForm(s => ({ ...s, contractDuration: e.target.value }))} placeholder="e.g. 6 months" />
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Status</Label>
                        <Input value={briefForm.paymentStatus} onChange={e => setBriefForm(s => ({ ...s, paymentStatus: e.target.value }))} placeholder="e.g. Paid, Partial, Pending" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Contracted Services</Label>
                        <Textarea value={briefForm.contractedServiceDetails} onChange={e => setBriefForm(s => ({ ...s, contractedServiceDetails: e.target.value }))} rows={2} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="signedContract" checked={briefForm.signedContract} onChange={e => setBriefForm(s => ({ ...s, signedContract: e.target.checked }))} className="h-4 w-4 rounded" />
                        <Label htmlFor="signedContract">Signed Contract Received</Label>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Client Goals</Label>
                        <Textarea value={briefForm.clientGoals} onChange={e => setBriefForm(s => ({ ...s, clientGoals: e.target.value }))} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Pain Points</Label>
                        <Textarea value={briefForm.painPoints} onChange={e => setBriefForm(s => ({ ...s, painPoints: e.target.value }))} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Client Expectations</Label>
                        <Textarea value={briefForm.expectations} onChange={e => setBriefForm(s => ({ ...s, expectations: e.target.value }))} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Sales Promises</Label>
                        <Textarea value={briefForm.salesPromises} onChange={e => setBriefForm(s => ({ ...s, salesPromises: e.target.value }))} rows={3} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Data Provided by Client</Label>
                        <Textarea value={briefForm.dataProvidedByClient} onChange={e => setBriefForm(s => ({ ...s, dataProvidedByClient: e.target.value }))} rows={2} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Extra Notes</Label>
                        <Textarea value={briefForm.extraNotes} onChange={e => setBriefForm(s => ({ ...s, extraNotes: e.target.value }))} rows={2} />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={() => setBriefEditing(false)}>Cancel</Button>
                      <Button
                        disabled={submitBriefM.isPending}
                        onClick={() => submitBriefM.mutate({ clientId: id, ...briefForm })}
                      >
                        {submitBriefM.isPending ? "Submitting..." : "Submit Brief"}
                      </Button>
                    </div>
                  </div>
                ) : briefQ.data ? (
                  <div className="space-y-4">
                    {(briefQ.data as any).submittedByName && (
                      <div className="text-sm text-muted-foreground">Submitted by: <strong>{(briefQ.data as any).submittedByName}</strong></div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { label: "Company Name", key: "companyName" },
                        { label: "Contact Person", key: "contactPersonName" },
                        { label: "Phone / WhatsApp", key: "phoneOrWhatsapp" },
                        { label: "Signed Contract", key: "signedContract" },
                        { label: "Package / Price", key: "packageOrPrice" },
                        { label: "Contract Duration", key: "contractDuration" },
                        { label: "Payment Status", key: "paymentStatus" },
                        { label: "Contracted Services", key: "contractedServiceDetails" },
                        { label: "Client Goals", key: "clientGoals" },
                        { label: "Pain Points", key: "painPoints" },
                        { label: "Client Expectations", key: "expectations" },
                        { label: "Sales Promises", key: "salesPromises" },
                        { label: "Data Provided", key: "dataProvidedByClient" },
                        { label: "Extra Notes", key: "extraNotes" },
                      ].map(({ label, key }) => {
                        const val = (briefQ.data as any)[key];
                        if (!val && val !== 0) return null;
                        return (
                          <div key={key} className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">{label}</div>
                            <div className="text-sm">{key === "signedContract" ? (val ? "✅ Yes" : "❌ No") : String(val)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No handover brief submitted yet. Sales team should submit the brief before onboarding begins.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Onboarding Tab (Phase 2-6) ── */}
            <TabsContent value="onboarding" className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Onboarding Checklist</h2>
                  <div className="flex gap-2">
                    {onboardingItems.length === 0 && (
                      <Button size="sm" onClick={() => initDefaultsM.mutate({ clientId: id })} disabled={initDefaultsM.isPending}>
                        {initDefaultsM.isPending ? "Creating..." : "Create Default Checklist"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setNewItemOpen(true)}>+ Add Item</Button>
                  </div>
                </div>

                {/* Overall Progress */}
                {onboardingTotal > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">Overall Progress</span>
                      <span className="text-muted-foreground">{onboardingChecked}/{onboardingTotal} ({onboardingPercent}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div className="bg-emerald-500 h-3 rounded-full transition-all duration-300" style={{ width: `${onboardingPercent}%` }} />
                    </div>
                  </div>
                )}

                {onboardingItems.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No onboarding items yet. Click "Create Default Checklist" to start with the standard onboarding phases.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const grouped: Record<number, any[]> = {};
                      for (const item of onboardingItems) {
                        const ph = (item as any).phase ?? 1;
                        if (!grouped[ph]) grouped[ph] = [];
                        grouped[ph].push(item);
                      }
                      return Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([phaseNum, items]) => {
                        const ph = Number(phaseNum);
                        const phLabel = (items[0] as any).phaseLabel || phaseLabels[ph] || `Phase ${ph}`;
                        const phChecked = items.filter((i: any) => i.isChecked).length;
                        const phTotal = items.length;
                        const phPct = phTotal > 0 ? Math.round((phChecked / phTotal) * 100) : 0;
                        return (
                          <div key={ph} className="border border-border rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-sm">{phLabel}</h3>
                              <span className="text-xs text-muted-foreground">{phChecked}/{phTotal}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                              <div className="bg-teal-500 h-1.5 rounded-full transition-all" style={{ width: `${phPct}%` }} />
                            </div>
                            <div className="space-y-2">
                              {items.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 group">
                                  <input
                                    type="checkbox"
                                    checked={!!item.isChecked}
                                    onChange={(e) => updateItemWithNotesM.mutate({ id: item.id, isChecked: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 shrink-0"
                                  />
                                  {editingItemId === item.id ? (
                                    <div className="flex items-center gap-1 flex-1">
                                      <input
                                        autoFocus
                                        className="text-sm flex-1 border-b border-primary outline-none bg-transparent"
                                        value={editingItemName}
                                        onChange={e => setEditingItemName(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === "Enter" && editingItemName.trim()) {
                                            editItemTitleM.mutate({ id: item.id, itemName: editingItemName.trim() });
                                          } else if (e.key === "Escape") { setEditingItemId(null); }
                                        }}
                                      />
                                      <button className="text-xs text-primary px-1" onClick={() => editingItemName.trim() && editItemTitleM.mutate({ id: item.id, itemName: editingItemName.trim() })}>✓</button>
                                      <button className="text-xs text-muted-foreground" onClick={() => setEditingItemId(null)}>✕</button>
                                    </div>
                                  ) : (
                                    <span
                                      className={`text-sm flex-1 ${item.isChecked ? "line-through text-muted-foreground" : ""}`}
                                      onDoubleClick={() => { setEditingItemId(item.id); setEditingItemName(item.itemName); }}
                                      title="Double-click to rename"
                                    >
                                      {item.itemName}
                                    </span>
                                  )}
                                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                    <button
                                      className="text-blue-400 hover:text-blue-600 text-xs"
                                      title="Edit name"
                                      onClick={() => { setEditingItemId(item.id); setEditingItemName(item.itemName); }}
                                    >✏</button>
                                    <button
                                      className="text-red-400 hover:text-red-600 text-xs"
                                      onClick={() => { if (confirm("Remove this item?")) removeOnboardingItemM.mutate({ id: item.id }); }}
                                    >✕</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Add Item Dialog */}
                {newItemOpen && (
                  <div className="mt-4 p-4 border border-dashed rounded-xl space-y-3">
                    <h3 className="text-sm font-medium">Add New Checklist Item</h3>
                    <select
                      value={newItemPhase}
                      onChange={e => setNewItemPhase(Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {[2,3,4,5,6].map(p => <option key={p} value={p}>{phaseLabels[p]}</option>)}
                    </select>
                    <Input
                      placeholder="Item name..."
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && newItemName.trim()) { addOnboardingItemM.mutate({ clientId: id, itemName: newItemName.trim(), phase: newItemPhase, phaseLabel: phaseLabels[newItemPhase], phaseOrder: 99 }); } }}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setNewItemOpen(false); setNewItemName(""); }}>Cancel</Button>
                      <Button
                        size="sm"
                        disabled={!newItemName.trim() || addOnboardingItemM.isPending}
                        onClick={() => addOnboardingItemM.mutate({ clientId: id, itemName: newItemName.trim(), phase: newItemPhase, phaseLabel: phaseLabels[newItemPhase], phaseOrder: 99 })}
                      >
                        {addOnboardingItemM.isPending ? "Adding..." : "Add"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Handover History Tab ── */}
            <TabsContent value="history" className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Handover & Onboarding Audit Trail</h2>
                {clientHistoryQ.isLoading ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Loading history...</div>
                ) : !clientHistoryQ.data || clientHistoryQ.data.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">No handover/onboarding events logged yet.</div>
                ) : (
                  <div className="space-y-3">
                    {clientHistoryQ.data.map((log: any) => {
                      const actionColorMap: Record<string, string> = {
                        HANDOVER_BRIEF_CREATED: "bg-blue-100 text-blue-700",
                        HANDOVER_BRIEF_UPDATED: "bg-indigo-100 text-indigo-700",
                        HANDOVER_BRIEF_DELETED: "bg-red-100 text-red-700",
                        HANDOVER_BRIEF_REVIEWED: "bg-green-100 text-green-700",
                        HANDOVER_BRIEF_NEEDS_INFO: "bg-yellow-100 text-yellow-700",
                        CLIENT_ASSIGNED_TO_ACCOUNT_MANAGER: "bg-teal-100 text-teal-700",
                        CLIENT_REASSIGNED_TO_ACCOUNT_MANAGER: "bg-cyan-100 text-cyan-700",
                        CLIENT_HANDOVER_STATUS_CHANGED: "bg-purple-100 text-purple-700",
                        CLIENT_BRIEF_STATUS_CHANGED: "bg-orange-100 text-orange-700",
                        ONBOARDING_ITEM_ADDED: "bg-emerald-100 text-emerald-700",
                        ONBOARDING_ITEM_UPDATED: "bg-slate-100 text-slate-700",
                        ONBOARDING_ITEM_COMPLETED: "bg-green-100 text-green-700",
                        ONBOARDING_ITEM_UNCOMPLETED: "bg-gray-100 text-gray-600",
                        ONBOARDING_ITEM_DELETED: "bg-red-100 text-red-700",
                      };
                      const cls = actionColorMap[log.action] ?? "bg-slate-100 text-slate-700";
                      return (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 hover:bg-slate-50/50">
                          <span className={`inline-flex shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>{log.action}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{log.userName ?? "Unknown"}</span>
                              <span className="text-xs text-muted-foreground">({log.userRole})</span>
                              <span className="text-xs text-muted-foreground ml-auto">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</span>
                            </div>
                            {log.details && typeof log.details === "object" && (
                              <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                                {(log.details as any).changedFields?.length > 0 && (
                                  <div>Fields changed: <strong>{(log.details as any).changedFields.join(", ")}</strong></div>
                                )}
                                {(log.details as any).oldStatus && (
                                  <div>Status: <span className="line-through">{(log.details as any).oldStatus}</span> → <strong>{(log.details as any).newStatus}</strong></div>
                                )}
                                {(log.details as any).newAccountManagerId && (
                                  <div>AM: <strong>ID {(log.details as any).newAccountManagerId}</strong>{(log.details as any).oldAccountManagerId ? ` (was: ID ${(log.details as any).oldAccountManagerId})` : ""}</div>
                                )}
                                {(log.details as any).itemName && (
                                  <div>Item: <strong>{(log.details as any).itemName}</strong></div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Contracts Tab ── */}
            <TabsContent value="contracts" className="mt-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Contracts</h2>
                  <Button onClick={openAddContract}>Add Contract</Button>
                </div>

                {contractsList.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">No contracts yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Package</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Charges</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Renewal</TableHead>
                          {tamaraStatus?.enabled && <TableHead>Tamara</TableHead>}
                          {(paymobStatus?.eg || paymobStatus?.sa) && <TableHead>Paymob</TableHead>}
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contractsList.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell>{(() => {
                              const ids: number[] = c.packageIds && Array.isArray(c.packageIds) ? c.packageIds : (c.packageId ? [c.packageId] : []);
                              if (ids.length === 0) return "\u2014";
                              return ids.map((pid: number) => {
                                const pkg = packages.find((p: any) => p.id === pid);
                                return pkg ? pkg.name : `#${pid}`;
                              }).join(", ");
                            })()}</TableCell>
                            <TableCell>{c.contractName ?? "\u2014"}</TableCell>
                            <TableCell>{fmtDate(c.startDate)}</TableCell>
                            <TableCell>{fmtDate(c.endDate)}</TableCell>
                            <TableCell>{c.period ?? "—"}</TableCell>
                            <TableCell>{fmtMoney(c.charges)}</TableCell>
                            <TableCell>{c.currency ?? "SAR"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={contractStatusClass[String(c.status)] ?? ""}>
                                {String(c.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={renewalStatusClass[String(c.contractRenewalStatus)] ?? ""}>
                                {String(c.contractRenewalStatus ?? "New")}
                              </Badge>
                            </TableCell>
                            {tamaraStatus?.enabled && (
                              <TableCell>
                                {Number(c.charges) > 0 ? (
                                  <Button
                                    size="sm"
                                    className="gap-1.5 text-white text-xs font-medium"
                                    style={{ background: "linear-gradient(135deg, #c084fc 0%, #f472b6 50%, #fb923c 100%)" }}
                                    disabled={tamaraLoadingId === c.id}
                                    onClick={() => {
                                      setTamaraLoadingId(c.id);
                                      tamaraCheckout.mutate({ contractId: c.id });
                                    }}
                                  >
                                    {tamaraLoadingId === c.id ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4.5 12.5C4.5 12.5 4.5 8 8 8C11.5 8 11.5 12.5 11.5 12.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                                        <circle cx="17" cy="10.5" r="4" fill="white" />
                                      </svg>
                                    )}
                                    Pay
                                    <ExternalLink size={10} />
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )}
                            {(paymobStatus?.eg || paymobStatus?.sa) && (
                              <TableCell>
                                {Number(c.charges) > 0 && ((c.currency || "SAR") === "EGP" ? paymobStatus?.eg : paymobStatus?.sa) ? (
                                  <Button
                                    size="sm"
                                    className="gap-1.5 text-white text-xs font-medium"
                                    style={{ background: "linear-gradient(135deg, #3b82f6 0%, #10b981 100%)" }}
                                    disabled={paymobLoadingId === c.id}
                                    onClick={() => {
                                      setPaymobLoadingId(c.id);
                                      paymobCheckout.mutate({ contractId: c.id, paymentMethod: "card" });
                                    }}
                                  >
                                    {paymobLoadingId === c.id ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : null}
                                    Pay
                                    <ExternalLink size={10} />
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => openEditContract(c)}>Edit</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Contract Dialog */}
              <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{contractEditingId ? "Edit Contract" : "Add Contract"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Service Packages</Label>
                      <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                        {packages.length === 0 && <span className="text-sm text-muted-foreground">No packages available</span>}
                        {packages.map((p: any) => (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                            <input
                              type="checkbox"
                              checked={contractForm.packageIds.includes(p.id)}
                              onChange={(e) => {
                                setContractForm((s) => ({
                                  ...s,
                                  packageIds: e.target.checked
                                    ? [...s.packageIds, p.id]
                                    : s.packageIds.filter((id: number) => id !== p.id),
                                }));
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Contract Name</Label>
                      <Input value={contractForm.contractName} onChange={(e) => setContractForm((s) => ({ ...s, contractName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={contractForm.startDate} onChange={(e) => setContractForm((s) => ({ ...s, startDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={contractForm.endDate} onChange={(e) => setContractForm((s) => ({ ...s, endDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Period</Label>
                      <Input value={contractForm.period} onChange={(e) => setContractForm((s) => ({ ...s, period: e.target.value }))} placeholder="e.g. 12 months" />
                    </div>
                    <div className="space-y-2">
                      <Label>Charges</Label>
                      <Input type="number" value={contractForm.charges} onChange={(e) => setContractForm((s) => ({ ...s, charges: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Input value={contractForm.currency} onChange={(e) => setContractForm((s) => ({ ...s, currency: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Charges</Label>
                      <Input type="number" value={contractForm.monthlyCharges} onChange={(e) => setContractForm((s) => ({ ...s, monthlyCharges: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={contractForm.status} onValueChange={(v) => setContractForm((s) => ({ ...s, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Expired">Expired</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                          <SelectItem value="PendingRenewal">Pending Renewal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Renewal Status</Label>
                      <Select value={contractForm.contractRenewalStatus} onValueChange={(v) => setContractForm((s) => ({ ...s, contractRenewalStatus: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Negotiation">Negotiation</SelectItem>
                          <SelectItem value="SentOffer">Sent Offer</SelectItem>
                          <SelectItem value="Won">Won</SelectItem>
                          <SelectItem value="Lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Renewal Assigned To</Label>
                      <Select
                        value={contractForm.renewalAssignedTo || "none"}
                        onValueChange={(v) => setContractForm((s) => ({ ...s, renewalAssignedTo: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {(managersQ.data ?? []).map((m: any) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Price Offer</Label>
                      <Input value={contractForm.priceOffer} onChange={(e) => setContractForm((s) => ({ ...s, priceOffer: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Upselling</Label>
                      <Input value={contractForm.upselling} onChange={(e) => setContractForm((s) => ({ ...s, upselling: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea value={contractForm.notes} onChange={(e) => setContractForm((s) => ({ ...s, notes: e.target.value }))} rows={3} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => { setContractDialogOpen(false); setContractEditingId(null); }}
                      disabled={createContractM.isPending || updateContractM.isPending}
                    >
                      Cancel
                    </Button>
                    <Button onClick={submitContract} disabled={createContractM.isPending || updateContractM.isPending}>
                      {createContractM.isPending || updateContractM.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* ── Follow-ups Tab ── */}
            <TabsContent value="followups" className="mt-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Follow-ups</h2>
                  <Dialog open={fuDialogOpen} onOpenChange={setFuDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>Add Follow-up</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>New Follow-up</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select value={fuForm.type} onValueChange={(v) => setFuForm((s) => ({ ...s, type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Call">Call</SelectItem>
                              <SelectItem value="Meeting">Meeting</SelectItem>
                              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                              <SelectItem value="Email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input type="date" value={fuForm.followUpDate} onChange={(e) => setFuForm((s) => ({ ...s, followUpDate: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={fuForm.notes} onChange={(e) => setFuForm((s) => ({ ...s, notes: e.target.value }))} rows={3} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setFuDialogOpen(false)} disabled={createFollowUpM.isPending}>Cancel</Button>
                        <Button onClick={submitFollowUp} disabled={createFollowUpM.isPending || !fuForm.followUpDate}>
                          {createFollowUpM.isPending ? "Saving..." : "Save"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {followUpsList.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">No follow-ups yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>By</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {followUpsList.map((fu: any) => (
                          <TableRow key={fu.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {followUpTypeIcon[fu.type] ?? null}
                                <span>{fu.type}</span>
                              </div>
                            </TableCell>
                            <TableCell>{fmtDate(fu.followUpDate)}</TableCell>
                            <TableCell>{fu.userName ?? "—"}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{fu.notes ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={fu.status === "Completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                                {fu.status === "Completed" ? (
                                  <span className="flex items-center gap-1"><CheckCircle size={12} /> Completed</span>
                                ) : (
                                  <span className="flex items-center gap-1"><Clock size={12} /> Pending</span>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditFollowUp(fu)}
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => setDeleteConfirm({ type: "followUp", id: fu.id, name: `${fu.type} Follow-up` })}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </Button>
                                {fu.status !== "Completed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => completeFollowUpM.mutate({ id: fu.id })}
                                    disabled={completeFollowUpM.isPending}
                                  >
                                    Mark Done
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* ── Edit Follow-up Dialog ── */}
                <Dialog open={editFuDialogOpen} onOpenChange={setEditFuDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Follow-up</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={editFuForm.type} onValueChange={(v) => setEditFuForm((s) => ({ ...s, type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Call">Call</SelectItem>
                            <SelectItem value="Meeting">Meeting</SelectItem>
                            <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                            <SelectItem value="Email">Email</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={editFuForm.followUpDate} onChange={(e) => setEditFuForm((s) => ({ ...s, followUpDate: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea value={editFuForm.notes} onChange={(e) => setEditFuForm((s) => ({ ...s, notes: e.target.value }))} rows={3} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditFuDialogOpen(false)} disabled={updateFollowUpM.isPending}>Cancel</Button>
                      <Button onClick={submitEditFollowUp} disabled={updateFollowUpM.isPending || !editFuForm.followUpDate}>
                        {updateFollowUpM.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            {/* ── Tasks Tab (Kanban) ── */}
            <TabsContent value="tasks" className="mt-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Tasks</h2>
                  <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>Add Task</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>New Task</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input value={taskForm.title} onChange={(e) => setTaskForm((s) => ({ ...s, title: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Assign To</Label>
                          <Select
                            value={taskForm.assignedTo || "none"}
                            onValueChange={(v) => setTaskForm((s) => ({ ...s, assignedTo: v === "none" ? "" : v }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {(usersListQ.data ?? []).map((u: any) => (
                                <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.role})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((s) => ({ ...s, dueDate: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((s) => ({ ...s, priority: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Low">Low</SelectItem>
                              <SelectItem value="Medium">Medium</SelectItem>
                              <SelectItem value="High">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={taskForm.notes} onChange={(e) => setTaskForm((s) => ({ ...s, notes: e.target.value }))} rows={3} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setTaskDialogOpen(false)} disabled={createTaskM.isPending}>Cancel</Button>
                        <Button onClick={submitTask} disabled={createTaskM.isPending || !taskForm.title.trim()}>
                          {createTaskM.isPending ? "Saving..." : "Save"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Kanban Board */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(["ToDo", "InProgress", "Done"] as const).map((status) => (
                    <div key={status} className="rounded-xl border bg-slate-50 p-3 min-h-[200px]">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-semibold">
                          {status === "ToDo" ? "To Do" : status === "InProgress" ? "In Progress" : "Done"}
                        </h3>
                        <Badge variant="outline" className="text-xs">{tasksByStatus[status].length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {tasksByStatus[status].map((task: any) => (
                          <div key={task.id} className="rounded-lg border bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm">{task.title}</div>
                              <Badge variant="outline" className={`text-xs shrink-0 ${priorityClass[task.priority] ?? ""}`}>
                                {task.priority}
                              </Badge>
                            </div>
                            {task.assignedToName && (
                              <div className="text-xs text-muted-foreground mt-1">Assigned: {task.assignedToName}</div>
                            )}
                            {task.dueDate && (
                              <div className="text-xs text-muted-foreground mt-0.5">Due: {fmtDate(task.dueDate)}</div>
                            )}
                            {task.notes && (
                              <div className="text-xs text-muted-foreground mt-1 truncate">{task.notes}</div>
                            )}
                            <div className="flex gap-1 mt-2">
                              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => openEditTask(task)}>
                                <Pencil size={12} className="mr-1" /> Edit
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm({ type: "task", id: task.id, name: task.title })}>
                                <Trash2 size={12} className="mr-1" /> Delete
                              </Button>
                              {status !== "ToDo" && (
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => moveTask(task.id, status === "InProgress" ? "ToDo" : "InProgress")}>
                                  {status === "InProgress" ? "← To Do" : "← In Progress"}
                                </Button>
                              )}
                              {status !== "Done" && (
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => moveTask(task.id, status === "ToDo" ? "InProgress" : "Done")}>
                                  {status === "ToDo" ? "In Progress →" : "Done →"}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* ── Edit Task Dialog ── */}
                <Dialog open={editTaskDialogOpen} onOpenChange={setEditTaskDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Task</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={editTaskForm.title} onChange={(e) => setEditTaskForm((s) => ({ ...s, title: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Assign To</Label>
                        <Select
                          value={editTaskForm.assignedTo || "none"}
                          onValueChange={(v) => setEditTaskForm((s) => ({ ...s, assignedTo: v === "none" ? "" : v }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {(usersListQ.data ?? []).map((u: any) => (
                              <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.role})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input type="date" value={editTaskForm.dueDate} onChange={(e) => setEditTaskForm((s) => ({ ...s, dueDate: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select value={editTaskForm.priority} onValueChange={(v) => setEditTaskForm((s) => ({ ...s, priority: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea value={editTaskForm.notes} onChange={(e) => setEditTaskForm((s) => ({ ...s, notes: e.target.value }))} rows={3} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditTaskDialogOpen(false)}>Cancel</Button>
                      <Button onClick={submitEditTask} disabled={!editTaskForm.title.trim()}>Save Changes</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            {/* ── OKRs Tab (Phase 4) ── */}
            <TabsContent value="okrs" className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Objectives & Key Results</h3>
                <div className="flex gap-2 mb-4">
                  <Input placeholder="Objective title" value={objectiveTitle} onChange={(e) => setObjectiveTitle(e.target.value)} />
                  <Select value={objectiveStatus} onValueChange={(v: any) => setObjectiveStatus(v)}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OnTrack">OnTrack</SelectItem>
                      <SelectItem value="AtRisk">AtRisk</SelectItem>
                      <SelectItem value="OffTrack">OffTrack</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => { if (objectiveTitle.trim()) createObjectiveM.mutate({ clientId: id, title: objectiveTitle.trim(), status: objectiveStatus }); }}>Add</Button>
                </div>
                {(objectivesQ.data ?? []).map((obj: any) => (
                  <div key={obj.id} className="rounded-xl border p-4 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{obj.title}</span>
                      <Badge variant="outline" className={obj.status === "OnTrack" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : obj.status === "AtRisk" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-rose-200 bg-rose-50 text-rose-700"}>{obj.status}</Badge>
                      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => openEditObjective(obj)}>
                        <Pencil size={12} className="mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm({ type: "objective", id: obj.id, name: obj.title })}>
                        <Trash2 size={12} className="mr-1" /> Delete
                      </Button>
                    </div>
                    {(obj.keyResults ?? []).map((kr: any) => {
                      const target = Number(kr.targetValue ?? 0);
                      const current = Number(kr.currentValue ?? 0);
                      const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
                      return (
                        <div key={kr.id} className="rounded-lg border p-3 mb-2 ml-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{kr.title}</span>
                            <span className="text-xs text-muted-foreground">{current} / {target}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-200 mt-2"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div>
                          <div className="flex gap-2 mt-2">
                            <Input type="number" min="0" step="0.01" className="w-32 h-8 text-sm" value={progressDrafts[kr.id] ?? current} onChange={(e) => setProgressDrafts(s => ({ ...s, [kr.id]: e.target.value }))} />
                            <Button size="sm" variant="outline" onClick={() => updateKeyResultM.mutate({ id: kr.id, currentValue: Number(progressDrafts[kr.id] ?? current) })}>Update</Button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex gap-2 mt-2 ml-4">
                      <Input placeholder="Key Result title" className="h-8 text-sm" value={keyResultDrafts[obj.id]?.title ?? ""} onChange={(e) => setKeyResultDrafts(s => ({ ...s, [obj.id]: { ...s[obj.id], title: e.target.value, targetValue: s[obj.id]?.targetValue ?? "" } }))} />
                      <Input type="number" min="0" step="0.01" placeholder="Target" className="w-28 h-8 text-sm" value={keyResultDrafts[obj.id]?.targetValue ?? ""} onChange={(e) => setKeyResultDrafts(s => ({ ...s, [obj.id]: { ...s[obj.id], title: s[obj.id]?.title ?? "", targetValue: e.target.value } }))} />
                      <Button size="sm" onClick={() => { const d = keyResultDrafts[obj.id]; if (d?.title?.trim()) { createKeyResultM.mutate({ objectiveId: obj.id, title: d.title.trim(), targetValue: d.targetValue ? Number(d.targetValue) : null }); setKeyResultDrafts(s => ({ ...s, [obj.id]: { title: "", targetValue: "" } })); } }}>Add KR</Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* ── Edit Objective Dialog ── */}
              <Dialog open={editObjDialogOpen} onOpenChange={setEditObjDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Objective</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={editObjForm.title} onChange={(e) => setEditObjForm((s) => ({ ...s, title: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={editObjForm.status} onValueChange={(v) => setEditObjForm((s) => ({ ...s, status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OnTrack">OnTrack</SelectItem>
                            <SelectItem value="AtRisk">AtRisk</SelectItem>
                            <SelectItem value="OffTrack">OffTrack</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditObjDialogOpen(false)} disabled={updateObjectiveM.isPending}>Cancel</Button>
                      <Button onClick={submitEditObjective} disabled={updateObjectiveM.isPending || !editObjForm.title.trim()}>
                        {updateObjectiveM.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
              </Dialog>
            </TabsContent>

            {/* ── Deliverables Tab (Phase 5) ── */}
            <TabsContent value="deliverables" className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Deliverables</h3>
                  <Button onClick={() => setDeliverableDialogOpen(true)}>Add Deliverable</Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Due Date</TableHead><TableHead>Delivered</TableHead><TableHead>Assigned To</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(deliverablesQ.data ?? []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell><div className="font-medium">{item.name}</div>{item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}</TableCell>
                        <TableCell>
                          <Select value={item.status ?? "Pending"} onValueChange={(v: any) => updateDeliverableM.mutate({ id: item.id, data: { status: v } })}>
                            <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="InProgress">InProgress</SelectItem>
                              <SelectItem value="Delivered">Delivered</SelectItem>
                              <SelectItem value="Approved">Approved</SelectItem>
                              <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{item.dueDate ? fmtDate(item.dueDate) : "—"}</TableCell>
                        <TableCell>{item.deliveredAt ? fmtDate(item.deliveredAt) : "—"}</TableCell>
                        <TableCell>{item.assignedToName ?? (item.assignedTo ? `User #${item.assignedTo}` : "—")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openEditDeliverable(item)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm({ type: "deliverable", id: item.id, name: item.name })}>
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Dialog open={deliverableDialogOpen} onOpenChange={setDeliverableDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Deliverable</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Name" value={deliverableForm.name} onChange={(e) => setDeliverableForm(s => ({ ...s, name: e.target.value }))} />
                    <Textarea placeholder="Description" value={deliverableForm.description} onChange={(e) => setDeliverableForm(s => ({ ...s, description: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Due Date</Label><Input type="date" value={deliverableForm.dueDate} onChange={(e) => setDeliverableForm(s => ({ ...s, dueDate: e.target.value }))} /></div>
                      <div><Label>Assigned To (User ID)</Label><Input type="number" min="1" value={deliverableForm.assignedTo} onChange={(e) => setDeliverableForm(s => ({ ...s, assignedTo: e.target.value }))} /></div>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={() => { if (deliverableForm.name.trim()) createDeliverableM.mutate({ clientId: id, name: deliverableForm.name.trim(), description: deliverableForm.description.trim() || null, dueDate: deliverableForm.dueDate || null, assignedTo: deliverableForm.assignedTo ? Number(deliverableForm.assignedTo) : null }); }}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              {/* ── Edit Deliverable Dialog ── */}
              <Dialog open={editDeliverableDialogOpen} onOpenChange={setEditDeliverableDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit Deliverable</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={editDeliverableForm.name} onChange={(e) => setEditDeliverableForm(s => ({ ...s, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={editDeliverableForm.description} onChange={(e) => setEditDeliverableForm(s => ({ ...s, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Due Date</Label><Input type="date" value={editDeliverableForm.dueDate} onChange={(e) => setEditDeliverableForm(s => ({ ...s, dueDate: e.target.value }))} /></div>
                      <div><Label>Assigned To (User ID)</Label><Input type="number" min="1" value={editDeliverableForm.assignedTo} onChange={(e) => setEditDeliverableForm(s => ({ ...s, assignedTo: e.target.value }))} /></div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditDeliverableDialogOpen(false)}>Cancel</Button>
                    <Button onClick={submitEditDeliverable} disabled={!editDeliverableForm.name.trim()}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* ── Upsell Tab (Phase 5) ── */}
            <TabsContent value="upsell" className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Upsell Opportunities</h3>
                    <p className="text-sm text-muted-foreground">Total Potential: {fmtMoney((upsellQ.data ?? []).reduce((sum: number, item: any) => sum + Number(item.potentialValue ?? 0), 0))}</p>
                  </div>
                  <Button onClick={() => setUpsellDialogOpen(true)}>Add Upsell</Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Value</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead><TableHead>Created By</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(upsellQ.data ?? []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>{fmtMoney(item.potentialValue)}</TableCell>
                        <TableCell>
                          <Select value={item.status ?? "Prospecting"} onValueChange={(v: any) => updateUpsellM.mutate({ id: item.id, data: { status: v } })}>
                            <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Prospecting">Prospecting</SelectItem>
                              <SelectItem value="ProposalSent">ProposalSent</SelectItem>
                              <SelectItem value="Negotiation">Negotiation</SelectItem>
                              <SelectItem value="Won">Won</SelectItem>
                              <SelectItem value="Lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm">{item.notes ?? "—"}</TableCell>
                        <TableCell>{item.createdByName ?? `User #${item.createdBy}`}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openEditUpsell(item)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm({ type: "upsell", id: item.id, name: item.title })}>
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Dialog open={upsellDialogOpen} onOpenChange={setUpsellDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Upsell Opportunity</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Title" value={upsellForm.title} onChange={(e) => setUpsellForm(s => ({ ...s, title: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Potential Value</Label><Input type="number" min="0" step="0.01" value={upsellForm.potentialValue} onChange={(e) => setUpsellForm(s => ({ ...s, potentialValue: e.target.value }))} /></div>
                    </div>
                    <Textarea placeholder="Notes" value={upsellForm.notes} onChange={(e) => setUpsellForm(s => ({ ...s, notes: e.target.value }))} />
                  </div>
                  <DialogFooter><Button onClick={() => { if (upsellForm.title.trim()) createUpsellM.mutate({ clientId: id, title: upsellForm.title.trim(), potentialValue: upsellForm.potentialValue || null, notes: upsellForm.notes.trim() || null }); }}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              {/* ── Edit Upsell Dialog ── */}
              <Dialog open={editUpsellDialogOpen} onOpenChange={setEditUpsellDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit Upsell Opportunity</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={editUpsellForm.title} onChange={(e) => setEditUpsellForm(s => ({ ...s, title: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Potential Value</Label><Input type="number" min="0" step="0.01" value={editUpsellForm.potentialValue} onChange={(e) => setEditUpsellForm(s => ({ ...s, potentialValue: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea value={editUpsellForm.notes} onChange={(e) => setEditUpsellForm(s => ({ ...s, notes: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditUpsellDialogOpen(false)}>Cancel</Button>
                    <Button onClick={submitEditUpsell} disabled={!editUpsellForm.title.trim()}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* ── Communication Tab (Phase 5) ── */}
            <TabsContent value="communication" className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Client Channels</h3>
                    <p className="text-sm text-muted-foreground">Email threads, WhatsApp groups, Slack channels, and more.</p>
                  </div>
                  <Button onClick={() => setCommunicationDialogOpen(true)}>Add Channel</Button>
                </div>
                <div className="space-y-3">
                  {(communicationsQ.data ?? []).map((ch: any) => (
                    <div key={ch.id} className="rounded-xl border p-4 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{ch.channelType === "EmailThread" ? "📧" : ch.channelType === "WhatsAppGroup" ? "💬" : ch.channelType === "SlackChannel" ? "🟣" : "🔗"}</span>
                          <span className="font-medium">{ch.channelName}</span>
                          <span className="text-xs text-muted-foreground">{ch.channelType}</span>
                        </div>
                        {ch.notes && <p className="text-sm text-muted-foreground mt-1">{ch.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditCommunication(ch)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm({ type: "communication", id: ch.id, name: ch.channelName })}>
                          <Trash2 size={14} />
                        </Button>
                        {ch.link ? <a href={ch.link} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Open Link</a> : <span className="text-xs text-muted-foreground">No link</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Dialog open={communicationDialogOpen} onOpenChange={setCommunicationDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Channel</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Channel Name" value={communicationForm.channelName} onChange={(e) => setCommunicationForm(s => ({ ...s, channelName: e.target.value }))} />
                    <Select value={communicationForm.channelType} onValueChange={(v: any) => setCommunicationForm(s => ({ ...s, channelType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EmailThread">Email Thread</SelectItem>
                        <SelectItem value="WhatsAppGroup">WhatsApp Group</SelectItem>
                        <SelectItem value="SlackChannel">Slack Channel</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Link (optional)" value={communicationForm.link} onChange={(e) => setCommunicationForm(s => ({ ...s, link: e.target.value }))} />
                    <Textarea placeholder="Notes" value={communicationForm.notes} onChange={(e) => setCommunicationForm(s => ({ ...s, notes: e.target.value }))} />
                  </div>
                  <DialogFooter><Button onClick={() => { if (communicationForm.channelName.trim()) createCommunicationM.mutate({ clientId: id, channelName: communicationForm.channelName.trim(), channelType: communicationForm.channelType as any, link: communicationForm.link.trim() || null, notes: communicationForm.notes.trim() || null }); }}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              {/* ── Edit Communication Dialog ── */}
              <Dialog open={editCommDialogOpen} onOpenChange={setEditCommDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit Channel</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Channel Name</Label>
                      <Input value={editCommForm.channelName} onChange={(e) => setEditCommForm(s => ({ ...s, channelName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Channel Type</Label>
                      <Select value={editCommForm.channelType} onValueChange={(v: any) => setEditCommForm(s => ({ ...s, channelType: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EmailThread">Email Thread</SelectItem>
                          <SelectItem value="WhatsAppGroup">WhatsApp Group</SelectItem>
                          <SelectItem value="SlackChannel">Slack Channel</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Link</Label>
                      <Input value={editCommForm.link} onChange={(e) => setEditCommForm(s => ({ ...s, link: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea value={editCommForm.notes} onChange={(e) => setEditCommForm(s => ({ ...s, notes: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditCommDialogOpen(false)} disabled={updateCommunicationM.isPending}>Cancel</Button>
                    <Button onClick={submitEditCommunication} disabled={updateCommunicationM.isPending || !editCommForm.channelName.trim()}>
                      {updateCommunicationM.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>
          </Tabs>
        )}
      </div>
    
      {/* ─── Delete Confirmation Dialog ─────────────────────────────────── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{deleteConfirm?.name}</strong>. This action can be undone by an admin from the Audit Log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CRMLayout>
  );
}

function InfoItem({ label, value }: { label: string; value: unknown }) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{display}</div>
    </div>
  );
}

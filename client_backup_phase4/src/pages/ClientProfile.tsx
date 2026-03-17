import * as React from "react";

import CRMLayout from "../components/CRMLayout";
import { trpc } from "@/lib/trpc";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Phone, Mail, MessageCircle, Users, CheckCircle, Clock, GripVertical } from "lucide-react";
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
  const usersListQ = trpc.usersList.list.useQuery();

  // ─── Edit Client State ──────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = React.useState(false);
  const [editState, setEditState] = React.useState({
    planStatus: "Active",
    group: "",
    accountManagerId: "",
    competentPerson: "",
    contactEmail: "",
    contactPhone: "",
    businessProfile: "",
    marketingObjective: "",
    servicesNeeded: "",
    socialMedia: "",
    feedback: "",
    notes: "",
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
    packageId: "",
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
      businessProfile: client.businessProfile ? String(client.businessProfile) : "",
      marketingObjective: client.marketingObjective ? String(client.marketingObjective) : "",
      servicesNeeded: client.servicesNeeded ? String(client.servicesNeeded) : "",
      socialMedia: client.socialMedia ? String(client.socialMedia) : "",
      feedback: client.feedback ? String(client.feedback) : "",
      notes: client.notes ? String(client.notes) : "",
    });
  }, [client?.id]);

  function resetContractForm() {
    setContractForm({
      packageId: "",
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
      packageId: row.packageId ? String(row.packageId) : "",
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
      businessProfile: editState.businessProfile.trim() || undefined,
      marketingObjective: editState.marketingObjective.trim() || undefined,
      servicesNeeded: editState.servicesNeeded.trim() || undefined,
      socialMedia: editState.socialMedia.trim() || undefined,
      feedback: editState.feedback.trim() || undefined,
      notes: editState.notes.trim() || undefined,
    });
  }

  async function submitContract() {
    if (!client) return;

    if (contractEditingId) {
      await updateContractM.mutateAsync({
        id: contractEditingId,
        packageId: contractForm.packageId ? Number(contractForm.packageId) : undefined,
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
        packageId: contractForm.packageId ? Number(contractForm.packageId) : null,
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

  const clientName = client?.leadName || client?.businessProfile || `Client #${id}`;

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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="contracts">Contracts</TabsTrigger>
                <TabsTrigger value="followups">Follow-ups</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="onboarding" className="hidden">Onboarding</TabsTrigger>
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
                          <Input value={editState.socialMedia} onChange={(e) => setEditState((s) => ({ ...s, socialMedia: e.target.value }))} />
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
                  <InfoItem label="Lead Name" value={client.leadName} />
                  <InfoItem label="Phone" value={client.leadPhone} />
                  <InfoItem label="Competent Person" value={client.competentPerson} />
                  <InfoItem label="Contact Email" value={client.contactEmail} />
                  <InfoItem label="Contact Phone" value={client.contactPhone} />
                  <InfoItem label="Group" value={client.group} />
                  <InfoItem label="Business Profile" value={client.businessProfile} />
                  <InfoItem label="Marketing Objective" value={client.marketingObjective} />
                  <InfoItem label="Services Needed" value={client.servicesNeeded} />
                  <InfoItem label="Social Media" value={client.socialMedia} />
                  <InfoItem label="Feedback" value={client.feedback} />
                  <InfoItem label="Notes" value={client.notes} />
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
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contractsList.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.packageName ?? "—"}</TableCell>
                            <TableCell>{c.contractName ?? "—"}</TableCell>
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
                      <Label>Service Package</Label>
                      <Select
                        value={contractForm.packageId || "none"}
                        onValueChange={(v) => setContractForm((s) => ({ ...s, packageId: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {packages.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
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

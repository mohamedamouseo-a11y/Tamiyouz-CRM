import { useState, useEffect } from "react";
import CRMLayout from "@/components/CRMLayout";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Briefcase,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  Building2,
  Calendar,
  Clock,
  UserCheck,
  BarChart3,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";

const planStatusColors: Record<string, string> = {
  Active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Pending: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Hold: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const renewalStatusColors: Record<string, string> = {
  Renewed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const handoverStatusColors: Record<string, string> = {
  AwaitingAssignment: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  AwaitingSalesBrief: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  BriefSubmitted: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  InOnboarding: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  ReadyForActivation: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const handoverStatusLabels: Record<string, string> = {
  AwaitingAssignment: "Awaiting Assignment",
  AwaitingSalesBrief: "Awaiting Brief",
  BriefSubmitted: "Brief Submitted",
  InOnboarding: "In Onboarding",
  ReadyForActivation: "Ready for Activation",
};

export default function ClientPool() {
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const [search, setSearch] = useState(() => sessionStorage.getItem("clients_search") || "");
  const [planFilter, setPlanFilter] = useState<string>(() => sessionStorage.getItem("clients_planFilter") || "");
  const [renewalFilter, setRenewalFilter] = useState<string>(() => sessionStorage.getItem("clients_renewalFilter") || "");
  const [handoverFilter, setHandoverFilter] = useState<string>(() => sessionStorage.getItem("clients_handoverFilter") || "");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [assignAMOpen, setAssignAMOpen] = useState(false);
  const [assignAMClientId, setAssignAMClientId] = useState<number | null>(null);
  const [assignAMSelectedId, setAssignAMSelectedId] = useState<string>("");
  // ── Persist filters to sessionStorage ──
  useEffect(() => { sessionStorage.setItem("clients_search", search); }, [search]);
  useEffect(() => { sessionStorage.setItem("clients_planFilter", planFilter); }, [planFilter]);
  useEffect(() => { sessionStorage.setItem("clients_renewalFilter", renewalFilter); }, [renewalFilter]);
  useEffect(() => { sessionStorage.setItem("clients_handoverFilter", handoverFilter); }, [handoverFilter]);

  // Add Client dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    businessProfile: "",
    group: "",
    competentPerson: "",
    contactEmail: "",
    contactPhone: "",
    leadName: "",
    phone: "",
    otherPhones: "",
    planStatus: "Active",
    renewalStatus: "Pending",
    accountManagerId: "",
    marketingObjective: "",
    servicesNeeded: [] as string[],
    socialMedia: "",
    notes: "",
    contractLink: "",
  });

  // Auto-set accountManagerId to the logged-in user if they are an AccountManager
  useEffect(() => {
    if (user && (user.role === "AccountManager" || user.role === "AccountManagerLead")) {
      setAddForm((s) => ({ ...s, accountManagerId: String(user.id) }));
    }
  }, [user]);

  const SERVICE_OPTIONS = [
    "Social Media Management",
    "SEO",
    "Google Ads",
    "Meta Ads",
    "TikTok Ads",
    "Snapchat Ads",
    "Web Design",
    "Web Development",
    "Content Creation",
    "Video Production",
    "Branding",
    "Email Marketing",
    "Influencer Marketing",
    "PR",
    "Photography",
    "Moderation",
    "Other",
  ];

  const { data, isLoading, refetch } = trpc.accountManagement.listClients.useQuery({
    search: search || undefined,
    planStatus: planFilter || undefined,
    renewalStatus: renewalFilter || undefined,
    handoverStatus: handoverFilter || undefined,
    limit: 50,
    offset: 0,
  });

  const managersQ = trpc.accountManagement.listAccountManagers.useQuery();

  const createClientM = trpc.accountManagement.createClient.useMutation({
    onSuccess: async () => {
      setAddDialogOpen(false);
      resetAddForm();
      await refetch();
    },
  });

  const deleteClientM = trpc.accountManagement.deleteClient.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const assignAMM = trpc.accountManagement.assignAccountManager.useMutation({
    onSuccess: async () => {
      toast.success("Account Manager assigned successfully");
      setAssignAMOpen(false);
      setAssignAMClientId(null);
      setAssignAMSelectedId("");
      await refetch();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to assign"),
  });

  const clients = data?.data ?? [];
  const total = data?.total ?? 0;

  function resetAddForm() {
    setAddForm({
      businessProfile: "",
      group: "",
      competentPerson: "",
      contactEmail: "",
      contactPhone: "",
      leadName: "",
      phone: "",
      otherPhones: "",
      planStatus: "Active",
      renewalStatus: "Pending",
      accountManagerId: user && (user.role === "AccountManager" || user.role === "AccountManagerLead") ? String(user.id) : "",
      marketingObjective: "",
      servicesNeeded: [] as string[],
      socialMedia: "",
      notes: "",
      contractLink: "",
    });
  }

  async function submitAddClient() {
    try {
      await createClientM.mutateAsync({
        businessProfile: addForm.businessProfile.trim() || undefined,
        group: addForm.group.trim() || undefined,
        competentPerson: addForm.competentPerson.trim() || undefined,
        contactEmail: addForm.contactEmail.trim() || undefined,
        contactPhone: addForm.contactPhone.trim() || undefined,
        leadName: addForm.leadName.trim() || undefined,
        phone: addForm.phone.trim() || undefined,
        otherPhones: addForm.otherPhones.trim() || undefined,
        planStatus: addForm.planStatus as any,
        renewalStatus: addForm.renewalStatus as any,
        accountManagerId: addForm.accountManagerId ? Number(addForm.accountManagerId) : null,
        marketingObjective: addForm.marketingObjective.trim() || undefined,
        servicesNeeded: addForm.servicesNeeded.length > 0 ? addForm.servicesNeeded.join(", ") : undefined,
        socialMedia: addForm.socialMedia.trim() || undefined,
        notes: addForm.notes.trim() || undefined,
        contractLink: addForm.contractLink.trim() || undefined,
      });
      toast.success("Client created successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create client");
    }
  }

  return (
    <CRMLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t("clientPool" as any)}</h1>
              <p className="text-sm text-muted-foreground">
                {total} {t("clients" as any)}
              </p>
            </div>
          </div>

          {/* Add Client Button */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t("addClient" as any) || "Add Client"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("addClient" as any) || "Add Client"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Lead Name</Label>
                  <Input
                    value={addForm.leadName}
                    onChange={(e) => setAddForm((s) => ({ ...s, leadName: e.target.value }))}
                    placeholder="Client / Lead name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={addForm.phone}
                    onChange={(e) => setAddForm((s) => ({ ...s, phone: e.target.value }))}
                    placeholder="+966..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Business Profile</Label>
                  <Input
                    value={addForm.businessProfile}
                    onChange={(e) => setAddForm((s) => ({ ...s, businessProfile: e.target.value }))}
                    placeholder="Company / Business name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Competent Person</Label>
                  <Input
                    value={addForm.competentPerson}
                    onChange={(e) => setAddForm((s) => ({ ...s, competentPerson: e.target.value }))}
                    placeholder="Contact person name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Group</Label>
                  <Input
                    value={addForm.group}
                    onChange={(e) => setAddForm((s) => ({ ...s, group: e.target.value }))}
                    placeholder="e.g. Group A"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={addForm.contactEmail}
                    onChange={(e) => setAddForm((s) => ({ ...s, contactEmail: e.target.value }))}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    value={addForm.contactPhone}
                    onChange={(e) => setAddForm((s) => ({ ...s, contactPhone: e.target.value }))}
                    placeholder="+966..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Other Phone Numbers</Label>
                  <Input
                    value={addForm.otherPhones}
                    onChange={(e) => setAddForm((s) => ({ ...s, otherPhones: e.target.value }))}
                    placeholder="Additional phone numbers (comma separated)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plan Status</Label>
                  <Select value={addForm.planStatus} onValueChange={(v) => setAddForm((s) => ({ ...s, planStatus: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Paused">Paused</SelectItem>
                      <SelectItem value="Hold">Hold</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account Manager</Label>
                  <Select
                    value={addForm.accountManagerId || "none"}
                    onValueChange={(v) => setAddForm((s) => ({ ...s, accountManagerId: v === "none" ? "" : v }))}
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
                <div className="space-y-2 md:col-span-2">
                  <Label>Marketing Objective</Label>
                  <Textarea
                    value={addForm.marketingObjective}
                    onChange={(e) => setAddForm((s) => ({ ...s, marketingObjective: e.target.value }))}
                    rows={2}
                    placeholder="Marketing goals..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Services Needed</Label>
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_OPTIONS.map((service) => {
                      const isSelected = addForm.servicesNeeded.includes(service);
                      return (
                        <button
                          key={service}
                          type="button"
                          onClick={() => {
                            setAddForm((s) => ({
                              ...s,
                              servicesNeeded: isSelected
                                ? s.servicesNeeded.filter((sv) => sv !== service)
                                : [...s.servicesNeeded, service],
                            }));
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-input hover:bg-accent"
                          )}
                        >
                          {service}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Social Media</Label>
                  <Textarea
                    value={addForm.socialMedia}
                    onChange={(e) => setAddForm((s) => ({ ...s, socialMedia: e.target.value }))}
                    rows={3}
                    placeholder="Platform: Link (one per line)\ne.g.\nInstagram: https://instagram.com/...\nTwitter: https://twitter.com/...\nFacebook: https://facebook.com/..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Contract Link</Label>
                  <Input
                    value={addForm.contractLink}
                    onChange={(e) => setAddForm((s) => ({ ...s, contractLink: e.target.value }))}
                    placeholder="https://drive.google.com/... or contract URL"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={addForm.notes}
                    onChange={(e) => setAddForm((s) => ({ ...s, notes: e.target.value }))}
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => { setAddDialogOpen(false); resetAddForm(); }}
                  disabled={createClientM.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitAddClient}
                  disabled={createClientM.isPending || !addForm.businessProfile.trim()}
                >
                  {createClientM.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`${t("search" as any)}...`}
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("planStatus" as any)}: {t("all" as any) || "All"}</option>
            <option value="Active">{t("active" as any)}</option>
            <option value="Paused">{t("paused" as any)}</option>
            <option value="Hold">{t("hold" as any) || "Hold"}</option>
            <option value="Pending">{t("pending" as any)}</option>
            <option value="Cancelled">{t("cancelled" as any)}</option>
          </select>
          <select
            value={renewalFilter}
            onChange={(e) => setRenewalFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("renewalStatus" as any)}: {t("all" as any) || "All"}</option>
            <option value="Renewed">{t("renewed" as any)}</option>
            <option value="Pending">{t("pending" as any)}</option>
            <option value="Expired">{t("expired" as any)}</option>
            <option value="Cancelled">{t("cancelled" as any)}</option>
          </select>
          <select
            value={handoverFilter}
            onChange={(e) => setHandoverFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Handover: All</option>
            <option value="AwaitingAssignment">Awaiting Assignment</option>
            <option value="AwaitingSalesBrief">Awaiting Brief</option>
            <option value="BriefSubmitted">Brief Submitted</option>
            <option value="InOnboarding">In Onboarding</option>
            <option value="ReadyForActivation">Ready for Activation</option>
          </select>
        </div>

        {/* Client List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">{t("noClients" as any)}</p>
            <p className="text-sm mt-1">
              Click "Add Client" to create a new client manually, or clients are auto-created when deals are marked as Won
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((client: any) => (
              <div
                key={client.id}
                className="bg-card border border-border rounded-xl overflow-hidden transition-all hover:shadow-md"
              >
                {/* Client Row */}
                <div
                  className="flex flex-col p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
                >
                  {/* Top row: Name + Badges */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {client.leadName || client.competentPerson || client.group || `Client #${client.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {client.leadId ? `Lead #${client.leadId}` : "Manual"} {client.group ? ` \u2022 ${client.group}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={cn("text-xs", planStatusColors[client.planStatus] || "")}>
                        {client.planStatus}
                      </Badge>
                      {client.renewalStatus && client.renewalStatus !== "Pending" && (
                        <Badge className={cn("text-xs", renewalStatusColors[client.renewalStatus] || "")}>
                          {client.renewalStatus}
                        </Badge>
                      )}
                      {(() => {
                        // If AM is assigned but handoverStatus is still AwaitingAssignment (stale data guard),
                        // derive the correct display status rather than showing a contradictory badge.
                        const displayHandover = (client.accountManagerId && client.handoverStatus === "AwaitingAssignment")
                          ? "AwaitingSalesBrief"
                          : client.handoverStatus;
                        return displayHandover && displayHandover !== "ReadyForActivation" ? (
                          <Badge className={cn("text-xs", handoverStatusColors[displayHandover] || "bg-gray-100 text-gray-800")}>
                            {handoverStatusLabels[displayHandover] || displayHandover}
                          </Badge>
                        ) : null;
                      })()}
                      {expandedId === client.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  {/* Bottom row: AM, Dates, Plan Progress */}
                  <div className="flex items-center gap-6 mt-3 ml-14 flex-wrap">
                    {/* Account Manager */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{client.accountManagerName || "Unassigned"}</span>
                    </div>
                    {/* Contract Start Date */}
                    {client.contractStartDate && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Start: {new Date(client.contractStartDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {/* Contract End / Renewal Date */}
                    {client.contractEndDate && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span className={new Date(client.contractEndDate) < new Date() ? "text-red-500 font-medium" : ""}>
                          Renewal: {new Date(client.contractEndDate).toLocaleDateString()}
                          {new Date(client.contractEndDate) < new Date() && " (Overdue)"}
                        </span>
                      </div>
                    )}
                    {/* Plan Progress */}
                    {client.contractStartDate && client.contractEndDate && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BarChart3 className="w-3.5 h-3.5" />
                        <div className="flex items-center gap-2">
                          <span>Plan:</span>
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(0, ((Date.now() - new Date(client.contractStartDate).getTime()) / (new Date(client.contractEndDate).getTime() - new Date(client.contractStartDate).getTime())) * 100))}%`,
                                backgroundColor: ((Date.now() - new Date(client.contractStartDate).getTime()) / (new Date(client.contractEndDate).getTime() - new Date(client.contractStartDate).getTime())) > 0.9 ? '#ef4444' : ((Date.now() - new Date(client.contractStartDate).getTime()) / (new Date(client.contractEndDate).getTime() - new Date(client.contractStartDate).getTime())) > 0.7 ? '#f59e0b' : '#22c55e',
                              }}
                            />
                          </div>
                          <span>{Math.min(100, Math.max(0, Math.round(((Date.now() - new Date(client.contractStartDate).getTime()) / (new Date(client.contractEndDate).getTime() - new Date(client.contractStartDate).getTime())) * 100)))}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === client.id && (
                  <div className="border-t border-border p-4 bg-muted/30 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {client.competentPerson && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">{t("competentPerson" as any)}</p>
                          <p className="text-sm text-foreground">{client.competentPerson}</p>
                        </div>
                      )}
                      {client.contactEmail && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Contact Email</p>
                          <p className="text-sm text-foreground">{client.contactEmail}</p>
                        </div>
                      )}
                      {client.contactPhone && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Contact Phone</p>
                          <p className="text-sm text-foreground">{client.contactPhone}</p>
                        </div>
                      )}
                      {client.marketingObjective && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">{t("marketingObjective" as any)}</p>
                          <p className="text-sm text-foreground">{client.marketingObjective}</p>
                        </div>
                      )}
                      {client.servicesNeeded && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">{t("servicesNeeded" as any)}</p>
                          <p className="text-sm text-foreground">{client.servicesNeeded}</p>
                        </div>
                      )}
                      {client.socialMedia && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">{t("socialMedia" as any)}</p>
                          <p className="text-sm text-foreground">{client.socialMedia}</p>
                        </div>
                      )}
                      {client.feedback && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Feedback</p>
                          <p className="text-sm text-foreground">{client.feedback}</p>
                        </div>
                      )}
                      {client.notes && (
                        <div className="sm:col-span-2 lg:col-span-3">
                          <p className="text-xs text-muted-foreground font-medium">Notes</p>
                          <p className="text-sm text-foreground">{client.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        Created: {new Date(client.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Client</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{client.leadName || client.competentPerson || client.group || `Client #${client.id}`}</strong>? This client will be moved to the trash and can be restored later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await deleteClientM.mutateAsync({ id: client.id });
                                }}
                              >
                                {deleteClientM.isPending ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {(user?.role === "Admin" || user?.role === "admin") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-orange-700 border-orange-300 hover:bg-orange-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssignAMClientId(client.id);
                              setAssignAMSelectedId(client.accountManagerId ? String(client.accountManagerId) : "");
                              setAssignAMOpen(true);
                            }}
                          >
                            <UserCheck className="w-3 h-3" />
                            {client.accountManagerId ? "Reassign AM" : "Assign AM"}
                          </Button>
                        )}
                        <Link href={`/clients/${client.id}`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            <FileText className="w-3 h-3" />
                            View Profile
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Assign Account Manager Dialog */}
      <Dialog open={assignAMOpen} onOpenChange={setAssignAMOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Account Manager</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label>Select Account Manager</Label>
            <select
              value={assignAMSelectedId}
              onChange={(e) => setAssignAMSelectedId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">-- Select AM --</option>
              {(managersQ.data ?? []).map((m: any) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignAMOpen(false)}>Cancel</Button>
            <Button
              disabled={!assignAMSelectedId || assignAMM.isPending}
              onClick={() => {
                if (assignAMClientId && assignAMSelectedId) {
                  assignAMM.mutate({ clientId: assignAMClientId, accountManagerId: Number(assignAMSelectedId) });
                }
              }}
            >
              {assignAMM.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

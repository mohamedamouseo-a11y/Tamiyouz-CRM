import CRMLayout from "@/components/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Bell, Clock, Copy, Edit, Eye, EyeOff, FileSpreadsheet, GripVertical, Key, Mail, Palette, Plus, RefreshCw, Save, Send, Settings, Shield, Sliders, Trash2, Users, Check, Archive, SlidersHorizontal, Megaphone, Sparkles, Webhook , DollarSign, BarChart3} from "lucide-react";
import NotificationSettingsContent from "@/components/NotificationSettingsContent";
import NotificationsTab from "@/components/NotificationsTab";
import MeetingNotificationSettings from "@/components/MeetingNotificationSettings";
import LeadSourcesTab from "@/components/LeadSourcesTab";
import BackupTab from "@/components/BackupTab";
import MetaSettingsTab from "@/components/MetaSettingsTab";
import TikTokSettingsTab from "@/components/tiktok/TikTokSettingsTab";
import MetaLeadgenSettingsTab from "@/components/MetaLeadgenSettingsTab";
import MetaAuditTab from "@/components/MetaAuditTab";
import CurrencySettingsTab from "@/components/CurrencySettingsTab";
import RakanSettingsTab from "@/components/RakanSettingsTab";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ROLES = ["Admin", "SalesManager", "SalesAgent", "MediaBuyer", "AccountManager", "AccountManagerLead"];

// Color palette for stage selection
const COLOR_PALETTE = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Pink", value: "#ec4899" },
  { name: "Green", value: "#22c55e" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Lime", value: "#84cc16" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Fuchsia", value: "#d946ef" },
];

// ─── Sortable Stage Row ───────────────────────────────────────────────────────
function SortableStageRow({
  stage,
  onDelete,
  onToggle,
  tokens,
}: {
  stage: any;
  onDelete: (id: number) => void;
  onToggle: (id: number, isActive: boolean) => void;
  tokens: any;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "var(--muted)" : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 border-b border-border last:border-0"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical size={14} />
      </button>
      <div className="w-4 h-4 rounded-full shrink-0" style={{ background: stage.color ?? "#6366f1" }} />
      <div className="flex-1">
        <span className={`font-medium text-sm ${!stage.isActive ? "line-through text-muted-foreground" : ""}`}>{stage.name}</span>
        {stage.nameAr && (
          <span className="text-muted-foreground text-xs mr-2 ml-2">({stage.nameAr})</span>
        )}
      </div>
      <Switch
        checked={stage.isActive ?? true}
        onCheckedChange={(v) => onToggle(stage.id, v)}
        title={stage.isActive ? "Disable stage" : "Enable stage"}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(stage.id)}
      >
        <Trash2 size={13} />
      </Button>
    </div>
  );
}

export default function AdminSettings() {
  const { t, isRTL } = useLanguage();
  const { tokens, setToken } = useThemeTokens();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editPasswordError, setEditPasswordError] = useState("");
  const [showAddStage, setShowAddStage] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>("#3b82f6");
  const [showAddField, setShowAddField] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);

  const { data: users, refetch: refetchUsers } = trpc.users.list.useQuery();
  const { data: stages, refetch: refetchStages } = trpc.pipeline.list.useQuery();
  const { data: customFields, refetch: refetchFields } = trpc.customFields.list.useQuery({});
  const { data: campaigns, refetch: refetchCampaigns } = trpc.campaigns.list.useQuery();
  const { data: slaConfig, refetch: refetchSLA } = trpc.sla.get.useQuery();
  const { data: themeSettings } = trpc.theme.get.useQuery();

  const registerUser = trpc.users.create.useMutation({
    onSuccess: () => { toast.success(isRTL ? "تم إنشاء المستخدم بنجاح" : "User created successfully"); refetchUsers(); setShowAddUser(false); userReset(); setShowPassword(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchUsers(); setEditingUser(null); setShowAddUser(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteUserMutation = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success(isRTL ? "تم حذف المستخدم" : "User deleted"); refetchUsers(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleUserActive = trpc.users.update.useMutation({
    onSuccess: () => { toast.success(isRTL ? "تم تحديث حالة المستخدم" : "User status updated"); refetchUsers(); },
    onError: (e) => toast.error(e.message),
  });
  const adminSetPassword = trpc.auth.adminSetPassword.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully");
      setEditNewPassword("");
      setEditConfirmPassword("");
      setShowEditPassword(false);
      setEditPasswordError("");
    },
    onError: (e) => {
      setEditPasswordError(e.message);
      toast.error(e.message);
    },
  });
  function handleAdminSetPassword(userId: number) {
    setEditPasswordError("");
    if (!editNewPassword) {
      setEditPasswordError(isRTL ? "يرجى إدخال كلمة المرور الجديدة" : "Please enter a new password");
      return;
    }
    if (editNewPassword.length < 6) {
      setEditPasswordError(isRTL ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    if (editNewPassword !== editConfirmPassword) {
      setEditPasswordError(isRTL ? "كلمة المرور غير متطابقة" : "Passwords do not match");
      return;
    }
    adminSetPassword.mutate({ userId, newPassword: editNewPassword });
  }
  function handleDeleteUser(u: any) {
    if (!window.confirm(isRTL ? `هل أنت متأكد من حذف "${u.name ?? u.email}"؟ لا يمكن التراجع.` : `Delete user "${u.name ?? u.email}"? This cannot be undone.`)) return;
    deleteUserMutation.mutate({ id: u.id });
  }

  const createStage = trpc.pipeline.create.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchStages(); setShowAddStage(false); stageReset(); setSelectedColor("#3b82f6"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteStage = trpc.pipeline.delete.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchStages(); },
  });

  const toggleStage = trpc.pipeline.toggle.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchStages(); },
    onError: (e) => toast.error(e.message),
  });

  const reorderStages = trpc.pipeline.reorder.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const [localStages, setLocalStages] = useState<any[]>([]);

  // Sync local stages when data loads
  const stageItems = localStages.length > 0 ? localStages : (stages ?? []);

  const dndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stageItems.findIndex((s: any) => s.id === active.id);
    const newIndex = stageItems.findIndex((s: any) => s.id === over.id);
    const reordered = arrayMove(stageItems, oldIndex, newIndex).map((s: any, i: number) => ({ ...s, order: i }));
    setLocalStages(reordered);
    reorderStages.mutate({ items: reordered.map((s: any) => ({ id: s.id, order: s.order })) });
  };

  const createField = trpc.customFields.create.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchFields(); setShowAddField(false); fieldReset(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteField = trpc.customFields.delete.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchFields(); },
  });

  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchCampaigns(); setShowAddCampaign(false); campReset(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchCampaigns(); },
  });

  const updateCampaign = trpc.campaigns.update.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchCampaigns(); },
  });

  const updateSLA = trpc.sla.update.useMutation({
    onSuccess: () => { toast.success(t("success")); refetchSLA(); },
  });

  const setBulkTheme = trpc.theme.setBulk.useMutation({
    onSuccess: () => toast.success(t("success")),
  });

  const checkSLA = trpc.sla.check.useMutation({
    onSuccess: (data) => toast.success(`SLA check complete: ${data} leads updated`),
  });

  const { register: userReg, handleSubmit: userSubmit, reset: userReset, setValue: userSetVal, watch: userWatch } = useForm({
    defaultValues: { name: "", email: "", role: "SalesAgent" as const, password: "" },
  });
  const [showPassword, setShowPassword] = useState(false);

  function generateStrongPassword(length = 16): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const all = upper + lower + digits + symbols;
    // Ensure at least one of each type
    let pwd = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];
    for (let i = pwd.length; i < length; i++) {
      pwd.push(all[Math.floor(Math.random() * all.length)]);
    }
    // Shuffle
    for (let i = pwd.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
    }
    return pwd.join("");
  }

  function handleGeneratePassword() {
    const pwd = generateStrongPassword();
    userSetVal("password", pwd);
    setShowPassword(true);
  }

  function handleCopyPassword() {
    const pwd = userWatch("password");
    if (pwd) {
      navigator.clipboard.writeText(pwd);
      toast.success(isRTL ? "تم نسخ كلمة المرور" : "Password copied to clipboard");
    }
  }

  const { register: stageReg, handleSubmit: stageSubmit, reset: stageReset } = useForm({
    defaultValues: { name: "", nameAr: "", color: "#6366f1", order: 0 },
  });

  const { register: fieldReg, handleSubmit: fieldSubmit, reset: fieldReset, setValue: fieldSetVal } = useForm({
    defaultValues: { entity: "Lead" as const, fieldName: "", fieldLabel: "", fieldLabelAr: "", fieldType: "text" as const, isRequired: false, order: 0 },
  });

  const { register: campReg, handleSubmit: campSubmit, reset: campReset, setValue: campSetVal } = useForm({
    defaultValues: { name: "", platform: "Meta" as const, notes: "", roundRobinEnabled: false },
  });

  const [themeForm, setThemeForm] = useState({
    primaryColor: tokens.primaryColor,
    accentColor: tokens.accentColor,
    fontFamily: tokens.fontFamily,
    logoUrl: tokens.logoUrl,
    appName: tokens.appName,
    appNameAr: tokens.appNameAr,
  });

  const [slaForm, setSlaForm] = useState({
    hoursThreshold: slaConfig?.hoursThreshold ?? 24,
    isEnabled: slaConfig?.isEnabled ?? true,
  });

  const isAdmin = ["Admin", "admin"].includes(user?.role ?? "");
  const isMediaBuyer = user?.role === "MediaBuyer";
  const canAccessMeta = isAdmin || isMediaBuyer;

  const handleSaveTheme = () => {
    const entries = Object.entries(themeForm).map(([key, value]) => ({ key, value }));
    setBulkTheme.mutate(entries);
    Object.entries(themeForm).forEach(([key, value]) => setToken(key as any, value));
  };

  const handleSaveSLA = () => {
    updateSLA.mutate(slaForm);
  };

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* ── Settings Header ── */}
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md shrink-0"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #7c3aed) 100%)" }}
          >
            <Settings size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{t("settings")}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isRTL ? "إدارة إعدادات النظام" : "Manage system settings"}
            </p>
          </div>
        </div>

        <Tabs defaultValue="preferences">
          <TabsList className="flex-wrap h-auto gap-1.5 p-1.5 rounded-2xl border border-border/60" style={{ background: "color-mix(in srgb, var(--muted) 80%, transparent)" }}>
            <TabsTrigger value="preferences" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <SlidersHorizontal size={13} />{isRTL ? "التفضيلات" : "Preferences"}
            </TabsTrigger>
            {isAdmin && <TabsTrigger value="users" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Users size={13} />{t("users")}
            </TabsTrigger>}
            {isAdmin && <TabsTrigger value="pipeline" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Sliders size={13} />{t("pipelineStages")}
            </TabsTrigger>}
            {isAdmin && <TabsTrigger value="campaigns" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Megaphone size={13} />{t("campaigns")}
            </TabsTrigger>}
            {isAdmin && <TabsTrigger value="fields" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Shield size={13} />{t("customFields")}
            </TabsTrigger>}
            {isAdmin && <TabsTrigger value="theme" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Palette size={13} />{t("themeSettings")}
            </TabsTrigger>}
            {isAdmin && <TabsTrigger value="sla" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Clock size={13} />{t("slaSettings")}
            </TabsTrigger>}
            {isAdmin && <TabsTrigger value="notifications" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Bell size={13} />{isRTL ? "الإشعارات" : "Notifications"}
            </TabsTrigger>}
            {isAdmin && <TabsTrigger value="meetingNotifs" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Clock size={13} />{isRTL ? "تذكير الاجتماعات" : "Meeting Reminders"}
            </TabsTrigger>}
            {isAdmin && <TabsTrigger value="leadSources" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <FileSpreadsheet size={13} />{isRTL ? "مصادر العملاء" : "Lead Sources"}
            </TabsTrigger>}
            {isAdmin && <TabsTrigger value="backup" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Archive size={13} />{isRTL ? "النسخ الاحتياطية" : "Backup"}
            </TabsTrigger>}
            {canAccessMeta && <TabsTrigger value="meta" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Megaphone size={13} />Meta Ads
            </TabsTrigger>}
            {canAccessMeta && <TabsTrigger value="tiktok" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Megaphone size={13} />TikTok Ads
            </TabsTrigger>}
            {canAccessMeta && <TabsTrigger value="metaLeadgen" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <Webhook size={13} />{isRTL ? "ويب هوك Meta" : "Meta Leadgen"}
            </TabsTrigger>}
            {canAccessMeta && <TabsTrigger value="metaAudit" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <BarChart3 size={13} />{isRTL ? "تدقيق Meta" : "Meta Audit"}
            </TabsTrigger>}
            <TabsTrigger value="rakan" className="gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all data-[state=active]:shadow-md" style={{ "--tw-data-active-bg": "linear-gradient(135deg,#7c3aed,#4f46e5)" } as React.CSSProperties}>
              <Sparkles size={13} className="text-violet-500 data-[state=active]:text-white" />
              <span>{isRTL ? "راكان AI" : "Rakan AI"}</span>
            </TabsTrigger>
            {isAdmin && <TabsTrigger value="currency" className="gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all data-[state=active]:shadow-md data-[state=active]:font-semibold">
              <DollarSign size={13} />
              <span>{isRTL ? "العملات" : "Currency"}</span>
            </TabsTrigger>}
          </TabsList>

          {/* ── Preferences Tab (visible to all roles) ── */}
          <TabsContent value="preferences" className="mt-4">
            <NotificationSettingsContent />
          </TabsContent>

          {/* ── Users Tab ── */}
          {isAdmin && <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold">{t("users")}</CardTitle>
                <Button size="sm" style={{ background: tokens.primaryColor }} className="text-white gap-1.5"
                  onClick={() => { userReset(); setShowAddUser(true); }}>
                  <Plus size={14} /> {t("addUser")}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("name")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("userRole")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("status")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users ?? []).map((u) => (
                      <tr key={u.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{u.name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">{t(u.role as any)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u.id !== user?.id ? (
                              <Switch
                                checked={(u as any).isActive !== false && (u as any).isActive !== 0}
                                onCheckedChange={(v) => toggleUserActive.mutate({ id: u.id, isActive: v })}
                                disabled={toggleUserActive.isPending}
                              />
                            ) : (
                              <Switch checked={true} disabled={true} />
                            )}
                            <span className={`text-xs font-medium ${(u as any).isActive !== false && (u as any).isActive !== 0 ? "text-green-600" : "text-red-500"}`}>
                              {(u as any).isActive !== false && (u as any).isActive !== 0 ? t("active") : t("inactive")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                              onClick={() => { setEditingUser(u); setShowAddUser(true); userSetVal("name", u.name ?? ""); userSetVal("email", u.email ?? ""); userSetVal("role", u.role as any); }}>
                              <Edit size={12} /> {t("edit")}
                            </Button>
                            {u.id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteUser(u)}
                                disabled={deleteUserMutation.isPending}
                              >
                                <Trash2 size={12} /> {isRTL ? "حذف" : "Delete"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>}

          {/* ── Pipeline Stages Tab ── */}
          {isAdmin && <TabsContent value="pipeline" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold">{t("pipelineStages")}</CardTitle>
                <Button size="sm" style={{ background: tokens.primaryColor }} className="text-white gap-1.5"
                  onClick={() => setShowAddStage(true)}>
                  <Plus size={14} /> {t("addStage")}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-xs text-muted-foreground px-4 py-2 border-b border-border">
                  {isRTL ? "اسحب للترتيب • تبديل لتفعيل/تعطيل المرحلة" : "Drag to reorder • Toggle to enable/disable stage"}
                </p>
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={stageItems.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
                    <div>
                      {stageItems.map((stage: any) => (
                        <SortableStageRow
                          key={stage.id}
                          stage={stage}
                          tokens={tokens}
                          onDelete={(id) => {
                            deleteStage.mutate({ id });
                            setLocalStages([]);
                          }}
                          onToggle={(id, isActive) => toggleStage.mutate({ id, isActive })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          </TabsContent>}

          {/* ── Campaigns Tab ── */}
          {isAdmin && <TabsContent value="campaigns" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold">{t("campaigns")}</CardTitle>
                <Button size="sm" style={{ background: tokens.primaryColor }} className="text-white gap-1.5"
                  onClick={() => setShowAddCampaign(true)}>
                  <Plus size={14} /> {t("addCampaign")}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("name")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("platform")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("roundRobin")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("status")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(campaigns ?? []).map((camp) => (
                      <tr key={camp.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{camp.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">{camp.platform}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={camp.roundRobinEnabled ?? false}
                            onCheckedChange={(v) => updateCampaign.mutate({ id: camp.id, roundRobinEnabled: v })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={camp.isActive ?? true}
                            onCheckedChange={(v) => updateCampaign.mutate({ id: camp.id, isActive: v })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteCampaign.mutate({ id: camp.id })}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>}

          {/* ── Custom Fields Tab ── */}
          {isAdmin && <TabsContent value="fields" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold">{t("customFields")}</CardTitle>
                <Button size="sm" style={{ background: tokens.primaryColor }} className="text-white gap-1.5"
                  onClick={() => setShowAddField(true)}>
                  <Plus size={14} /> {t("addField")}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("fieldName")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("entity")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("fieldType")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("isRequired")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(customFields ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("noData")}</td>
                      </tr>
                    ) : (customFields ?? []).map((field) => (
                      <tr key={field.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{field.fieldLabel ?? field.fieldName}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{field.entity}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground">{field.fieldType}</td>
                        <td className="px-4 py-3">
                          {field.isRequired ? (
                            <span className="text-xs text-green-600 font-medium">{t("yes")}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("no")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteField.mutate({ id: field.id })}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>}

          {/* ── Theme Tab ── */}
          {isAdmin && <TabsContent value="theme" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("themeSettings")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">{t("primaryColor")}</Label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={themeForm.primaryColor}
                        onChange={(e) => setThemeForm((p) => ({ ...p, primaryColor: e.target.value }))}
                        className="w-10 h-9 rounded border border-border cursor-pointer"
                      />
                      <Input
                        value={themeForm.primaryColor}
                        onChange={(e) => setThemeForm((p) => ({ ...p, primaryColor: e.target.value }))}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">{t("accentColor")}</Label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={themeForm.accentColor}
                        onChange={(e) => setThemeForm((p) => ({ ...p, accentColor: e.target.value }))}
                        className="w-10 h-9 rounded border border-border cursor-pointer"
                      />
                      <Input
                        value={themeForm.accentColor}
                        onChange={(e) => setThemeForm((p) => ({ ...p, accentColor: e.target.value }))}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">{t("fontFamily")}</Label>
                    <Select
                      value={themeForm.fontFamily}
                      onValueChange={(v) => setThemeForm((p) => ({ ...p, fontFamily: v }))}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cairo">Cairo (عربي)</SelectItem>
                        <SelectItem value="Tajawal">Tajawal (عربي)</SelectItem>
                        <SelectItem value="Almarai">Almarai (عربي)</SelectItem>
                        <SelectItem value="Inter">Inter (English)</SelectItem>
                        <SelectItem value="Roboto">Roboto (English)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t("logoUrl")}</Label>
                    <Input
                      value={themeForm.logoUrl}
                      onChange={(e) => setThemeForm((p) => ({ ...p, logoUrl: e.target.value }))}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t("appName")} (English)</Label>
                    <Input
                      value={themeForm.appName}
                      onChange={(e) => setThemeForm((p) => ({ ...p, appName: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t("appName")} (عربي)</Label>
                    <Input
                      value={themeForm.appNameAr}
                      onChange={(e) => setThemeForm((p) => ({ ...p, appNameAr: e.target.value }))}
                      className="mt-1"
                      dir="rtl"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-4 p-4 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-3">{isRTL ? "معاينة" : "Preview"}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: themeForm.primaryColor }}>
                      ت
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ fontFamily: themeForm.fontFamily }}>
                        {themeForm.appNameAr} / {themeForm.appName}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <div className="w-4 h-4 rounded" style={{ background: themeForm.primaryColor }} />
                        <div className="w-4 h-4 rounded" style={{ background: themeForm.accentColor }} />
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSaveTheme}
                  style={{ background: tokens.primaryColor }}
                  className="text-white gap-2"
                  disabled={setBulkTheme.isPending}
                >
                  <Save size={14} /> {t("save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>}

          {/* ── SLA Settings Tab ── */}
          {isAdmin && <TabsContent value="sla" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("slaSettings")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={slaForm.isEnabled}
                    onCheckedChange={(v) => setSlaForm((p) => ({ ...p, isEnabled: v }))}
                  />
                  <Label>{t("enableSLA")}</Label>
                </div>
                <div className="max-w-xs">
                  <Label className="text-xs">{t("hoursThreshold")}</Label>
                  <Input
                    type="number"
                    value={slaForm.hoursThreshold}
                    onChange={(e) => setSlaForm((p) => ({ ...p, hoursThreshold: Number(e.target.value) }))}
                    className="mt-1"
                    min={1}
                    max={720}
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRTL
                      ? `سيتم تنبيهك إذا لم يتم التواصل مع العميل خلال ${slaForm.hoursThreshold} ساعة`
                      : `Alert if no activity within ${slaForm.hoursThreshold} hours of lead creation`}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveSLA}
                    style={{ background: tokens.primaryColor }}
                    className="text-white gap-2"
                    disabled={updateSLA.isPending}
                  >
                    <Save size={14} /> {t("save")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => checkSLA.mutate()}
                    disabled={checkSLA.isPending}
                    className="gap-2"
                  >
                    {checkSLA.isPending ? t("loading") : (isRTL ? "تشغيل فحص SLA الآن" : "Run SLA Check Now")}
                  </Button>
                </div>
              </CardContent>
            </Card>
           </TabsContent>}

          {/* ── Notifications Tab ── */}
          {isAdmin && <TabsContent value="notifications" className="mt-4">
            <NotificationsTab isRTL={isRTL} tokens={tokens} />
          </TabsContent>}

          {isAdmin && <TabsContent value="meetingNotifs" className="mt-4">
            <MeetingNotificationSettings isRTL={isRTL} tokens={tokens} />
          </TabsContent>}

          {/* ── Lead Sources Tab ── */}
          {isAdmin && <TabsContent value="leadSources" className="mt-4">
            <LeadSourcesTab />
          </TabsContent>}

          {/* ── Backup & Restore Tab ── */}
          {isAdmin && <TabsContent value="backup" className="mt-4">
            <BackupTab />
          </TabsContent>}

          {/* ── Meta Ads Integration Tab ── */}
          {canAccessMeta && <TabsContent value="meta" className="mt-4">
            <MetaSettingsTab />
          </TabsContent>}

          {/* ── TikTok Ads Integration Tab ── */}
          {canAccessMeta && <TabsContent value="tiktok" className="mt-4">
            <TikTokSettingsTab />
          </TabsContent>}

          {/* ── Meta Leadgen Webhook Tab ── */}
          {canAccessMeta && <TabsContent value="metaLeadgen" className="mt-4">
            <MetaLeadgenSettingsTab />
          </TabsContent>}

          {canAccessMeta && <TabsContent value="metaAudit" className="mt-4">
            <MetaAuditTab />
          </TabsContent>}

          {/* ── Rakan AI Tab (visible to all roles) ── */}
          <TabsContent value="rakan" className="mt-4">
            <RakanSettingsTab />
          </TabsContent>

          {/* ── Currency / Exchange Rates Tab ── */}
          {isAdmin && <TabsContent value="currency" className="mt-4">
            <CurrencySettingsTab />
          </TabsContent>}
        </Tabs>
      </div>
      {/* Add/Edit User Dialog */}
      <Dialog open={showAddUser} onOpenChange={(v) => { setShowAddUser(v); if (!v) { setEditingUser(null); setShowPassword(false); setEditNewPassword(""); setEditConfirmPassword(""); setShowEditPassword(false); setEditPasswordError(""); } }}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingUser ? t("editUser") : t("addUser")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={userSubmit((data) => {
            if (editingUser) {
              const { password, ...updateData } = data;
              updateUser.mutate({ id: editingUser.id, ...updateData });
            } else {
              if (!data.password || data.password.length < 6) {
                toast.error(isRTL ? "كلمة المرور مطلوبة (6 أحرف على الأقل)" : "Password is required (minimum 6 characters)");
                return;
              }
              registerUser.mutate({ name: data.name, email: data.email, password: data.password, role: data.role as any });
            }
          })} className="space-y-4">
            <div>
              <Label>{t("name")}</Label>
              <Input {...userReg("name")} className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input {...userReg("email")} type="email" className="mt-1" dir="ltr" />
            </div>
            <div>
              <Label>{t("userRole")}</Label>
              <Select defaultValue={editingUser?.role ?? "SalesAgent"} onValueChange={(v) => userSetVal("role", v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{t(r as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingUser && (
              <div>
                <Label>{isRTL ? "كلمة المرور" : "Password"}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      {...userReg("password")}
                      type={showPassword ? "text" : "password"}
                      className="pr-10"
                      dir="ltr"
                      placeholder={isRTL ? "أدخل كلمة المرور أو اضغط توليد" : "Enter password or click Generate"}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleGeneratePassword}
                    title={isRTL ? "توليد كلمة مرور قوية" : "Generate strong password"}
                  >
                    <RefreshCw size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPassword}
                    title={isRTL ? "نسخ كلمة المرور" : "Copy password"}
                  >
                    <Copy size={16} />
                  </Button>
                </div>
                {userWatch("password") && showPassword && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono dir-ltr" dir="ltr">
                    {userWatch("password")}
                  </p>
                )}
              </div>
            )}
            {editingUser && (
              <div className="border-t border-border pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-muted-foreground" />
                    <Label className="font-semibold text-sm">{isRTL ? "تغيير كلمة المرور" : "Change Password"}</Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setShowEditPassword(!showEditPassword); setEditPasswordError(""); setEditNewPassword(""); setEditConfirmPassword(""); }}
                  >
                    {showEditPassword ? (isRTL ? "إلغاء" : "Cancel") : (isRTL ? "تعيين كلمة مرور جديدة" : "Set New Password")}
                  </Button>
                </div>
                {showEditPassword && (
                  <div className="space-y-3 bg-muted/30 p-3 rounded-lg">
                    {editPasswordError && (
                      <div className="text-red-500 text-xs bg-red-50 dark:bg-red-950 p-2 rounded-lg">{editPasswordError}</div>
                    )}
                    <div>
                      <Label className="text-xs">{isRTL ? "كلمة المرور الجديدة" : "New Password"}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative flex-1">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={editNewPassword}
                            onChange={(e) => setEditNewPassword(e.target.value)}
                            placeholder={isRTL ? "أدخل كلمة المرور الجديدة (6 أحرف على الأقل)" : "Enter new password (min 6 characters)"}
                            dir="ltr"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const pwd = generateStrongPassword();
                            setEditNewPassword(pwd);
                            setShowPassword(true);
                          }}
                          title={isRTL ? "توليد كلمة مرور قوية" : "Generate strong password"}
                        >
                          <RefreshCw size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            if (editNewPassword) {
                              navigator.clipboard.writeText(editNewPassword);
                              toast.success(isRTL ? "تم نسخ كلمة المرور" : "Password copied to clipboard");
                            }
                          }}
                          title={isRTL ? "نسخ كلمة المرور" : "Copy password"}
                        >
                          <Copy size={16} />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">{isRTL ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</Label>
                      <Input
                        type="password"
                        value={editConfirmPassword}
                        onChange={(e) => setEditConfirmPassword(e.target.value)}
                        placeholder={isRTL ? "أعد إدخال كلمة المرور الجديدة" : "Re-enter new password"}
                        dir="ltr"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      style={{ background: tokens.primaryColor }}
                      className="text-white gap-1.5 w-full"
                      onClick={() => handleAdminSetPassword(editingUser.id)}
                      disabled={adminSetPassword.isPending}
                    >
                      <Key size={14} />
                      {adminSetPassword.isPending ? (isRTL ? "جاري التغيير..." : "Changing...") : (isRTL ? "تغيير كلمة المرور" : "Change Password")}
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddUser(false)}>{t("cancel")}</Button>
              <Button type="submit" style={{ background: tokens.primaryColor }} className="text-white" disabled={editingUser ? updateUser.isPending : registerUser.isPending}>
                {(editingUser ? updateUser.isPending : registerUser.isPending) ? t("loading") : t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Stage Dialog */}
      <Dialog open={showAddStage} onOpenChange={setShowAddStage}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("addStage")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={stageSubmit((data) => createStage.mutate({ ...data, color: selectedColor }))} className="space-y-4">
            <div>
              <Label>{t("name")} (English)</Label>
              <Input {...stageReg("name", { required: true })} className="mt-1" />
            </div>
            <div>
              <Label>{t("name")} (عربي)</Label>
              <Input {...stageReg("nameAr")} className="mt-1" dir="rtl" />
            </div>
            <div>
              <Label>{t("color")}</Label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className="relative w-10 h-10 rounded-lg border-2 transition-all hover:scale-110"
                    style={{
                      background: color.value,
                      borderColor: selectedColor === color.value ? "#fff" : "transparent",
                      boxShadow: selectedColor === color.value ? `0 0 0 2px #000, 0 0 0 4px ${color.value}` : "none",
                    }}
                    title={color.name}
                  >
                    {selectedColor === color.value && (
                      <Check size={16} className="absolute inset-0 m-auto text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("order")}</Label>
              <Input {...stageReg("order", { valueAsNumber: true })} type="number" className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddStage(false)}>{t("cancel")}</Button>
              <Button type="submit" style={{ background: tokens.primaryColor }} className="text-white" disabled={createStage.isPending}>
                {t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Custom Field Dialog */}
      <Dialog open={showAddField} onOpenChange={setShowAddField}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("addField")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={fieldSubmit((data) => createField.mutate(data))} className="space-y-4">
            <div>
              <Label>{t("entity")}</Label>
              <Select defaultValue="Lead" onValueChange={(v) => fieldSetVal("entity", v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lead">{t("lead")}</SelectItem>
                  <SelectItem value="Deal">{t("deal")}</SelectItem>
                  <SelectItem value="Activity">{t("activity")}</SelectItem>
                  <SelectItem value="Campaign">{t("campaign")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("fieldName")}</Label>
              <Input {...fieldReg("fieldName", { required: true })} className="mt-1" placeholder="snake_case_name" dir="ltr" />
            </div>
            <div>
              <Label>{isRTL ? "تسمية الحقل" : "Field Label"} (English)</Label>
              <Input {...fieldReg("fieldLabel")} className="mt-1" />
            </div>
            <div>
              <Label>{isRTL ? "تسمية الحقل" : "Field Label"} (عربي)</Label>
              <Input {...fieldReg("fieldLabelAr")} className="mt-1" dir="rtl" />
            </div>
            <div>
              <Label>{t("fieldType")}</Label>
              <Select defaultValue="text" onValueChange={(v) => fieldSetVal("fieldType", v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch onCheckedChange={(v) => fieldSetVal("isRequired", v)} />
              <Label>{t("isRequired")}</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddField(false)}>{t("cancel")}</Button>
              <Button type="submit" style={{ background: tokens.primaryColor }} className="text-white" disabled={createField.isPending}>
                {t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Campaign Dialog */}
      <Dialog open={showAddCampaign} onOpenChange={setShowAddCampaign}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("addCampaign")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={campSubmit((data) => createCampaign.mutate(data))} className="space-y-4">
            <div>
              <Label>{t("name")}</Label>
              <Input {...campReg("name", { required: true })} className="mt-1" />
            </div>
            <div>
              <Label>{t("platform")}</Label>
              <Select defaultValue="Meta" onValueChange={(v) => campSetVal("platform", v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Messages", "LeadForm", "Meta", "Google", "Snapchat", "TikTok", "Other"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch onCheckedChange={(v) => campSetVal("roundRobinEnabled", v)} />
              <Label>{t("roundRobin")}</Label>
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Input {...campReg("notes")} className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddCampaign(false)}>{t("cancel")}</Button>
              <Button type="submit" style={{ background: tokens.primaryColor }} className="text-white" disabled={createCampaign.isPending}>
                {t("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

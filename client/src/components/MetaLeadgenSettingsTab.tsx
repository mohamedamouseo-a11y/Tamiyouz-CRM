import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  Webhook,
  PlugZap,
  XCircle,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CRM_FIELDS = [
  { value: "name", labelEn: "Name", labelAr: "الاسم" },
  { value: "phone", labelEn: "Phone", labelAr: "الهاتف" },
  { value: "businessProfile", labelEn: "Business Profile", labelAr: "الملف التجاري" },
  { value: "notes", labelEn: "Notes", labelAr: "ملاحظات" },
  { value: "_customField.email", labelEn: "Custom: Email", labelAr: "حقل مخصص: البريد الإلكتروني" },
  { value: "_customField.city", labelEn: "Custom: City", labelAr: "حقل مخصص: المدينة" },
];

const COMMON_META_FIELDS = ["full_name", "phone_number", "email", "city", "company_name"];

const defaultMapping: Record<string, string> = {
  full_name: "name",
  phone_number: "phone",
  email: "_customField.email",
  city: "_customField.city",
  company_name: "businessProfile",
};

function getRelativeTime(value?: string | null, isRTL?: boolean) {
  if (!value) return isRTL ? "لم يصل أي ليد بعد" : "Never";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return isRTL ? `منذ ${minutes} دقيقة` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isRTL ? `منذ ${hours} ساعة` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return isRTL ? `منذ ${days} يوم` : `${days} day ago`;
}

function StatusBadge({ enabled, totalLeads }: { enabled: boolean; totalLeads?: number }) {
  const { isRTL } = useLanguage();

  if (!enabled) {
    return (
      <Badge variant="outline" className="gap-1">
        <XCircle className="h-3.5 w-3.5" />
        {isRTL ? "معطل" : "Disabled"}
      </Badge>
    );
  }

  if ((totalLeads ?? 0) > 0) {
    return (
      <Badge className="gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {isRTL ? "متصل" : "Connected"}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <AlertTriangle className="h-3.5 w-3.5" />
      {isRTL ? "في انتظار الإعداد" : "Pending Setup"}
    </Badge>
  );
}

export default function MetaLeadgenSettingsTab() {
  const { isRTL, t } = useLanguage();
  const utils = trpc.useUtils();

  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formsDialog, setFormsDialog] = useState<{ open: boolean; pageId: string; token: string; pageName: string }>({
    open: false,
    pageId: "",
    token: "",
    pageName: "",
  });
  const [mappingDialog, setMappingDialog] = useState<{ open: boolean; config: any | null }>({ open: false, config: null });

  const [form, setForm] = useState({
    pageId: "",
    pageName: "",
    pageAccessToken: "",
    assignmentRule: "round_robin",
    fixedOwnerId: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [mappingState, setMappingState] = useState<Record<string, string>>(defaultMapping);

  const configsQuery = trpc.meta.leadgen.getConfigs.useQuery();
  const statsQuery = trpc.meta.leadgen.getStats.useQuery();

  const usersQuery = trpc.users.list.useQuery();
  const configs = configsQuery.data ?? [];
  const stats = statsQuery.data;
  const salesAgents = useMemo(
    () => (usersQuery.data ?? []).filter((u: any) => u.role === "SalesAgent" && u.isActive),
    [usersQuery.data],
  );

  const invalidateAll = async () => {
    await utils.meta.leadgen.getConfigs.invalidate();
    await utils.meta.leadgen.getStats.invalidate();
  };

  const upsertMutation = trpc.meta.leadgen.upsertConfig.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully");
      setShowAddDialog(false);
      setForm({ pageId: "", pageName: "", pageAccessToken: "", assignmentRule: "round_robin", fixedOwnerId: "" });
      await invalidateAll();
    },
    onError: (error) => toast.error(error.message || (isRTL ? "تعذر حفظ الإعدادات" : "Failed to save settings")),
  });

  const deleteMutation = trpc.meta.leadgen.deleteConfig.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم حذف الصفحة" : "Page removed");
      await invalidateAll();
    },
    onError: () => toast.error(isRTL ? "تعذر حذف الصفحة" : "Failed to remove page"),
  });

  const testMutation = trpc.meta.leadgen.testConnection.useMutation();
  const subscribeMutation = trpc.meta.leadgen.subscribeWebhook.useMutation();
  const formsQuery = trpc.meta.leadgen.getForms.useQuery(
    { pageId: formsDialog.pageId, accessToken: formsDialog.token },
    { enabled: formsDialog.open && !!formsDialog.pageId && !!formsDialog.token },
  );

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(isRTL ? "تم النسخ" : "Copied");
  };

  const handleAddPage = () => {
    upsertMutation.mutate({
      pageId: form.pageId,
      pageName: form.pageName || null,
      pageAccessToken: form.pageAccessToken,
      assignmentRule: form.assignmentRule as any,
      fixedOwnerId: form.assignmentRule === "fixed_owner" && form.fixedOwnerId ? Number(form.fixedOwnerId) : null,
      fieldMapping: defaultMapping,
      isEnabled: true,
    });
  };

  const handleToggle = (config: any, checked: boolean) => {
    upsertMutation.mutate({
      id: config.id,
      pageId: config.pageId,
      pageName: config.pageName,
      pageAccessToken: config.pageAccessToken,
      assignmentRule: config.assignmentRule,
      fixedOwnerId: config.fixedOwnerId,
      fieldMapping: config.fieldMapping || {},
      isEnabled: checked,
    });
  };

  const handleSaveMapping = () => {
    if (!mappingDialog.config) return;

    const config = mappingDialog.config;
    upsertMutation.mutate({
      id: config.id,
      pageId: config.pageId,
      pageName: config.pageName,
      pageAccessToken: config.pageAccessToken,
      assignmentRule: config.assignmentRule,
      fixedOwnerId: config.fixedOwnerId,
      isEnabled: config.isEnabled,
      fieldMapping: mappingState,
    });
    setMappingDialog({ open: false, config: null });
  };

  const currentVerifyToken = configs[0]?.webhookVerifyToken || "";
  const webhookUrl = stats?.webhookUrl || "https://sales.tamiyouzplaform.com/api/meta/webhook";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              {isRTL ? "ويب هوك إعلانات Meta" : "Meta Lead Ads Webhook"}
            </CardTitle>
            <StatusBadge enabled={!!configs.length} totalLeads={stats?.totalLeadsReceived} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{isRTL ? "رابط الويب هوك" : "Webhook URL"}</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly />
              <Button variant="outline" onClick={() => handleCopy(webhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? "رمز التحقق" : "Verify Token"}</Label>
            <div className="flex gap-2">
              <Input value={showVerifyToken ? currentVerifyToken : currentVerifyToken ? "•".repeat(24) : ""} readOnly />
              <Button variant="outline" onClick={() => setShowVerifyToken((v) => !v)}>
                {showVerifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={() => currentVerifyToken && handleCopy(currentVerifyToken)} disabled={!currentVerifyToken}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {isRTL
              ? "قم بإضافة هذا الرابط داخل لوحة مطوري Meta تحت Webhooks ثم اختر Page واشترك في leadgen."
              : "Configure this URL in your Meta App Dashboard under Webhooks → Page → leadgen."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{isRTL ? "الصفحات المتصلة" : "Connected Pages"}</CardTitle>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  {isRTL ? "إضافة صفحة" : "Add Page"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[620px]">
                <DialogHeader>
                  <DialogTitle>{isRTL ? "إضافة صفحة فيسبوك أو إنستجرام" : "Add Facebook/Instagram Page"}</DialogTitle>
                  <DialogDescription>
                    {isRTL
                      ? "أدخل بيانات الصفحة ورمز الوصول ثم اختبر الاتصال قبل الحفظ."
                      : "Enter the page details and access token, then test the connection before saving."}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label>{isRTL ? "Page ID" : "Page ID"}</Label>
                    <Input value={form.pageId} onChange={(e) => setForm((s) => ({ ...s, pageId: e.target.value }))} placeholder="123456789012345" />
                  </div>

                  <div className="space-y-2">
                    <Label>{isRTL ? "اسم الصفحة" : "Page Name"}</Label>
                    <Input value={form.pageName} onChange={(e) => setForm((s) => ({ ...s, pageName: e.target.value }))} placeholder={isRTL ? "اسم الصفحة" : "My Business Page"} />
                  </div>

                  <div className="space-y-2">
                    <Label>{isRTL ? "Page Access Token" : "Page Access Token"}</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showToken ? "text" : "password"}
                        value={form.pageAccessToken}
                        onChange={(e) => setForm((s) => ({ ...s, pageAccessToken: e.target.value }))}
                        placeholder={isRTL ? "ألصق رمز الوصول هنا" : "Paste long-lived page access token"}
                      />
                      <Button variant="outline" onClick={() => setShowToken((v) => !v)}>
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={testMutation.isPending || !form.pageId || !form.pageAccessToken}
                        onClick={() =>
                          testMutation.mutate(
                            { pageId: form.pageId, accessToken: form.pageAccessToken },
                            {
                              onSuccess: (data) =>
                                toast.success(
                                  isRTL ? `تم الاتصال بنجاح: ${data.name || data.id}` : `Connection successful: ${data.name || data.id}`,
                                ),
                              onError: () => toast.error(isRTL ? "فشل اختبار الاتصال" : "Connection test failed"),
                            },
                          )
                        }
                      >
                        {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                        <span className="ml-2">{isRTL ? "اختبار الاتصال" : "Test Connection"}</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isRTL
                        ? "يحتاج إلى صلاحيات leads_retrieval و pages_manage_metadata ويفضل استخدام رمز طويل المدة."
                        : "Requires leads_retrieval and pages_manage_metadata permissions. Use a long-lived token."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{isRTL ? "قاعدة التوزيع" : "Assignment Rule"}</Label>
                    <Select value={form.assignmentRule} onValueChange={(value) => setForm((s) => ({ ...s, assignmentRule: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round_robin">{isRTL ? "توزيع دائري" : "Round Robin"}</SelectItem>
                        <SelectItem value="fixed_owner">{isRTL ? "مالك ثابت" : "Fixed Owner"}</SelectItem>
                        <SelectItem value="by_campaign">{isRTL ? "حسب الحملة" : "By Campaign"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.assignmentRule === "fixed_owner" && (
                    <div className="space-y-2">
                      <Label>{isRTL ? "تعيين إلى المستخدم" : "Assign to User"}</Label>
                      <Select value={form.fixedOwnerId} onValueChange={(value) => setForm((s) => ({ ...s, fixedOwnerId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder={isRTL ? "اختر المستخدم" : "Select user"} />
                        </SelectTrigger>
                        <SelectContent>
                          {salesAgents.map((user: any) => (
                            <SelectItem key={user.id} value={String(user.id)}>
                              {user.name || `#${user.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    {isRTL ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button onClick={handleAddPage} disabled={upsertMutation.isPending || !form.pageId || !form.pageAccessToken}>
                    {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span className="ml-2">{isRTL ? "إضافة الصفحة" : "Add Page"}</span>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!configs.length ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
              <Globe className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">{isRTL ? "لا توجد صفحات متصلة بعد" : "No connected pages yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isRTL ? "أضف صفحة للبدء في استقبال ليدز Meta بشكل فوري داخل CRM." : "Add a page to start receiving Meta leads instantly in the CRM."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config: any) => (
                <Card key={config.id} className="border-dashed">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{config.pageName || config.pageId}</h3>
                        <StatusBadge enabled={!!config.isEnabled} totalLeads={config.totalLeadsReceived} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{isRTL ? "مفعل" : "Enabled"}</span>
                        <Switch checked={!!config.isEnabled} onCheckedChange={(checked) => handleToggle(config, checked)} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                      <div>
                        <div className="text-muted-foreground">{isRTL ? "Page ID" : "Page ID"}</div>
                        <div className="font-mono">{config.pageId}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{isRTL ? "قاعدة التوزيع" : "Assignment"}</div>
                        <div>{String(config.assignmentRule || "round_robin").replaceAll("_", " ")}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{isRTL ? "آخر ليد" : "Last Lead"}</div>
                        <div>{getRelativeTime(config.lastLeadReceivedAt, isRTL)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{isRTL ? "إجمالي الليدز" : "Total Leads"}</div>
                        <div>{config.totalLeadsReceived || 0}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={testMutation.isPending}
                        onClick={() =>
                          testMutation.mutate(
                            { pageId: config.pageId, accessToken: config.pageAccessToken },
                            {
                              onSuccess: () => toast.success(isRTL ? "تم اختبار الاتصال بنجاح" : "Connection tested successfully"),
                              onError: () => toast.error(isRTL ? "فشل اختبار الاتصال" : "Connection test failed"),
                            },
                          )
                        }
                      >
                        {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                        <span className="ml-1">{isRTL ? "اختبار الاتصال" : "Test Connection"}</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={subscribeMutation.isPending}
                        onClick={() =>
                          subscribeMutation.mutate(
                            { pageId: config.pageId, accessToken: config.pageAccessToken },
                            {
                              onSuccess: () => toast.success(isRTL ? "تم الاشتراك في الويب هوك" : "Webhook subscription completed"),
                              onError: () => toast.error(isRTL ? "فشل الاشتراك في الويب هوك" : "Failed to subscribe webhook"),
                            },
                          )
                        }
                      >
                        {subscribeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
                        <span className="ml-1">{isRTL ? "ربط الويب هوك" : "Subscribe Webhook"}</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFormsDialog({ open: true, pageId: config.pageId, token: config.pageAccessToken, pageName: config.pageName || config.pageId })}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="ml-1">{isRTL ? "عرض النماذج" : "View Forms"}</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMappingState({ ...defaultMapping, ...(config.fieldMapping || {}) });
                          setMappingDialog({ open: true, config });
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                        <span className="ml-1">{isRTL ? "ربط الحقول" : "Field Mapping"}</span>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                            <span className="ml-1">{isRTL ? "إزالة" : "Remove"}</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{isRTL ? "إزالة الصفحة؟" : "Remove Page?"}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {isRTL
                                ? "سيؤدي هذا إلى إيقاف استقبال الليدز من هذه الصفحة. سيتم الاحتفاظ بالليدز السابقة داخل النظام."
                                : "This will stop receiving leads from this page. Previously imported leads will be kept."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: config.id })}>
                              {isRTL ? "إزالة" : "Remove"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formsDialog.open} onOpenChange={(open) => setFormsDialog((s) => ({ ...s, open }))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isRTL ? `نماذج الليدز: ${formsDialog.pageName}` : `Lead Forms: ${formsDialog.pageName}`}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "اسم النموذج" : "Form Name"}</TableHead>
                  <TableHead>{isRTL ? "Form ID" : "Form ID"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRTL ? "تاريخ الإنشاء" : "Created"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : (formsQuery.data ?? []).length ? (
                  (formsQuery.data ?? []).map((formItem: any) => (
                    <TableRow key={formItem.id}>
                      <TableCell>{formItem.name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{formItem.id}</TableCell>
                      <TableCell>{formItem.status || "—"}</TableCell>
                      <TableCell>{formItem.created_time || "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      {isRTL ? "لم يتم العثور على نماذج ليدز لهذه الصفحة" : "No lead forms found for this page"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormsDialog((s) => ({ ...s, open: false }))}>
              {isRTL ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mappingDialog.open} onOpenChange={(open) => setMappingDialog((s) => ({ ...s, open }))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {isRTL
                ? `ربط الحقول: ${mappingDialog.config?.pageName || mappingDialog.config?.pageId || ""}`
                : `Field Mapping: ${mappingDialog.config?.pageName || mappingDialog.config?.pageId || ""}`}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "اربط حقول نموذج Meta بحقول CRM. الحقول الشائعة يتم اقتراحها تلقائياً."
                : "Map Meta lead form fields to CRM fields. Common fields are auto-suggested."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "حقل Meta" : "Meta Form Field"}</TableHead>
                  <TableHead>{isRTL ? "حقل CRM" : "CRM Field"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMMON_META_FIELDS.map((metaField) => (
                  <TableRow key={metaField}>
                    <TableCell className="font-mono text-xs">{metaField}</TableCell>
                    <TableCell>
                      <Select
                        value={mappingState[metaField] || "__none__"}
                        onValueChange={(value) =>
                          setMappingState((prev) => ({
                            ...prev,
                            [metaField]: value === "__none__" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isRTL ? "اختر الحقل" : "Select field"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{isRTL ? "بدون ربط" : "No Mapping"}</SelectItem>
                          {CRM_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {isRTL ? field.labelAr : field.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialog({ open: false, config: null })}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSaveMapping}>{isRTL ? "حفظ الربط" : "Save Mapping"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

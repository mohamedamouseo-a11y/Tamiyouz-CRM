import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";

const defaultDraft = {
  name: "",
  slug: "",
  status: "Draft",
  isEnabled: true,
  allowedDomainsText: "tamiyouzalrowad.com",
  endpointPath: "/api/public/lead-intake/",
  sourceName: "",
  defaultPageTitle: "",
  defaultStage: "New",
  assignmentRule: "round_robin",
  fixedOwnerId: "",
  dedupRule: "phone",
  attributionMode: "both",
  tagsText: "",
  successMessage: "",
  redirectUrl: "",
};

function draftToPayload(draft: typeof defaultDraft) {
  return {
    name: draft.name,
    slug: draft.slug,
    status: draft.status as "Draft" | "Active" | "Disabled",
    isEnabled: draft.isEnabled,
    allowedDomains: draft.allowedDomainsText.split(",").map(v => v.trim()).filter(Boolean),
    endpointPath: draft.endpointPath,
    sourceName: draft.sourceName,
    defaultPageTitle: draft.defaultPageTitle,
    defaultStage: draft.defaultStage,
    assignmentRule: draft.assignmentRule as "round_robin" | "fixed_owner" | "by_campaign",
    fixedOwnerId: draft.fixedOwnerId ? Number(draft.fixedOwnerId) : null,
    dedupRule: draft.dedupRule as "phone" | "external_id" | "phone_and_source",
    attributionMode: draft.attributionMode as "first_touch" | "last_touch" | "both",
    fieldMapping: {},
    securityConfig: {},
    notificationConfig: {},
    tags: draft.tagsText.split(",").map(v => v.trim()).filter(Boolean),
    scoringRules: [],
    successMessage: draft.successMessage,
    redirectUrl: draft.redirectUrl,
  };
}

export default function LandingPageIntegrationsTab() {
  const { isRTL } = useLanguage();
  const [draft, setDraft] = useState(defaultDraft);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = trpc.landingPageIntegrations.list.useQuery();
  const createMutation = trpc.landingPageIntegrations.create.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم إنشاء الـ integration بنجاح" : "Integration created successfully");
      listQuery.refetch();
      setDraft(defaultDraft);
      setSelectedId(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = trpc.landingPageIntegrations.update.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تحديث الـ integration بنجاح" : "Integration updated successfully");
      listQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.landingPageIntegrations.delete.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف الـ integration بنجاح" : "Integration deleted successfully");
      listQuery.refetch();
      setSelectedId(null);
      setDraft(defaultDraft);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[340px,1fr] gap-4">
      {/* Left: Integration list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>{isRTL ? "ربط صفحات الهبوط" : "Landing Page Integrations"}</span>
            <Button size="sm" variant="outline" onClick={() => { setSelectedId(null); setDraft(defaultDraft); }}>
              <Plus className="h-4 w-4 mr-1" /> {isRTL ? "جديد" : "New"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[540px] pr-2">
            <div className="space-y-2">
              {(listQuery.data || []).map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setDraft({
                      ...defaultDraft,
                      name: item.name,
                      slug: item.slug,
                      status: item.status,
                      isEnabled: item.isEnabled,
                      allowedDomainsText: (item.allowedDomains || []).join(", "),
                      endpointPath: item.endpointPath,
                      sourceName: item.sourceName || "",
                      defaultPageTitle: item.defaultPageTitle || "",
                      defaultStage: item.defaultStage,
                      assignmentRule: item.assignmentRule,
                      fixedOwnerId: item.fixedOwnerId ? String(item.fixedOwnerId) : "",
                      dedupRule: item.dedupRule,
                      attributionMode: item.attributionMode,
                      tagsText: (item.tags || []).join(", "),
                      successMessage: item.successMessage || "",
                      redirectUrl: item.redirectUrl || "",
                    });
                  }}
                  className={`w-full rounded-xl border p-3 text-start transition ${selectedId === item.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-start">
                      <div className="font-semibold text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">/{item.slug}</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge variant={item.status === "Active" ? "default" : "secondary"} className="text-[11px]">{item.status}</Badge>
                      {item.isEnabled
                        ? <Badge variant="outline" className="text-[11px]">{isRTL ? "مفعّل" : "On"}</Badge>
                        : <Badge variant="destructive" className="text-[11px]">{isRTL ? "معطّل" : "Off"}</Badge>}
                    </div>
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{item.endpointPath}</div>
                </button>
              ))}
              {(listQuery.data || []).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {isRTL ? "لا توجد integrations بعد" : "No integrations yet"}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right: Form (flat, no tabs) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedId ? (isRTL ? "تعديل Integration" : "Edit Integration") : (isRTL ? "إنشاء Integration جديد" : "Create New Integration")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{isRTL ? "اسم الـ Integration" : "Integration Name"}</Label>
                <Input placeholder={isRTL ? "مثال: باقات التسويق" : "e.g. Marketing Packages"} value={draft.name} onChange={(e) => setDraft(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input placeholder="marketing-packages" value={draft.slug} onChange={(e) => setDraft(s => ({ ...s, slug: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "مسار الـ Endpoint" : "Endpoint Path"}</Label>
                <Input value={draft.endpointPath} onChange={(e) => setDraft(s => ({ ...s, endpointPath: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "النطاقات المسموحة" : "Allowed Domains"}</Label>
                <Input value={draft.allowedDomainsText} onChange={(e) => setDraft(s => ({ ...s, allowedDomainsText: e.target.value }))} placeholder="tamiyouzalrowad.com" />
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "اسم المصدر" : "Source Name"}</Label>
                <Input placeholder={isRTL ? "مثال: الموقع - باقات التسويق" : "e.g. Website - Marketing Packages"} value={draft.sourceName} onChange={(e) => setDraft(s => ({ ...s, sourceName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "عنوان الصفحة الافتراضي" : "Default Page Title"}</Label>
                <Input value={draft.defaultPageTitle} onChange={(e) => setDraft(s => ({ ...s, defaultPageTitle: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "الحالة" : "Status"}</Label>
                <Select value={draft.status} onValueChange={(value) => setDraft(s => ({ ...s, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">{isRTL ? "مسودة" : "Draft"}</SelectItem>
                    <SelectItem value="Active">{isRTL ? "نشط" : "Active"}</SelectItem>
                    <SelectItem value="Disabled">{isRTL ? "معطّل" : "Disabled"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "المرحلة الافتراضية" : "Default Stage"}</Label>
                <Input value={draft.defaultStage} onChange={(e) => setDraft(s => ({ ...s, defaultStage: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "قاعدة التعيين" : "Assignment Rule"}</Label>
                <Select value={draft.assignmentRule} onValueChange={(value) => setDraft(s => ({ ...s, assignmentRule: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                    <SelectItem value="fixed_owner">{isRTL ? "مالك ثابت" : "Fixed Owner"}</SelectItem>
                    <SelectItem value="by_campaign">{isRTL ? "حسب الحملة" : "By Campaign"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.assignmentRule === "fixed_owner" && (
                <div className="space-y-1.5">
                  <Label>{isRTL ? "معرّف المالك الثابت" : "Fixed Owner ID"}</Label>
                  <Input type="number" value={draft.fixedOwnerId} onChange={(e) => setDraft(s => ({ ...s, fixedOwnerId: e.target.value }))} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{isRTL ? "قاعدة منع التكرار" : "Dedup Rule"}</Label>
                <Select value={draft.dedupRule} onValueChange={(value) => setDraft(s => ({ ...s, dedupRule: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">{isRTL ? "الهاتف" : "Phone"}</SelectItem>
                    <SelectItem value="external_id">External ID</SelectItem>
                    <SelectItem value="phone_and_source">{isRTL ? "الهاتف + المصدر" : "Phone + Source"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "وضع الإسناد" : "Attribution Mode"}</Label>
                <Select value={draft.attributionMode} onValueChange={(value) => setDraft(s => ({ ...s, attributionMode: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_touch">First Touch</SelectItem>
                    <SelectItem value="last_touch">Last Touch</SelectItem>
                    <SelectItem value="both">{isRTL ? "الاثنين" : "Both"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={draft.isEnabled} onCheckedChange={(value) => setDraft(s => ({ ...s, isEnabled: value }))} />
              <Label>{isRTL ? "الـ Integration مفعّل" : "Integration Enabled"}</Label>
            </div>

            <div className="space-y-1.5">
              <Label>{isRTL ? "رسالة النجاح" : "Success Message"}</Label>
              <Textarea rows={2} placeholder={isRTL ? "تم استلام طلبك بنجاح..." : "Your request has been received..."} value={draft.successMessage} onChange={(e) => setDraft(s => ({ ...s, successMessage: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{isRTL ? "رابط إعادة التوجيه (اختياري)" : "Redirect URL (optional)"}</Label>
                <Input placeholder="https://..." value={draft.redirectUrl} onChange={(e) => setDraft(s => ({ ...s, redirectUrl: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "الوسوم (مفصولة بفاصلة)" : "Tags (comma separated)"}</Label>
                <Input placeholder="landing-page, marketing" value={draft.tagsText} onChange={(e) => setDraft(s => ({ ...s, tagsText: e.target.value }))} />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              {isRTL
                ? "ربط الحقول والأمان والإشعارات تتم تلقائيًا. بيانات النموذج تتربط بحقول الـ CRM أوتوماتيك، والإشعارات بتوصل في الـ Inbox."
                : "Field mapping, security, and notifications are handled automatically. Form data is mapped to CRM fields automatically, and notifications are delivered to your Inbox."}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={() =>
                  selectedId
                    ? updateMutation.mutate({ id: selectedId, data: draftToPayload(draft) })
                    : createMutation.mutate(draftToPayload(draft))
                }
                disabled={!draft.name || !draft.slug || createMutation.isPending || updateMutation.isPending}
              >
                {selectedId
                  ? (isRTL ? "حفظ التغييرات" : "Save Changes")
                  : (isRTL ? "إنشاء Integration" : "Create Integration")}
              </Button>
              {selectedId ? (
                <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: selectedId })} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" /> {isRTL ? "حذف" : "Delete"}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

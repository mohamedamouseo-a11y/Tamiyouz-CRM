import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, RefreshCcw } from "lucide-react";

const defaultDraft = {
  name: "",
  slug: "",
  status: "Draft",
  isEnabled: true,
  allowedDomainsText: "tamiyouzalrowad.com",
  endpointPath: "/api/public/lead-intake/marketing-packages",
  sourceName: "Website - Marketing Packages",
  defaultPageTitle: "باقات التسويق",
  defaultStage: "New",
  assignmentRule: "round_robin",
  fixedOwnerId: "",
  dedupRule: "phone",
  attributionMode: "both",
  fieldMappingText: JSON.stringify({
    name: "name",
    phone: "phone",
    businessProfile: "businessLink",
    campaignName: "utm_campaign",
    sourceMetadata: {
      pageSlug: "pageSlug",
      pageTitle: "pageTitle",
      landingUrl: "landingUrl",
      referrer: "referrer",
      utm_source: "utm_source",
      utm_medium: "utm_medium",
      utm_campaign: "utm_campaign",
    },
    customFields: {
      businessType: "businessType",
      acquisitionChannels: "acquisitionChannels",
      budget: "budget",
      challenge: "challenge",
      decisionMaker: "decisionMaker",
      preferredContactTime: "preferredContactTime",
      businessLink: "businessLink",
    },
  }, null, 2),
  securityConfigText: JSON.stringify({
    allowedOrigins: ["tamiyouzalrowad.com"],
    requireTurnstile: true,
    honeypotField: "website",
    minSubmitSeconds: 3,
    rateLimitWindowMinutes: 10,
    rateLimitMaxRequests: 5,
  }, null, 2),
  notificationConfigText: JSON.stringify({
    email: {
      enabled: true,
      recipients: ["mohamedamou.seo@gmail.com"],
      notifyOn: ["lead_created", "integration_error"],
    },
    slack: {
      enabled: false,
      webhookUrl: "",
      channel: "#leads",
      mention: "@here",
      notifyOn: ["lead_created"],
    },
  }, null, 2),
  tagsText: "landing-page, marketing-packages",
  scoringRulesText: JSON.stringify([], null, 2),
  successMessage: "تم استلام طلبك بنجاح وسيتم التواصل معك قريبًا.",
  redirectUrl: "",
};

function safeParse<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

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
    fieldMapping: safeParse(draft.fieldMappingText, {}),
    securityConfig: safeParse(draft.securityConfigText, {}),
    notificationConfig: safeParse(draft.notificationConfigText, {}),
    tags: draft.tagsText.split(",").map(v => v.trim()).filter(Boolean),
    scoringRules: safeParse(draft.scoringRulesText, []),
    successMessage: draft.successMessage,
    redirectUrl: draft.redirectUrl,
  };
}

export default function LandingPageIntegrationsTab() {
  const [draft, setDraft] = useState(defaultDraft);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = trpc.landingPageIntegrations.list.useQuery();
  const createMutation = trpc.landingPageIntegrations.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الـ integration");
      listQuery.refetch();
      setDraft(defaultDraft);
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = trpc.landingPageIntegrations.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الـ integration");
      listQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.landingPageIntegrations.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الـ integration");
      listQuery.refetch();
      setSelectedId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const selected = useMemo(() => listQuery.data?.find((item: any) => item.id === selectedId) ?? null, [listQuery.data, selectedId]);
  const logsQuery = trpc.landingPageIntegrations.logs.useQuery(
    { integrationId: selectedId || 0, limit: 20 },
    { enabled: !!selectedId }
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Landing Page Integrations</span>
            <Button size="sm" variant="outline" onClick={() => { setSelectedId(null); setDraft(defaultDraft); }}>
              <Plus className="h-4 w-4 mr-2" /> جديد
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[560px] pr-2">
            <div className="space-y-3">
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
                      fieldMappingText: JSON.stringify(item.fieldMapping || {}, null, 2),
                      securityConfigText: JSON.stringify(item.securityConfig || {}, null, 2),
                      notificationConfigText: JSON.stringify(item.notificationConfig || {}, null, 2),
                      tagsText: (item.tags || []).join(", "),
                      scoringRulesText: JSON.stringify(item.scoringRules || [], null, 2),
                      successMessage: item.successMessage || "",
                      redirectUrl: item.redirectUrl || "",
                    });
                  }}
                  className={`w-full rounded-xl border p-3 text-right transition ${selectedId === item.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-muted-foreground">/{item.slug}</div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={item.status === "Active" ? "default" : "secondary"}>{item.status}</Badge>
                      {item.isEnabled ? <Badge variant="outline">Enabled</Badge> : <Badge variant="destructive">Off</Badge>}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{item.endpointPath}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selectedId ? "Edit Integration" : "Create Integration"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="mapping">Mapping</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Integration Name</Label><Input value={draft.name} onChange={(e) => setDraft(s => ({ ...s, name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Slug</Label><Input value={draft.slug} onChange={(e) => setDraft(s => ({ ...s, slug: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Endpoint Path</Label><Input value={draft.endpointPath} onChange={(e) => setDraft(s => ({ ...s, endpointPath: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Allowed Domains</Label><Input value={draft.allowedDomainsText} onChange={(e) => setDraft(s => ({ ...s, allowedDomainsText: e.target.value }))} placeholder="tamiyouzalrowad.com, campaign.example.com" /></div>
                <div className="space-y-2"><Label>Source Name</Label><Input value={draft.sourceName} onChange={(e) => setDraft(s => ({ ...s, sourceName: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Default Page Title</Label><Input value={draft.defaultPageTitle} onChange={(e) => setDraft(s => ({ ...s, defaultPageTitle: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Status</Label><Select value={draft.status} onValueChange={(value) => setDraft(s => ({ ...s, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Disabled">Disabled</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Default Stage</Label><Input value={draft.defaultStage} onChange={(e) => setDraft(s => ({ ...s, defaultStage: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Assignment Rule</Label><Select value={draft.assignmentRule} onValueChange={(value) => setDraft(s => ({ ...s, assignmentRule: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="round_robin">Round Robin</SelectItem><SelectItem value="fixed_owner">Fixed Owner</SelectItem><SelectItem value="by_campaign">By Campaign</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Fixed Owner ID</Label><Input value={draft.fixedOwnerId} onChange={(e) => setDraft(s => ({ ...s, fixedOwnerId: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Dedup Rule</Label><Select value={draft.dedupRule} onValueChange={(value) => setDraft(s => ({ ...s, dedupRule: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="phone">Phone</SelectItem><SelectItem value="external_id">External ID</SelectItem><SelectItem value="phone_and_source">Phone + Source</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Attribution Mode</Label><Select value={draft.attributionMode} onValueChange={(value) => setDraft(s => ({ ...s, attributionMode: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="first_touch">First Touch</SelectItem><SelectItem value="last_touch">Last Touch</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent></Select></div>
              </div>
              <div className="flex items-center gap-3"><Switch checked={draft.isEnabled} onCheckedChange={(value) => setDraft(s => ({ ...s, isEnabled: value }))} /><Label>Integration Enabled</Label></div>
              <div className="space-y-2"><Label>Success Message</Label><Textarea rows={3} value={draft.successMessage} onChange={(e) => setDraft(s => ({ ...s, successMessage: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Redirect URL (optional)</Label><Input value={draft.redirectUrl} onChange={(e) => setDraft(s => ({ ...s, redirectUrl: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Tags (comma separated)</Label><Input value={draft.tagsText} onChange={(e) => setDraft(s => ({ ...s, tagsText: e.target.value }))} /></div>
            </TabsContent>

            <TabsContent value="mapping" className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Field Mapping JSON</Label><Textarea rows={20} className="font-mono text-xs" value={draft.fieldMappingText} onChange={(e) => setDraft(s => ({ ...s, fieldMappingText: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Scoring Rules JSON</Label><Textarea rows={10} className="font-mono text-xs" value={draft.scoringRulesText} onChange={(e) => setDraft(s => ({ ...s, scoringRulesText: e.target.value }))} /></div>
            </TabsContent>

            <TabsContent value="security" className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Security Config JSON</Label><Textarea rows={18} className="font-mono text-xs" value={draft.securityConfigText} onChange={(e) => setDraft(s => ({ ...s, securityConfigText: e.target.value }))} /></div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4 mt-4">
              <div className="rounded-xl border p-3 bg-muted/30 text-sm text-muted-foreground">
                يدعم أكثر من email للإشعار، ويدعم Slack webhook لكل landing page بشكل مستقل.
              </div>
              <div className="space-y-2"><Label>Notification Config JSON</Label><Textarea rows={18} className="font-mono text-xs" value={draft.notificationConfigText} onChange={(e) => setDraft(s => ({ ...s, notificationConfigText: e.target.value }))} /></div>
            </TabsContent>

            <TabsContent value="logs" className="space-y-4 mt-4">
              {!selectedId ? (
                <div className="text-sm text-muted-foreground">اختر integration أولًا لعرض logs.</div>
              ) : (
                <div className="space-y-3">
                  <Button variant="outline" size="sm" onClick={() => logsQuery.refetch()}><RefreshCcw className="h-4 w-4 mr-2" /> Refresh Logs</Button>
                  <ScrollArea className="h-[420px] border rounded-xl p-3">
                    <div className="space-y-3">
                      {(logsQuery.data || []).map((log: any) => (
                        <div key={log.id} className="border rounded-xl p-3">
                          <div className="flex items-center justify-between text-sm">
                            <div className="font-medium">#{log.id}</div>
                            <Badge variant="outline">{log.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{String(log.createdAt)}</div>
                          {log.errorMessage ? <div className="text-xs text-red-500 mt-2">{log.errorMessage}</div> : null}
                          <pre className="mt-3 text-[11px] overflow-auto whitespace-pre-wrap bg-muted/40 rounded-lg p-2">{JSON.stringify(log.payloadJson, null, 2)}</pre>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap gap-3 mt-6">
            <Button onClick={() => selectedId ? updateMutation.mutate({ id: selectedId, data: draftToPayload(draft) }) : createMutation.mutate(draftToPayload(draft))}>
              {selectedId ? "Save Changes" : "Create Integration"}
            </Button>
            {selectedId ? (
              <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: selectedId })}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

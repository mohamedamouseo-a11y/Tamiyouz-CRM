import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { toast } from "sonner";
import {
  Bot,
  CheckCircle2,
  Copy,
  FileCode2,
  Github,
  Play,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Webhook,
  XCircle,
} from "lucide-react";

type LogType = "info" | "success" | "error" | "warning";

type LogEntry = {
  time: string;
  message: string;
  type: LogType;
};

type SyncStatus = "idle" | "running" | "success" | "error";

type DeveloperHubStatus = {
  repoPath: string;
  branch: string;
  shortSha: string;
  lastCommit: string;
  isDirty: boolean;
  deployRunning: boolean;
  mcpEnabled: boolean;
  webhookUrl: string;
  webhookSecret: string;
  aiAccessUrl: string;
  aiAccessTokenMasked: string;
  latestContextGeneratedAt: string | null;
};

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

export default function DeveloperHubTab() {
  const { isRTL } = useLanguage();
  const { tokens } = useThemeTokens();

  const [status, setStatus] = useState<DeveloperHubStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastDeployTime, setLastDeployTime] = useState<string | null>(null);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpSaving, setMcpSaving] = useState(false);
  const [contextGenerating, setContextGenerating] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const deploymentTitle = isRTL ? "لوحة النشر" : "GitHub Deployment";
  const aiTitle = isRTL ? "ربط الذكاء الاصطناعي" : "AI Integration";
  const webhooksTitle = isRTL ? "إعدادات الـ Webhooks" : "Webhooks Configuration";

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if (typeof status?.mcpEnabled === "boolean") {
      setMcpEnabled(status.mcpEnabled);
    }
  }, [status?.mcpEnabled]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string, type: LogType = "info") => {
    setLogs((prev) => [...prev, { time: formatTime(), message, type }]);
  };

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await fetch("/api/developer-hub/status", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to fetch status" }));
        throw new Error(err.error || err.message || "Failed to fetch status");
      }

      const data = (await response.json()) as DeveloperHubStatus;
      setStatus(data);
    } catch (error: any) {
      toast.error(isRTL ? "تعذر تحميل حالة لوحة المطورين" : "Failed to load Developer Hub status", {
        description: error?.message,
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const copyText = async (value: string, labelAr: string, labelEn: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(isRTL ? `تم نسخ ${labelAr}` : `${labelEn} copied`);
    } catch {
      toast.error(isRTL ? "تعذر النسخ" : "Copy failed");
    }
  };

  const startDeploy = async () => {
    setSyncStatus("running");
    setProgress(2);
    setCurrentStep(isRTL ? "جاري تجهيز جلسة النشر..." : "Preparing deployment session...");
    setLogs([]);
    addLog(isRTL ? "بدء مزامنة Git وبناء المشروع..." : "Starting git sync and deployment...", "info");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/deploy-sync", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Deploy request failed" }));
        throw new Error(err.error || err.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming response is not available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") {
              setProgress(Number(data.percent || 0));
              setCurrentStep(isRTL ? data.stepAr || data.step : data.step || data.stepAr);
              addLog(isRTL ? data.stepAr || data.step : data.step || data.stepAr, "info");
            } else if (data.type === "log") {
              addLog(isRTL ? data.messageAr || data.message : data.message || data.messageAr, data.level || "info");
            } else if (data.type === "done") {
              setSyncStatus("success");
              setProgress(100);
              setCurrentStep(isRTL ? "اكتملت المزامنة وإعادة النشر بنجاح" : "Sync and deployment completed successfully");
              addLog(isRTL ? "اكتملت المزامنة وإعادة النشر بنجاح" : "Sync and deployment completed successfully", "success");
              setLastDeployTime(new Date().toLocaleString(isRTL ? "ar-EG" : "en-US"));
              toast.success(isRTL ? "تم النشر بنجاح" : "Deployment completed successfully");
              void loadStatus();
            } else if (data.type === "error") {
              setSyncStatus("error");
              setCurrentStep(isRTL ? `خطأ: ${data.messageAr || data.message}` : `Error: ${data.message || data.messageAr}`);
              addLog(isRTL ? data.messageAr || data.message : data.message || data.messageAr, "error");
              toast.error(isRTL ? "فشل النشر" : "Deployment failed");
            }
          } catch {
            // Ignore malformed SSE line
          }
        }
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        setSyncStatus("idle");
        addLog(isRTL ? "تم إلغاء جلسة النشر من المتصفح" : "Deployment stream cancelled from browser", "warning");
        toast.info(isRTL ? "تم إلغاء الجلسة" : "Stream cancelled");
      } else {
        setSyncStatus("error");
        setCurrentStep(isRTL ? `خطأ: ${error?.message}` : `Error: ${error?.message}`);
        addLog(error?.message || "Unknown error", "error");
        toast.error(isRTL ? "فشل النشر" : "Deployment failed", { description: error?.message });
      }
    } finally {
      abortRef.current = null;
    }
  };

  const cancelDeploy = () => {
    abortRef.current?.abort();
  };

  const saveMcpToggle = async (checked: boolean) => {
    setMcpEnabled(checked);
    setMcpSaving(true);

    try {
      const response = await fetch("/api/developer-hub/mcp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to update MCP state" }));
        throw new Error(err.error || err.message || "Failed to update MCP state");
      }

      setStatus((prev) => (prev ? { ...prev, mcpEnabled: checked } : prev));
      toast.success(
        isRTL
          ? checked
            ? "تم تفعيل خادم MCP"
            : "تم إيقاف خادم MCP"
          : checked
            ? "MCP server enabled"
            : "MCP server disabled"
      );
    } catch (error: any) {
      setMcpEnabled((prev) => !prev);
      toast.error(isRTL ? "تعذر تحديث حالة MCP" : "Failed to update MCP state", {
        description: error?.message,
      });
    } finally {
      setMcpSaving(false);
    }
  };

  const generateContext = async () => {
    setContextGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-context", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to generate AI context" }));
        throw new Error(err.error || err.message || "Failed to generate AI context");
      }

      const data = await response.json();
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              aiAccessUrl: data.apiUrl || prev.aiAccessUrl,
              latestContextGeneratedAt: data.generatedAt || prev.latestContextGeneratedAt,
            }
          : prev
      );

      toast.success(isRTL ? "تم إنشاء سياق الذكاء الاصطناعي" : "AI context generated successfully", {
        description: isRTL ? "يمكنك الآن نسخ الرابط الآمن" : "You can now copy the secure API URL",
      });
    } catch (error: any) {
      toast.error(isRTL ? "فشل إنشاء سياق الذكاء الاصطناعي" : "Failed to generate AI context", {
        description: error?.message,
      });
    } finally {
      setContextGenerating(false);
    }
  };

  const getStatusBadge = () => {
    if (statusLoading) {
      return <Badge variant="secondary">{isRTL ? "جارٍ التحميل..." : "Loading..."}</Badge>;
    }

    switch (syncStatus) {
      case "running":
        return (
          <Badge className="gap-1 bg-blue-600 text-white hover:bg-blue-600">
            <RefreshCw size={12} className="animate-spin" />
            {isRTL ? "جاري النشر..." : "Deploying..."}
          </Badge>
        );
      case "success":
        return (
          <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
            <CheckCircle2 size={12} />
            {isRTL ? "نجحت العملية" : "Success"}
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle size={12} />
            {isRTL ? "فشلت العملية" : "Failed"}
          </Badge>
        );
      default:
        return status?.isDirty ? (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw size={12} />
            {isRTL ? "هناك تغييرات محلية" : "Local changes detected"}
          </Badge>
        ) : (
          <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
            <CheckCircle2 size={12} />
            {isRTL ? "المستودع نظيف" : "Repository clean"}
          </Badge>
        );
    }
  };

  const getLogColor = (type: LogType) => {
    switch (type) {
      case "success":
        return "text-emerald-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-amber-300";
      default:
        return "text-slate-300";
    }
  };

  const generatedAtLabel = useMemo(() => {
    if (!status?.latestContextGeneratedAt) return isRTL ? "لم يتم التوليد بعد" : "Not generated yet";
    return new Date(status.latestContextGeneratedAt).toLocaleString(isRTL ? "ar-EG" : "en-US");
  }, [status?.latestContextGeneratedAt, isRTL]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${tokens.primaryColor}, #111827)` }}
              >
                <Github size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {isRTL ? "لوحة المطورين" : "Developer Hub"}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? "إدارة النشر من GitHub، إعداد سياق الذكاء الاصطناعي، وربط Webhooks للمستودع."
                    : "Manage GitHub deployment, AI code context access, and repository webhooks."}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge()}
              {status?.branch ? (
                <Badge variant="outline" className="gap-1">
                  <Github size={12} />
                  {status.branch}@{status.shortSha}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Github size={18} className="text-foreground/80" />
                    <CardTitle>{deploymentTitle}</CardTitle>
                  </div>
                  <CardDescription>
                    {isRTL
                      ? "تشغيل مزامنة Git ثم بناء المشروع وإعادة تشغيل خدمة PM2 مع بث سجل مباشر."
                      : "Run git sync, build the project, and restart PM2 with live terminal streaming."}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {syncStatus === "running" ? (
                    <Button variant="destructive" onClick={cancelDeploy} className="gap-2">
                      <XCircle size={16} />
                      {isRTL ? "إلغاء" : "Cancel"}
                    </Button>
                  ) : (
                    <Button
                      onClick={startDeploy}
                      className="gap-2 text-white"
                      style={{ background: `linear-gradient(135deg, ${tokens.primaryColor}, #111827)` }}
                    >
                      <Play size={16} />
                      {isRTL ? "مزامنة ونشر إجباري" : "Force Sync & Deploy"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{isRTL ? "المسار الحالي" : "Repository Path"}</p>
                  <p className="mt-1 truncate text-sm font-medium">{status?.repoPath || "—"}</p>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{isRTL ? "آخر Commit" : "Latest Commit"}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium">{status?.lastCommit || "—"}</p>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{isRTL ? "آخر نشر" : "Last Deploy"}</p>
                  <p className="mt-1 text-sm font-medium">{lastDeployTime || (isRTL ? "لا يوجد" : "—")}</p>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{isRTL ? "حالة المستودع" : "Repository State"}</p>
                  <p className="mt-1 text-sm font-medium">
                    {statusLoading
                      ? isRTL
                        ? "جارٍ التحميل..."
                        : "Loading..."
                      : status?.isDirty
                        ? isRTL
                          ? "Dirty / غير متزامن"
                          : "Dirty / Unsynced"
                        : isRTL
                          ? "Clean / متزامن"
                          : "Clean / Synced"}
                  </p>
                </div>
              </div>

              {syncStatus !== "idle" ? (
                <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{currentStep || (isRTL ? "قيد التنفيذ..." : "Running...")}</span>
                    <span className="font-mono">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Terminal size={14} />
                    <span>{isRTL ? "سجل الطرفية المباشر" : "Live Terminal Output"}</span>
                  </div>
                  <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
                    {logs.length} {isRTL ? "سطر" : "lines"}
                  </Badge>
                </div>

                <div
                  ref={logContainerRef}
                  className="h-[320px] overflow-y-auto px-4 py-3 font-mono text-xs leading-6"
                >
                  {logs.length === 0 ? (
                    <div className="text-slate-500">
                      {isRTL
                        ? "اضغط على زر النشر لبدء بث السجل المباشر هنا."
                        : "Start deployment to stream live logs here."}
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={`${log.time}-${index}`} className={`flex gap-2 ${getLogColor(log.type)}`}>
                        <span className="select-none text-slate-500">[{log.time}]</span>
                        <span className="select-none">›</span>
                        <span className="break-all">{log.message}</span>
                      </div>
                    ))
                  )}
                  {syncStatus === "running" ? (
                    <div className="animate-pulse text-blue-400">
                      <span className="select-none text-slate-500">[{formatTime()}]</span> › ...
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-foreground/80" />
                <CardTitle>{aiTitle}</CardTitle>
              </div>
              <CardDescription>
                {isRTL
                  ? "التحكم في خادم MCP وتوليد ملف سياق موحّد يمكن إعطاؤه لأدوات الذكاء الاصطناعي بشكل آمن."
                  : "Control the MCP server and generate a single AI-ready code context file with secure access."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-2xl border bg-background p-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    {isRTL ? "تفعيل خادم MCP" : "Enable MCP Server"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isRTL
                      ? "يمنح أدوات الذكاء الاصطناعي قناة منظمة للوصول إلى السياق البرمجي المصرّح به."
                      : "Allows AI tools to consume authorized code context through a structured interface."}
                  </p>
                </div>
                <Switch checked={mcpEnabled} disabled={mcpSaving} onCheckedChange={saveMcpToggle} />
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">
                      {isRTL ? "توليد سياق الذكاء الاصطناعي (Repomix)" : "Generate AI Context (Repomix)"}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isRTL
                        ? "ينشئ ملفًا محدثًا من الكود لتغذيته لأدوات LLM أو مراجعات الذكاء الاصطناعي."
                        : "Creates an updated single-file context for LLM tools and AI code review workflows."}
                    </p>
                  </div>
                  <Button
                    onClick={generateContext}
                    disabled={contextGenerating}
                    variant="outline"
                    className="gap-2"
                  >
                    {contextGenerating ? <RefreshCw size={15} className="animate-spin" /> : <FileCode2 size={15} />}
                    {isRTL ? "توليد الآن" : "Generate Now"}
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{isRTL ? "آخر توليد" : "Last Generated"}</p>
                    <p className="mt-1 text-sm font-medium">{generatedAtLabel}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{isRTL ? "حالة MCP" : "MCP State"}</p>
                    <p className="mt-1 text-sm font-medium">
                      {mcpEnabled
                        ? isRTL
                          ? "مفعل"
                          : "Enabled"
                        : isRTL
                          ? "متوقف"
                          : "Disabled"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label>{isRTL ? "رابط API الآمن للذكاء الاصطناعي" : "Secure AI API URL"}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={status?.aiAccessUrl || ""} className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyText(status?.aiAccessUrl || "", isRTL ? "رابط API" : "API URL", "API URL")}
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isRTL
                      ? "استخدم هذا الرابط فقط مع الأدوات المصرّح بها، ويحتوي على مفتاح وصول خاص بالسياق."
                      : "Use this URL only with trusted AI tools. It includes a private access token for the packed code context."}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="flex items-start gap-2">
                    <ShieldCheck size={16} className="mt-0.5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-emerald-800 dark:text-emerald-300">
                        {isRTL ? "نصيحة أمنية" : "Security Tip"}
                      </p>
                      <p className="mt-1 text-emerald-700/90 dark:text-emerald-200/80">
                        {isRTL
                          ? "لا تشارك رابط API إلا مع أدوات موثوقة. يمكن تغيير المفاتيح من الخادم عند الحاجة."
                          : "Share the API URL only with trusted tools. Tokens can be rotated server-side whenever needed."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Webhook size={18} className="text-foreground/80" />
              <CardTitle>{webhooksTitle}</CardTitle>
            </div>
            <CardDescription>
              {isRTL
                ? "انسخ إعدادات Webhook الخاصة بـ GitHub لتمكين النشر التلقائي الآمن عند دفع التحديثات."
                : "Copy the GitHub webhook settings to enable secure auto-deploy on repository pushes."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>{isRTL ? "Webhook URL" : "Webhook URL"}</Label>
              <div className="flex gap-2">
                <Input readOnly value={status?.webhookUrl || ""} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyText(status?.webhookUrl || "", isRTL ? "رابط الـ Webhook" : "Webhook URL", "Webhook URL")}
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isRTL ? "Secret Key" : "Secret Key"}</Label>
              <div className="flex gap-2">
                <Input readOnly value={status?.webhookSecret || ""} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyText(status?.webhookSecret || "", isRTL ? "المفتاح السري" : "Secret Key", "Secret Key")}
                >
                  <Copy size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "الصق هذا المفتاح داخل إعدادات GitHub Webhook Secret لحماية عمليات النشر."
                  : "Paste this value into the GitHub webhook secret field to protect deployment events."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{isRTL ? "الأحداث المقترحة" : "Suggested Events"}</p>
                <p className="mt-1 text-sm font-medium">{isRTL ? "Push فقط" : "Push only"}</p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{isRTL ? "المستقبل" : "Receiver"}</p>
                <p className="mt-1 text-sm font-medium">GitHub → Tamiyouz CRM</p>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200/70 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                {isRTL ? "خطوات سريعة" : "Quick Steps"}
              </p>
              <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm text-blue-900/85 dark:text-blue-100/85">
                <li>{isRTL ? "افتح إعدادات المستودع في GitHub." : "Open your GitHub repository settings."}</li>
                <li>{isRTL ? "أضف Webhook جديدًا باستخدام الرابط أعلاه." : "Add a new webhook using the URL above."}</li>
                <li>{isRTL ? "اختر Content type = application/json." : "Choose Content type = application/json."}</li>
                <li>{isRTL ? "الصق المفتاح السري ثم فعّل أحداث Push." : "Paste the secret key and subscribe to push events."}</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

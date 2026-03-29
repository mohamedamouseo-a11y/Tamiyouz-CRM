import { useEffect, useRef, useState } from "react";
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
  ArrowUpCircle,
  Bot,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileCode2,
  Github,
  Key,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";

type LogType = "info" | "success" | "error" | "warning";
type LogEntry = { time: string; message: string; type: LogType };
type SyncStatus = "idle" | "running" | "success" | "error";
type DeveloperHubStatus = {
  repoPath: string;
  branch: string;
  shortSha: string;
  lastCommit: string;
  isDirty: boolean;
  unpushedCount: number;
  pushRunning: boolean;
  mcpEnabled: boolean;
  githubTokenSet: boolean;
  githubRepo: string;
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
  const [lastPushTime, setLastPushTime] = useState<string | null>(null);

  const [githubToken, setGithubToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenSaving, setTokenSaving] = useState(false);

  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpSaving, setMcpSaving] = useState(false);
  const [contextGenerating, setContextGenerating] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const githubSettingsTitle = isRTL ? "إعدادات GitHub" : "GitHub Settings";
  const pushTitle = isRTL ? "رفع الكود إلى GitHub" : "Push to GitHub";
  const aiTitle = isRTL ? "ربط الذكاء الاصطناعي" : "AI Integration";

  useEffect(() => { void loadStatus(); }, []);
  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [logs]);

  const addLog = (message: string, type: LogType = "info") => {
    setLogs((prev) => [...prev, { time: formatTime(), message, type }]);
  };

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await fetch("/api/developer-hub/status", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load status");
      const data: DeveloperHubStatus = await response.json();
      setStatus(data);
      setMcpEnabled(data.mcpEnabled);
    } catch {
      toast.error(isRTL ? "فشل تحميل حالة لوحة المطورين" : "Failed to load Developer Hub status");
    } finally {
      setStatusLoading(false);
    }
  };

  const copyText = (text: string, labelAr: string, labelEn: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(isRTL ? `تم نسخ ${labelAr}` : `${labelEn} copied`);
  };

  // ── Save GitHub Token ──────────────────────────────────────────────────────
  const saveGithubToken = async () => {
    if (!githubToken.trim()) {
      toast.error(isRTL ? "أدخل GitHub Token أولاً" : "Enter a GitHub Token first");
      return;
    }
    setTokenSaving(true);
    try {
      const response = await fetch("/api/developer-hub/github-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: githubToken.trim() }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to save token");
      }
      toast.success(isRTL ? "تم حفظ GitHub Token بنجاح" : "GitHub Token saved successfully");
      setGithubToken("");
      setShowToken(false);
      void loadStatus();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save token");
    } finally {
      setTokenSaving(false);
    }
  };

  // ── Push to GitHub ─────────────────────────────────────────────────────────
  const startPush = async () => {
    if (!status?.githubTokenSet) {
      toast.error(isRTL ? "يجب إعداد GitHub Token أولاً" : "Please set up GitHub Token first");
      return;
    }
    setSyncStatus("running");
    setProgress(0);
    setCurrentStep(isRTL ? "جاري تجهيز الرفع..." : "Preparing push...");
    setLogs([]);
    addLog(isRTL ? "بدء رفع الكود إلى GitHub..." : "Starting push to GitHub...", "info");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/push-to-github", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Push request failed" }));
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
              setCurrentStep(isRTL ? "تم رفع الكود إلى GitHub بنجاح" : "Code pushed to GitHub successfully");
              addLog(isRTL ? "تم رفع الكود إلى GitHub بنجاح" : "Code pushed to GitHub successfully", "success");
              setLastPushTime(new Date().toLocaleString(isRTL ? "ar-EG" : "en-US"));
              toast.success(isRTL ? "تم الرفع بنجاح" : "Push completed successfully");
              void loadStatus();
            } else if (data.type === "error") {
              setSyncStatus("error");
              setCurrentStep(isRTL ? `خطأ: ${data.messageAr || data.message}` : `Error: ${data.message || data.messageAr}`);
              addLog(isRTL ? data.messageAr || data.message : data.message || data.messageAr, "error");
              toast.error(isRTL ? "فشل الرفع" : "Push failed");
            }
          } catch {
            // Ignore malformed SSE line
          }
        }
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        setSyncStatus("idle");
        addLog(isRTL ? "تم إلغاء عملية الرفع" : "Push cancelled by user", "warning");
        toast.info(isRTL ? "تم إلغاء الرفع" : "Push cancelled");
      } else {
        setSyncStatus("error");
        setCurrentStep(isRTL ? `خطأ: ${error?.message}` : `Error: ${error?.message}`);
        addLog(error?.message || "Unknown error", "error");
        toast.error(isRTL ? "فشل الرفع" : "Push failed", { description: error?.message });
      }
    } finally {
      abortRef.current = null;
    }
  };

  const cancelPush = () => { abortRef.current?.abort(); };

  // ── MCP Toggle ─────────────────────────────────────────────────────────────
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
      if (!response.ok) throw new Error("Failed to update MCP state");
      setStatus((prev) => (prev ? { ...prev, mcpEnabled: checked } : prev));
      toast.success(
        isRTL
          ? checked ? "تم تفعيل خادم MCP" : "تم إيقاف خادم MCP"
          : checked ? "MCP server enabled" : "MCP server disabled"
      );
    } catch {
      setMcpEnabled(!checked);
      toast.error(isRTL ? "فشل تحديث حالة MCP" : "Failed to update MCP state");
    } finally {
      setMcpSaving(false);
    }
  };

  // ── Generate AI Context ────────────────────────────────────────────────────
  const generateContext = async () => {
    setContextGenerating(true);
    try {
      const response = await fetch("/api/ai/generate-context", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to generate context");
      const data = await response.json();
      toast.success(isRTL ? "تم توليد سياق AI بنجاح" : "AI context generated successfully");
      void loadStatus();
    } catch {
      toast.error(isRTL ? "فشل توليد سياق AI" : "Failed to generate AI context");
    } finally {
      setContextGenerating(false);
    }
  };

  function getLogColor(type: LogType) {
    switch (type) {
      case "success": return "text-emerald-400";
      case "error": return "text-red-400";
      case "warning": return "text-amber-400";
      default: return "text-slate-300";
    }
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Github size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{isRTL ? "لوحة المطورين" : "Developer Hub"}</h2>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? "إدارة رفع الكود إلى GitHub، إعداد سياق الذكاء الاصطناعي، وربط أدوات التطوير."
              : "Manage code push to GitHub, AI context setup, and developer tool integrations."}
          </p>
        </div>
        {status?.isDirty && (
          <Badge variant="outline" className="border-amber-500 text-amber-600">
            {isRTL ? "هناك تغييرات محلية" : "Local changes"}
          </Badge>
        )}
        {status && status.unpushedCount > 0 && (
          <Badge variant="outline" className="border-blue-500 text-blue-600">
            {status.unpushedCount} {isRTL ? "commit غير مرفوعة" : "unpushed commits"}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── GitHub Settings Card ──────────────────────────────────────────── */}
        <Card className="border-border/70">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Key size={18} className="text-foreground/80" />
              <CardTitle>{githubSettingsTitle}</CardTitle>
            </div>
            <CardDescription>
              {isRTL
                ? "أدخل GitHub Personal Access Token لتمكين رفع الكود مباشرة من السيرفر."
                : "Enter your GitHub Personal Access Token to enable pushing code directly from the server."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Token Status */}
            <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
              {status?.githubTokenSet ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {isRTL ? "Token مُعد ومفعّل" : "Token configured and active"}
                  </span>
                </>
              ) : (
                <>
                  <XCircle size={16} className="text-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    {isRTL ? "Token غير مُعد — يجب إدخاله أولاً" : "Token not set — required for push"}
                  </span>
                </>
              )}
            </div>

            {/* Token Input */}
            <div className="space-y-2">
              <Label>{isRTL ? "GitHub Personal Access Token" : "GitHub Personal Access Token"}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder={isRTL ? "ghp_xxxxxxxxxxxxxxxxxxxx" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="font-mono text-xs pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <Button
                  onClick={saveGithubToken}
                  disabled={tokenSaving || !githubToken.trim()}
                  className="gap-2"
                >
                  {tokenSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  {isRTL ? "حفظ" : "Save"}
                </Button>
              </div>
            </div>

            {/* How to get token - Steps */}
            <div className="rounded-xl border border-blue-200/70 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                {isRTL ? "كيف تحصل على Token؟" : "How to get a Token?"}
              </p>
              <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm text-blue-900/85 dark:text-blue-100/85">
                <li>{isRTL ? "افتح GitHub → Settings → Developer Settings" : "Go to GitHub → Settings → Developer Settings"}</li>
                <li>{isRTL ? "اختر Personal Access Tokens → Fine-grained tokens" : "Select Personal Access Tokens → Fine-grained tokens"}</li>
                <li>{isRTL ? "اضغط Generate new token" : "Click Generate new token"}</li>
                <li>{isRTL ? "اختر Repository access → Only select repositories → اختر الـ Repo" : "Choose Repository access → Only select repositories → Select your repo"}</li>
                <li>{isRTL ? "فعّل صلاحية Contents: Read and write" : "Enable Contents: Read and write permission"}</li>
                <li>{isRTL ? "انسخ الـ Token والصقه هنا" : "Copy the token and paste it here"}</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* ── Push to GitHub Card ───────────────────────────────────────────── */}
        <Card className="border-border/70">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpCircle size={18} className="text-foreground/80" />
                <CardTitle>{pushTitle}</CardTitle>
              </div>
              <div className="flex gap-2">
                {syncStatus === "running" ? (
                  <Button variant="destructive" onClick={cancelPush} className="gap-2" size="sm">
                    <XCircle size={16} />
                    {isRTL ? "إلغاء" : "Cancel"}
                  </Button>
                ) : (
                  <Button
                    onClick={startPush}
                    disabled={!status?.githubTokenSet}
                    className="gap-2 text-white"
                    size="sm"
                    style={{ background: status?.githubTokenSet ? `linear-gradient(135deg, ${tokens.primaryColor}, #111827)` : undefined }}
                  >
                    <Play size={16} />
                    {isRTL ? "رفع إلى GitHub" : "Push to GitHub"}
                  </Button>
                )}
              </div>
            </div>
            <CardDescription>
              {isRTL
                ? "رفع كل التغييرات من السيرفر إلى GitHub (git add → commit → push)."
                : "Push all changes from server to GitHub (git add → commit → push)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Git Info Cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">{isRTL ? "الفرع" : "Branch"}</p>
                <p className="mt-1 text-sm font-medium font-mono">{status?.branch || "—"}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">{isRTL ? "آخر Commit" : "Latest Commit"}</p>
                <p className="mt-1 line-clamp-1 text-sm font-medium">{status?.lastCommit || "—"}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">{isRTL ? "حالة المستودع" : "Repository State"}</p>
                <p className="mt-1 text-sm font-medium">
                  {statusLoading
                    ? isRTL ? "جارٍ التحميل..." : "Loading..."
                    : status?.isDirty
                      ? isRTL ? "يوجد تغييرات غير محفوظة" : "Uncommitted changes"
                      : isRTL ? "نظيف" : "Clean"}
                </p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">{isRTL ? "Commits غير مرفوعة" : "Unpushed Commits"}</p>
                <p className="mt-1 text-sm font-medium">
                  {statusLoading
                    ? "..."
                    : status?.unpushedCount
                      ? `${status.unpushedCount} commits`
                      : isRTL ? "الكل مرفوع" : "All pushed"}
                </p>
              </div>
            </div>

            {/* Progress */}
            {syncStatus !== "idle" && (
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{currentStep || (isRTL ? "قيد التنفيذ..." : "Running...")}</span>
                  <span className="font-mono">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Terminal */}
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
                className="h-[260px] overflow-y-auto px-4 py-3 font-mono text-xs leading-6"
              >
                {logs.length === 0 ? (
                  <div className="text-slate-500">
                    {isRTL
                      ? "اضغط على زر الرفع لبدء بث السجل المباشر هنا."
                      : "Click Push to GitHub to stream live logs here."}
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
              </div>
            </div>

            {/* Steps explanation */}
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/30">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {isRTL ? "خطوات الرفع:" : "Push Steps:"}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] px-1.5">1</Badge>
                <span>git add -A</span>
                <span className="text-muted-foreground/50">→</span>
                <Badge variant="outline" className="text-[10px] px-1.5">2</Badge>
                <span>git commit</span>
                <span className="text-muted-foreground/50">→</span>
                <Badge variant="outline" className="text-[10px] px-1.5">3</Badge>
                <span>git push origin main</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── AI Integration Card ─────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-foreground/80" />
              <CardTitle>{aiTitle}</CardTitle>
            </div>
            <CardDescription>
              {isRTL
                ? "إعداد سياق الذكاء الاصطناعي ليتمكن من قراءة كود المشروع."
                : "Set up AI context so AI tools can read your project code."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* MCP Toggle */}
            <div className="flex items-center justify-between rounded-xl border bg-background p-3">
              <div className="flex items-center gap-3">
                <FileCode2 size={18} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{isRTL ? "خادم MCP" : "MCP Server"}</p>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? "Model Context Protocol لأدوات AI" : "Model Context Protocol for AI tools"}
                  </p>
                </div>
              </div>
              <Switch
                checked={mcpEnabled}
                onCheckedChange={saveMcpToggle}
                disabled={mcpSaving}
              />
            </div>

            {/* Generate Context */}
            <div className="space-y-2">
              <Label>{isRTL ? "توليد سياق AI" : "Generate AI Context"}</Label>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "يجمع كل ملفات المشروع في ملف واحد يمكن لأدوات AI قراءته."
                  : "Packs all project files into a single file that AI tools can read."}
              </p>
              <Button
                onClick={generateContext}
                disabled={contextGenerating}
                variant="outline"
                className="gap-2"
              >
                {contextGenerating ? <RefreshCw size={16} className="animate-spin" /> : <FileCode2 size={16} />}
                {isRTL ? "توليد الآن" : "Generate Now"}
              </Button>
              {status?.latestContextGeneratedAt && (
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "آخر توليد: " : "Last generated: "}
                  {new Date(status.latestContextGeneratedAt).toLocaleString(isRTL ? "ar-EG" : "en-US")}
                </p>
              )}
            </div>

            {/* AI Access URL */}
            <div className="space-y-2">
              <Label>{isRTL ? "رابط API الآمن للذكاء الاصطناعي" : "Secure AI API URL"}</Label>
              <div className="flex gap-2">
                <Input readOnly value={status?.aiAccessUrl || ""} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyText(status?.aiAccessUrl || "", "رابط AI", "AI URL")}
                >
                  <Copy size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "استخدم هذا الرابط فقط مع أدوات AI الموثوقة."
                  : "Use this URL only with trusted AI tools."}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 text-emerald-600" />
                <div>
                  <p className="font-medium text-emerald-800 dark:text-emerald-300">
                    {isRTL ? "نصيحة أمنية" : "Security Tip"}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-200/80">
                    {isRTL
                      ? "لا تشارك رابط API إلا مع أدوات موثوقة. يمكن تغيير المفاتيح من الخادم عند الحاجة."
                      : "Share the API URL only with trusted tools. Tokens can be rotated server-side whenever needed."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── How to Use with AI Tools Card ──────────────────────────────────── */}
        <Card className="border-border/70">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-foreground/80" />
              <CardTitle>{isRTL ? "كيفية الاستخدام مع أدوات AI" : "How to Use with AI Tools"}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-blue-200/70 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                {isRTL ? "مع ChatGPT / Claude / Cursor:" : "With ChatGPT / Claude / Cursor:"}
              </p>
              <ol className="list-decimal space-y-2 ps-5 text-sm text-blue-900/85 dark:text-blue-100/85">
                <li>
                  {isRTL
                    ? "اضغط \"توليد الآن\" لإنشاء ملف سياق المشروع"
                    : "Click \"Generate Now\" to create the project context file"}
                </li>
                <li>
                  {isRTL
                    ? "انسخ رابط AI API من فوق"
                    : "Copy the AI API URL from above"}
                </li>
                <li>
                  {isRTL
                    ? "افتح الرابط في المتصفح لتحميل الملف"
                    : "Open the URL in your browser to download the file"}
                </li>
                <li>
                  {isRTL
                    ? "ارفع الملف في محادثة AI أو استخدمه كـ context"
                    : "Upload the file in your AI chat or use it as context"}
                </li>
              </ol>
            </div>
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                {isRTL ? "مع Manus AI:" : "With Manus AI:"}
              </p>
              <ol className="list-decimal space-y-2 ps-5 text-sm text-amber-900/85 dark:text-amber-100/85">
                <li>
                  {isRTL
                    ? "أعطِ Manus رابط AI API وهيقدر يقرا الكود مباشرة"
                    : "Give Manus the AI API URL and it can read the code directly"}
                </li>
                <li>
                  {isRTL
                    ? "أو ارفع ملف السياق في المحادثة"
                    : "Or upload the context file in the conversation"}
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

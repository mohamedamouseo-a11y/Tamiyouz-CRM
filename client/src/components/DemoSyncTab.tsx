import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { toast } from "sonner";
import { RefreshCw, Play, CheckCircle, XCircle, Clock, Terminal, AlertTriangle } from "lucide-react";

type LogEntry = {
  time: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
};

type SyncStatus = "idle" | "running" | "success" | "error";

export default function DemoSyncTab() {
  const { isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLogs((prev) => [...prev, { time, message, type }]);
  };

  const startSync = async () => {
    setStatus("running");
    setProgress(0);
    setCurrentStep("");
    setLogs([]);
    addLog(isRTL ? "بدء عملية المزامنة..." : "Starting sync process...", "info");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/demo-sync", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "progress") {
                setProgress(data.percent);
                setCurrentStep(isRTL ? data.stepAr : data.step);
                addLog(isRTL ? data.stepAr : data.step, "info");
              } else if (data.type === "log") {
                addLog(isRTL ? (data.messageAr || data.message) : data.message, data.level || "info");
              } else if (data.type === "done") {
                setProgress(100);
                setStatus("success");
                setCurrentStep(isRTL ? "اكتملت المزامنة بنجاح!" : "Sync completed successfully!");
                addLog(isRTL ? "اكتملت المزامنة بنجاح!" : "Sync completed successfully!", "success");
                setLastSyncTime(new Date().toLocaleString(isRTL ? "ar-EG" : "en-US"));
                toast.success(isRTL ? "تمت مزامنة الديمو بنجاح" : "Demo sync completed successfully");
              } else if (data.type === "error") {
                setStatus("error");
                setCurrentStep(isRTL ? `خطأ: ${data.messageAr || data.message}` : `Error: ${data.message}`);
                addLog(isRTL ? (data.messageAr || data.message) : data.message, "error");
                toast.error(isRTL ? "فشلت المزامنة" : "Sync failed");
              }
            } catch {
              // ignore malformed JSON
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setStatus("idle");
        addLog(isRTL ? "تم إلغاء المزامنة" : "Sync cancelled", "warning");
        toast.info(isRTL ? "تم إلغاء المزامنة" : "Sync cancelled");
      } else {
        setStatus("error");
        setCurrentStep(isRTL ? `خطأ: ${err.message}` : `Error: ${err.message}`);
        addLog(err.message, "error");
        toast.error(isRTL ? "فشلت المزامنة" : "Sync failed");
      }
    } finally {
      abortRef.current = null;
    }
  };

  const cancelSync = () => {
    abortRef.current?.abort();
  };

  const getStatusBadge = () => {
    switch (status) {
      case "idle":
        return <Badge variant="secondary" className="gap-1"><Clock size={12} />{isRTL ? "جاهز" : "Ready"}</Badge>;
      case "running":
        return <Badge className="gap-1 bg-blue-500 hover:bg-blue-600 text-white"><RefreshCw size={12} className="animate-spin" />{isRTL ? "جاري المزامنة..." : "Syncing..."}</Badge>;
      case "success":
        return <Badge className="gap-1 bg-green-500 hover:bg-green-600 text-white"><CheckCircle size={12} />{isRTL ? "نجحت" : "Success"}</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><XCircle size={12} />{isRTL ? "فشلت" : "Failed"}</Badge>;
    }
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "text-green-400";
      case "error": return "text-red-400";
      case "warning": return "text-yellow-400";
      default: return "text-gray-300";
    }
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "✓";
      case "error": return "✗";
      case "warning": return "⚠";
      default: return "›";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `linear-gradient(135deg, ${tokens.primaryColor}, ${tokens.primaryColor}dd)` }}>
                <RefreshCw size={20} className="text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {isRTL ? "مزامنة النسخة التجريبية" : "Demo Sync"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isRTL
                    ? "مزامنة الكود من النسخة الأساسية إلى النسخة التجريبية (بدون نقل البيانات)"
                    : "Sync code from main CRM to demo (no data transfer)"}
                </p>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync Steps Description */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              {isRTL ? "خطوات المزامنة:" : "Sync Steps:"}
            </h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside" dir={isRTL ? "rtl" : "ltr"}>
              <li>{isRTL ? "نسخ ملفات الكود (client, server, shared, drizzle)" : "Copy code files (client, server, shared, drizzle)"}</li>
              <li>{isRTL ? "تثبيت الحزم (npm install)" : "Install packages (npm install)"}</li>
              <li>{isRTL ? "مزامنة قاعدة البيانات (جداول جديدة فقط)" : "Sync database schema (new tables only)"}</li>
              <li>{isRTL ? "بناء المشروع (npm build)" : "Build project (npm build)"}</li>
              <li>{isRTL ? "إعادة تشغيل الخادم (pm2 restart)" : "Restart server (pm2 restart)"}</li>
            </ol>
            <p className="text-xs text-amber-600 mt-2 font-medium">
              {isRTL
                ? "⚠ لن يتم نقل أي بيانات (عملاء، صفقات، إلخ) - الكود فقط"
                : "⚠ No data (leads, deals, etc.) will be transferred - code only"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {status === "running" ? (
              <Button variant="destructive" onClick={cancelSync} className="gap-2">
                <XCircle size={16} />
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
            ) : (
              <Button
                onClick={startSync}
                disabled={status === "running"}
                className="gap-2 text-white"
                style={{ background: tokens.primaryColor }}
              >
                <Play size={16} />
                {isRTL ? "بدء المزامنة" : "Start Sync"}
              </Button>
            )}
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground">
                {isRTL ? `آخر مزامنة: ${lastSyncTime}` : `Last sync: ${lastSyncTime}`}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {status !== "idle" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{currentStep}</span>
                <span className="font-mono font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Viewer */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Terminal size={16} />
              <CardTitle className="text-sm">{isRTL ? "سجل العمليات" : "Sync Log"}</CardTitle>
              <Badge variant="outline" className="text-xs">{logs.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div
              ref={logContainerRef}
              className="rounded-lg bg-gray-950 p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-0.5"
              dir="ltr"
            >
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-2 ${getLogColor(log.type)}`}>
                  <span className="text-gray-500 select-none shrink-0">[{log.time}]</span>
                  <span className="select-none shrink-0">{getLogIcon(log.type)}</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))}
              {status === "running" && (
                <div className="text-blue-400 animate-pulse">
                  <span className="text-gray-500 select-none">[{new Date().toLocaleTimeString("en-GB", { hour12: false })}]</span>
                  {" › "}
                  <span>...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

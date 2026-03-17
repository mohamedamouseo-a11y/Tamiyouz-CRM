import CRMLayout from "@/components/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle, FileSpreadsheet, Upload, X, ArrowRight, Eye, Users, Sparkles } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

// CRM field definitions for mapping
const CRM_FIELDS = [
  { key: "skip", label: "Skip this column", labelAr: "تجاهل هذا العمود" },
  { key: "name", label: "Client Name", labelAr: "اسم العميل" },
  { key: "phone", label: "Phone", labelAr: "رقم الهاتف" },
  { key: "country", label: "Country", labelAr: "الدولة" },
  { key: "businessProfile", label: "Business Profile", labelAr: "نوع النشاط" },
  { key: "leadQuality", label: "Lead Quality", labelAr: "جودة العميل" },
  { key: "campaignName", label: "Campaign Name", labelAr: "اسم الحملة" },
  { key: "adCreative", label: "Ad Creative", labelAr: "الإعلان" },
  { key: "stage", label: "Stage", labelAr: "المرحلة" },
  { key: "notes", label: "Notes", labelAr: "ملاحظات" },
  { key: "serviceIntroduced", label: "Service Introduced", labelAr: "الخدمة المقدمة" },
  { key: "mediaBuyerNotes", label: "Media Buyer Notes", labelAr: "ملاحظات ميديا باير" },
  { key: "leadTime", label: "Lead Time", labelAr: "وقت العميل" },
  { key: "ownerName", label: "Sales Agent", labelAr: "المسؤول" },
];

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const patterns: Record<string, string[]> = {
    name: ["clientname", "name", "customername", "leadname", "fullname", "اسم", "العميل", "الاسم"],
    phone: ["phone", "mobile", "tel", "phonenumber", "mobilenumber", "رقم", "هاتف", "جوال", "موبايل"],
    country: ["country", "دولة", "البلد"],
    businessProfile: ["businesstype", "businessprofile", "industry", "sector", "نشاط", "قطاع", "نوع"],
    leadQuality: ["quality", "leadquality", "جودة", "نوعية"],
    campaignName: ["campaign", "campaignname", "حملة", "اسمالحملة"],
    adCreative: ["adcreative", "creative", "ad", "إعلان", "الإعلان"],
    stage: ["stage", "status", "مرحلة", "الحالة"],
    notes: ["notes", "comment", "remarks", "ملاحظات", "تعليق"],
    serviceIntroduced: ["service", "serviceintroduced", "خدمة", "الخدمة"],
    leadTime: ["leadtime", "time", "datetime", "date", "وقت", "تاريخ", "الوقت"],
    ownerName: ["agent", "salesagent", "owner", "assignedto", "assignee", "rep", "representative", "مسؤول", "المسؤول", "موظف", "مندوب"],
  };
  headers.forEach((header) => {
    const norm = normalize(header);
    for (const [field, keywords] of Object.entries(patterns)) {
      if (keywords.some((kw) => norm.includes(normalize(kw)))) {
        mapping[header] = field;
        break;
      }
    }
    if (!mapping[header]) mapping[header] = "skip";
  });
  return mapping;
}

function excelSerialToDate(serial: any): string | null {
  if (!serial) return null;
  if (serial instanceof Date) return !isNaN(serial.getTime()) ? serial.toISOString() : null;
  if (typeof serial === "string") {
    const s = serial.trim();
    if (!s) return null;
    const timeMatch = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      const now = new Date();
      now.setHours(hours, minutes, 0, 0);
      return now.toISOString();
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
  }
  if (typeof serial === "number") {
    if (serial < 1) {
      const totalMinutes = Math.round(serial * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const now = new Date();
      now.setHours(hours, minutes, 0, 0);
      return now.toISOString();
    }
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + serial * 86400000);
    return !isNaN(d.getTime()) ? d.toISOString() : null;
  }
  return null;
}

const STEPS = ["upload", "map", "preview", "done"] as const;
type Step = typeof STEPS[number];

const STEP_ICONS = [Upload, Sparkles, Eye, CheckCircle];

export default function ImportLeads() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{ created: number; duplicates: number } | null>(null);

  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: agents } = trpc.users.list.useQuery();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [useRoundRobin, setUseRoundRobin] = useState(false);

  const importMutation = trpc.leads.import.useMutation({
    onSuccess: (result: { created: number; duplicates: number }) => {
      setImportResult(result);
      setStep("done");
      toast.success(isRTL ? `تم استيراد ${result.created} عميل` : `Imported ${result.created} leads`);
    },
    onError: (e) => toast.error(e.message),
  });

  const parseExcel = async (file: File) => {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
    if (data.length === 0) { toast.error(isRTL ? "الملف فارغ" : "File is empty"); return; }
    const hdrs = Object.keys(data[0]);
    setHeaders(hdrs);
    setRows(data);
    setMapping(autoDetectMapping(hdrs));
    setFileName(file.name);
    setStep("map");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) parseExcel(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv"))) {
      parseExcel(file);
    } else {
      toast.error(isRTL ? "يرجى رفع ملف Excel أو CSV" : "Please upload an Excel or CSV file");
    }
  }, [isRTL]);

  const handleImport = () => {
    const leadsData = rows.map((row) => {
      const lead: Record<string, any> = {};
      for (const [header, field] of Object.entries(mapping)) {
        if (field !== "skip" && row[header] !== undefined && row[header] !== "") {
          if (field === "leadTime") {
            const converted = excelSerialToDate(row[header]);
            if (converted) lead[field] = converted;
          } else {
            lead[field] = String(row[header]).trim();
          }
        }
      }
      if (selectedCampaign && selectedCampaign !== "none") lead.campaignName = selectedCampaign;
      return lead;
    }).filter((l) => l.phone || l.name);

    importMutation.mutate({ leads: leadsData, ownerId: selectedAgent ? Number(selectedAgent) : undefined, useRoundRobin });
  };

  const mappedFields = Object.values(mapping).filter((v) => v !== "skip");
  const hasPhone = mappedFields.includes("phone");
  const hasName = mappedFields.includes("name");
  const currentStepIdx = STEPS.indexOf(step);

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 p-2.5 shadow-md">
            <FileSpreadsheet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{t("importLeads")}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isRTL ? "استيراد العملاء من ملف Excel مع ربط الأعمدة تلقائياً" : "Import leads from Excel with automatic column mapping"}
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const StepIcon = STEP_ICONS[i];
            const isActive = step === s;
            const isDone = currentStepIdx > i;
            const stepLabels = {
              upload: isRTL ? "رفع الملف" : "Upload",
              map: isRTL ? "ربط الأعمدة" : "Map Columns",
              preview: isRTL ? "معاينة" : "Preview",
              done: isRTL ? "اكتمل" : "Done",
            };
            return (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all flex-1 ${
                  isActive ? "bg-violet-600 shadow-md shadow-violet-200" : isDone ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"
                }`}>
                  <div className={`rounded-lg p-1 ${isActive ? "bg-white/20" : isDone ? "bg-emerald-100" : "bg-slate-200"}`}>
                    {isDone ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <StepIcon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${isActive ? "text-white" : isDone ? "text-emerald-700" : "text-slate-400"}`}>
                    {stepLabels[s]}
                  </span>
                </div>
                {i < 3 && <div className={`h-px w-4 shrink-0 ${currentStepIdx > i ? "bg-emerald-300" : "bg-slate-200"}`} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <div className="rounded-lg bg-violet-50 p-1.5">
                <Upload className="h-4 w-4 text-violet-600" />
              </div>
              <h2 className="text-base font-semibold text-slate-800">
                {isRTL ? "رفع الملف" : "Upload File"}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer group ${
                  isDragging
                    ? "border-violet-400 bg-violet-50"
                    : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={`mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                  isDragging ? "bg-violet-100" : "bg-slate-100 group-hover:bg-violet-100"
                }`}>
                  <FileSpreadsheet className={`h-8 w-8 transition-colors ${isDragging ? "text-violet-600" : "text-slate-400 group-hover:text-violet-500"}`} />
                </div>
                <p className="text-base font-semibold text-slate-700 mb-1">
                  {isRTL ? "اسحب وأفلت ملف Excel هنا" : "Drag & drop your Excel file here"}
                </p>
                <p className="text-sm text-slate-400 mb-3">
                  {isRTL ? "أو انقر للاختيار" : "or click to browse"}
                </p>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 font-medium">
                  .xlsx · .xls · .csv
                </span>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs font-semibold text-slate-600 mb-2.5">
                  {isRTL ? "الأعمدة المدعومة:" : "Supported columns:"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Client Name", "Phone", "Country", "Business Type", "Lead Quality", "Campaign Name", "Ad Creative", "Stage", "Notes", "Lead Time", "Sales Agent"].map((col) => (
                    <span key={col} className="inline-flex items-center rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs text-slate-600 font-medium shadow-sm">
                      {col}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2.5">
                  {isRTL ? "سيتم اكتشاف الأعمدة تلقائياً" : "Columns will be auto-detected and you can adjust manually"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "map" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-violet-50 p-1.5">
                    <Sparkles className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">
                      {isRTL ? "ربط الأعمدة" : "Map Columns"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">{fileName}</p>
                  </div>
                </div>
                <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                  {headers.length} {isRTL ? "عمود" : "columns"}
                </Badge>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {headers.map((header) => (
                    <div key={header} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-violet-200 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{header}</p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {String(rows[0]?.[header] ?? "").slice(0, 30) || "—"}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      <div className="w-44 shrink-0">
                        <Select value={mapping[header] ?? "skip"} onValueChange={(v) => setMapping((m) => ({ ...m, [header]: v }))}>
                          <SelectTrigger className="h-8 text-xs border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CRM_FIELDS.map((f) => (
                              <SelectItem key={f.key} value={f.key} className="text-xs">
                                {isRTL ? f.labelAr : f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
                {(!hasPhone && !hasName) && (
                  <div className="mt-4 flex items-start gap-2.5 p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 font-medium">
                      {isRTL ? "يرجى ربط عمود الهاتف أو الاسم على الأقل" : "Please map at least a Phone or Name column"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Assignment Options */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
                <div className="rounded-lg bg-violet-50 p-1.5">
                  <Users className="h-4 w-4 text-violet-600" />
                </div>
                <h2 className="text-base font-semibold text-slate-800">
                  {isRTL ? "إعدادات التوزيع" : "Assignment Settings"}
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      {isRTL ? "الحملة الإعلانية" : "Campaign"}
                    </label>
                    <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                      <SelectTrigger className="h-9 text-sm border-slate-200">
                        <SelectValue placeholder={isRTL ? "اختر حملة..." : "Select campaign..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-sm">{isRTL ? "بدون حملة" : "No campaign"}</SelectItem>
                        {(campaigns ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.name} className="text-sm">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      {isRTL ? "توزيع العملاء" : "Lead Assignment"}
                    </label>
                    <Select
                      value={useRoundRobin ? "roundrobin" : selectedAgent || "none"}
                      onValueChange={(v) => {
                        if (v === "roundrobin") { setUseRoundRobin(true); setSelectedAgent(""); }
                        else { setUseRoundRobin(false); setSelectedAgent(v === "none" ? "" : v); }
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm border-slate-200">
                        <SelectValue placeholder={isRTL ? "اختر طريقة التوزيع..." : "Select assignment..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-sm">{isRTL ? "بدون توزيع" : "No assignment"}</SelectItem>
                        <SelectItem value="roundrobin" className="text-sm">🔄 {isRTL ? "توزيع دوري تلقائي" : "Round-robin (auto)"}</SelectItem>
                        {(agents ?? []).filter((u) => u.role === "SalesAgent").map((u) => (
                          <SelectItem key={u.id} value={String(u.id)} className="text-sm">{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")} className="rounded-xl">{t("cancel")}</Button>
              <Button
                onClick={() => setStep("preview")}
                style={{ background: tokens.primaryColor }}
                className="text-white gap-2 rounded-xl"
                disabled={!hasPhone && !hasName}
              >
                {isRTL ? "معاينة البيانات" : "Preview Data"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-violet-50 p-1.5">
                    <Eye className="h-4 w-4 text-violet-600" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-800">
                    {isRTL ? `معاينة ${rows.length} سجل` : `Preview ${rows.length} records`}
                  </h2>
                </div>
                <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                  {isRTL ? `${rows.length} عميل` : `${rows.length} leads`}
                </Badge>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                    <tr>
                      {Object.entries(mapping).filter(([, v]) => v !== "skip").map(([header, field]) => (
                        <th key={header} className="text-start px-4 py-2.5 font-semibold text-slate-500 whitespace-nowrap uppercase tracking-wide text-[10px]">
                          {CRM_FIELDS.find((f) => f.key === field)?.[isRTL ? "labelAr" : "label"] ?? field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        {Object.entries(mapping).filter(([, v]) => v !== "skip").map(([header, field]) => {
                          let val = row[header];
                          if (field === "leadTime") {
                            const converted = excelSerialToDate(val);
                            val = converted ? new Date(converted).toLocaleString(isRTL ? "ar-SA" : "en-US") : "—";
                          }
                          return (
                            <td key={header} className="px-4 py-2.5 text-slate-600 whitespace-nowrap max-w-32 truncate">{val ?? "—"}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <p className="text-center text-xs text-slate-400 py-3 border-t border-slate-100">
                    {isRTL ? `... و ${rows.length - 50} سجل آخر` : `... and ${rows.length - 50} more records`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="rounded-lg bg-blue-100 p-1 shrink-0 mt-0.5">
                <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <p className="text-xs text-blue-700 font-medium">
                {isRTL
                  ? `سيتم استيراد ${rows.length} عميل. سيتم تطبيع أرقام الهواتف إلى صيغة +966 تلقائياً. سيتم اكتشاف التكرارات بناءً على رقم الهاتف.`
                  : `${rows.length} leads will be imported. Phone numbers will be normalized automatically. Duplicates detected by phone number.`}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("map")} className="rounded-xl">{t("back")}</Button>
              <Button
                onClick={handleImport}
                style={{ background: tokens.primaryColor }}
                className="text-white gap-2 rounded-xl"
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t("loading")}</>
                ) : (
                  <><Upload className="h-4 w-4" /> {isRTL ? "بدء الاستيراد" : "Start Import"}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && importResult && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-10 text-center">
              <div className="mx-auto mb-5 w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-1">
                {isRTL ? "تم الاستيراد بنجاح!" : "Import Complete!"}
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                {isRTL ? "تم معالجة الملف بنجاح" : "Your file has been processed successfully"}
              </p>
              <div className="flex justify-center gap-6 mb-8">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-8 py-4 text-center">
                  <div className="text-4xl font-bold text-emerald-600">{importResult.created}</div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">{isRTL ? "عملاء جدد" : "New leads"}</div>
                </div>
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-8 py-4 text-center">
                  <div className="text-4xl font-bold text-amber-600">{importResult.duplicates}</div>
                  <div className="text-xs text-amber-600 font-medium mt-1">{isRTL ? "تكرارات" : "Duplicates"}</div>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => { setStep("upload"); setRows([]); setHeaders([]); setMapping({}); setImportResult(null); }}
                >
                  {isRTL ? "استيراد ملف آخر" : "Import another file"}
                </Button>
                <Button
                  style={{ background: tokens.primaryColor }}
                  className="text-white rounded-xl gap-2"
                  onClick={() => window.location.href = "/leads"}
                >
                  <Users className="h-4 w-4" />
                  {isRTL ? "عرض العملاء" : "View Leads"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CRMLayout>
  );
}

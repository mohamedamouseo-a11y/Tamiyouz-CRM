import CRMLayout from "@/components/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle, FileSpreadsheet, Upload, X } from "lucide-react";
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

// Auto-detect mapping from common column names
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

// Convert Excel serial date/time number to a proper ISO date string
function excelSerialToDate(serial: any): string | null {
  if (!serial) return null;
  
  // If it's already a Date object (some parsers do this)
  if (serial instanceof Date) {
    return !isNaN(serial.getTime()) ? serial.toISOString() : null;
  }

  if (typeof serial === "string") {
    const s = serial.trim();
    if (!s) return null;

    // Handle "HH:MMam/pm" format
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

    // Try direct Date parse
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
    
    // Try parsing common Arabic/Excel formats if needed
    return null;
  }

  if (typeof serial === "number") {
    if (serial < 1) {
      // Time-only value (fraction of a day): 0.5 = 12:00 noon
      const totalMinutes = Math.round(serial * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const now = new Date();
      now.setHours(hours, minutes, 0, 0);
      return now.toISOString();
    }
    // Full Excel serial date (days since 1899-12-30)
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + serial * 86400000);
    return !isNaN(d.getTime()) ? d.toISOString() : null;
  }
  
  return null;
}

export default function ImportLeads() {
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
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

    if (data.length === 0) {
      toast.error(isRTL ? "الملف فارغ" : "File is empty");
      return;
    }

    const hdrs = Object.keys(data[0]);
    setHeaders(hdrs);
    setRows(data); // Store all rows
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
    // Build lead records from rows + mapping
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

    importMutation.mutate({
      leads: leadsData,
      ownerId: selectedAgent ? Number(selectedAgent) : undefined,
      useRoundRobin,
    });
  };

  const mappedFields = Object.values(mapping).filter((v) => v !== "skip");
  const hasPhone = mappedFields.includes("phone");
  const hasName = mappedFields.includes("name");

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("importLeads")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isRTL
              ? "استيراد العملاء من ملف Excel مع ربط الأعمدة تلقائياً"
              : "Import leads from Excel with automatic column mapping"}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2">
          {[
            { key: "upload", label: isRTL ? "رفع الملف" : "Upload" },
            { key: "map", label: isRTL ? "ربط الأعمدة" : "Map Columns" },
            { key: "preview", label: isRTL ? "معاينة" : "Preview" },
            { key: "done", label: isRTL ? "اكتمل" : "Done" },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s.key
                    ? "text-white"
                    : ["map", "preview", "done"].indexOf(step) > ["upload", "map", "preview", "done"].indexOf(s.key)
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
                }`}
                style={step === s.key ? { background: tokens.primaryColor } : {}}
              >
                {["map", "preview", "done"].indexOf(step) > ["upload", "map", "preview", "done"].indexOf(s.key) ? (
                  <CheckCircle size={14} />
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-xs font-medium ${step === s.key ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
              {i < 3 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <Card>
            <CardContent className="p-8">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-semibold text-foreground mb-2">
                  {isRTL ? "اسحب وأفلت ملف Excel هنا" : "Drag & drop your Excel file here"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {isRTL ? "أو انقر للاختيار" : "or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "يدعم: .xlsx, .xls, .csv" : "Supports: .xlsx, .xls, .csv"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <p className="text-xs font-medium text-foreground mb-2">
                  {isRTL ? "الأعمدة المدعومة في ملفك:" : "Supported columns in your file:"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Client Name", "Phone", "Country", "Business Type", "Lead Quality", "Campaign Name", "Ad Creative", "Stage", "Notes", "Lead Time", "Sales Agent"].map((col) => (
                    <Badge key={col} variant="secondary" className="text-xs">{col}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {isRTL
                    ? "سيتم اكتشاف الأعمدة تلقائياً ويمكنك تعديل الربط يدوياً"
                    : "Columns will be auto-detected and you can adjust the mapping manually"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Column Mapping */}
        {step === "map" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  {isRTL ? `ربط أعمدة "${fileName}"` : `Map columns from "${fileName}"`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {headers.map((header) => (
                    <div key={header} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{header}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {isRTL ? "مثال: " : "e.g.: "}{String(rows[0]?.[header] ?? "").slice(0, 30)}
                        </p>
                      </div>
                      <div className="w-44 shrink-0">
                        <Select
                          value={mapping[header] ?? "skip"}
                          onValueChange={(v) => setMapping((m) => ({ ...m, [header]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
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
                  <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      {isRTL
                        ? "يرجى ربط عمود الهاتف أو الاسم على الأقل"
                        : "Please map at least a Phone or Name column"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assignment Options */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  {isRTL ? "إعدادات التوزيع" : "Assignment Settings"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {isRTL ? "الحملة الإعلانية" : "Campaign"}
                    </label>
                    <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={isRTL ? "اختر حملة..." : "Select campaign..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">{isRTL ? "بدون حملة" : "No campaign"}</SelectItem>
                        {(campaigns ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.name} className="text-xs">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {isRTL ? "توزيع العملاء" : "Lead Assignment"}
                    </label>
                    <Select
                      value={useRoundRobin ? "roundrobin" : selectedAgent || "none"}
                      onValueChange={(v) => {
                        if (v === "roundrobin") {
                          setUseRoundRobin(true);
                          setSelectedAgent("");
                        } else {
                          setUseRoundRobin(false);
                          setSelectedAgent(v === "none" ? "" : v);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={isRTL ? "اختر طريقة التوزيع..." : "Select assignment..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">{isRTL ? "بدون توزيع" : "No assignment"}</SelectItem>
                        <SelectItem value="roundrobin" className="text-xs">
                          🔄 {isRTL ? "توزيع دوري تلقائي" : "Round-robin (auto)"}
                        </SelectItem>
                        {(agents ?? []).filter((u) => u.role === "SalesAgent").map((u) => (
                          <SelectItem key={u.id} value={String(u.id)} className="text-xs">{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>{t("cancel")}</Button>
              <Button
                onClick={() => setStep("preview")}
                style={{ background: tokens.primaryColor }}
                className="text-white gap-2"
                disabled={!hasPhone && !hasName}
              >
                {isRTL ? "معاينة البيانات" : "Preview Data"} →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    {isRTL ? `معاينة ${rows.length} سجل` : `Preview ${rows.length} records`}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {isRTL ? `${rows.length} عميل` : `${rows.length} leads`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr>
                        {Object.entries(mapping)
                          .filter(([, v]) => v !== "skip")
                          .map(([header, field]) => (
                            <th key={header} className="text-start px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                              {CRM_FIELDS.find((f) => f.key === field)?.[isRTL ? "labelAr" : "label"] ?? field}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-b border-border hover:bg-muted/20">
                          {Object.entries(mapping)
                            .filter(([, v]) => v !== "skip")
                            .map(([header, field]) => {
                              let val = row[header];
                              if (field === "leadTime") {
                                const converted = excelSerialToDate(val);
                                val = converted ? new Date(converted).toLocaleString(isRTL ? "ar-SA" : "en-US") : "—";
                              }
                              return (
                                <td key={header} className="px-3 py-2 text-foreground whitespace-nowrap max-w-32 truncate">
                                  {val ?? "—"}
                                </td>
                              );
                            })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 50 && (
                    <p className="text-center text-xs text-muted-foreground py-3">
                      {isRTL ? `... و ${rows.length - 50} سجل آخر` : `... and ${rows.length - 50} more records`}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                {isRTL
                  ? `سيتم استيراد ${rows.length} عميل. سيتم تطبيع أرقام الهواتف إلى صيغة +966 تلقائياً. سيتم اكتشاف التكرارات بناءً على رقم الهاتف.`
                  : `${rows.length} leads will be imported. Phone numbers will be normalized to +966 format. Duplicates will be detected by phone number.`}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("map")}>{t("back")}</Button>
              <Button
                onClick={handleImport}
                style={{ background: tokens.primaryColor }}
                className="text-white gap-2"
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t("loading")}</>
                ) : (
                  isRTL ? "بدء الاستيراد" : "Start Import"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && importResult && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                {isRTL ? "تم الاستيراد بنجاح!" : "Import Complete!"}
              </h2>
              <div className="flex justify-center gap-8 mt-4 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{importResult.created}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? "عملاء جدد" : "New leads"}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-500">{importResult.duplicates}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isRTL ? "تكرارات" : "Duplicates"}</div>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => { setStep("upload"); setRows([]); setHeaders([]); setMapping({}); setImportResult(null); }}
                >
                  {isRTL ? "استيراد ملف آخر" : "Import another file"}
                </Button>
                <Button
                  style={{ background: tokens.primaryColor }}
                  className="text-white"
                  onClick={() => window.location.href = "/leads"}
                >
                  {isRTL ? "عرض العملاء" : "View Leads"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </CRMLayout>
  );
}

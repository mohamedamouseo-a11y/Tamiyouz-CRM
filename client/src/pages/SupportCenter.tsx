import * as React from "react";

import { useAuth } from "@/_core/hooks/useAuth";
import CRMLayout from "@/components/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ExternalLink, Image as ImageIcon, Inbox, LifeBuoy, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type RequestType = "Ticket" | "Suggestion";
type RequestCategory = "Bug" | "Complaint" | "Access" | "Data" | "Feature" | "Improvement" | "Other";
type RequestPriority = "Low" | "Medium" | "High";
type RequestStatus = "New" | "UnderReview" | "WaitingUser" | "Resolved" | "Closed" | "Rejected";

type ScreenshotPayload = {
  fileName: string;
  contentType: string;
  fileBase64: string;
};

type SupportRequestLike = {
  id: number;
  code?: string | null;
  requestType: RequestType;
  category: RequestCategory;
  subject: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  screenRecordingLink?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  lastActivityAt?: string | Date | null;
};

const SUPPORT_REQUEST_TYPES: RequestType[] = ["Ticket", "Suggestion"];
const SUPPORT_CATEGORIES: RequestCategory[] = ["Bug", "Complaint", "Access", "Data", "Feature", "Improvement", "Other"];
const SUPPORT_PRIORITIES: RequestPriority[] = ["Low", "Medium", "High"];
const FILTER_STATUSES: Array<RequestStatus | "all"> = ["all", "New", "UnderReview", "WaitingUser", "Resolved", "Closed", "Rejected"];
const FILTER_TYPES: Array<RequestType | "all"> = ["all", "Ticket", "Suggestion"];
const PRIMARY_SUPER_ADMIN_EMAIL = "admin@tamiyouz.com";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const statusClassMap: Record<RequestStatus, string> = {
  New: "border-blue-200 bg-blue-50 text-blue-700",
  UnderReview: "border-amber-200 bg-amber-50 text-amber-700",
  WaitingUser: "border-purple-200 bg-purple-50 text-purple-700",
  Resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Closed: "border-slate-200 bg-slate-50 text-slate-700",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

const priorityClassMap: Record<RequestPriority, string> = {
  Low: "border-slate-200 bg-slate-50 text-slate-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  High: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDateTime(value?: string | Date | null, lang: "ar" | "en" = "en") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusBadgeClass(status: RequestStatus) {
  return statusClassMap[status] ?? "border-slate-200 bg-slate-50 text-slate-700";
}

function getPriorityBadgeClass(priority: RequestPriority) {
  return priorityClassMap[priority] ?? "border-slate-200 bg-slate-50 text-slate-700";
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function SupportCenter() {
  const { user } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils() as any;
  const supportCenter = (trpc as any).supportCenter;
  const isSuperAdmin = String(user?.email ?? "").toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;

  const [open, setOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<RequestStatus | "all">("all");
  const [typeFilter, setTypeFilter] = React.useState<RequestType | "all">("all");
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    requestType: "Ticket" as RequestType,
    category: "Bug" as RequestCategory,
    priority: "Medium" as RequestPriority,
    subject: "",
    description: "",
    screenRecordingLink: "",
  });
  const [files, setFiles] = React.useState<File[]>([]);

  const queryInput = React.useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      requestType: typeFilter === "all" ? undefined : typeFilter,
    }),
    [statusFilter, typeFilter]
  );

  const requestsQuery = supportCenter.myRequests.useQuery(queryInput, {
    refetchOnWindowFocus: true,
  });

  const createMutation = supportCenter.create.useMutation({
    onSuccess: async (result: { code?: string }) => {
      toast.success(isRTL ? "تم إرسال الطلب بنجاح" : "Request submitted successfully");
      setOpen(false);
      setFiles([]);
      setForm({
        requestType: "Ticket",
        category: "Bug",
        priority: "Medium",
        subject: "",
        description: "",
        screenRecordingLink: "",
      });
      await utils.supportCenter?.myRequests.invalidate?.();
      if (result?.code) {
        toast.success(`${isRTL ? "رقم الطلب" : "Request code"}: ${result.code}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const requests = React.useMemo<SupportRequestLike[]>(() => {
    const raw = requestsQuery.data;
    return Array.isArray(raw) ? (raw as SupportRequestLike[]) : [];
  }, [requestsQuery.data]);

  const stats = React.useMemo(() => {
    const total = requests.length;
    const openItems = requests.filter((request) => ["New", "UnderReview", "WaitingUser"].includes(request.status)).length;
    const resolved = requests.filter((request) => ["Resolved", "Closed"].includes(request.status)).length;
    const suggestions = requests.filter((request) => request.requestType === "Suggestion").length;
    return { total, openItems, resolved, suggestions };
  }, [requests]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;

    const imageOnly = selected.filter((file) => file.type.startsWith("image/"));
    if (imageOnly.length !== selected.length) {
      toast.error(isRTL ? "يُسمح فقط برفع الصور" : "Only image files are allowed");
    }

    const oversized = imageOnly.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      toast.error(isRTL ? "الحد الأقصى للصورة الواحدة 5MB" : "Each screenshot must be 5MB or less");
      return;
    }

    const next = [...files, ...imageOnly].slice(0, MAX_FILES);
    if (files.length + imageOnly.length > MAX_FILES) {
      toast.error(isRTL ? "الحد الأقصى 5 صور" : "You can upload up to 5 screenshots only");
    }
    setFiles(next);
    event.target.value = "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.subject.trim().length < 3) {
      toast.error(isRTL ? "العنوان قصير جدًا" : "Subject is too short");
      return;
    }
    if (form.description.trim().length < 10) {
      toast.error(isRTL ? "الوصف يجب أن يكون أوضح" : "Description must be at least 10 characters");
      return;
    }

    setSubmitting(true);
    try {
      const screenshots: ScreenshotPayload[] = await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          contentType: file.type || "image/png",
          fileBase64: await fileToBase64(file),
        }))
      );

      await createMutation.mutateAsync({
        requestType: form.requestType,
        category: form.category,
        priority: form.priority,
        subject: form.subject.trim(),
        description: form.description.trim(),
        screenRecordingLink: form.screenRecordingLink.trim() || undefined,
        screenshots,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : isRTL ? "تعذر إرسال الطلب" : "Failed to submit request";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CRMLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <LifeBuoy size={14} />
              <span>{t("supportCenterSubtitle")}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("supportCenter")}</h1>
              <p className="text-sm text-muted-foreground">{t("supportCenterDescription")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && (
              <Link href="/support-center/admin">
                <Button variant="outline" className="gap-2">
                  <Inbox size={16} />
                  {t("supportAdmin")}
                </Button>
              </Link>
            )}
            <Button className="gap-2" onClick={() => setOpen(true)}>
              <Plus size={16} />
              {t("newRequest")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t("totalRequests")}</p>
              <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t("openRequests")}</p>
              <p className="mt-2 text-3xl font-semibold">{stats.openItems}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t("resolvedRequests")}</p>
              <p className="mt-2 text-3xl font-semibold">{stats.resolved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{t("suggestions")}</p>
              <p className="mt-2 text-3xl font-semibold">{stats.suggestions}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{t("myRequests")}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{t("supportCenterTableHint")}</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as RequestType | "all")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("requestType")} />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "all" ? t("allTypes") : t(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as RequestStatus | "all")}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("status")} />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "all" ? t("allStatuses") : t(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {requestsQuery.isLoading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-8 text-center">
                <div className="rounded-full bg-primary/10 p-3 text-primary">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="font-medium">{t("noSupportRequestsYet")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("createYourFirstRequest")}</p>
                </div>
                <Button onClick={() => setOpen(true)}>{t("newRequest")}</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("requestId")}</TableHead>
                    <TableHead>{t("requestType")}</TableHead>
                    <TableHead>{t("subject")}</TableHead>
                    <TableHead>{t("priority")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("lastUpdate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow
                      key={request.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/support-center/${request.id}`)}
                    >
                      <TableCell className="font-medium">{request.code || `#${request.id}`}</TableCell>
                      <TableCell>{t(request.requestType)}</TableCell>
                      <TableCell>
                        <div className="max-w-[280px] truncate">{request.subject}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getPriorityBadgeClass(request.priority)}>
                          {t(request.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadgeClass(request.status)}>
                          {t(request.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(request.lastActivityAt || request.updatedAt || request.createdAt, lang)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("newRequest")}</DialogTitle>
            <DialogDescription>{t("supportRequestDialogDescription")}</DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="requestType">{t("requestType")}</Label>
                <Select value={form.requestType} onValueChange={(value) => setForm((prev) => ({ ...prev, requestType: value as RequestType }))}>
                  <SelectTrigger id="requestType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_REQUEST_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {t(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t("category")}</Label>
                <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as RequestCategory }))}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {t(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">{t("priority")}</Label>
                <Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as RequestPriority }))}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_PRIORITIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {t(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">{t("subject")}</Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder={t("supportSubjectPlaceholder")}
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("description")}</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder={t("supportDescriptionPlaceholder")}
                className="min-h-[140px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="screenRecordingLink">{t("screenRecordingLink")}</Label>
              <Input
                id="screenRecordingLink"
                type="url"
                value={form.screenRecordingLink}
                onChange={(event) => setForm((prev) => ({ ...prev, screenRecordingLink: event.target.value }))}
                placeholder="https://loom.com/..."
              />
              <p className="text-xs text-muted-foreground">{t("screenRecordingLinkHint")}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label htmlFor="screenshots">{t("screenshots")}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{t("screenshotsHint")}</p>
                </div>
                <Badge variant="outline">{files.length}/{MAX_FILES}</Badge>
              </div>

              <Input id="screenshots" type="file" accept="image/*" multiple onChange={handleFileChange} />

              {files.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <ImageIcon size={16} className="shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                      >
                        {t("remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>{t("supportCenterAttachmentPolicy")}</p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={submitting || createMutation.isPending} className="gap-2">
                {(submitting || createMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                {t("submitRequest")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

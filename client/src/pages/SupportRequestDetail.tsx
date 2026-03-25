import * as React from "react";

import { useAuth } from "@/_core/hooks/useAuth";
import CRMLayout from "@/components/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useParams } from "wouter";

type RequestType = "Ticket" | "Suggestion";
type RequestCategory = "Bug" | "Complaint" | "Access" | "Data" | "Feature" | "Improvement" | "Other";
type RequestPriority = "Low" | "Medium" | "High";
type RequestStatus = "New" | "UnderReview" | "WaitingUser" | "Resolved" | "Closed" | "Rejected";

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
  createdBy?: number | null;
  createdByName?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  lastActivityAt?: string | Date | null;
};

type SupportMessageLike = {
  id: number;
  userId?: number | null;
  userName?: string | null;
  message: string;
  isFromSuperAdmin?: boolean | number | null;
  createdAt?: string | Date | null;
};

type SupportAttachmentLike = {
  id: number;
  fileName?: string | null;
  fileUrl: string;
  createdAt?: string | Date | null;
};

const PRIMARY_SUPER_ADMIN_EMAIL = "admin@tamiyouz.com";
const STATUS_OPTIONS: RequestStatus[] = ["New", "UnderReview", "WaitingUser", "Resolved", "Closed", "Rejected"];
const SUPPORT_CATEGORIES: RequestCategory[] = ["Bug", "Complaint", "Access", "Data", "Feature", "Improvement", "Other"];
const SUPPORT_PRIORITIES: RequestPriority[] = ["Low", "Medium", "High"];

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

export default function SupportRequestDetail() {
  const params = useParams<{ id: string }>();
  const requestId = Number(params.id);
  const { user } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils() as any;
  const supportCenter = (trpc as any).supportCenter;
  const isSuperAdmin = String(user?.email ?? "").toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;

  const [replyMessage, setReplyMessage] = React.useState("");
  const [replyStatus, setReplyStatus] = React.useState<RequestStatus | "">("");
  const [standaloneStatus, setStandaloneStatus] = React.useState<RequestStatus | "">("");

  // Edit mode state
  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    subject: "",
    description: "",
    category: "" as RequestCategory,
    priority: "" as RequestPriority,
    screenRecordingLink: "",
  });

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const detailQuery = supportCenter.byId.useQuery(
    { id: requestId },
    {
      enabled: Number.isFinite(requestId) && requestId > 0,
      refetchOnWindowFocus: true,
      refetchInterval: 30000, // Auto-refresh every 30 seconds to show status/reply updates
    }
  );

  const replyMutation = supportCenter.reply.useMutation({
    onSuccess: async () => {
      setReplyMessage("");
      setReplyStatus("");
      toast.success(isRTL ? "تم إرسال الرد" : "Reply sent successfully");
      try {
        await utils.supportCenter.invalidate();
      } catch {
        await Promise.all([
          utils.supportCenter?.byId.invalidate?.({ id: requestId }),
          utils.supportCenter?.myRequests.invalidate?.(),
          utils.supportCenter?.adminInbox.invalidate?.(),
        ]);
      }
      await detailQuery.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteAttachmentMutation = supportCenter.deleteAttachment.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم حذف الصورة" : "Attachment deleted successfully");
      await utils.supportCenter?.byId.invalidate?.({ id: requestId });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateStatusMutation = supportCenter.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم تحديث الحالة" : "Status updated successfully");
      try {
        await utils.supportCenter.invalidate();
      } catch {
        await Promise.all([
          utils.supportCenter?.byId.invalidate?.({ id: requestId }),
          utils.supportCenter?.myRequests.invalidate?.(),
          utils.supportCenter?.adminInbox.invalidate?.(),
        ]);
      }
      await detailQuery.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Edit mutation (for ticket creator)
  const editMutation = supportCenter.edit.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم تحديث الطلب بنجاح" : "Request updated successfully");
      setIsEditing(false);
      try {
        await utils.supportCenter.invalidate();
      } catch {
        await Promise.all([
          utils.supportCenter?.byId.invalidate?.({ id: requestId }),
          utils.supportCenter?.myRequests.invalidate?.(),
        ]);
      }
      await detailQuery.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Delete mutation (for admin only)
  const deleteMutation = supportCenter.delete.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم حذف الطلب بنجاح" : "Request deleted successfully");
      try {
        await utils.supportCenter.invalidate();
      } catch {
        await Promise.all([
          utils.supportCenter?.myRequests.invalidate?.(),
          utils.supportCenter?.adminInbox.invalidate?.(),
        ]);
      }
      navigate("/support-center");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const request = detailQuery.data?.request as SupportRequestLike | undefined;
  const messages = React.useMemo<SupportMessageLike[]>(() => {
    const raw = detailQuery.data?.messages;
    return Array.isArray(raw) ? (raw as SupportMessageLike[]) : [];
  }, [detailQuery.data]);
  const attachments = React.useMemo<SupportAttachmentLike[]>(() => {
    const raw = detailQuery.data?.attachments;
    return Array.isArray(raw) ? (raw as SupportAttachmentLike[]) : [];
  }, [detailQuery.data]);

  React.useEffect(() => {
    if (request?.status) {
      setStandaloneStatus(request.status);
    }
  }, [request?.status]);

  // Check if current user is the creator
  const isCreator = request?.createdBy === user?.id;
  // Can edit only if creator and status is New or UnderReview
  const canEdit = isCreator && request && ["New", "UnderReview"].includes(request.status);

  const startEditing = () => {
    if (!request) return;
    setEditForm({
      subject: request.subject,
      description: request.description,
      category: request.category,
      priority: request.priority,
      screenRecordingLink: request.screenRecordingLink || "",
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (editForm.subject.trim().length < 3) {
      toast.error(isRTL ? "العنوان قصير جدًا" : "Subject is too short");
      return;
    }
    if (editForm.description.trim().length < 10) {
      toast.error(isRTL ? "الوصف يجب أن يكون أوضح" : "Description must be at least 10 characters");
      return;
    }
    await editMutation.mutateAsync({
      id: requestId,
      subject: editForm.subject.trim(),
      description: editForm.description.trim(),
      category: editForm.category,
      priority: editForm.priority,
      screenRecordingLink: editForm.screenRecordingLink.trim() || null,
    });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({ id: requestId });
  };

  const handleReply = async () => {
    if (!replyMessage.trim()) {
      toast.error(isRTL ? "اكتب ردًا أولًا" : "Please enter a reply first");
      return;
    }

    await replyMutation.mutateAsync({
      requestId,
      message: replyMessage.trim(),
      status: isSuperAdmin && replyStatus ? replyStatus : undefined,
    });
  };

  const handleStatusUpdate = async () => {
    if (!isSuperAdmin || !standaloneStatus || standaloneStatus === request?.status) return;
    await updateStatusMutation.mutateAsync({ requestId, status: standaloneStatus });
  };

  if (detailQuery.isLoading) {
    return (
      <CRMLayout>
        <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </CRMLayout>
    );
  }

  if (!request) {
    return (
      <CRMLayout>
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center p-6">
          <Card className="w-full max-w-xl">
            <CardContent className="space-y-4 p-8 text-center">
              <h1 className="text-xl font-semibold">{t("requestNotFound")}</h1>
              <p className="text-sm text-muted-foreground">{detailQuery.error?.message || t("requestNotFoundHint")}</p>
              <Button onClick={() => navigate("/support-center")}>{t("backToSupportCenter")}</Button>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Link href="/support-center">
              <Button variant="ghost" className="-ml-3 gap-2 px-3 text-muted-foreground">
                <ArrowLeft size={16} className={isRTL ? "rotate-180" : ""} />
                {t("backToSupportCenter")}
              </Button>
            </Link>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-muted/40">{request.code || `#${request.id}`}</Badge>
                <Badge variant="outline" className={statusClassMap[request.status]}>
                  {t(request.status)}
                </Badge>
                <Badge variant="outline" className={priorityClassMap[request.priority]}>
                  {t(request.priority)}
                </Badge>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{request.subject}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(request as any).createdByName && <><span className="font-medium text-foreground">{(request as any).createdByName}</span> • </>}{t(request.requestType)} • {t(request.category)} • {t("createdAt")} {formatDateTime(request.createdAt, lang)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            {/* Edit button for creator */}
            {canEdit && !isEditing && (
              <Button variant="outline" className="gap-2" onClick={startEditing}>
                <Edit3 size={16} />
                {isRTL ? "تعديل الطلب" : "Edit Request"}
              </Button>
            )}

            {/* Admin actions card */}
            {isSuperAdmin && (
              <Card className="w-full md:max-w-sm">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck size={16} className="text-primary" />
                    {t("adminActions")}
                  </div>
                  <div className="space-y-2">
                    <Label>{t("updateStatus")}</Label>
                    <div className="flex gap-2">
                      <Select value={standaloneStatus} onValueChange={(value) => setStandaloneStatus(value as RequestStatus)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("status")} />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>{t(status)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        onClick={handleStatusUpdate}
                        disabled={!standaloneStatus || standaloneStatus === request.status || updateStatusMutation.isPending}
                      >
                        {updateStatusMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : t("save")}
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  {/* Delete button for admin */}
                  {!showDeleteConfirm ? (
                    <Button
                      variant="destructive"
                      className="w-full gap-2"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 size={16} />
                      {isRTL ? "حذف الطلب" : "Delete Request"}
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-sm font-medium text-destructive">
                        {isRTL ? "هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع." : "Are you sure? This action cannot be undone."}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={handleDelete}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          {isRTL ? "تأكيد الحذف" : "Confirm Delete"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          {isRTL ? "إلغاء" : "Cancel"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("requestDetails")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {isEditing ? (
                  /* ─── Edit Mode ─── */
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? "العنوان" : "Subject"}</Label>
                      <Input
                        value={editForm.subject}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, subject: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("description")}</Label>
                      <Textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                        className="min-h-[150px]"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{isRTL ? "التصنيف" : "Category"}</Label>
                        <Select value={editForm.category} onValueChange={(v) => setEditForm((prev) => ({ ...prev, category: v as RequestCategory }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORT_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{t(cat)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{isRTL ? "الأولوية" : "Priority"}</Label>
                        <Select value={editForm.priority} onValueChange={(v) => setEditForm((prev) => ({ ...prev, priority: v as RequestPriority }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORT_PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>{t(p)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("screenRecordingLink")}</Label>
                      <Input
                        type="url"
                        value={editForm.screenRecordingLink}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, screenRecordingLink: e.target.value }))}
                        placeholder="https://loom.com/..."
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button className="gap-2" onClick={handleSaveEdit} disabled={editMutation.isPending}>
                        {editMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isRTL ? "حفظ التعديلات" : "Save Changes"}
                      </Button>
                      <Button variant="outline" className="gap-2" onClick={cancelEditing} disabled={editMutation.isPending}>
                        <X size={16} />
                        {isRTL ? "إلغاء" : "Cancel"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ─── View Mode ─── */
                  <>
                    <div>
                      <p className="mb-2 text-sm font-medium">{t("description")}</p>
                      <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-7 whitespace-pre-wrap">
                        {request.description}
                      </div>
                    </div>

                    {request.screenRecordingLink && (
                      <div>
                        <p className="mb-2 text-sm font-medium">{t("screenRecordingLink")}</p>
                        <a
                          href={request.screenRecordingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-primary transition hover:bg-primary/5"
                        >
                          <FileVideo size={16} />
                          <span className="truncate">{request.screenRecordingLink}</span>
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    )}
                  </>
                )}

                <Separator />

                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{t("screenshots")}</p>
                      <p className="text-xs text-muted-foreground">{attachments.length} {t("screenshots")}</p>
                    </div>
                  </div>

                  {attachments.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      {t("noAttachments")}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="overflow-hidden rounded-xl border bg-card">
                          <a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="block">
                            <div className="aspect-video bg-muted/30">
                              <img src={attachment.fileUrl} alt={attachment.fileName || "attachment"} className="h-full w-full object-cover" />
                            </div>
                          </a>
                          <div className="space-y-3 p-3">
                            <div className="flex items-center gap-2">
                              <ImageIcon size={16} className="text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{attachment.fileName || t("attachment")}</p>
                                <p className="text-xs text-muted-foreground">{formatDateTime(attachment.createdAt, lang)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="flex-1">
                                <Button variant="outline" className="w-full gap-2">
                                  <ExternalLink size={14} />
                                  {t("open")}
                                </Button>
                              </a>
                              {isSuperAdmin && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => deleteAttachmentMutation.mutate({ id: attachment.id })}
                                  disabled={deleteAttachmentMutation.isPending}
                                >
                                  {deleteAttachmentMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="flex min-h-[640px] flex-col">
            <CardHeader>
              <CardTitle>{t("conversation")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                    <MessageSquare size={20} />
                    <p>{t("noRepliesYet")}</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const fromSuperAdmin = Boolean(message.isFromSuperAdmin);
                    const isOwnMessage = message.userId === user?.id;
                    const alignClass = fromSuperAdmin ? "items-start" : "items-end";
                    const bubbleClass = fromSuperAdmin
                      ? "bg-primary text-primary-foreground"
                      : isOwnMessage
                        ? "bg-muted text-foreground"
                        : "bg-muted text-foreground";
                    const authorLabel = fromSuperAdmin
                      ? t("superAdmin")
                      : message.userName || (message.userId ? `User #${message.userId}` : t("requester"));

                    return (
                      <div key={message.id} className={`flex flex-col ${alignClass}`}>
                        <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${bubbleClass}`}>
                          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] opacity-80">
                            <span className="font-semibold">{authorLabel}</span>
                            <span>{formatDateTime(message.createdAt, lang)}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{message.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <Textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  placeholder={t("writeReply")}
                  className="min-h-[120px]"
                />

                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label>{t("changeStatusWithReply")}</Label>
                    <Select value={replyStatus} onValueChange={(value) => setReplyStatus(value as RequestStatus)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("keepCurrentStatus")} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>{t(status)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button className="gap-2" onClick={handleReply} disabled={replyMutation.isPending || !replyMessage.trim()}>
                    {replyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {t("sendReply")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CRMLayout>
  );
}

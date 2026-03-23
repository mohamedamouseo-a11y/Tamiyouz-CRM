import * as React from "react";

import { useAuth } from "@/_core/hooks/useAuth";
import CRMLayout from "@/components/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Inbox, Loader2, ShieldAlert } from "lucide-react";
import { Link, useLocation } from "wouter";

type RequestType = "Ticket" | "Suggestion";
type RequestStatus = "New" | "UnderReview" | "WaitingUser" | "Resolved" | "Closed" | "Rejected";
type RequestPriority = "Low" | "Medium" | "High";

type SupportRequestLike = {
  id: number;
  code?: string | null;
  requestType: RequestType;
  subject: string;
  priority: RequestPriority;
  status: RequestStatus;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  lastActivityAt?: string | Date | null;
  createdBy?: number | null;
  requesterName?: string | null;
  createdByName?: string | null;
};

const PRIMARY_SUPER_ADMIN_EMAIL = "admin@tamiyouz.com";
const FILTER_STATUSES: Array<RequestStatus | "all"> = ["all", "New", "UnderReview", "WaitingUser", "Resolved", "Closed", "Rejected"];
const FILTER_TYPES: Array<RequestType | "all"> = ["all", "Ticket", "Suggestion"];

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

export default function SupportAdminInbox() {
  const { user } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const [, navigate] = useLocation();
  const supportCenter = (trpc as any).supportCenter;
  const isSuperAdmin = String(user?.email ?? "").toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL;

  const [statusFilter, setStatusFilter] = React.useState<RequestStatus | "all">("all");
  const [typeFilter, setTypeFilter] = React.useState<RequestType | "all">("all");

  const inboxQuery = supportCenter.adminInbox.useQuery(
    {
      status: statusFilter === "all" ? undefined : statusFilter,
      requestType: typeFilter === "all" ? undefined : typeFilter,
    },
    { enabled: isSuperAdmin }
  );

  const requests = React.useMemo<SupportRequestLike[]>(() => {
    const raw = inboxQuery.data;
    return Array.isArray(raw) ? (raw as SupportRequestLike[]) : [];
  }, [inboxQuery.data]);

  if (!isSuperAdmin) {
    return (
      <CRMLayout>
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center p-6">
          <Card className="w-full max-w-xl">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{t("accessDenied")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("supportAdminOnlyMessage")}</p>
              </div>
              <Link href="/support-center">
                <Button variant="outline">{t("supportCenter")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Inbox size={14} />
              <span>{t("supportAdminSubtitle")}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">{t("supportAdmin")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("supportAdminDescription")}</p>
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("supportInbox")}</CardTitle>
          </CardHeader>
          <CardContent>
            {inboxQuery.isLoading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                {t("noRequestsFound")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("requestId")}</TableHead>
                    <TableHead>{t("requester")}</TableHead>
                    <TableHead>{t("requestType")}</TableHead>
                    <TableHead>{t("subject")}</TableHead>
                    <TableHead>{t("priority")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("lastUpdate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const requesterLabel = request.requesterName || request.createdByName || (request.createdBy ? `User #${request.createdBy}` : "—");
                    return (
                      <TableRow key={request.id} className="cursor-pointer" onClick={() => navigate(`/support-center/${request.id}`)}>
                        <TableCell className="font-medium">{request.code || `#${request.id}`}</TableCell>
                        <TableCell>{requesterLabel}</TableCell>
                        <TableCell>{t(request.requestType)}</TableCell>
                        <TableCell>
                          <div className="max-w-[260px] truncate">{request.subject}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={priorityClassMap[request.priority]}>
                            {t(request.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusClassMap[request.status]}>
                            {t(request.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(request.lastActivityAt || request.updatedAt || request.createdAt, lang)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}

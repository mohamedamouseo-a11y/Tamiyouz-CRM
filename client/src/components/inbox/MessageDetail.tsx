import { ExternalLink, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import type { InboxMessage } from "./types";

type Props = {
  message: InboxMessage | null;
  isArabic?: boolean;
  onMarkRead?: (id: number) => void;
};

const LABEL_MAP: Record<string, string> = {
  leadId: "Lead ID",
  leadName: "Lead Name",
  phone: "Phone",
  campaignName: "Campaign",
  assignedToName: "Assigned To",
  assignedToId: "Assigned To ID",
  leadTime: "Form Filled At",
  createdAt: "Arrived in CRM",
  breachDuration: "Breach Duration",
  slaAlertedAt: "SLA Alerted At",
  platform: "Platform",
  status: "Status",
  startDate: "Start Date",
  visibility: "Visibility",
  trigger: "Trigger",
  clientName: "Client Name",
};

function prettifyLabel(key: string) {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function renderValue(value: unknown) {
  if (value == null || value === "") return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime()) && value.includes("T")) {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(asDate);
    }
  }
  return String(value);
}

function computeTimeDiff(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;
  const leadTime = metadata.leadTime as string | null;
  const createdAt = metadata.createdAt as string | null;
  if (!leadTime || !createdAt) return null;
  const diff = new Date(createdAt).getTime() - new Date(leadTime).getTime();
  if (isNaN(diff) || diff < 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min(s)`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return `${hours}h ${remainMins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function MessageDetail({ message, isArabic, onMarkRead }: Props) {
  if (!message) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Select a message to view its details.
      </div>
    );
  }

  const title = isArabic ? message.titleAr || message.title : message.title;
  const body = isArabic ? message.bodyAr || message.body : message.body;
  const metadataEntries = Object.entries(message.metadata ?? {});
  const timeDiff = computeTimeDiff(message.metadata);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </div>

        <div className="flex items-center gap-2">
          {!message.isRead ? (
            <Button type="button" variant="outline" onClick={() => onMarkRead?.(message.id)}>
              <MailCheck className="me-2 h-4 w-4" />
              Mark as read
            </Button>
          ) : null}

          {message.link ? (
            <Button type="button" asChild>
              <a href={message.link}>
                <ExternalLink className="me-2 h-4 w-4" />
                Open link
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <Separator className="my-5" />

      {timeDiff ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">Time to CRM</p>
          <p className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-300">{timeDiff}</p>
        </div>
      ) : null}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          {metadataEntries.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key} className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{prettifyLabel(key)}</p>
                  <p className="mt-1 break-words text-sm font-medium">{renderValue(value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No metadata found for this message.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

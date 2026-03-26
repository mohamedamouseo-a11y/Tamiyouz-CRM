export type InboxTab = "all" | "unread" | "sla" | "leads" | "reminders" | "campaigns";

export type InboxMessage = {
  id: number;
  type: string;
  title: string;
  titleAr?: string | null;
  body: string;
  bodyAr?: string | null;
  isRead: boolean;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type InboxCounts = {
  all: number;
  unread: number;
  sla: number;
  leads: number;
  reminders: number;
  campaigns: number;
};

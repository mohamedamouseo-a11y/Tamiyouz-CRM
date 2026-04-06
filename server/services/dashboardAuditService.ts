import { sql, and, eq, gte, lte, isNull, inArray, count, desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  leads, deals, activities, users, clients, contracts,
  campaigns, auditLogs,
} from "../../shared/schema";
import {
  getAgentStats, getTeamStats, getSalesFunnelData, getTaskSlaDashboardData,
} from "../db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateBasis =
  | "leads.createdAt"
  | "leads.contactTime"
  | "deals.createdAt"
  | "activities.createdAt"
  | "clients.createdAt"
  | "contracts.createdAt";

export type DashboardType = "agentDashboard" | "teamDashboard" | "salesFunnel" | "taskSla";
export type MetricKind = "scalar" | "grouped" | "trend" | "ratio";
export type MatchStatus = "Match" | "Mismatch" | "Partial" | "NotComparable";

export interface AuditParams {
  dashboardType: DashboardType;
  metricId: string;
  dateFrom: Date;
  dateTo: Date;
  dateBasis: DateBasis;
  targetUserId?: number;
  viewerRole?: string;
  extraFilters?: Record<string, any>;
}

export interface MetricDefinition {
  metricId: string;
  dashboardType: DashboardType;
  label: string;
  metricKind: MetricKind;
  primaryEntity: string;
  allowedDateBases: DateBasis[];
  defaultDateBasis: DateBasis;
  allowedScopes: string[];
  formulaDescription: string;
  primaryTable: string;
  joinedTables: string[];
  includedStatuses: string[];
  excludedStatuses: string[];
  softDeleteRule: string;
  caveats?: string;
}

export interface AuditResult {
  dashboardLogicValue: any;
  databaseValue: any;
  difference: any;
  matchStatus: MatchStatus;
  mismatchReasons: string[];
  rawRowCount: number;
  relatedRowCount: number;
  definition: MetricDefinition;
  supportsExcelExport: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeDateRange(dateFrom: Date, dateTo: Date): { from: Date; to: Date } {
  const from = new Date(dateFrom);
  from.setHours(0, 0, 0, 0);
  const to = new Date(dateTo);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function computeMatchStatus(dashVal: any, dbVal: any): { status: MatchStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (dashVal === null || dashVal === undefined || dbVal === null || dbVal === undefined) {
    return { status: "NotComparable", reasons: ["One or both values are null/undefined"] };
  }
  if (typeof dashVal === "number" && typeof dbVal === "number") {
    if (dashVal === dbVal) return { status: "Match", reasons: [] };
    const diff = Math.abs(dashVal - dbVal);
    const pct = dashVal > 0 ? (diff / dashVal) * 100 : 100;
    reasons.push(`Dashboard=${dashVal}, DB=${dbVal}, diff=${diff} (${pct.toFixed(1)}%)`);
    if (pct < 5) return { status: "Partial", reasons };
    return { status: "Mismatch", reasons };
  }
  if (typeof dashVal === "object" && typeof dbVal === "object") {
    const ds = JSON.stringify(dashVal);
    const dbs = JSON.stringify(dbVal);
    if (ds === dbs) return { status: "Match", reasons: [] };
    reasons.push("Grouped dataset values differ — check individual entries");
    return { status: "Partial", reasons };
  }
  if (String(dashVal) === String(dbVal)) return { status: "Match", reasons: [] };
  reasons.push(`Dashboard="${dashVal}", DB="${dbVal}"`);
  return { status: "Mismatch", reasons };
}

// ─── Metric Registry ──────────────────────────────────────────────────────────

export const METRIC_REGISTRY: MetricDefinition[] = [
  // ── Agent Dashboard ────────────────────────────────────────────────────────
  {
    metricId: "agent_totalLeads",
    dashboardType: "agentDashboard",
    label: "Total Leads (Agent)",
    metricKind: "scalar",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["agent", "mediaBuyer"],
    formulaDescription: "COUNT of leads where leads.deletedAt IS NULL, filtered by ownerId (or global for MediaBuyer), within leads.createdAt range",
    primaryTable: "leads",
    joinedTables: [],
    includedStatuses: ["all stages"],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
    caveats: "MediaBuyer sees all leads regardless of ownerId",
  },
  {
    metricId: "agent_totalActivities",
    dashboardType: "agentDashboard",
    label: "Total Activities (Agent)",
    metricKind: "scalar",
    primaryEntity: "activity",
    allowedDateBases: ["activities.createdAt"],
    defaultDateBasis: "activities.createdAt",
    allowedScopes: ["agent", "mediaBuyer"],
    formulaDescription: "COUNT of activities where activities.userId = agentId (or global for MediaBuyer), within activities.createdAt range",
    primaryTable: "activities",
    joinedTables: [],
    includedStatuses: [],
    excludedStatuses: [],
    softDeleteRule: "activities.deletedAt IS NULL",
    caveats: "No deletedAt filter on activities in the current dashboard",
  },
  {
    metricId: "agent_wonDeals",
    dashboardType: "agentDashboard",
    label: "Won Deals (Agent)",
    metricKind: "scalar",
    primaryEntity: "deal",
    allowedDateBases: ["deals.createdAt"],
    defaultDateBasis: "deals.createdAt",
    allowedScopes: ["agent", "mediaBuyer"],
    formulaDescription: "COUNT of deals where deals.status='Won', deals.deletedAt IS NULL, joined to leads (leads.deletedAt IS NULL), filtered by leads.ownerId (or global for MediaBuyer), within deals.createdAt range",
    primaryTable: "deals",
    joinedTables: ["leads"],
    includedStatuses: ["Won"],
    excludedStatuses: ["Pending", "Lost"],
    softDeleteRule: "deals.deletedAt IS NULL AND leads.deletedAt IS NULL",
  },
  {
    metricId: "agent_slaBreached",
    dashboardType: "agentDashboard",
    label: "SLA Breached Count (Agent)",
    metricKind: "scalar",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["agent", "mediaBuyer"],
    formulaDescription: "COUNT of leads where leads.slaBreached=true, leads.deletedAt IS NULL, filtered by ownerId, within leads.createdAt range",
    primaryTable: "leads",
    joinedTables: [],
    includedStatuses: [],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
  },
  {
    metricId: "agent_contactToMeetingRate",
    dashboardType: "agentDashboard",
    label: "Contact-to-Meeting Rate (Agent)",
    metricKind: "ratio",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["agent"],
    formulaDescription: "meetingLeads / contactedLeads * 100 — where meeting stages = [Meeting Scheduled, Proposal Delivered, Won], contacted stages = [Contacted, Leads, Meeting Scheduled, Proposal Delivered, Won, Contact Again]",
    primaryTable: "leads",
    joinedTables: [],
    includedStatuses: ["Contacted", "Leads", "Meeting Scheduled", "Proposal Delivered", "Won", "Contact Again"],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
  },
  // ── Team Dashboard ─────────────────────────────────────────────────────────
  {
    metricId: "team_totalLeads",
    dashboardType: "teamDashboard",
    label: "Total Leads (Team)",
    metricKind: "scalar",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["global"],
    formulaDescription: "COUNT of all leads where leads.deletedAt IS NULL within leads.createdAt range",
    primaryTable: "leads",
    joinedTables: [],
    includedStatuses: ["all stages"],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
  },
  {
    metricId: "team_wonDeals",
    dashboardType: "teamDashboard",
    label: "Won Deals (Team)",
    metricKind: "scalar",
    primaryEntity: "deal",
    allowedDateBases: ["deals.createdAt"],
    defaultDateBasis: "deals.createdAt",
    allowedScopes: ["global"],
    formulaDescription: "COUNT of deals where deals.status='Won' and deals.deletedAt IS NULL, within deals.createdAt range",
    primaryTable: "deals",
    joinedTables: ["leads"],
    includedStatuses: ["Won"],
    excludedStatuses: [],
    softDeleteRule: "deals.deletedAt IS NULL AND leads.deletedAt IS NULL",
  },
  {
    metricId: "team_slaBreached",
    dashboardType: "teamDashboard",
    label: "SLA Breached (Team)",
    metricKind: "scalar",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["global"],
    formulaDescription: "COUNT of leads where leads.slaBreached=true, leads.deletedAt IS NULL, within leads.createdAt range",
    primaryTable: "leads",
    joinedTables: [],
    includedStatuses: [],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
  },
  {
    metricId: "team_leadsByStage",
    dashboardType: "teamDashboard",
    label: "Leads by Stage (Team)",
    metricKind: "grouped",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["global"],
    formulaDescription: "GROUP BY leads.stage, COUNT(*) where leads.deletedAt IS NULL within leads.createdAt range",
    primaryTable: "leads",
    joinedTables: [],
    includedStatuses: ["all stages"],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
  },
  {
    metricId: "team_agentPerformance",
    dashboardType: "teamDashboard",
    label: "Agent Performance (Team)",
    metricKind: "grouped",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["global"],
    formulaDescription: "Per SalesAgent: leadCount, activityCount, wonDeals, revenue joined from leads/activities/deals filtered by createdAt range",
    primaryTable: "leads",
    joinedTables: ["users", "activities", "deals"],
    includedStatuses: [],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL, deals.deletedAt IS NULL",
  },
  // ── Sales Funnel ───────────────────────────────────────────────────────────
  {
    metricId: "funnel_leadsByStage",
    dashboardType: "salesFunnel",
    label: "Leads by Stage (Funnel)",
    metricKind: "grouped",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["global", "agent"],
    formulaDescription: "GROUP BY leads.stage, COUNT(*) where leads.deletedAt IS NULL within leads.createdAt range",
    primaryTable: "leads",
    joinedTables: [],
    includedStatuses: ["all"],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
  },
  {
    metricId: "funnel_dealSummary",
    dashboardType: "salesFunnel",
    label: "Deal Summary (Funnel)",
    metricKind: "grouped",
    primaryEntity: "deal",
    allowedDateBases: ["deals.createdAt"],
    defaultDateBasis: "deals.createdAt",
    allowedScopes: ["global"],
    formulaDescription: "GROUP BY deals.status, COUNT(*), SUM(valueBase) where deals.deletedAt IS NULL within deals.createdAt range",
    primaryTable: "deals",
    joinedTables: [],
    includedStatuses: ["Won", "Pending", "Lost"],
    excludedStatuses: [],
    softDeleteRule: "deals.deletedAt IS NULL",
  },
  // ── Task SLA ───────────────────────────────────────────────────────────────
  {
    metricId: "sla_breachedCount",
    dashboardType: "taskSla",
    label: "SLA Breached Count",
    metricKind: "scalar",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["global", "agent"],
    formulaDescription: "COUNT of leads where slaBreached=true, deletedAt IS NULL, optionally filtered by ownerId, within leads.createdAt range",
    primaryTable: "leads",
    joinedTables: [],
    includedStatuses: [],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
  },
  {
    metricId: "sla_avgContactTime",
    dashboardType: "taskSla",
    label: "Avg Contact Time (hours)",
    metricKind: "scalar",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["global", "agent"],
    formulaDescription: "AVG(TIMESTAMPDIFF(MINUTE, leads.createdAt, leads.contactTime)) / 60 where contactTime IS NOT NULL, deletedAt IS NULL, within leads.createdAt range",
    primaryTable: "leads",
    joinedTables: [],
    includedStatuses: [],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
  },
  {
    metricId: "sla_activityByType",
    dashboardType: "taskSla",
    label: "Activity by Type",
    metricKind: "grouped",
    primaryEntity: "activity",
    allowedDateBases: ["activities.createdAt"],
    defaultDateBasis: "activities.createdAt",
    allowedScopes: ["global", "agent"],
    formulaDescription: "GROUP BY activities.type, COUNT(*) where activities.deletedAt IS NULL within activities.createdAt range",
    primaryTable: "activities",
    joinedTables: [],
    includedStatuses: [],
    excludedStatuses: [],
    softDeleteRule: "activities.deletedAt IS NULL",
  },
  {
    metricId: "sla_agentSlaPerformance",
    dashboardType: "taskSla",
    label: "Agent SLA Performance",
    metricKind: "grouped",
    primaryEntity: "lead",
    allowedDateBases: ["leads.createdAt"],
    defaultDateBasis: "leads.createdAt",
    allowedScopes: ["global"],
    formulaDescription: "Per SalesAgent: totalLeads, breachedCount, contactedCount, avgResponseMinutes within leads.createdAt range",
    primaryTable: "leads",
    joinedTables: ["users"],
    includedStatuses: [],
    excludedStatuses: [],
    softDeleteRule: "leads.deletedAt IS NULL",
  },
];

export function listMetricDefinitions() {
  return METRIC_REGISTRY;
}

export function getMetricDefinition(metricId: string): MetricDefinition | undefined {
  return METRIC_REGISTRY.find((m) => m.metricId === metricId);
}

// ─── Dashboard Logic Resolvers ────────────────────────────────────────────────

async function resolveDashboardValue(params: AuditParams): Promise<any> {
  const { dashboardType, metricId, dateFrom, dateTo, targetUserId, viewerRole } = params;
  const { from, to } = normalizeDateRange(dateFrom, dateTo);

  if (dashboardType === "agentDashboard") {
    const userId = targetUserId ?? 0;
    const stats = await getAgentStats(userId, from, to, viewerRole ?? "SalesAgent");
    if (!stats) return null;
    const map: Record<string, any> = {
      agent_totalLeads: stats.totalLeads,
      agent_totalActivities: stats.totalActivities,
      agent_wonDeals: stats.wonDeals,
      agent_slaBreached: stats.slaBreached,
      agent_contactToMeetingRate: stats.contactToMeetingRate,
    };
    return map[metricId] ?? null;
  }

  if (dashboardType === "teamDashboard") {
    const stats = await getTeamStats(from, to);
    if (!stats) return null;
    const map: Record<string, any> = {
      team_totalLeads: stats.totalLeads,
      team_wonDeals: stats.wonDeals,
      team_slaBreached: stats.slaBreached,
      team_leadsByStage: stats.leadsByStage,
      team_agentPerformance: stats.agentPerformance,
    };
    return map[metricId] ?? null;
  }

  if (dashboardType === "salesFunnel") {
    const stats = await getSalesFunnelData(from, to, viewerRole ?? "Admin", targetUserId ?? 0);
    if (!stats) return null;
    const map: Record<string, any> = {
      funnel_leadsByStage: (stats as any).funnelData ?? [],
      funnel_dealSummary: (stats as any).dealSummary ?? {},
    };
    return map[metricId] ?? null;
  }

  if (dashboardType === "taskSla") {
    const isAgent = (viewerRole ?? "Admin") === "SalesAgent";
    const effectiveRole = isAgent ? "SalesAgent" : "Admin";
    const effectiveUserId = isAgent ? (targetUserId ?? 0) : (targetUserId ?? 0);
    const stats = await getTaskSlaDashboardData(from, to, effectiveRole, effectiveUserId);
    if (!stats) return null;
    const map: Record<string, any> = {
      sla_breachedCount: (stats as any).slaOverview?.breachedCount ?? 0,
      sla_avgContactTime: (stats as any).slaOverview?.avgResponseMinutes != null ? Number((stats as any).slaOverview.avgResponseMinutes) / 60 : null,
      sla_activityByType: (stats as any).activityByType ?? [],
      sla_agentSlaPerformance: (stats as any).agentSlaPerformance ?? [],
    };
    return map[metricId] ?? null;
  }

  return null;
}

// ─── Direct DB Resolvers ──────────────────────────────────────────────────────

async function resolveDbValue(params: AuditParams): Promise<any> {
  const { metricId, dateFrom, dateTo, targetUserId, viewerRole } = params;
  const { from, to } = normalizeDateRange(dateFrom, dateTo);
  const db = await getDb();
  if (!db) return null;

  switch (metricId) {
    case "agent_totalLeads": {
      const isMediaBuyer = viewerRole === "MediaBuyer";
      const conditions = isMediaBuyer
        ? [isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)]
        : [eq(leads.ownerId, targetUserId!), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)];
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...conditions));
      return Number(r?.count ?? 0);
    }
    case "agent_totalActivities": {
      const isMediaBuyer = viewerRole === "MediaBuyer";
      const conditions = isMediaBuyer
        ? [isNull(activities.deletedAt), gte(activities.createdAt, from), lte(activities.createdAt, to)]
        : [eq(activities.userId, targetUserId!), isNull(activities.deletedAt), gte(activities.createdAt, from), lte(activities.createdAt, to)];
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(and(...conditions));
      return Number(r?.count ?? 0);
    }
    case "agent_wonDeals": {
      const isMediaBuyer = viewerRole === "MediaBuyer";
      const result = isMediaBuyer
        ? await db.execute(sql`SELECT COUNT(*) as cnt FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to}`)
        : await db.execute(sql`SELECT COUNT(*) as cnt FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND l.ownerId = ${targetUserId} AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to}`);
      return Number((result as any)[0]?.[0]?.cnt ?? 0);
    }
    case "agent_slaBreached": {
      const isMediaBuyer = viewerRole === "MediaBuyer";
      const conditions = isMediaBuyer
        ? [eq(leads.slaBreached, true), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)]
        : [eq(leads.ownerId, targetUserId!), eq(leads.slaBreached, true), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)];
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...conditions));
      return Number(r?.count ?? 0);
    }
    case "agent_contactToMeetingRate": {
      const contactedStages = ["Contacted", "Leads", "Meeting Scheduled", "Proposal Delivered", "Won", "Contact Again"];
      const meetingStages = ["Meeting Scheduled", "Proposal Delivered", "Won"];
      const base = [eq(leads.ownerId, targetUserId!), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)];
      const [cR, mR] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...base, inArray(leads.stage, contactedStages))),
        db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...base, inArray(leads.stage, meetingStages))),
      ]);
      const c = Number(cR[0]?.count ?? 0);
      const m = Number(mR[0]?.count ?? 0);
      return c > 0 ? Math.round((m / c) * 100 * 10) / 10 : 0;
    }
    case "team_totalLeads": {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)));
      return Number(r?.count ?? 0);
    }
    case "team_wonDeals": {
      const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL AND d.status = 'Won' AND d.createdAt BETWEEN ${from} AND ${to}`);
      return Number((result as any)[0]?.[0]?.cnt ?? 0);
    }
    case "team_slaBreached": {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.slaBreached, true), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)));
      return Number(r?.count ?? 0);
    }
    case "team_leadsByStage": {
      const result = await db.execute(sql`SELECT stage, COUNT(*) as cnt FROM leads WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to} GROUP BY stage ORDER BY cnt DESC`);
      return ((result as any)[0] ?? []).map((r: any) => ({ stage: r.stage, count: Number(r.cnt) }));
    }
    case "team_agentPerformance": {
      const result = await db.execute(sql`
        SELECT u.id, u.name,
          COALESCE(lc.leadCount, 0) as leadCount,
          COALESCE(ac.activityCount, 0) as activityCount,
          COALESCE(dc.wonDeals, 0) as wonDeals,
          COALESCE(dc.revenue, 0) as revenue
        FROM users u
        LEFT JOIN (SELECT ownerId, COUNT(*) as leadCount FROM leads WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to} GROUP BY ownerId) lc ON lc.ownerId = u.id
        LEFT JOIN (SELECT userId, COUNT(*) as activityCount FROM activities WHERE createdAt BETWEEN ${from} AND ${to} GROUP BY userId) ac ON ac.userId = u.id
        LEFT JOIN (SELECT l2.ownerId, COUNT(d.id) as wonDeals, COALESCE(SUM(d.valueBase),0) as revenue FROM deals d JOIN leads l2 ON l2.id = d.leadId AND l2.deletedAt IS NULL WHERE d.deletedAt IS NULL AND d.status='Won' AND d.createdAt BETWEEN ${from} AND ${to} GROUP BY l2.ownerId) dc ON dc.ownerId = u.id
        WHERE u.role = 'SalesAgent' AND u.deletedAt IS NULL ORDER BY wonDeals DESC
      `);
      return ((result as any)[0] ?? []).map((r: any) => ({ agentId: r.id, agentName: r.name, totalLeads: Number(r.leadCount), totalActivities: Number(r.activityCount), wonDeals: Number(r.wonDeals), revenue: Number(r.revenue) }));
    }
    case "funnel_leadsByStage": {
      const result = await db.execute(sql`SELECT stage, COUNT(*) as cnt FROM leads WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to} GROUP BY stage ORDER BY cnt DESC`);
      return ((result as any)[0] ?? []).map((r: any) => ({ stage: r.stage, count: Number(r.cnt) }));
    }
    case "funnel_dealSummary": {
      const result = await db.execute(sql`SELECT status, COUNT(*) as cnt, COALESCE(SUM(valueBase),0) as totalValue FROM deals WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to} GROUP BY status`);
      return ((result as any)[0] ?? []).map((r: any) => ({ status: r.status, count: Number(r.cnt), totalValue: Number(r.totalValue) }));
    }
    case "sla_breachedCount": {
      const conditions: any[] = [eq(leads.slaBreached, true), isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)];
      if (targetUserId) conditions.push(eq(leads.ownerId, targetUserId));
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...conditions));
      return Number(r?.count ?? 0);
    }
    case "sla_avgContactTime": {
      const conditions: any[] = [isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)];
      if (targetUserId) conditions.push(eq(leads.ownerId, targetUserId));
      const result = await db.execute(sql`SELECT AVG(TIMESTAMPDIFF(MINUTE, l.createdAt, l.contactTime)) / 60 as avgHours FROM leads l WHERE l.deletedAt IS NULL AND l.contactTime IS NOT NULL AND l.createdAt BETWEEN ${from} AND ${to} ${targetUserId ? sql`AND l.ownerId = ${targetUserId}` : sql``}`);
      return Number((result as any)[0]?.[0]?.avgHours ?? 0);
    }
    case "sla_activityByType": {
      const conditions: any[] = [isNull(activities.deletedAt), gte(activities.createdAt, from), lte(activities.createdAt, to)];
      if (targetUserId) conditions.push(eq(activities.userId, targetUserId));
      const result = await db.execute(sql`SELECT type, COUNT(*) as cnt FROM activities WHERE deletedAt IS NULL AND createdAt BETWEEN ${from} AND ${to} ${targetUserId ? sql`AND userId = ${targetUserId}` : sql``} GROUP BY type ORDER BY cnt DESC`);
      return ((result as any)[0] ?? []).map((r: any) => ({ type: r.type, count: Number(r.cnt) }));
    }
    case "sla_agentSlaPerformance": {
      const result = await db.execute(sql`
        SELECT u.id as agentId, u.name as agentName,
          COUNT(l.id) as totalLeads,
          SUM(CASE WHEN l.slaBreached=1 THEN 1 ELSE 0 END) as breachedCount,
          SUM(CASE WHEN l.contactTime IS NOT NULL THEN 1 ELSE 0 END) as contactedCount,
          AVG(CASE WHEN l.contactTime IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, l.createdAt, l.contactTime) ELSE NULL END) as avgResponseMinutes
        FROM users u
        LEFT JOIN leads l ON l.ownerId = u.id AND l.deletedAt IS NULL AND l.createdAt BETWEEN ${from} AND ${to}
        WHERE u.role = 'SalesAgent' AND u.deletedAt IS NULL
        GROUP BY u.id, u.name ORDER BY breachedCount DESC
      `);
      return ((result as any)[0] ?? []).map((r: any) => ({ agentId: r.agentId, agentName: r.agentName, totalLeads: Number(r.totalLeads), breachedCount: Number(r.breachedCount), contactedCount: Number(r.contactedCount), avgResponseMinutes: Number(r.avgResponseMinutes ?? 0) }));
    }
    default:
      return null;
  }
}

// ─── Raw Rows Resolver ────────────────────────────────────────────────────────

export async function getRawRows(params: AuditParams, limit = 200): Promise<any[]> {
  const { metricId, dateFrom, dateTo, targetUserId, viewerRole } = params;
  const { from, to } = normalizeDateRange(dateFrom, dateTo);
  const db = await getDb();
  if (!db) return [];

  const leadBase = [isNull(leads.deletedAt), gte(leads.createdAt, from), lte(leads.createdAt, to)] as any[];

  switch (metricId) {
    case "agent_totalLeads":
    case "agent_slaBreached":
    case "agent_contactToMeetingRate":
    case "sla_breachedCount":
    case "sla_avgContactTime":
    case "team_totalLeads":
    case "team_slaBreached":
    case "team_leadsByStage":
    case "funnel_leadsByStage": {
      const conds = [...leadBase];
      if (targetUserId && metricId.startsWith("agent_")) conds.push(eq(leads.ownerId, targetUserId));
      if (metricId === "agent_slaBreached" || metricId === "sla_breachedCount") conds.push(eq(leads.slaBreached, true));
      const rows = await db.select({
        id: leads.id, name: leads.name, phone: leads.phone, country: leads.country,
        businessProfile: leads.businessProfile, leadQuality: leads.leadQuality,
        fitStatus: leads.fitStatus, stage: leads.stage, campaignName: leads.campaignName,
        ownerId: leads.ownerId, slaBreached: leads.slaBreached,
        contactTime: leads.contactTime, createdAt: leads.createdAt, updatedAt: leads.updatedAt,
        deletedAt: leads.deletedAt, notes: leads.notes,
      }).from(leads).where(and(...conds)).orderBy(desc(leads.createdAt)).limit(limit);
      return rows;
    }
    case "agent_wonDeals":
    case "team_wonDeals":
    case "funnel_dealSummary": {
      const result = await db.execute(sql`
        SELECT d.id, d.leadId, d.status, d.valueSar, d.currency, d.valueBase, d.dealType,
               d.lossReason, d.notes, d.dealDuration, d.createdAt, d.updatedAt, d.deletedAt,
               l.name as leadName, l.phone as leadPhone, l.ownerId, u.name as ownerName
        FROM deals d
        JOIN leads l ON l.id = d.leadId
        LEFT JOIN users u ON u.id = l.ownerId
        WHERE d.deletedAt IS NULL AND l.deletedAt IS NULL
          AND d.status = 'Won'
          AND d.createdAt BETWEEN ${from} AND ${to}
          ${targetUserId && metricId === "agent_wonDeals" ? sql`AND l.ownerId = ${targetUserId}` : sql``}
        ORDER BY d.createdAt DESC LIMIT ${limit}
      `);
      return (result as any)[0] ?? [];
    }
    case "agent_totalActivities":
    case "sla_activityByType": {
      const result = await db.execute(sql`
        SELECT a.id, a.leadId, a.userId, a.type, a.activityTime, a.outcome, a.notes,
               a.createdAt, a.updatedAt, a.deletedAt, u.name as agentName, l.name as leadName
        FROM activities a
        LEFT JOIN users u ON u.id = a.userId
        LEFT JOIN leads l ON l.id = a.leadId
        WHERE a.deletedAt IS NULL
          AND a.createdAt BETWEEN ${from} AND ${to}
          ${targetUserId ? sql`AND a.userId = ${targetUserId}` : sql``}
        ORDER BY a.createdAt DESC LIMIT ${limit}
      `);
      return (result as any)[0] ?? [];
    }
    case "sla_agentSlaPerformance":
    case "team_agentPerformance": {
      const result = await db.execute(sql`
        SELECT u.id, u.name, u.role, u.email, u.isActive,
               COUNT(l.id) as leadCount,
               SUM(CASE WHEN l.slaBreached=1 THEN 1 ELSE 0 END) as slaBreachedCount
        FROM users u
        LEFT JOIN leads l ON l.ownerId = u.id AND l.deletedAt IS NULL AND l.createdAt BETWEEN ${from} AND ${to}
        WHERE u.role = 'SalesAgent' AND u.deletedAt IS NULL
        GROUP BY u.id, u.name, u.role, u.email, u.isActive
        ORDER BY leadCount DESC LIMIT ${limit}
      `);
      return (result as any)[0] ?? [];
    }
    default:
      return [];
  }
}

// ─── Related Records Resolver ─────────────────────────────────────────────────

export async function getRelatedRecords(params: AuditParams, rowIds: number[]): Promise<Record<string, any[]>> {
  const db = await getDb();
  if (!db || rowIds.length === 0) return {};
  const { metricId } = params;

  if (["agent_totalLeads", "team_totalLeads", "team_slaBreached", "agent_slaBreached", "sla_breachedCount", "funnel_leadsByStage", "team_leadsByStage", "sla_avgContactTime"].includes(metricId)) {
    const [dealsResult, activitiesResult, clientsResult] = await Promise.all([
      db.execute(sql`SELECT d.*, l.name as leadName FROM deals d JOIN leads l ON l.id = d.leadId WHERE d.leadId IN (${sql.join(rowIds.map(id => sql`${id}`), sql`, `)}) AND d.deletedAt IS NULL ORDER BY d.createdAt DESC`),
      db.execute(sql`SELECT a.*, u.name as agentName FROM activities a LEFT JOIN users u ON u.id = a.userId WHERE a.leadId IN (${sql.join(rowIds.map(id => sql`${id}`), sql`, `)}) AND a.deletedAt IS NULL ORDER BY a.createdAt DESC`),
      db.execute(sql`SELECT c.*, u.name as accountManagerName FROM clients c LEFT JOIN users u ON u.id = c.accountManagerId WHERE c.leadId IN (${sql.join(rowIds.map(id => sql`${id}`), sql`, `)}) AND c.deletedAt IS NULL`),
    ]);
    return {
      deals: (dealsResult as any)[0] ?? [],
      activities: (activitiesResult as any)[0] ?? [],
      clients: (clientsResult as any)[0] ?? [],
    };
  }

  if (["agent_wonDeals", "team_wonDeals", "funnel_dealSummary"].includes(metricId)) {
    // rowIds are deal IDs — get their leads and activities
    const leadsResult = await db.execute(sql`SELECT l.*, u.name as ownerName FROM leads l LEFT JOIN users u ON u.id = l.ownerId WHERE l.id IN (SELECT leadId FROM deals WHERE id IN (${sql.join(rowIds.map(id => sql`${id}`), sql`, `)})) AND l.deletedAt IS NULL`);
    return { leads: (leadsResult as any)[0] ?? [] };
  }

  return {};
}

// ─── Stored Inputs Resolver ───────────────────────────────────────────────────

export async function getStoredInputs(params: AuditParams, rowIds: number[]): Promise<any[]> {
  const db = await getDb();
  if (!db || rowIds.length === 0) return [];
  const { metricId } = params;

  if (["agent_totalLeads", "team_totalLeads", "team_slaBreached", "agent_slaBreached", "sla_breachedCount", "funnel_leadsByStage", "team_leadsByStage", "sla_avgContactTime", "agent_contactToMeetingRate"].includes(metricId)) {
    const rows = await db.execute(sql`
      SELECT l.id, l.name, l.phone, l.country, l.businessProfile, l.leadQuality, l.fitStatus,
             l.campaignName, l.adCreative, l.ownerId, l.stage, l.notes, l.mediaBuyerNotes,
             l.serviceIntroduced, l.contactTime, l.priceOfferSent, l.priceOfferLink, l.priceOfferTime,
             l.slaBreached, l.isDuplicate, l.duplicateOfId, l.externalId, l.sourceId,
             l.sourceMetadata, l.customFieldsData, l.createdAt, l.updatedAt, l.deletedAt, l.deletedBy,
             u.name as ownerName
      FROM leads l LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.id IN (${sql.join(rowIds.map(id => sql`${id}`), sql`, `)})
    `);
    return (rows as any)[0] ?? [];
  }

  if (["agent_wonDeals", "team_wonDeals", "funnel_dealSummary"].includes(metricId)) {
    const rows = await db.execute(sql`
      SELECT d.id, d.leadId, d.valueSar, d.currency, d.valueBase, d.status, d.dealType,
             d.lossReason, d.notes, d.dealDuration, d.createdAt, d.updatedAt, d.deletedAt, d.deletedBy,
             l.name as leadName, u.name as ownerName
      FROM deals d JOIN leads l ON l.id = d.leadId LEFT JOIN users u ON u.id = l.ownerId
      WHERE d.id IN (${sql.join(rowIds.map(id => sql`${id}`), sql`, `)})
    `);
    return (rows as any)[0] ?? [];
  }

  if (["agent_totalActivities", "sla_activityByType"].includes(metricId)) {
    const rows = await db.execute(sql`
      SELECT a.id, a.leadId, a.userId, a.type, a.activityTime, a.outcome, a.notes,
             a.createdAt, a.updatedAt, a.deletedAt, a.deletedBy,
             u.name as agentName, l.name as leadName
      FROM activities a LEFT JOIN users u ON u.id = a.userId LEFT JOIN leads l ON l.id = a.leadId
      WHERE a.id IN (${sql.join(rowIds.map(id => sql`${id}`), sql`, `)})
    `);
    return (rows as any)[0] ?? [];
  }

  return [];
}

// ─── Snapshot Inputs Resolver ─────────────────────────────────────────────────

export async function getSnapshotInputs(params: AuditParams, rowIds: number[]): Promise<any[]> {
  const db = await getDb();
  if (!db || rowIds.length === 0) return [];
  const { metricId } = params;

  // Determine entity type from metric
  let entityType = "lead";
  if (["agent_wonDeals", "team_wonDeals", "funnel_dealSummary"].includes(metricId)) entityType = "deal";
  if (["agent_totalActivities", "sla_activityByType"].includes(metricId)) entityType = "activity";

  // Check if ui_input_snapshots table exists
  try {
    const snapshots = await db.execute(sql`
      SELECT s.*, u.name as actorName
      FROM ui_input_snapshots s
      LEFT JOIN users u ON u.id = s.actorUserId
      WHERE s.entityType = ${entityType}
        AND s.entityId IN (${sql.join(rowIds.map(id => sql`${id}`), sql`, `)})
      ORDER BY s.createdAt DESC
    `);
    const rows = (snapshots as any)[0] ?? [];
    // Mark any row IDs without snapshots
    const snapshotEntityIds = new Set(rows.map((r: any) => Number(r.entityId)));
    const missing = rowIds.filter((id) => !snapshotEntityIds.has(id)).map((id) => ({
      entityId: id,
      entityType,
      snapshotStatus: "NO_SNAPSHOT_AVAILABLE",
      note: "This record was created before snapshot logging was enabled",
    }));
    return [...rows, ...missing];
  } catch {
    // Table doesn't exist yet — return placeholder for all
    return rowIds.map((id) => ({
      entityId: id,
      entityType,
      snapshotStatus: "NO_SNAPSHOT_AVAILABLE",
      note: "Snapshot logging table not yet created — this is a historical record",
    }));
  }
}

// ─── Mismatch Analyzer ────────────────────────────────────────────────────────

function analyzeMismatches(
  params: AuditParams,
  dashVal: any,
  dbVal: any,
  def: MetricDefinition,
): string[] {
  const reasons: string[] = [];

  if (typeof dashVal === "number" && typeof dbVal === "number" && dashVal !== dbVal) {
    const diff = dashVal - dbVal;
    if (diff > 0) reasons.push(`Dashboard shows ${diff} more than DB — possible: soft-deleted rows included in dashboard, or date boundary off-by-one`);
    if (diff < 0) reasons.push(`DB shows ${Math.abs(diff)} more than Dashboard — possible: scope/role filtering in dashboard excludes some rows`);

    if (def.metricId.includes("wonDeals")) {
      reasons.push("Note: dashboard uses deals.createdAt; DB direct query uses same. Check if deals.closedAt vs createdAt is the intended date basis.");
    }
    if (def.metricId.includes("sla")) {
      reasons.push("Note: SLA metrics depend on leads.slaBreached flag being up-to-date. Flag staleness can cause mismatch.");
    }
    if (def.metricId.includes("Activity")) {
      reasons.push("Note: activities table may lack deletedAt filter in dashboard — dashboard may count soft-deleted activities.");
    }
  }

  if (params.viewerRole === "MediaBuyer" && def.allowedScopes.includes("mediaBuyer")) {
    reasons.push("Scope: MediaBuyer sees all leads globally (not filtered by ownerId). Ensure target user matches this context.");
  }

  if (!def.allowedDateBases.includes(params.dateBasis)) {
    reasons.push(`Date basis '${params.dateBasis}' is not the default for this metric (default: ${def.defaultDateBasis}). Mismatch expected.`);
  }

  if (typeof dashVal === "object" && typeof dbVal === "object") {
    reasons.push("Grouped datasets differ — compare stage/group keys between dashboard and DB results to find missing or extra groupings.");
  }

  return reasons;
}

// ─── Main runAudit ────────────────────────────────────────────────────────────

export async function runAudit(params: AuditParams): Promise<AuditResult> {
  const def = getMetricDefinition(params.metricId);
  if (!def) throw new Error(`Unknown metricId: ${params.metricId}`);

  const [dashboardLogicValue, databaseValue] = await Promise.all([
    resolveDashboardValue(params),
    resolveDbValue(params),
  ]);

  const rawRows = await getRawRows(params, 5); // just for count
  const rawRowCount = rawRows.length;

  const { status, reasons: baseReasons } = computeMatchStatus(dashboardLogicValue, databaseValue);
  const mismatchReasons = [...baseReasons, ...analyzeMismatches(params, dashboardLogicValue, databaseValue, def)];

  let difference: any = null;
  if (typeof dashboardLogicValue === "number" && typeof databaseValue === "number") {
    difference = dashboardLogicValue - databaseValue;
  }

  return {
    dashboardLogicValue,
    databaseValue,
    difference,
    matchStatus: status,
    mismatchReasons,
    rawRowCount,
    relatedRowCount: 0,
    definition: def,
    supportsExcelExport: true,
  };
}

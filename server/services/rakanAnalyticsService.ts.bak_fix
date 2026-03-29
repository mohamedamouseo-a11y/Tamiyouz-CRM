import mysql from "mysql2/promise";
import type { RakanDateRangeInput, RakanDateRangeResolved } from "./rakanExecutiveTypes";

export type ExecutiveUserRole =
  | "Admin"
  | "admin"
  | "SalesManager"
  | "SalesAgent"
  | "MediaBuyer"
  | "AccountManager"
  | "AccountManagerLead";

let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  if (!_pool) throw new Error("Pool not initialized");
  return _pool;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveDateRange(input?: RakanDateRangeInput): RakanDateRangeResolved {
  const now = new Date();
  const dateTo = input?.dateTo ? new Date(input.dateTo) : now;
  const dateFrom = input?.dateFrom
    ? new Date(input.dateFrom)
    : new Date(dateTo.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    throw new Error("Invalid date range");
  }

  if (dateFrom > dateTo) {
    throw new Error("dateFrom cannot be after dateTo");
  }

  return {
    dateFrom: formatDateOnly(dateFrom),
    dateTo: formatDateOnly(dateTo),
  };
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function makeLeadScope(role: ExecutiveUserRole, userId: number): { clause: string; params: Array<string | number> } {
  if (role === "SalesAgent") {
    return { clause: " AND l.ownerId = ? ", params: [userId] };
  }
  if (role === "SalesManager") {
    return {
      clause:
        " AND EXISTS (SELECT 1 FROM users u WHERE u.id = l.ownerId AND u.deletedAt IS NULL AND u.role = 'SalesAgent') ",
      params: [],
    };
  }
  return { clause: "", params: [] };
}

function makeClientScope(role: ExecutiveUserRole, userId: number): { clause: string; params: Array<string | number> } {
  if (role === "AccountManager") {
    return { clause: " AND c.accountManagerId = ? ", params: [userId] };
  }
  if (role === "AccountManagerLead") {
    return {
      clause:
        " AND EXISTS (SELECT 1 FROM users u WHERE u.id = c.accountManagerId AND u.deletedAt IS NULL AND u.role IN ('AccountManager', 'AccountManagerLead')) ",
      params: [],
    };
  }
  return { clause: "", params: [] };
}

function makeDealScope(role: ExecutiveUserRole, userId: number): { clause: string; params: Array<string | number> } {
  if (role === "SalesAgent") {
    return {
      clause:
        " AND EXISTS (SELECT 1 FROM leads l WHERE l.id = d.leadId AND l.ownerId = ? AND l.deletedAt IS NULL) ",
      params: [userId],
    };
  }
  if (role === "SalesManager") {
    return {
      clause:
        " AND EXISTS (SELECT 1 FROM leads l JOIN users u ON u.id = l.ownerId WHERE l.id = d.leadId AND l.deletedAt IS NULL AND u.deletedAt IS NULL AND u.role = 'SalesAgent') ",
      params: [],
    };
  }
  return { clause: "", params: [] };
}

async function queryRows<T = any>(query: string, params: Array<string | number | null> = []): Promise<T[]> {
  const pool = getPool();
  const [rows] = await pool.execute(query, params);
  return rows as T[];
}

export interface ExecutiveSummaryResult {
  dateRange: RakanDateRangeResolved;
  metrics: {
    leadsInRange: number;
    leadsWithoutOwner: number;
    wonDeals: number;
    wonValue: number;
    pendingDeals: number;
    riskyClients: number;
    renewalsDue: number;
    staleLeads: number;
    coldWithoutActivity: number;
  };
  stageBreakdown: Array<{ stage: string; total: number }>;
  ownerBacklog: Array<{ ownerName: string; activeLeads: number; staleLeads: number; coldTagged: number }>;
  topAttentionLeads: Array<{
    leadId: number;
    leadName: string;
    phone: string;
    stage: string;
    leadQuality: string;
    ownerName: string | null;
    createdAt: string;
    lastActivityAt: string | null;
    inactivityHours: number;
  }>;
}

export async function getExecutiveSummary(
  input: RakanDateRangeInput | undefined,
  role: ExecutiveUserRole,
  userId: number,
): Promise<ExecutiveSummaryResult> {
  const range = resolveDateRange(input);
  const leadScope = makeLeadScope(role, userId);
  const clientScope = makeClientScope(role, userId);
  const dealScope = makeDealScope(role, userId);

  const leadMetricsRows = await queryRows<any>(
    `SELECT
       COUNT(*) AS leadsInRange,
       SUM(CASE WHEN (l.ownerId IS NULL OR l.ownerId = 0) THEN 1 ELSE 0 END) AS leadsWithoutOwner,
       SUM(CASE WHEN l.stage = 'Cold' THEN 1 ELSE 0 END) AS coldTagged,
       SUM(CASE WHEN (last_activity.lastActivityAt IS NULL OR last_activity.lastActivityAt < DATE_SUB(NOW(), INTERVAL 72 HOUR))
                 AND l.stage NOT IN ('Won', 'Lost', 'Bad', 'Cold') THEN 1 ELSE 0 END) AS staleLeads,
       SUM(CASE WHEN l.stage = 'Cold' AND last_activity.lastActivityAt IS NULL THEN 1 ELSE 0 END) AS coldWithoutActivity
     FROM leads l
     LEFT JOIN (
       SELECT leadId, MAX(activityTime) AS lastActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) last_activity ON last_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       ${leadScope.clause}`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const dealMetricsRows = await queryRows<any>(
    `SELECT
       SUM(CASE WHEN d.status = 'Won' THEN 1 ELSE 0 END) AS wonDeals,
       SUM(CASE WHEN d.status = 'Won' THEN COALESCE(d.valueSar, 0) ELSE 0 END) AS wonValue,
       SUM(CASE WHEN d.status = 'Pending' THEN 1 ELSE 0 END) AS pendingDeals
     FROM deals d
     WHERE d.deletedAt IS NULL
       AND DATE(d.createdAt) BETWEEN ? AND ?
       ${dealScope.clause}`,
    [range.dateFrom, range.dateTo, ...dealScope.params],
  );

  const clientMetricRows = await queryRows<any>(
    `SELECT
       SUM(CASE WHEN COALESCE(c.healthScore, 0) < 50 THEN 1 ELSE 0 END) AS riskyClients,
       SUM(CASE WHEN ct.endDate IS NOT NULL AND DATE(ct.endDate) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS renewalsDue
     FROM clients c
     LEFT JOIN contracts ct ON ct.clientId = c.id AND ct.deletedAt IS NULL
     WHERE c.deletedAt IS NULL
       ${clientScope.clause}`,
    [...clientScope.params],
  );

  const stageBreakdown = await queryRows<any>(
    `SELECT l.stage, COUNT(*) AS total
     FROM leads l
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       ${leadScope.clause}
     GROUP BY l.stage
     ORDER BY total DESC
     LIMIT 10`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const ownerBacklog = await queryRows<any>(
    `SELECT
       COALESCE(u.name, 'غير محدد') AS ownerName,
       COUNT(*) AS activeLeads,
       SUM(CASE WHEN (last_activity.lastActivityAt IS NULL OR last_activity.lastActivityAt < DATE_SUB(NOW(), INTERVAL 72 HOUR))
                 AND l.stage NOT IN ('Won', 'Lost', 'Bad', 'Cold') THEN 1 ELSE 0 END) AS staleLeads,
       SUM(CASE WHEN l.stage = 'Cold' THEN 1 ELSE 0 END) AS coldTagged
     FROM leads l
     LEFT JOIN users u ON u.id = l.ownerId
     LEFT JOIN (
       SELECT leadId, MAX(activityTime) AS lastActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) last_activity ON last_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       ${leadScope.clause}
     GROUP BY u.id, u.name
     ORDER BY staleLeads DESC, activeLeads DESC
     LIMIT 10`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const topAttentionLeads = await queryRows<any>(
    `SELECT
       l.id AS leadId,
       COALESCE(NULLIF(TRIM(l.name), ''), CONCAT('Lead #', l.id)) AS leadName,
       l.phone,
       l.stage,
       l.leadQuality,
       u.name AS ownerName,
       l.createdAt,
       last_activity.lastActivityAt,
       TIMESTAMPDIFF(HOUR, COALESCE(last_activity.lastActivityAt, l.createdAt), NOW()) AS inactivityHours
     FROM leads l
     LEFT JOIN users u ON u.id = l.ownerId
     LEFT JOIN (
       SELECT leadId, MAX(activityTime) AS lastActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) last_activity ON last_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       AND (
         l.ownerId IS NULL
         OR last_activity.lastActivityAt IS NULL
         OR last_activity.lastActivityAt < DATE_SUB(NOW(), INTERVAL 72 HOUR)
         OR (l.stage = 'Cold' AND last_activity.lastActivityAt IS NULL)
       )
       ${leadScope.clause}
     ORDER BY inactivityHours DESC, l.createdAt ASC
     LIMIT 20`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const leadMetrics = leadMetricsRows[0] ?? {};
  const dealMetrics = dealMetricsRows[0] ?? {};
  const clientMetrics = clientMetricRows[0] ?? {};

  return {
    dateRange: range,
    metrics: {
      leadsInRange: toNumber(leadMetrics.leadsInRange),
      leadsWithoutOwner: toNumber(leadMetrics.leadsWithoutOwner),
      wonDeals: toNumber(dealMetrics.wonDeals),
      wonValue: toNumber(dealMetrics.wonValue),
      pendingDeals: toNumber(dealMetrics.pendingDeals),
      riskyClients: toNumber(clientMetrics.riskyClients),
      renewalsDue: toNumber(clientMetrics.renewalsDue),
      staleLeads: toNumber(leadMetrics.staleLeads),
      coldWithoutActivity: toNumber(leadMetrics.coldWithoutActivity),
    },
    stageBreakdown: stageBreakdown.map((row) => ({ stage: row.stage ?? "Unknown", total: toNumber(row.total) })),
    ownerBacklog: ownerBacklog.map((row) => ({
      ownerName: row.ownerName ?? "غير محدد",
      activeLeads: toNumber(row.activeLeads),
      staleLeads: toNumber(row.staleLeads),
      coldTagged: toNumber(row.coldTagged),
    })),
    topAttentionLeads: topAttentionLeads.map((row) => ({
      leadId: toNumber(row.leadId),
      leadName: row.leadName,
      phone: row.phone,
      stage: row.stage,
      leadQuality: row.leadQuality,
      ownerName: row.ownerName,
      createdAt: row.createdAt,
      lastActivityAt: row.lastActivityAt,
      inactivityHours: toNumber(row.inactivityHours),
    })),
  };
}

export interface SalesPerformanceResult {
  dateRange: RakanDateRangeResolved;
  agentPerformance: Array<{
    ownerId: number | null;
    ownerName: string;
    totalLeads: number;
    freshLeads: number;
    staleLeads: number;
    coldTagged: number;
    wonDeals: number;
    wonValue: number;
    avgFirstResponseHours: number;
  }>;
  stalledLeads: Array<{
    leadId: number;
    leadName: string;
    ownerName: string | null;
    stage: string;
    leadQuality: string;
    inactivityHours: number;
    createdAt: string;
    lastActivityAt: string | null;
  }>;
}

export async function getSalesPerformanceReport(
  input: RakanDateRangeInput | undefined,
  role: ExecutiveUserRole,
  userId: number,
): Promise<SalesPerformanceResult> {
  const range = resolveDateRange(input);
  const leadScope = makeLeadScope(role, userId);

  const agentPerformance = await queryRows<any>(
    `SELECT
       u.id AS ownerId,
       COALESCE(u.name, 'غير محدد') AS ownerName,
       COUNT(l.id) AS totalLeads,
       SUM(CASE WHEN DATE(l.createdAt) >= DATE_SUB(CURDATE(), INTERVAL 3 DAY) THEN 1 ELSE 0 END) AS freshLeads,
       SUM(CASE WHEN (last_activity.lastActivityAt IS NULL OR last_activity.lastActivityAt < DATE_SUB(NOW(), INTERVAL 72 HOUR))
                 AND l.stage NOT IN ('Won', 'Lost', 'Bad', 'Cold') THEN 1 ELSE 0 END) AS staleLeads,
       SUM(CASE WHEN l.stage = 'Cold' THEN 1 ELSE 0 END) AS coldTagged,
       SUM(CASE WHEN d.status = 'Won' THEN 1 ELSE 0 END) AS wonDeals,
       SUM(CASE WHEN d.status = 'Won' THEN COALESCE(d.valueSar, 0) ELSE 0 END) AS wonValue,
       AVG(CASE
            WHEN first_activity.firstActivityAt IS NOT NULL THEN TIMESTAMPDIFF(HOUR, l.createdAt, first_activity.firstActivityAt)
            ELSE NULL
          END) AS avgFirstResponseHours
     FROM leads l
     LEFT JOIN users u ON u.id = l.ownerId
     LEFT JOIN deals d ON d.leadId = l.id AND d.deletedAt IS NULL
     LEFT JOIN (
       SELECT leadId, MIN(activityTime) AS firstActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) first_activity ON first_activity.leadId = l.id
     LEFT JOIN (
       SELECT leadId, MAX(activityTime) AS lastActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) last_activity ON last_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       ${leadScope.clause}
     GROUP BY u.id, u.name
     ORDER BY staleLeads DESC, totalLeads DESC
     LIMIT 20`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const stalledLeads = await queryRows<any>(
    `SELECT
       l.id AS leadId,
       COALESCE(NULLIF(TRIM(l.name), ''), CONCAT('Lead #', l.id)) AS leadName,
       u.name AS ownerName,
       l.stage,
       l.leadQuality,
       TIMESTAMPDIFF(HOUR, COALESCE(last_activity.lastActivityAt, l.createdAt), NOW()) AS inactivityHours,
       l.createdAt,
       last_activity.lastActivityAt
     FROM leads l
     LEFT JOIN users u ON u.id = l.ownerId
     LEFT JOIN (
       SELECT leadId, MAX(activityTime) AS lastActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) last_activity ON last_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       AND (last_activity.lastActivityAt IS NULL OR last_activity.lastActivityAt < DATE_SUB(NOW(), INTERVAL 72 HOUR))
       AND l.stage NOT IN ('Won', 'Lost', 'Bad', 'Cold')
       ${leadScope.clause}
     ORDER BY inactivityHours DESC, l.createdAt ASC
     LIMIT 30`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  return {
    dateRange: range,
    agentPerformance: agentPerformance.map((row) => ({
      ownerId: row.ownerId == null ? null : toNumber(row.ownerId),
      ownerName: row.ownerName ?? "غير محدد",
      totalLeads: toNumber(row.totalLeads),
      freshLeads: toNumber(row.freshLeads),
      staleLeads: toNumber(row.staleLeads),
      coldTagged: toNumber(row.coldTagged),
      wonDeals: toNumber(row.wonDeals),
      wonValue: toNumber(row.wonValue),
      avgFirstResponseHours: Number(toNumber(row.avgFirstResponseHours).toFixed(1)),
    })),
    stalledLeads: stalledLeads.map((row) => ({
      leadId: toNumber(row.leadId),
      leadName: row.leadName,
      ownerName: row.ownerName,
      stage: row.stage,
      leadQuality: row.leadQuality,
      inactivityHours: toNumber(row.inactivityHours),
      createdAt: row.createdAt,
      lastActivityAt: row.lastActivityAt,
    })),
  };
}

export interface AccountManagersResult {
  dateRange: RakanDateRangeResolved;
  managerPerformance: Array<{
    accountManagerId: number | null;
    accountManagerName: string;
    totalClients: number;
    riskyClients: number;
    missingHealthScore: number;
    overdueFollowUps: number;
    renewalsDue30Days: number;
  }>;
  riskyClients: Array<{
    clientId: number;
    clientName: string;
    accountManagerName: string | null;
    healthScore: number;
    lastFollowUpDate: string | null;
    nextFollowUpDate: string | null;
    renewalEndDate: string | null;
  }>;
}

export async function getAccountManagersReport(
  input: RakanDateRangeInput | undefined,
  role: ExecutiveUserRole,
  userId: number,
): Promise<AccountManagersResult> {
  const range = resolveDateRange(input);
  const clientScope = makeClientScope(role, userId);

  const managerPerformance = await queryRows<any>(
    `SELECT
       u.id AS accountManagerId,
       COALESCE(u.name, 'غير محدد') AS accountManagerName,
       COUNT(c.id) AS totalClients,
       SUM(CASE WHEN COALESCE(c.healthScore, 0) < 50 THEN 1 ELSE 0 END) AS riskyClients,
       SUM(CASE WHEN c.healthScore IS NULL OR c.healthScore = 0 THEN 1 ELSE 0 END) AS missingHealthScore,
       SUM(CASE WHEN c.nextFollowUpDate IS NULL OR c.nextFollowUpDate < NOW() THEN 1 ELSE 0 END) AS overdueFollowUps,
       SUM(CASE WHEN ct.endDate IS NOT NULL AND DATE(ct.endDate) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS renewalsDue30Days
     FROM clients c
     LEFT JOIN users u ON u.id = c.accountManagerId
     LEFT JOIN contracts ct ON ct.clientId = c.id AND ct.deletedAt IS NULL
     WHERE c.deletedAt IS NULL
       AND DATE(c.createdAt) BETWEEN ? AND ?
       ${clientScope.clause}
     GROUP BY u.id, u.name
     ORDER BY riskyClients DESC, overdueFollowUps DESC, totalClients DESC
     LIMIT 20`,
    [range.dateFrom, range.dateTo, ...clientScope.params],
  );

  const riskyClients = await queryRows<any>(
    `SELECT
       c.id AS clientId,
       COALESCE(NULLIF(TRIM(c.leadName), ''), CONCAT('Client #', c.id)) AS clientName,
       u.name AS accountManagerName,
       COALESCE(c.healthScore, 0) AS healthScore,
       c.lastFollowUpDate,
       c.nextFollowUpDate,
       MIN(ct.endDate) AS renewalEndDate
     FROM clients c
     LEFT JOIN users u ON u.id = c.accountManagerId
     LEFT JOIN contracts ct ON ct.clientId = c.id AND ct.deletedAt IS NULL
     WHERE c.deletedAt IS NULL
       AND DATE(c.createdAt) BETWEEN ? AND ?
       AND (
         COALESCE(c.healthScore, 0) < 50
         OR c.nextFollowUpDate IS NULL
         OR c.nextFollowUpDate < NOW()
         OR c.lastFollowUpDate IS NULL
         OR c.lastFollowUpDate < DATE_SUB(NOW(), INTERVAL 14 DAY)
       )
       ${clientScope.clause}
     GROUP BY c.id, c.leadName, u.name, c.healthScore, c.lastFollowUpDate, c.nextFollowUpDate
     ORDER BY healthScore ASC, c.nextFollowUpDate ASC
     LIMIT 30`,
    [range.dateFrom, range.dateTo, ...clientScope.params],
  );

  return {
    dateRange: range,
    managerPerformance: managerPerformance.map((row) => ({
      accountManagerId: row.accountManagerId == null ? null : toNumber(row.accountManagerId),
      accountManagerName: row.accountManagerName ?? "غير محدد",
      totalClients: toNumber(row.totalClients),
      riskyClients: toNumber(row.riskyClients),
      missingHealthScore: toNumber(row.missingHealthScore),
      overdueFollowUps: toNumber(row.overdueFollowUps),
      renewalsDue30Days: toNumber(row.renewalsDue30Days),
    })),
    riskyClients: riskyClients.map((row) => ({
      clientId: toNumber(row.clientId),
      clientName: row.clientName,
      accountManagerName: row.accountManagerName,
      healthScore: toNumber(row.healthScore),
      lastFollowUpDate: row.lastFollowUpDate,
      nextFollowUpDate: row.nextFollowUpDate,
      renewalEndDate: row.renewalEndDate,
    })),
  };
}

export interface DataQualityResult {
  dateRange: RakanDateRangeResolved;
  summary: {
    leadsWithoutOwner: number;
    leadsWithoutName: number;
    leadsWithoutCampaign: number;
    leadsWithoutRecentActivity: number;
    coldWithoutActivity: number;
    clientsWithoutAccountManager: number;
    clientsWithoutHealthScore: number;
    clientsMissingContactData: number;
    contractsWithoutEndDate: number;
    duplicatePhones: number;
  };
  leadIssues: Array<{
    leadId: number;
    leadName: string;
    phone: string;
    ownerName: string | null;
    stage: string;
    leadQuality: string;
    issueType: string;
    createdAt: string;
  }>;
  clientIssues: Array<{
    clientId: number;
    clientName: string;
    accountManagerName: string | null;
    issueType: string;
    healthScore: number;
    contactPhone: string | null;
    contactEmail: string | null;
  }>;
}

export async function getDataQualityIssues(
  input: RakanDateRangeInput | undefined,
  role: ExecutiveUserRole,
  userId: number,
): Promise<DataQualityResult> {
  const range = resolveDateRange(input);
  const leadScope = makeLeadScope(role, userId);
  const clientScope = makeClientScope(role, userId);

  const summaryRows = await queryRows<any>(
    `SELECT
       SUM(CASE WHEN l.ownerId IS NULL OR l.ownerId = 0 THEN 1 ELSE 0 END) AS leadsWithoutOwner,
       SUM(CASE WHEN l.name IS NULL OR TRIM(l.name) = '' THEN 1 ELSE 0 END) AS leadsWithoutName,
       SUM(CASE WHEN l.campaignName IS NULL OR TRIM(l.campaignName) = '' THEN 1 ELSE 0 END) AS leadsWithoutCampaign,
       SUM(CASE WHEN last_activity.lastActivityAt IS NULL OR last_activity.lastActivityAt < DATE_SUB(NOW(), INTERVAL 72 HOUR) THEN 1 ELSE 0 END) AS leadsWithoutRecentActivity,
       SUM(CASE WHEN l.stage = 'Cold' AND last_activity.lastActivityAt IS NULL THEN 1 ELSE 0 END) AS coldWithoutActivity
     FROM leads l
     LEFT JOIN (
       SELECT leadId, MAX(activityTime) AS lastActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) last_activity ON last_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       ${leadScope.clause}`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const clientSummaryRows = await queryRows<any>(
    `SELECT
       SUM(CASE WHEN c.accountManagerId IS NULL OR c.accountManagerId = 0 THEN 1 ELSE 0 END) AS clientsWithoutAccountManager,
       SUM(CASE WHEN c.healthScore IS NULL OR c.healthScore = 0 THEN 1 ELSE 0 END) AS clientsWithoutHealthScore,
       SUM(CASE WHEN (c.contactPhone IS NULL OR TRIM(c.contactPhone) = '') AND (c.contactEmail IS NULL OR TRIM(c.contactEmail) = '') THEN 1 ELSE 0 END) AS clientsMissingContactData,
       SUM(CASE WHEN ct.id IS NOT NULL AND ct.endDate IS NULL THEN 1 ELSE 0 END) AS contractsWithoutEndDate
     FROM clients c
     LEFT JOIN contracts ct ON ct.clientId = c.id AND ct.deletedAt IS NULL
     WHERE c.deletedAt IS NULL
       AND DATE(c.createdAt) BETWEEN ? AND ?
       ${clientScope.clause}`,
    [range.dateFrom, range.dateTo, ...clientScope.params],
  );

  const duplicatePhoneRows = await queryRows<any>(
    `SELECT COUNT(*) AS duplicatePhones
     FROM (
       SELECT l.phone
       FROM leads l
       WHERE l.deletedAt IS NULL
         AND DATE(l.createdAt) BETWEEN ? AND ?
         AND l.phone IS NOT NULL
         AND TRIM(l.phone) <> ''
         ${leadScope.clause}
       GROUP BY l.phone
       HAVING COUNT(*) > 1
     ) dup`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const leadIssues = await queryRows<any>(
    `SELECT * FROM (
       SELECT
         l.id AS leadId,
         COALESCE(NULLIF(TRIM(l.name), ''), CONCAT('Lead #', l.id)) AS leadName,
         l.phone,
         u.name AS ownerName,
         l.stage,
         l.leadQuality,
         'بدون مسؤول' AS issueType,
         l.createdAt
       FROM leads l
       LEFT JOIN users u ON u.id = l.ownerId
       WHERE l.deletedAt IS NULL
         AND DATE(l.createdAt) BETWEEN ? AND ?
         AND (l.ownerId IS NULL OR l.ownerId = 0)
         ${leadScope.clause}

       UNION ALL

       SELECT
         l.id,
         COALESCE(NULLIF(TRIM(l.name), ''), CONCAT('Lead #', l.id)),
         l.phone,
         u.name,
         l.stage,
         l.leadQuality,
         'Cold بدون أي Activity' AS issueType,
         l.createdAt
       FROM leads l
       LEFT JOIN users u ON u.id = l.ownerId
       WHERE l.deletedAt IS NULL
         AND DATE(l.createdAt) BETWEEN ? AND ?
         AND l.stage = 'Cold'
         AND NOT EXISTS (
           SELECT 1 FROM activities a WHERE a.leadId = l.id AND a.deletedAt IS NULL
         )
         ${leadScope.clause}

       UNION ALL

       SELECT
         l.id,
         COALESCE(NULLIF(TRIM(l.name), ''), CONCAT('Lead #', l.id)),
         l.phone,
         u.name,
         l.stage,
         l.leadQuality,
         'بيانات أساسية ناقصة' AS issueType,
         l.createdAt
       FROM leads l
       LEFT JOIN users u ON u.id = l.ownerId
       WHERE l.deletedAt IS NULL
         AND DATE(l.createdAt) BETWEEN ? AND ?
         AND (
           l.name IS NULL OR TRIM(l.name) = ''
           OR l.campaignName IS NULL OR TRIM(l.campaignName) = ''
         )
         ${leadScope.clause}
     ) issues
     ORDER BY createdAt DESC
     LIMIT 40`,
    [
      range.dateFrom,
      range.dateTo,
      ...leadScope.params,
      range.dateFrom,
      range.dateTo,
      ...leadScope.params,
      range.dateFrom,
      range.dateTo,
      ...leadScope.params,
    ],
  );

  const clientIssues = await queryRows<any>(
    `SELECT * FROM (
       SELECT
         c.id AS clientId,
         COALESCE(NULLIF(TRIM(c.leadName), ''), CONCAT('Client #', c.id)) AS clientName,
         u.name AS accountManagerName,
         'بدون Account Manager' AS issueType,
         COALESCE(c.healthScore, 0) AS healthScore,
         c.contactPhone,
         c.contactEmail
       FROM clients c
       LEFT JOIN users u ON u.id = c.accountManagerId
       WHERE c.deletedAt IS NULL
         AND DATE(c.createdAt) BETWEEN ? AND ?
         AND (c.accountManagerId IS NULL OR c.accountManagerId = 0)
         ${clientScope.clause}

       UNION ALL

       SELECT
         c.id,
         COALESCE(NULLIF(TRIM(c.leadName), ''), CONCAT('Client #', c.id)),
         u.name,
         'Health Score غير مكتمل' AS issueType,
         COALESCE(c.healthScore, 0),
         c.contactPhone,
         c.contactEmail
       FROM clients c
       LEFT JOIN users u ON u.id = c.accountManagerId
       WHERE c.deletedAt IS NULL
         AND DATE(c.createdAt) BETWEEN ? AND ?
         AND (c.healthScore IS NULL OR c.healthScore = 0)
         ${clientScope.clause}

       UNION ALL

       SELECT
         c.id,
         COALESCE(NULLIF(TRIM(c.leadName), ''), CONCAT('Client #', c.id)),
         u.name,
         'معلومات التواصل ناقصة' AS issueType,
         COALESCE(c.healthScore, 0),
         c.contactPhone,
         c.contactEmail
       FROM clients c
       LEFT JOIN users u ON u.id = c.accountManagerId
       WHERE c.deletedAt IS NULL
         AND DATE(c.createdAt) BETWEEN ? AND ?
         AND ((c.contactPhone IS NULL OR TRIM(c.contactPhone) = '') AND (c.contactEmail IS NULL OR TRIM(c.contactEmail) = ''))
         ${clientScope.clause}
     ) issues
     LIMIT 40`,
    [
      range.dateFrom,
      range.dateTo,
      ...clientScope.params,
      range.dateFrom,
      range.dateTo,
      ...clientScope.params,
      range.dateFrom,
      range.dateTo,
      ...clientScope.params,
    ],
  );

  const leadSummary = summaryRows[0] ?? {};
  const clientSummary = clientSummaryRows[0] ?? {};
  const dupSummary = duplicatePhoneRows[0] ?? {};

  return {
    dateRange: range,
    summary: {
      leadsWithoutOwner: toNumber(leadSummary.leadsWithoutOwner),
      leadsWithoutName: toNumber(leadSummary.leadsWithoutName),
      leadsWithoutCampaign: toNumber(leadSummary.leadsWithoutCampaign),
      leadsWithoutRecentActivity: toNumber(leadSummary.leadsWithoutRecentActivity),
      coldWithoutActivity: toNumber(leadSummary.coldWithoutActivity),
      clientsWithoutAccountManager: toNumber(clientSummary.clientsWithoutAccountManager),
      clientsWithoutHealthScore: toNumber(clientSummary.clientsWithoutHealthScore),
      clientsMissingContactData: toNumber(clientSummary.clientsMissingContactData),
      contractsWithoutEndDate: toNumber(clientSummary.contractsWithoutEndDate),
      duplicatePhones: toNumber(dupSummary.duplicatePhones),
    },
    leadIssues: leadIssues.map((row) => ({
      leadId: toNumber(row.leadId),
      leadName: row.leadName,
      phone: row.phone,
      ownerName: row.ownerName,
      stage: row.stage,
      leadQuality: row.leadQuality,
      issueType: row.issueType,
      createdAt: row.createdAt,
    })),
    clientIssues: clientIssues.map((row) => ({
      clientId: toNumber(row.clientId),
      clientName: row.clientName,
      accountManagerName: row.accountManagerName,
      issueType: row.issueType,
      healthScore: toNumber(row.healthScore),
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
    })),
  };
}

export interface ColdMisuseResult {
  dateRange: RakanDateRangeResolved;
  summary: {
    coldTagged: number;
    coldWithoutActivity: number;
    coldWithin24Hours: number;
  };
  offenders: Array<{ ownerName: string; coldTagged: number; suspiciousCold: number }>;
  suspiciousLeads: Array<{
    leadId: number;
    leadName: string;
    ownerName: string | null;
    createdAt: string;
    stage: string;
    leadQuality: string;
    hoursToFirstActivity: number | null;
    totalActivities: number;
    suspiciousReason: string;
  }>;
}

export async function getColdMisuseReport(
  input: RakanDateRangeInput | undefined,
  role: ExecutiveUserRole,
  userId: number,
): Promise<ColdMisuseResult> {
  const range = resolveDateRange(input);
  const leadScope = makeLeadScope(role, userId);

  const summaryRows = await queryRows<any>(
    `SELECT
       SUM(CASE WHEN l.stage = 'Cold' THEN 1 ELSE 0 END) AS coldTagged,
       SUM(CASE WHEN l.stage = 'Cold' AND activity_stats.totalActivities = 0 THEN 1 ELSE 0 END) AS coldWithoutActivity,
       SUM(CASE WHEN l.stage = 'Cold' AND TIMESTAMPDIFF(HOUR, l.createdAt, COALESCE(first_activity.firstActivityAt, l.createdAt)) <= 24 THEN 1 ELSE 0 END) AS coldWithin24Hours
     FROM leads l
     LEFT JOIN (
       SELECT leadId, COUNT(*) AS totalActivities
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) activity_stats ON activity_stats.leadId = l.id
     LEFT JOIN (
       SELECT leadId, MIN(activityTime) AS firstActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) first_activity ON first_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       ${leadScope.clause}`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const offenders = await queryRows<any>(
    `SELECT
       COALESCE(u.name, 'غير محدد') AS ownerName,
       SUM(CASE WHEN l.stage = 'Cold' THEN 1 ELSE 0 END) AS coldTagged,
       SUM(CASE WHEN l.stage = 'Cold' AND (
         activity_stats.totalActivities = 0
         OR (first_activity.firstActivityAt IS NOT NULL AND TIMESTAMPDIFF(HOUR, l.createdAt, first_activity.firstActivityAt) <= 24)
         OR l.name IS NULL OR TRIM(l.name) = ''
         OR l.campaignName IS NULL OR TRIM(l.campaignName) = ''
       ) THEN 1 ELSE 0 END) AS suspiciousCold
     FROM leads l
     LEFT JOIN users u ON u.id = l.ownerId
     LEFT JOIN (
       SELECT leadId, COUNT(*) AS totalActivities
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) activity_stats ON activity_stats.leadId = l.id
     LEFT JOIN (
       SELECT leadId, MIN(activityTime) AS firstActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) first_activity ON first_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       ${leadScope.clause}
     GROUP BY u.id, u.name
     HAVING coldTagged > 0
     ORDER BY suspiciousCold DESC, coldTagged DESC
     LIMIT 20`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const suspiciousLeads = await queryRows<any>(
    `SELECT
       l.id AS leadId,
       COALESCE(NULLIF(TRIM(l.name), ''), CONCAT('Lead #', l.id)) AS leadName,
       u.name AS ownerName,
       l.createdAt,
       l.stage,
       l.leadQuality,
       CASE
         WHEN first_activity.firstActivityAt IS NOT NULL THEN TIMESTAMPDIFF(HOUR, l.createdAt, first_activity.firstActivityAt)
         ELSE NULL
       END AS hoursToFirstActivity,
       COALESCE(activity_stats.totalActivities, 0) AS totalActivities,
       CASE
         WHEN COALESCE(activity_stats.totalActivities, 0) = 0 THEN 'Cold بدون أي Activity'
         WHEN first_activity.firstActivityAt IS NOT NULL AND TIMESTAMPDIFF(HOUR, l.createdAt, first_activity.firstActivityAt) <= 24 THEN 'تم وضع Cold بسرعة كبيرة'
         WHEN l.name IS NULL OR TRIM(l.name) = '' OR l.campaignName IS NULL OR TRIM(l.campaignName) = '' THEN 'Cold مع بيانات ناقصة'
         ELSE 'يحتاج مراجعة يدوية'
       END AS suspiciousReason
     FROM leads l
     LEFT JOIN users u ON u.id = l.ownerId
     LEFT JOIN (
       SELECT leadId, COUNT(*) AS totalActivities
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) activity_stats ON activity_stats.leadId = l.id
     LEFT JOIN (
       SELECT leadId, MIN(activityTime) AS firstActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) first_activity ON first_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       AND l.stage = 'Cold'
       AND (
         COALESCE(activity_stats.totalActivities, 0) = 0
         OR (first_activity.firstActivityAt IS NOT NULL AND TIMESTAMPDIFF(HOUR, l.createdAt, first_activity.firstActivityAt) <= 24)
         OR l.name IS NULL OR TRIM(l.name) = ''
         OR l.campaignName IS NULL OR TRIM(l.campaignName) = ''
       )
       ${leadScope.clause}
     ORDER BY l.createdAt DESC
     LIMIT 30`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const summary = summaryRows[0] ?? {};
  return {
    dateRange: range,
    summary: {
      coldTagged: toNumber(summary.coldTagged),
      coldWithoutActivity: toNumber(summary.coldWithoutActivity),
      coldWithin24Hours: toNumber(summary.coldWithin24Hours),
    },
    offenders: offenders.map((row) => ({
      ownerName: row.ownerName ?? "غير محدد",
      coldTagged: toNumber(row.coldTagged),
      suspiciousCold: toNumber(row.suspiciousCold),
    })),
    suspiciousLeads: suspiciousLeads.map((row) => ({
      leadId: toNumber(row.leadId),
      leadName: row.leadName,
      ownerName: row.ownerName,
      createdAt: row.createdAt,
      stage: row.stage,
      leadQuality: row.leadQuality,
      hoursToFirstActivity: row.hoursToFirstActivity == null ? null : toNumber(row.hoursToFirstActivity),
      totalActivities: toNumber(row.totalActivities),
      suspiciousReason: row.suspiciousReason,
    })),
  };
}

export interface FollowUpComplianceResult {
  dateRange: RakanDateRangeResolved;
  summary: {
    leadsWithoutRecentActivity: number;
    leadsWithoutAnyActivity: number;
    overdueClientFollowUps: number;
    clientsWithoutNextFollowUp: number;
  };
  ownerBreaches: Array<{ ownerName: string; stalledLeads: number; noActivityLeads: number }>;
  overdueClientItems: Array<{
    clientId: number;
    clientName: string;
    accountManagerName: string | null;
    healthScore: number;
    lastFollowUpDate: string | null;
    nextFollowUpDate: string | null;
  }>;
}

export async function getFollowUpComplianceReport(
  input: RakanDateRangeInput | undefined,
  role: ExecutiveUserRole,
  userId: number,
): Promise<FollowUpComplianceResult> {
  const range = resolveDateRange(input);
  const leadScope = makeLeadScope(role, userId);
  const clientScope = makeClientScope(role, userId);

  const leadSummaryRows = await queryRows<any>(
    `SELECT
       SUM(CASE WHEN last_activity.lastActivityAt IS NULL OR last_activity.lastActivityAt < DATE_SUB(NOW(), INTERVAL 72 HOUR) THEN 1 ELSE 0 END) AS leadsWithoutRecentActivity,
       SUM(CASE WHEN last_activity.lastActivityAt IS NULL THEN 1 ELSE 0 END) AS leadsWithoutAnyActivity
     FROM leads l
     LEFT JOIN (
       SELECT leadId, MAX(activityTime) AS lastActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) last_activity ON last_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       AND l.stage NOT IN ('Won', 'Lost', 'Bad')
       ${leadScope.clause}`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const clientSummaryRows = await queryRows<any>(
    `SELECT
       SUM(CASE WHEN c.nextFollowUpDate IS NOT NULL AND c.nextFollowUpDate < NOW() THEN 1 ELSE 0 END) AS overdueClientFollowUps,
       SUM(CASE WHEN c.nextFollowUpDate IS NULL THEN 1 ELSE 0 END) AS clientsWithoutNextFollowUp
     FROM clients c
     WHERE c.deletedAt IS NULL
       AND DATE(c.createdAt) BETWEEN ? AND ?
       ${clientScope.clause}`,
    [range.dateFrom, range.dateTo, ...clientScope.params],
  );

  const ownerBreaches = await queryRows<any>(
    `SELECT
       COALESCE(u.name, 'غير محدد') AS ownerName,
       SUM(CASE WHEN last_activity.lastActivityAt IS NULL OR last_activity.lastActivityAt < DATE_SUB(NOW(), INTERVAL 72 HOUR) THEN 1 ELSE 0 END) AS stalledLeads,
       SUM(CASE WHEN last_activity.lastActivityAt IS NULL THEN 1 ELSE 0 END) AS noActivityLeads
     FROM leads l
     LEFT JOIN users u ON u.id = l.ownerId
     LEFT JOIN (
       SELECT leadId, MAX(activityTime) AS lastActivityAt
       FROM activities
       WHERE deletedAt IS NULL
       GROUP BY leadId
     ) last_activity ON last_activity.leadId = l.id
     WHERE l.deletedAt IS NULL
       AND DATE(l.createdAt) BETWEEN ? AND ?
       AND l.stage NOT IN ('Won', 'Lost', 'Bad')
       ${leadScope.clause}
     GROUP BY u.id, u.name
     ORDER BY stalledLeads DESC, noActivityLeads DESC
     LIMIT 20`,
    [range.dateFrom, range.dateTo, ...leadScope.params],
  );

  const overdueClientItems = await queryRows<any>(
    `SELECT
       c.id AS clientId,
       COALESCE(NULLIF(TRIM(c.leadName), ''), CONCAT('Client #', c.id)) AS clientName,
       u.name AS accountManagerName,
       COALESCE(c.healthScore, 0) AS healthScore,
       c.lastFollowUpDate,
       c.nextFollowUpDate
     FROM clients c
     LEFT JOIN users u ON u.id = c.accountManagerId
     WHERE c.deletedAt IS NULL
       AND DATE(c.createdAt) BETWEEN ? AND ?
       AND (
         c.nextFollowUpDate IS NULL
         OR c.nextFollowUpDate < NOW()
         OR c.lastFollowUpDate IS NULL
         OR c.lastFollowUpDate < DATE_SUB(NOW(), INTERVAL 14 DAY)
       )
       ${clientScope.clause}
     ORDER BY c.nextFollowUpDate ASC, c.lastFollowUpDate ASC
     LIMIT 30`,
    [range.dateFrom, range.dateTo, ...clientScope.params],
  );

  const leadSummary = leadSummaryRows[0] ?? {};
  const clientSummary = clientSummaryRows[0] ?? {};
  return {
    dateRange: range,
    summary: {
      leadsWithoutRecentActivity: toNumber(leadSummary.leadsWithoutRecentActivity),
      leadsWithoutAnyActivity: toNumber(leadSummary.leadsWithoutAnyActivity),
      overdueClientFollowUps: toNumber(clientSummary.overdueClientFollowUps),
      clientsWithoutNextFollowUp: toNumber(clientSummary.clientsWithoutNextFollowUp),
    },
    ownerBreaches: ownerBreaches.map((row) => ({
      ownerName: row.ownerName ?? "غير محدد",
      stalledLeads: toNumber(row.stalledLeads),
      noActivityLeads: toNumber(row.noActivityLeads),
    })),
    overdueClientItems: overdueClientItems.map((row) => ({
      clientId: toNumber(row.clientId),
      clientName: row.clientName,
      accountManagerName: row.accountManagerName,
      healthScore: toNumber(row.healthScore),
      lastFollowUpDate: row.lastFollowUpDate,
      nextFollowUpDate: row.nextFollowUpDate,
    })),
  };
}

export interface RenewalsRiskResult {
  dateRange: RakanDateRangeResolved;
  summary: {
    renewalsDue30Days: number;
    renewalsWithoutOwner: number;
    renewalsAtRisk: number;
  };
  renewals: Array<{
    contractId: number;
    clientId: number;
    clientName: string;
    renewalAssignedToName: string | null;
    contractRenewalStatus: string | null;
    endDate: string | null;
    charges: number;
    status: string;
  }>;
}

export async function getRenewalsRiskReport(
  input: RakanDateRangeInput | undefined,
  role: ExecutiveUserRole,
  userId: number,
): Promise<RenewalsRiskResult> {
  const range = resolveDateRange(input);
  const clientScope = makeClientScope(role, userId);

  const renewals = await queryRows<any>(
    `SELECT
       ct.id AS contractId,
       c.id AS clientId,
       COALESCE(NULLIF(TRIM(c.leadName), ''), CONCAT('Client #', c.id)) AS clientName,
       u.name AS renewalAssignedToName,
       ct.contractRenewalStatus,
       ct.endDate,
       COALESCE(ct.charges, 0) AS charges,
       ct.status
     FROM contracts ct
     JOIN clients c ON c.id = ct.clientId AND c.deletedAt IS NULL
     LEFT JOIN users u ON u.id = ct.renewalAssignedTo
     WHERE ct.deletedAt IS NULL
       AND DATE(ct.createdAt) BETWEEN ? AND ?
       AND ct.endDate IS NOT NULL
       AND DATE(ct.endDate) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       ${clientScope.clause}
     ORDER BY ct.endDate ASC
     LIMIT 50`,
    [range.dateFrom, range.dateTo, ...clientScope.params],
  );

  const summary = {
    renewalsDue30Days: renewals.length,
    renewalsWithoutOwner: renewals.filter((row) => !row.renewalAssignedToName).length,
    renewalsAtRisk: renewals.filter((row) => !["Won", "Renewed", "New"].includes(String(row.contractRenewalStatus ?? ""))).length,
  };

  return {
    dateRange: range,
    summary,
    renewals: renewals.map((row) => ({
      contractId: toNumber(row.contractId),
      clientId: toNumber(row.clientId),
      clientName: row.clientName,
      renewalAssignedToName: row.renewalAssignedToName,
      contractRenewalStatus: row.contractRenewalStatus,
      endDate: row.endDate,
      charges: toNumber(row.charges),
      status: row.status,
    })),
  };
}

export interface CampaignEfficiencyResult {
  dateRange: RakanDateRangeResolved;
  leadMixByCampaign: Array<{
    campaignName: string;
    totalLeads: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    badLeads: number;
  }>;
  tiktokPerformance: Array<{
    campaignName: string;
    spend: number;
    conversions: number;
    cpa: number;
    clicks: number;
    ctr: number;
  }>;
  metaBudgetSignals: Array<{
    campaignName: string;
    dailyBudget: number;
    lifetimeBudget: number;
    status: string | null;
    syncedAt: string;
  }>;
}

export async function getCampaignEfficiencyReport(input?: RakanDateRangeInput): Promise<CampaignEfficiencyResult> {
  const range = resolveDateRange(input);

  const leadMixByCampaign = await queryRows<any>(
    `SELECT
       COALESCE(NULLIF(TRIM(campaignName), ''), 'Direct / Unknown') AS campaignName,
       COUNT(*) AS totalLeads,
       SUM(CASE WHEN leadQuality = 'Hot' THEN 1 ELSE 0 END) AS hotLeads,
       SUM(CASE WHEN leadQuality = 'Warm' THEN 1 ELSE 0 END) AS warmLeads,
       SUM(CASE WHEN leadQuality = 'Cold' THEN 1 ELSE 0 END) AS coldLeads,
       SUM(CASE WHEN leadQuality = 'Bad' THEN 1 ELSE 0 END) AS badLeads
     FROM leads
     WHERE deletedAt IS NULL
       AND DATE(createdAt) BETWEEN ? AND ?
     GROUP BY COALESCE(NULLIF(TRIM(campaignName), ''), 'Direct / Unknown')
     ORDER BY totalLeads DESC
     LIMIT 25`,
    [range.dateFrom, range.dateTo],
  );

  const tiktokPerformance = await queryRows<any>(
    `SELECT
       COALESCE(NULLIF(TRIM(campaignName), ''), CONCAT('Campaign #', campaignId)) AS campaignName,
       SUM(COALESCE(spend, 0)) AS spend,
       SUM(COALESCE(conversions, 0)) AS conversions,
       AVG(COALESCE(cpa, 0)) AS cpa,
       SUM(COALESCE(clicks, 0)) AS clicks,
       AVG(COALESCE(ctr, 0)) AS ctr
     FROM tiktok_campaign_snapshots
     WHERE DATE(createdAt) BETWEEN ? AND ?
     GROUP BY COALESCE(NULLIF(TRIM(campaignName), ''), CONCAT('Campaign #', campaignId))
     ORDER BY spend DESC
     LIMIT 25`,
    [range.dateFrom, range.dateTo],
  );

  const metaBudgetSignals = await queryRows<any>(
    `SELECT
       COALESCE(NULLIF(TRIM(campaignName), ''), CONCAT('Campaign #', campaignId)) AS campaignName,
       COALESCE(dailyBudget, 0) AS dailyBudget,
       COALESCE(lifetimeBudget, 0) AS lifetimeBudget,
       status,
       syncedAt
     FROM meta_campaign_snapshots
     WHERE DATE(createdAt) BETWEEN ? AND ?
     ORDER BY syncedAt DESC
     LIMIT 25`,
    [range.dateFrom, range.dateTo],
  );

  return {
    dateRange: range,
    leadMixByCampaign: leadMixByCampaign.map((row) => ({
      campaignName: row.campaignName,
      totalLeads: toNumber(row.totalLeads),
      hotLeads: toNumber(row.hotLeads),
      warmLeads: toNumber(row.warmLeads),
      coldLeads: toNumber(row.coldLeads),
      badLeads: toNumber(row.badLeads),
    })),
    tiktokPerformance: tiktokPerformance.map((row) => ({
      campaignName: row.campaignName,
      spend: toNumber(row.spend),
      conversions: toNumber(row.conversions),
      cpa: Number(toNumber(row.cpa).toFixed(2)),
      clicks: toNumber(row.clicks),
      ctr: Number(toNumber(row.ctr).toFixed(4)),
    })),
    metaBudgetSignals: metaBudgetSignals.map((row) => ({
      campaignName: row.campaignName,
      dailyBudget: toNumber(row.dailyBudget),
      lifetimeBudget: toNumber(row.lifetimeBudget),
      status: row.status,
      syncedAt: row.syncedAt,
    })),
  };
}

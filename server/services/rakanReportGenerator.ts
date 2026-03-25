import ExcelJS from "exceljs";
import mysql, { Pool, RowDataPacket } from "mysql2/promise";

export const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type RakanReportType =
  | "sales_performance"
  | "sla_breaches"
  | "activities_followups"
  | "contracts_renewals"
  | "am_delayed_followups"
  | "am_revenue";

export interface AuthUserLike {
  id: number;
  name?: string | null;
  role: string;
}

export interface ReportDateRange {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
}

export interface GenerateRakanReportInput extends ReportDateRange {
  reportType: RakanReportType;
  requestedBy: AuthUserLike;
  delivery?: "buffer" | "base64" | "both";
}

export interface GeneratedRakanReport {
  reportType: RakanReportType;
  reportLabel: string;
  fileName: string;
  mimeType: string;
  buffer?: Buffer;
  base64?: string;
  rowCount: number;
  summaryText: string;
}

type Primitive = string | number | boolean | null | Date;
type QueryRow = RowDataPacket & Record<string, Primitive>;

type ColumnDef<T extends Record<string, Primitive>> = {
  header: string;
  key: keyof T & string;
  width?: number;
  numFmt?: string;
};

interface ReportDataset<T extends Record<string, Primitive>> {
  reportLabel: string;
  sheetName: string;
  summary: Record<string, Primitive>;
  columns: Array<ColumnDef<T>>;
  rows: T[];
}

/**
 * COLUMN_MAP aligned with the actual tamiyouz_crm Drizzle schema.
 * Updated 2026-03-26.
 */
const COLUMN_MAP = {
  users: {
    table: "users",
    id: "id",
    name: "name",
    email: "email",
    role: "role",
  },
  leads: {
    table: "leads",
    id: "id",
    name: "name",
    phone: "phone",
    source: "campaignName",       // actual column
    status: "stage",              // actual column
    ownerId: "ownerId",           // actual column
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    slaBreached: "slaBreached",   // tinyint 0/1
    slaAlertedAt: "slaAlertedAt", // timestamp
    contactTime: "contactTime",   // first response timestamp
  },
  activities: {
    table: "activities",
    id: "id",
    type: "type",
    notes: "notes",
    outcome: "outcome",           // replaces "status"
    userId: "userId",
    leadId: "leadId",
    activityTime: "activityTime", // replaces "dueAt" / "completedAt"
    createdAt: "createdAt",
  },
  deals: {
    table: "deals",
    id: "id",
    status: "status",
    leadId: "leadId",             // no direct ownerId; join via leads
    valueSar: "valueSar",         // replaces "value"
    dealType: "dealType",         // replaces "pipelineType"
    createdAt: "createdAt",
    closedAt: "closedAt",
  },
  clients: {
    table: "clients",
    id: "id",
    name: "leadName",             // actual column
    accountManagerId: "accountManagerId",
    healthScore: "healthScore",
    planStatus: "planStatus",     // replaces boolean "isActive"
    businessProfile: "businessProfile", // replaces "industry"
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    lastFollowUpDate: "lastFollowUpDate",
    nextFollowUpDate: "nextFollowUpDate",
  },
  contracts: {
    table: "contracts",
    id: "id",
    contractName: "contractName", // replaces "title"
    clientId: "clientId",
    renewalAssignedTo: "renewalAssignedTo", // replaces "accountManagerId"
    status: "status",
    renewalStatus: "contractRenewalStatus", // actual column
    charges: "charges",           // replaces "amount"
    startDate: "startDate",
    endDate: "endDate",
    createdAt: "createdAt",
  },
  followUps: {
    table: "follow_ups",
    id: "id",
    clientId: "clientId",
    userId: "userId",
    type: "type",
    followUpDate: "followUpDate",
    notes: "notes",
    status: "status",
    createdAt: "createdAt",
  },
  upsellOpportunities: {
    table: "upsell_opportunities",
    id: "id",
    clientId: "clientId",
    title: "title",
    potentialValue: "potentialValue",
    status: "status",
    createdBy: "createdBy",
    createdAt: "createdAt",
  },
} as const;

// Role matchers aligned with actual enum values: Admin, SalesManager, SalesAgent, MediaBuyer, AccountManager, AccountManagerLead
const SALES_ROLE_MATCHERS = [
  "salesagent",
  "salesmanager",
  "admin",
];

const AM_ROLE_MATCHERS = [
  "accountmanager",
  "accountmanagerlead",
  "admin",
];

const CLOSED_DEAL_STATUSES = ["won"];
const RENEWED_CONTRACT_STATUSES = ["renewed", "won"];
const UPSELL_DEAL_TYPES = ["upsell", "renewal"];

const DEFAULT_SLA_BREACH_MINUTES = 30;
const DEFAULT_AM_DELAY_DAYS = 14;

let poolSingleton: Pool | null = null;

function getPool(): Pool {
  if (poolSingleton) return poolSingleton;

  if (process.env.DATABASE_URL) {
    poolSingleton = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false,
      decimalNumbers: true,
    });
    return poolSingleton;
  }

  poolSingleton = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
  });

  return poolSingleton;
}

function q(tableOrAlias: string, column: string): string {
  return `\`${tableOrAlias}\`.\`${column}\``;
}

function table(name: string, alias: string): string {
  return `\`${name}\` ${alias}`;
}

function inList(values: string[]): string {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
}

function lower(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

function hasRoleAccess(role: string, allowedMatchers: string[]): boolean {
  const normalized = lower(role).replace(/[_\s]/g, "");
  return allowedMatchers.some((item) => normalized.includes(item));
}

function isManagerLike(role: string): boolean {
  const normalized = lower(role).replace(/[_\s]/g, "");
  return (
    normalized.includes("admin") ||
    normalized.includes("manager") ||
    normalized.includes("lead") ||
    normalized.includes("director") ||
    normalized.includes("ceo") ||
    normalized.includes("super")
  );
}

function ensureReportAccess(reportType: RakanReportType, user: AuthUserLike): void {
  if (["sales_performance", "sla_breaches", "activities_followups"].includes(reportType)) {
    if (!hasRoleAccess(user.role, SALES_ROLE_MATCHERS)) {
      throw new Error("FORBIDDEN_REPORT_ACCESS_SALES");
    }
    return;
  }

  if (["contracts_renewals", "am_delayed_followups", "am_revenue"].includes(reportType)) {
    if (!hasRoleAccess(user.role, AM_ROLE_MATCHERS)) {
      throw new Error("FORBIDDEN_REPORT_ACCESS_AM");
    }
  }
}

function getOwnershipFilter(reportType: RakanReportType, requestedBy: AuthUserLike): string {
  const manager = isManagerLike(requestedBy.role);
  if (manager) return "";

  if (["sales_performance", "sla_breaches", "activities_followups"].includes(reportType)) {
    return ` AND ownerScope.user_id = ${Number(requestedBy.id)} `;
  }

  return ` AND ownerScope.user_id = ${Number(requestedBy.id)} `;
}

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(date: string): string {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function sanitizeFileName(input: string): string {
  const cleaned = input
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .toLowerCase();

  return cleaned.endsWith(".xlsx") ? cleaned : `${cleaned}.xlsx`;
}

async function queryRows<T extends QueryRow>(
  sqlText: string,
  params: Array<string | number | null>,
): Promise<T[]> {
  const pool = getPool();
  const [rows] = await pool.query<T[]>(sqlText, params);
  return rows;
}

function autoFitColumns(worksheet: ExcelJS.Worksheet): void {
  worksheet.columns?.forEach((column) => {
    let maxLength = 10;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const raw = cell.value == null ? "" : String(cell.value);
      maxLength = Math.max(maxLength, raw.length + 2);
    });

    column.width = Math.min(maxLength, 40);
  });
}

function styleHeaderRow(worksheet: ExcelJS.Worksheet): void {
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" },
  };
  header.alignment = { vertical: "middle", horizontal: "center" };
}

async function buildWorkbook<T extends Record<string, Primitive>>(
  dataset: ReportDataset<T>,
  meta: { dateFrom: string; dateTo: string; requestedBy: AuthUserLike },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rakan AI";
  workbook.lastModifiedBy = meta.requestedBy.name ?? "Rakan AI";
  workbook.created = new Date();
  workbook.modified = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 45 },
  ];

  summarySheet.addRows([
    { field: "Report", value: dataset.reportLabel },
    { field: "Period", value: `${displayDate(meta.dateFrom)} → ${displayDate(meta.dateTo)}` },
    { field: "Requested By", value: meta.requestedBy.name ?? `#${meta.requestedBy.id}` },
    { field: "Role", value: meta.requestedBy.role },
    { field: "Generated At", value: new Date().toISOString() },
    ...Object.entries(dataset.summary).map(([key, value]) => ({
      field: key,
      value: value == null ? "" : String(value),
    })),
  ]);

  styleHeaderRow(summarySheet);
  summarySheet.views = [{ state: "frozen", ySplit: 1 }];
  autoFitColumns(summarySheet);

  const dataSheet = workbook.addWorksheet(dataset.sheetName);
  dataSheet.columns = dataset.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
    style: col.numFmt ? { numFmt: col.numFmt } : undefined,
  }));

  dataSheet.addRows(dataset.rows);
  styleHeaderRow(dataSheet);
  dataSheet.views = [{ state: "frozen", ySplit: 1 }];
  dataSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: dataset.columns.length },
  };
  autoFitColumns(dataSheet);

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report 1: Sales Performance & Conversion
// ═══════════════════════════════════════════════════════════════════════════════
async function getSalesPerformanceDataset(
  input: GenerateRakanReportInput,
): Promise<ReportDataset<Record<string, Primitive>>> {
  const U = COLUMN_MAP.users;
  const L = COLUMN_MAP.leads;
  const A = COLUMN_MAP.activities;
  const D = COLUMN_MAP.deals;

  const ownershipFilter = getOwnershipFilter("sales_performance", input.requestedBy);

  // deals have no direct ownerId; join deals->leads to get ownerId
  const sqlText = `
    SELECT
      ownerScope.user_id AS agentId,
      ownerScope.user_name AS agentName,
      COALESCE(leadsAgg.leadsCount, 0) AS leadsCount,
      COALESCE(activitiesAgg.activitiesCount, 0) AS activitiesCount,
      COALESCE(dealsAgg.closedDealsCount, 0) AS closedDealsCount,
      COALESCE(dealsAgg.closedDealsValue, 0) AS closedDealsValue,
      CASE
        WHEN COALESCE(leadsAgg.leadsCount, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(dealsAgg.closedDealsCount, 0) / leadsAgg.leadsCount) * 100, 2)
      END AS conversionRate
    FROM (
      SELECT ${q("u", U.id)} AS user_id, ${q("u", U.name)} AS user_name
      FROM ${table(U.table, "u")}
      WHERE ${q("u", U.role)} IN ('SalesAgent','SalesManager','Admin')
        AND ${q("u", "deletedAt")} IS NULL
    ) ownerScope
    LEFT JOIN (
      SELECT ${q("l", L.ownerId)} AS ownerId, COUNT(*) AS leadsCount
      FROM ${table(L.table, "l")}
      WHERE DATE(${q("l", L.createdAt)}) BETWEEN ? AND ?
        AND ${q("l", "deletedAt")} IS NULL
      GROUP BY ${q("l", L.ownerId)}
    ) leadsAgg ON leadsAgg.ownerId = ownerScope.user_id
    LEFT JOIN (
      SELECT ${q("a", A.userId)} AS ownerId, COUNT(*) AS activitiesCount
      FROM ${table(A.table, "a")}
      WHERE DATE(${q("a", A.activityTime)}) BETWEEN ? AND ?
        AND ${q("a", "deletedAt")} IS NULL
      GROUP BY ${q("a", A.userId)}
    ) activitiesAgg ON activitiesAgg.ownerId = ownerScope.user_id
    LEFT JOIN (
      SELECT
        ${q("l2", L.ownerId)} AS ownerId,
        COUNT(*) AS closedDealsCount,
        COALESCE(SUM(${q("d", D.valueSar)}), 0) AS closedDealsValue
      FROM ${table(D.table, "d")}
      JOIN ${table(L.table, "l2")} ON ${q("l2", L.id)} = ${q("d", D.leadId)}
      WHERE ${q("d", D.status)} IN (${inList(CLOSED_DEAL_STATUSES)})
        AND DATE(COALESCE(${q("d", D.closedAt)}, ${q("d", D.createdAt)})) BETWEEN ? AND ?
        AND ${q("d", "deletedAt")} IS NULL
        AND ${q("l2", "deletedAt")} IS NULL
      GROUP BY ${q("l2", L.ownerId)}
    ) dealsAgg ON dealsAgg.ownerId = ownerScope.user_id
    WHERE 1 = 1
    ${ownershipFilter}
    ORDER BY closedDealsValue DESC, closedDealsCount DESC, leadsCount DESC;
  `;

  const rows = await queryRows<QueryRow>(sqlText, [
    input.dateFrom,
    input.dateTo,
    input.dateFrom,
    input.dateTo,
    input.dateFrom,
    input.dateTo,
  ]);

  return {
    reportLabel: "Sales Performance & Conversion",
    sheetName: "Sales Performance",
    summary: {
      TotalAgents: rows.length,
      TotalLeads: rows.reduce((sum, row) => sum + Number(row.leadsCount ?? 0), 0),
      TotalActivities: rows.reduce((sum, row) => sum + Number(row.activitiesCount ?? 0), 0),
      TotalClosedDeals: rows.reduce((sum, row) => sum + Number(row.closedDealsCount ?? 0), 0),
      TotalClosedValue: rows.reduce((sum, row) => sum + Number(row.closedDealsValue ?? 0), 0),
    },
    columns: [
      { header: "Agent ID", key: "agentId", width: 12 },
      { header: "Agent Name", key: "agentName", width: 24 },
      { header: "Leads", key: "leadsCount", width: 12 },
      { header: "Activities", key: "activitiesCount", width: 12 },
      { header: "Closed Deals", key: "closedDealsCount", width: 16 },
      { header: "Closed Value", key: "closedDealsValue", width: 18, numFmt: "#,##0.00" },
      { header: "Conversion %", key: "conversionRate", width: 14, numFmt: "0.00" },
    ],
    rows,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report 2: SLA Breaches & Neglected Leads
// ═══════════════════════════════════════════════════════════════════════════════
async function getSlaBreachesDataset(
  input: GenerateRakanReportInput,
): Promise<ReportDataset<Record<string, Primitive>>> {
  const U = COLUMN_MAP.users;
  const L = COLUMN_MAP.leads;
  const ownershipFilter = getOwnershipFilter("sla_breaches", input.requestedBy);

  // Use slaBreached flag + contactTime (first response) + slaAlertedAt
  const sqlText = `
    SELECT
      ${q("l", L.ownerId)} AS ownerUserId,
      ${q("u", U.name)} AS ownerName,
      ${q("l", L.id)} AS leadId,
      ${q("l", L.name)} AS leadName,
      ${q("l", L.phone)} AS phone,
      ${q("l", L.source)} AS source,
      ${q("l", L.status)} AS leadStatus,
      ${q("l", L.createdAt)} AS createdAt,
      ${q("l", L.slaAlertedAt)} AS slaAlertedAt,
      ${q("l", L.contactTime)} AS firstResponseAt,
      TIMESTAMPDIFF(MINUTE, ${q("l", L.createdAt)}, NOW()) AS ageMinutes,
      CASE
        WHEN ${q("l", L.slaBreached)} = 1 THEN 'SLA Breached (flagged)'
        WHEN ${q("l", L.contactTime)} IS NULL AND TIMESTAMPDIFF(MINUTE, ${q("l", L.createdAt)}, NOW()) > ? THEN 'No contact (default SLA)'
        ELSE 'SLA Breach'
      END AS breachReason
    FROM ${table(L.table, "l")}
    LEFT JOIN ${table(U.table, "u")} ON ${q("u", U.id)} = ${q("l", L.ownerId)}
    WHERE DATE(${q("l", L.createdAt)}) BETWEEN ? AND ?
      AND ${q("l", "deletedAt")} IS NULL
      AND (
        ${q("l", L.slaBreached)} = 1
        OR
        (${q("l", L.contactTime)} IS NULL AND TIMESTAMPDIFF(MINUTE, ${q("l", L.createdAt)}, NOW()) > ?)
      )
      ${ownershipFilter.replace(/ownerScope\.user_id/g, q("l", L.ownerId))}
    ORDER BY ${q("l", L.createdAt)} ASC;
  `;

  const rows = await queryRows<QueryRow>(sqlText, [
    DEFAULT_SLA_BREACH_MINUTES,
    input.dateFrom,
    input.dateTo,
    DEFAULT_SLA_BREACH_MINUTES,
  ]);

  return {
    reportLabel: "SLA Breaches & Neglected Leads",
    sheetName: "SLA Breaches",
    summary: {
      BreachedLeads: rows.length,
      SlaWindowMinutes: DEFAULT_SLA_BREACH_MINUTES,
    },
    columns: [
      { header: "Lead ID", key: "leadId", width: 12 },
      { header: "Lead Name", key: "leadName", width: 24 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Source", key: "source", width: 18 },
      { header: "Lead Status", key: "leadStatus", width: 18 },
      { header: "Owner", key: "ownerName", width: 24 },
      { header: "Created At", key: "createdAt", width: 22 },
      { header: "SLA Alerted At", key: "slaAlertedAt", width: 22 },
      { header: "First Response At", key: "firstResponseAt", width: 22 },
      { header: "Age (Minutes)", key: "ageMinutes", width: 14 },
      { header: "Breach Reason", key: "breachReason", width: 24 },
    ],
    rows,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report 3: Activities & Follow-ups
// ═══════════════════════════════════════════════════════════════════════════════
async function getActivitiesDataset(
  input: GenerateRakanReportInput,
): Promise<ReportDataset<Record<string, Primitive>>> {
  const U = COLUMN_MAP.users;
  const A = COLUMN_MAP.activities;
  const L = COLUMN_MAP.leads;

  const ownershipFilter = getOwnershipFilter("activities_followups", input.requestedBy);

  // activities have no clientId or completedAt; use activityTime and outcome
  const sqlText = `
    SELECT
      ${q("a", A.id)} AS activityId,
      ${q("a", A.type)} AS activityType,
      ${q("a", A.notes)} AS notes,
      ${q("a", A.outcome)} AS activityOutcome,
      ${q("u", U.name)} AS ownerName,
      ${q("l", L.name)} AS leadName,
      ${q("a", A.createdAt)} AS createdAt,
      ${q("a", A.activityTime)} AS activityTime
    FROM ${table(A.table, "a")}
    LEFT JOIN ${table(U.table, "u")} ON ${q("u", U.id)} = ${q("a", A.userId)}
    LEFT JOIN ${table(L.table, "l")} ON ${q("l", L.id)} = ${q("a", A.leadId)}
    WHERE DATE(${q("a", A.activityTime)}) BETWEEN ? AND ?
      AND ${q("a", "deletedAt")} IS NULL
      ${ownershipFilter.replace(/ownerScope\.user_id/g, q("a", A.userId))}
    ORDER BY ${q("a", A.activityTime)} DESC;
  `;

  const rows = await queryRows<QueryRow>(sqlText, [input.dateFrom, input.dateTo]);

  return {
    reportLabel: "Activities & Follow-ups",
    sheetName: "Activities",
    summary: {
      TotalActivities: rows.length,
      Calls: rows.filter((row) => lower(String(row.activityType)).includes("call")).length,
      Meetings: rows.filter((row) => lower(String(row.activityType)).includes("meeting")).length,
      WhatsApp: rows.filter((row) => lower(String(row.activityType)).includes("whatsapp")).length,
    },
    columns: [
      { header: "Activity ID", key: "activityId", width: 12 },
      { header: "Type", key: "activityType", width: 16 },
      { header: "Notes", key: "notes", width: 40 },
      { header: "Outcome", key: "activityOutcome", width: 16 },
      { header: "Owner", key: "ownerName", width: 24 },
      { header: "Lead", key: "leadName", width: 24 },
      { header: "Created At", key: "createdAt", width: 20 },
      { header: "Activity Time", key: "activityTime", width: 20 },
    ],
    rows,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report 4: Contracts & Renewals
// ═══════════════════════════════════════════════════════════════════════════════
async function getContractsRenewalsDataset(
  input: GenerateRakanReportInput,
): Promise<ReportDataset<Record<string, Primitive>>> {
  const U = COLUMN_MAP.users;
  const C = COLUMN_MAP.clients;
  const CT = COLUMN_MAP.contracts;

  const ownershipFilter = getOwnershipFilter("contracts_renewals", input.requestedBy);

  const sqlText = `
    SELECT
      ${q("ct", CT.id)} AS contractId,
      ${q("ct", CT.contractName)} AS contractTitle,
      ${q("c", C.name)} AS clientName,
      ${q("u", U.name)} AS accountManagerName,
      ${q("ct", CT.status)} AS contractStatus,
      ${q("ct", CT.renewalStatus)} AS renewalStatus,
      ${q("ct", CT.charges)} AS contractAmount,
      ${q("ct", CT.startDate)} AS startDate,
      ${q("ct", CT.endDate)} AS endDate,
      DATEDIFF(${q("ct", CT.endDate)}, CURDATE()) AS daysToExpiry,
      CASE
        WHEN ${q("ct", CT.endDate)} < CURDATE() THEN 'Expired'
        WHEN ${q("ct", CT.endDate)} BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Expiring Soon'
        ELSE 'In Range'
      END AS renewalBucket
    FROM ${table(CT.table, "ct")}
    LEFT JOIN ${table(C.table, "c")} ON ${q("c", C.id)} = ${q("ct", CT.clientId)}
    LEFT JOIN ${table(U.table, "u")} ON ${q("u", U.id)} = ${q("ct", CT.renewalAssignedTo)}
    WHERE DATE(${q("ct", CT.endDate)}) BETWEEN ? AND ?
      AND ${q("ct", "deletedAt")} IS NULL
      ${ownershipFilter.replace(/ownerScope\.user_id/g, q("ct", CT.renewalAssignedTo))}
    ORDER BY ${q("ct", CT.endDate)} ASC;
  `;

  const rows = await queryRows<QueryRow>(sqlText, [input.dateFrom, input.dateTo]);

  return {
    reportLabel: "Contracts & Renewals",
    sheetName: "Renewals",
    summary: {
      ContractsInRange: rows.length,
      Expired: rows.filter((row) => Number(row.daysToExpiry ?? 0) < 0).length,
      ExpiringWithin30Days: rows.filter(
        (row) => Number(row.daysToExpiry ?? 0) >= 0 && Number(row.daysToExpiry ?? 0) <= 30,
      ).length,
      TotalValue: rows.reduce((sum, row) => sum + Number(row.contractAmount ?? 0), 0),
    },
    columns: [
      { header: "Contract ID", key: "contractId", width: 12 },
      { header: "Contract Title", key: "contractTitle", width: 28 },
      { header: "Client", key: "clientName", width: 24 },
      { header: "Account Manager", key: "accountManagerName", width: 24 },
      { header: "Contract Status", key: "contractStatus", width: 16 },
      { header: "Renewal Status", key: "renewalStatus", width: 18 },
      { header: "Amount", key: "contractAmount", width: 16, numFmt: "#,##0.00" },
      { header: "Start Date", key: "startDate", width: 16 },
      { header: "End Date", key: "endDate", width: 16 },
      { header: "Days To Expiry", key: "daysToExpiry", width: 16 },
      { header: "Bucket", key: "renewalBucket", width: 18 },
    ],
    rows,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report 5: AM Delayed Follow-ups
// ═══════════════════════════════════════════════════════════════════════════════
async function getAmDelayedFollowupsDataset(
  input: GenerateRakanReportInput,
): Promise<ReportDataset<Record<string, Primitive>>> {
  const U = COLUMN_MAP.users;
  const C = COLUMN_MAP.clients;
  const FU = COLUMN_MAP.followUps;
  const CT = COLUMN_MAP.contracts;

  const ownershipFilter = getOwnershipFilter("am_delayed_followups", input.requestedBy);

  // Use follow_ups table for last contact, clients.lastFollowUpDate as fallback
  const sqlText = `
    SELECT
      ${q("c", C.id)} AS clientId,
      ${q("c", C.name)} AS clientName,
      ${q("c", C.businessProfile)} AS businessProfile,
      ${q("u", U.name)} AS accountManagerName,
      ${q("c", C.healthScore)} AS healthScore,
      COALESCE(
        lastFU.lastFollowUp,
        ${q("c", C.lastFollowUpDate)}
      ) AS lastContactAt,
      DATEDIFF(
        CURDATE(),
        DATE(COALESCE(lastFU.lastFollowUp, ${q("c", C.lastFollowUpDate)}))
      ) AS daysSinceContact,
      MAX(${q("ct", CT.endDate)}) AS nearestContractEndDate
    FROM ${table(C.table, "c")}
    LEFT JOIN ${table(U.table, "u")} ON ${q("u", U.id)} = ${q("c", C.accountManagerId)}
    LEFT JOIN (
      SELECT ${q("f", FU.clientId)} AS clientId,
             MAX(${q("f", FU.followUpDate)}) AS lastFollowUp
      FROM ${table(FU.table, "f")}
      GROUP BY ${q("f", FU.clientId)}
    ) lastFU ON lastFU.clientId = ${q("c", C.id)}
    LEFT JOIN ${table(CT.table, "ct")} ON ${q("ct", CT.clientId)} = ${q("c", C.id)} AND ${q("ct", "deletedAt")} IS NULL
    WHERE ${q("c", C.planStatus)} = 'Active'
      AND ${q("c", "deletedAt")} IS NULL
      ${ownershipFilter.replace(/ownerScope\.user_id/g, q("c", C.accountManagerId))}
    GROUP BY ${q("c", C.id)}, ${q("c", C.name)}, ${q("c", C.businessProfile)}, ${q("u", U.name)}, ${q("c", C.healthScore)}, lastFU.lastFollowUp, ${q("c", C.lastFollowUpDate)}
    HAVING lastContactAt IS NULL OR daysSinceContact > ?
    ORDER BY daysSinceContact DESC;
  `;

  const rows = await queryRows<QueryRow>(sqlText, [DEFAULT_AM_DELAY_DAYS]);

  return {
    reportLabel: "AM Delayed Follow-ups",
    sheetName: "Delayed Follow-ups",
    summary: {
      DelayedClients: rows.length,
      DelayThresholdDays: DEFAULT_AM_DELAY_DAYS,
    },
    columns: [
      { header: "Client ID", key: "clientId", width: 12 },
      { header: "Client", key: "clientName", width: 28 },
      { header: "Business Profile", key: "businessProfile", width: 24 },
      { header: "Account Manager", key: "accountManagerName", width: 24 },
      { header: "Health Score", key: "healthScore", width: 14 },
      { header: "Last Contact At", key: "lastContactAt", width: 22 },
      { header: "Days Since Contact", key: "daysSinceContact", width: 18 },
      { header: "Nearest Contract End", key: "nearestContractEndDate", width: 20 },
    ],
    rows,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report 6: AM Revenue & Upsell
// ═══════════════════════════════════════════════════════════════════════════════
async function getAmRevenueDataset(
  input: GenerateRakanReportInput,
): Promise<ReportDataset<Record<string, Primitive>>> {
  const U = COLUMN_MAP.users;
  const CT = COLUMN_MAP.contracts;
  const UO = COLUMN_MAP.upsellOpportunities;

  const ownershipFilter = getOwnershipFilter("am_revenue", input.requestedBy);

  // Use upsell_opportunities table for upsell data, contracts for renewals
  const sqlText = `
    SELECT
      ownerScope.user_id AS amId,
      ownerScope.user_name AS amName,
      COALESCE(renewalsAgg.renewalsCount, 0) AS renewalsCount,
      COALESCE(renewalsAgg.renewedRevenue, 0) AS renewedRevenue,
      COALESCE(upsellAgg.upsellCount, 0) AS upsellOpportunities,
      COALESCE(upsellAgg.upsellValue, 0) AS upsellPipelineValue,
      COALESCE(renewalsAgg.renewedRevenue, 0) + COALESCE(upsellAgg.upsellValue, 0) AS totalPortfolioValue
    FROM (
      SELECT ${q("u", U.id)} AS user_id, ${q("u", U.name)} AS user_name
      FROM ${table(U.table, "u")}
      WHERE ${q("u", U.role)} IN ('AccountManager','AccountManagerLead','Admin')
        AND ${q("u", "deletedAt")} IS NULL
    ) ownerScope
    LEFT JOIN (
      SELECT
        ${q("ct", CT.renewalAssignedTo)} AS ownerId,
        COUNT(*) AS renewalsCount,
        COALESCE(SUM(${q("ct", CT.charges)}), 0) AS renewedRevenue
      FROM ${table(CT.table, "ct")}
      WHERE ${q("ct", CT.renewalStatus)} IN (${inList(RENEWED_CONTRACT_STATUSES)})
        AND DATE(${q("ct", CT.endDate)}) BETWEEN ? AND ?
        AND ${q("ct", "deletedAt")} IS NULL
      GROUP BY ${q("ct", CT.renewalAssignedTo)}
    ) renewalsAgg ON renewalsAgg.ownerId = ownerScope.user_id
    LEFT JOIN (
      SELECT
        ${q("uo", UO.createdBy)} AS ownerId,
        COUNT(*) AS upsellCount,
        COALESCE(SUM(${q("uo", UO.potentialValue)}), 0) AS upsellValue
      FROM ${table(UO.table, "uo")}
      WHERE DATE(${q("uo", UO.createdAt)}) BETWEEN ? AND ?
      GROUP BY ${q("uo", UO.createdBy)}
    ) upsellAgg ON upsellAgg.ownerId = ownerScope.user_id
    WHERE 1 = 1
    ${ownershipFilter}
    ORDER BY totalPortfolioValue DESC, renewedRevenue DESC;
  `;

  const rows = await queryRows<QueryRow>(sqlText, [
    input.dateFrom,
    input.dateTo,
    input.dateFrom,
    input.dateTo,
  ]);

  return {
    reportLabel: "AM Revenue & Upsell",
    sheetName: "AM Revenue",
    summary: {
      TotalAMs: rows.length,
      TotalRenewedRevenue: rows.reduce((sum, row) => sum + Number(row.renewedRevenue ?? 0), 0),
      TotalUpsellPipelineValue: rows.reduce((sum, row) => sum + Number(row.upsellPipelineValue ?? 0), 0),
    },
    columns: [
      { header: "AM ID", key: "amId", width: 12 },
      { header: "AM Name", key: "amName", width: 24 },
      { header: "Renewals Count", key: "renewalsCount", width: 16 },
      { header: "Renewed Revenue", key: "renewedRevenue", width: 18, numFmt: "#,##0.00" },
      { header: "Upsell Opportunities", key: "upsellOpportunities", width: 18 },
      { header: "Upsell Pipeline", key: "upsellPipelineValue", width: 18, numFmt: "#,##0.00" },
      { header: "Total Portfolio Value", key: "totalPortfolioValue", width: 20, numFmt: "#,##0.00" },
    ],
    rows,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dispatcher
// ═══════════════════════════════════════════════════════════════════════════════
async function getDataset(
  input: GenerateRakanReportInput,
): Promise<ReportDataset<Record<string, Primitive>>> {
  switch (input.reportType) {
    case "sales_performance":
      return getSalesPerformanceDataset(input);
    case "sla_breaches":
      return getSlaBreachesDataset(input);
    case "activities_followups":
      return getActivitiesDataset(input);
    case "contracts_renewals":
      return getContractsRenewalsDataset(input);
    case "am_delayed_followups":
      return getAmDelayedFollowupsDataset(input);
    case "am_revenue":
      return getAmRevenueDataset(input);
    default:
      throw new Error(`Unsupported report type: ${String(input.reportType)}`);
  }
}

function buildSummaryText(reportLabel: string, dateFrom: string, dateTo: string, rowCount: number): string {
  return `${reportLabel} | ${displayDate(dateFrom)} → ${displayDate(dateTo)} | Rows: ${rowCount}`;
}

export async function generateRakanReport(
  input: GenerateRakanReportInput,
): Promise<GeneratedRakanReport> {
  ensureReportAccess(input.reportType, input.requestedBy);

  const dataset = await getDataset(input);
  const buffer = await buildWorkbook(dataset, {
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    requestedBy: input.requestedBy,
  });

  const fileName = sanitizeFileName(
    `rakan-${input.reportType}-${input.dateFrom}-to-${input.dateTo}.xlsx`,
  );

  const delivery = input.delivery ?? "both";

  return {
    reportType: input.reportType,
    reportLabel: dataset.reportLabel,
    fileName,
    mimeType: EXCEL_MIME,
    buffer: delivery === "base64" ? undefined : buffer,
    base64: delivery === "buffer" ? undefined : buffer.toString("base64"),
    rowCount: dataset.rows.length,
    summaryText: buildSummaryText(dataset.reportLabel, input.dateFrom, input.dateTo, dataset.rows.length),
  };
}

export function defaultDateRangeForReport(
  reportType: RakanReportType,
  userMessage?: string,
): ReportDateRange {
  const now = new Date();
  const message = lower(userMessage);

  if (message.includes("الشهر الجاي") || message.includes("next month")) {
    const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { dateFrom: toYmd(first), dateTo: toYmd(last) };
  }

  if (
    reportType === "contracts_renewals" ||
    reportType === "am_revenue" ||
    message.includes("من أول الشهر") ||
    message.includes("this month") ||
    message.includes("الشهر ده")
  ) {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: toYmd(first), dateTo: toYmd(now) };
  }

  const from = new Date(now);
  from.setDate(now.getDate() - 29);
  return { dateFrom: toYmd(from), dateTo: toYmd(now) };
}

import ExcelJS from "exceljs";
import type { Response } from "express";
import type { AuditParams, AuditResult } from "./dashboardAuditService";
import {
  getRawRows, getStoredInputs, getRelatedRecords, getSnapshotInputs, getMetricDefinition,
} from "./dashboardAuditService";

// ─── Style Helpers ────────────────────────────────────────────────────────────

const COLORS = {
  headerBg: "FF1E3A5F",
  headerFg: "FFFFFFFF",
  match: "FFD4EDDA",
  mismatch: "FFFFE0E0",
  partial: "FFFFF3CD",
  notComparable: "FFEEEEEE",
  altRow: "FFFAFAFA",
  white: "FFFFFFFF",
  accent: "FF4A90D9",
  warnText: "FFB45309",
  errText: "FFCC0000",
  okText: "FF166534",
};

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } };
    cell.font = { bold: true, color: { argb: COLORS.headerFg }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.accent } } };
  });
  row.height = 24;
}

function styleDataRow(row: ExcelJS.Row, idx: number, highlight?: string) {
  const bg = highlight ?? (idx % 2 === 0 ? COLORS.altRow : COLORS.white);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.alignment = { vertical: "middle", wrapText: false };
  });
  row.height = 18;
}

function fitColumns(sheet: ExcelJS.Worksheet) {
  const widths: number[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell, col) => {
      const v = cell.value == null ? "" : String(cell.value);
      widths[col - 1] = Math.min(Math.max(widths[col - 1] ?? 12, v.length + 2), 50);
    });
  });
  widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
}

function safeStr(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function addKVSheet(
  wb: ExcelJS.Workbook,
  name: string,
  pairs: [string, any][],
  titleColor: string = COLORS.headerBg
) {
  const sheet = wb.addWorksheet(name);
  sheet.columns = [
    { header: "Field", key: "k", width: 28 },
    { header: "Value", key: "v", width: 60 },
  ];
  styleHeader(sheet);
  pairs.forEach(([k, v], i) => {
    const row = sheet.addRow({ k, v: safeStr(v) });
    styleDataRow(row, i);
  });
  fitColumns(sheet);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return sheet;
}

function addTableSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: any[],
  columns?: { header: string; key: string; width?: number }[]
) {
  const sheet = wb.addWorksheet(name);
  if (rows.length === 0) {
    sheet.addRow(["No data available"]);
    return sheet;
  }
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 18 }));
  sheet.columns = cols;
  styleHeader(sheet);
  rows.forEach((r, i) => {
    const rowData: any = {};
    cols.forEach(({ key }) => { rowData[key] = safeStr(r[key]); });
    const row = sheet.addRow(rowData);
    styleDataRow(row, i);
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  fitColumns(sheet);
  return sheet;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function streamDashboardAuditExcel(
  res: Response,
  params: AuditParams,
  auditResult: AuditResult,
  exportedBy: string,
) {
  const def = getMetricDefinition(params.metricId);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tamiyouz CRM — Dashboard Audit";
  wb.created = new Date();

  // ── Sheet 1: Export_Meta ──────────────────────────────────────────────────
  const matchColor: Record<string, string> = {
    Match: COLORS.match,
    Mismatch: COLORS.mismatch,
    Partial: COLORS.partial,
    NotComparable: COLORS.notComparable,
  };

  addKVSheet(wb, "Export_Meta", [
    ["Dashboard Type", params.dashboardType],
    ["Metric ID", params.metricId],
    ["Metric Label", def?.label ?? params.metricId],
    ["Date From", params.dateFrom.toISOString().slice(0, 10)],
    ["Date To", params.dateTo.toISOString().slice(0, 10)],
    ["Date Basis", params.dateBasis],
    ["Timezone", "UTC"],
    ["Exported At", new Date().toISOString()],
    ["Exported By", exportedBy],
    ["Target User ID", params.targetUserId ?? "N/A (global scope)"],
    ["Viewer Role", params.viewerRole ?? "N/A"],
    ["Extra Filters", params.extraFilters ? JSON.stringify(params.extraFilters) : "None"],
    ["Environment", "Production"],
    ["App", "Tamiyouz CRM"],
  ]);

  // ── Sheet 2: Metric_Summary ───────────────────────────────────────────────
  const summarySheet = wb.addWorksheet("Metric_Summary");
  summarySheet.columns = [
    { header: "Field", key: "field", width: 30 },
    { header: "Value", key: "value", width: 60 },
  ];
  styleHeader(summarySheet);

  const summaryPairs: [string, any][] = [
    ["Dashboard Logic Value", safeStr(auditResult.dashboardLogicValue)],
    ["Database Direct Value", safeStr(auditResult.databaseValue)],
    ["Difference", auditResult.difference ?? "N/A (non-scalar)"],
    ["Match Status", auditResult.matchStatus],
    ["Raw Row Count", auditResult.rawRowCount],
    ["Mismatch Reasons", auditResult.mismatchReasons.join(" | ") || "None"],
    ["Formula Description", def?.formulaDescription ?? ""],
    ["Primary Table", def?.primaryTable ?? ""],
    ["Joined Tables", def?.joinedTables?.join(", ") ?? ""],
    ["Date Basis (default)", def?.defaultDateBasis ?? ""],
    ["Soft Delete Rule", def?.softDeleteRule ?? ""],
    ["Caveats", def?.caveats ?? "None"],
  ];

  summaryPairs.forEach(([field, value], i) => {
    const row = summarySheet.addRow({ field, value: safeStr(value) });
    let bg = i % 2 === 0 ? COLORS.altRow : COLORS.white;
    if (field === "Match Status") bg = matchColor[auditResult.matchStatus] ?? bg;
    styleDataRow(row, i, bg);
  });
  fitColumns(summarySheet);
  summarySheet.views = [{ state: "frozen", ySplit: 1 }];

  // ── Sheet 3: Metric_Definition ────────────────────────────────────────────
  if (def) {
    addKVSheet(wb, "Metric_Definition", [
      ["Metric ID", def.metricId],
      ["Dashboard Type", def.dashboardType],
      ["Label", def.label],
      ["Metric Kind", def.metricKind],
      ["Primary Entity", def.primaryEntity],
      ["Primary Table", def.primaryTable],
      ["Joined Tables", def.joinedTables.join(", ")],
      ["Allowed Date Bases", def.allowedDateBases.join(", ")],
      ["Default Date Basis", def.defaultDateBasis],
      ["Allowed Scopes", def.allowedScopes.join(", ")],
      ["Included Statuses", def.includedStatuses.join(", ")],
      ["Excluded Statuses", def.excludedStatuses.join(", ")],
      ["Soft Delete Rule", def.softDeleteRule],
      ["Formula Description", def.formulaDescription],
      ["Dashboard Source", `trpc.dashboard.${def.dashboardType}`],
      ["Direct DB Source", `dashboardAuditService.resolveDbValue("${def.metricId}")`],
      ["Caveats", def.caveats ?? "None"],
    ]);
  }

  // ── Sheet 4: Raw_DB_Rows ──────────────────────────────────────────────────
  const rawRows = await getRawRows(params, 500);
  addTableSheet(wb, "Raw_DB_Rows", rawRows);

  // ── Sheet 5: Stored_Inputs ────────────────────────────────────────────────
  const rowIds = rawRows.map((r: any) => Number(r.id)).filter(Boolean).slice(0, 200);
  const storedInputs = await getStoredInputs(params, rowIds);
  addTableSheet(wb, "Stored_Inputs", storedInputs);

  // ── Sheet 6: Related_Records ──────────────────────────────────────────────
  const related = await getRelatedRecords(params, rowIds.slice(0, 100));
  const relatedSheet = wb.addWorksheet("Related_Records");
  let relRowIdx = 0;
  for (const [entityName, entityRows] of Object.entries(related)) {
    if (!Array.isArray(entityRows) || entityRows.length === 0) continue;
    // Section header
    const headerRow = relatedSheet.addRow([`── ${entityName.toUpperCase()} (${entityRows.length} rows) ──`]);
    headerRow.getCell(1).font = { bold: true, color: { argb: COLORS.headerBg } };
    headerRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F4F8" } };
    relRowIdx++;

    // Column headers
    const keys = Object.keys(entityRows[0] ?? {});
    const colHeaderRow = relatedSheet.addRow(keys);
    colHeaderRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } };
      cell.font = { bold: true, color: { argb: COLORS.headerFg }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    colHeaderRow.height = 20;
    relRowIdx++;

    entityRows.forEach((r, i) => {
      const row = relatedSheet.addRow(keys.map((k) => safeStr(r[k])));
      styleDataRow(row, i);
      relRowIdx++;
    });
    relatedSheet.addRow([]); // spacer
    relRowIdx++;
  }
  if (relRowIdx === 0) relatedSheet.addRow(["No related records found"]);

  // ── Sheet 7: Snapshot_Inputs ──────────────────────────────────────────────
  const snapshots = await getSnapshotInputs(params, rowIds.slice(0, 200));
  const snapshotSheet = wb.addWorksheet("Snapshot_Inputs");
  if (snapshots.length > 0) {
    const snapKeys = ["entityId", "entityType", "operationType", "routeName", "actorName", "rawInputPayload", "normalizedPayload", "persistedSnapshot", "createdAt", "snapshotStatus", "note"];
    snapshotSheet.columns = snapKeys.map((k) => ({ header: k, key: k, width: 20 }));
    styleHeader(snapshotSheet);
    snapshots.forEach((s, i) => {
      const rowData: any = {};
      snapKeys.forEach((k) => { rowData[k] = safeStr(s[k]); });
      const row = snapshotSheet.addRow(rowData);
      const bg = (s.snapshotStatus === "NO_SNAPSHOT_AVAILABLE") ? COLORS.notComparable : undefined;
      styleDataRow(row, i, bg);
    });
    fitColumns(snapshotSheet);
    snapshotSheet.views = [{ state: "frozen", ySplit: 1 }];
  } else {
    snapshotSheet.addRow(["No snapshot data available for this metric's rows"]);
  }

  // ── Sheet 8: Mismatch_Analysis ────────────────────────────────────────────
  const mismatchSheet = wb.addWorksheet("Mismatch_Analysis");
  mismatchSheet.columns = [
    { header: "#", key: "idx", width: 6 },
    { header: "Analysis Point", key: "point", width: 80 },
    { header: "Severity", key: "severity", width: 18 },
  ];
  styleHeader(mismatchSheet);

  const analysisPoints = [
    { point: `Dashboard Logic Value: ${safeStr(auditResult.dashboardLogicValue)}`, severity: "Info" },
    { point: `Direct DB Truth Value: ${safeStr(auditResult.databaseValue)}`, severity: "Info" },
    { point: `Match Status: ${auditResult.matchStatus}`, severity: auditResult.matchStatus === "Match" ? "OK" : auditResult.matchStatus === "Partial" ? "Warning" : "Error" },
    { point: `Date Range: ${params.dateFrom.toISOString().slice(0, 10)} to ${params.dateTo.toISOString().slice(0, 10)}`, severity: "Info" },
    { point: `Date Basis Used: ${params.dateBasis} (Default: ${def?.defaultDateBasis ?? "N/A"})`, severity: params.dateBasis !== def?.defaultDateBasis ? "Warning" : "Info" },
    ...auditResult.mismatchReasons.map((r) => ({ point: r, severity: "Finding" })),
    { point: "Note: Historical records have no snapshot data. Deploy snapshot logging to capture future UI payloads.", severity: "Info" },
    { point: `Formula: ${def?.formulaDescription ?? "N/A"}`, severity: "Info" },
  ];

  const sevColor: Record<string, string> = {
    OK: COLORS.match,
    Warning: COLORS.partial,
    Error: COLORS.mismatch,
    Finding: "FFFFE8D6",
    Info: COLORS.white,
  };
  analysisPoints.forEach(({ point, severity }, i) => {
    const row = mismatchSheet.addRow({ idx: i + 1, point, severity });
    styleDataRow(row, i, sevColor[severity]);
  });
  fitColumns(mismatchSheet);
  mismatchSheet.views = [{ state: "frozen", ySplit: 1 }];

  // ── Stream Response ───────────────────────────────────────────────────────
  const dateStr = `${params.dateFrom.toISOString().slice(0, 10)}_to_${params.dateTo.toISOString().slice(0, 10)}`;
  const filename = `dashboard_audit_${params.dashboardType}_${params.metricId}_${dateStr}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

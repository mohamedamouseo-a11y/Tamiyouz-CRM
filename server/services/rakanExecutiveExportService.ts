import path from "path";
import { promises as fs } from "fs";
import ExcelJS from "exceljs";
import type {
  RakanBuiltReport,
  RakanExportBundle,
  RakanExportedReport,
  RakanExportFormat,
  RakanReportSection,
} from "./rakanExecutiveTypes";

const DOWNLOADS_DIR = path.join(process.cwd(), "downloads", "rakan");

function sanitizeFileName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureDownloadsDir() {
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
}

function makeFileBaseName(report: RakanBuiltReport): string {
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  return `${sanitizeFileName(report.reportType)}-${stamp}`;
}

function prettifyKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function fitColumns(sheet: ExcelJS.Worksheet) {
  const widths: number[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell, colNumber) => {
      const value = cell.value == null ? "" : String(cell.value);
      widths[colNumber - 1] = Math.min(Math.max(widths[colNumber - 1] ?? 12, value.length + 2), 40);
    });
  });
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function appendSectionSheet(workbook: ExcelJS.Workbook, section: RakanReportSection) {
  const sheet = workbook.addWorksheet(section.title.slice(0, 31));
  const rows = section.rows ?? [];
  if (rows.length === 0) {
    sheet.addRow([section.title]);
    sheet.addRow(["لا توجد بيانات في هذا القسم"]);
    fitColumns(sheet);
    return;
  }

  const columns = Object.keys(rows[0]);
  sheet.addRow(columns.map(prettifyKey));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { horizontal: "center" };

  for (const row of rows) {
    sheet.addRow(columns.map((key) => row[key] == null ? "" : row[key]));
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  fitColumns(sheet);
}

export async function exportRakanReportToExcel(report: RakanBuiltReport): Promise<RakanExportedReport> {
  await ensureDownloadsDir();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rakan Executive Reporting";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = true;

  const summarySheet = workbook.addWorksheet("Executive Summary");
  summarySheet.addRow([report.title]);
  summarySheet.addRow([report.subtitle ?? ""]);
  summarySheet.addRow([`الفترة: ${report.dateRange.dateFrom} → ${report.dateRange.dateTo}`]);
  summarySheet.addRow([`تم الإنشاء: ${report.generatedAt}`]);
  summarySheet.addRow([]);
  summarySheet.addRow(["الملخص التنفيذي"]);
  summarySheet.getRow(6).font = { bold: true };
  for (const item of report.executiveSummary) {
    summarySheet.addRow([`• ${item}`]);
  }
  summarySheet.addRow([]);
  summarySheet.addRow(["المؤشرات الرئيسية", "القيمة"]);
  const metricHeader = summarySheet.getRow(summarySheet.rowCount);
  metricHeader.font = { bold: true };
  for (const metric of report.metrics) {
    summarySheet.addRow([metric.label, metric.value]);
  }
  fitColumns(summarySheet);

  for (const section of report.sections) {
    appendSectionSheet(workbook, section);
  }

  const fileName = `${makeFileBaseName(report)}.xlsx`;
  const filePath = path.join(DOWNLOADS_DIR, fileName);
  await workbook.xlsx.writeFile(filePath);

  return {
    fileName,
    filePath,
    fileUrl: `/downloads/rakan/${fileName}`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtmlTable(section: RakanReportSection): string {
  if (!section.rows.length) {
    return `<h2>${escapeHtml(section.title)}</h2><p>لا توجد بيانات.</p>`;
  }

  const columns = Object.keys(section.rows[0]);
  const head = columns.map((col) => `<th>${escapeHtml(prettifyKey(col))}</th>`).join("");
  const body = section.rows
    .map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col] == null ? "" : String(row[col]))}</td>`).join("")}</tr>`)
    .join("");

  return `
    <section>
      <h2>${escapeHtml(section.title)}</h2>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

export async function exportRakanReportToDocument(report: RakanBuiltReport): Promise<RakanExportedReport> {
  await ensureDownloadsDir();

  const html = `
  <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(report.title)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
        h1, h2, h3 { margin: 0 0 10px; }
        p, li { line-height: 1.6; }
        .meta { color: #4b5563; margin-bottom: 16px; }
        .metrics { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 12px; margin: 18px 0; }
        .metric { border: 1px solid #d1d5db; padding: 10px 12px; border-radius: 10px; }
        .metric strong { display: block; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; }
        th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: right; vertical-align: top; }
        th { background: #f3f4f6; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(report.title)}</h1>
      ${report.subtitle ? `<p>${escapeHtml(report.subtitle)}</p>` : ""}
      <div class="meta">الفترة: ${escapeHtml(report.dateRange.dateFrom)} إلى ${escapeHtml(report.dateRange.dateTo)}<br/>تم الإنشاء: ${escapeHtml(report.generatedAt)}</div>
      <h2>الملخص التنفيذي</h2>
      <ul>${report.executiveSummary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <div class="metrics">
        ${report.metrics
          .map((metric) => `<div class="metric"><strong>${escapeHtml(metric.label)}</strong><span>${escapeHtml(String(metric.value))}</span></div>`)
          .join("")}
      </div>
      ${report.sections.map(renderHtmlTable).join("\n")}
    </body>
  </html>`;

  const fileName = `${makeFileBaseName(report)}.doc`;
  const filePath = path.join(DOWNLOADS_DIR, fileName);
  await fs.writeFile(filePath, html, "utf8");

  return {
    fileName,
    filePath,
    fileUrl: `/downloads/rakan/${fileName}`,
    mimeType: "application/msword",
  };
}

export async function exportRakanReportBundle(report: RakanBuiltReport, format: RakanExportFormat): Promise<RakanExportBundle> {
  const bundle: RakanExportBundle = {};
  if (format === "excel" || format === "both") {
    bundle.excel = await exportRakanReportToExcel(report);
  }
  if (format === "document" || format === "both") {
    bundle.document = await exportRakanReportToDocument(report);
  }
  return bundle;
}

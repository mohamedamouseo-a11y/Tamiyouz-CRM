import ExcelJS from "exceljs";
import type { Response } from "express";
import { getLeadsForExport } from "./db";

export interface ExportLeadsOptions {
  limit?: number;
  stage?: string;
  leadQuality?: "Hot" | "Warm" | "Cold" | "Bad" | "Unknown";
  campaignName?: string;
  slaBreached?: boolean;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function streamLeadsExcel(res: Response, options: ExportLeadsOptions = {}) {
  const leads = await getLeadsForExport(options);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Tamiyouz CRM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Leads", {
    views: [{ rightToLeft: false }],
  });

  // ── Column definitions ──────────────────────────────────────────────────────
  sheet.columns = [
    { header: "#",                key: "id",              width: 8 },
    { header: "Name",             key: "name",            width: 28 },
    { header: "Phone",            key: "phone",           width: 18 },
    { header: "Country",          key: "country",         width: 14 },
    { header: "Business Profile", key: "businessProfile", width: 22 },
    { header: "Lead Quality",     key: "leadQuality",     width: 14 },
    { header: "Stage",            key: "stage",           width: 16 },
    { header: "Campaign",         key: "campaignName",    width: 22 },
    { header: "Owner",            key: "ownerName",       width: 22 },
    { header: "SLA Breached",     key: "slaBreached",     width: 14 },
    { header: "Created At",       key: "createdAt",       width: 20 },
    { header: "Notes",            key: "notes",           width: 40 },
  ];

  // ── Header row styling ──────────────────────────────────────────────────────
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A5F" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF4A90D9" } },
    };
  });
  headerRow.height = 22;

  // ── Quality colour map ──────────────────────────────────────────────────────
  const qualityColor: Record<string, string> = {
    Hot: "FFFF4444",
    Warm: "FFFF9900",
    Cold: "FF4499FF",
    Bad: "FF888888",
    Unknown: "FFCCCCCC",
  };

  // ── Data rows ───────────────────────────────────────────────────────────────
  leads.forEach((lead, idx) => {
    const row = sheet.addRow({
      id: lead.id,
      name: lead.name ?? "",
      phone: lead.phone ?? "",
      country: lead.country ?? "",
      businessProfile: lead.businessProfile ?? "",
      leadQuality: lead.leadQuality ?? "",
      stage: lead.stage ?? "",
      campaignName: lead.campaignName ?? "",
      ownerName: lead.ownerName ?? "",
      slaBreached: lead.slaBreached ? "Yes" : "No",
      createdAt: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-GB") : "",
      notes: lead.notes ?? "",
    });

    // Alternating row background
    const bg = idx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { vertical: "middle", wrapText: false };
    });

    // Colour-code the quality cell
    const qualityCell = row.getCell("leadQuality");
    const qColor = qualityColor[lead.leadQuality ?? ""] ?? "FFCCCCCC";
    qualityCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: qColor } };
    qualityCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    qualityCell.alignment = { horizontal: "center", vertical: "middle" };

    // Red SLA cell
    if (lead.slaBreached) {
      const slaCell = row.getCell("slaBreached");
      slaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0E0" } };
      slaCell.font = { color: { argb: "FFCC0000" }, bold: true };
      slaCell.alignment = { horizontal: "center", vertical: "middle" };
    }

    row.height = 18;
  });

  // ── Auto-filter on header ───────────────────────────────────────────────────
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  // ── Freeze the header row ───────────────────────────────────────────────────
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // ── Stream to response ──────────────────────────────────────────────────────
  const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();

  return leads.length;
}

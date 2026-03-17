/**
 * Google Sheets Integration Service
 * Reads publicly shared Google Sheets via CSV export URLs.
 * No Service Account or API key required — sheets must be shared as
 * "Anyone with the link" (Viewer or Editor).
 */
import { parse } from "csv-parse/sync";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract spreadsheet ID from a Google Sheets URL */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/** Normalize Saudi phone numbers to +966XXXXXXXXX format */
export function normalizeSaudiPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "966" + digits.slice(1);
  }
  if (digits.startsWith("966") && digits.length === 12) {
    return "+" + digits;
  }
  if (digits.startsWith("5") && digits.length === 9) {
    return "+966" + digits;
  }
  if (digits.length >= 11) {
    return "+" + digits;
  }
  return phone;
}

// ─── Public CSV Fetch Helpers ────────────────────────────────────────────────

/**
 * Build the public CSV export URL for a Google Sheet worksheet.
 * Works for sheets shared as "Anyone with the link".
 */
function buildCsvUrl(spreadsheetId: string, gid: number | string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Build the public HTML page URL to scrape metadata (title + tabs).
 */
function buildHtmlUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

/**
 * Fetch raw text from a URL with error handling.
 */
async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TamiyouzCRM/1.0)",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Sheet not found. Check the URL and make sure it is shared publicly.");
    }
    if (response.status === 403) {
      throw new Error("Permission denied. Make sure the sheet is shared as 'Anyone with the link'.");
    }
    throw new Error(`Failed to fetch sheet (HTTP ${response.status}): ${response.statusText}`);
  }
  return response.text();
}

/**
 * Parse CSV text into headers + row objects.
 */
function parseCsv(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const records: string[][] = parse(csvText, {
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
  });

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0].map((h: string) => String(h).trim());
  const dataRows = records.slice(1).map((row: string[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
    });
    return obj;
  });

  return { headers, rows: dataRows };
}

// ─── Sheet Operations ─────────────────────────────────────────────────────────

export interface SheetInfo {
  spreadsheetId: string;
  title: string;
  worksheets: Array<{ title: string; rowCount: number; index: number; gid: string }>;
}

/**
 * Test connection: fetch spreadsheet metadata by loading the public HTML page
 * and extracting sheet title + tab names/gids from the page source.
 */
export async function testSheetConnection(sheetUrl: string): Promise<SheetInfo> {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw new Error("Invalid Google Sheets URL. Could not extract spreadsheet ID.");
  }

  // Fetch the public HTML page to extract metadata
  const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/pubhtml`;
  let html: string;
  try {
    html = await fetchText(htmlUrl);
  } catch (err: any) {
    // Fallback: try the /edit page
    try {
      html = await fetchText(buildHtmlUrl(spreadsheetId));
    } catch {
      throw new Error(
        `Cannot access sheet. Make sure it is shared as "Anyone with the link". (${err.message})`
      );
    }
  }

  // Extract title from <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].replace(/ - Google Sheets$/, "").trim() : "Untitled";

  // Try to extract worksheet/tab info from the HTML
  const worksheets: Array<{ title: string; rowCount: number; index: number; gid: string }> = [];

  // Method 1: Look for tab names in the sheet-menu or tab bar
  // Pattern: data-sheet-id="GID" ... >TabName<
  const tabPattern = /data-sheet-id="(\d+)"[^>]*>([^<]+)</g;
  let tabMatch;
  let idx = 0;
  while ((tabMatch = tabPattern.exec(html)) !== null) {
    worksheets.push({
      title: tabMatch[2].trim(),
      gid: tabMatch[1],
      rowCount: 0,
      index: idx++,
    });
  }

  // Method 2: If no tabs found via data-sheet-id, look for sheet-button pattern
  if (worksheets.length === 0) {
    const sheetBtnPattern = /id="sheet-button-(\d+)"[^>]*>([^<]+)</g;
    let btnMatch;
    idx = 0;
    while ((btnMatch = sheetBtnPattern.exec(html)) !== null) {
      worksheets.push({
        title: btnMatch[2].trim(),
        gid: btnMatch[1],
        rowCount: 0,
        index: idx++,
      });
    }
  }

  // Method 3: If still no tabs, try to fetch CSV with gid=0 to verify access
  if (worksheets.length === 0) {
    try {
      const csvUrl = buildCsvUrl(spreadsheetId, 0);
      const csvText = await fetchText(csvUrl);
      const { rows } = parseCsv(csvText);
      worksheets.push({
        title: "Sheet1",
        gid: "0",
        rowCount: rows.length,
        index: 0,
      });
    } catch {
      throw new Error(
        "Could not detect worksheets. Make sure the sheet is shared as 'Anyone with the link'."
      );
    }
  }

  // Try to get row counts by fetching a small sample from each tab
  for (const ws of worksheets) {
    if (ws.rowCount === 0) {
      try {
        const csvUrl = buildCsvUrl(spreadsheetId, ws.gid);
        const csvText = await fetchText(csvUrl);
        const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
        ws.rowCount = Math.max(0, lines.length - 1); // subtract header
      } catch {
        // Ignore — rowCount stays 0
      }
    }
  }

  return { spreadsheetId, title, worksheets };
}

export interface SheetPreviewResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/**
 * Fetch headers and preview rows from a specific worksheet via public CSV export.
 * worksheetName is matched against the tab list to find the gid.
 */
export async function previewSheetData(
  spreadsheetId: string,
  worksheetName: string,
  maxRows: number = 10
): Promise<SheetPreviewResult> {
  // Resolve gid from worksheet name
  const gid = await resolveGid(spreadsheetId, worksheetName);

  const csvUrl = buildCsvUrl(spreadsheetId, gid);
  const csvText = await fetchText(csvUrl);
  const { headers, rows } = parseCsv(csvText);

  const totalRows = rows.length;
  const previewRows = rows.slice(0, maxRows);

  return { headers, rows: previewRows, totalRows };
}

/**
 * Fetch all data rows from a worksheet (for sync).
 */
export async function fetchAllSheetRows(
  spreadsheetId: string,
  worksheetName: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const gid = await resolveGid(spreadsheetId, worksheetName);
  const csvUrl = buildCsvUrl(spreadsheetId, gid);
  const csvText = await fetchText(csvUrl);
  return parseCsv(csvText);
}

/**
 * Resolve a worksheet name to its gid.
 * Falls back to gid=0 if the sheet has only one tab or name can't be resolved.
 */
async function resolveGid(spreadsheetId: string, worksheetName: string): Promise<string> {
  // If worksheetName looks like a numeric gid already, use it directly
  if (/^\d+$/.test(worksheetName)) {
    return worksheetName;
  }

  // Fetch the pubhtml page to find the gid for this tab name
  try {
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/pubhtml`;
    const html = await fetchText(htmlUrl);

    // Look for the tab with matching name
    const tabPattern = /data-sheet-id="(\d+)"[^>]*>([^<]+)</g;
    let match;
    while ((match = tabPattern.exec(html)) !== null) {
      if (match[2].trim() === worksheetName) {
        return match[1];
      }
    }

    // Try sheet-button pattern
    const btnPattern = /id="sheet-button-(\d+)"[^>]*>([^<]+)</g;
    while ((match = btnPattern.exec(html)) !== null) {
      if (match[2].trim() === worksheetName) {
        return match[1];
      }
    }
  } catch {
    // Fallback to gid=0
  }

  // Default: gid=0 (first sheet)
  return "0";
}

// ─── Field Mapping Suggestion ────────────────────────────────────────────────

/** Detect column headers from a sheet and suggest field mappings */
export function suggestFieldMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  const knownMappings: Record<string, string> = {
    "id": "externalId",
    "meta_lead_id": "externalId",
    "created_time": "leadTime",
    "الاسم_بالكامل": "name",
    "full_name": "name",
    "الاسم بالكامل": "name",
    "رقم_الهاتف": "phone",
    "phone": "phone",
    "رقم الهاتف": "phone",
    "phone_number": "phone",
    "موقع_الويب": "businessProfile",
    "website": "businessProfile",
    "موقع الويب": "businessProfile",
    "lead_status": "stage",
    "status": "stage",
    "lead quality": "leadQuality",
    "lead_quality": "leadQuality",
    "note sales": "notes",
    "note_sales": "notes",
    "NOTE SALES": "notes",
    "note mb": "mediaBuyerNotes",
    "note_mb": "mediaBuyerNotes",
    "NOTE MB": "mediaBuyerNotes",
    "campaign_name": "campaignName",
    "ad_name": "_sourceMetadata.ad_name",
    "adset_name": "_sourceMetadata.adset_name",
    "form_name": "_sourceMetadata.form_name",
    "platform": "_sourceMetadata.platform",
    "is_organic": "_sourceMetadata.is_organic",
    "country": "country",
  };

  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    if (knownMappings[header]) {
      mapping[header] = knownMappings[header];
    } else if (knownMappings[lower]) {
      mapping[header] = knownMappings[lower];
    } else {
      mapping[header] = `_customField.${header}`;
    }
  }

  return mapping;
}

// ─── Export to Google Sheet (disabled for public links) ─────────────────────

/**
 * Export is not supported with public links (requires write auth).
 * This stub is kept for API compatibility.
 */
export async function exportToSheet(
  spreadsheetId: string,
  worksheetName: string,
  headers: string[],
  rows: string[][]
): Promise<{ updatedRows: number }> {
  throw new Error(
    "Export to Google Sheet requires a Google Service Account. " +
    "The current integration uses public links which are read-only. " +
    "Use the Excel Export feature instead."
  );
}

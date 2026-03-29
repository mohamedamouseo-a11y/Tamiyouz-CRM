export type RakanExecutiveReportType =
  | "ceo_master"
  | "sales_management"
  | "account_management"
  | "data_quality"
  | "follow_up_compliance"
  | "cold_misuse"
  | "renewals_risk"
  | "campaign_efficiency";

export type RakanExportFormat = "excel" | "document" | "both";

export interface RakanDateRangeInput {
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface RakanDateRangeResolved {
  dateFrom: string;
  dateTo: string;
}

export interface RakanMetricCard {
  key: string;
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}

export interface RakanReportSection {
  key: string;
  title: string;
  description?: string;
  rows: Array<Record<string, string | number | null>>;
}

export interface RakanBuiltReport {
  reportType: RakanExecutiveReportType;
  title: string;
  subtitle?: string;
  generatedAt: string;
  dateRange: RakanDateRangeResolved;
  executiveSummary: string[];
  metrics: RakanMetricCard[];
  sections: RakanReportSection[];
}

export interface RakanExportedReport {
  fileName: string;
  filePath: string;
  fileUrl: string;
  mimeType: string;
}

export interface RakanExportBundle {
  excel?: RakanExportedReport;
  document?: RakanExportedReport;
}

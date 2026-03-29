import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { buildRakanExecutiveReport, buildReportOverview } from "./services/rakanExecutiveReportService";
import { exportRakanReportBundle } from "./services/rakanExecutiveExportService";
import { runRakanAdvisorsOnce } from "./services/rakanAdvisoryEngine";
import type { RakanExecutiveReportType } from "./services/rakanExecutiveTypes";
import type { UserRole } from "./services/rakanService";

const reportTypeEnum = z.enum([
  "ceo_master",
  "sales_management",
  "account_management",
  "data_quality",
  "follow_up_compliance",
  "cold_misuse",
  "renewals_risk",
  "campaign_efficiency",
]);

const formatEnum = z.enum(["excel", "document", "both"]);

function assertCanAccessReport(reportType: RakanExecutiveReportType, role: string) {
  const isAdmin = role === "Admin" || role === "admin";
  if (isAdmin) return;

  const salesReports: RakanExecutiveReportType[] = ["sales_management", "data_quality", "follow_up_compliance", "cold_misuse"];
  const amReports: RakanExecutiveReportType[] = ["account_management", "follow_up_compliance", "renewals_risk", "data_quality"];
  const mediaReports: RakanExecutiveReportType[] = ["campaign_efficiency"];

  if (role === "SalesManager" && salesReports.includes(reportType)) return;
  if (role === "SalesAgent" && salesReports.includes(reportType)) return;
  if ((role === "AccountManager" || role === "AccountManagerLead") && amReports.includes(reportType)) return;
  if (role === "MediaBuyer" && mediaReports.includes(reportType)) return;

  throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لهذا التقرير." });
}

export const rakanExecutiveRouter = router({
  availableReports: protectedProcedure.query(({ ctx }) => {
    const role = ctx.user.role;
    const isAdmin = role === "Admin" || role === "admin";
    const base = [
      { key: "data_quality", label: "جودة البيانات" },
      { key: "follow_up_compliance", label: "الالتزام بالمتابعة" },
    ];
    if (isAdmin) {
      return [
        { key: "ceo_master", label: "التقرير التنفيذي الشامل" },
        { key: "sales_management", label: "أداء المبيعات" },
        { key: "account_management", label: "مديرو الحسابات" },
        { key: "cold_misuse", label: "إساءة استخدام Cold" },
        { key: "renewals_risk", label: "مخاطر التجديدات" },
        { key: "campaign_efficiency", label: "كفاءة الحملات" },
        ...base,
      ];
    }
    if (role === "MediaBuyer") {
      return [{ key: "campaign_efficiency", label: "كفاءة الحملات" }];
    }
    if (role === "AccountManager" || role === "AccountManagerLead") {
      return [
        { key: "account_management", label: "مديرو الحسابات" },
        { key: "renewals_risk", label: "مخاطر التجديدات" },
        ...base,
      ];
    }
    return [
      { key: "sales_management", label: "أداء المبيعات" },
      { key: "cold_misuse", label: "إساءة استخدام Cold" },
      ...base,
    ];
  }),

  getReportSummary: protectedProcedure
    .input(z.object({
      reportType: reportTypeEnum,
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertCanAccessReport(input.reportType, ctx.user.role);
      const report = await buildRakanExecutiveReport({
        reportType: input.reportType,
        role: ctx.user.role as UserRole,
        userId: ctx.user.id,
        dateRange: { dateFrom: input.dateFrom, dateTo: input.dateTo },
      });
      return {
        ...report,
        overview: buildReportOverview(report),
      };
    }),

  exportReport: protectedProcedure
    .input(z.object({
      reportType: reportTypeEnum,
      format: formatEnum.default("both"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCanAccessReport(input.reportType, ctx.user.role);
      const report = await buildRakanExecutiveReport({
        reportType: input.reportType,
        role: ctx.user.role as UserRole,
        userId: ctx.user.id,
        dateRange: { dateFrom: input.dateFrom, dateTo: input.dateTo },
      });
      const files = await exportRakanReportBundle(report, input.format);
      return {
        report,
        files,
        overview: buildReportOverview(report),
      };
    }),

  runAdvisorsNow: protectedProcedure.mutation(async ({ ctx }) => {
    const role = ctx.user.role;
    if (role !== "Admin" && role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    await runRakanAdvisorsOnce();
    return { success: true };
  }),
});

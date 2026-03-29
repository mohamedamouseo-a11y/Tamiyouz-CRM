import {
  getAccountManagersReport,
  getCampaignEfficiencyReport,
  getColdMisuseReport,
  getDataQualityIssues,
  getExecutiveSummary,
  getFollowUpComplianceReport,
  getRenewalsRiskReport,
  getSalesPerformanceReport,
  type ExecutiveUserRole,
} from "./rakanAnalyticsService";
import type {
  RakanBuiltReport,
  RakanDateRangeInput,
  RakanExecutiveReportType,
  RakanMetricCard,
  RakanReportSection,
} from "./rakanExecutiveTypes";

function numberFmt(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function mapRows<T extends Record<string, any>>(rows: T[]): Array<Record<string, string | number | null>> {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? null : value])));
}

function buildTitle(reportType: RakanExecutiveReportType): string {
  const titles: Record<RakanExecutiveReportType, string> = {
    ceo_master: "تقرير راكان التنفيذي الشامل",
    sales_management: "تقرير أداء المبيعات والمتابعة",
    account_management: "تقرير مديري الحسابات وصحة العملاء",
    data_quality: "تقرير جودة البيانات والانضباط التشغيلي",
    follow_up_compliance: "تقرير الالتزام بالمتابعة",
    cold_misuse: "تقرير إساءة استخدام حالة Cold",
    renewals_risk: "تقرير مخاطر التجديدات والعقود",
    campaign_efficiency: "تقرير كفاءة الحملات وجودة الليدز",
  };
  return titles[reportType];
}

export async function buildRakanExecutiveReport(params: {
  reportType: RakanExecutiveReportType;
  role: ExecutiveUserRole;
  userId: number;
  dateRange?: RakanDateRangeInput;
}): Promise<RakanBuiltReport> {
  const { reportType, role, userId, dateRange } = params;

  switch (reportType) {
    case "ceo_master": {
      const [summary, sales, am, dataQuality, followUps, renewals, campaigns] = await Promise.all([
        getExecutiveSummary(dateRange, role, userId),
        getSalesPerformanceReport(dateRange, role, userId),
        getAccountManagersReport(dateRange, role, userId),
        getDataQualityIssues(dateRange, role, userId),
        getFollowUpComplianceReport(dateRange, role, userId),
        getRenewalsRiskReport(dateRange, role, userId),
        getCampaignEfficiencyReport(dateRange),
      ]);

      const metrics: RakanMetricCard[] = [
        { key: "leads", label: "الليدز خلال الفترة", value: summary.metrics.leadsInRange },
        { key: "wonDeals", label: "الصفقات المكسوبة", value: summary.metrics.wonDeals, tone: "success" },
        { key: "wonValue", label: "قيمة الصفقات المكسوبة", value: numberFmt(summary.metrics.wonValue, 2), tone: "success" },
        { key: "staleLeads", label: "ليدز متوقفة", value: summary.metrics.staleLeads, tone: "warning" },
        { key: "riskyClients", label: "عملاء مرتفعو المخاطر", value: summary.metrics.riskyClients, tone: "danger" },
        { key: "renewalsDue", label: "تجديدات خلال 30 يوم", value: summary.metrics.renewalsDue, tone: "warning" },
      ];

      const executiveSummary = [
        `تم رصد ${numberFmt(summary.metrics.leadsWithoutOwner)} ليد بدون مسؤول واضح، و${numberFmt(summary.metrics.staleLeads)} ليد متوقف بلا متابعة كافية.`,
        `قيمة الصفقات المكسوبة خلال الفترة بلغت ${numberFmt(summary.metrics.wonValue, 2)} مع ${numberFmt(summary.metrics.wonDeals)} صفقة مكسوبة.`,
        `يوجد ${numberFmt(dataQuality.summary.coldWithoutActivity)} حالة Cold مشكوك فيها و${numberFmt(dataQuality.summary.clientsWithoutHealthScore)} عميل بدون Health Score مكتمل.`,
        `يوجد ${numberFmt(followUps.summary.overdueClientFollowUps)} متابعة عملاء متأخرة و${numberFmt(renewals.summary.renewalsDue30Days)} عقدًا يقترب من موعد الانتهاء.`,
      ];

      const sections: RakanReportSection[] = [
        {
          key: "stage_breakdown",
          title: "توزيع الليدز حسب المرحلة",
          rows: mapRows(summary.stageBreakdown),
        },
        {
          key: "owner_backlog",
          title: "الضغط التشغيلي حسب المسؤول",
          rows: mapRows(summary.ownerBacklog),
        },
        {
          key: "attention_leads",
          title: "ليدز تحتاج تدخلاً سريعًا",
          rows: mapRows(summary.topAttentionLeads),
        },
        {
          key: "sales_agents",
          title: "أداء فريق المبيعات",
          rows: mapRows(sales.agentPerformance),
        },
        {
          key: "sales_stalled",
          title: "ليدز المبيعات المتوقفة",
          rows: mapRows(sales.stalledLeads),
        },
        {
          key: "account_managers",
          title: "أداء مديري الحسابات",
          rows: mapRows(am.managerPerformance),
        },
        {
          key: "risky_clients",
          title: "عملاء يحتاجون متابعة عاجلة",
          rows: mapRows(am.riskyClients),
        },
        {
          key: "data_quality_leads",
          title: "مشكلات جودة بيانات الليدز",
          rows: mapRows(dataQuality.leadIssues),
        },
        {
          key: "data_quality_clients",
          title: "مشكلات جودة بيانات العملاء",
          rows: mapRows(dataQuality.clientIssues),
        },
        {
          key: "follow_up_clients",
          title: "متابعة العملاء المتأخرة",
          rows: mapRows(followUps.overdueClientItems),
        },
        {
          key: "renewals",
          title: "التجديدات المعرضة للخطر",
          rows: mapRows(renewals.renewals),
        },
        {
          key: "campaign_mix",
          title: "جودة الليدز حسب الحملة",
          rows: mapRows(campaigns.leadMixByCampaign),
        },
        {
          key: "tiktok_performance",
          title: "أداء حملات TikTok",
          rows: mapRows(campaigns.tiktokPerformance),
        },
      ];

      return {
        reportType,
        title: buildTitle(reportType),
        subtitle: "نظرة تنفيذية على المبيعات والمتابعة وجودة البيانات والعملاء",
        generatedAt: new Date().toISOString(),
        dateRange: summary.dateRange,
        executiveSummary,
        metrics,
        sections,
      };
    }

    case "sales_management": {
      const [sales, summary, coldMisuse] = await Promise.all([
        getSalesPerformanceReport(dateRange, role, userId),
        getExecutiveSummary(dateRange, role, userId),
        getColdMisuseReport(dateRange, role, userId),
      ]);

      return {
        reportType,
        title: buildTitle(reportType),
        subtitle: "يركز على التقدم الحقيقي للمبيعات والمتابعة وجودة الإغلاق",
        generatedAt: new Date().toISOString(),
        dateRange: sales.dateRange,
        executiveSummary: [
          `تم رصد ${numberFmt(summary.metrics.staleLeads)} ليد متوقف و${numberFmt(coldMisuse.summary.coldWithoutActivity)} حالة Cold بدون نشاط.`,
          `أعلى ضغط تشغيلي يظهر في المسؤولين ذوي stale leads المرتفعة وارتفاع استخدام Cold المشكوك فيه.`,
        ],
        metrics: [
          { key: "stale", label: "ليدز متوقفة", value: summary.metrics.staleLeads, tone: "warning" },
          { key: "wonDeals", label: "صفقات مكسوبة", value: summary.metrics.wonDeals, tone: "success" },
          { key: "wonValue", label: "قيمة الصفقات", value: numberFmt(summary.metrics.wonValue, 2), tone: "success" },
          { key: "coldMisuse", label: "Cold مشكوك فيه", value: coldMisuse.summary.coldWithoutActivity, tone: "danger" },
        ],
        sections: [
          { key: "agent_performance", title: "أداء المسؤولين", rows: mapRows(sales.agentPerformance) },
          { key: "stalled_leads", title: "الليدز المتوقفة", rows: mapRows(sales.stalledLeads) },
          { key: "cold_offenders", title: "المستخدمون الأعلى في Cold المشكوك فيه", rows: mapRows(coldMisuse.offenders) },
          { key: "cold_leads", title: "حالات Cold تحتاج مراجعة", rows: mapRows(coldMisuse.suspiciousLeads) },
        ],
      };
    }

    case "account_management": {
      const [am, followUps, renewals] = await Promise.all([
        getAccountManagersReport(dateRange, role, userId),
        getFollowUpComplianceReport(dateRange, role, userId),
        getRenewalsRiskReport(dateRange, role, userId),
      ]);

      return {
        reportType,
        title: buildTitle(reportType),
        subtitle: "يركز على صحة العملاء والتجديدات والانضباط في المتابعة",
        generatedAt: new Date().toISOString(),
        dateRange: am.dateRange,
        executiveSummary: [
          `تم رصد ${numberFmt(followUps.summary.overdueClientFollowUps)} متابعة عميل متأخرة و${numberFmt(renewals.summary.renewalsDue30Days)} عقدًا قريبًا من الانتهاء.`,
          `العملاء منخفضو الصحة أو الذين لا يملكون next follow-up واضحًا هم الأولوية القصوى اليوم.`,
        ],
        metrics: [
          { key: "overdueClientFollowUps", label: "متابعات عملاء متأخرة", value: followUps.summary.overdueClientFollowUps, tone: "warning" },
          { key: "clientsWithoutNext", label: "عملاء بلا Next Follow-up", value: followUps.summary.clientsWithoutNextFollowUp, tone: "danger" },
          { key: "renewals", label: "تجديدات خلال 30 يوم", value: renewals.summary.renewalsDue30Days, tone: "warning" },
        ],
        sections: [
          { key: "am_performance", title: "أداء مديري الحسابات", rows: mapRows(am.managerPerformance) },
          { key: "risky_clients", title: "العملاء الأكثر خطورة", rows: mapRows(am.riskyClients) },
          { key: "overdue_followups", title: "تفاصيل المتابعات المتأخرة", rows: mapRows(followUps.overdueClientItems) },
          { key: "renewals", title: "تفاصيل التجديدات", rows: mapRows(renewals.renewals) },
        ],
      };
    }

    case "data_quality": {
      const dataQuality = await getDataQualityIssues(dateRange, role, userId);

      return {
        reportType,
        title: buildTitle(reportType),
        subtitle: "يركز على العك التشغيلي والحقول الناقصة وسوء إغلاق الليدز",
        generatedAt: new Date().toISOString(),
        dateRange: dataQuality.dateRange,
        executiveSummary: [
          `يوجد ${numberFmt(dataQuality.summary.leadsWithoutOwner)} ليد بدون مسؤول و${numberFmt(dataQuality.summary.leadsWithoutCampaign)} ليد بدون Campaign.`,
          `يوجد ${numberFmt(dataQuality.summary.coldWithoutActivity)} حالة Cold بدون أي Activity و${numberFmt(dataQuality.summary.duplicatePhones)} أرقام مكررة تحتاج تنظيف.`,
          `يوجد ${numberFmt(dataQuality.summary.clientsWithoutHealthScore)} عميل بدون Health Score و${numberFmt(dataQuality.summary.contractsWithoutEndDate)} عقد بدون End Date.`,
        ],
        metrics: [
          { key: "leadsWithoutOwner", label: "ليدز بدون مسؤول", value: dataQuality.summary.leadsWithoutOwner, tone: "danger" },
          { key: "coldWithoutActivity", label: "Cold بدون نشاط", value: dataQuality.summary.coldWithoutActivity, tone: "danger" },
          { key: "clientsWithoutHealthScore", label: "عملاء بدون Health Score", value: dataQuality.summary.clientsWithoutHealthScore, tone: "warning" },
          { key: "duplicatePhones", label: "أرقام مكررة", value: dataQuality.summary.duplicatePhones, tone: "warning" },
        ],
        sections: [
          { key: "lead_issues", title: "قائمة مشكلات الليدز", rows: mapRows(dataQuality.leadIssues) },
          { key: "client_issues", title: "قائمة مشكلات العملاء", rows: mapRows(dataQuality.clientIssues) },
        ],
      };
    }

    case "follow_up_compliance": {
      const report = await getFollowUpComplianceReport(dateRange, role, userId);

      return {
        reportType,
        title: buildTitle(reportType),
        subtitle: "يركز على الليدز والعملاء الذين يحتاجون متابعة فعلية الآن",
        generatedAt: new Date().toISOString(),
        dateRange: report.dateRange,
        executiveSummary: [
          `تم رصد ${numberFmt(report.summary.leadsWithoutRecentActivity)} ليد بلا متابعة حديثة و${numberFmt(report.summary.leadsWithoutAnyActivity)} ليد بلا أي Activity.`,
          `يوجد ${numberFmt(report.summary.overdueClientFollowUps)} متابعة عميل متأخرة و${numberFmt(report.summary.clientsWithoutNextFollowUp)} عميل بلا next follow-up محدد.`,
        ],
        metrics: [
          { key: "stalledLeads", label: "ليدز بلا متابعة حديثة", value: report.summary.leadsWithoutRecentActivity, tone: "warning" },
          { key: "noActivity", label: "ليدز بلا أي Activity", value: report.summary.leadsWithoutAnyActivity, tone: "danger" },
          { key: "overdueClients", label: "متابعات عملاء متأخرة", value: report.summary.overdueClientFollowUps, tone: "warning" },
        ],
        sections: [
          { key: "owner_breaches", title: "خروقات المتابعة حسب المسؤول", rows: mapRows(report.ownerBreaches) },
          { key: "overdue_clients", title: "تفاصيل العملاء المتأخرين", rows: mapRows(report.overdueClientItems) },
        ],
      };
    }

    case "cold_misuse": {
      const report = await getColdMisuseReport(dateRange, role, userId);

      return {
        reportType,
        title: buildTitle(reportType),
        subtitle: "يركز على الاستخدام غير المنضبط لحالة Cold",
        generatedAt: new Date().toISOString(),
        dateRange: report.dateRange,
        executiveSummary: [
          `تم رصد ${numberFmt(report.summary.coldTagged)} ليد تم وضعها على Cold، منها ${numberFmt(report.summary.coldWithoutActivity)} بلا أي Activity.`,
          `هناك ${numberFmt(report.summary.coldWithin24Hours)} حالة تم تحويلها إلى Cold خلال 24 ساعة أو أقل، وهي تحتاج مراجعة.`,
        ],
        metrics: [
          { key: "coldTagged", label: "إجمالي Cold", value: report.summary.coldTagged, tone: "warning" },
          { key: "coldNoActivity", label: "Cold بدون Activity", value: report.summary.coldWithoutActivity, tone: "danger" },
          { key: "coldFast", label: "Cold خلال 24 ساعة", value: report.summary.coldWithin24Hours, tone: "danger" },
        ],
        sections: [
          { key: "offenders", title: "المستخدمون الأعلى مخالفة", rows: mapRows(report.offenders) },
          { key: "suspicious_leads", title: "الحالات المشكوك فيها", rows: mapRows(report.suspiciousLeads) },
        ],
      };
    }

    case "renewals_risk": {
      const report = await getRenewalsRiskReport(dateRange, role, userId);

      return {
        reportType,
        title: buildTitle(reportType),
        subtitle: "يركز على التجديدات القريبة والمهددة بالتأخير",
        generatedAt: new Date().toISOString(),
        dateRange: report.dateRange,
        executiveSummary: [
          `يوجد ${numberFmt(report.summary.renewalsDue30Days)} عقدًا يقترب من موعد الانتهاء خلال 30 يومًا.`,
          `منها ${numberFmt(report.summary.renewalsWithoutOwner)} عقدًا بلا مسؤول واضح و${numberFmt(report.summary.renewalsAtRisk)} عقدًا بحالة تجديد تستدعي التدخل.`,
        ],
        metrics: [
          { key: "renewalsDue", label: "تجديدات قريبة", value: report.summary.renewalsDue30Days, tone: "warning" },
          { key: "withoutOwner", label: "تجديدات بلا مسؤول", value: report.summary.renewalsWithoutOwner, tone: "danger" },
          { key: "atRisk", label: "تجديدات معرضة للخطر", value: report.summary.renewalsAtRisk, tone: "danger" },
        ],
        sections: [{ key: "renewals", title: "تفاصيل العقود", rows: mapRows(report.renewals) }],
      };
    }

    case "campaign_efficiency": {
      const report = await getCampaignEfficiencyReport(dateRange);

      return {
        reportType,
        title: buildTitle(reportType),
        subtitle: "يركز على جودة الليدز وأداء الحملات وفق البيانات المتاحة فعليًا في الـ CRM",
        generatedAt: new Date().toISOString(),
        dateRange: report.dateRange,
        executiveSummary: [
          `التقرير يعتمد على جودة الليدز حسب الحملة، وأداء TikTok التفصيلي، وإشارات ميزانيات Meta المتاحة في قاعدة البيانات الحالية.`,
          `هذا مهم لفهم إن كانت الحملات تصرف وتولد ليدز منخفضة الجودة أو لا يتم استكمالها تشغيليًا.`,
        ],
        metrics: [
          { key: "campaigns", label: "عدد الحملات في التقرير", value: report.leadMixByCampaign.length },
          { key: "tiktok", label: "حملات TikTok محللة", value: report.tiktokPerformance.length },
          { key: "metaSignals", label: "إشارات Meta المتاحة", value: report.metaBudgetSignals.length },
        ],
        sections: [
          { key: "lead_mix", title: "جودة الليدز حسب الحملة", rows: mapRows(report.leadMixByCampaign) },
          { key: "tiktok", title: "أداء TikTok", rows: mapRows(report.tiktokPerformance) },
          { key: "meta", title: "إشارات ميزانية Meta", rows: mapRows(report.metaBudgetSignals) },
        ],
      };
    }
  }
}

export function buildReportOverview(report: RakanBuiltReport): string {
  const lines: string[] = [];
  lines.push(`**${report.title}**`);
  lines.push(`الفترة: ${report.dateRange.dateFrom} إلى ${report.dateRange.dateTo}`);
  lines.push("");
  for (const item of report.executiveSummary) {
    lines.push(`- ${item}`);
  }
  if (report.metrics.length > 0) {
    lines.push("");
    lines.push("**أهم المؤشرات**");
    for (const metric of report.metrics) {
      lines.push(`- ${metric.label}: ${metric.value}`);
    }
  }
  return lines.join("\n");
}

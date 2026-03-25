import { fmtMoney, BASE_CURRENCY } from "@/lib/fmtMoney";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign,
  Users,
  TrendingUp,
  Target,
  Eye,
  MousePointer,
  BarChart3,
  Briefcase,
  Flame,
  Percent,
  Zap,
  Activity,
} from "lucide-react";

interface SummaryData {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpend: number;
  totalRevenue: number;
  totalLeads: number;
  totalDeals: number;
  wonDeals: number;
  overallROI: number;
  averageCPL: number;
  averageCTR: number;
  averageConversionRate: number;
  totalImpressions: number;
  totalClicks: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  badLeads: number;
}

interface MetaCombinedSummaryCardsProps {
  summary: SummaryData;
  isLoading?: boolean;
}

export default function MetaCombinedSummaryCards({
  summary,
  isLoading,
}: MetaCombinedSummaryCardsProps) {
  const { isRTL } = useLanguage();

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toLocaleString();
  };

  const formatCurrency = (n: number) => {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const cards = [
    {
      icon: <BarChart3 size={20} />,
      labelAr: "إجمالي الحملات",
      labelEn: "Total Campaigns",
      value: `${summary.totalCampaigns}`,
      subAr: `${summary.activeCampaigns} نشطة`,
      subEn: `${summary.activeCampaigns} Active`,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      icon: <DollarSign size={20} />,
      labelAr: "إجمالي الإنفاق",
      labelEn: "Total Spend",
      value: fmtMoney(summary.totalSpend, BASE_CURRENCY),
      subAr: `CPL: ${fmtMoney(summary.averageCPL, BASE_CURRENCY)}`,
      subEn: `CPL: ${fmtMoney(summary.averageCPL, BASE_CURRENCY)}`,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30",
    },
    {
      icon: <TrendingUp size={20} />,
      labelAr: "إجمالي الإيرادات",
      labelEn: "Total Revenue",
      value: fmtMoney(summary.totalRevenue, BASE_CURRENCY),
      subAr: `ROI: ${summary.overallROI.toFixed(1)}%`,
      subEn: `ROI: ${summary.overallROI.toFixed(1)}%`,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30",
    },
    {
      icon: <Users size={20} />,
      labelAr: "إجمالي العملاء",
      labelEn: "Total Leads",
      value: formatNumber(summary.totalLeads),
      subAr: `${summary.hotLeads} ساخن | ${summary.warmLeads} دافئ`,
      subEn: `${summary.hotLeads} Hot | ${summary.warmLeads} Warm`,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
    {
      icon: <Briefcase size={20} />,
      labelAr: "الصفقات",
      labelEn: "Deals",
      value: `${summary.wonDeals}/${summary.totalDeals}`,
      subAr: `معدل التحويل: ${summary.averageConversionRate.toFixed(1)}%`,
      subEn: `Conv. Rate: ${summary.averageConversionRate.toFixed(1)}%`,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      icon: <Eye size={20} />,
      labelAr: "المشاهدات",
      labelEn: "Impressions",
      value: formatNumber(summary.totalImpressions),
      subAr: `نقرات: ${formatNumber(summary.totalClicks)}`,
      subEn: `Clicks: ${formatNumber(summary.totalClicks)}`,
      color: "text-cyan-600",
      bg: "bg-cyan-50 dark:bg-cyan-950/30",
    },
    {
      icon: <MousePointer size={20} />,
      labelAr: "متوسط CTR",
      labelEn: "Average CTR",
      value: `${summary.averageCTR.toFixed(2)}%`,
      subAr: "نسبة النقر",
      subEn: "Click-Through Rate",
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
    },
    {
      icon: <Flame size={20} />,
      labelAr: "جودة العملاء",
      labelEn: "Lead Quality",
      value: `${summary.hotLeads + summary.warmLeads}`,
      subAr: `بارد: ${summary.coldLeads} | سيء: ${summary.badLeads}`,
      subEn: `Cold: ${summary.coldLeads} | Bad: ${summary.badLeads}`,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <Card
          key={i}
          className={`border shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
            isLoading ? "animate-pulse" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <span className={card.color}>{card.icon}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              {isRTL ? card.labelAr : card.labelEn}
            </p>
            <p className="text-xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isRTL ? card.subAr : card.subEn}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

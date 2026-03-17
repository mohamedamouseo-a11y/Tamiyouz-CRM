import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Eye, MousePointer, Target, TrendingUp, Percent, Zap } from "lucide-react";

interface Summary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  avgCpa: number;
}

interface TikTokCampaignSummaryCardsProps {
  summary: Summary;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export default function TikTokCampaignSummaryCards({ summary, isLoading }: TikTokCampaignSummaryCardsProps) {
  const { isRTL } = useLanguage();

  const cards = [
    {
      labelAr: "إجمالي الإنفاق",
      labelEn: "Total Spend",
      value: formatCurrency(summary.totalSpend),
      icon: <DollarSign size={16} className="text-green-500" />,
    },
    {
      labelAr: "إجمالي المشاهدات",
      labelEn: "Total Impressions",
      value: formatNumber(summary.totalImpressions),
      icon: <Eye size={16} className="text-blue-500" />,
    },
    {
      labelAr: "إجمالي النقرات",
      labelEn: "Total Clicks",
      value: formatNumber(summary.totalClicks),
      icon: <MousePointer size={16} className="text-purple-500" />,
    },
    {
      labelAr: "إجمالي التحويلات",
      labelEn: "Total Conversions",
      value: formatNumber(summary.totalConversions),
      icon: <Target size={16} className="text-orange-500" />,
    },
    {
      labelAr: "متوسط CTR",
      labelEn: "Avg CTR",
      value: formatPercent(summary.avgCtr),
      icon: <Percent size={16} className="text-cyan-500" />,
    },
    {
      labelAr: "متوسط CPC",
      labelEn: "Avg CPC",
      value: formatCurrency(summary.avgCpc),
      icon: <TrendingUp size={16} className="text-yellow-500" />,
    },
    {
      labelAr: "متوسط CPA",
      labelEn: "Avg CPA",
      value: formatCurrency(summary.avgCpa),
      icon: <Zap size={16} className="text-red-500" />,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card) => (
        <Card key={card.labelEn} className="relative overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {card.icon}
              {isRTL ? card.labelAr : card.labelEn}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={`text-lg font-bold ${isLoading ? "animate-pulse" : ""}`}>
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

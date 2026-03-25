import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from "recharts";

interface CampaignData {
  campaignId: number;
  campaignName: string;
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  badLeads: number;
  unknownLeads: number;
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  pendingDeals: number;
  totalRevenue: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpl: number;
  roi: number;
  conversionRate: number;
}

interface SummaryData {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  badLeads: number;
  totalSpend: number;
  totalRevenue: number;
}

interface MetaCombinedChartsProps {
  campaigns: CampaignData[];
  summary: SummaryData;
}

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
];

const QUALITY_COLORS = {
  hot: "#ef4444",
  warm: "#f97316",
  cold: "#3b82f6",
  bad: "#6b7280",
  unknown: "#d1d5db",
};

export default function MetaCombinedCharts({
  campaigns,
  summary,
}: MetaCombinedChartsProps) {
  const { isRTL } = useLanguage();

  // Top 10 campaigns by spend
  const spendData = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)
      .map((c) => ({
        name: c.campaignName.length > 20 ? c.campaignName.slice(0, 20) + "..." : c.campaignName,
        spend: c.spend,
        revenue: c.totalRevenue,
      }));
  }, [campaigns]);

  // Lead quality distribution
  const qualityData = useMemo(() => {
    return [
      { name: isRTL ? "ساخن" : "Hot", value: summary.hotLeads, color: QUALITY_COLORS.hot },
      { name: isRTL ? "دافئ" : "Warm", value: summary.warmLeads, color: QUALITY_COLORS.warm },
      { name: isRTL ? "بارد" : "Cold", value: summary.coldLeads, color: QUALITY_COLORS.cold },
      { name: isRTL ? "سيء" : "Bad", value: summary.badLeads, color: QUALITY_COLORS.bad },
    ].filter((d) => d.value > 0);
  }, [summary, isRTL]);

  // Top campaigns by ROI
  const roiData = useMemo(() => {
    return [...campaigns]
      .filter((c) => c.spend > 0)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 8)
      .map((c) => ({
        name: c.campaignName.length > 15 ? c.campaignName.slice(0, 15) + "..." : c.campaignName,
        roi: c.roi,
        cpl: c.cpl,
        conversionRate: c.conversionRate,
      }));
  }, [campaigns]);

  // Spend vs Revenue comparison
  const comparisonData = useMemo(() => {
    return [...campaigns]
      .filter((c) => c.spend > 0 || c.totalRevenue > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8)
      .map((c) => ({
        name: c.campaignName.length > 15 ? c.campaignName.slice(0, 15) + "..." : c.campaignName,
        spend: c.spend,
        revenue: c.totalRevenue,
        leads: c.totalLeads,
      }));
  }, [campaigns]);

  // Lead quality per campaign (top 8)
  const leadQualityPerCampaign = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => b.totalLeads - a.totalLeads)
      .slice(0, 8)
      .map((c) => ({
        name: c.campaignName.length > 15 ? c.campaignName.slice(0, 15) + "..." : c.campaignName,
        hot: c.hotLeads,
        warm: c.warmLeads,
        cold: c.coldLeads,
        bad: c.badLeads,
      }));
  }, [campaigns]);

  if (campaigns.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          {isRTL ? "لا توجد بيانات للعرض" : "No data to display"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Spend vs Revenue */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {isRTL ? "الإنفاق مقابل الإيرادات" : "Spend vs Revenue"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={comparisonData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value: number) => `${value.toLocaleString()} SAR`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="spend"
                name={isRTL ? "الإنفاق" : "Spend"}
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="revenue"
                name={isRTL ? "الإيرادات" : "Revenue"}
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lead Quality Distribution */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {isRTL ? "توزيع جودة العملاء" : "Lead Quality Distribution"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={qualityData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {qualityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lead Quality per Campaign */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {isRTL ? "جودة العملاء لكل حملة" : "Lead Quality per Campaign"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={leadQualityPerCampaign} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="hot" name={isRTL ? "ساخن" : "Hot"} stackId="a" fill={QUALITY_COLORS.hot} />
              <Bar dataKey="warm" name={isRTL ? "دافئ" : "Warm"} stackId="a" fill={QUALITY_COLORS.warm} />
              <Bar dataKey="cold" name={isRTL ? "بارد" : "Cold"} stackId="a" fill={QUALITY_COLORS.cold} />
              <Bar dataKey="bad" name={isRTL ? "سيء" : "Bad"} stackId="a" fill={QUALITY_COLORS.bad} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ROI & Performance */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {isRTL ? "أداء الحملات (ROI)" : "Campaign Performance (ROI)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={roiData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="roi"
                name="ROI %"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="conversionRate"
                name={isRTL ? "معدل التحويل %" : "Conv. Rate %"}
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

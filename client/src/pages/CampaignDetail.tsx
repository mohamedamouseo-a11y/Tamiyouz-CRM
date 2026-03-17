import CRMLayout from "@/components/CRMLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  ArrowLeft,
  BarChart2,
  Flame,
  HelpCircle,
  Image,
  Snowflake,
  ThermometerSun,
  ThumbsDown,
  Users,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { subDays } from "date-fns";
import { Link, useParams } from "wouter";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";

// Quality bar component
function QualityBar({
  hot,
  warm,
  cold,
  bad,
  unknown,
  total,
}: {
  hot: number;
  warm: number;
  cold: number;
  bad: number;
  unknown: number;
  total: number;
}) {
  if (total === 0) return null;
  const segments = [
    { count: hot, color: "#ef4444", label: "Hot" },
    { count: warm, color: "#f97316", label: "Warm" },
    { count: cold, color: "#06b6d4", label: "Cold" },
    { count: bad, color: "#9ca3af", label: "Bad" },
    { count: unknown, color: "#8b5cf6", label: "Unknown" },
  ].filter((s) => s.count > 0);

  return (
    <div className="w-full">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full transition-all"
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color,
            }}
            title={`${seg.label}: ${seg.count} (${((seg.count / total) * 100).toFixed(1)}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-muted-foreground">
              {seg.label}: <span className="font-semibold text-foreground">{seg.count}</span>{" "}
              <span className="text-muted-foreground/70">({((seg.count / total) * 100).toFixed(1)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  icon,
  value,
  label,
  color,
  bgFrom,
  bgTo,
  borderColor,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  bgFrom: string;
  bgTo: string;
  borderColor: string;
}) {
  return (
    <Card style={{ borderColor }} className="overflow-hidden">
      <CardContent className="p-4 text-center" style={{ background: `linear-gradient(to bottom right, ${bgFrom}, ${bgTo})` }}>
        <div className="mx-auto mb-1.5" style={{ color }}>{icon}</div>
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        <p className="text-[11px] mt-0.5" style={{ color, opacity: 0.8 }}>{label}</p>
      </CardContent>
    </Card>
  );
}

export default function CampaignDetail() {
  const { name } = useParams<{ name: string }>();
  const campaignName = (() => { try { return decodeURIComponent(name ?? ""); } catch { return name ?? ""; } })();
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: detail, isLoading } = trpc.campaigns.detail.useQuery(
    { campaignName, dateFrom: dateRange.from, dateTo: dateRange.to },
    { enabled: !!campaignName }
  );

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <CRMLayout>
      <div className="p-6 space-y-6 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <BackArrow size={18} />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{campaignName}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isRTL ? "تفاصيل وإحصائيات الحملة" : "Campaign details & statistics"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <DateRangePicker value={dateRange} onChange={setDateRange} isRTL={isRTL} />
            <Link href={`/leads?campaign=${encodeURIComponent(campaignName)}`}>
              <Button
                variant="outline"
                className="gap-2"
              >
                <Users size={16} />
                {isRTL ? "عرض كل العملاء" : "View All Leads"}
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-8 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-4 bg-muted rounded animate-pulse w-2/3 mx-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : detail ? (
          <>
            {/* Overall Campaign Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <StatCard
                icon={<Users size={22} className="mx-auto" />}
                value={detail.totalLeads}
                label={isRTL ? "إجمالي العملاء" : "Total Leads"}
                color="#2563eb"
                bgFrom="#eff6ff"
                bgTo="#dbeafe"
                borderColor="#bfdbfe"
              />
              <StatCard
                icon={<Flame size={22} className="mx-auto" />}
                value={detail.hot}
                label="Hot"
                color="#dc2626"
                bgFrom="#fef2f2"
                bgTo="#fee2e2"
                borderColor="#fecaca"
              />
              <StatCard
                icon={<ThermometerSun size={22} className="mx-auto" />}
                value={detail.warm}
                label="Warm"
                color="#ea580c"
                bgFrom="#fff7ed"
                bgTo="#ffedd5"
                borderColor="#fed7aa"
              />
              <StatCard
                icon={<Snowflake size={22} className="mx-auto" />}
                value={detail.cold}
                label="Cold"
                color="#0891b2"
                bgFrom="#ecfeff"
                bgTo="#cffafe"
                borderColor="#a5f3fc"
              />
              <StatCard
                icon={<ThumbsDown size={22} className="mx-auto" />}
                value={detail.bad}
                label="Bad"
                color="#6b7280"
                bgFrom="#f9fafb"
                bgTo="#f3f4f6"
                borderColor="#e5e7eb"
              />
              <StatCard
                icon={<HelpCircle size={22} className="mx-auto" />}
                value={detail.unknown}
                label="Unknown"
                color="#7c3aed"
                bgFrom="#f5f3ff"
                bgTo="#ede9fe"
                borderColor="#ddd6fe"
              />
            </div>

            {/* Quality Distribution Bar */}
            {detail.totalLeads > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp size={16} />
                    {isRTL ? "توزيع جودة العملاء" : "Lead Quality Distribution"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <QualityBar
                    hot={detail.hot}
                    warm={detail.warm}
                    cold={detail.cold}
                    bad={detail.bad}
                    unknown={detail.unknown}
                    total={detail.totalLeads}
                  />
                </CardContent>
              </Card>
            )}

            {/* Ad Creatives Breakdown */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Image size={20} />
                {isRTL ? "تفاصيل الإعلانات" : "Ad Creatives Breakdown"}
                <Badge variant="secondary" className="text-xs">
                  {detail.adCreatives.length} {isRTL ? "إعلان" : "ads"}
                </Badge>
              </h2>

              {detail.adCreatives.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Image size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground text-sm">
                      {isRTL ? "لا توجد إعلانات في هذه الحملة" : "No ad creatives in this campaign"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detail.adCreatives.map((ad) => {
                    const hotPct = ad.totalLeads > 0 ? ((ad.hot / ad.totalLeads) * 100).toFixed(0) : "0";
                    const warmPct = ad.totalLeads > 0 ? (((ad.hot + ad.warm) / ad.totalLeads) * 100).toFixed(0) : "0";
                    return (
                      <Card key={ad.adCreative} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ background: tokens.primaryColor }}
                              >
                                <Image size={14} />
                              </div>
                              <span className="line-clamp-1">{ad.adCreative}</span>
                            </CardTitle>
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0 font-bold"
                            >
                              {ad.totalLeads} {isRTL ? "عميل" : "leads"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-4 space-y-3">
                          {/* Quality bar for this ad */}
                          <QualityBar
                            hot={ad.hot}
                            warm={ad.warm}
                            cold={ad.cold}
                            bad={ad.bad}
                            unknown={ad.unknown}
                            total={ad.totalLeads}
                          />

                          {/* Quick quality summary */}
                          <div className="flex items-center gap-3 pt-1">
                            <div className="flex items-center gap-1 text-xs">
                              <Flame size={12} className="text-red-500" />
                              <span className="font-semibold text-red-600">{hotPct}%</span>
                              <span className="text-muted-foreground">{isRTL ? "ساخن" : "hot"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <TrendingUp size={12} className="text-green-500" />
                              <span className="font-semibold text-green-600">{warmPct}%</span>
                              <span className="text-muted-foreground">{isRTL ? "جودة عالية" : "quality"}</span>
                            </div>
                          </div>

                          {/* View leads for this ad creative */}
                          <Link href={`/leads?campaign=${encodeURIComponent(campaignName)}`}>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 w-full mt-1">
                              <BarChart2 size={12} />
                              {isRTL ? "عرض العملاء" : "View Leads"}
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <BarChart2 size={48} className="mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">
                {isRTL ? "لا توجد بيانات لهذه الحملة" : "No data for this campaign"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </CRMLayout>
  );
}

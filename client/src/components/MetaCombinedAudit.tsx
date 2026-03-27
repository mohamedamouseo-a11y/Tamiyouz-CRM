import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
  Target,
  Eye,
  MousePointer,
} from "lucide-react";

// ─── Leads Comparison Section ────────────────────────────────────────────────

function LeadsComparisonSection({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const { isRTL } = useLanguage();
  const { data, isLoading, refetch, isFetching } = trpc.metaAudit.compareLeads.useQuery(
    { dateFrom, dateTo },
    { enabled: false }
  );
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleCompare = () => {
    setHasLoaded(true);
    refetch();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-primary" />
            <CardTitle className="text-base">
              {isRTL ? "مقارنة Leads - Meta vs CRM" : "Leads Comparison - Meta vs CRM"}
            </CardTitle>
          </div>
          <Button
            size="sm"
            onClick={handleCompare}
            disabled={isLoading || isFetching}
          >
            {(isLoading || isFetching) ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <Search size={14} className="mr-1" />
            )}
            {isRTL ? "مقارنة" : "Compare"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasLoaded ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search size={32} className="mx-auto mb-2 opacity-50" />
            <p>{isRTL ? "اضغط \"مقارنة\" لبدء المقارنة" : "Click \"Compare\" to start comparison"}</p>
          </div>
        ) : (isLoading || isFetching) ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="mr-2 ml-2">{isRTL ? "جاري المقارنة..." : "Comparing..."}</span>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{data.summary.metaTotal}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? "Leads في Meta" : "Meta Leads"}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{data.summary.matched}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? "متطابق في CRM" : "Matched in CRM"}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{data.summary.missingInCrm}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? "ناقص من CRM" : "Missing from CRM"}</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${
                parseFloat(data.summary.syncRate) >= 90
                  ? "bg-green-50 dark:bg-green-950/30"
                  : parseFloat(data.summary.syncRate) >= 50
                  ? "bg-yellow-50 dark:bg-yellow-950/30"
                  : "bg-red-50 dark:bg-red-950/30"
              }`}>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-2xl font-bold">
                    {data.summary.syncRate}
                  </span>
                  {parseFloat(data.summary.syncRate) >= 90 ? (
                    <CheckCircle2 size={18} className="text-green-600" />
                  ) : (
                    <XCircle size={18} className="text-red-600" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{isRTL ? "نسبة المزامنة" : "Sync Rate"}</div>
              </div>
            </div>

            {/* Form Breakdown Table */}
            {data.formBreakdown.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 font-medium text-sm">
                  {isRTL ? "تفصيل حسب النموذج" : "Breakdown by Form"}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-4 py-2 text-right font-medium">{isRTL ? "النموذج" : "Form"}</th>
                        <th className="px-3 py-2 text-center font-medium">Meta</th>
                        <th className="px-3 py-2 text-center font-medium">CRM</th>
                        <th className="px-3 py-2 text-center font-medium">{isRTL ? "ناقص" : "Missing"}</th>
                        <th className="px-3 py-2 text-center font-medium">{isRTL ? "نسبة المزامنة" : "Sync %"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.formBreakdown.map((form: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2 font-medium">{form.formName}</td>
                          <td className="px-3 py-2 text-center">{form.metaCount}</td>
                          <td className="px-3 py-2 text-center">{form.crmCount}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={form.missing > 0 ? "text-red-600 font-bold bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded" : ""}>
                              {form.missing}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              form.syncRate === "N/A"
                                ? "bg-gray-100 dark:bg-gray-800 text-gray-500"
                                : parseFloat(form.syncRate) >= 90
                                ? "bg-green-100 dark:bg-green-950 text-green-700"
                                : parseFloat(form.syncRate) >= 50
                                ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-700"
                                : "bg-red-100 dark:bg-red-950 text-red-700"
                            }`}>
                              {form.syncRate}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Missing Leads */}
            {data.missingLeads.length > 0 && (
              <MissingLeadsList leads={data.missingLeads} />
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MissingLeadsList({ leads }: { leads: any[] }) {
  const { isRTL } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const displayLeads = showAll ? leads : leads.slice(0, 10);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-red-50 dark:bg-red-950/30 px-4 py-2 flex items-center gap-2">
        <AlertTriangle size={14} className="text-red-600" />
        <span className="font-medium text-sm text-red-700 dark:text-red-400">
          {isRTL ? `Leads ناقصة من CRM (${leads.length})` : `Missing from CRM (${leads.length})`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-2 text-right font-medium">{isRTL ? "الاسم" : "Name"}</th>
              <th className="px-3 py-2 text-right font-medium">{isRTL ? "الهاتف" : "Phone"}</th>
              <th className="px-3 py-2 text-right font-medium">{isRTL ? "النموذج" : "Form"}</th>
              <th className="px-3 py-2 text-right font-medium">{isRTL ? "الحملة" : "Campaign"}</th>
              <th className="px-3 py-2 text-right font-medium">{isRTL ? "التاريخ" : "Date"}</th>
            </tr>
          </thead>
          <tbody>
            {displayLeads.map((lead: any, i: number) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">{lead.name}</td>
                <td className="px-3 py-2 direction-ltr text-right">{lead.phone}</td>
                <td className="px-3 py-2">{lead.formName}</td>
                <td className="px-3 py-2 text-xs">{lead.campaignName}</td>
                <td className="px-3 py-2 text-xs">{new Date(lead.createdTime).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {leads.length > 10 && (
        <div className="px-4 py-2 border-t bg-muted/20 text-center">
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll
              ? (isRTL ? "عرض أقل" : "Show Less")
              : (isRTL ? `عرض الكل (${leads.length})` : `Show All (${leads.length})`)}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── ROAS Section ────────────────────────────────────────────────────────────

function RoasSection({ dateFrom, dateTo, datePreset }: { dateFrom?: string; dateTo?: string; datePreset?: string }) {
  const { isRTL } = useLanguage();
  const { data, isLoading, refetch, isFetching } = trpc.metaAudit.calculateRoas.useQuery(
    { dateFrom, dateTo, datePreset: datePreset || "last_30d" },
    { enabled: false }
  );
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleCalculate = () => {
    setHasLoaded(true);
    refetch();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat("en-SA").format(val);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            <CardTitle className="text-base">
              {isRTL ? "ROAS - العائد على الإنفاق الإعلاني" : "ROAS - Return on Ad Spend"}
            </CardTitle>
          </div>
          <Button
            size="sm"
            onClick={handleCalculate}
            disabled={isLoading || isFetching}
          >
            {(isLoading || isFetching) ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <BarChart3 size={14} className="mr-1" />
            )}
            {isRTL ? "حساب ROAS" : "Calculate ROAS"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasLoaded ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
            <p>{isRTL ? "اضغط \"حساب ROAS\" لبدء التحليل" : "Click \"Calculate ROAS\" to start analysis"}</p>
          </div>
        ) : (isLoading || isFetching) ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="mr-2 ml-2">{isRTL ? "جاري سحب البيانات وحساب ROAS..." : "Fetching data and calculating ROAS..."}</span>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <SummaryCard
                icon={<DollarSign size={16} />}
                label={isRTL ? "إجمالي الإنفاق" : "Total Spend"}
                value={formatCurrency(data.summary.totalSpend)}
                color="red"
              />
              <SummaryCard
                icon={<TrendingUp size={16} />}
                label={isRTL ? "إيرادات (Won)" : "Won Revenue"}
                value={formatCurrency(data.summary.totalWonRevenue)}
                color="green"
              />
              <SummaryCard
                icon={<Target size={16} />}
                label="ROAS"
                value={data.summary.overallRoas !== null ? `${data.summary.overallRoas.toFixed(2)}x` : "N/A"}
                color={data.summary.overallRoas && data.summary.overallRoas >= 1 ? "green" : "red"}
              />
              <SummaryCard
                icon={<Users size={16} />}
                label={isRTL ? "Leads (Meta)" : "Leads (Meta)"}
                value={formatNumber(data.summary.totalLeads)}
                color="blue"
              />
              <SummaryCard
                icon={<DollarSign size={16} />}
                label={isRTL ? "تكلفة الـ Lead" : "Cost per Lead"}
                value={data.summary.avgCpl !== null ? formatCurrency(data.summary.avgCpl) : "N/A"}
                color="orange"
              />
            </div>

            {/* Extra stats row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard
                icon={<Eye size={16} />}
                label={isRTL ? "مرات الظهور" : "Impressions"}
                value={formatNumber(data.summary.totalImpressions)}
                color="purple"
                small
              />
              <SummaryCard
                icon={<MousePointer size={16} />}
                label={isRTL ? "النقرات" : "Clicks"}
                value={formatNumber(data.summary.totalClicks)}
                color="blue"
                small
              />
              <SummaryCard
                icon={<Users size={16} />}
                label={isRTL ? "Leads في CRM" : "CRM Leads"}
                value={formatNumber(data.summary.totalCrmLeads)}
                color="green"
                small
              />
              <SummaryCard
                icon={<Target size={16} />}
                label={isRTL ? "Deals (Won)" : "Won Deals"}
                value={`${data.summary.totalWonDeals} / ${data.summary.totalDeals}`}
                color="green"
                small
              />
              <SummaryCard
                icon={<DollarSign size={16} />}
                label={isRTL ? "إجمالي الإيرادات" : "Total Revenue"}
                value={formatCurrency(data.summary.totalRevenue)}
                color="green"
                small
              />
            </div>

            {/* Campaign ROAS Table */}
            {data.campaigns.length > 0 && (
              <CampaignRoasTable campaigns={data.campaigns} />
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ icon, label, value, color, small }: { icon: React.ReactNode; label: string; value: string; color: string; small?: boolean }) {
  const colorMap: Record<string, string> = {
    red: "bg-red-50 dark:bg-red-950/30 text-red-600",
    green: "bg-green-50 dark:bg-green-950/30 text-green-600",
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-600",
    orange: "bg-orange-50 dark:bg-orange-950/30 text-orange-600",
    purple: "bg-purple-50 dark:bg-purple-950/30 text-purple-600",
  };

  return (
    <div className={`rounded-lg ${small ? "p-2" : "p-3"} text-center ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center justify-center gap-1 mb-1 opacity-70">{icon}</div>
      <div className={`font-bold ${small ? "text-sm" : "text-lg"}`}>{value}</div>
      <div className={`text-muted-foreground ${small ? "text-[10px]" : "text-xs"}`}>{label}</div>
    </div>
  );
}

function CampaignRoasTable({ campaigns }: { campaigns: any[] }) {
  const { isRTL } = useLanguage();
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    if (val === 0) return "—";
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 font-medium text-sm">
        {isRTL ? "ROAS لكل حملة وإعلان" : "ROAS per Campaign & Ad"}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-2 text-right font-medium">{isRTL ? "الحملة / الإعلان" : "Campaign / Ad"}</th>
              <th className="px-3 py-2 text-center font-medium">{isRTL ? "الإنفاق" : "Spend"}</th>
              <th className="px-3 py-2 text-center font-medium">Leads</th>
              <th className="px-3 py-2 text-center font-medium">CRM</th>
              <th className="px-3 py-2 text-center font-medium">Deals</th>
              <th className="px-3 py-2 text-center font-medium">{isRTL ? "إيرادات" : "Revenue"}</th>
              <th className="px-3 py-2 text-center font-medium">ROAS</th>
              <th className="px-3 py-2 text-center font-medium">CPL</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign: any) => (
              <>
                <tr
                  key={campaign.campaignId}
                  className="border-b hover:bg-muted/20 cursor-pointer font-medium"
                  onClick={() =>
                    setExpandedCampaign(
                      expandedCampaign === campaign.campaignId ? null : campaign.campaignId
                    )
                  }
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {campaign.ads?.length > 0 ? (
                        expandedCampaign === campaign.campaignId ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )
                      ) : (
                        <span className="w-[14px]" />
                      )}
                      <span className="truncate max-w-[200px]">{campaign.campaignName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">{formatCurrency(campaign.spend)}</td>
                  <td className="px-3 py-2 text-center">{campaign.metaLeads}</td>
                  <td className="px-3 py-2 text-center">{campaign.crmLeads}</td>
                  <td className="px-3 py-2 text-center">
                    {campaign.wonDealsCount > 0 ? (
                      <span className="text-green-600 font-bold">{campaign.wonDealsCount}</span>
                    ) : (
                      campaign.dealsCount || "—"
                    )}
                    {campaign.dealsCount > 0 && campaign.wonDealsCount !== campaign.dealsCount && (
                      <span className="text-muted-foreground text-xs">/{campaign.dealsCount}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">{formatCurrency(campaign.wonRevenue)}</td>
                  <td className="px-3 py-2 text-center">
                    <RoasBadge value={campaign.roas} />
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {campaign.cpl !== null ? formatCurrency(campaign.cpl) : "—"}
                  </td>
                </tr>
                {/* Expanded Ad Rows */}
                {expandedCampaign === campaign.campaignId &&
                  campaign.ads?.map((ad: any) => (
                    <tr key={ad.adId} className="border-b bg-muted/10 hover:bg-muted/20 text-xs">
                      <td className="px-3 py-1.5 pr-8">
                        <span className="text-muted-foreground mr-2 ml-2">↳</span>
                        <span className="truncate max-w-[180px] inline-block align-middle">{ad.adName}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center">{formatCurrency(ad.spend)}</td>
                      <td className="px-3 py-1.5 text-center">{ad.metaLeads}</td>
                      <td className="px-3 py-1.5 text-center">{ad.crmLeads}</td>
                      <td className="px-3 py-1.5 text-center">
                        {ad.wonDealsCount > 0 ? (
                          <span className="text-green-600 font-bold">{ad.wonDealsCount}</span>
                        ) : (
                          ad.dealsCount || "—"
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">{formatCurrency(ad.wonRevenue)}</td>
                      <td className="px-3 py-1.5 text-center">
                        <RoasBadge value={ad.roas} small />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {ad.cpl !== null ? formatCurrency(ad.cpl) : "—"}
                      </td>
                    </tr>
                  ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoasBadge({ value, small }: { value: number | null; small?: boolean }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const color =
    value >= 3 ? "bg-green-100 dark:bg-green-950 text-green-700" :
    value >= 1 ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-700" :
    "bg-red-100 dark:bg-red-950 text-red-700";
  return (
    <span className={`px-2 py-0.5 rounded font-bold ${color} ${small ? "text-[10px]" : "text-xs"}`}>
      {value.toFixed(2)}x
    </span>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function MetaCombinedAudit({
  dateFrom,
  dateTo,
  datePreset,
}: {
  dateFrom?: string;
  dateTo?: string;
  datePreset?: string;
}) {
  return (
    <div className="space-y-4">
      <LeadsComparisonSection dateFrom={dateFrom} dateTo={dateTo} />
      <RoasSection dateFrom={dateFrom} dateTo={dateTo} datePreset={datePreset} />
    </div>
  );
}

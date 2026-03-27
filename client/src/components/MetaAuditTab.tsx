import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MetaAuditTab() {
  const { isRTL } = useLanguage();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("last_30d");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [activeTab, setActiveTab] = useState<"comparison" | "roas">("comparison");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());

  const compareQuery = trpc.meta.leadgen.compareLeads.useQuery(
    { dateFrom: useCustomDate ? dateFrom : undefined, dateTo: useCustomDate ? dateTo : undefined },
    { enabled: false }
  );

  const roasQuery = trpc.meta.leadgen.calculateRoas.useQuery(
    {
      dateFrom: useCustomDate ? dateFrom : undefined,
      dateTo: useCustomDate ? dateTo : undefined,
      datePreset: useCustomDate ? undefined : datePreset,
    },
    { enabled: false }
  );

  const handleCompare = () => compareQuery.refetch();
  const handleRoas = () => roasQuery.refetch();

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(val);

  const formatNumber = (val: number) =>
    new Intl.NumberFormat("en-SA", { maximumFractionDigits: 2 }).format(val);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            {isRTL ? "تدقيق Meta و ROAS" : "Meta Audit & ROAS"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL
              ? "قارن بين leads الحملات و CRM واحسب العائد على الإنفاق الإعلاني"
              : "Compare campaign leads vs CRM and calculate return on ad spend"}
          </p>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant={!useCustomDate ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCustomDate(false)}
              >
                {isRTL ? "فترة محددة" : "Preset"}
              </Button>
              <Button
                variant={useCustomDate ? "default" : "outline"}
                size="sm"
                onClick={() => setUseCustomDate(true)}
              >
                {isRTL ? "تاريخ مخصص" : "Custom Date"}
              </Button>
            </div>

            {!useCustomDate ? (
              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_7d">{isRTL ? "آخر 7 أيام" : "Last 7 days"}</SelectItem>
                  <SelectItem value="last_14d">{isRTL ? "آخر 14 يوم" : "Last 14 days"}</SelectItem>
                  <SelectItem value="last_30d">{isRTL ? "آخر 30 يوم" : "Last 30 days"}</SelectItem>
                  <SelectItem value="last_90d">{isRTL ? "آخر 90 يوم" : "Last 90 days"}</SelectItem>
                  <SelectItem value="this_month">{isRTL ? "هذا الشهر" : "This month"}</SelectItem>
                  <SelectItem value="last_month">{isRTL ? "الشهر الماضي" : "Last month"}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[160px]"
                  placeholder={isRTL ? "من" : "From"}
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[160px]"
                  placeholder={isRTL ? "إلى" : "To"}
                />
              </>
            )}

            <div className="flex gap-2 ms-auto">
              <Button onClick={handleCompare} disabled={compareQuery.isFetching} size="sm" variant="outline">
                <RefreshCw className={`h-4 w-4 me-1 ${compareQuery.isFetching ? "animate-spin" : ""}`} />
                {isRTL ? "مقارنة Leads" : "Compare Leads"}
              </Button>
              <Button onClick={handleRoas} disabled={roasQuery.isFetching} size="sm">
                <TrendingUp className={`h-4 w-4 me-1 ${roasQuery.isFetching ? "animate-spin" : ""}`} />
                {isRTL ? "حساب ROAS" : "Calculate ROAS"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === "comparison" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("comparison")}
        >
          <Users className="h-4 w-4 me-1" />
          {isRTL ? "مقارنة Leads" : "Leads Comparison"}
        </Button>
        <Button
          variant={activeTab === "roas" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("roas")}
        >
          <DollarSign className="h-4 w-4 me-1" />
          {isRTL ? "ROAS لكل إعلان" : "ROAS per Ad"}
        </Button>
      </div>

      {/* ─── Leads Comparison Tab ─── */}
      {activeTab === "comparison" && (
        <div className="space-y-4">
          {compareQuery.data && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{compareQuery.data.summary.metaTotal}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "Leads في Meta" : "Meta Leads"}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{compareQuery.data.summary.matched}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "متطابق في CRM" : "Matched in CRM"}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{compareQuery.data.summary.missingInCrm}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "ناقص من CRM" : "Missing from CRM"}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold">
                      {compareQuery.data.summary.syncRate}
                    </div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "نسبة المزامنة" : "Sync Rate"}</div>
                    {parseFloat(compareQuery.data.summary.syncRate) >= 95 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mt-1" />
                    ) : parseFloat(compareQuery.data.summary.syncRate) >= 80 ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mx-auto mt-1" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 mx-auto mt-1" />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Form Breakdown */}
              {compareQuery.data.formBreakdown.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{isRTL ? "تفصيل حسب النموذج" : "Breakdown by Form"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? "النموذج" : "Form"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "Meta" : "Meta"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "CRM" : "CRM"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "ناقص" : "Missing"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "نسبة المزامنة" : "Sync Rate"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compareQuery.data.formBreakdown.map((form) => (
                          <TableRow key={form.formId}>
                            <TableCell className="font-medium">{form.formName}</TableCell>
                            <TableCell className="text-center">{form.metaCount}</TableCell>
                            <TableCell className="text-center">{form.crmCount}</TableCell>
                            <TableCell className="text-center">
                              {form.missing > 0 ? (
                                <Badge variant="destructive">{form.missing}</Badge>
                              ) : (
                                <Badge variant="secondary">0</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  parseFloat(form.syncRate) >= 95
                                    ? "default"
                                    : parseFloat(form.syncRate) >= 80
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {form.syncRate}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Missing Leads */}
              {compareQuery.data.missingLeads.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      {isRTL
                        ? `Leads ناقصة من CRM (${compareQuery.data.missingLeads.length})`
                        : `Missing from CRM (${compareQuery.data.missingLeads.length})`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{isRTL ? "الاسم" : "Name"}</TableHead>
                            <TableHead>{isRTL ? "الهاتف" : "Phone"}</TableHead>
                            <TableHead>{isRTL ? "النموذج" : "Form"}</TableHead>
                            <TableHead>{isRTL ? "الحملة" : "Campaign"}</TableHead>
                            <TableHead>{isRTL ? "الإعلان" : "Ad"}</TableHead>
                            <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {compareQuery.data.missingLeads.map((lead) => (
                            <TableRow key={lead.metaLeadId}>
                              <TableCell className="font-medium">{lead.name}</TableCell>
                              <TableCell dir="ltr">{lead.phone}</TableCell>
                              <TableCell className="text-xs">{lead.formName}</TableCell>
                              <TableCell className="text-xs">{lead.campaignName}</TableCell>
                              <TableCell className="text-xs">{lead.adName}</TableCell>
                              <TableCell className="text-xs">
                                {new Date(lead.createdTime).toLocaleDateString("en-GB")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {compareQuery.data.missingLeads.length === 0 && compareQuery.data.summary.metaTotal > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div>
                      <div className="font-semibold text-green-800">
                        {isRTL ? "كل الـ Leads متزامنة!" : "All Leads are Synced!"}
                      </div>
                      <div className="text-sm text-green-600">
                        {isRTL
                          ? `كل ${compareQuery.data.summary.metaTotal} lead من Meta موجودين في CRM`
                          : `All ${compareQuery.data.summary.metaTotal} leads from Meta are present in CRM`}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!compareQuery.data && !compareQuery.isFetching && (
            <Card className="border-dashed">
              <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{isRTL ? 'اضغط "مقارنة Leads" لبدء المقارنة' : 'Click "Compare Leads" to start comparison'}</p>
              </CardContent>
            </Card>
          )}

          {compareQuery.isFetching && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-blue-500" />
                <p className="text-muted-foreground">
                  {isRTL ? "جاري سحب البيانات من Meta..." : "Fetching data from Meta..."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── ROAS Tab ─── */}
      {activeTab === "roas" && (
        <div className="space-y-4">
          {roasQuery.data && (
            <>
              {/* ROAS Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="pt-4 pb-4 text-center">
                    <DollarSign className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-blue-700">
                      {formatCurrency(roasQuery.data.summary.totalSpend)}
                    </div>
                    <div className="text-xs text-blue-600">{isRTL ? "إجمالي الإنفاق" : "Total Spend"}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="pt-4 pb-4 text-center">
                    <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrency(roasQuery.data.summary.totalWonRevenue)}
                    </div>
                    <div className="text-xs text-green-600">{isRTL ? "إيرادات الصفقات المكسوبة" : "Won Revenue"}</div>
                  </CardContent>
                </Card>
                <Card className={`bg-gradient-to-br ${
                  (roasQuery.data.summary.overallRoas ?? 0) >= 1
                    ? "from-emerald-50 to-emerald-100 border-emerald-200"
                    : "from-red-50 to-red-100 border-red-200"
                }`}>
                  <CardContent className="pt-4 pb-4 text-center">
                    {(roasQuery.data.summary.overallRoas ?? 0) >= 1 ? (
                      <ArrowUpRight className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    )}
                    <div className={`text-2xl font-bold ${
                      (roasQuery.data.summary.overallRoas ?? 0) >= 1 ? "text-emerald-700" : "text-red-700"
                    }`}>
                      {roasQuery.data.summary.overallRoas
                        ? formatNumber(roasQuery.data.summary.overallRoas) + "x"
                        : "N/A"}
                    </div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "ROAS الإجمالي" : "Overall ROAS"}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="pt-4 pb-4 text-center">
                    <Target className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-purple-700">
                      {roasQuery.data.summary.avgCpl
                        ? formatCurrency(roasQuery.data.summary.avgCpl)
                        : "N/A"}
                    </div>
                    <div className="text-xs text-purple-600">{isRTL ? "متوسط تكلفة Lead" : "Avg. CPL"}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Extra stats row */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-3 pb-3 text-center">
                    <div className="text-lg font-bold">{roasQuery.data.summary.totalLeads}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "إجمالي Leads" : "Total Leads"}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3 text-center">
                    <div className="text-lg font-bold">{roasQuery.data.summary.totalDeals}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "إجمالي الصفقات" : "Total Deals"}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3 text-center">
                    <div className="text-lg font-bold text-green-600">{roasQuery.data.summary.totalWonDeals}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "صفقات مكسوبة" : "Won Deals"}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Campaign & Ad Breakdown */}
              {roasQuery.data.campaigns.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {isRTL ? "ROAS لكل حملة وإعلان" : "ROAS per Campaign & Ad"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {roasQuery.data.campaigns.map((campaign) => (
                        <Collapsible
                          key={campaign.campaignId}
                          open={expandedCampaigns.has(campaign.campaignId)}
                          onOpenChange={() => toggleCampaign(campaign.campaignId)}
                        >
                          {/* Campaign Row */}
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors">
                              {expandedCampaigns.has(campaign.campaignId) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{campaign.campaignName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {campaign.ads.length} {isRTL ? "إعلان" : "ads"}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-xs shrink-0">
                                <div className="text-center">
                                  <div className="font-semibold">{formatCurrency(campaign.spend)}</div>
                                  <div className="text-muted-foreground">{isRTL ? "إنفاق" : "Spend"}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-semibold">{campaign.leadsCount}</div>
                                  <div className="text-muted-foreground">Leads</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-semibold">{campaign.wonDealsCount}/{campaign.dealsCount}</div>
                                  <div className="text-muted-foreground">{isRTL ? "صفقات" : "Deals"}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-semibold text-green-600">
                                    {formatCurrency(campaign.wonRevenue)}
                                  </div>
                                  <div className="text-muted-foreground">{isRTL ? "إيرادات" : "Revenue"}</div>
                                </div>
                                <div className="text-center min-w-[60px]">
                                  <Badge
                                    variant={(campaign.roas ?? 0) >= 1 ? "default" : "destructive"}
                                    className="text-xs"
                                  >
                                    {campaign.roas ? formatNumber(campaign.roas) + "x" : "N/A"}
                                  </Badge>
                                  <div className="text-muted-foreground">ROAS</div>
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          {/* Ads Table */}
                          <CollapsibleContent>
                            {campaign.ads.length > 0 ? (
                              <div className="ms-8 mt-1 mb-2">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">{isRTL ? "الإعلان" : "Ad Name"}</TableHead>
                                      <TableHead className="text-xs text-center">{isRTL ? "إنفاق" : "Spend"}</TableHead>
                                      <TableHead className="text-xs text-center">Leads</TableHead>
                                      <TableHead className="text-xs text-center">CPL</TableHead>
                                      <TableHead className="text-xs text-center">{isRTL ? "صفقات" : "Deals"}</TableHead>
                                      <TableHead className="text-xs text-center">{isRTL ? "إيرادات" : "Revenue"}</TableHead>
                                      <TableHead className="text-xs text-center">ROAS</TableHead>
                                      <TableHead className="text-xs text-center">{isRTL ? "تكلفة/صفقة" : "Cost/Deal"}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {campaign.ads.map((ad) => (
                                      <TableRow key={ad.adId}>
                                        <TableCell className="text-xs font-medium max-w-[200px] truncate">
                                          {ad.adName}
                                        </TableCell>
                                        <TableCell className="text-xs text-center">
                                          {formatCurrency(ad.spend)}
                                        </TableCell>
                                        <TableCell className="text-xs text-center">{ad.leadsCount}</TableCell>
                                        <TableCell className="text-xs text-center">
                                          {ad.cpl ? formatCurrency(ad.cpl) : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-center">
                                          <span className="text-green-600">{ad.wonDealsCount}</span>
                                          /{ad.dealsCount}
                                        </TableCell>
                                        <TableCell className="text-xs text-center text-green-600">
                                          {formatCurrency(ad.wonRevenue)}
                                        </TableCell>
                                        <TableCell className="text-xs text-center">
                                          <Badge
                                            variant={(ad.roas ?? 0) >= 1 ? "default" : "destructive"}
                                            className="text-xs"
                                          >
                                            {ad.roas ? formatNumber(ad.roas) + "x" : "—"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-center">
                                          {ad.costPerDeal ? formatCurrency(ad.costPerDeal) : "—"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <div className="ms-8 py-2 text-xs text-muted-foreground">
                                {isRTL ? "لا توجد إعلانات لهذه الحملة" : "No ads found for this campaign"}
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {roasQuery.data.campaigns.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                    <p>{isRTL ? "لا توجد حملات نشطة بإنفاق" : "No active campaigns with spend found"}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!roasQuery.data && !roasQuery.isFetching && (
            <Card className="border-dashed">
              <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{isRTL ? 'اضغط "حساب ROAS" لبدء التحليل' : 'Click "Calculate ROAS" to start analysis'}</p>
              </CardContent>
            </Card>
          )}

          {roasQuery.isFetching && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-blue-500" />
                <p className="text-muted-foreground">
                  {isRTL
                    ? "جاري سحب البيانات من Meta وحساب ROAS..."
                    : "Fetching data from Meta and calculating ROAS..."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

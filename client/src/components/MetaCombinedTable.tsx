import { fmtMoney, BASE_CURRENCY } from "@/lib/fmtMoney";
import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignData {
  campaignId: number;
  campaignName: string;
  platform: string;
  status: string;
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  badLeads: number;
  unknownLeads: number;
  totalDeals: number;
  wonDeals: number;
  totalRevenue: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpl: number;
  roi: number;
  conversionRate: number;
}

interface MetaCombinedTableProps {
  campaigns: CampaignData[];
  isLoading?: boolean;
}

type SortKey = keyof CampaignData;

export default function MetaCombinedTable({
  campaigns,
  isLoading,
}: MetaCombinedTableProps) {
  const { isRTL } = useLanguage();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    let data = [...campaigns];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((c) => c.campaignName.toLowerCase().includes(q));
    }
    data.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return data;
  }, [campaigns, search, sortKey, sortDir]);

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "ACTIVE")
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
          {isRTL ? "نشط" : "Active"}
        </Badge>
      );
    if (s === "PAUSED")
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
          {isRTL ? "متوقف" : "Paused"}
        </Badge>
      );
    return (
      <Badge variant="secondary" className="text-xs">
        {status}
      </Badge>
    );
  };

  const formatNum = (n: number) => n.toLocaleString();
  const formatCurrency = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const SortHeader = ({
    label,
    field,
  }: {
    label: string;
    field: SortKey;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowUpDown size={12} className="ml-1 opacity-50" />
    </Button>
  );

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {isRTL ? "تفاصيل الحملات" : "Campaign Details"}
          </CardTitle>
          <div className="relative w-56">
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? "بحث..." : "Search..."}
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs w-[200px]">
                  <SortHeader
                    label={isRTL ? "الحملة" : "Campaign"}
                    field="campaignName"
                  />
                </TableHead>
                <TableHead className="text-xs text-center">
                  {isRTL ? "الحالة" : "Status"}
                </TableHead>
                <TableHead className="text-xs text-center">
                  <SortHeader
                    label={isRTL ? "الإنفاق" : "Spend"}
                    field="spend"
                  />
                </TableHead>
                <TableHead className="text-xs text-center">
                  <SortHeader
                    label={isRTL ? "العملاء" : "Leads"}
                    field="totalLeads"
                  />
                </TableHead>
                <TableHead className="text-xs text-center">
                  <SortHeader label="CPL" field="cpl" />
                </TableHead>
                <TableHead className="text-xs text-center">
                  <SortHeader
                    label={isRTL ? "الصفقات" : "Won"}
                    field="wonDeals"
                  />
                </TableHead>
                <TableHead className="text-xs text-center">
                  <SortHeader
                    label={isRTL ? "الإيرادات" : "Revenue"}
                    field="totalRevenue"
                  />
                </TableHead>
                <TableHead className="text-xs text-center">
                  <SortHeader label="ROI" field="roi" />
                </TableHead>
                <TableHead className="text-xs text-center">
                  <SortHeader label="CTR" field="ctr" />
                </TableHead>
                <TableHead className="text-xs text-center">
                  <SortHeader
                    label={isRTL ? "التحويل" : "Conv."}
                    field="conversionRate"
                  />
                </TableHead>
                <TableHead className="text-xs text-center">
                  {isRTL ? "الجودة" : "Quality"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {isLoading
                      ? isRTL
                        ? "جاري التحميل..."
                        : "Loading..."
                      : isRTL
                      ? "لا توجد بيانات"
                      : "No data found"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow
                    key={c.campaignId}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="text-xs font-medium max-w-[200px] truncate">
                      {c.campaignName}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(c.status)}
                    </TableCell>
                    <TableCell className="text-xs text-center font-mono">
                      {fmtMoney(c.spend, BASE_CURRENCY)}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {formatNum(c.totalLeads)}
                    </TableCell>
                    <TableCell className="text-xs text-center font-mono">
                      {c.cpl > 0 ? c.cpl.toFixed(1) : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      <span className="text-green-600 font-medium">
                        {c.wonDeals}
                      </span>
                      <span className="text-muted-foreground">
                        /{c.totalDeals}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-center font-mono">
                      {fmtMoney(c.totalRevenue, BASE_CURRENCY)}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      <span
                        className={
                          c.roi > 0
                            ? "text-green-600 font-medium"
                            : c.roi < 0
                            ? "text-red-600 font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {c.roi !== 0 ? `${c.roi.toFixed(1)}%` : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-center font-mono">
                      {c.ctr > 0 ? `${c.ctr.toFixed(2)}%` : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {c.conversionRate > 0
                        ? `${c.conversionRate.toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-0.5 justify-center">
                        {c.hotLeads > 0 && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-red-500"
                            title={`Hot: ${c.hotLeads}`}
                          />
                        )}
                        {c.warmLeads > 0 && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-orange-500"
                            title={`Warm: ${c.warmLeads}`}
                          />
                        )}
                        {c.coldLeads > 0 && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-blue-500"
                            title={`Cold: ${c.coldLeads}`}
                          />
                        )}
                        {c.badLeads > 0 && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-gray-500"
                            title={`Bad: ${c.badLeads}`}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

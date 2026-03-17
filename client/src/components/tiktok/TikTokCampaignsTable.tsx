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

interface TikTokCampaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  dailyBudget: number | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

interface TikTokCampaignsTableProps {
  data: TikTokCampaign[];
  isLoading?: boolean;
}

type SortKey = keyof TikTokCampaign;
type SortDir = "asc" | "desc";

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

function statusVariant(status: string): "default" | "outline" | "secondary" | "destructive" {
  switch (status) {
    case "ACTIVE": return "default";
    case "PAUSED": return "secondary";
    case "DISABLED":
    case "DELETED": return "destructive";
    default: return "outline";
  }
}

export default function TikTokCampaignsTable({ data, isLoading }: TikTokCampaignsTableProps) {
  const { isRTL } = useLanguage();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = data;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.objective?.toLowerCase().includes(q) ?? false)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [data, search, sortKey, sortDir]);

  const SortableHead = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-accent/50 transition-colors text-xs"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={sortKey === field ? "text-primary" : "text-muted-foreground/50"} />
      </div>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {isRTL ? "تحليلات الحملات" : "Campaign Analytics"}
            <span className="text-muted-foreground font-normal ml-2">
              ({filteredAndSorted.length})
            </span>
          </CardTitle>
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={isRTL ? "بحث عن حملة..." : "Search campaigns..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label={isRTL ? "الحملة" : "Campaign"} field="name" />
                <SortableHead label={isRTL ? "الحالة" : "Status"} field="status" />
                <SortableHead label={isRTL ? "الهدف" : "Objective"} field="objective" />
                <SortableHead label={isRTL ? "الميزانية" : "Budget"} field="dailyBudget" />
                <SortableHead label={isRTL ? "المشاهدات" : "Impressions"} field="impressions" />
                <SortableHead label={isRTL ? "النقرات" : "Clicks"} field="clicks" />
                <SortableHead label="CTR" field="ctr" />
                <SortableHead label={isRTL ? "الإنفاق" : "Spend"} field="spend" />
                <SortableHead label="CPC" field="cpc" />
                <SortableHead label="CPA" field="cpa" />
                <SortableHead label={isRTL ? "التحويلات" : "Conversions"} field="conversions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground text-sm" colSpan={11}>
                    {isRTL ? "لا توجد حملات تطابق الفلاتر الحالية" : "No campaigns match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSorted.map((campaign) => (
                  <TableRow key={campaign.id} className={isLoading ? "animate-pulse" : ""}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">
                      {campaign.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(campaign.status)} className="text-xs">
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {campaign.objective ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {campaign.dailyBudget ? formatCurrency(campaign.dailyBudget) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">{formatNumber(campaign.impressions)}</TableCell>
                    <TableCell className="text-sm">{formatNumber(campaign.clicks)}</TableCell>
                    <TableCell className="text-sm">{formatPercent(campaign.ctr)}</TableCell>
                    <TableCell className="text-sm font-medium">{formatCurrency(campaign.spend)}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(campaign.cpc)}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(campaign.cpa)}</TableCell>
                    <TableCell className="text-sm">{formatNumber(campaign.conversions)}</TableCell>
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

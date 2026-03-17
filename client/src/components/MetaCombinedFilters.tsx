import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Filter, RotateCcw, Search } from "lucide-react";

interface MetaCombinedFiltersProps {
  onApply: (filters: {
    dateFrom?: string;
    dateTo?: string;
    minSpend?: number;
    datePreset?: string;
  }) => void;
  isLoading?: boolean;
}

const DATE_PRESETS = [
  { key: "last_7d", labelAr: "آخر 7 أيام", labelEn: "Last 7 Days" },
  { key: "last_14d", labelAr: "آخر 14 يوم", labelEn: "Last 14 Days" },
  { key: "last_30d", labelAr: "آخر 30 يوم", labelEn: "Last 30 Days" },
  { key: "this_month", labelAr: "هذا الشهر", labelEn: "This Month" },
  { key: "last_month", labelAr: "الشهر الماضي", labelEn: "Last Month" },
];

export default function MetaCombinedFilters({
  onApply,
  isLoading,
}: MetaCombinedFiltersProps) {
  const { isRTL } = useLanguage();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [activePreset, setActivePreset] = useState("last_30d");

  const handlePreset = (preset: string) => {
    setActivePreset(preset);
    setDateFrom("");
    setDateTo("");
    onApply({ datePreset: preset, minSpend: minSpend ? Number(minSpend) : undefined });
  };

  const handleApply = () => {
    onApply({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minSpend: minSpend ? Number(minSpend) : undefined,
      datePreset: !dateFrom && !dateTo ? activePreset : undefined,
    });
  };

  const handleReset = () => {
    setDateFrom("");
    setDateTo("");
    setMinSpend("");
    setActivePreset("last_30d");
    onApply({ datePreset: "last_30d" });
  };

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {isRTL ? "فترة سريعة:" : "Quick Range:"}
            </span>
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={activePreset === p.key ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handlePreset(p.key)}
              >
                {isRTL ? p.labelAr : p.labelEn}
              </Button>
            ))}
          </div>

          {/* Custom Filters */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                {isRTL ? "من تاريخ" : "From Date"}
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setActivePreset("");
                }}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                {isRTL ? "إلى تاريخ" : "To Date"}
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setActivePreset("");
                }}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                {isRTL ? "أقل إنفاق" : "Min Spend"}
              </Label>
              <Input
                type="number"
                value={minSpend}
                onChange={(e) => setMinSpend(e.target.value)}
                placeholder="0"
                className="h-8 w-28 text-xs"
              />
            </div>
            <Button
              size="sm"
              className="h-8"
              onClick={handleApply}
              disabled={isLoading}
            >
              <Search size={14} className="mr-1" />
              {isRTL ? "بحث" : "Apply"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={handleReset}
              disabled={isLoading}
            >
              <RotateCcw size={14} className="mr-1" />
              {isRTL ? "إعادة" : "Reset"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

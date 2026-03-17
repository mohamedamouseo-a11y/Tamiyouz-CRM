import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_OPTIONS = ["ACTIVE", "PAUSED", "DISABLED", "BUDGET_EXCEEDED"];
const OBJECTIVE_OPTIONS = ["TRAFFIC", "CONVERSIONS", "LEAD_GENERATION", "VIDEO_VIEWS", "REACH", "APP_INSTALL"];

interface TikTokCampaignFiltersValue {
  dateFrom: string;
  dateTo: string;
  minSpend?: number;
  maxSpend?: number;
  status: string[];
  objectives: string[];
}

interface TikTokCampaignFiltersProps {
  value: TikTokCampaignFiltersValue;
  onChange: (nextValue: TikTokCampaignFiltersValue) => void;
}

function toggleListValue(list: string[], target: string, checked: boolean): string[] {
  const values = new Set(list);
  if (checked) {
    values.add(target);
  } else {
    values.delete(target);
  }
  return Array.from(values);
}

export default function TikTokCampaignFilters({ value, onChange }: TikTokCampaignFiltersProps) {
  const { isRTL } = useLanguage();
  const update = (partial: Partial<TikTokCampaignFiltersValue>) => onChange({ ...value, ...partial });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          {isRTL ? "الفلاتر" : "Filters"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date & Spend Row */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="tt-dateFrom" className="text-xs">
              {isRTL ? "من تاريخ" : "Date from"}
            </Label>
            <Input
              id="tt-dateFrom"
              type="date"
              value={value.dateFrom}
              onChange={(e) => update({ dateFrom: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tt-dateTo" className="text-xs">
              {isRTL ? "إلى تاريخ" : "Date to"}
            </Label>
            <Input
              id="tt-dateTo"
              type="date"
              value={value.dateTo}
              onChange={(e) => update({ dateTo: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tt-minSpend" className="text-xs">
              {isRTL ? "أقل إنفاق" : "Min spend"}
            </Label>
            <Input
              id="tt-minSpend"
              type="number"
              min={0}
              value={value.minSpend ?? ""}
              onChange={(e) => update({ minSpend: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8 text-sm"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tt-maxSpend" className="text-xs">
              {isRTL ? "أكثر إنفاق" : "Max spend"}
            </Label>
            <Input
              id="tt-maxSpend"
              type="number"
              min={0}
              value={value.maxSpend ?? ""}
              onChange={(e) => update({ maxSpend: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        {/* Status & Objectives Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs">{isRTL ? "الحالة" : "Status"}</Label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {STATUS_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    checked={value.status.includes(option)}
                    onCheckedChange={(checked) =>
                      update({ status: toggleListValue(value.status, option, !!checked) })
                    }
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{isRTL ? "الأهداف" : "Objectives"}</Label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {OBJECTIVE_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    checked={value.objectives.includes(option)}
                    onCheckedChange={(checked) =>
                      update({ objectives: toggleListValue(value.objectives, option, !!checked) })
                    }
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

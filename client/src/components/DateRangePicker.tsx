import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";

export type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  className?: string;
  date?: DateRange | undefined;
  setDate?: (date: DateRange | undefined) => void;
  value?: DateRange | undefined;
  onChange?: (date: DateRange | undefined) => void;
  isRTL?: boolean;
}

export function DateRangePicker({
  className,
  date: dateProp,
  setDate: setDateProp,
  value,
  onChange,
}: DateRangePickerProps) {
  const date = value ?? dateProp;
  const setDate = onChange ?? setDateProp ?? (() => {});
  const { t, isRTL } = useLanguage();

  const presets = [
    { label: isRTL ? "اليوم" : "Today", getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
    { label: isRTL ? "أمس" : "Yesterday", getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
    { label: isRTL ? "آخر 7 أيام" : "Last 7 Days", getValue: () => ({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) }) },
    { label: isRTL ? "آخر 30 يوم" : "Last 30 Days", getValue: () => ({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) }) },
    { label: isRTL ? "هذا الشهر" : "This Month", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  ];

  return (
    <div className={cn("grid gap-2", className)} dir={isRTL ? "rtl" : "ltr"}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal h-10 px-3",
              !date && "text-muted-foreground",
              isRTL && "text-right"
            )}
          >
            <CalendarIcon className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} - {" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>{isRTL ? "اختر الفترة" : "Pick a date range"}</span>
            )}
            <ChevronDown className={cn("h-4 w-4 opacity-50", isRTL ? "mr-auto" : "ml-auto")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="start">
          <div className="flex flex-col gap-1 p-2 border-b sm:border-b-0 sm:border-r border-border min-w-[120px]">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className={cn("justify-start font-normal", isRTL && "text-right")}
                onClick={() => setDate(preset.getValue())}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={1}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DateRangePicker;

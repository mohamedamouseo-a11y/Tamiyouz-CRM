import * as React from "react";
import { useState, useMemo } from "react";
import { countries, type Country } from "@/lib/countries-data";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface CountrySelectProps {
  value?: string;
  onChange?: (countryName: string) => void;
  isRTL?: boolean;
  className?: string;
  placeholder?: string;
}

export function CountrySelect({
  value,
  onChange,
  isRTL = false,
  className,
  placeholder,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => countries.find((c) => c.name === value || c.nameAr === value),
    [value]
  );

  const filteredCountries = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameAr.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSelect = (country: Country) => {
    onChange?.(country.name);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-10",
            !selected && "text-muted-foreground",
            className
          )}
          type="button"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span>{selected.flag}</span>
              <span>{isRTL ? selected.nameAr : selected.name}</span>
            </span>
          ) : (
            <span>{placeholder || (isRTL ? "اختر الدولة" : "Select country")}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <input
            type="text"
            placeholder={isRTL ? "ابحث عن دولة..." : "Search country..."}
            className="flex-1 bg-transparent outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-60 overflow-y-auto">
          {filteredCountries.map((c) => (
            <button
              key={c.code}
              type="button"
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors",
                isRTL ? "text-right" : "text-left",
                selected?.code === c.code && "bg-accent"
              )}
              onClick={() => handleSelect(c)}
            >
              <span className="text-base">{c.flag}</span>
              <span className="flex-1 truncate">{isRTL ? c.nameAr : c.name}</span>
              {selected?.code === c.code && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>
          ))}
          {filteredCountries.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              {isRTL ? "لا توجد نتائج" : "No results found"}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default CountrySelect;

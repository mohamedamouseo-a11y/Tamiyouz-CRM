import * as React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import { countries, type Country } from "@/lib/countries-data";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PhoneInputProps {
  value?: string;
  onChange?: (fullPhone: string, isValid: boolean) => void;
  defaultCountryCode?: string;
  isRTL?: boolean;
  error?: boolean;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountryCode = "SA",
  isRTL = false,
  error = false,
  className,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    countries.find((c) => c.code === defaultCountryCode) ?? countries[0]
  );
  const [phoneDigits, setPhoneDigits] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Parse initial value if provided
  useEffect(() => {
    if (value && value.startsWith("+")) {
      // Try to match country code from the value
      const sorted = [...countries].sort((a, b) => b.phoneCode.length - a.phoneCode.length);
      for (const c of sorted) {
        if (value.startsWith(c.phoneCode)) {
          setSelectedCountry(c);
          setPhoneDigits(value.slice(c.phoneCode.length));
          return;
        }
      }
    }
  }, []);

  const filteredCountries = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameAr.includes(q) ||
        c.phoneCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const isValid = useMemo(() => {
    const digits = phoneDigits.replace(/\D/g, "");
    return digits.length >= selectedCountry.minDigits && digits.length <= selectedCountry.maxDigits;
  }, [phoneDigits, selectedCountry]);

  const digitCount = phoneDigits.replace(/\D/g, "").length;

  const handleDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    // Don't allow more than maxDigits
    const trimmed = raw.slice(0, selectedCountry.maxDigits);
    setPhoneDigits(trimmed);
    setTouched(true);
    const fullPhone = selectedCountry.phoneCode + trimmed;
    const valid = trimmed.length >= selectedCountry.minDigits && trimmed.length <= selectedCountry.maxDigits;
    onChange?.(fullPhone, valid);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setOpen(false);
    setSearch("");
    // Re-validate with new country
    const digits = phoneDigits.replace(/\D/g, "");
    const trimmed = digits.slice(0, country.maxDigits);
    setPhoneDigits(trimmed);
    const fullPhone = country.phoneCode + trimmed;
    const valid = trimmed.length >= country.minDigits && trimmed.length <= country.maxDigits;
    onChange?.(fullPhone, valid);
    inputRef.current?.focus();
  };

  const showError = touched && !isValid && phoneDigits.length > 0;

  return (
    <div className={cn("flex flex-col gap-1", className)} dir="ltr">
      <div className={cn(
        "flex items-center border rounded-md overflow-hidden transition-colors",
        error || showError ? "border-red-500 ring-1 ring-red-500" : "border-input",
        "focus-within:ring-1 focus-within:ring-ring"
      )}>
        {/* Country code selector */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-2 bg-muted/50 hover:bg-muted border-r border-input text-sm whitespace-nowrap shrink-0 h-10"
            >
              <span className="text-base">{selectedCountry.flag}</span>
              <span className="text-muted-foreground font-mono text-xs">{selectedCountry.phoneCode}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="flex items-center border-b px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
              <input
                ref={searchRef}
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
                    "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
                    selectedCountry.code === c.code && "bg-accent"
                  )}
                  onClick={() => handleCountrySelect(c)}
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="flex-1 truncate">{isRTL ? c.nameAr : c.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">{c.phoneCode}</span>
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

        {/* Phone number input */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          className="flex-1 px-3 py-2 h-10 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground placeholder:font-sans"
          placeholder={"0".repeat(selectedCountry.minDigits)}
          value={phoneDigits}
          onChange={handleDigitsChange}
          onBlur={() => setTouched(true)}
          dir="ltr"
        />
      </div>

      {/* Validation hint */}
      {touched && phoneDigits.length > 0 && (
        <p className={cn(
          "text-xs",
          isValid ? "text-green-600" : "text-red-500"
        )}>
          {isValid
            ? (isRTL ? "✓ رقم صحيح" : "✓ Valid number")
            : (isRTL
              ? `يجب أن يكون ${selectedCountry.minDigits === selectedCountry.maxDigits ? selectedCountry.minDigits : `${selectedCountry.minDigits}-${selectedCountry.maxDigits}`} رقم (حالياً ${digitCount})`
              : `Must be ${selectedCountry.minDigits === selectedCountry.maxDigits ? selectedCountry.minDigits : `${selectedCountry.minDigits}-${selectedCountry.maxDigits}`} digits (currently ${digitCount})`
            )
          }
        </p>
      )}
    </div>
  );
}

export default PhoneInput;

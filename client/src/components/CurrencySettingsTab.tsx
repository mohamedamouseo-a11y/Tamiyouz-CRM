import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Save, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ExchangeRate {
  id: number;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  updatedAt: string;
}

export default function CurrencySettingsTab() {
  const { toast } = useToast();
  const [rates, setRates] = useState<Record<string, string>>({});

  const { data: exchangeRates, isLoading } = trpc.exchangeRates.list.useQuery();

  useEffect(() => {
    if (exchangeRates && Array.isArray(exchangeRates)) {
      const rateMap: Record<string, string> = {};
      (exchangeRates as ExchangeRate[]).forEach((r: ExchangeRate) => {
        rateMap[`${r.fromCurrency}_${r.toCurrency}`] = r.rate;
      });
      setRates(rateMap);
    }
  }, [exchangeRates]);

  const utils = trpc.useUtils();

  const updateMutation = trpc.exchangeRates.upsert.useMutation({
    onSuccess: () => {
      utils.exchangeRates.list.invalidate();
      toast({ title: "Exchange rate updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update exchange rate", variant: "destructive" });
    },
  });

  const recalculateMutation = trpc.exchangeRates.recalculate.useMutation({
    onSuccess: () => {
      toast({ title: isRTL ? "تم إعادة الحساب بنجاح" : "Recalculation complete" });
    },
    onError: () => {
      toast({ title: isRTL ? "فشل إعادة الحساب" : "Recalculation failed", variant: "destructive" });
    },
  });

  const handleSave = (from: string, to: string) => {
    const key = `${from}_${to}`;
    const rate = parseFloat(rates[key] || "0");
    if (isNaN(rate) || rate <= 0) {
      toast({ title: "Rate must be greater than 0", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ fromCurrency: from, toCurrency: to, rate: rate.toString() });
  };

  const currencyPairs = [
    { from: "EGP", to: "SAR", label: "جنيه مصري → ريال سعودي", labelEn: "Egyptian Pound → Saudi Riyal" },
    { from: "USD", to: "SAR", label: "دولار أمريكي → ريال سعودي", labelEn: "US Dollar → Saudi Riyal" },
    { from: "SAR", to: "SAR", label: "ريال سعودي (العملة الأساسية)", labelEn: "Saudi Riyal (Base Currency)" },
  ];

  const isRTL = document.documentElement.dir === "rtl";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign size={20} />
            {isRTL ? "أسعار الصرف" : "Exchange Rates"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? "حدد أسعار الصرف لتحويل العملات المختلفة إلى الريال السعودي (العملة الأساسية). يتم استخدام هذه الأسعار لحساب الإيرادات الإجمالية في لوحات التحكم."
              : "Set exchange rates to convert different currencies to Saudi Riyal (base currency). These rates are used to calculate total revenue in dashboards."}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {currencyPairs.map((pair) => {
                const key = `${pair.from}_${pair.to}`;
                const isBase = pair.from === pair.to;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1">
                      <Label className="text-sm font-medium">
                        {isRTL ? pair.label : pair.labelEn}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        1 {pair.from} = ? {pair.to}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.0001"
                        className="w-32 text-center"
                        value={isBase ? "1.0000" : (rates[key] || "")}
                        disabled={isBase}
                        onChange={(e) =>
                          setRates((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        dir="ltr"
                      />
                      <span className="text-sm text-muted-foreground w-10">{pair.to}</span>
                      {!isBase && (
                        <Button
                          size="sm"
                          onClick={() => handleSave(pair.from, pair.to)}
                          disabled={updateMutation.isPending}
                        >
                          <Save size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw size={20} />
            {isRTL ? "إعادة حساب القيم" : "Recalculate Values"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {isRTL
              ? "بعد تغيير أسعار الصرف، اضغط هنا لإعادة حساب قيم كل الصفقات بالعملة الأساسية (الريال السعودي)."
              : "After changing exchange rates, click here to recalculate all deal values in the base currency (SAR)."}
          </p>
          <Button
            variant="outline"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
          >
            <RefreshCw size={14} className={`mr-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
            {isRTL ? "إعادة حساب كل القيم" : "Recalculate All Values"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

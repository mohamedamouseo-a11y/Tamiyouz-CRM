import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Save, RefreshCw, CloudDownload, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ExchangeRate {
  id: number;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  updatedAt: string;
}

export default function CurrencySettingsTab() {
  const [rates, setRates] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});

  const { data: exchangeRates, isLoading } = trpc.exchangeRates.list.useQuery();

  useEffect(() => {
    if (exchangeRates && Array.isArray(exchangeRates)) {
      const rateMap: Record<string, string> = {};
      const updatedMap: Record<string, string> = {};
      (exchangeRates as ExchangeRate[]).forEach((r: ExchangeRate) => {
        rateMap[`${r.fromCurrency}_${r.toCurrency}`] = r.rate;
        updatedMap[`${r.fromCurrency}_${r.toCurrency}`] = r.updatedAt;
      });
      setRates(rateMap);
      setLastUpdated(updatedMap);
    }
  }, [exchangeRates]);

  const utils = trpc.useUtils();

  const updateMutation = trpc.exchangeRates.upsert.useMutation({
    onSuccess: () => {
      utils.exchangeRates.list.invalidate();
      toast.success("Exchange rate updated successfully");
    },
    onError: () => {
      toast.error("Failed to update exchange rate");
    },
  });

  const isRTL = document.documentElement.dir === "rtl";

  const recalculateMutation = trpc.exchangeRates.recalculate.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم إعادة الحساب بنجاح" : "Recalculation complete");
    },
    onError: () => {
      toast.error(isRTL ? "فشل إعادة الحساب" : "Recalculation failed");
    },
  });

  const autoSyncMutation = trpc.exchangeRates.autoSync.useMutation({
    onSuccess: (data) => {
      utils.exchangeRates.list.invalidate();
      if (data.updated && data.updated.length > 0) {
        toast.success(
          isRTL
            ? `تم تحديث ${data.updated.length} سعر صرف من الإنترنت`
            : `Updated ${data.updated.length} exchange rate(s) from live API`
        );
      }
      if (data.failed && data.failed.length > 0) {
        toast.error(
          isRTL
            ? `فشل تحديث: ${data.failed.join(", ")}`
            : `Failed to update: ${data.failed.join(", ")}`
        );
      }
    },
    onError: () => {
      toast.error(isRTL ? "فشل التحديث التلقائي" : "Auto-sync failed");
    },
  });

  const handleSave = (from: string, to: string) => {
    const key = `${from}_${to}`;
    const rate = parseFloat(rates[key] || "0");
    if (isNaN(rate) || rate <= 0) {
      toast.error("Rate must be greater than 0");
      return;
    }
    updateMutation.mutate({ fromCurrency: from, toCurrency: to, rate: rate.toString() });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const currencyPairs = [
    { from: "EGP", to: "SAR", label: "جنيه مصري → ريال سعودي", labelEn: "Egyptian Pound → Saudi Riyal", flag: "🇪🇬" },
    { from: "USD", to: "SAR", label: "دولار أمريكي → ريال سعودي", labelEn: "US Dollar → Saudi Riyal", flag: "🇺🇸" },
    { from: "SAR", to: "SAR", label: "ريال سعودي (العملة الأساسية)", labelEn: "Saudi Riyal (Base Currency)", flag: "🇸🇦" },
  ];

  return (
    <div className="space-y-6">
      {/* Auto-Sync Card */}
      <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <CloudDownload size={20} />
              {isRTL ? "تحديث تلقائي من الإنترنت" : "Live Rate Sync"}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {isRTL ? "مجاني" : "Free API"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? "يتم تحديث أسعار الصرف تلقائياً كل 12 ساعة. يمكنك أيضاً التحديث يدوياً بالضغط على الزر أدناه."
              : "Exchange rates are automatically synced every 12 hours. You can also manually trigger a sync below."}
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => autoSyncMutation.mutate()}
            disabled={autoSyncMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <CloudDownload size={14} className={`mr-2 ${autoSyncMutation.isPending ? "animate-bounce" : ""}`} />
            {autoSyncMutation.isPending
              ? (isRTL ? "جاري التحديث..." : "Syncing...")
              : (isRTL ? "تحديث الأسعار الآن" : "Sync Rates Now")}
          </Button>
        </CardContent>
      </Card>

      {/* Exchange Rates Card */}
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
                const updated = lastUpdated[key];
                return (
                  <div
                    key={key}
                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="text-2xl">{pair.flag}</div>
                    <div className="flex-1">
                      <Label className="text-sm font-medium">
                        {isRTL ? pair.label : pair.labelEn}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        1 {pair.from} = ? {pair.to}
                      </p>
                      {updated && !isBase && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock size={10} />
                          {isRTL ? "آخر تحديث: " : "Last updated: "}{formatDate(updated)}
                        </p>
                      )}
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

      {/* Recalculate Card */}
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
            <RefreshCw size={14} className={`mr-2 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
            {isRTL ? "إعادة حساب كل القيم" : "Recalculate All Values"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

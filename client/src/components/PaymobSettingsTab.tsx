import * as React from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

type CountryForm = {
  api_key: string;
  hmac_secret: string;
  base_url: string;
  integration_id_card: string;
  integration_id_wallet: string;
  iframe_id: string;
  enabled: boolean;
};

type FormState = {
  eg: CountryForm;
  sa: CountryForm;
};

const defaultCountry: CountryForm = {
  api_key: "",
  hmac_secret: "",
  base_url: "",
  integration_id_card: "",
  integration_id_wallet: "",
  iframe_id: "",
  enabled: false,
};

const defaultForm: FormState = {
  eg: { ...defaultCountry, base_url: "https://accept.paymob.com" },
  sa: { ...defaultCountry, base_url: "https://ksa.paymob.com" },
};

type Country = "eg" | "sa";

export default function PaymobSettingsTab() {
  const utils = trpc.useUtils?.();
  const settingsQuery = trpc.paymob.getSettings.useQuery();
  const updateMutation = trpc.paymob.updateSettings.useMutation({
    onSuccess: async () => {
      if (utils?.paymob?.getSettings) await utils.paymob.getSettings.invalidate();
      if (utils?.paymob?.isEnabled) await utils.paymob.isEnabled.invalidate();
    },
  });

  const [form, setForm] = React.useState<FormState>(defaultForm);
  const [activeCountry, setActiveCountry] = React.useState<Country>("eg");

  React.useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        eg: {
          api_key: settingsQuery.data.eg?.api_key || "",
          hmac_secret: settingsQuery.data.eg?.hmac_secret || "",
          base_url: settingsQuery.data.eg?.base_url || "https://accept.paymob.com",
          integration_id_card: settingsQuery.data.eg?.integration_id_card || "",
          integration_id_wallet: settingsQuery.data.eg?.integration_id_wallet || "",
          iframe_id: settingsQuery.data.eg?.iframe_id || "",
          enabled: !!settingsQuery.data.eg?.enabled,
        },
        sa: {
          api_key: settingsQuery.data.sa?.api_key || "",
          hmac_secret: settingsQuery.data.sa?.hmac_secret || "",
          base_url: settingsQuery.data.sa?.base_url || "https://ksa.paymob.com",
          integration_id_card: settingsQuery.data.sa?.integration_id_card || "",
          integration_id_wallet: settingsQuery.data.sa?.integration_id_wallet || "",
          iframe_id: settingsQuery.data.sa?.iframe_id || "",
          enabled: !!settingsQuery.data.sa?.enabled,
        },
      });
    }
  }, [settingsQuery.data]);

  const setCountryField = <K extends keyof CountryForm>(key: K, value: CountryForm[K]) => {
    setForm((prev) => ({
      ...prev,
      [activeCountry]: { ...prev[activeCountry], [key]: value },
    }));
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync(form);
  };

  const current = form[activeCountry];
  const isEgypt = activeCountry === "eg";

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Paymob Settings</CardTitle>
        <CardDescription>
          Configure Paymob payment gateways for Egypt and Saudi Arabia independently.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Country Selector */}
        <div className="flex gap-2 p-1 rounded-xl bg-muted/50 border border-border/60">
          <button
            type="button"
            onClick={() => setActiveCountry("eg")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeCountry === "eg"
                ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <span className="text-lg">🇪🇬</span>
            Egypt (EGP)
            {form.eg.enabled && (
              <span className="ml-1 h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveCountry("sa")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeCountry === "sa"
                ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <span className="text-lg">🇸🇦</span>
            Saudi Arabia (SAR)
            {form.sa.enabled && (
              <span className="ml-1 h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>
        </div>

        {settingsQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Paymob settings...
          </div>
        ) : null}

        {settingsQuery.error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {settingsQuery.error.message}
          </div>
        ) : null}

        {/* Country Settings Form */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              value={current.api_key}
              onChange={(e) => setCountryField("api_key", e.target.value)}
              placeholder={`Enter ${isEgypt ? "Egypt" : "Saudi"} Paymob API key`}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="hmac_secret">HMAC Secret</Label>
            <Input
              id="hmac_secret"
              type="password"
              value={current.hmac_secret}
              onChange={(e) => setCountryField("hmac_secret", e.target.value)}
              placeholder={`Enter ${isEgypt ? "Egypt" : "Saudi"} webhook HMAC secret`}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="base_url">Base URL</Label>
            <Input
              id="base_url"
              value={current.base_url}
              onChange={(e) => setCountryField("base_url", e.target.value)}
              placeholder={isEgypt ? "https://accept.paymob.com" : "https://ksa.paymob.com"}
            />
            <p className="text-xs text-muted-foreground">
              {isEgypt
                ? "Default: https://accept.paymob.com"
                : "Default: https://ksa.paymob.com"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="integration_id_card">Integration ID — Card</Label>
            <Input
              id="integration_id_card"
              value={current.integration_id_card}
              onChange={(e) => setCountryField("integration_id_card", e.target.value)}
              placeholder="e.g. 1234567"
            />
          </div>

          {isEgypt && (
            <div className="space-y-2">
              <Label htmlFor="integration_id_wallet">Integration ID — Wallet</Label>
              <Input
                id="integration_id_wallet"
                value={current.integration_id_wallet}
                onChange={(e) => setCountryField("integration_id_wallet", e.target.value)}
                placeholder="e.g. 998877"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="iframe_id">iframe ID</Label>
            <Input
              id="iframe_id"
              value={current.iframe_id}
              onChange={(e) => setCountryField("iframe_id", e.target.value)}
              placeholder="e.g. 123456"
            />
          </div>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between rounded-2xl border p-4">
          <div className="space-y-1 pr-4">
            <p className="text-sm font-medium">
              Enable Paymob — {isEgypt ? "Egypt" : "Saudi Arabia"}
            </p>
            <p className="text-xs text-muted-foreground">
              Turn this on to allow {isEgypt ? "EGP" : "SAR"} payments via Paymob for this gateway.
            </p>
          </div>
          <Switch
            checked={current.enabled}
            onCheckedChange={(checked) => setCountryField("enabled", checked)}
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {updateMutation.isSuccess ? "Settings saved successfully." : ""}
            {updateMutation.isError ? (
              <span className="text-destructive">
                Error: {updateMutation.error?.message || "Failed to save"}
              </span>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={settingsQuery.isLoading || updateMutation.isPending}
            className="gap-2 text-white"
            style={{ background: "linear-gradient(135deg, #3b82f6 0%, #10b981 100%)" }}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save All Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

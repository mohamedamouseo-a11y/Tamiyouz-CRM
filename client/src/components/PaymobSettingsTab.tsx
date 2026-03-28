import * as React from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

type FormState = {
  paymob_api_key: string;
  paymob_hmac_secret: string;
  paymob_integration_id_card_eg: string;
  paymob_integration_id_card_sa: string;
  paymob_integration_id_wallet_eg: string;
  paymob_iframe_id: string;
  paymob_enabled: boolean;
};

const defaultForm: FormState = {
  paymob_api_key: "",
  paymob_hmac_secret: "",
  paymob_integration_id_card_eg: "",
  paymob_integration_id_card_sa: "",
  paymob_integration_id_wallet_eg: "",
  paymob_iframe_id: "",
  paymob_enabled: false,
};

export default function PaymobSettingsTab() {
  const utils = trpc.useUtils?.();
  const settingsQuery = trpc.paymob.getSettings.useQuery();
  const updateMutation = trpc.paymob.updateSettings.useMutation({
    onSuccess: async () => {
      if (utils?.paymob?.getSettings) {
        await utils.paymob.getSettings.invalidate();
      }
      if (utils?.paymob?.isEnabled) {
        await utils.paymob.isEnabled.invalidate();
      }
    },
  });

  const [form, setForm] = React.useState<FormState>(defaultForm);

  React.useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        paymob_api_key: settingsQuery.data.paymob_api_key || "",
        paymob_hmac_secret: settingsQuery.data.paymob_hmac_secret || "",
        paymob_integration_id_card_eg: settingsQuery.data.paymob_integration_id_card_eg || "",
        paymob_integration_id_card_sa: settingsQuery.data.paymob_integration_id_card_sa || "",
        paymob_integration_id_wallet_eg: settingsQuery.data.paymob_integration_id_wallet_eg || "",
        paymob_iframe_id: settingsQuery.data.paymob_iframe_id || "",
        paymob_enabled: !!settingsQuery.data.paymob_enabled,
      });
    }
  }, [settingsQuery.data]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync(form);
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Paymob Settings</CardTitle>
        <CardDescription>
          Configure Paymob for Egypt and Saudi Arabia, including card payments and Egypt mobile wallets.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="paymob_api_key">API Key</Label>
            <Input
              id="paymob_api_key"
              type="password"
              value={form.paymob_api_key}
              onChange={(e) => setField("paymob_api_key", e.target.value)}
              placeholder="Enter Paymob API key"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="paymob_hmac_secret">HMAC Secret</Label>
            <Input
              id="paymob_hmac_secret"
              type="password"
              value={form.paymob_hmac_secret}
              onChange={(e) => setField("paymob_hmac_secret", e.target.value)}
              placeholder="Enter webhook HMAC secret"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymob_integration_id_card_eg">Integration ID — Card Egypt</Label>
            <Input
              id="paymob_integration_id_card_eg"
              value={form.paymob_integration_id_card_eg}
              onChange={(e) => setField("paymob_integration_id_card_eg", e.target.value)}
              placeholder="e.g. 1234567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymob_integration_id_card_sa">Integration ID — Card Saudi</Label>
            <Input
              id="paymob_integration_id_card_sa"
              value={form.paymob_integration_id_card_sa}
              onChange={(e) => setField("paymob_integration_id_card_sa", e.target.value)}
              placeholder="e.g. 7654321"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymob_integration_id_wallet_eg">Integration ID — Wallet Egypt</Label>
            <Input
              id="paymob_integration_id_wallet_eg"
              value={form.paymob_integration_id_wallet_eg}
              onChange={(e) => setField("paymob_integration_id_wallet_eg", e.target.value)}
              placeholder="e.g. 998877"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymob_iframe_id">iframe ID</Label>
            <Input
              id="paymob_iframe_id"
              value={form.paymob_iframe_id}
              onChange={(e) => setField("paymob_iframe_id", e.target.value)}
              placeholder="e.g. 123456"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border p-4">
          <div className="space-y-1 pr-4">
            <p className="text-sm font-medium">Enable Paymob</p>
            <p className="text-xs text-muted-foreground">
              Turn this on to show Paymob payment actions in deals and contracts.
            </p>
          </div>

          <Switch
            checked={form.paymob_enabled}
            onCheckedChange={(checked) => setField("paymob_enabled", checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {updateMutation.isSuccess ? "Settings saved successfully." : ""}
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
            Save Paymob Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

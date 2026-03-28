import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

type TamaraSettingsForm = {
  tamara_api_token: string;
  tamara_public_key: string;
  tamara_notification_token: string;
  tamara_merchant_id: string;
  tamara_enabled: boolean;
};

const defaultForm: TamaraSettingsForm = {
  tamara_api_token: "",
  tamara_public_key: "",
  tamara_notification_token: "",
  tamara_merchant_id: "",
  tamara_enabled: false,
};

export default function TamaraSettingsTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.tamara.getSettings.useQuery();
  const updateSettings = trpc.tamara.updateSettings.useMutation({
    onSuccess: async () => {
      toast.success("Tamara settings were saved successfully.");
      await utils.tamara.getSettings.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save Tamara settings.");
    },
  });

  const [form, setForm] = useState<TamaraSettingsForm>(defaultForm);

  useEffect(() => {
    if (data) {
      setForm({
        tamara_api_token: data.tamara_api_token ?? "",
        tamara_public_key: data.tamara_public_key ?? "",
        tamara_notification_token: data.tamara_notification_token ?? "",
        tamara_merchant_id: data.tamara_merchant_id ?? "",
        tamara_enabled: Boolean(data.tamara_enabled),
      });
    }
  }, [data]);

  const setField = <K extends keyof TamaraSettingsForm>(key: K, value: TamaraSettingsForm[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const onSubmit = () => {
    updateSettings.mutate(form);
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>Tamara Settings</CardTitle>
        <CardDescription>
          Configure Tamara production credentials and enable or disable installment checkout.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Tamara settings...
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              <Label htmlFor="tamara_api_token">Tamara API Token</Label>
              <Input
                id="tamara_api_token"
                type="password"
                value={form.tamara_api_token}
                onChange={(e) => setField("tamara_api_token", e.target.value)}
                placeholder="Enter Tamara API token"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tamara_public_key">Tamara Public Key</Label>
              <Input
                id="tamara_public_key"
                value={form.tamara_public_key}
                onChange={(e) => setField("tamara_public_key", e.target.value)}
                placeholder="Enter Tamara public key"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tamara_notification_token">Tamara Notification Token</Label>
              <Input
                id="tamara_notification_token"
                type="password"
                value={form.tamara_notification_token}
                onChange={(e) => setField("tamara_notification_token", e.target.value)}
                placeholder="Enter Tamara notification token"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tamara_merchant_id">Tamara Merchant ID</Label>
              <Input
                id="tamara_merchant_id"
                value={form.tamara_merchant_id}
                onChange={(e) => setField("tamara_merchant_id", e.target.value)}
                placeholder="Enter Tamara merchant ID"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="space-y-1">
                <Label htmlFor="tamara_enabled">Enable Tamara</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, users can generate Tamara checkout sessions from pending deals.
                </p>
              </div>

              <Switch
                id="tamara_enabled"
                checked={form.tamara_enabled}
                onCheckedChange={(checked) => setField("tamara_enabled", checked)}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={onSubmit} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Tamara Settings
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

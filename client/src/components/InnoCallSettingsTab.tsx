import { useEffect, useState } from "react";
import { Loader2, Phone, Save, Link } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

type InnoCallSettingsForm = {
  innocall_api_key: string;
  innocall_extension: string;
  innocall_webrtc_secret: string;
  innocall_base_color: string;
  innocall_enabled: boolean;
  innocall_script_url: string;
};

const defaultForm: InnoCallSettingsForm = {
  innocall_api_key: "",
  innocall_extension: "",
  innocall_webrtc_secret: "",
  innocall_base_color: "#6366f1",
  innocall_enabled: false,
  innocall_script_url: "",
};

export default function InnoCallSettingsTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.innocall.getSettings.useQuery();
  const updateSettings = trpc.innocall.updateSettings.useMutation({
    onSuccess: async () => {
      toast.success("InnoCall settings were saved successfully.");
      await utils.innocall.getSettings.invalidate();
      await utils.innocall.getConfig.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save InnoCall settings.");
    },
  });

  const [form, setForm] = useState<InnoCallSettingsForm>(defaultForm);

  useEffect(() => {
    if (data) {
      setForm({
        innocall_api_key: data.innocall_api_key ?? "",
        innocall_extension: data.innocall_extension ?? "",
        innocall_webrtc_secret: data.innocall_webrtc_secret ?? "",
        innocall_base_color: data.innocall_base_color ?? "#6366f1",
        innocall_enabled: Boolean(data.innocall_enabled),
        innocall_script_url: data.innocall_script_url ?? "",
      });
    }
  }, [data]);

  const setField = <K extends keyof InnoCallSettingsForm>(key: K, value: InnoCallSettingsForm[K]) => {
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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
            <Phone className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <CardTitle>InnoCall Settings</CardTitle>
            <CardDescription>
              Configure InnoCall cloud phone system credentials and enable or disable VoIP calling.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading InnoCall settings...
          </div>
        ) : (
          <>
            {/* Web Call Script URL - Most important field */}
            <div className="grid gap-2 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
              <Label htmlFor="innocall_script_url" className="flex items-center gap-2 font-semibold">
                <Link className="h-4 w-4 text-indigo-500" />
                Web Call Script URL
              </Label>
              <Input
                id="innocall_script_url"
                value={form.innocall_script_url}
                onChange={(e) => setField("innocall_script_url", e.target.value)}
                placeholder="https://platform.innocalls.com/api/normal-web-call/bundle/..."
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                The Web Call script URL from InnoCall dashboard. Go to Web Call &rarr; Credential to find this URL.
                This script enables the click-to-call widget on the CRM.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="innocall_api_key">API Key</Label>
              <Input
                id="innocall_api_key"
                type="password"
                value={form.innocall_api_key}
                onChange={(e) => setField("innocall_api_key", e.target.value)}
                placeholder="Enter InnoCall API key"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                Your InnoCall API key from the InnoCall dashboard.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="innocall_extension">Extension</Label>
              <Input
                id="innocall_extension"
                value={form.innocall_extension}
                onChange={(e) => setField("innocall_extension", e.target.value)}
                placeholder="e.g. 101"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                The extension number for outbound calls.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="innocall_webrtc_secret">WebRTC Secret</Label>
              <Input
                id="innocall_webrtc_secret"
                type="password"
                value={form.innocall_webrtc_secret}
                onChange={(e) => setField("innocall_webrtc_secret", e.target.value)}
                placeholder="Enter WebRTC secret"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                The WebRTC secret token from InnoCall for browser-based calling.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="innocall_base_color">Theme Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="innocall_base_color"
                  type="color"
                  value={form.innocall_base_color}
                  onChange={(e) => setField("innocall_base_color", e.target.value)}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <Input
                  value={form.innocall_base_color}
                  onChange={(e) => setField("innocall_base_color", e.target.value)}
                  placeholder="#6366f1"
                  className="flex-1"
                  dir="ltr"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Customize the InnoCall dialpad widget color.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="space-y-1">
                <Label htmlFor="innocall_enabled">Enable InnoCall</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, users can make VoIP calls directly from lead and client profiles.
                </p>
              </div>

              <Switch
                id="innocall_enabled"
                checked={form.innocall_enabled}
                onCheckedChange={(checked) => setField("innocall_enabled", checked)}
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
                    Save InnoCall Settings
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

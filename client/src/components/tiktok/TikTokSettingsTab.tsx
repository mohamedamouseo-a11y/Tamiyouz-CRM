import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import TikTokAccountSelector from "./TikTokAccountSelector";

export default function TikTokSettingsTab() {
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();

  // Integration state
  const integrationQuery = trpc.tiktok.settings.getIntegration.useQuery();
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");

  const upsertIntegration = trpc.tiktok.settings.upsertIntegration.useMutation({
    onSuccess: () => {
      utils.tiktok.settings.getIntegration.invalidate();
      setAppId("");
      setAppSecret("");
    },
  });

  const deleteIntegration = trpc.tiktok.settings.deleteIntegration.useMutation({
    onSuccess: () => {
      utils.tiktok.settings.invalidate();
    },
  });

  // Add account state
  const [newAdvertiserId, setNewAdvertiserId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccessToken, setNewAccessToken] = useState("");

  const addAccount = trpc.tiktok.settings.addAdAccount.useMutation({
    onSuccess: () => {
      utils.tiktok.settings.getAdAccounts.invalidate();
      setNewAdvertiserId("");
      setNewAccountName("");
      setNewAccessToken("");
    },
  });

  const syncCampaigns = trpc.tiktok.settings.syncCampaigns.useMutation({
    onSuccess: () => {
      utils.tiktok.campaigns.getAnalytics.invalidate();
    },
  });

  const integration = integrationQuery.data;

  return (
    <div className="space-y-6">
      {/* Integration Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {isRTL ? "إعدادات TikTok Ads" : "TikTok Ads Integration"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isRTL
                  ? "أدخل بيانات تطبيق TikTok Business الخاص بك"
                  : "Enter your TikTok Business app credentials"}
              </CardDescription>
            </div>
            {integration && (
              <Badge variant="default" className="text-xs">
                {isRTL ? "متصل" : "Connected"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">App ID</Label>
              <Input
                value={appId || integration?.appId || ""}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="TikTok App ID"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">App Secret</Label>
              <Input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={integration ? "••••••••" : "TikTok App Secret"}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => upsertIntegration.mutate({
                appId: appId || integration?.appId || "",
                appSecret: appSecret,
              })}
              disabled={upsertIntegration.isPending || (!appId && !integration) || !appSecret}
              className="h-8 text-xs"
            >
              {upsertIntegration.isPending && <Loader2 size={12} className="animate-spin mr-1" />}
              {isRTL ? "حفظ" : "Save"}
            </Button>
            {integration && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(isRTL ? "هل أنت متأكد؟ سيتم حذف كل البيانات المرتبطة." : "Are you sure? All related data will be deleted.")) {
                    deleteIntegration.mutate();
                  }
                }}
                disabled={deleteIntegration.isPending}
                className="h-8 text-xs"
              >
                {deleteIntegration.isPending && <Loader2 size={12} className="animate-spin mr-1" />}
                <Trash2 size={12} className="mr-1" />
                {isRTL ? "حذف" : "Delete"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ad Accounts */}
      {integration && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isRTL ? "حسابات الإعلانات" : "Ad Accounts"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isRTL ? "أضف وأدر حسابات إعلانات TikTok" : "Add and manage TikTok ad accounts"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Account Form */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{isRTL ? "معرف المعلن" : "Advertiser ID"}</Label>
                  <Input
                    value={newAdvertiserId}
                    onChange={(e) => setNewAdvertiserId(e.target.value)}
                    placeholder="e.g., 7123456789"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{isRTL ? "اسم الحساب" : "Account Name"}</Label>
                  <Input
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder={isRTL ? "اختياري" : "Optional"}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Access Token</Label>
                  <Input
                    type="password"
                    value={newAccessToken}
                    onChange={(e) => setNewAccessToken(e.target.value)}
                    placeholder="TikTok Access Token"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => addAccount.mutate({
                    advertiserId: newAdvertiserId,
                    accountName: newAccountName,
                    accessToken: newAccessToken,
                  })}
                  disabled={addAccount.isPending || !newAdvertiserId || !newAccessToken}
                  className="h-8 text-xs"
                >
                  {addAccount.isPending && <Loader2 size={12} className="animate-spin mr-1" />}
                  <Plus size={12} className="mr-1" />
                  {isRTL ? "إضافة حساب" : "Add Account"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncCampaigns.mutate()}
                  disabled={syncCampaigns.isPending}
                  className="h-8 text-xs"
                >
                  {syncCampaigns.isPending && <Loader2 size={12} className="animate-spin mr-1" />}
                  <RefreshCw size={12} className="mr-1" />
                  {isRTL ? "مزامنة الحملات" : "Sync Campaigns"}
                </Button>
              </div>
              {addAccount.error && (
                <p className="text-xs text-destructive">{addAccount.error.message}</p>
              )}
              {syncCampaigns.isSuccess && (
                <p className="text-xs text-green-600">
                  {isRTL ? `تمت مزامنة ${(syncCampaigns.data as any)?.synced ?? 0} حملة` : `Synced ${(syncCampaigns.data as any)?.synced ?? 0} campaigns`}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Account Selector */}
          <div>
            <h3 className="text-sm font-medium mb-3">
              {isRTL ? "اختيار الحساب النشط" : "Select Active Account"}
            </h3>
            <TikTokAccountSelector />
          </div>
        </>
      )}
    </div>
  );
}

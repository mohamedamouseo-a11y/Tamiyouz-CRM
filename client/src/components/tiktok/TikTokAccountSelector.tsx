import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function TikTokAccountSelector() {
  const { isRTL } = useLanguage();
  const adAccountsQuery = trpc.tiktok.settings.getAdAccounts.useQuery();
  const utils = trpc.useUtils();

  const selectAccountMutation = trpc.tiktok.settings.selectAdAccount.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.tiktok.settings.getAdAccounts.invalidate(),
        utils.tiktok.campaigns.getAnalytics.invalidate(),
      ]);
    },
  });

  if (adAccountsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        {isRTL ? "جاري تحميل حسابات TikTok..." : "Loading TikTok ad accounts..."}
      </div>
    );
  }

  if (!adAccountsQuery.data?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        {isRTL
          ? "لا توجد حسابات إعلانية TikTok. أضف حساب من الإعدادات."
          : "No TikTok ad accounts found. Add one from settings."}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {adAccountsQuery.data.map((account: any) => (
        <Card key={account.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm">{account.accountName || account.advertiserId}</CardTitle>
                <CardDescription className="text-xs">
                  {isRTL ? "معرف المعلن:" : "Advertiser ID:"} {account.advertiserId}
                </CardDescription>
              </div>
              {account.isActive ? (
                <Badge>{isRTL ? "نشط" : "Active"}</Badge>
              ) : (
                <Badge variant="outline">{isRTL ? "غير نشط" : "Inactive"}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3 pt-0">
            <p className="text-xs text-muted-foreground">
              {account.lastSyncAt
                ? `${isRTL ? "آخر مزامنة:" : "Last sync:"} ${new Date(account.lastSyncAt).toLocaleDateString()}`
                : isRTL ? "لم تتم المزامنة بعد" : "Not synced yet"}
            </p>
            <Button
              variant={account.isActive ? "secondary" : "default"}
              size="sm"
              disabled={account.isActive || selectAccountMutation.isPending}
              onClick={() => selectAccountMutation.mutate({ accountId: account.id })}
              className="h-7 text-xs"
            >
              {selectAccountMutation.isPending ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : null}
              {account.isActive
                ? (isRTL ? "نشط" : "Active")
                : (isRTL ? "تفعيل" : "Set Active")}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

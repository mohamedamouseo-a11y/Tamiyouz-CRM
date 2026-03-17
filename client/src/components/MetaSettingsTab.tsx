import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  Star,
  Settings2,
  Unplug,
} from "lucide-react";

export default function MetaSettingsTab() {
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();

  // ─── State ─────────────────────────────────────────────────────────────
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showTokens, setShowTokens] = useState<Record<number, boolean>>({});
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [newAdAccountId, setNewAdAccountId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccessToken, setNewAccessToken] = useState("");

  // ─── Queries ───────────────────────────────────────────────────────────
  const integrationQ = trpc.meta.getIntegration.useQuery();
  const adAccountsQ = trpc.meta.getAdAccounts.useQuery();

  // ─── Mutations ─────────────────────────────────────────────────────────
  const upsertIntegration = trpc.meta.upsertIntegration.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حفظ إعدادات Meta" : "Meta integration saved");
      utils.meta.getIntegration.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteIntegration = trpc.meta.deleteIntegration.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم فصل Meta" : "Meta integration disconnected");
      utils.meta.getIntegration.invalidate();
      utils.meta.getAdAccounts.invalidate();
      setShowDisconnectConfirm(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const addAdAccount = trpc.meta.addAdAccount.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم إضافة حساب الإعلانات" : "Ad account added");
      utils.meta.getAdAccounts.invalidate();
      setShowAddAccount(false);
      setNewAdAccountId("");
      setNewAccountName("");
      setNewAccessToken("");
    },
    onError: (err) => toast.error(err.message),
  });

  const selectAdAccount = trpc.meta.selectAdAccount.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تحديد الحساب النشط" : "Active account updated");
      utils.meta.getAdAccounts.invalidate();
      utils.meta.getCampaigns.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAdAccount = trpc.meta.deleteAdAccount.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف الحساب" : "Ad account deleted");
      utils.meta.getAdAccounts.invalidate();
      setShowDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const integration = integrationQ.data;
  const adAccounts = adAccountsQ.data || [];

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleSaveIntegration = () => {
    if (!appId.trim() || !appSecret.trim()) {
      toast.error(isRTL ? "يرجى ملء جميع الحقول" : "Please fill all fields");
      return;
    }
    upsertIntegration.mutate({ appId: appId.trim(), appSecret: appSecret.trim() });
  };

  const handleAddAdAccount = () => {
    if (!newAdAccountId.trim() || !newAccessToken.trim()) {
      toast.error(isRTL ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }
    addAdAccount.mutate({
      adAccountId: newAdAccountId.trim(),
      accountName: newAccountName.trim(),
      accessToken: newAccessToken.trim(),
    });
  };

  // Pre-fill form if integration exists
  const handleEditIntegration = () => {
    if (integration) {
      setAppId(integration.appId);
      setAppSecret(integration.appSecret);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Integration Config Card ──────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 size={20} />
            {isRTL ? "إعدادات Meta (Facebook)" : "Meta (Facebook) Integration"}
          </CardTitle>
          {integration ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 size={12} className="mr-1" />
              {isRTL ? "متصل" : "Connected"}
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle size={12} className="mr-1" />
              {isRTL ? "غير متصل" : "Not Connected"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{isRTL ? "معرف التطبيق (App ID)" : "App ID"}</Label>
              <Input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="e.g. 123456789012345"
                onFocus={handleEditIntegration}
              />
            </div>
            <div>
              <Label>{isRTL ? "سر التطبيق (App Secret)" : "App Secret"}</Label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder="••••••••••••"
                  onFocus={handleEditIntegration}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveIntegration} disabled={upsertIntegration.isPending}>
              {upsertIntegration.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <Save size={16} className="mr-1" />}
              {isRTL ? "حفظ" : "Save"}
            </Button>
            {integration && (
              <Button variant="destructive" onClick={() => setShowDisconnectConfirm(true)}>
                <Unplug size={16} className="mr-1" />
                {isRTL ? "فصل" : "Disconnect"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Ad Accounts Card ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">
            {isRTL ? "حسابات الإعلانات" : "Ad Accounts"}
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddAccount(true)} disabled={!integration}>
            <Plus size={16} className="mr-1" />
            {isRTL ? "إضافة حساب" : "Add Account"}
          </Button>
        </CardHeader>
        <CardContent>
          {!integration ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              {isRTL ? "يرجى إعداد تكامل Meta أولاً" : "Please configure Meta integration first"}
            </p>
          ) : adAccounts.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              {isRTL ? "لا توجد حسابات إعلانات. أضف واحداً للبدء." : "No ad accounts yet. Add one to get started."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "الحساب" : "Account"}</TableHead>
                  <TableHead>{isRTL ? "معرف الحساب" : "Account ID"}</TableHead>
                  <TableHead>{isRTL ? "رمز الوصول" : "Access Token"}</TableHead>
                  <TableHead>{isRTL ? "آخر مزامنة" : "Last Sync"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adAccounts.map((acc: any) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.accountName || acc.adAccountId}</TableCell>
                    <TableCell className="font-mono text-xs">{acc.adAccountId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs truncate max-w-[120px]">
                          {showTokens[acc.id] ? acc.accessToken?.substring(0, 30) + "..." : "••••••••"}
                        </span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setShowTokens(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                        >
                          {showTokens[acc.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleString() : (isRTL ? "لم تتم المزامنة" : "Never")}
                    </TableCell>
                    <TableCell>
                      {acc.isActive ? (
                        <Badge className="bg-green-600">
                          <Star size={10} className="mr-1" />
                          {isRTL ? "نشط" : "Active"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{isRTL ? "غير نشط" : "Inactive"}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!acc.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectAdAccount.mutate({ accountId: acc.id })}
                            disabled={selectAdAccount.isPending}
                          >
                            {isRTL ? "تفعيل" : "Activate"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setShowDeleteConfirm(acc.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Add Ad Account Dialog ────────────────────────────────────── */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "إضافة حساب إعلانات" : "Add Ad Account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? "معرف حساب الإعلانات" : "Ad Account ID"} *</Label>
              <Input
                value={newAdAccountId}
                onChange={(e) => setNewAdAccountId(e.target.value)}
                placeholder="act_123456789 or 123456789"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "يمكنك إدخال المعرف مع أو بدون البادئة act_" : "You can enter with or without the act_ prefix"}
              </p>
            </div>
            <div>
              <Label>{isRTL ? "اسم الحساب (اختياري)" : "Account Name (optional)"}</Label>
              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="e.g. My Business Account"
              />
            </div>
            <div>
              <Label>{isRTL ? "رمز الوصول (Access Token)" : "Access Token"} *</Label>
              <Input
                value={newAccessToken}
                onChange={(e) => setNewAccessToken(e.target.value)}
                placeholder="EAAxxxxxxx..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "استخدم رمز وصول طويل الأمد من Meta Developer" : "Use a long-lived token from Meta Developer"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccount(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleAddAdAccount} disabled={addAdAccount.isPending}>
              {addAdAccount.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <Plus size={16} className="mr-1" />}
              {isRTL ? "إضافة" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Ad Account Confirm ────────────────────────────────── */}
      <AlertDialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? "حذف حساب الإعلانات" : "Delete Ad Account"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? "سيتم حذف هذا الحساب وجميع بيانات الحملات المرتبطة به. هل أنت متأكد؟"
                : "This will delete the ad account and all associated campaign data. Are you sure?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => showDeleteConfirm && deleteAdAccount.mutate({ accountId: showDeleteConfirm })}
            >
              {isRTL ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Disconnect Integration Confirm ───────────────────────────── */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? "فصل Meta" : "Disconnect Meta"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? "سيتم حذف جميع إعدادات Meta وحسابات الإعلانات وبيانات الحملات. هل أنت متأكد؟"
                : "This will delete all Meta settings, ad accounts, and campaign data. Are you sure?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteIntegration.mutate()}
            >
              {isRTL ? "فصل" : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

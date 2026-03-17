import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Plus, Send, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  isRTL: boolean;
  tokens: any;
}

export default function NotificationsTab({ isRTL, tokens }: Props) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newFrequency, setNewFrequency] = useState<"daily" | "weekly">("daily");

  const { data: subscribers, refetch } = trpc.notifications.getSubscribers.useQuery();

  const addSubscriber = trpc.notifications.addSubscriber.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تمت الإضافة بنجاح" : "Subscriber added");
      refetch();
      setShowAddDialog(false);
      setNewEmail("");
      setNewName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSubscriber = trpc.notifications.updateSubscriber.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم التحديث" : "Updated");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSubscriber = trpc.notifications.deleteSubscriber.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم الحذف" : "Deleted");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendTestReport = trpc.notifications.sendTestReport.useMutation({
    onSuccess: (data: { success: boolean; info?: string }) => {
      if (data.success) {
        toast.success(isRTL ? "تم إرسال التقرير التجريبي بنجاح" : "Test report sent successfully");
      } else {
        toast.error(isRTL ? `فشل الإرسال: ${data.info}` : `Failed: ${data.info}`);
      }
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!newEmail) return;
    addSubscriber.mutate({
      email: newEmail,
      name: newName || undefined,
      frequency: newFrequency,
      reportTypes: ["sla", "performance", "deals"],
    });
  };

  const handleSendTest = () => {
    if (!testEmail) {
      toast.error(isRTL ? "أدخل البريد الإلكتروني أولاً" : "Enter email first");
      return;
    }
    sendTestReport.mutate({ email: testEmail });
  };

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell size={16} />
            {isRTL ? "إعدادات التقارير الآلية" : "Automated Report Settings"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isRTL
              ? "يتم إرسال التقارير تلقائياً يومياً الساعة 8 صباحاً، وأسبوعياً كل اثنين الساعة 8 صباحاً"
              : "Reports are sent automatically daily at 8:00 AM and weekly on Mondays at 8:00 AM"}
          </p>
        </CardHeader>
      </Card>

      {/* Subscribers List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">
            {isRTL ? "قائمة المستلمين" : "Notification Recipients"}
          </CardTitle>
          <Button
            size="sm"
            style={{ background: tokens.primaryColor }}
            className="text-white gap-1.5"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus size={14} />
            {isRTL ? "إضافة مستلم" : "Add Recipient"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {(!subscribers || subscribers.length === 0) ? (
            <div className="text-center py-10 text-muted-foreground">
              <Mail size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {isRTL ? "لا يوجد مستلمون بعد. أضف بريداً إلكترونياً لاستلام التقارير." : "No recipients yet. Add an email to receive reports."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "الاسم / البريد" : "Name / Email"}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "التكرار" : "Frequency"}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "الحالة" : "Status"}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {isRTL ? "الإجراءات" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub: any) => (
                  <tr key={sub.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{sub.name ?? sub.email}</div>
                      {sub.name && (
                        <div className="text-xs text-muted-foreground">{sub.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {sub.frequency === "daily"
                          ? (isRTL ? "يومي" : "Daily")
                          : (isRTL ? "أسبوعي" : "Weekly")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={sub.isActive}
                        onCheckedChange={(v) => updateSubscriber.mutate({ id: sub.id, isActive: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteSubscriber.mutate({ id: sub.id })}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Test Report Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Send size={16} />
            {isRTL ? "إرسال تقرير تجريبي" : "Send Test Report"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isRTL
              ? "أرسل تقريراً تجريبياً لأي بريد إلكتروني للتحقق من صحة الإعدادات"
              : "Send a test report to any email to verify your SMTP settings"}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={isRTL ? "البريد الإلكتروني" : "Email address"}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
              dir="ltr"
            />
            <Button
              onClick={handleSendTest}
              disabled={sendTestReport.isPending}
              style={{ background: tokens.primaryColor }}
              className="text-white gap-1.5"
            >
              <Send size={14} />
              {sendTestReport.isPending
                ? (isRTL ? "جاري الإرسال..." : "Sending...")
                : (isRTL ? "إرسال" : "Send")}
            </Button>
          </div>
          {!process.env.SMTP_HOST && (
            <p className="text-xs text-amber-600 mt-2">
              {isRTL
                ? "⚠️ لم يتم تكوين SMTP. أضف SMTP_HOST وSMTP_USER وSMTP_PASS في الإعدادات لإرسال البريد الإلكتروني."
                : "⚠️ SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to environment variables to enable email sending."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* SMTP Configuration Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {isRTL ? "إعداد SMTP (إرسال البريد)" : "SMTP Configuration (Email Sending)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/30 rounded-lg p-3 font-mono">
            <p className="font-semibold text-foreground mb-2 font-sans">
              {isRTL ? "متغيرات البيئة المطلوبة:" : "Required environment variables:"}
            </p>
            <p>SMTP_HOST=smtp.gmail.com</p>
            <p>SMTP_PORT=587</p>
            <p>SMTP_USER=your@gmail.com</p>
            <p>SMTP_PASS=your-app-password</p>
            <p>SMTP_FROM="Tamiyouz CRM" &lt;your@gmail.com&gt;</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {isRTL
              ? "لـ Gmail: فعّل المصادقة الثنائية ثم أنشئ App Password من إعدادات الأمان في حسابك."
              : "For Gmail: Enable 2FA then create an App Password from your Google Account security settings."}
          </p>
        </CardContent>
      </Card>

      {/* Add Subscriber Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "إضافة مستلم جديد" : "Add New Recipient"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? "البريد الإلكتروني *" : "Email *"}</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-1"
                dir="ltr"
              />
            </div>
            <div>
              <Label>{isRTL ? "الاسم (اختياري)" : "Name (optional)"}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={isRTL ? "اسم المستلم" : "Recipient name"}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{isRTL ? "تكرار الإرسال" : "Report Frequency"}</Label>
              <Select value={newFrequency} onValueChange={(v) => setNewFrequency(v as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{isRTL ? "يومي (كل يوم الساعة 8 ص)" : "Daily (every day at 8 AM)"}</SelectItem>
                  <SelectItem value="weekly">{isRTL ? "أسبوعي (كل اثنين الساعة 8 ص)" : "Weekly (every Monday at 8 AM)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleAdd}
                disabled={addSubscriber.isPending || !newEmail}
                style={{ background: tokens.primaryColor }}
                className="text-white"
              >
                {addSubscriber.isPending ? (isRTL ? "جاري الإضافة..." : "Adding...") : (isRTL ? "إضافة" : "Add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

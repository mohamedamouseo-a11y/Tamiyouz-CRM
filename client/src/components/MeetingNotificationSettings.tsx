import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, Clock, Volume2, Monitor, Save, Plus, X, RefreshCw } from "lucide-react";

interface Props {
  isRTL: boolean;
  tokens: any;
}

const PRESET_MINUTES = [5, 10, 15, 30, 45, 60];

export default function MeetingNotificationSettings({ isRTL, tokens }: Props) {
  const { data: config, refetch, isLoading } = trpc.meetingNotificationConfig.get.useQuery();
  const updateConfig = trpc.meetingNotificationConfig.update.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const [reminderMinutes, setReminderMinutes] = useState<number[]>([30, 10]);
  const [repeatCount, setRepeatCount] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [popupEnabled, setPopupEnabled] = useState(true);
  const [autoCalendarForMeeting, setAutoCalendarForMeeting] = useState(true);
  const [autoCalendarForCall, setAutoCalendarForCall] = useState(true);
  const [customMinutes, setCustomMinutes] = useState("");

  // Sync state from server config
  useEffect(() => {
    if (config) {
      setReminderMinutes(config.reminderMinutes || [30, 10]);
      setRepeatCount(config.repeatCount || 1);
      setSoundEnabled(config.soundEnabled ?? true);
      setPopupEnabled(config.popupEnabled ?? true);
      setAutoCalendarForMeeting(config.autoCalendarForMeeting ?? true);
      setAutoCalendarForCall(config.autoCalendarForCall ?? true);
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({
      reminderMinutes,
      repeatCount,
      soundEnabled,
      popupEnabled,
      autoCalendarForMeeting,
      autoCalendarForCall,
    });
  };

  const addReminderTime = (minutes: number) => {
    if (!reminderMinutes.includes(minutes)) {
      setReminderMinutes([...reminderMinutes, minutes].sort((a, b) => b - a));
    }
  };

  const removeReminderTime = (minutes: number) => {
    if (reminderMinutes.length > 1) {
      setReminderMinutes(reminderMinutes.filter((m) => m !== minutes));
    }
  };

  const handleAddCustom = () => {
    const val = parseInt(customMinutes);
    if (val && val > 0 && val <= 120 && !reminderMinutes.includes(val)) {
      setReminderMinutes([...reminderMinutes, val].sort((a, b) => b - a));
      setCustomMinutes("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <RefreshCw size={16} className="animate-spin mr-2" />
        {isRTL ? "جاري التحميل..." : "Loading..."}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Reminder Timing ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock size={16} />
            {isRTL ? "توقيت التذكير" : "Reminder Timing"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isRTL
              ? "اختر الأوقات التي تريد أن يتم تذكيرك فيها قبل الاجتماع"
              : "Choose when you want to be reminded before a meeting"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current reminder times */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              {isRTL ? "أوقات التذكير الحالية" : "Current Reminder Times"}
            </Label>
            <div className="flex flex-wrap gap-2">
              {reminderMinutes.map((min) => (
                <Badge
                  key={min}
                  variant="secondary"
                  className="gap-1 px-3 py-1.5 text-xs cursor-default"
                >
                  {min} {isRTL ? "دقيقة" : "min"}
                  {reminderMinutes.length > 1 && (
                    <button
                      onClick={() => removeReminderTime(min)}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Preset buttons */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              {isRTL ? "إضافة وقت تذكير" : "Add Reminder Time"}
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_MINUTES.filter((m) => !reminderMinutes.includes(m)).map((min) => (
                <Button
                  key={min}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => addReminderTime(min)}
                >
                  <Plus size={12} />
                  {min} {isRTL ? "دقيقة" : "min"}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom time */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">
                {isRTL ? "وقت مخصص (بالدقائق)" : "Custom time (minutes)"}
              </Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                placeholder={isRTL ? "مثلاً 20" : "e.g. 20"}
                className="mt-1 h-8"
                dir="ltr"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleAddCustom}
              disabled={!customMinutes}
            >
              <Plus size={14} />
            </Button>
          </div>

          {/* Repeat count */}
          <div>
            <Label className="text-xs text-muted-foreground">
              {isRTL ? "عدد مرات تكرار الإشعار" : "Notification Repeat Count"}
            </Label>
            <div className="flex items-center gap-3 mt-1">
              <Input
                type="number"
                min={1}
                max={10}
                value={repeatCount}
                onChange={(e) => setRepeatCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-20 h-8"
                dir="ltr"
              />
              <span className="text-xs text-muted-foreground">
                {isRTL ? "مرة/مرات لكل وقت تذكير" : "time(s) per reminder interval"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Notification Type ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell size={16} />
            {isRTL ? "نوع الإشعار" : "Notification Type"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                <Volume2 size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{isRTL ? "صوت الإشعار" : "Notification Sound"}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "تشغيل صوت عند وصول تذكير الاجتماع" : "Play a sound when a meeting reminder arrives"}
                </p>
              </div>
            </div>
            <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                <Monitor size={16} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{isRTL ? "إشعار منبثق" : "Popup Notification"}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "عرض إشعار منبثق في المتصفح" : "Show a browser popup notification"}
                </p>
              </div>
            </div>
            <Switch checked={popupEnabled} onCheckedChange={setPopupEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* ── Auto Calendar Booking ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar size={16} />
            {isRTL ? "الحجز التلقائي في التقويم" : "Auto Calendar Booking"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isRTL
              ? "حجز تلقائي في Google Calendar عند إنشاء نشاط (مع فحص الجدول الزمني)"
              : "Automatically book in Google Calendar when creating an activity (with free/busy check)"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                <Calendar size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{isRTL ? "الاجتماعات" : "Meetings"}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "حجز تلقائي عند إنشاء نشاط اجتماع" : "Auto-book when creating a Meeting activity"}
                </p>
              </div>
            </div>
            <Switch checked={autoCalendarForMeeting} onCheckedChange={setAutoCalendarForMeeting} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center">
                <Calendar size={16} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{isRTL ? "المكالمات" : "Calls"}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "حجز تلقائي عند إنشاء نشاط مكالمة" : "Auto-book when creating a Call activity"}
                </p>
              </div>
            </div>
            <Switch checked={autoCalendarForCall} onCheckedChange={setAutoCalendarForCall} />
          </div>
        </CardContent>
      </Card>

      {/* ── Save Button ── */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateConfig.isPending}
          style={{ background: tokens.primaryColor }}
          className="text-white gap-2"
        >
          <Save size={14} />
          {updateConfig.isPending
            ? (isRTL ? "جاري الحفظ..." : "Saving...")
            : (isRTL ? "حفظ الإعدادات" : "Save Settings")}
        </Button>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import CRMLayout from "@/components/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bell,
  Volume2,
  VolumeX,
  Monitor,
  Upload,
  Trash2,
  Save,
  AlertTriangle,
  Calendar,
  UserPlus,
  ArrowRightLeft,
  AtSign,
  Info,
  Loader2,
  Music,
  CheckCircle,
} from "lucide-react";

const NOTIFICATION_TYPES = [
  { key: "meeting_reminder", icon: Calendar, color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  { key: "lead_assigned", icon: UserPlus, color: "text-green-500", bgColor: "bg-green-50 dark:bg-green-950/30" },
  { key: "sla_breach", icon: AlertTriangle, color: "text-red-500", bgColor: "bg-red-50 dark:bg-red-950/30" },
  { key: "lead_transfer", icon: ArrowRightLeft, color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950/30" },
  { key: "mention", icon: AtSign, color: "text-purple-500", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
  { key: "system", icon: Info, color: "text-gray-500", bgColor: "bg-gray-50 dark:bg-gray-950/30" },
];

const typeLabels: Record<string, { en: string; ar: string }> = {
  meeting_reminder: { en: "Meeting Reminders", ar: "تذكيرات الاجتماعات" },
  lead_assigned: { en: "Lead Assigned", ar: "تعيين عميل محتمل" },
  sla_breach: { en: "SLA Breach Alerts", ar: "تنبيهات تجاوز SLA" },
  lead_transfer: { en: "Lead Transfers", ar: "نقل العملاء" },
  mention: { en: "Mentions", ar: "الإشارات" },
  system: { en: "System Notifications", ar: "إشعارات النظام" },
};

const typeDescriptions: Record<string, { en: string; ar: string }> = {
  meeting_reminder: { en: "Alerts before scheduled meetings", ar: "تنبيهات قبل الاجتماعات المجدولة" },
  lead_assigned: { en: "When a new lead is assigned to you", ar: "عند تعيين عميل محتمل جديد لك" },
  sla_breach: { en: "When SLA response time is exceeded", ar: "عند تجاوز وقت الاستجابة المحدد" },
  lead_transfer: { en: "When a lead is transferred", ar: "عند نقل عميل محتمل" },
  mention: { en: "When someone mentions you in notes", ar: "عند ذكرك في الملاحظات" },
  system: { en: "General system alerts and updates", ar: "تنبيهات وتحديثات النظام العامة" },
};

interface PrefState {
  [key: string]: { soundEnabled: boolean; popupEnabled: boolean };
}

export default function NotificationSettings() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prefs, setPrefs] = useState<PrefState>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isPrimaryAdmin = user?.id === 1;

  const { data: savedPrefs, refetch: refetchPrefs } = trpc.notificationPreferences.get.useQuery();
  const { data: soundConfig, refetch: refetchSound } = trpc.notificationPreferences.getSoundConfig.useQuery();

  const updatePrefs = trpc.notificationPreferences.update.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully");
      refetchPrefs();
      setHasChanges(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const uploadSound = trpc.notificationPreferences.uploadSound.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم رفع ملف الصوت بنجاح" : "Sound file uploaded successfully");
      refetchSound();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const removeSound = trpc.notificationPreferences.removeSound.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف ملف الصوت" : "Sound file removed");
      refetchSound();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Initialize preferences state from saved data
  useEffect(() => {
    const initial: PrefState = {};
    for (const type of NOTIFICATION_TYPES) {
      const saved = savedPrefs?.find((p: any) => p.notificationType === type.key);
      initial[type.key] = {
        soundEnabled: saved ? Boolean(saved.soundEnabled) : false,
        popupEnabled: saved ? Boolean(saved.popupEnabled) : false,
      };
    }
    setPrefs(initial);
    setHasChanges(false);
  }, [savedPrefs]);

  const handleToggle = (typeKey: string, field: "soundEnabled" | "popupEnabled", value: boolean) => {
    setPrefs((prev) => ({
      ...prev,
      [typeKey]: { ...prev[typeKey], [field]: value },
    }));
    setHasChanges(true);
  };

  const handleToggleAllSound = (enabled: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev };
      for (const type of NOTIFICATION_TYPES) {
        next[type.key] = { ...next[type.key], soundEnabled: enabled };
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleToggleAllPopup = (enabled: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev };
      for (const type of NOTIFICATION_TYPES) {
        next[type.key] = { ...next[type.key], popupEnabled: enabled };
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const preferences = NOTIFICATION_TYPES.map((type) => ({
        notificationType: type.key,
        soundEnabled: prefs[type.key]?.soundEnabled ?? false,
        popupEnabled: prefs[type.key]?.popupEnabled ?? false,
      }));
      await updatePrefs.mutateAsync({ preferences });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3", "audio/x-wav"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg)$/i)) {
      toast.error(isRTL ? "يرجى رفع ملف صوتي (MP3, WAV, OGG)" : "Please upload an audio file (MP3, WAV, OGG)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? "حجم الملف يجب أن يكون أقل من 5 ميجابايت" : "File size must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadSound.mutateAsync({
          fileBase64: base64,
          fileName: file.name,
          contentType: file.type || "audio/mpeg",
        });
        setUploading(false);
      };
      reader.onerror = () => {
        toast.error(isRTL ? "فشل في قراءة الملف" : "Failed to read file");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const allSoundEnabled = NOTIFICATION_TYPES.every((t) => prefs[t.key]?.soundEnabled);
  const allPopupEnabled = NOTIFICATION_TYPES.every((t) => prefs[t.key]?.popupEnabled);

  return (
    <CRMLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: tokens.primaryColor + "20" }}>
              <Bell size={20} style={{ color: tokens.primaryColor }} />
            </div>
            <div>
              <h1 className="text-xl font-bold">{isRTL ? "إعدادات الإشعارات" : "Notification Settings"}</h1>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "تحكم في كيفية استقبال الإشعارات" : "Control how you receive notifications"}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{ background: hasChanges ? tokens.primaryColor : undefined }}
            className={hasChanges ? "text-white gap-2" : "gap-2"}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isRTL ? "حفظ" : "Save"}
          </Button>
        </div>

        {/* Quick Toggle All */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell size={15} />
              {isRTL ? "تحكم سريع" : "Quick Controls"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center justify-between flex-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <Volume2 size={16} className="text-blue-500" />
                  <span className="text-sm font-medium">{isRTL ? "كل الأصوات" : "All Sounds"}</span>
                </div>
                <Switch checked={allSoundEnabled} onCheckedChange={handleToggleAllSound} />
              </div>
              <div className="flex items-center justify-between flex-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <Monitor size={16} className="text-green-500" />
                  <span className="text-sm font-medium">{isRTL ? "كل النوافذ المنبثقة" : "All Popups"}</span>
                </div>
                <Switch checked={allPopupEnabled} onCheckedChange={handleToggleAllPopup} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-Type Settings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell size={15} />
                {isRTL ? "إعدادات حسب النوع" : "Settings by Type"}
              </CardTitle>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Volume2 size={12} />
                  {isRTL ? "صوت" : "Sound"}
                </div>
                <div className="flex items-center gap-1">
                  <Monitor size={12} />
                  {isRTL ? "نافذة" : "Popup"}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {NOTIFICATION_TYPES.map((type) => {
                const Icon = type.icon;
                const pref = prefs[type.key] ?? { soundEnabled: false, popupEnabled: false };
                return (
                  <div
                    key={type.key}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors"
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${type.bgColor}`}>
                      <Icon size={16} className={type.color} />
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {isRTL ? typeLabels[type.key].ar : typeLabels[type.key].en}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isRTL ? typeDescriptions[type.key].ar : typeDescriptions[type.key].en}
                      </p>
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={pref.soundEnabled}
                          onCheckedChange={(v) => handleToggle(type.key, "soundEnabled", v)}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {pref.soundEnabled ? (
                            <Volume2 size={10} className="text-blue-500" />
                          ) : (
                            <VolumeX size={10} className="text-muted-foreground/50" />
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={pref.popupEnabled}
                          onCheckedChange={(v) => handleToggle(type.key, "popupEnabled", v)}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          <Monitor size={10} className={pref.popupEnabled ? "text-green-500" : "text-muted-foreground/50"} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Custom Sound Upload - Only for primary admin */}
        {isPrimaryAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Music size={15} />
                {isRTL ? "صوت الإشعارات المخصص" : "Custom Notification Sound"}
                <Badge variant="outline" className="text-[10px] px-1.5">
                  {isRTL ? "الأدمن فقط" : "Admin Only"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? "ارفع ملف صوتي مخصص ليتم استخدامه كصوت إشعار لجميع أعضاء الفريق. الصيغ المدعومة: MP3, WAV, OGG (الحد الأقصى 5 ميجابايت)"
                  : "Upload a custom audio file to be used as the notification sound for all team members. Supported formats: MP3, WAV, OGG (max 5MB)"}
              </p>

              {/* Current Sound */}
              {soundConfig?.soundFileUrl && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
                    <CheckCircle size={16} className="text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{soundConfig.soundFileName ?? "Custom Sound"}</p>
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? "ملف صوت مخصص مفعّل" : "Custom sound file active"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => {
                        if (soundConfig.soundFileUrl) {
                          const audio = new Audio(soundConfig.soundFileUrl);
                          audio.play().catch(() => toast.error("Cannot play audio"));
                        }
                      }}
                    >
                      <Volume2 size={12} />
                      {isRTL ? "تشغيل" : "Play"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-destructive hover:text-destructive"
                      onClick={() => removeSound.mutate()}
                      disabled={removeSound.isPending}
                    >
                      <Trash2 size={12} />
                      {isRTL ? "حذف" : "Remove"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  {soundConfig?.soundFileUrl
                    ? (isRTL ? "تغيير ملف الصوت" : "Change Sound File")
                    : (isRTL ? "رفع ملف صوت" : "Upload Sound File")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">
                  {isRTL ? "ملاحظة" : "Note"}
                </p>
                <p className="text-xs opacity-80">
                  {isRTL
                    ? "يجب السماح بالإشعارات في متصفحك لتلقي النوافذ المنبثقة. إذا لم تظهر الإشعارات، تحقق من إعدادات المتصفح."
                    : "Browser notifications must be allowed to receive popups. If notifications don't appear, check your browser settings."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  EyeOff,
  Save,
  Sparkles,
  Key,
  Volume2,
  FileText,
  Settings,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function RakanSettingsTab() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isRTL = lang === "ar";
  const isAdmin = user?.role === "Admin";

  // ── State ──────────────────────────────────────────────────────────────────
  const [geminiKey, setGeminiKey] = useState("");
  const [ttsKey, setTtsKey] = useState("");
  const [instructions, setInstructions] = useState("");
  const [rakanEnabled, setRakanEnabled] = useState(true);
  const [rakanName, setRakanName] = useState("راكان");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showTtsKey, setShowTtsKey] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // User preferences (for all users)
  const [ttsVoicePref, setTtsVoicePref] = useState("ar_formal");
  const [ttsEnabledUser, setTtsEnabledUser] = useState(true);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: settings, refetch } = trpc.rakan.getSettings.useQuery();
  const { data: myPrefs, refetch: refetchPrefs } = trpc.rakan.getMyPreferences.useQuery();

  useEffect(() => {
    if (settings) {
      const g = settings.global;
      if (isAdmin) {
        setGeminiKey(g["gemini_api_key"] ?? "");
        setTtsKey(g["google_tts_api_key"] ?? "");
        setInstructions(g["rakan_instructions"] ?? "");
        setRakanEnabled(g["rakan_enabled"] !== "false");
        setRakanName(g["rakan_name"] ?? "راكان");
      }
    }
  }, [settings, isAdmin]);

  useEffect(() => {
    if (myPrefs) {
      setTtsVoicePref(myPrefs.ttsVoicePreference ?? "ar_formal");
      setTtsEnabledUser(myPrefs.ttsEnabled !== "false");
    }
  }, [myPrefs]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateGlobal = trpc.rakan.updateGlobalSetting.useMutation({
    onSuccess: () => { refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateUserPref = trpc.rakan.updateUserSetting.useMutation({
    onSuccess: () => { refetchPrefs(); },
    onError: (e) => toast.error(e.message),
  });

  // ── Save handlers ──────────────────────────────────────────────────────────
  const saveGeminiKey = async () => {
    setSaving("gemini");
    await updateGlobal.mutateAsync({ key: "gemini_api_key", value: geminiKey });
    setSaving(null);
    toast.success(isRTL ? "تم حفظ Gemini API Key" : "Gemini API Key saved");
  };

  const saveTtsKey = async () => {
    setSaving("tts");
    await updateGlobal.mutateAsync({ key: "google_tts_api_key", value: ttsKey });
    setSaving(null);
    toast.success(isRTL ? "تم حفظ Google TTS Key" : "Google TTS Key saved");
  };

  const saveInstructions = async () => {
    setSaving("instructions");
    await updateGlobal.mutateAsync({ key: "rakan_instructions", value: instructions });
    setSaving(null);
    toast.success(isRTL ? "تم حفظ التعليمات" : "Instructions saved");
  };

  const saveRakanEnabled = async (val: boolean) => {
    setRakanEnabled(val);
    await updateGlobal.mutateAsync({ key: "rakan_enabled", value: String(val) });
    toast.success(val
      ? (isRTL ? "تم تفعيل راكان" : "Rakan enabled")
      : (isRTL ? "تم تعطيل راكان" : "Rakan disabled")
    );
  };

  const saveRakanName = async () => {
    setSaving("name");
    await updateGlobal.mutateAsync({ key: "rakan_name", value: rakanName });
    setSaving(null);
    toast.success(isRTL ? "تم حفظ الاسم" : "Name saved");
  };

  const saveUserTtsVoice = async (val: string) => {
    setTtsVoicePref(val);
    await updateUserPref.mutateAsync({ key: "tts_voice_preference", value: val });
    toast.success(isRTL ? "تم حفظ تفضيل الصوت" : "Voice preference saved");
  };

  const saveUserTtsEnabled = async (val: boolean) => {
    setTtsEnabledUser(val);
    await updateUserPref.mutateAsync({ key: "tts_enabled", value: String(val) });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">{isRTL ? "إعدادات راكان" : "Rakan Settings"}</h2>
          <p className="text-sm text-muted-foreground">
            {isRTL ? "مساعدك الذكي المدمج في النظام" : "Your AI assistant integrated into the CRM"}
          </p>
        </div>
        <Badge variant={rakanEnabled ? "default" : "secondary"} className="mr-auto">
          {rakanEnabled ? (isRTL ? "مفعّل" : "Active") : (isRTL ? "معطّل" : "Disabled")}
        </Badge>
      </div>

      {/* ── ADMIN ONLY SECTION ──────────────────────────────────────────────── */}
      {isAdmin && (
        <>
          {/* Enable/Disable */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings size={15} />
                {isRTL ? "التحكم العام" : "Global Control"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">{isRTL ? "تفعيل راكان" : "Enable Rakan"}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL ? "تفعيل أو تعطيل راكان لجميع المستخدمين" : "Enable or disable Rakan for all users"}
                  </p>
                </div>
                <Switch checked={rakanEnabled} onCheckedChange={saveRakanEnabled} />
              </div>
              <Separator />
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs mb-1.5 block">{isRTL ? "اسم المساعد" : "Assistant Name"}</Label>
                  <Input
                    value={rakanName}
                    onChange={(e) => setRakanName(e.target.value)}
                    placeholder="راكان"
                    dir="auto"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={saveRakanName}
                  disabled={saving === "name"}
                  className="gap-1.5"
                >
                  <Save size={13} />
                  {isRTL ? "حفظ" : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Key size={15} className="text-amber-500" />
                {isRTL ? "مفاتيح API (للمدير فقط)" : "API Keys (Admin Only)"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isRTL
                  ? "هذه المفاتيح مخفية عن باقي المستخدمين"
                  : "These keys are hidden from other users"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Gemini */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Gemini API Key
                  {geminiKey && <CheckCircle2 size={12} className="text-green-500" />}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showGeminiKey ? "text" : "password"}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIza..."
                      className="pr-10"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={saveGeminiKey}
                    disabled={saving === "gemini"}
                    className="gap-1.5"
                  >
                    <Save size={13} />
                    {isRTL ? "حفظ" : "Save"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isRTL
                    ? "احصل على المفتاح من Google AI Studio - مجاني"
                    : "Get your key from Google AI Studio - Free tier available"}
                </p>
              </div>

              <Separator />

              {/* Google TTS */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Google TTS API Key
                  {ttsKey
                    ? <CheckCircle2 size={12} className="text-green-500" />
                    : <AlertCircle size={12} className="text-amber-500" />
                  }
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showTtsKey ? "text" : "password"}
                      value={ttsKey}
                      onChange={(e) => setTtsKey(e.target.value)}
                      placeholder="AIza..."
                      className="pr-10"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTtsKey(!showTtsKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showTtsKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={saveTtsKey}
                    disabled={saving === "tts"}
                    className="gap-1.5"
                  >
                    <Save size={13} />
                    {isRTL ? "حفظ" : "Save"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isRTL
                    ? "مطلوب لميزة الصوت - اختياري"
                    : "Required for voice feature - Optional"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText size={15} className="text-purple-500" />
                {isRTL ? "تعليمات راكان (للمدير فقط)" : "Rakan Instructions (Admin Only)"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isRTL
                  ? "حدد شخصية راكان وأسلوبه وتعليماته الخاصة"
                  : "Define Rakan's personality, style, and custom instructions"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={8}
                placeholder={isRTL
                  ? "أنت راكان، مساعد ذكاء اصطناعي متخصص في نظام CRM..."
                  : "You are Rakan, an AI assistant specialized in CRM..."
                }
                className="text-sm resize-none"
                dir="auto"
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  {instructions.length} {isRTL ? "حرف" : "chars"}
                </p>
                <Button
                  size="sm"
                  onClick={saveInstructions}
                  disabled={saving === "instructions"}
                  className="gap-1.5"
                >
                  <Save size={13} />
                  {isRTL ? "حفظ التعليمات" : "Save Instructions"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── ALL USERS SECTION ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume2 size={15} />
            {isRTL ? "تفضيلات الصوت الشخصية" : "Personal Voice Preferences"}
          </CardTitle>
          <CardDescription className="text-xs">
            {isRTL ? "هذه الإعدادات خاصة بك فقط" : "These settings apply only to you"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TTS toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium text-sm">{isRTL ? "تفعيل الصوت" : "Enable Voice"}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRTL ? "راكان يرد بصوت مسموع" : "Rakan responds with audio"}
              </p>
            </div>
            <Switch
              checked={ttsEnabledUser}
              onCheckedChange={saveUserTtsEnabled}
            />
          </div>

          {ttsEnabledUser && (
            <>
              <Separator />
              {/* Voice selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{isRTL ? "نوع الصوت" : "Voice Type"}</Label>
                <Select value={ttsVoicePref} onValueChange={saveUserTtsVoice}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar_formal">
                      {isRTL ? "🎙️ عربي فصيح" : "🎙️ Formal Arabic"}
                    </SelectItem>
                    <SelectItem value="ar_egyptian">
                      {isRTL ? "🎙️ عربي مصري" : "🎙️ Egyptian Arabic"}
                    </SelectItem>
                    <SelectItem value="ar_gulf">
                      {isRTL ? "🎙️ عربي خليجي" : "🎙️ Gulf Arabic"}
                    </SelectItem>
                    <SelectItem value="en">
                      {isRTL ? "🎙️ إنجليزي" : "🎙️ English"}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {isRTL
                    ? "راكان يكتشف لغة الرد تلقائياً ويستخدم الصوت المناسب"
                    : "Rakan auto-detects reply language and uses the appropriate voice"}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Info for non-admins */}
      {!isAdmin && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <p>
            {isRTL
              ? "إعدادات API والتعليمات متاحة للمدير فقط. تواصل مع المدير لتكوين راكان."
              : "API settings and instructions are available to admins only. Contact your admin to configure Rakan."}
          </p>
        </div>
      )}
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, Globe, Lock, Mail } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

/* ─── Inline keyframes (injected once) ─── */
const STYLE_ID = "tamiyouz-login-animations";
function injectStyles(primary: string, accent: string) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes tmz-fadeSlideUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes tmz-fadeSlideDown {
      from { opacity: 0; transform: translateY(-18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes tmz-fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes tmz-shimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes tmz-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-6px); }
    }
    @keyframes tmz-badgeFade {
      0%, 40%   { opacity: 1; }
      50%       { opacity: 0; }
      60%, 100% { opacity: 1; }
    }
    @keyframes tmz-orb1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33%      { transform: translate(30px, -20px) scale(1.05); }
      66%      { transform: translate(-15px, 15px) scale(0.97); }
    }
    @keyframes tmz-orb2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33%      { transform: translate(-25px, 20px) scale(0.95); }
      66%      { transform: translate(20px, -10px) scale(1.03); }
    }
    @keyframes tmz-pulse {
      0%, 100% { opacity: 0.15; }
      50%      { opacity: 0.25; }
    }

    /* Respect reduced motion */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    .tmz-logo-reveal {
      animation: tmz-fadeSlideDown 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .tmz-headline-reveal {
      animation: tmz-fadeSlideUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
    }
    .tmz-badge-reveal {
      animation: tmz-fadeIn 0.7s ease 0.5s both;
    }
    .tmz-form-reveal {
      animation: tmz-fadeSlideUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
    }
    .tmz-shimmer-text {
      background: linear-gradient(
        90deg,
        rgba(255,255,255,0.85) 0%,
        rgba(255,255,255,1) 40%,
        rgba(255,255,255,0.85) 60%,
        rgba(255,255,255,0.7) 100%
      );
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: tmz-shimmer 4s linear infinite;
    }
    .tmz-float {
      animation: tmz-float 4s ease-in-out infinite;
    }
    .tmz-lang-btn {
      backdrop-filter: blur(8px);
      transition: all 0.25s ease;
    }
    .tmz-lang-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .tmz-lang-btn:focus-visible {
      outline: 2px solid white;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

/* ─── Animated Badge Component ─── */
function AnimatedBadge({ primary, accent }: { primary: string; accent: string }) {
  const [showAr, setShowAr] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setShowAr((v) => !v), 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="inline-flex items-center gap-2 px-5 py-2 rounded-full tmz-badge-reveal"
      style={{
        background: `${accent}22`,
        border: `1px solid ${accent}44`,
      }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{ background: accent, animation: "tmz-pulse 2s ease-in-out infinite" }}
      />
      <span
        className="text-sm font-semibold relative overflow-hidden"
        style={{ color: "white", minWidth: "70px", textAlign: "center" }}
      >
        <span
          key={showAr ? "ar" : "en"}
          style={{
            display: "inline-block",
            animation: "tmz-fadeIn 0.5s ease both",
          }}
        >
          {showAr ? "تميز" : "Tamiyouz"}
        </span>
      </span>
    </div>
  );
}

/* ─── Main Login Component ─── */
export default function Login() {
  const { isAuthenticated, loading, refresh } = useAuth();
  const { t, lang, setLang, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    injectStyles(tokens.primaryColor, tokens.accentColor);
  }, [tokens.primaryColor, tokens.accentColor]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [loading, isAuthenticated]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم تسجيل الدخول بنجاح" : "Logged in successfully");
      await refresh?.();
      navigate("/dashboard");
    },
    onError: () => {
      toast.error(
        isRTL
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
          : "Invalid email or password"
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error(
        isRTL
          ? "يرجى إدخال البريد الإلكتروني وكلمة المرور"
          : "Please enter email and password"
      );
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
  };

  const primary = tokens.primaryColor;
  const accent = tokens.accentColor;

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      dir={isRTL ? "rtl" : "ltr"}
      style={{ fontFamily: `${tokens.fontFamily}, Cairo, sans-serif` }}
    >
      {/* ═══════════════ Branding Panel ═══════════════ */}
      <div
        className="relative w-full lg:w-[55%] flex flex-col items-center justify-center px-8 py-16 lg:py-0 overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${primary} 0%, #0c1f3a 60%, #091428 100%)`,
        }}
      >
        {/* Ambient orbs */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{
            background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
            top: "-10%",
            left: "-10%",
            animation: "tmz-orb1 12s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05]"
          style={{
            background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
            bottom: "-5%",
            right: "-5%",
            animation: "tmz-orb2 10s ease-in-out infinite",
          }}
        />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Language Toggle - top corner */}
        <div className="absolute top-6 left-6 z-20">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="tmz-lang-btn flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{
              background: "rgba(255,255,255,0.12)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <Globe size={15} />
            {lang === "ar" ? "English" : "العربية"}
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
          {/* Logo + تميز */}
          <div className="tmz-logo-reveal tmz-float flex flex-col items-center mb-10">
            {tokens.logoUrl ? (
              <img
                src={tokens.logoUrl}
                alt="Tamiyouz"
                className="h-20 w-auto mb-4 drop-shadow-lg"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mb-4 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  boxShadow: `0 8px 32px ${accent}44`,
                }}
              >
                ت
              </div>
            )}
            <h1 className="tmz-shimmer-text text-4xl lg:text-5xl font-extrabold tracking-tight">
              تميز
            </h1>
          </div>

          {/* Headline */}
          <div className="tmz-headline-reveal mb-8">
            <h2
              className="text-2xl lg:text-3xl font-bold leading-relaxed"
              style={{ color: "rgba(255,255,255,0.95)" }}
            >
              {lang === "ar"
                ? "إدارة عملائك بكفاءة عالية"
                : "Manage your clients efficiently"}
            </h2>
            <p
              className="mt-4 text-lg lg:text-xl font-medium italic"
              style={{ color: "rgba(255,255,255,0.70)" }}
            >
              {lang === "ar"
                ? "\"التميز ليس مهارة, بل موقف\""
                : "\"Excellence is not a skill, it is an attitude\""}
            </p>
          </div>

          {/* Animated Badge */}
          <AnimatedBadge primary={primary} accent={accent} />
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 text-center z-10">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Tamiyouz. All rights reserved.
          </p>
        </div>
      </div>

      {/* ═══════════════ Login Form Panel ═══════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:py-0 bg-background relative">
        {/* Mobile Language Toggle (shown only on small screens) */}
        <div className="lg:hidden absolute top-4 left-4">
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors"
          >
            <Globe size={13} />
            {lang === "ar" ? "English" : "العربية"}
          </button>
        </div>

        {/* Mobile Logo (shown only on small screens when branding panel is hidden) */}
        <div className="lg:hidden mb-8 flex flex-col items-center tmz-logo-reveal">
          {tokens.logoUrl ? (
            <img src={tokens.logoUrl} alt="Tamiyouz" className="h-14 w-auto mb-2" />
          ) : (
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-2"
              style={{ background: primary }}
            >
              ت
            </div>
          )}
          <span className="text-xl font-bold text-foreground">تميز</span>
        </div>

        <div className="w-full max-w-sm space-y-6 tmz-form-reveal">
          {/* Welcome */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {t("welcomeBack")}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {lang === "ar"
                ? "أدخل بياناتك للدخول إلى حسابك"
                : "Enter your credentials to access your account"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                {lang === "ar" ? "البريد الإلكتروني" : "Email Address"}
              </Label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute top-1/2 -translate-y-1/2 text-muted-foreground"
                  style={{ [isRTL ? "right" : "left"]: "12px" }}
                />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className={`h-11 ${isRTL ? "pr-10" : "pl-10"}`}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                {lang === "ar" ? "كلمة المرور" : "Password"}
              </Label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute top-1/2 -translate-y-1/2 text-muted-foreground"
                  style={{ [isRTL ? "right" : "left"]: "12px" }}
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    lang === "ar" ? "أدخل كلمة المرور" : "Enter your password"
                  }
                  className={`h-11 ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}`}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  style={{ [isRTL ? "left" : "right"]: "12px" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className={`text-${isRTL ? "left" : "right"}`}>
              <Link href="/forgot-password">
                <button
                  type="button"
                  className="text-xs font-medium hover:underline transition-colors"
                  style={{ color: primary }}
                >
                  {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                </button>
              </Link>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold text-white transition-all hover:shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${primary}, ${primary}dd)`,
                boxShadow: `0 4px 14px ${primary}33`,
              }}
              disabled={loginMutation.isPending || loading}
            >
              {loginMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : lang === "ar" ? (
                "تسجيل الدخول"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {lang === "ar"
              ? "للحصول على حساب، تواصل مع مدير النظام"
              : "To get an account, contact your system administrator"}
          </p>
        </div>

        {/* Bottom branding */}
        <div className="mt-12 text-center">
          <p className="text-sm font-semibold text-foreground">تميز</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === "ar"
              ? "نظام إدارة علاقات العملاء"
              : "Customer Relationship Management"}
          </p>
        </div>
      </div>
    </div>
  );
}

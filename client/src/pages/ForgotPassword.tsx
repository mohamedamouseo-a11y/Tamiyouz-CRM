import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function ForgotPassword() {
  const { lang, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const forgotMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: (data) => {
      setSent(true);
      if (data.resetUrl) {
        setDevResetUrl(data.resetUrl);
      }
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    forgotMutation.mutate({ email: email.trim(), origin: window.location.origin });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-6"
      dir={isRTL ? "rtl" : "ltr"}
      style={{ fontFamily: `${tokens.fontFamily}, Cairo, sans-serif` }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          {tokens.logoUrl ? (
            <img src={tokens.logoUrl} alt="Logo" className="h-12 w-auto mx-auto mb-3" />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-3"
              style={{ background: tokens.primaryColor }}
            >
              ت
            </div>
          )}
          <h1 className="text-xl font-bold text-foreground">
            {lang === "ar" ? tokens.appNameAr : tokens.appName}
          </h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          {!sent ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">
                  {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {lang === "ar"
                    ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"
                    : "Enter your email and we'll send you a reset link"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">
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
                      className={isRTL ? "pr-10" : "pl-10"}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 font-semibold text-white"
                  style={{ background: tokens.primaryColor }}
                  disabled={forgotMutation.isPending}
                >
                  {forgotMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    lang === "ar" ? "إرسال رابط الإعادة" : "Send Reset Link"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: `${tokens.successColor}20` }}
              >
                <CheckCircle size={32} style={{ color: tokens.successColor }} />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {lang === "ar" ? "تم الإرسال!" : "Email Sent!"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {lang === "ar"
                  ? `إذا كان البريد الإلكتروني ${email} مسجلاً، ستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور خلال دقائق.`
                  : `If ${email} is registered, you'll receive a password reset link within minutes.`}
              </p>

              {/* Dev mode: show reset URL directly */}
              {devResetUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                  <p className="text-xs font-semibold text-amber-700 mb-2">
                    🔧 {lang === "ar" ? "وضع التطوير — رابط الإعادة المباشر:" : "Dev Mode — Direct Reset Link:"}
                  </p>
                  <a
                    href={devResetUrl}
                    className="text-xs text-blue-600 break-all underline"
                  >
                    {devResetUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/login">
              <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mx-auto transition-colors">
                <ArrowLeft size={14} className={isRTL ? "rotate-180" : ""} />
                {lang === "ar" ? "العودة إلى تسجيل الدخول" : "Back to Login"}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

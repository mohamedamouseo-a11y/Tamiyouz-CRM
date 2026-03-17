import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { trpc } from "@/lib/trpc";
import { CheckCircle, Eye, EyeOff, Lock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function ResetPassword() {
  const { lang, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const [, navigate] = useLocation();

  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
    } else {
      setTokenError(true);
    }
  }, []);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      toast.success(isRTL ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully");
      setTimeout(() => navigate("/login"), 2500);
    },
    onError: (e) => {
      toast.error(e.message);
      if (e.message.includes("expired") || e.message.includes("Invalid")) {
        setTokenError(true);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error(isRTL ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    resetMutation.mutate({ token, newPassword });
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
          {tokenError ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <XCircle size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {lang === "ar" ? "رابط غير صالح" : "Invalid Link"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {lang === "ar"
                  ? "رابط إعادة التعيين غير صالح أو انتهت صلاحيته. يرجى طلب رابط جديد."
                  : "This reset link is invalid or has expired. Please request a new one."}
              </p>
              <Link href="/forgot-password">
                <Button className="w-full text-white" style={{ background: tokens.primaryColor }}>
                  {lang === "ar" ? "طلب رابط جديد" : "Request New Link"}
                </Button>
              </Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: `${tokens.successColor}20` }}
              >
                <CheckCircle size={32} style={{ color: tokens.successColor }} />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {lang === "ar" ? "تم تغيير كلمة المرور!" : "Password Changed!"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {lang === "ar"
                  ? "تم تغيير كلمة المرور بنجاح. سيتم تحويلك إلى صفحة تسجيل الدخول..."
                  : "Your password has been changed successfully. Redirecting to login..."}
              </p>
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: tokens.primaryColor }} />
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">
                  {lang === "ar" ? "تعيين كلمة مرور جديدة" : "Set New Password"}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {lang === "ar"
                    ? "أدخل كلمة المرور الجديدة (6 أحرف على الأقل)"
                    : "Enter your new password (at least 6 characters)"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">
                    {lang === "ar" ? "كلمة المرور الجديدة" : "New Password"}
                  </Label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute top-1/2 -translate-y-1/2 text-muted-foreground"
                      style={{ [isRTL ? "right" : "left"]: "12px" }}
                    />
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={lang === "ar" ? "أدخل كلمة المرور الجديدة" : "Enter new password"}
                      className={isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      style={{ [isRTL ? "left" : "right"]: "12px" }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">
                    {lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
                  </Label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute top-1/2 -translate-y-1/2 text-muted-foreground"
                      style={{ [isRTL ? "right" : "left"]: "12px" }}
                    />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={lang === "ar" ? "أعد إدخال كلمة المرور" : "Re-enter password"}
                      className={isRTL ? "pr-10" : "pl-10"}
                      required
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">
                      {lang === "ar" ? "كلمتا المرور غير متطابقتين" : "Passwords do not match"}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 font-semibold text-white"
                  style={{ background: tokens.primaryColor }}
                  disabled={resetMutation.isPending || newPassword !== confirmPassword}
                >
                  {resetMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    lang === "ar" ? "تغيير كلمة المرور" : "Change Password"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

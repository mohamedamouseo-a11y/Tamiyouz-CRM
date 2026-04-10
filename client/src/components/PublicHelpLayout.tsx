import { Globe, HelpCircle, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

interface Props {
  children: React.ReactNode;
  lang: "ar" | "en";
  currentSlug?: string | null;
}

export default function PublicHelpLayout({ children, lang, currentSlug }: Props) {
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const [, navigate] = useLocation();

  const switchLang = (target: "ar" | "en") => {
    const base = target === "ar" ? "/ar/help-center" : "/en/help-center";
    navigate(currentSlug ? `${base}/${currentSlug}` : base);
  };

  return (
    <div className="min-h-screen bg-slate-50" dir={dir} lang={lang}>
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <Link
            href={isAr ? "/ar/help-center" : "/en/help-center"}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm">
              <HelpCircle size={16} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 leading-none">
                Tamiyouz CRM
              </p>
              <p className="text-sm font-bold text-slate-900 leading-tight">
                {isAr ? "مركز المساعدة" : "Help Center"}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              <button
                onClick={() => switchLang("ar")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isAr
                    ? "bg-white shadow-sm text-blue-700 font-semibold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                }`}
              >
                <Globe size={11} />
                العربية
              </button>
              <button
                onClick={() => switchLang("en")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  !isAr
                    ? "bg-white shadow-sm text-blue-700 font-semibold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                }`}
              >
                <Globe size={11} />
                English
              </button>
            </div>

            <a
              href="mailto:support@tamiyouz.com"
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-800 transition-colors px-2 py-1"
            >
              <Mail size={13} />
              support@tamiyouz.com
            </a>

            <Button asChild size="sm" className="h-8 text-xs gap-1.5">
              <Link href="/login">
                <LogIn size={13} />
                {isAr ? "تسجيل الدخول" : "Login"}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {isAr
              ? `© ${new Date().getFullYear()} Tamiyouz — جميع الحقوق محفوظة`
              : `© ${new Date().getFullYear()} Tamiyouz — All rights reserved`}
          </span>
          <a href="mailto:support@tamiyouz.com" className="hover:text-slate-800 transition-colors">
            support@tamiyouz.com
          </a>
        </div>
      </footer>
    </div>
  );
}

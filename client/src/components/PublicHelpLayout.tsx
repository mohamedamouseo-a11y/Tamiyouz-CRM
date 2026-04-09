import { HelpCircle, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface Props {
  children: React.ReactNode;
}

export default function PublicHelpLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Public header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          {/* Logo / Title */}
          <Link href="/help-center" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm">
              <HelpCircle size={16} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 leading-none">
                Tamiyouz CRM
              </p>
              <p className="text-sm font-bold text-slate-900 leading-tight">مركز المساعدة</p>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
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
                تسجيل الدخول
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Tamiyouz — جميع الحقوق محفوظة</span>
          <a href="mailto:support@tamiyouz.com" className="hover:text-slate-800 transition-colors">
            support@tamiyouz.com
          </a>
        </div>
      </footer>
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  Globe,
  HelpCircle,
  Inbox,
  LifeBuoy,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Trash2,
  Users,
  X,
  Zap,
  Calendar,
  Filter,
  Activity,
  Moon,
  Sun,
  ChevronUp,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import NotificationCenter from "@/components/NotificationCenter";
import SLAAlertBell from "@/components/SLAAlertBell";
import RakanWidget from "@/components/RakanWidget";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: number;
  visible?: boolean;
}

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const { t, lang, setLang, isRTL } = useLanguage();
  const { tokens } = useThemeTokens();
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarNavRef = useRef<HTMLElement>(null);
  const sidebarScrollPos = useRef(0);

  // Preserve sidebar scroll position across navigations
  const handleNavScroll = useCallback(() => {
    if (sidebarNavRef.current) {
      sidebarScrollPos.current = sidebarNavRef.current.scrollTop;
    }
  }, []);

  useEffect(() => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.scrollTop = sidebarScrollPos.current;
    }
  });

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/login"; },
  });

  // SLA badge count
  const { data: slaLeads } = trpc.leads.list.useQuery(
    { slaBreached: true, limit: 1 },
    { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const role = user?.role ?? "SalesAgent";

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      labelKey: "dashboard",
      icon: <LayoutDashboard size={18} />,
      roles: ["Admin", "admin", "SalesManager", "SalesAgent", "MediaBuyer"],
    },
    {
      href: "/inbox",
      labelKey: "inbox",
      icon: <Inbox size={18} />,
      roles: ["Admin", "admin", "SalesManager", "SalesAgent", "MediaBuyer", "AccountManager", "AccountManagerLead"],
    },
    {
      href: "/team-dashboard",
      labelKey: "teamDashboard",
      icon: <BarChart3 size={18} />,
      roles: ["Admin", "SalesManager", "admin"],
    },
    {
      href: "/sales-funnel",
      labelKey: "salesFunnel",
      icon: <Filter size={18} />,
      roles: ["Admin", "SalesManager", "admin", "SalesAgent"],
    },
    {
      href: "/task-sla",
      labelKey: "taskSla",
      icon: <ClipboardList size={18} />,
      roles: ["Admin", "SalesManager", "admin", "SalesAgent"],
    },
    {
      href: "/leads",
      labelKey: "leads",
      icon: <Users size={18} />,
      badge: slaLeads?.total && slaLeads.total > 0 ? slaLeads.total : undefined,
      roles: ["Admin", "admin", "SalesManager", "SalesAgent", "MediaBuyer"],
    },
    {
      href: "/campaigns",
      labelKey: "campaigns",
      icon: <Megaphone size={18} />,
      roles: ["Admin", "admin", "SalesManager", "SalesAgent", "MediaBuyer"],
    },
    {
      href: "/campaign-analytics",
      labelKey: "campaignAnalytics",
      icon: <BarChart3 size={18} />,
      roles: ["Admin", "SalesManager", "admin", "MediaBuyer"],
    },
    {
      href: "/meta-campaigns",
      labelKey: "metaCampaigns",
      icon: <Megaphone size={18} />,
      roles: ["Admin", "admin", "MediaBuyer"],
    },
    {
      href: "/meta-combined",
      labelKey: "metaCombinedAnalytics",
      icon: <Activity size={18} />,
      roles: ["Admin", "admin", "MediaBuyer"],
    },
    {
      href: "/tiktok-campaigns",
      labelKey: "tiktokCampaigns",
      icon: <Activity size={18} />,
      roles: ["Admin", "admin", "MediaBuyer"],
    },
    {
      href: "/calendar",
      labelKey: "calendar",
      icon: <Calendar size={18} />,
      roles: ["Admin", "admin", "SalesManager", "SalesAgent", "MediaBuyer"],
    },
    {
      href: "/am-dashboard",
      labelKey: "amDashboard",
      icon: <Zap size={18} />,
      roles: ["Admin", "admin", "AccountManager", "AccountManagerLead"],
    },
    {
      href: "/am-calendar",
      labelKey: "amCalendar",
      icon: <Calendar size={18} />,
      roles: ["Admin", "admin", "AccountManager", "AccountManagerLead"],
    },
    {
      href: "/clients",
      labelKey: "clientPool",
      icon: <Briefcase size={18} />,
      roles: ["Admin", "admin", "AccountManager", "AccountManagerLead", "SalesManager"],
    },
    {
      href: "/renewals",
      labelKey: "renewals",
      icon: <Activity size={18} />,
      roles: ["Admin", "admin", "AccountManager", "AccountManagerLead"],
    },
    {
      href: "/am-lead-dashboard",
      labelKey: "teamPerformance",
      icon: <BarChart3 size={18} />,
      roles: ["Admin", "admin", "AccountManagerLead"],
    },
    {
      href: "/import",
      labelKey: "importLeads",
      icon: <FileSpreadsheet size={18} />,
      roles: ["Admin", "admin"],
    },
    {
      href: "/trash",
      labelKey: "trash",
      icon: <Trash2 size={18} />,
      roles: ["Admin", "admin"],
    },
    {
      href: "/audit-log",
      labelKey: "auditLog",
      icon: <ClipboardList size={18} />,
      roles: ["Admin", "admin"],
    },
    {
      href: "/settings",
      labelKey: "settings",
      icon: <Settings size={18} />,
      roles: ["Admin", "admin", "SalesManager", "SalesAgent", "MediaBuyer", "AccountManager", "AccountManagerLead"],
    },
    {
      href: "/support-center",
      labelKey: "supportCenter",
      icon: <LifeBuoy size={18} />,
    },
    {
      href: "/support-center/admin",
      labelKey: "supportAdmin",
      icon: <Inbox size={18} />,
      visible: String(user?.email ?? "").toLowerCase() === "admin@tamiyouz.com",
    },
  ];

  const visibleNavItems = navItems.filter(
    (item) => (item.visible ?? true) && (!item.roles || item.roles.includes(role))
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border/50" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${tokens.primaryColor} 8%, transparent), transparent)` }}>
        {tokens.logoUrl ? (
          <img src={tokens.logoUrl} alt="Logo" className="h-9 w-auto drop-shadow-sm" />
        ) : (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
            style={{ background: `linear-gradient(135deg, ${tokens.accentColor}, ${tokens.primaryColor})`, boxShadow: `0 4px 14px color-mix(in srgb, ${tokens.primaryColor} 40%, transparent)` }}
          >
            T
          </div>
        )}
        {sidebarOpen && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sidebar-foreground text-sm leading-tight truncate">
              {lang === "ar" ? tokens.appNameAr : tokens.appName}
            </span>
            <span className="text-[11px] text-sidebar-foreground/50 truncate">{t("tagline")}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav ref={sidebarNavRef} onScroll={handleNavScroll} className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleNavItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href + "/") && !visibleNavItems.some(other => other.href !== item.href && other.href.startsWith(item.href) && (location === other.href || location.startsWith(other.href + "/"))));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200",
                  isActive
                    ? "text-white shadow-md"
                    : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                  !sidebarOpen && "justify-center px-2"
                )}
                style={isActive ? {
                  background: `linear-gradient(135deg, ${tokens.primaryColor}, color-mix(in srgb, ${tokens.primaryColor} 75%, ${tokens.accentColor}))`,
                  boxShadow: `0 4px 12px color-mix(in srgb, ${tokens.primaryColor} 35%, transparent)`
                } : {}}
                onClick={() => setMobileOpen(false)}
              >
                {/* Active left indicator bar */}
                {!isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-5 rounded-full transition-all duration-200" style={{ background: tokens.primaryColor }} />
                )}
                <span className={cn(
                  "shrink-0 transition-all duration-200",
                  isActive ? "text-white" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
                  isActive && "drop-shadow-sm"
                )}>{item.icon}</span>
                {sidebarOpen && (
                  <span className="flex-1 truncate">{t(item.labelKey as any)}</span>
                )}
                {sidebarOpen && item.badge && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4.5 font-semibold shadow-sm">
                    {item.badge}
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t border-sidebar-border/50 p-3" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${tokens.primaryColor} 5%, transparent), transparent)` }}>
        <div className={cn("flex items-center gap-2.5", !sidebarOpen && "justify-center")}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md"
            style={{
              background: `linear-gradient(135deg, ${tokens.primaryColor}, ${tokens.accentColor})`,
              boxShadow: `0 3px 10px color-mix(in srgb, ${tokens.primaryColor} 35%, transparent)`
            }}
          >
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-sm font-semibold truncate leading-tight">{user?.name}</p>
              <p className="text-sidebar-foreground/50 text-[11px] truncate">{t(role as any)}</p>
            </div>
          )}
          {sidebarOpen && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground rounded-lg transition-all"
                >
                  <ChevronUp size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-48">
                <DropdownMenuItem onClick={() => logout.mutate()} className="text-red-500 focus:text-red-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

    </div>
  );

  return (
    <>
    <div className="flex h-screen bg-background overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar transition-all duration-300 shrink-0",
          sidebarOpen ? "w-60" : "w-16"
        )}
      >
        <SidebarContent />
        {/* Collapse Toggle */}
        <button
          className={cn(
            "absolute top-20 z-10 w-5 h-5 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:scale-110 transition-all",
            isRTL
              ? sidebarOpen ? "left-[14.5rem]" : "left-[3.5rem]"
              : sidebarOpen ? "right-[-0.625rem]" : "right-[-0.625rem]"
          )}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {isRTL
            ? sidebarOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />
            : sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside
            className={cn(
              "absolute top-0 h-full w-64 bg-sidebar flex flex-col shadow-2xl",
              isRTL ? "right-0" : "left-0"
            )}
            style={{ animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            {/* Help Center */}
            <Link href="/help-center">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all duration-200" title={t("helpCenter" as any)}>
                <HelpCircle size={17} strokeWidth={1.8} />
              </Button>
            </Link>

            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all duration-200"
              onClick={toggleTheme}
              title={theme === "dark" ? "Light Mode" : "Dark Mode"}
            >
              {theme === "dark" ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
            </Button>

            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary gap-1.5 text-xs font-medium transition-all duration-200"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            >
              <Globe size={15} strokeWidth={1.8} />
              {lang === "ar" ? "EN" : "عربي"}
            </Button>

            {/* Notification Center */}
            <NotificationCenter isRTL={isRTL} primaryColor={tokens.primaryColor} />

            {/* SLA Alert Bell */}
            {slaLeads && slaLeads.total > 0 && (
              <SLAAlertBell isRTL={isRTL} total={slaLeads.total} />
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-transition">
            {children}
          </div>
        </main>
      </div>
    </div>
    {/* Rakan AI Widget */}
    <RakanWidget />
    </>
  );
}

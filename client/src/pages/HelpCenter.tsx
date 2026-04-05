import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import CRMLayout from "@/components/CRMLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeTokens } from "@/contexts/ThemeTokenContext";
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, Brain, CalendarClock,
  ChevronDown, ChevronUp, ClipboardList, DatabaseZap, FileUser, Filter,
  Gauge, Globe, Handshake, HardDriveDownload, HelpCircle, KeyRound,
  Languages, LayoutDashboard, LifeBuoy, Link2, LocateFixed, Megaphone,
  MessagesSquare, MoonStar, Music2, PlugZap, Presentation, RefreshCw,
  Rocket, Rows3, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, UserRound, Users, X, BookOpen, Mail, Phone, MessageCircle,
  CreditCard
} from "lucide-react";


const ICON: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="h-5 w-5" />,
  LayoutDashboard: <LayoutDashboard className="h-5 w-5" />,
  Settings2: <Settings2 className="h-5 w-5" />,
  ShieldCheck: <ShieldCheck className="h-5 w-5" />,
  DatabaseZap: <DatabaseZap className="h-5 w-5" />,
  HardDriveDownload: <HardDriveDownload className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Handshake: <Handshake className="h-5 w-5" />,
  Funnel: <Filter className="h-5 w-5" />,
  CalendarClock: <CalendarClock className="h-5 w-5" />,
  RefreshCw: <RefreshCw className="h-5 w-5" />,
  UserRound: <UserRound className="h-5 w-5" />,
  FileUser: <FileUser className="h-5 w-5" />,
  Megaphone: <Megaphone className="h-5 w-5" />,
  Facebook: <Globe className="h-5 w-5" />,
  Music2: <Music2 className="h-5 w-5" />,
  BarChart3: <BarChart3 className="h-5 w-5" />,
  Link2: <Link2 className="h-5 w-5" />,
  PlugZap: <PlugZap className="h-5 w-5" />,
  Presentation: <Presentation className="h-5 w-5" />,
  ClipboardList: <ClipboardList className="h-5 w-5" />,
  BarChartBig: <BarChart3 className="h-5 w-5" />,
  Gauge: <Gauge className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  Brain: <Brain className="h-5 w-5" />,
  MessagesSquare: <MessagesSquare className="h-5 w-5" />,
  SlidersHorizontal: <SlidersHorizontal className="h-5 w-5" />,
  Rows3: <Rows3 className="h-5 w-5" />,
  LocateFixed: <LocateFixed className="h-5 w-5" />,
  Bell: <Bell className="h-5 w-5" />,
  MoonStar: <MoonStar className="h-5 w-5" />,
  Languages: <Languages className="h-5 w-5" />,
  KeyRound: <KeyRound className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
};
const getIcon = (name: string) => ICON[name] || <HelpCircle className="h-5 w-5" />;


interface Article {
  id: string;
  categoryId: string;
  sectionId: string;
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
  keywords: string[];
  popular?: boolean;
}
interface SectionDef {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: string;
  articles: Article[];
}
interface CategoryDef {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: string;
  color: string;
  sections: SectionDef[];
}
interface SearchResult extends Article {
  categoryNameEn: string;
  categoryNameAr: string;
  sectionNameEn: string;
  sectionNameAr: string;
  sectionIcon: string;
}


const SECTIONS_META: Record<string, { nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string; icon: string }> = 
{
  "dashboard": {
    "nameEn": "Dashboard",
    "nameAr": "لوحة التحكم",
    "descriptionEn": "View key metrics, shortcuts, and daily activity at a glance.",
    "descriptionAr": "اعرض المؤشرات الأساسية والاختصارات والنشاط اليومي بسرعة.",
    "icon": "LayoutDashboard"
  },
  "settings": {
    "nameEn": "Settings",
    "nameAr": "الإعدادات",
    "descriptionEn": "Control company details, preferences, and core system options.",
    "descriptionAr": "تحكم في بيانات الشركة والتفضيلات والخيارات الأساسية للنظام.",
    "icon": "Settings2"
  },
  "roles-permissions": {
    "nameEn": "Roles & Permissions",
    "nameAr": "الأدوار والصلاحيات",
    "descriptionEn": "Manage access levels for admins, sales teams, and account managers.",
    "descriptionAr": "أدر مستويات الوصول للمسؤولين وفرق المبيعات ومديري الحسابات.",
    "icon": "ShieldCheck"
  },
  "data-import": {
    "nameEn": "Data Import",
    "nameAr": "استيراد البيانات",
    "descriptionEn": "Bring leads, customers, and deals into the CRM safely.",
    "descriptionAr": "استورد العملاء المحتملين والعملاء والصفقات إلى النظام بأمان.",
    "icon": "DatabaseZap"
  },
  "backup": {
    "nameEn": "Backup",
    "nameAr": "النسخ الاحتياطي",
    "descriptionEn": "Protect your data with export and backup best practices.",
    "descriptionAr": "احمِ بياناتك باستخدام التصدير وأفضل ممارسات النسخ الاحتياطي.",
    "icon": "HardDriveDownload"
  },
  "leads": {
    "nameEn": "Leads",
    "nameAr": "العملاء المحتملون",
    "descriptionEn": "Capture, assign, and qualify inbound opportunities efficiently.",
    "descriptionAr": "استقبل الفرص الجديدة ووزعها وقم بتأهيلها بكفاءة.",
    "icon": "Users"
  },
  "deals": {
    "nameEn": "Deals",
    "nameAr": "الصفقات",
    "descriptionEn": "Manage deal stages, values, and expected close dates.",
    "descriptionAr": "أدر مراحل الصفقة وقيمتها وتاريخ الإغلاق المتوقع.",
    "icon": "Handshake"
  },
  "sales-funnel": {
    "nameEn": "Sales Funnel",
    "nameAr": "قمع المبيعات",
    "descriptionEn": "Understand how prospects move from new to won.",
    "descriptionAr": "افهم انتقال العملاء المحتملين من جديد إلى مكتمل.",
    "icon": "Funnel"
  },
  "activities": {
    "nameEn": "Activities",
    "nameAr": "الأنشطة",
    "descriptionEn": "Schedule calls, tasks, meetings, and follow-ups.",
    "descriptionAr": "قم بجدولة المكالمات والمهام والاجتماعات والمتابعات.",
    "icon": "CalendarClock"
  },
  "renewals": {
    "nameEn": "Renewals",
    "nameAr": "التجديدات",
    "descriptionEn": "Monitor upcoming renewals and protect recurring revenue.",
    "descriptionAr": "راقب التجديدات القادمة واحمِ الإيرادات المتكررة.",
    "icon": "RefreshCw"
  },
  "customers": {
    "nameEn": "Customers",
    "nameAr": "العملاء",
    "descriptionEn": "Keep account ownership and customer records organized.",
    "descriptionAr": "حافظ على تنظيم ملفات العملاء وملكية الحسابات.",
    "icon": "UserRound"
  },
  "customer-profile": {
    "nameEn": "Customer Profile",
    "nameAr": "ملف العميل",
    "descriptionEn": "See all interactions, notes, campaigns, and timeline history.",
    "descriptionAr": "شاهد كل التفاعلات والملاحظات والحملات والسجل الزمني للعميل.",
    "icon": "FileUser"
  },
  "campaigns": {
    "nameEn": "Campaigns",
    "nameAr": "الحملات",
    "descriptionEn": "Create structured campaigns and measure business impact.",
    "descriptionAr": "أنشئ حملات منظمة وقِس أثرها على الأعمال.",
    "icon": "Megaphone"
  },
  "meta-campaigns": {
    "nameEn": "Meta Campaigns",
    "nameAr": "حملات ميتا",
    "descriptionEn": "Track Meta ads, budgets, statuses, and results.",
    "descriptionAr": "تابع إعلانات ميتا والميزانيات والحالات والنتائج.",
    "icon": "Facebook"
  },
  "tiktok-campaigns": {
    "nameEn": "TikTok Campaigns",
    "nameAr": "حملات تيك توك",
    "descriptionEn": "Review TikTok ad performance and conversion trends.",
    "descriptionAr": "راجع أداء حملات تيك توك واتجاهات التحويل.",
    "icon": "Music2"
  },
  "campaign-analytics": {
    "nameEn": "Campaign Analytics",
    "nameAr": "تحليلات الحملات",
    "descriptionEn": "Compare spend, CPL, ROAS, and lead quality over time.",
    "descriptionAr": "قارن الإنفاق وتكلفة العميل والعائد وجودة العملاء بمرور الوقت.",
    "icon": "BarChart3"
  },
  "meta-integration": {
    "nameEn": "Meta Integration",
    "nameAr": "تكامل ميتا",
    "descriptionEn": "Connect forms, pages, and ad accounts with the CRM.",
    "descriptionAr": "اربط النماذج والصفحات والحسابات الإعلانية مع النظام.",
    "icon": "Link2"
  },
  "tiktok-integration": {
    "nameEn": "TikTok Integration",
    "nameAr": "تكامل تيك توك",
    "descriptionEn": "Sync TikTok lead forms and map incoming data fields.",
    "descriptionAr": "زامن نماذج تيك توك واربط الحقول الواردة ببيانات النظام.",
    "icon": "PlugZap"
  },
  "team-dashboard": {
    "nameEn": "Team Dashboard",
    "nameAr": "لوحة الفريق",
    "descriptionEn": "Follow team targets, pipelines, and conversion health.",
    "descriptionAr": "تابع أهداف الفريق ومسارات البيع وصحة التحويل.",
    "icon": "Presentation"
  },
  "audit-log": {
    "nameEn": "Audit Log",
    "nameAr": "سجل التدقيق",
    "descriptionEn": "Review critical user actions for traceability and governance.",
    "descriptionAr": "راجع الإجراءات المهمة للمستخدمين من أجل التتبع والحوكمة.",
    "icon": "ClipboardList"
  },
  "meta-aggregated-analytics": {
    "nameEn": "Aggregated Meta Analytics",
    "nameAr": "تحليلات ميتا المجمعة",
    "descriptionEn": "See combined Meta performance across campaigns and periods.",
    "descriptionAr": "شاهد أداء ميتا المجمع عبر الحملات والفترات الزمنية.",
    "icon": "BarChartBig"
  },
  "account-manager-dashboard": {
    "nameEn": "Account Manager Dashboard",
    "nameAr": "لوحة مدير الحساب",
    "descriptionEn": "Track renewals, delayed follow-ups, and account revenue.",
    "descriptionAr": "تابع التجديدات والمتابعات المتأخرة وإيرادات مدير الحساب.",
    "icon": "Gauge"
  },
  "rakan-ai": {
    "nameEn": "Rakan AI",
    "nameAr": "راكان الذكي",
    "descriptionEn": "Ask for summaries, reports, and guided actions inside the CRM.",
    "descriptionAr": "اطلب ملخصات وتقارير وإجراءات موجهة داخل النظام.",
    "icon": "Sparkles"
  },
  "lead-intelligence": {
    "nameEn": "Lead Intelligence",
    "nameAr": "ذكاء العملاء المحتملين",
    "descriptionEn": "Score and prioritize leads using enriched signals and context.",
    "descriptionAr": "قيّم العملاء المحتملين ورتّبهم باستخدام إشارات وبيانات إضافية.",
    "icon": "Brain"
  },
  "conversation-monitoring": {
    "nameEn": "Conversation Monitoring",
    "nameAr": "مراقبة المحادثات",
    "descriptionEn": "Review conversations for quality, compliance, and coaching.",
    "descriptionAr": "راجع المحادثات من أجل الجودة والامتثال والتدريب.",
    "icon": "MessagesSquare"
  },
  "custom-fields": {
    "nameEn": "Custom Fields",
    "nameAr": "الحقول المخصصة",
    "descriptionEn": "Add structured fields that match your sales process.",
    "descriptionAr": "أضف حقولاً مخصصة تناسب دورة العمل لديك.",
    "icon": "Rows3"
  },
  "lead-sources": {
    "nameEn": "Lead Sources",
    "nameAr": "مصادر العملاء",
    "descriptionEn": "Track where opportunities come from and how they perform.",
    "descriptionAr": "تابع مصادر العملاء المحتملين وكيفية أدائها.",
    "icon": "LocateFixed"
  },
  "notifications": {
    "nameEn": "Notifications",
    "nameAr": "الإشعارات",
    "descriptionEn": "Control reminders, alerts, and inbox activity visibility.",
    "descriptionAr": "تحكم في التذكيرات والتنبيهات وظهور نشاط الصندوق الوارد.",
    "icon": "Bell"
  },
  "dark-mode": {
    "nameEn": "Dark Mode",
    "nameAr": "الوضع الداكن",
    "descriptionEn": "Enable a darker interface for comfortable viewing.",
    "descriptionAr": "فعّل واجهة داكنة لعرض أكثر راحة.",
    "icon": "MoonStar"
  },
  "language": {
    "nameEn": "Language",
    "nameAr": "اللغة",
    "descriptionEn": "Switch the interface language instantly and safely.",
    "descriptionAr": "بدّل لغة الواجهة بشكل فوري وآمن.",
    "icon": "Languages"
  },
  "reset-password": {
    "nameEn": "Reset Password",
    "nameAr": "إعادة تعيين كلمة المرور",
    "descriptionEn": "Recover access and apply better password security.",
    "descriptionAr": "استعد الوصول وطبّق ممارسات أمان أفضل لكلمة المرور.",
    "icon": "KeyRound"
  },
  "tamara-payments": {
    "nameEn": "Tamara Payments",
    "nameAr": "مدفوعات تمارا",
    "descriptionEn": "Send installment payment links via Tamara for deals and contract renewals.",
    "descriptionAr": "أرسل روابط دفع بالتقسيط عبر تمارا للصفقات وتجديد العقود.",
    "icon": "CreditCard"
  },
  "client-handover": {
    "nameEn": "Client Handover & Onboarding",
    "nameAr": "تسليم العميل والتهيئة",
    "descriptionEn": "Manage the full handover process from a Won deal to completed onboarding.",
    "descriptionAr": "أدر عملية تسليم العميل بالكامل من الصفقة المكتملة إلى نهاية التهيئة.",
    "icon": "Handshake"
  }
}
;


const CATEGORIES_RAW: Array<{ id: string; nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string; icon: string; color: string; sectionIds: string[] }> = 
[
  {
    "id": "getting-started",
    "nameEn": "Getting Started & Setup",
    "nameAr": "البداية وإعداد النظام",
    "descriptionEn": "Start fast with setup, roles, imports, and essential system configuration.",
    "descriptionAr": "ابدأ بسرعة من خلال الإعدادات الأساسية والصلاحيات والاستيراد والتهيئة.",
    "icon": "Rocket",
    "color": "#2563EB",
    "sectionIds": [
      "dashboard",
      "settings",
      "roles-permissions",
      "data-import",
      "backup"
    ]
  },
  {
    "id": "sales-customers",
    "nameEn": "Sales & Customers Management",
    "nameAr": "إدارة المبيعات والعملاء",
    "descriptionEn": "Track leads, deals, activities, renewals, and customer profiles in one place.",
    "descriptionAr": "تابع العملاء المحتملين والصفقات والأنشطة والتجديدات وملفات العملاء من مكان واحد.",
    "icon": "Users",
    "color": "#10B981",
    "sectionIds": [
      "leads",
      "deals",
      "sales-funnel",
      "activities",
      "renewals",
      "customers",
      "customer-profile",
      "tamara-payments",
      "client-handover"
    ]
  },
  {
    "id": "marketing-campaigns",
    "nameEn": "Marketing & Campaigns",
    "nameAr": "التسويق والحملات",
    "descriptionEn": "Create, monitor, and optimize campaigns across channels and ad platforms.",
    "descriptionAr": "أنشئ الحملات وراقبها وطوّرها عبر القنوات والمنصات الإعلانية.",
    "icon": "Megaphone",
    "color": "#8B5CF6",
    "sectionIds": [
      "campaigns",
      "meta-campaigns",
      "tiktok-campaigns",
      "campaign-analytics",
      "meta-integration",
      "tiktok-integration"
    ]
  },
  {
    "id": "reports-analytics",
    "nameEn": "Reports & Analytics",
    "nameAr": "التقارير والتحليلات",
    "descriptionEn": "Measure team performance, audit activity, and monitor aggregated insights.",
    "descriptionAr": "قِس أداء الفريق وراقب السجل التدقيقي والتحليلات المجمعة.",
    "icon": "Presentation",
    "color": "#F59E0B",
    "sectionIds": [
      "team-dashboard",
      "audit-log",
      "meta-aggregated-analytics",
      "account-manager-dashboard"
    ]
  },
  {
    "id": "smart-tools-ai",
    "nameEn": "Smart Tools & AI",
    "nameAr": "الأدوات الذكية",
    "descriptionEn": "Use AI features to speed up work, improve lead quality, and monitor conversations.",
    "descriptionAr": "استخدم الميزات الذكية لتسريع العمل وتحسين جودة العملاء ومراقبة المحادثات.",
    "icon": "Sparkles",
    "color": "#EC4899",
    "sectionIds": [
      "rakan-ai",
      "lead-intelligence",
      "conversation-monitoring"
    ]
  },
  {
    "id": "settings-advanced",
    "nameEn": "Settings & Advanced",
    "nameAr": "الإعدادات والمتقدمة",
    "descriptionEn": "Customize the CRM with advanced controls, notifications, appearance, and security.",
    "descriptionAr": "خصص النظام باستخدام الإعدادات المتقدمة والإشعارات والمظهر والأمان.",
    "icon": "SlidersHorizontal",
    "color": "#EF4444",
    "sectionIds": [
      "custom-fields",
      "lead-sources",
      "notifications",
      "dark-mode",
      "language",
      "reset-password"
    ]
  }
]
;


const ARTICLES: Article[] = 
[] = [
  {
    "id": "dashboard-getting-started",
    "categoryId": "getting-started",
    "sectionId": "dashboard",
    "questionEn": "How do I start using Dashboard in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام لوحة التحكم في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with the Dashboard in Tamiyouz CRM</h2><p>The <strong>Dashboard</strong> is your central hub for monitoring key metrics and managing your CRM data efficiently. To start using the Dashboard in Tamiyouz CRM, follow these detailed steps to ensure a streamlined setup and optimal usability.</p><h3>Step 1: Access the Dashboard</h3><p>Navigate to the <strong>Dashboard</strong> area via the main navigation menu. This section provides an overview of available fields and widgets that you can customize to suit your business needs.</p><h3>Step 2: Configure Initial Settings</h3><p>Before inviting your team, it is crucial to complete the required setup. Focus on:</p><ul><li><strong>Naming Conventions:</strong> Define consistent naming rules for records to maintain clarity.</li><li><strong>Ownership Rules:</strong> Assign ownership of data to appropriate team members to ensure accountability.</li><li><strong>Visibility Settings:</strong> Set permissions to control who can view or edit specific data, ensuring data privacy and integrity.</li></ul><h3>Step 3: Test Your Workflow</h3><p>Create one or two sample records to test the workflow. Verify that the status updates, notifications, and permissions function as expected. This testing phase helps identify any configuration gaps before full team adoption.</p><div class=\"tip\">💡 Tip: Regularly review and update your Dashboard settings to adapt to evolving business processes and keep data accurate.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام لوحة التحكم في Tamiyouz CRM</h2><p>تُعتبر <strong>لوحة التحكم</strong> مركزك الرئيسي لمتابعة المقاييس الأساسية وإدارة بيانات CRM الخاصة بك بكفاءة. لبدء استخدام لوحة التحكم في Tamiyouz CRM، اتبع هذه الخطوات التفصيلية لضمان إعداد سلس وسهولة الاستخدام المثلى.</p><h3>الخطوة 1: الوصول إلى لوحة التحكم</h3><p>انتقل إلى قسم <strong>لوحة التحكم</strong> من خلال قائمة التنقل الرئيسية. يوفر هذا القسم نظرة عامة على الحقول والوحدات المتاحة التي يمكنك تخصيصها لتناسب احتياجات عملك.</p><h3>الخطوة 2: تكوين الإعدادات الأولية</h3><p>قبل دعوة فريقك، من المهم إكمال الإعدادات المطلوبة. ركز على:</p><ul><li><strong>قواعد التسمية:</strong> حدد قواعد تسمية متسقة للسجلات للحفاظ على الوضوح.</li><li><strong>قواعد الملكية:</strong> قم بتعيين ملكية البيانات لأعضاء الفريق المناسبين لضمان المساءلة.</li><li><strong>إعدادات الظهور:</strong> اضبط الصلاحيات للتحكم في من يمكنه عرض أو تعديل البيانات لضمان خصوصية وسلامة البيانات.</li></ul><h3>الخطوة 3: اختبار سير العمل</h3><p>أنشئ سجلًا أو سجلين تجريبيين لاختبار سير العمل. تحقق من تحديثات الحالة والتنبيهات والصلاحيات للتأكد من عملها كما هو متوقع. تساعدك هذه المرحلة في تحديد أي ثغرات في التكوين قبل اعتماد الفريق الكامل.</p><div class=\"tip\">💡 نصيحة: قم بمراجعة إعدادات لوحة التحكم وتحديثها بانتظام لتتكيف مع تطورات عمليات العمل وللحفاظ على دقة البيانات.</div>",
    "keywords": [
      "dashboard",
      "لوحة التحكم",
      "getting started & setup",
      "البداية وإعداد النظام",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": true
  },
  {
    "id": "dashboard-troubleshooting",
    "categoryId": "getting-started",
    "sectionId": "dashboard",
    "questionEn": "Why is Dashboard not showing the expected data?",
    "questionAr": "لماذا لا يعرض لوحة التحكم البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Dashboard Not Showing the Expected Data?</h2>\n<p>The <strong>Dashboard</strong> is a dynamic interface designed to display key metrics and insights based on your organization’s data. If you notice that the dashboard is not reflecting the expected data, several factors could be responsible.</p>\n<h3>Steps to Troubleshoot</h3>\n<ol>\n  <li><strong>Check Filters and Date Range:</strong> Ensure that the active filters and the selected date range align with the data you expect to view. Filters like status, team scope, or specific segments can limit what is displayed.</li>\n  <li><strong>Verify Ownership Rules and User Permissions:</strong> Your user permissions might restrict access to certain data. Confirm that you have the necessary rights to view the data on the dashboard.</li>\n  <li><strong>Review Data Mappings and Status Filters:</strong> Sometimes, data exists but remains hidden due to missing mappings or applied status filters that exclude certain records.</li>\n  <li><strong>Investigate Recent Imports, Integrations, and Automation Rules:</strong> Changes in data imports, integrations with other systems, or automation rules affecting the dashboard can impact what data is displayed.</li>\n  <li><strong>Compare Records:</strong> To isolate the issue, compare an affected record that is missing from the dashboard against a record that appears correctly. Identifying differences can help pinpoint configuration or data issues.</li>\n</ol>\n<div class=\"tip\">💡 Regularly reviewing your filters and permissions ensures your dashboard always reflects accurate and relevant data.</div>\n<div class=\"note\">📝 If problems persist after these checks, contact your system administrator or support team for advanced troubleshooting.</div>",
    "answerAr": "<h2>لماذا لا يعرض لوحة التحكم البيانات المتوقعة؟</h2>\n<p>تُعد <strong>لوحة التحكم</strong> واجهة ديناميكية تعرض المقاييس والرؤى الأساسية بناءً على بيانات مؤسستك. إذا لاحظت أن لوحة التحكم لا تعكس البيانات المتوقعة، فقد تكون هناك عدة أسباب وراء ذلك.</p>\n<h3>خطوات استكشاف المشكلة</h3>\n<ol>\n  <li><strong>تحقق من الفلاتر والفترة الزمنية:</strong> تأكد من أن الفلاتر النشطة والفترة الزمنية المحددة تتوافق مع البيانات التي تتوقع عرضها. يمكن أن تحد الفلاتر مثل الحالة، نطاق الفريق، أو القطاعات المحددة من البيانات المعروضة.</li>\n  <li><strong>التحقق من قواعد الملكية وصلاحيات المستخدم:</strong> قد تقيد صلاحيات المستخدم الوصول إلى بيانات معينة. تأكد من أن لديك الحقوق اللازمة لعرض البيانات على لوحة التحكم.</li>\n  <li><strong>مراجعة الربط بين الحقول وفلاتر الحالة:</strong> في بعض الأحيان تكون البيانات موجودة ولكنها مخفية بسبب نقص الربط بين الحقول أو تطبيق فلاتر الحالة التي تستبعد سجلات معينة.</li>\n  <li><strong>مراجعة عمليات الاستيراد الأخيرة والتكاملات وقواعد الأتمتة:</strong> قد تؤثر التغييرات في عمليات الاستيراد، التكامل مع الأنظمة الأخرى، أو قواعد الأتمتة المرتبطة بلوحة التحكم على البيانات المعروضة.</li>\n  <li><strong>مقارنة السجلات:</strong> لعزل المشكلة، قارن بين سجل متأثر مفقود من لوحة التحكم وسجل يظهر بشكل صحيح. سيساعد تحديد الاختلافات في التعرف على مشكلات التكوين أو البيانات.</li>\n</ol>\n<div class=\"tip\">💡 قم بمراجعة الفلاتر والصلاحيات بانتظام لضمان أن تعكس لوحة التحكم بيانات دقيقة وذات صلة.</div>\n<div class=\"note\">📝 إذا استمرت المشكلة بعد هذه الفحوصات، تواصل مع مسؤول النظام أو فريق الدعم لمزيد من الاستكشاف المتقدم.</div>",
    "keywords": [
      "dashboard",
      "لوحة التحكم",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "settings-getting-started",
    "categoryId": "getting-started",
    "sectionId": "settings",
    "questionEn": "How do I start using Settings in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام الإعدادات في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Settings in Tamiyouz CRM</h2><p>To begin using the <strong>Settings</strong> feature effectively in Tamiyouz CRM, follow these systematic steps to ensure your CRM environment is configured for optimal data management and team collaboration.</p><ol><li><strong>Access Settings:</strong> Navigate to the <em>Settings</em> area via the main navigation menu. This centralized hub contains all configurable options related to your CRM setup.</li><li><strong>Review Available Fields:</strong> Examine all the fields and options presented. Understanding these will help you tailor the CRM according to your organizational needs.</li><li><strong>Complete Required Setup:</strong> Prioritize configuring key elements such as:</li><ul><li><strong>Naming Conventions:</strong> Establish clear and consistent rules for naming records to maintain uniformity.</li><li><strong>Ownership Rules:</strong> Define who owns which records to clarify responsibilities and streamline workflow.</li><li><strong>Visibility Settings:</strong> Configure access permissions to control who can view or edit specific data, ensuring data integrity and confidentiality.</li></ul><li><strong>Test Your Configuration:</strong> Create one or two sample records to simulate typical workflows. Verify that statuses update correctly, notifications trigger as expected, and permissions align with your settings.</li><li><strong>Invite Your Team:</strong> Once confident in the setup, invite team members to start using the CRM, ensuring they understand the configured processes.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Regularly revisit the Settings area to update configurations as your team’s needs evolve, maintaining data cleanliness and reporting accuracy.</div><div class=\"note\">📝 <strong>Note:</strong> Proper initial configuration in Settings significantly reduces errors and improves team productivity.</div>",
    "answerAr": "<h2>البدء باستخدام الإعدادات في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>الإعدادات</strong> بشكل فعال في Tamiyouz CRM، اتبع هذه الخطوات المنظمة لضمان تكوين بيئة نظام إدارة علاقات العملاء بشكل يحقق أفضل إدارة للبيانات وتعاون فعّال مع الفريق.</p><ol><li><strong>الوصول إلى الإعدادات:</strong> افتح قسم <em>الإعدادات</em> من خلال قائمة التنقل الرئيسية. هذا القسم المركزي يحتوي على جميع الخيارات القابلة للتكوين المتعلقة بإعداد نظام إدارة علاقات العملاء.</li><li><strong>مراجعة الحقول المتاحة:</strong> استعرض جميع الحقول والخيارات المعروضة. سيساعدك فهمها على تخصيص النظام وفقاً لاحتياجات مؤسستك.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> ركز على تكوين العناصر الأساسية مثل:</li><ul><li><strong>قواعد التسمية:</strong> وضع قواعد واضحة ومتسقة لتسمية السجلات للحفاظ على التوحيد.</li><li><strong>قواعد الملكية:</strong> تحديد من يملك السجلات لتوضيح المسؤوليات وتبسيط سير العمل.</li><li><strong>إعدادات الرؤية:</strong> تكوين صلاحيات الوصول للتحكم بمن يمكنه عرض أو تعديل البيانات، مما يضمن سلامة وسرية البيانات.</li></ul><li><strong>اختبر التكوين الخاص بك:</strong> أنشئ سجل أو سجلين تجريبيين لمحاكاة عمليات العمل النموذجية. تحقق من تحديث الحالات بشكل صحيح، وتشغيل التنبيهات كما هو متوقع، وتوافق الصلاحيات مع الإعدادات.</li><li><strong>دعوة الفريق:</strong> بعد التأكد من الإعداد، قم بدعوة أعضاء الفريق لبدء استخدام النظام مع التأكد من فهمهم للإعدادات والإجراءات المكونة.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> قم بمراجعة قسم الإعدادات بانتظام لتحديث التكوينات مع تطور احتياجات فريقك، مما يحافظ على نظافة البيانات ودقة التقارير.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> التكوين السليم في البداية يقلل بشكل كبير من الأخطاء ويزيد من إنتاجية الفريق.</div>",
    "keywords": [
      "settings",
      "الإعدادات",
      "getting started & setup",
      "البداية وإعداد النظام",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "settings-troubleshooting",
    "categoryId": "getting-started",
    "sectionId": "settings",
    "questionEn": "Why is Settings not showing the expected data?",
    "questionAr": "لماذا لا يعرض الإعدادات البيانات المتوقعة؟",
    "answerEn": "<h2>Why Is Settings Not Showing the Expected Data?</h2><p>When you notice that the <strong>Settings</strong> section is not displaying the data you expect, there are several key areas to investigate to resolve this issue efficiently.</p><h3>Step 1: Verify Filters and Date Range</h3><p>Begin by checking all active <strong>filters</strong> applied within the Settings interface. Filters based on status, team scope, or specific criteria can sometimes hide relevant data. Additionally, ensure that the <strong>date range</strong> is correctly set to include the period for which you expect to see data.</p><h3>Step 2: Review Ownership Rules and User Permissions</h3><p>Ownership rules determine which records are visible to you based on team or individual assignments. Similarly, user permissions may restrict access to certain data. Confirm that your user role has the necessary permissions to view all relevant records within Settings.</p><h3>Step 3: Examine Recent Data Imports, Integrations, and Automation Rules</h3><p>If the above steps do not resolve the issue, review any recent <strong>data imports</strong>, <strong>integrations</strong>, or <strong>automation rules</strong> that might affect the data shown. Sometimes, incorrect mappings or automation configurations can inadvertently hide or alter data visibility.</p><h3>Step 4: Compare Affected Records</h3><p>To quickly identify discrepancies, compare one record that is not displaying correctly with another similar record that is working as expected. This comparison can highlight differences in data fields, statuses, or ownership that may explain the issue.</p><div class=\"tip\">💡 <strong>Tip:</strong> Regularly reviewing filters and permissions helps prevent unexpected data visibility problems.</div>",
    "answerAr": "<h2>لماذا لا يعرض الإعدادات البيانات المتوقعة؟</h2><p>عند ملاحظة أن قسم <strong>الإعدادات</strong> لا يعرض البيانات المتوقعة، هناك عدة نقاط رئيسية يجب التحقق منها لحل المشكلة بكفاءة.</p><h3>الخطوة 1: التحقق من الفلاتر والفترة الزمنية</h3><p>ابدأ بفحص جميع <strong>الفلاتر</strong> النشطة المطبقة داخل واجهة الإعدادات. قد تقوم الفلاتر المرتبطة بالحالة أو نطاق الفريق أو معايير محددة بإخفاء البيانات ذات الصلة أحيانًا. بالإضافة إلى ذلك، تأكد من ضبط <strong>الفترة الزمنية</strong> بشكل صحيح لتشمل الفترة التي تتوقع ظهور البيانات خلالها.</p><h3>الخطوة 2: مراجعة قواعد الملكية وصلاحيات المستخدم</h3><p>تحدد قواعد الملكية السجلات التي يمكنك رؤيتها بناءً على تعيينها للفريق أو الفرد. وبالمثل، قد تقيد صلاحيات المستخدم الوصول إلى بعض البيانات. تحقق من أن دور المستخدم الخاص بك يمتلك الصلاحيات اللازمة لعرض جميع السجلات ذات الصلة في الإعدادات.</p><h3>الخطوة 3: فحص عمليات الاستيراد الأخيرة والتكاملات وقواعد الأتمتة</h3><p>إذا لم تحل الخطوات السابقة المشكلة، قم بمراجعة أي <strong>عمليات استيراد بيانات</strong> حديثة، أو <strong>تكاملات</strong>، أو <strong>قواعد أتمتة</strong> قد تؤثر على البيانات المعروضة. في بعض الأحيان، يمكن أن تؤدي الربط غير الصحيح بين الحقول أو إعدادات الأتمتة إلى إخفاء البيانات أو تغيير قابلية رؤيتها.</p><h3>الخطوة 4: مقارنة السجلات المتأثرة</h3><p>للتعرف بسرعة على الاختلافات، قارن سجلًا واحدًا لا يظهر بشكل صحيح مع سجل مشابه يعمل كما هو متوقع. يمكن أن تسلط هذه المقارنة الضوء على اختلافات في الحقول أو الحالة أو الملكية قد تفسر المشكلة.</p><div class=\"tip\">💡 <strong>نصيحة:</strong> المراجعة الدورية للفلاتر والصلاحيات تساعد في تجنب مشاكل ظهور البيانات غير المتوقعة.</div>",
    "keywords": [
      "settings",
      "الإعدادات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "roles-permissions-getting-started",
    "categoryId": "getting-started",
    "sectionId": "roles-permissions",
    "questionEn": "How do I start using Roles & Permissions in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام الأدوار والصلاحيات في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Roles & Permissions in Tamiyouz CRM</h2><p>To begin utilizing the <strong>Roles & Permissions</strong> feature in Tamiyouz CRM, follow these structured steps to ensure a streamlined setup and effective access control management.</p><ol><li><strong>Access the Roles & Permissions Section:</strong> Navigate to the main menu and select the <em>Roles & Permissions</em> area. This section contains all the configurable fields related to roles, their privileges, and user permissions.</li><li><strong>Review Available Fields:</strong> Familiarize yourself with the default roles, permission settings, and ownership options available. Understanding these will help tailor the system to your organization's needs.</li><li><strong>Complete Initial Setup:</strong> Configure essential parameters including:<ul><li><strong>Naming Conventions:</strong> Define consistent role names to maintain clarity.</li><li><strong>Ownership Rules:</strong> Set who owns data records to control edit and view rights.</li><li><strong>Visibility Settings:</strong> Determine what data each role can see to keep information secure and reporting clean.</li></ul></li><li><strong>Invite Team Members:</strong> Once roles are defined, add users to their respective roles to assign permissions effectively.</li><li><strong>Test the Workflow:</strong> Use one or two sample records to verify that statuses, notifications, and permissions behave as expected. This step helps identify and correct any misconfigurations before full deployment.</li></ol><div class=\"tip\">💡 Tip: Regularly review and update roles and permissions as your team grows or business requirements change, to maintain optimal security and functionality.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام الأدوار والصلاحيات في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>الأدوار والصلاحيات</strong> في Tamiyouz CRM، اتبع الخطوات المنظمة التالية لضمان إعداد سلس وإدارة فعالة للتحكم في صلاحيات الوصول.</p><ol><li><strong>الوصول إلى قسم الأدوار والصلاحيات:</strong> انتقل إلى القائمة الرئيسية واختر قسم <em>الأدوار والصلاحيات</em>. يحتوي هذا القسم على جميع الحقول القابلة للتخصيص المتعلقة بالأدوار وامتيازاتها وصلاحيات المستخدمين.</li><li><strong>مراجعة الحقول المتاحة:</strong> تعرّف على الأدوار الافتراضية، إعدادات الصلاحيات، وخيارات الملكية المتوفرة. سيساعدك هذا الفهم على تخصيص النظام بما يتناسب مع احتياجات مؤسستك.</li><li><strong>إكمال الإعداد الأولي:</strong> قم بضبط المعايير الأساسية بما في ذلك:<ul><li><strong>قواعد التسمية:</strong> حدد أسماء أدوار متسقة للحفاظ على الوضوح.</li><li><strong>قواعد الملكية:</strong> حدد من يملك سجلات البيانات للتحكم في حقوق التعديل والمشاهدة.</li><li><strong>إعدادات الظهور:</strong> حدد البيانات التي يمكن لكل دور رؤيتها للحفاظ على أمان المعلومات وسهولة إعداد التقارير.</li></ul></li><li><strong>دعوة أعضاء الفريق:</strong> بعد تحديد الأدوار، أضف المستخدمين إلى أدوارهم المناسبة لتعيين الصلاحيات بشكل فعّال.</li><li><strong>اختبار سير العمل:</strong> استخدم سجلًا أو سجلين تجريبيين للتحقق من أن الحالات والتنبيهات والصلاحيات تعمل كما هو متوقع. تساعد هذه الخطوة في الكشف عن أي أخطاء في الإعدادات وتصحيحها قبل التطبيق الكامل.</li></ol><div class=\"tip\">💡 نصيحة: قم بمراجعة وتحديث الأدوار والصلاحيات بانتظام مع نمو فريقك أو تغير متطلبات العمل للحفاظ على أفضل مستوى من الأمن والوظائف.</div>",
    "keywords": [
      "roles & permissions",
      "الأدوار والصلاحيات",
      "getting started & setup",
      "البداية وإعداد النظام",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "roles-permissions-troubleshooting",
    "categoryId": "getting-started",
    "sectionId": "roles-permissions",
    "questionEn": "Why is Roles & Permissions not showing the expected data?",
    "questionAr": "لماذا لا يعرض الأدوار والصلاحيات البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Roles & Permissions Not Showing the Expected Data?</h2>\n<p>When you notice that the <strong>Roles & Permissions</strong> section is not displaying the expected data, several factors could be causing this issue. Start by thoroughly checking the following:</p>\n<ul>\n<li><strong>Filters:</strong> Ensure that no restrictive filters are applied that might be hiding certain records.</li>\n<li><strong>Date Range:</strong> Verify that the selected date range includes the period for which you expect data.</li>\n<li><strong>Ownership Rules:</strong> Confirm that ownership settings do not limit data visibility.</li>\n<li><strong>User Permissions:</strong> Make sure your user account has the appropriate permissions to view the required data.</li>\n</ul>\n<p>Often, the data exists but is not visible due to <strong>status filters</strong>, <strong>team scope limitations</strong>, or missing <strong>field mappings</strong>. These subtle constraints can prevent data from appearing as expected.</p>\n<div class=\"tip\">💡 Tip: Temporarily remove filters and broaden the date range to check if data appears.</div>\n<p>If after these checks the issue persists, proceed with the following steps:</p>\n<ol>\n<li>Review recent <strong>data imports</strong> and verify their correctness.</li>\n<li>Check any active <strong>integrations</strong> that might impact Roles & Permissions data.</li>\n<li>Examine <strong>automation rules</strong> related to Roles & Permissions for potential conflicts.</li>\n<li>Compare an affected record with a correctly functioning one to identify discrepancies quickly.</li>\n</ol>\n<div class=\"note\">📝 Note: Keeping a log of recent changes made in your system can help pinpoint the root cause faster.</div>",
    "answerAr": "<h2>لماذا لا يعرض الأدوار والصلاحيات البيانات المتوقعة؟</h2>\n<p>عندما تلاحظ أن قسم <strong>الأدوار والصلاحيات</strong> لا يعرض البيانات المتوقعة، قد تكون هناك عدة أسباب تؤدي إلى هذه المشكلة. ابدأ بفحص الجوانب التالية بدقة:</p>\n<ul>\n<li><strong>الفلاتر:</strong> تأكد من عدم وجود فلاتر تقييدية قد تخفي بعض السجلات.</li>\n<li><strong>الفترة الزمنية:</strong> تحقق من أن النطاق الزمني المختار يشمل الفترة التي تتوقع وجود بيانات فيها.</li>\n<li><strong>قواعد الملكية:</strong> تأكد من أن إعدادات الملكية لا تحد من رؤية البيانات.</li>\n<li><strong>صلاحيات المستخدم:</strong> تأكد من أن حساب المستخدم الخاص بك يمتلك الصلاحيات المناسبة لعرض البيانات المطلوبة.</li>\n</ul>\n<p>في كثير من الأحيان، تكون البيانات موجودة ولكنها غير مرئية بسبب <strong>فلاتر الحالة</strong>، أو <strong>قيود نطاق الفريق</strong>، أو نقص <strong>الربط بين الحقول</strong>. هذه القيود قد تمنع ظهور البيانات كما هو متوقع.</p>\n<div class=\"tip\">💡 نصيحة: حاول إزالة الفلاتر مؤقتًا وتوسيع النطاق الزمني للتحقق من ظهور البيانات.</div>\n<p>إذا استمرت المشكلة بعد هذه الفحوصات، اتبع الخطوات التالية:</p>\n<ol>\n<li>راجع عمليات <strong>الاستيراد الأخيرة</strong> وتحقق من صحتها.</li>\n<li>افحص أي <strong>تكاملات</strong> نشطة قد تؤثر على بيانات الأدوار والصلاحيات.</li>\n<li>تحقق من <strong>قواعد الأتمتة</strong> المتعلقة بالأدوار والصلاحيات للبحث عن تعارضات محتملة.</li>\n<li>قارن بين سجل متأثر وآخر يعمل بشكل صحيح لتحديد الفروقات بسرعة.</li>\n</ol>\n<div class=\"note\">📝 ملاحظة: الاحتفاظ بسجل التغييرات الأخيرة في النظام يساعد في تحديد السبب الجذري بشكل أسرع.</div>",
    "keywords": [
      "roles & permissions",
      "الأدوار والصلاحيات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "data-import-getting-started",
    "categoryId": "getting-started",
    "sectionId": "data-import",
    "questionEn": "How do I start using Data Import in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام استيراد البيانات في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Data Import in Tamiyouz CRM</h2><p>The <strong>Data Import</strong> feature allows you to seamlessly bring external data into Tamiyouz CRM, ensuring your records are accurate, consistent, and ready for analysis.</p><h3>Step-by-Step Guide</h3><ol><li><strong>Access the Data Import Area:</strong> Navigate to the main menu and select the <em>Data Import</em> section to begin.</li><li><strong>Review Available Fields:</strong> Familiarize yourself with the fields available for import to understand the data structure and requirements.</li><li><strong>Configure Setup:</strong> Complete essential configurations such as:</li><ul><li><strong>Naming Conventions:</strong> Define consistent naming rules to maintain data uniformity.</li><li><strong>Ownership Rules:</strong> Assign proper ownership to ensure accountability and access control.</li><li><strong>Visibility Settings:</strong> Set permissions to control who can view or edit imported data.</li></ul><li><strong>Test Import Workflow:</strong> Import one or two sample records to validate the process.</li><ul><li>Confirm that the records reach the expected status.</li><li>Verify that notifications are triggered appropriately.</li><li>Ensure permissions are applied correctly.</li></ul><li><strong>Invite Your Team:</strong> Once testing is successful, invite your team members to start using the Data Import feature confidently.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Starting with a small batch of data helps prevent errors and ensures smoother integration.</div><div class=\"note\">📝 <strong>Note:</strong> Proper setup of naming and ownership rules is critical to maintain data integrity and facilitate reporting.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام استيراد البيانات في Tamiyouz CRM</h2><p>تتيح لك ميزة <strong>استيراد البيانات</strong> جلب البيانات الخارجية إلى Tamiyouz CRM بسلاسة، مما يضمن دقة وسلامة سجلاتك وجاهزيتها للتحليل.</p><h3>دليل خطوة بخطوة</h3><ol><li><strong>الوصول إلى قسم استيراد البيانات:</strong> انتقل إلى القائمة الرئيسية واختر قسم <em>استيراد البيانات</em> للبدء.</li><li><strong>مراجعة الحقول المتاحة:</strong> تعرّف على الحقول التي يمكن استيرادها لفهم هيكل البيانات والمتطلبات اللازمة.</li><li><strong>إعداد التهيئة:</strong> أكمل الإعدادات الأساسية مثل:</li><ul><li><strong>قواعد التسمية:</strong> حدد قواعد تسمية متسقة للحفاظ على توحيد البيانات.</li><li><strong>قواعد الملكية:</strong> عيّن الملكية المناسبة لضمان المساءلة والتحكم في الوصول.</li><li><strong>إعدادات الظهور:</strong> اضبط الصلاحيات للتحكم بمن يمكنه عرض أو تعديل البيانات المستوردة.</li></ul><li><strong>اختبار سير العمل:</strong> استورد سجل أو سجلين تجريبيين للتحقق من العملية.</li><ul><li>تأكد من وصول السجلات إلى الحالة المتوقعة.</li><li>تحقق من تفعيل التنبيهات بشكل صحيح.</li><li>تأكد من تطبيق الصلاحيات بشكل مناسب.</li></ul><li><strong>دعوة الفريق:</strong> بعد نجاح الاختبار، قم بدعوة أعضاء فريقك لاستخدام ميزة استيراد البيانات بثقة.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> البدء بمجموعة صغيرة من البيانات يساعد في تجنب الأخطاء ويسهل التكامل.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> إعداد قواعد التسمية والملكية بشكل صحيح أمر ضروري للحفاظ على سلامة البيانات وتسهيل إعداد التقارير.</div>",
    "keywords": [
      "data import",
      "استيراد البيانات",
      "getting started & setup",
      "البداية وإعداد النظام",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "data-import-troubleshooting",
    "categoryId": "getting-started",
    "sectionId": "data-import",
    "questionEn": "Why is Data Import not showing the expected data?",
    "questionAr": "لماذا لا يعرض استيراد البيانات البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Data Import not showing the expected data?</h2><p>When you find that the <strong>Data Import</strong> feature is not displaying the expected data, several factors could be causing this issue. To troubleshoot effectively, start by checking the following key areas:</p><ol><li><strong>Filters:</strong> Verify if any status or custom filters are applied that might be hiding the data.</li><li><strong>Date Range:</strong> Ensure the selected date range includes the period when the data was imported or modified.</li><li><strong>Ownership Rules:</strong> Confirm that the ownership or team scope settings allow visibility of the records in question.</li><li><strong>User Permissions:</strong> Check whether your user role has sufficient permissions to view the imported data.</li></ol><p>In many cases, the data does exist within the system but remains hidden due to one or more of these constraints.</p><div class=\"tip\">💡 Tip: Sometimes missing field mappings during import can cause data to not appear correctly. Always review your mapping settings before importing.</div><p>If after these checks the problem persists, proceed with a deeper review by:</p><ul><li>Examining recent import logs for any errors or warnings.</li><li>Reviewing integrations that interact with Data Import to ensure they are functioning properly.</li><li>Checking automation rules that may affect data visibility or status after import.</li></ul><p>Finally, <strong>compare an affected record</strong> with a similar record that is displaying correctly. Look for differences in field values, ownership, status, and other properties to quickly identify the root cause.</p><div class=\"note\">📝 Note: Maintaining consistent data mappings and regularly reviewing import configurations helps prevent common data visibility issues.</div>",
    "answerAr": "<h2>لماذا لا يعرض استيراد البيانات البيانات المتوقعة؟</h2><p>عندما تواجه مشكلة في عدم عرض ميزة <strong>استيراد البيانات</strong> للبيانات المتوقعة، يمكن أن يكون هناك عدة أسباب وراء ذلك. للقيام بعملية استكشاف الأخطاء وإصلاحها بشكل فعال، ابدأ بالتحقق من المناطق الرئيسية التالية:</p><ol><li><strong>الفلاتر:</strong> تحقق مما إذا كانت هناك أية فلاتر حالة أو فلاتر مخصصة قد تخفي البيانات.</li><li><strong>الفترة الزمنية:</strong> تأكد من أن الفترة الزمنية المحددة تشمل المدة التي تم استيراد أو تعديل البيانات خلالها.</li><li><strong>قواعد الملكية:</strong> تحقق من إعدادات الملكية أو نطاق الفريق التي تسمح برؤية السجلات المعنية.</li><li><strong>صلاحيات المستخدم:</strong> افحص ما إذا كان دور المستخدم الخاص بك يمتلك الصلاحيات الكافية لرؤية البيانات المستوردة.</li></ol><p>في كثير من الحالات، تكون البيانات موجودة ضمن النظام لكنها مخفية بسبب أحد هذه القيود أو أكثر.</p><div class=\"tip\">💡 تلميح: في بعض الأحيان يؤدي نقص الربط بين الحقول أثناء الاستيراد إلى عدم ظهور البيانات بشكل صحيح. تأكد دائماً من مراجعة إعدادات الربط قبل الاستيراد.</div><p>إذا استمرت المشكلة بعد هذه الفحوصات، قم بإجراء مراجعة أعمق من خلال:</p><ul><li>فحص سجلات الاستيراد الأخيرة للبحث عن أية أخطاء أو تحذيرات.</li><li>مراجعة التكاملات التي تتفاعل مع استيراد البيانات للتأكد من عملها بشكل صحيح.</li><li>التحقق من قواعد الأتمتة التي قد تؤثر على ظهور البيانات أو حالتها بعد الاستيراد.</li></ul><p>وأخيراً، <strong>قارن سجلاً متأثراً</strong> بسجل مشابه يعرض البيانات بشكل صحيح. ابحث عن اختلافات في قيم الحقول، الملكية، الحالة، والخصائص الأخرى لتحديد السبب الجذري بسرعة.</p><div class=\"note\">📝 ملاحظة: الحفاظ على ربط الحقول بشكل متسق ومراجعة إعدادات الاستيراد بانتظام يساعدان في تجنب مشاكل شائعة في ظهور البيانات.</div>",
    "keywords": [
      "data import",
      "استيراد البيانات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "backup-getting-started",
    "categoryId": "getting-started",
    "sectionId": "backup",
    "questionEn": "How do I start using Backup in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام النسخ الاحتياطي في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Backup in Tamiyouz CRM</h2><p>To begin utilizing the <strong>Backup</strong> feature in Tamiyouz CRM, follow these steps carefully to ensure your data is securely managed and organized:</p><ol><li><strong>Access the Backup Area:</strong> Navigate to the <em>Backup</em> section via the main navigation menu of the CRM interface.</li><li><strong>Review Available Fields:</strong> Examine the fields provided within the Backup area to understand what data can be backed up and managed.</li><li><strong>Complete Required Setup:</strong> Configure essential settings such as:</li><ul><li><strong>Naming Conventions:</strong> Define clear rules for how backups are named to maintain consistency.</li><li><strong>Ownership Rules:</strong> Assign ownership to ensure accountability and proper data stewardship.</li><li><strong>Visibility Settings:</strong> Control who can access and view backup data to protect sensitive information.</li></ul><li><strong>Invite Your Team:</strong> Once setup is complete, invite relevant team members to start using the Backup feature.</li><li><strong>Test the Workflow:</strong> Create one or two sample backup records to verify that statuses, notifications, and permissions behave as expected.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Proper initial configuration helps keep your backup data clean and simplifies reporting tasks.</div><div class=\"note\">📝 <strong>Note:</strong> Regularly test and review backup workflows to ensure ongoing data integrity and security.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام النسخ الاحتياطي في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>النسخ الاحتياطي</strong> في Tamiyouz CRM، يرجى اتباع الخطوات التالية بعناية لضمان إدارة وتنظيم بياناتك بشكل آمن:</p><ol><li><strong>الوصول إلى قسم النسخ الاحتياطي:</strong> انتقل إلى قسم <em>النسخ الاحتياطي</em> عبر قائمة التنقل الرئيسية في واجهة النظام.</li><li><strong>مراجعة الحقول المتاحة:</strong> تفقد الحقول الموجودة ضمن قسم النسخ الاحتياطي لفهم البيانات التي يمكن نسخها احتياطياً وإدارتها.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> قم بتكوين الإعدادات الأساسية مثل:</li><ul><li><strong>قواعد التسمية:</strong> حدد قواعد واضحة لتسمية النسخ الاحتياطية للحفاظ على الاتساق.</li><li><strong>قواعد الملكية:</strong> عيّن مالكي البيانات لضمان المساءلة والإشراف المناسب.</li><li><strong>إعدادات الرؤية:</strong> تحكم في من يمكنه الوصول إلى بيانات النسخ الاحتياطي وعرضها لحماية المعلومات الحساسة.</li></ul><li><strong>دعوة الفريق:</strong> بعد إكمال الإعدادات، قم بدعوة أعضاء الفريق المعنيين لبدء استخدام ميزة النسخ الاحتياطي.</li><li><strong>اختبار سير العمل:</strong> أنشئ سجل أو اثنين من النسخ الاحتياطية التجريبية للتحقق من صحة الحالات والتنبيهات والصلاحيات.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> يساهم الإعداد الصحيح في البداية في الحفاظ على بيانات النسخ الاحتياطي نظيفة ويسهل مهام التقارير.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> قم باختبار ومراجعة سير عمل النسخ الاحتياطي بشكل دوري لضمان سلامة وأمن البيانات المستمر.</div>",
    "keywords": [
      "backup",
      "النسخ الاحتياطي",
      "getting started & setup",
      "البداية وإعداد النظام",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "backup-troubleshooting",
    "categoryId": "getting-started",
    "sectionId": "backup",
    "questionEn": "Why is Backup not showing the expected data?",
    "questionAr": "لماذا لا يعرض النسخ الاحتياطي البيانات المتوقعة؟",
    "answerEn": "<h2>Why Is Backup Not Showing the Expected Data?</h2><p>When you notice that the <strong>Backup</strong> feature is not displaying the data you expect, it is important to methodically review several common factors that might be affecting data visibility.</p><h3>Step 1: Verify Filters and Date Range</h3><p>Start by checking any applied <strong>filters</strong>, such as status filters or team scopes, which can limit the displayed data. Also, confirm that the <strong>date range</strong> is set correctly to include the period you want to analyze.</p><h3>Step 2: Review Ownership Rules and User Permissions</h3><p>Ensure that the <strong>ownership rules</strong> and <strong>user permissions</strong> are configured properly. In some cases, data may be present but hidden due to restrictions based on user roles or team access settings.</p><h3>Step 3: Investigate Integrations and Automations</h3><p>If the data still appears missing, examine recent <strong>imports</strong>, <strong>integrations</strong>, and <strong>automation rules</strong> related to the Backup feature. Sometimes, mapping issues or failed processes can cause data to be excluded.</p><h3>Step 4: Compare Records</h3><p>To identify subtle differences, select one record that is not showing correctly and compare it with a similar record that is displaying as expected. This comparison can help pinpoint discrepancies quickly.</p><div class=\"tip\">💡 Tip: Regularly reviewing these settings can prevent data visibility issues and ensure your backups are accurate and complete.</div>",
    "answerAr": "<h2>لماذا لا يعرض النسخ الاحتياطي البيانات المتوقعة؟</h2><p>عند ملاحظة أن خاصية <strong>النسخ الاحتياطي</strong> لا تعرض البيانات المتوقعة، من المهم مراجعة عدة عوامل شائعة قد تؤثر على ظهور البيانات.</p><h3>الخطوة 1: التحقق من الفلاتر والفترة الزمنية</h3><p>ابدأ بالتحقق من أي <strong>فلاتر</strong> مفعلة مثل فلاتر الحالة أو نطاق الفريق التي قد تحد من عرض البيانات. كما يجب التأكد من أن <strong>الفترة الزمنية</strong> محددة بشكل صحيح لتشمل الفترة التي تريد تحليلها.</p><h3>الخطوة 2: مراجعة قواعد الملكية وصلاحيات المستخدم</h3><p>تأكد من أن <strong>قواعد الملكية</strong> و<strong>صلاحيات المستخدم</strong> مُعدة بشكل صحيح. ففي بعض الحالات، قد تكون البيانات موجودة لكنها مخفية بسبب قيود بناءً على أدوار المستخدم أو إعدادات وصول الفريق.</p><h3>الخطوة 3: فحص التكاملات والأتمتة</h3><p>إذا استمرت المشكلة، قم بمراجعة آخر عمليات <strong>الاستيراد</strong>، و<strong>التكاملات</strong>، و<strong>قواعد الأتمتة</strong> المرتبطة بالنسخ الاحتياطي. أحياناً، قد تؤدي مشكلات الربط أو فشل العمليات إلى استبعاد البيانات.</p><h3>الخطوة 4: مقارنة السجلات</h3><p>لتحديد الفروقات الدقيقة، اختر سجلاً لا يظهر بشكل صحيح وقارنه بسجل مشابه يظهر بصورة صحيحة. تساعد هذه المقارنة في اكتشاف الفروقات بسرعة.</p><div class=\"tip\">💡 نصيحة: المراجعة الدورية لهذه الإعدادات تساعد في تجنب مشاكل ظهور البيانات وضمان دقة واكتمال النسخ الاحتياطية.</div>",
    "keywords": [
      "backup",
      "النسخ الاحتياطي",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "leads-getting-started",
    "categoryId": "sales-customers",
    "sectionId": "leads",
    "questionEn": "How do I start using Leads in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام العملاء المحتملون في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Leads in Tamiyouz CRM</h2><p>To effectively manage your sales pipeline, begin by accessing the <strong>Leads</strong> section from the main navigation menu in Tamiyouz CRM. This area centralizes all your potential customer information and helps streamline your sales process.</p><p>Once inside, carefully <strong>review all available fields</strong> related to lead information. This ensures you understand what data you can capture and how it aligns with your business needs.</p><h3>Initial Setup Steps</h3><ol><li><strong>Naming Conventions:</strong> Define clear and consistent naming rules for leads to maintain data uniformity and ease of identification.</li><li><strong>Ownership Rules:</strong> Assign lead ownership policies to ensure accountability and proper follow-up by specific team members.</li><li><strong>Visibility Settings:</strong> Configure who within your team can view or edit leads to maintain data security and privacy.</li></ol><p>Completing these steps is crucial to keep your lead data <strong>clean, organized, and easy to report on</strong>.</p><h3>Testing Your Configuration</h3><p>Before fully rolling out the Leads feature to your team, create one or two sample lead records. This allows you to:</p><ul><li>Verify that lead statuses update as expected during different stages.</li><li>Confirm that notifications trigger correctly for assigned users.</li><li>Ensure permissions are set correctly to prevent unauthorized access.</li></ul><div class=\"tip\">💡 <strong>Tip:</strong> Regularly revisit these settings to adapt to changes in your sales process or team structure.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام العملاء المحتملون في Tamiyouz CRM</h2><p>لإدارة فعالة لخط مبيعاتك، ابدأ بالدخول إلى قسم <strong>العملاء المحتملون</strong> من قائمة التنقل الرئيسية في Tamiyouz CRM. هذا القسم يركز جميع معلومات العملاء المحتملين ويساعد في تنظيم عملية المبيعات بشكل سلس.</p><p>بمجرد الدخول، قم بمراجعة <strong>جميع الحقول المتاحة</strong> المتعلقة بمعلومات العملاء المحتملين. هذا يضمن فهمك لنوع البيانات التي يمكن جمعها وكيفية توافقها مع احتياجات عملك.</p><h3>خطوات الإعداد الأولية</h3><ol><li><strong>قواعد التسمية:</strong> حدد قواعد واضحة ومتسقة لتسمية العملاء المحتملين للحفاظ على توحيد البيانات وسهولة التعرف عليها.</li><li><strong>قواعد الملكية:</strong> قم بتعيين سياسات ملكية العملاء لضمان المساءلة والمتابعة المناسبة من قبل أعضاء الفريق المحددين.</li><li><strong>إعدادات الظهور:</strong> قم بتكوين من يمكنه داخل فريقك عرض أو تعديل العملاء المحتملين للحفاظ على أمان وخصوصية البيانات.</li></ol><p>إتمام هذه الخطوات ضروري للحفاظ على بيانات العملاء المحتملين <strong>نظيفة ومنظمة وسهلة في إعداد التقارير</strong>.</p><h3>اختبار الإعدادات</h3><p>قبل طرح ميزة العملاء المحتملين على فريقك بالكامل، أنشئ سجل أو سجلين تجريبيين للعملاء المحتملين. يتيح لك هذا:</p><ul><li>التحقق من تحديث حالة العميل المحتمل كما هو متوقع في مختلف المراحل.</li><li>تأكيد تفعيل التنبيهات بشكل صحيح للمستخدمين المعنيين.</li><li>التأكد من ضبط الصلاحيات بشكل صحيح لمنع الوصول غير المصرح به.</li></ul><div class=\"tip\">💡 <strong>نصيحة:</strong> قم بمراجعة هذه الإعدادات بانتظام لتتكيف مع التغييرات في عملية المبيعات أو هيكل فريق العمل.</div>",
    "keywords": [
      "leads",
      "العملاء المحتملون",
      "sales & customers management",
      "إدارة المبيعات والعملاء",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": true
  },
  {
    "id": "leads-troubleshooting",
    "categoryId": "sales-customers",
    "sectionId": "leads",
    "questionEn": "Why is Leads not showing the expected data?",
    "questionAr": "لماذا لا يعرض العملاء المحتملون البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Leads Not Showing the Expected Data?</h2><p>When you notice that the <strong>Leads</strong> section is not displaying the expected data, it is important to systematically troubleshoot to identify the root cause. Start by checking the following key areas:</p><ol><li><strong>Filters and Statuses:</strong> Ensure that your current filters, such as lead status or stage, are not excluding relevant records. Sometimes leads exist but are hidden due to active filters.</li><li><strong>Date Range:</strong> Verify that the selected date range includes the period when the leads were created or updated to avoid missing data.</li><li><strong>Ownership and Team Scope:</strong> Confirm that the ownership rules and team scopes permit visibility of the leads you expect to see. Access permissions can restrict data from certain users or teams.</li><li><strong>User Permissions:</strong> Check that your user role has the necessary permissions to view lead records, as restricted roles may hide some data.</li></ol><p>If the issue persists, take the following additional steps:</p><ul><li>Review recent data imports and integrations that may affect lead records.</li><li>Examine active automation rules related to leads, such as assignment or status update workflows, which might alter data visibility.</li><li>Compare a record that is missing data with a similar record that displays correctly to quickly spot discrepancies in fields, statuses, or ownership.</li></ul><div class=\"tip\">💡 <strong>Tip:</strong> Regularly auditing your filters and permissions helps prevent data visibility issues before they occur.</div><div class=\"note\">📝 <strong>Note:</strong> Sometimes, mapping issues between integrated systems can result in leads not appearing as expected.</div>",
    "answerAr": "<h2>لماذا لا يعرض العملاء المحتملون البيانات المتوقعة؟</h2><p>عندما تلاحظ أن قسم <strong>العملاء المحتملون</strong> لا يعرض البيانات المتوقعة، من المهم اتباع خطوات منهجية لتحديد السبب الجذري للمشكلة. ابدأ بفحص المجالات الرئيسية التالية:</p><ol><li><strong>الفلاتر والحالات:</strong> تأكد من أن الفلاتر الحالية، مثل حالة العميل المحتمل أو مرحلته، لا تستبعد سجلات مهمة. في بعض الأحيان تكون البيانات موجودة لكنها مخفية بسبب فلاتر مفعلة.</li><li><strong>الفترة الزمنية:</strong> تحقق من أن نطاق التاريخ المحدد يشمل الفترة التي تم فيها إنشاء أو تحديث العملاء المحتملين لتجنب فقدان البيانات.</li><li><strong>قواعد الملكية ونطاق الفريق:</strong> تأكد من أن قواعد الملكية ونطاق الفريق تسمح برؤية العملاء المحتملين الذين تتوقع رؤيتهم. قد تقيد صلاحيات الوصول ظهور البيانات لبعض المستخدمين أو الفرق.</li><li><strong>صلاحيات المستخدم:</strong> تحقق من أن دور المستخدم الخاص بك يمتلك الصلاحيات اللازمة لعرض سجلات العملاء المحتملين، حيث قد تخفي الأدوار المقيدة بعض البيانات.</li></ol><p>إذا استمرت المشكلة، قم باتباع الخطوات الإضافية التالية:</p><ul><li>راجع عمليات الاستيراد الأخيرة والتكاملات التي قد تؤثر على سجلات العملاء المحتملين.</li><li>افحص قواعد الأتمتة النشطة المتعلقة بالعملاء المحتملين، مثل قواعد التعيين أو تحديث الحالة، التي قد تغير من ظهور البيانات.</li><li>قارن سجلاً مفقود البيانات مع سجل مشابه يعرض بشكل صحيح لتحديد الاختلافات بسرعة في الحقول أو الحالات أو الملكية.</li></ul><div class=\"tip\">💡 <strong>نصيحة:</strong> يساعد التدقيق المنتظم في الفلاتر والصلاحيات على منع مشكلات ظهور البيانات قبل حدوثها.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> في بعض الأحيان تؤدي مشاكل الربط بين الأنظمة المتكاملة إلى عدم ظهور العملاء المحتملين كما هو متوقع.</div>",
    "keywords": [
      "leads",
      "العملاء المحتملون",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "deals-getting-started",
    "categoryId": "sales-customers",
    "sectionId": "deals",
    "questionEn": "How do I start using Deals in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام الصفقات في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Deals in Tamiyouz CRM</h2><p>To effectively manage your sales pipeline, you first need to access the <strong>Deals</strong> section within Tamiyouz CRM. Follow these detailed steps to ensure a smooth setup and optimal usage:</p><ol><li><strong>Open the Deals Area:</strong> Navigate to the <em>Deals</em> area from the main navigation menu.</li><li><strong>Review Available Fields:</strong> Examine the default and custom fields provided to understand what data you can capture.</li><li><strong>Complete Required Setup:</strong> Configure key settings such as:</li><ul><li><strong>Naming Conventions:</strong> Establish consistent naming rules for deals to maintain clarity.</li><li><strong>Ownership Rules:</strong> Define who owns each deal to ensure accountability.</li><li><strong>Visibility Settings:</strong> Set permissions to control who can view or edit deal information, keeping data secure and organized.</li></ul><li><strong>Test Your Workflow:</strong> Create one or two sample deal records to verify that the workflow operates as expected. Confirm that statuses update correctly, notifications are sent, and permissions function as intended.</li><li><strong>Invite Your Team:</strong> Once setup and testing are complete, invite your team members to start using the Deals feature for managing sales.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Proper initial configuration helps keep your sales data clean and simplifies reporting.</div><div class=\"note\">📝 <strong>Note:</strong> Regularly review and adjust your settings to adapt to your evolving sales processes.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام الصفقات في Tamiyouz CRM</h2><p>لإدارة مسار المبيعات بفعالية، يجب أولاً الوصول إلى قسم <strong>الصفقات</strong> داخل نظام Tamiyouz CRM. اتبع الخطوات التفصيلية التالية لضمان إعداد سلس واستخدام مثالي:</p><ol><li><strong>فتح قسم الصفقات:</strong> انتقل إلى قسم <em>الصفقات</em> من قائمة التنقل الرئيسية.</li><li><strong>مراجعة الحقول المتاحة:</strong> تفقد الحقول الافتراضية والمخصصة لفهم البيانات التي يمكنك جمعها.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> قم بضبط الإعدادات الأساسية مثل:</li><ul><li><strong>قواعد التسمية:</strong> وضع قواعد موحدة لتسمية الصفقات للحفاظ على وضوح البيانات.</li><li><strong>قواعد الملكية:</strong> تحديد من يملك كل صفقة لضمان المسؤولية.</li><li><strong>إعدادات الصلاحيات:</strong> ضبط من يمكنه عرض أو تعديل معلومات الصفقة للحفاظ على أمان وتنظيم البيانات.</li></ul><li><strong>اختبار سير العمل:</strong> أنشئ صفقة أو صفقتين تجريبيتين للتحقق من أن سير العمل يعمل كما هو متوقع. تأكد من تحديث الحالات بشكل صحيح، وإرسال التنبيهات، وعمل الصلاحيات كما هو مخطط.</li><li><strong>دعوة فريقك:</strong> بعد إتمام الإعدادات والاختبار، قم بدعوة أعضاء الفريق لبدء استخدام ميزة الصفقات لإدارة المبيعات.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> الإعداد الصحيح في البداية يساعد في الحفاظ على نظافة بيانات المبيعات ويسهل إعداد التقارير.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> قم بمراجعة وضبط إعداداتك بانتظام لتناسب تطورات عمليات المبيعات الخاصة بك.</div>",
    "keywords": [
      "deals",
      "الصفقات",
      "sales & customers management",
      "إدارة المبيعات والعملاء",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "deals-troubleshooting",
    "categoryId": "sales-customers",
    "sectionId": "deals",
    "questionEn": "Why is Deals not showing the expected data?",
    "questionAr": "لماذا لا يعرض الصفقات البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Deals not showing the expected data?</h2><p>When the <strong>Deals</strong> feature does not display the expected data, several factors might be responsible. Begin by thoroughly checking the following:</p><ul><li><strong>Filters:</strong> Ensure that no status or category filters are unintentionally hiding relevant deals.</li><li><strong>Date Range:</strong> Confirm that the selected date range encompasses the period for which you expect to see deals.</li><li><strong>Ownership Rules:</strong> Verify that ownership or assignment rules are correctly applied and that you have access to the deals within your scope.</li><li><strong>User Permissions:</strong> Check that your user role has the necessary permissions to view the deals data.</li></ul><p>In many cases, the data exists but remains hidden due to restrictive filters, team scope limitations, or missing field mappings.</p><div class=\"tip\">💡 Tip: Always compare the settings of filters and permissions with those of a colleague who can see the data to spot discrepancies.</div><p>If the issue persists, take the following additional steps:</p><ol><li>Review recent data imports to ensure no errors occurred that might exclude deals.</li><li>Examine integrations with other systems to verify that data synchronization is functioning properly.</li><li>Inspect automation rules related to Deals to make sure they are not inadvertently affecting visibility.</li><li>Compare one affected deal record against a correctly displayed record to quickly identify differences or missing information.</li></ol><div class=\"note\">📝 Note: Proper understanding of filters and permissions is crucial for effective data visibility in Deals.</div>",
    "answerAr": "<h2>لماذا لا يعرض الصفقات البيانات المتوقعة؟</h2><p>عندما لا يعرض قسم <strong>الصفقات</strong> البيانات المتوقعة، قد تكون هناك عدة أسباب محتملة. ابدأ بالتحقق الدقيق من الأمور التالية:</p><ul><li><strong>الفلاتر:</strong> تأكد من عدم وجود فلاتر حالة أو فئات تُخفي الصفقات ذات الصلة بشكل غير مقصود.</li><li><strong>الفترة الزمنية:</strong> تحقق من أن النطاق الزمني المحدد يشمل الفترة التي تتوقع رؤية الصفقات خلالها.</li><li><strong>قواعد الملكية:</strong> تأكد من تطبيق قواعد الملكية أو التعيين بشكل صحيح وأن لديك صلاحية الوصول إلى الصفقات ضمن نطاقك.</li><li><strong>صلاحيات المستخدم:</strong> تحقق من أن دور المستخدم الخاص بك يمتلك الصلاحيات اللازمة لعرض بيانات الصفقات.</li></ul><p>في كثير من الحالات، تكون البيانات موجودة لكنها مخفية بسبب فلاتر مقيدة، أو قيود نطاق الفريق، أو نقص في الربط بين الحقول.</p><div class=\"tip\">💡 نصيحة: قارن دائماً إعدادات الفلاتر والصلاحيات مع زميل قادر على رؤية البيانات لتحديد الفروق بسهولة.</div><p>إذا استمرت المشكلة، اتبع الخطوات الإضافية التالية:</p><ol><li>راجع عمليات الاستيراد الأخيرة للتأكد من عدم وجود أخطاء قد تؤدي إلى استبعاد الصفقات.</li><li>افحص التكاملات مع الأنظمة الأخرى للتحقق من أن مزامنة البيانات تعمل بشكل صحيح.</li><li>تحقق من قواعد الأتمتة المرتبطة بالصفقات للتأكد من عدم تأثيرها سلباً على ظهور البيانات.</li><li>قارن سجلاً متأثراً بسجل يُعرض بشكل صحيح لتحديد الفوارق أو المعلومات الناقصة بسرعة.</li></ol><div class=\"note\">📝 ملاحظة: الفهم الصحيح للفلاتر والصلاحيات ضروري لضمان رؤية فعالة للبيانات في قسم الصفقات.</div>",
    "keywords": [
      "deals",
      "الصفقات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "sales-funnel-getting-started",
    "categoryId": "sales-customers",
    "sectionId": "sales-funnel",
    "questionEn": "How do I start using Sales Funnel in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام قمع المبيعات في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using the Sales Funnel in Tamiyouz CRM</h2>\n<p>To effectively utilize the <strong>Sales Funnel</strong> feature within Tamiyouz CRM, begin by navigating to the <strong>Sales Funnel</strong> section from the main navigation menu. This area provides a comprehensive overview of your sales stages and pipeline management tools.</p>\n<p>Follow these detailed steps to set up and start managing your sales process:</p>\n<ol>\n  <li><strong>Review Available Fields:</strong> Examine all default and customizable fields to ensure they match your sales process requirements.</li>\n  <li><strong>Configure Setup Settings:</strong> Establish <strong>naming conventions</strong> to maintain consistency across records, define <strong>ownership rules</strong> to assign responsibility clearly, and set <strong>visibility permissions</strong> to control who can access specific data. These measures help keep your data organized, accurate, and easily reportable.</li>\n  <li><strong>Invite Team Members:</strong> Once the configuration is complete, invite your sales team to collaborate within the Sales Funnel, ensuring everyone understands their roles.</li>\n  <li><strong>Test the Workflow:</strong> Create one or two sample records to simulate the sales process. Verify that the workflow statuses update correctly, notifications are sent as expected, and permissions are functioning properly.</li>\n</ol>\n<div class=\"tip\">💡 Tip: Consistent data entry and clear ownership help improve reporting accuracy and sales forecasting.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام قمع المبيعات في Tamiyouz CRM</h2>\n<p>لبدء استخدام ميزة <strong>قمع المبيعات</strong> في Tamiyouz CRM بشكل فعال، قم أولاً بالوصول إلى قسم <strong>قمع المبيعات</strong> من قائمة التنقل الرئيسية. يوفر هذا القسم نظرة شاملة على مراحل المبيعات وأدوات إدارة خط الأنابيب.</p>\n<p>اتبع الخطوات التفصيلية التالية لإعداد وإدارة عملية المبيعات الخاصة بك:</p>\n<ol>\n  <li><strong>مراجعة الحقول المتاحة:</strong> تحقق من جميع الحقول الافتراضية والقابلة للتخصيص لتتأكد من توافقها مع متطلبات عملية المبيعات لديك.</li>\n  <li><strong>تهيئة الإعدادات:</strong> حدد <strong>قواعد التسمية</strong> للحفاظ على اتساق السجلات، وحدد <strong>قواعد الملكية</strong> لتعيين المسؤوليات بوضوح، واضبط <strong>صلاحيات الظهور</strong> للتحكم بمن يمكنه الوصول إلى البيانات. تساعد هذه الإجراءات في تنظيم البيانات بدقة وجعلها سهلة التقارير.</li>\n  <li><strong>دعوة أعضاء الفريق:</strong> بعد الانتهاء من الإعدادات، قم بدعوة فريق المبيعات الخاص بك للتعاون داخل قمع المبيعات مع ضمان فهم الجميع لأدوارهم.</li>\n  <li><strong>اختبار سير العمل:</strong> أنشئ سجلًا أو سجلين تجريبيين لمحاكاة عملية المبيعات. تحقق من تحديث حالات سير العمل بشكل صحيح، وإرسال التنبيهات كما هو متوقع، وعمل الصلاحيات بشكل سليم.</li>\n</ol>\n<div class=\"tip\">💡 نصيحة: إدخال البيانات بشكل منتظم ووضوح الملكية يساعدان في تحسين دقة التقارير وتوقعات المبيعات.</div>",
    "keywords": [
      "sales funnel",
      "قمع المبيعات",
      "sales & customers management",
      "إدارة المبيعات والعملاء",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "sales-funnel-troubleshooting",
    "categoryId": "sales-customers",
    "sectionId": "sales-funnel",
    "questionEn": "Why is Sales Funnel not showing the expected data?",
    "questionAr": "لماذا لا يعرض قمع المبيعات البيانات المتوقعة؟",
    "answerEn": "<h2>Why Is Sales Funnel Not Showing the Expected Data?</h2><p>The <strong>Sales Funnel</strong> is a crucial feature that visually represents the progression of your sales process. If you notice that it is not displaying the expected data, several factors may be causing this issue.</p><h3>Steps to Troubleshoot</h3><ol><li><strong>Check Filters and Date Range:</strong> Ensure that the applied filters, such as status filters, and the selected date range are correctly set to include the data you expect to see.</li><li><strong>Verify Ownership Rules and User Permissions:</strong> Ownership settings and user roles may restrict visibility of certain records. Confirm that your permissions allow access to the data within the funnel.</li><li><strong>Assess Team Scope:</strong> The funnel may be limited to specific teams. Verify that the team scope includes the relevant data.</li><li><strong>Review Data Mappings:</strong> Missing or incorrect field mappings can cause records to be excluded. Check that all necessary fields are properly mapped.</li><li><strong>Examine Recent Imports and Integrations:</strong> Sometimes data issues arise after imports or integrations. Review recent activities to ensure data consistency.</li><li><strong>Analyze Automation Rules:</strong> Automation rules affecting the Sales Funnel might inadvertently hide or alter data. Confirm that these rules are functioning as intended.</li></ol><h3>Compare Records</h3><p>To quickly identify discrepancies, compare an affected record with a working one. Look for differences in status, ownership, mappings, or any other relevant attributes.</p><div class=\"tip\">💡 <strong>Tip:</strong> Regularly review your filters and permissions after system updates or changes to maintain accurate Sales Funnel data visibility.</div>",
    "answerAr": "<h2>لماذا لا يعرض قمع المبيعات البيانات المتوقعة؟</h2><p>يُعد <strong>قمع المبيعات</strong> ميزة أساسية تعرض بشكل مرئي تقدم عملية المبيعات الخاصة بك. إذا لاحظت أنه لا يعرض البيانات المتوقعة، فقد تكون هناك عدة أسباب لهذه المشكلة.</p><h3>خطوات استكشاف المشكلة وإصلاحها</h3><ol><li><strong>تحقق من الفلاتر والفترة الزمنية:</strong> تأكد من أن الفلاتر المطبقة، مثل فلاتر الحالة، والفترة الزمنية المحددة مضبوطة بشكل صحيح لتشمل البيانات التي تتوقع رؤيتها.</li><li><strong>التحقق من قواعد الملكية وصلاحيات المستخدم:</strong> قد تقيد إعدادات الملكية وأدوار المستخدم رؤية بعض السجلات. تحقق من أن صلاحياتك تسمح بالوصول إلى البيانات ضمن القمع.</li><li><strong>تقييم نطاق الفريق:</strong> قد يكون القمع مقصوراً على فرق معينة. تحقق من أن نطاق الفريق يشمل البيانات ذات الصلة.</li><li><strong>مراجعة ربط الحقول:</strong> قد يؤدي نقص أو عدم دقة ربط الحقول إلى استبعاد السجلات. تحقق من أن جميع الحقول الضرورية مرتبطة بشكل صحيح.</li><li><strong>مراجعة عمليات الاستيراد والتكامل الأخيرة:</strong> قد تظهر مشكلات في البيانات بعد عمليات الاستيراد أو التكامل. راجع الأنشطة الأخيرة لضمان اتساق البيانات.</li><li><strong>تحليل قواعد الأتمتة:</strong> قد تؤثر قواعد الأتمتة المرتبطة بقمع المبيعات على إخفاء أو تعديل البيانات عن غير قصد. تأكد من أن هذه القواعد تعمل بشكل صحيح.</li></ol><h3>مقارنة السجلات</h3><p>لتحديد الاختلافات بسرعة، قارن سجلاً متأثراً بسجل يعمل بشكل صحيح. ابحث عن الفروقات في الحالة أو الملكية أو الربط أو أي سمات أخرى ذات صلة.</p><div class=\"tip\">💡 <strong>نصيحة:</strong> قم بمراجعة الفلاتر والصلاحيات بانتظام بعد تحديثات النظام أو التغييرات للحفاظ على دقة ظهور بيانات قمع المبيعات.</div>",
    "keywords": [
      "sales funnel",
      "قمع المبيعات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "activities-getting-started",
    "categoryId": "sales-customers",
    "sectionId": "activities",
    "questionEn": "How do I start using Activities in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام الأنشطة في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Activities in Tamiyouz CRM</h2><p>To effectively utilize the <strong>Activities</strong> feature in Tamiyouz CRM, begin by navigating to the <strong>Activities</strong> section from the main navigation menu. This area is designed to help you track and manage all customer-related interactions seamlessly.</p><p>Before inviting your team to use Activities, it is essential to configure the system properly to maintain data integrity and ensure smooth operations. Follow these key steps:</p><ol><li><strong>Review Available Fields:</strong> Examine the default fields provided within Activities to understand what data can be captured.</li><li><strong>Set Naming Conventions:</strong> Establish consistent naming rules for activities to standardize entries and simplify reporting.</li><li><strong>Define Ownership Rules:</strong> Specify who owns each activity to clarify responsibilities and accountability.</li><li><strong>Configure Visibility Settings:</strong> Control access permissions to ensure sensitive data is visible only to authorized users.</li></ol><p>Once these configurations are complete, perform a <strong>test run</strong> by creating one or two sample activity records. Verify that the workflow behaves as expected, including the correct status updates, timely notifications, and proper permission enforcement.</p><div class=\"tip\">💡 <strong>Tip:</strong> Regularly revisit your settings as your team grows or processes evolve to keep Activities optimized for your needs.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام الأنشطة في Tamiyouz CRM</h2><p>للاستفادة الفعالة من ميزة <strong>الأنشطة</strong> في Tamiyouz CRM، ابدأ بالانتقال إلى قسم <strong>الأنشطة</strong> من قائمة التنقل الرئيسية. تم تصميم هذا القسم لمساعدتك على تتبع وإدارة جميع التفاعلات المتعلقة بالعملاء بسلاسة.</p><p>قبل دعوة فريقك لاستخدام الأنشطة، من الضروري إعداد النظام بشكل صحيح للحفاظ على سلامة البيانات وضمان سير العمليات بسلاسة. اتبع الخطوات الأساسية التالية:</p><ol><li><strong>مراجعة الحقول المتاحة:</strong> افحص الحقول الافتراضية المتوفرة ضمن الأنشطة لفهم البيانات التي يمكن تسجيلها.</li><li><strong>تحديد قواعد التسمية:</strong> ضع قواعد تسمية موحدة للأنشطة لتوحيد الإدخالات وتسهيل إعداد التقارير.</li><li><strong>تحديد قواعد الملكية:</strong> حدد من هو مالك كل نشاط لتوضيح المسؤوليات والمحاسبة.</li><li><strong>تكوين إعدادات الظهور:</strong> تحكم في صلاحيات الوصول لضمان أن البيانات الحساسة مرئية فقط للمستخدمين المصرح لهم.</li></ol><p>عند الانتهاء من هذه الإعدادات، قم بإجراء <strong>اختبار تجريبي</strong> بإنشاء سجل أو سجلين نموذجيين للأنشطة. تحقق من أن سير العمل يعمل كما هو متوقع، بما في ذلك تحديث الحالات بشكل صحيح، والإشعارات في الوقت المناسب، وتطبيق الصلاحيات بشكل صحيح.</p><div class=\"tip\">💡 <strong>نصيحة:</strong> راجع إعداداتك بانتظام مع نمو فريقك أو تطور العمليات للحفاظ على تحسين ميزة الأنشطة بما يتناسب مع احتياجاتك.</div>",
    "keywords": [
      "activities",
      "الأنشطة",
      "sales & customers management",
      "إدارة المبيعات والعملاء",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "activities-troubleshooting",
    "categoryId": "sales-customers",
    "sectionId": "activities",
    "questionEn": "Why is Activities not showing the expected data?",
    "questionAr": "لماذا لا يعرض الأنشطة البيانات المتوقعة؟",
    "answerEn": "<h2>Why is <strong>Activities</strong> Not Showing the Expected Data?</h2>\n<p>When you notice that the <strong>Activities</strong> feature in Tamiyouz CRM is not displaying the expected data, there are several key areas to investigate to resolve the issue efficiently.</p>\n<h3>1. Verify Filters and Date Range</h3>\n<p>First, check if any filters or date ranges are applied that may be limiting the visible data. Status filters, team scope, or specific date selections can often hide records that actually exist in the system.</p>\n<h3>2. Review Ownership Rules and User Permissions</h3>\n<p>Ensure that your user role has the appropriate permissions to view the activities in question. Ownership rules might restrict access to certain records, which would cause them not to appear.</p>\n<h3>3. Examine Data Mappings</h3>\n<p>Sometimes, missing or incorrect field mappings can cause data not to appear as expected. Double-check that all necessary fields are correctly mapped within your CRM settings.</p>\n<h3>4. Investigate Imports, Integrations, and Automation Rules</h3>\n<p>If the issue persists, review recent data imports, integrations with other systems, and any automation rules related to Activities. These processes might affect how data is imported or displayed.</p>\n<h3>5. Compare Affected Records</h3>\n<p>To quickly identify discrepancies, select one affected record and compare it side-by-side with a working record. This comparison can highlight differences in data, permissions, or configuration causing the issue.</p>\n<div class=\"tip\">💡 Keeping a regular audit of filters and automation rules can prevent such data visibility issues.</div>",
    "answerAr": "<h2>لماذا لا يعرض قسم <strong>الأنشطة</strong> البيانات المتوقعة؟</h2>\n<p>عندما تلاحظ أن قسم <strong>الأنشطة</strong> في Tamiyouz CRM لا يعرض البيانات المتوقعة، هناك عدة نقاط أساسية يجب التحقق منها لحل المشكلة بكفاءة.</p>\n<h3>1. التحقق من الفلاتر والفترة الزمنية</h3>\n<p>ابدأ بمراجعة ما إذا كانت هناك أي فلاتر أو نطاقات زمنية مفعلة قد تحد من عرض البيانات. فلاتر الحالة، نطاق الفريق، أو اختيار تواريخ محددة قد تخفي سجلات موجودة بالفعل في النظام.</p>\n<h3>2. مراجعة قواعد الملكية وصلاحيات المستخدم</h3>\n<p>تأكد من أن دور المستخدم الخاص بك يمتلك الصلاحيات المناسبة لعرض الأنشطة المطلوبة. قد تؤدي قواعد الملكية إلى تقييد الوصول إلى سجلات معينة مما يمنع ظهورها.</p>\n<h3>3. فحص الربط بين الحقول</h3>\n<p>في بعض الأحيان، يؤدي نقص أو عدم صحة الربط بين الحقول إلى عدم ظهور البيانات كما هو متوقع. تحقق جيدًا من أن جميع الحقول الضرورية مرتبطة بشكل صحيح في إعدادات النظام.</p>\n<h3>4. مراجعة عمليات الاستيراد والتكامل وقواعد الأتمتة</h3>\n<p>إذا استمرت المشكلة، قم بمراجعة عمليات الاستيراد الأخيرة، التكاملات مع الأنظمة الأخرى، وأي قواعد أتمتة مرتبطة بالأنشطة. قد تؤثر هذه العمليات على طريقة استيراد البيانات أو عرضها.</p>\n<h3>5. مقارنة السجلات المتأثرة</h3>\n<p>لمعرفة الاختلافات بسرعة، اختر سجلاً متأثراً وقارنه بجانب سجل يعمل بشكل صحيح. يمكن أن تساعد هذه المقارنة في كشف الفروقات في البيانات أو الصلاحيات أو الإعدادات التي تسبب المشكلة.</p>\n<div class=\"tip\">💡 إجراء مراجعة دورية للفلاتر وقواعد الأتمتة يمكن أن يمنع مشاكل رؤية البيانات.</div>",
    "keywords": [
      "activities",
      "الأنشطة",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "renewals-getting-started",
    "categoryId": "sales-customers",
    "sectionId": "renewals",
    "questionEn": "How do I start using Renewals in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام التجديدات في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Renewals in Tamiyouz CRM</h2><p>The <strong>Renewals</strong> feature in Tamiyouz CRM streamlines managing contract or subscription renewals efficiently. To begin using Renewals, follow these essential steps to ensure your data remains organized and your team is well-prepared.</p><h3>Step 1: Access the Renewals Section</h3><p>Navigate to the <strong>Renewals</strong> area from the main navigation menu. Here, you will find all the fields and options related to renewal management.</p><h3>Step 2: Review and Configure Settings</h3><p>Before inviting your team, it is critical to complete the setup:</p><ul><li><strong>Naming Conventions:</strong> Define clear and consistent naming rules to maintain data uniformity.</li><li><strong>Ownership Rules:</strong> Assign ownership correctly to ensure accountability and streamline follow-ups.</li><li><strong>Visibility Settings:</strong> Configure who can view and edit renewal records to protect sensitive information and facilitate collaboration.</li></ul><div class=\"tip\">💡 Tip: Properly setting these rules ensures clean data and simplifies reporting and analysis.</div><h3>Step 3: Test the Workflow</h3><p>Before rolling out to the entire team, test the renewal process using one or two sample records. Confirm that:</p><ul><li>Renewal statuses update as expected</li><li>Notification alerts are triggered appropriately</li><li>User permissions align with your visibility settings</li></ul><div class=\"note\">📝 Note: Testing helps prevent issues and ensures a smooth user experience once the team starts using the feature.</div><p>Once these steps are completed successfully, invite your team members to start managing renewals confidently within Tamiyouz CRM.</p>",
    "answerAr": "<h2>كيفية البدء باستخدام التجديدات في Tamiyouz CRM</h2><p>تُعد ميزة <strong>التجديدات</strong> في Tamiyouz CRM أداة فعالة لإدارة تجديد العقود أو الاشتراكات بسلاسة وكفاءة. لبدء استخدام التجديدات، اتبع الخطوات الأساسية التالية لضمان تنظيم بياناتك وتجهيز فريقك بشكل جيد.</p><h3>الخطوة 1: الدخول إلى قسم التجديدات</h3><p>انتقل إلى قسم <strong>التجديدات</strong> من قائمة التنقل الرئيسية. ستجد هنا جميع الحقول والخيارات المتعلقة بإدارة التجديدات.</p><h3>الخطوة 2: مراجعة وتكوين الإعدادات</h3><p>قبل دعوة الفريق لاستخدام الميزة، من الضروري إكمال الإعدادات التالية:</p><ul><li><strong>قواعد التسمية:</strong> حدد قواعد واضحة ومتسقة لأسماء السجلات للحفاظ على موحدة البيانات.</li><li><strong>قواعد الملكية:</strong> قم بتعيين الملكية بشكل صحيح لضمان المساءلة وتسهيل المتابعة.</li><li><strong>إعدادات الظهور:</strong> قم بتكوين من يمكنه عرض وتحرير سجلات التجديد لحماية المعلومات الحساسة وتسهيل التعاون.</li></ul><div class=\"tip\">💡 نصيحة: إعداد هذه القواعد بدقة يساعد في الحفاظ على بيانات نظيفة ويُسهل إعداد التقارير والتحليلات.</div><h3>الخطوة 3: اختبار سير العمل</h3><p>قبل تعميم الاستخدام على الفريق بأكمله، اختبر عملية التجديد باستخدام سجل أو سجلين تجريبيين. تأكد من أن:</p><ul><li>حالات التجديد تتحدث كما هو متوقع</li><li>التنبيهات تُرسل بشكل صحيح</li><li>صلاحيات المستخدمين متوافقة مع إعدادات الظهور</li></ul><div class=\"note\">📝 ملاحظة: يساعد الاختبار في تجنب المشاكل وضمان تجربة استخدام سلسة عند بدء الفريق باستخدام الميزة.</div><p>بعد إتمام هذه الخطوات بنجاح، يمكنك دعوة أعضاء الفريق للبدء في إدارة التجديدات بثقة داخل Tamiyouz CRM.</p>",
    "keywords": [
      "renewals",
      "التجديدات",
      "sales & customers management",
      "إدارة المبيعات والعملاء",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "renewals-troubleshooting",
    "categoryId": "sales-customers",
    "sectionId": "renewals",
    "questionEn": "Why is Renewals not showing the expected data?",
    "questionAr": "لماذا لا يعرض التجديدات البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Renewals Not Showing the Expected Data?</h2><p>When you notice that the <strong>Renewals</strong> feature is not displaying the data you expect, several factors may be causing this issue. It is important to systematically check the following elements:</p><ol><li><strong>Filters:</strong> Ensure that the filters applied, such as status filters, are not excluding relevant renewal records. Filters can often hide data unintentionally.</li><li><strong>Date Range:</strong> Verify that the selected date range covers the period for which you expect to see renewal data.</li><li><strong>Ownership Rules:</strong> Confirm that ownership and team scope settings permit you to view the relevant renewals. Sometimes records are restricted based on team permissions.</li><li><strong>User Permissions:</strong> Make sure your user account has the necessary permissions to access renewal data.</li></ol><p>If the data still does not appear as expected, further investigation is required:</p><ul><li><strong>Review Recent Imports and Integrations:</strong> Check if recent data imports or integrations affecting Renewals were successful and correctly mapped.</li><li><strong>Automation Rules:</strong> Examine any automation rules related to Renewals that might be impacting data visibility.</li><li><strong>Record Comparison:</strong> Compare an affected renewal record with a correctly displayed one to quickly identify discrepancies or missing information.</li></ul><div class=\"tip\">💡 <strong>Tip:</strong> Keeping a checklist of these steps can help you quickly diagnose and resolve issues related to missing renewal data.</div>",
    "answerAr": "<h2>لماذا لا يعرض قسم التجديدات البيانات المتوقعة؟</h2><p>عند ملاحظة أن ميزة <strong>التجديدات</strong> لا تعرض البيانات المتوقعة، قد تكون هناك عدة عوامل تسبب هذه المشكلة. من المهم فحص العناصر التالية بشكل منهجي:</p><ol><li><strong>الفلاتر:</strong> تأكد من أن الفلاتر المطبقة، مثل فلاتر الحالة، لا تستبعد سجلات التجديد ذات الصلة. قد تؤدي الفلاتر أحياناً إلى إخفاء البيانات دون قصد.</li><li><strong>الفترة الزمنية:</strong> تحقق من أن الفترة الزمنية المحددة تغطي المدة التي تتوقع ظهور بيانات التجديد خلالها.</li><li><strong>قواعد الملكية:</strong> تأكد من أن إعدادات الملكية ونطاق الفريق تسمح لك بعرض التجديدات ذات الصلة. أحياناً تكون السجلات مقيدة بناءً على صلاحيات الفريق.</li><li><strong>صلاحيات المستخدم:</strong> تحقق من أن حساب المستخدم الخاص بك لديه الأذونات اللازمة للوصول إلى بيانات التجديد.</li></ol><p>إذا استمرت المشكلة في الظهور، يلزم إجراء تحقيق أعمق:</p><ul><li><strong>مراجعة عمليات الاستيراد والتكاملات الأخيرة:</strong> تحقق من نجاح عمليات استيراد البيانات أو التكاملات التي تؤثر على قسم التجديدات وأنها تم ربطها بشكل صحيح.</li><li><strong>قواعد الأتمتة:</strong> فحص أي قواعد أتمتة مرتبطة بالتجديدات قد تؤثر على ظهور البيانات.</li><li><strong>مقارنة السجلات:</strong> قارن سجلاً متأثراً بسجل معروض بشكل صحيح لتحديد الفروقات أو المعلومات الناقصة بسرعة.</li></ul><div class=\"tip\">💡 <strong>نصيحة:</strong> الاحتفاظ بقائمة مراجعة لهذه الخطوات يساعدك على تشخيص وحل مشاكل البيانات المفقودة في التجديدات بسرعة.</div>",
    "keywords": [
      "renewals",
      "التجديدات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "customers-getting-started",
    "categoryId": "sales-customers",
    "sectionId": "customers",
    "questionEn": "How do I start using Customers in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام العملاء في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Customers in Tamiyouz CRM</h2><p>To begin utilizing the <strong>Customers</strong> feature effectively within Tamiyouz CRM, follow a structured setup process to ensure your data remains organized and accessible. First, navigate to the <strong>Customers</strong> area from the main navigation menu. Here, carefully review all the available fields to understand what information you can capture and manage.</p><p>Next, complete the essential setup steps before inviting your team members to use this feature. Focus on configuring key elements such as:</p><ul><li><strong>Naming Conventions:</strong> Establish consistent naming rules to maintain uniformity across customer records.</li><li><strong>Ownership Rules:</strong> Define who owns or manages each customer record to clarify responsibilities.</li><li><strong>Visibility Settings:</strong> Set permissions to control who can view or edit customer data, ensuring data security and privacy.</li></ul><p>After configuration, perform a test run by creating one or two sample customer records. This testing phase is crucial to verify that workflows operate as expected, including status changes, notification triggers, and permission enforcement.</p><div class=\"tip\">💡 <strong>Tip:</strong> Keep your customer data clean and well-structured from the start to facilitate accurate reporting and efficient team collaboration.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام العملاء في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>العملاء</strong> بفعالية داخل Tamiyouz CRM، اتبع خطوات إعداد منظمة لضمان بقاء بياناتك مرتبة وسهلة الوصول. أولاً، افتح قسم <strong>العملاء</strong> من قائمة التنقل الرئيسية. قم بمراجعة جميع الحقول المتاحة بعناية لفهم المعلومات التي يمكنك جمعها وإدارتها.</p><p>بعد ذلك، أكمل خطوات الإعداد الأساسية قبل دعوة أعضاء الفريق لاستخدام هذه الميزة. ركز على تكوين العناصر الرئيسية التالية:</p><ul><li><strong>قواعد التسمية:</strong> حدد قواعد تسمية موحدة للحفاظ على تناسق سجلات العملاء.</li><li><strong>قواعد الملكية:</strong> عين من يمتلك أو يدير كل سجل عميل لتوضيح المسؤوليات.</li><li><strong>إعدادات الرؤية:</strong> اضبط الصلاحيات للتحكم بمن يمكنه عرض أو تعديل بيانات العملاء، مما يضمن أمان وخصوصية البيانات.</li></ul><p>بعد الانتهاء من الإعداد، قم بإجراء اختبار عملي بإنشاء سجل أو سجلين تجريبيين للعملاء. تُعد هذه المرحلة ضرورية للتحقق من أن سير العمل يعمل كما هو متوقع، بما في ذلك تغيير الحالات، وإطلاق التنبيهات، وتنفيذ الصلاحيات.</p><div class=\"tip\">💡 <strong>نصيحة:</strong> حافظ على نظافة وترتيب بيانات العملاء من البداية لتسهيل إعداد التقارير الدقيقة وتعزيز التعاون الفعال بين الفريق.</div>",
    "keywords": [
      "customers",
      "العملاء",
      "sales & customers management",
      "إدارة المبيعات والعملاء",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "customers-troubleshooting",
    "categoryId": "sales-customers",
    "sectionId": "customers",
    "questionEn": "Why is Customers not showing the expected data?",
    "questionAr": "لماذا لا يعرض العملاء البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Customers not showing the expected data?</h2><p>When you encounter issues where the <strong>Customers</strong> feature does not display the expected data, it is important to systematically verify several factors to identify the root cause.</p><ol><li><strong>Check Filters and Date Range:</strong> Ensure that the applied filters and the selected date range are correctly set. Often, data might be hidden because status filters exclude certain records or the date range does not cover the relevant period.</li><li><strong>Review Ownership Rules and User Permissions:</strong> The visibility of customer data can be restricted by ownership settings and user permissions. Confirm that your user role has the appropriate access rights and that team scopes are not limiting data visibility.</li><li><strong>Inspect Data Mappings and Status Filters:</strong> Missing or incorrect field mappings may cause data to be hidden or not displayed properly. Similarly, status filters can exclude records unintentionally.</li><li><strong>Analyze Recent Imports, Integrations, and Automation Rules:</strong> If the issue persists, examine recent data imports, integrations with other systems, and any automation rules related to Customers. These processes may affect data visibility or integrity.</li><li><strong>Compare Affected Records:</strong> Select one affected customer record and compare it with a correctly functioning record. This comparison can help quickly identify discrepancies or configuration issues causing the problem.</li></ol><div class=\"tip\">💡 Tip: Regularly review your filter settings and access controls to maintain consistent data visibility.</div>",
    "answerAr": "<h2>لماذا لا يعرض العملاء البيانات المتوقعة؟</h2><p>عند مواجهة مشكلة في عدم عرض ميزة <strong>العملاء</strong> للبيانات المتوقعة، من المهم التحقق بشكل منهجي من عدة عوامل لتحديد السبب الجذري.</p><ol><li><strong>تحقق من الفلاتر والفترة الزمنية:</strong> تأكد من إعداد الفلاتر والفترة الزمنية بشكل صحيح. غالبًا ما تكون البيانات مخفية بسبب فلاتر الحالة التي تستبعد سجلات معينة أو لأن الفترة الزمنية المختارة لا تشمل النطاق المطلوب.</li><li><strong>راجع قواعد الملكية وصلاحيات المستخدم:</strong> قد تؤدي إعدادات الملكية وصلاحيات المستخدم إلى تقييد رؤية بيانات العملاء. تحقق من أن دور المستخدم الخاص بك لديه الصلاحيات المناسبة وأن نطاقات الفريق لا تحد من ظهور البيانات.</li><li><strong>افحص الربط بين الحقول وفلاتر الحالة:</strong> قد تؤدي الربطات الناقصة أو الخاطئة بين الحقول إلى إخفاء البيانات أو عرضها بشكل غير صحيح. بالمثل، قد تستبعد فلاتر الحالة السجلات عن غير قصد.</li><li><strong>حلل عمليات الاستيراد والتكاملات وقواعد الأتمتة الأخيرة:</strong> إذا استمرت المشكلة، فراجع عمليات الاستيراد الحديثة، والتكاملات مع الأنظمة الأخرى، وقواعد الأتمتة المتعلقة بالعملاء. قد تؤثر هذه العمليات على رؤية البيانات أو سلامتها.</li><li><strong>قارن السجلات المتأثرة:</strong> اختر سجل عميل متأثرًا وقارنه بسجل يعمل بشكل صحيح. تساعد هذه المقارنة في التعرف بسرعة على الاختلافات أو مشكلات التكوين التي تسبب المشكلة.</li></ol><div class=\"tip\">💡 نصيحة: قم بمراجعة إعدادات الفلاتر وصلاحيات الوصول بانتظام لضمان اتساق ظهور البيانات.</div>",
    "keywords": [
      "customers",
      "العملاء",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "customer-profile-getting-started",
    "categoryId": "sales-customers",
    "sectionId": "customer-profile",
    "questionEn": "How do I start using Customer Profile in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام ملف العميل في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Customer Profile in Tamiyouz CRM</h2><p>To begin utilizing the <strong>Customer Profile</strong> feature effectively within Tamiyouz CRM, follow these structured steps to ensure data integrity and streamlined collaboration:</p><ol><li><strong>Access the Customer Profile Area:</strong> Navigate to the <em>Customer Profile</em> section from the main navigation menu to review all available fields relevant to customer information.</li><li><strong>Set Up Essential Configurations:</strong> Before inviting your team, carefully configure the following:</li><ul><li><strong>Naming Conventions:</strong> Define clear and consistent naming rules to maintain uniformity across customer records.</li><li><strong>Ownership Rules:</strong> Assign ownership controls to specify who is responsible for each customer profile.</li><li><strong>Visibility Settings:</strong> Adjust permissions to control who can view or edit customer data, ensuring privacy and security.</li></ul><li><strong>Test the Workflow:</strong> Create one or two sample customer profiles to simulate real usage. Verify that statuses, notifications, and permissions behave as expected.</li><li><strong>Invite Your Team:</strong> Once testing is complete and configurations are set, invite your team members to start using the Customer Profile feature.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Regularly review and update your ownership and visibility settings to adapt to your team's evolving needs and maintain clean data.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام ملف العميل في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>ملف العميل</strong> بشكل فعال داخل Tamiyouz CRM، اتبع هذه الخطوات المنظمة لضمان سلامة البيانات وتسهيل التعاون:</p><ol><li><strong>الوصول إلى قسم ملف العميل:</strong> انتقل إلى قسم <em>ملف العميل</em> من القائمة الرئيسية لمراجعة جميع الحقول المتاحة المتعلقة بمعلومات العملاء.</li><li><strong>إعداد التكوينات الأساسية:</strong> قبل دعوة فريقك، قم بإعداد ما يلي بدقة:</li><ul><li><strong>قواعد التسمية:</strong> حدد قواعد واضحة ومتسقة للتسمية للحفاظ على توحيد سجلات العملاء.</li><li><strong>قواعد الملكية:</strong> عيّن ضوابط الملكية لتحديد المسؤولين عن كل ملف عميل.</li><li><strong>إعدادات الصلاحيات:</strong> اضبط الأذونات للتحكم في من يمكنه عرض أو تعديل بيانات العملاء، مما يضمن الخصوصية والأمان.</li></ul><li><strong>اختبار سير العمل:</strong> أنشئ سجل أو سجلين تجريبيين للعميل لمحاكاة الاستخدام الفعلي. تحقق من أن الحالات والتنبيهات والصلاحيات تعمل كما هو متوقع.</li><li><strong>دعوة فريقك:</strong> بعد الانتهاء من الاختبار وضبط الإعدادات، قم بدعوة أعضاء فريقك لبدء استخدام ميزة ملف العميل.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> قم بمراجعة وتحديث إعدادات الملكية والصلاحيات بانتظام لتتناسب مع احتياجات فريقك المتغيرة وللحفاظ على نظافة البيانات.</div>",
    "keywords": [
      "customer profile",
      "ملف العميل",
      "sales & customers management",
      "إدارة المبيعات والعملاء",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "customer-profile-troubleshooting",
    "categoryId": "sales-customers",
    "sectionId": "customer-profile",
    "questionEn": "Why is Customer Profile not showing the expected data?",
    "questionAr": "لماذا لا يعرض ملف العميل البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Customer Profile not showing the expected data?</h2>\n<p>The <strong>Customer Profile</strong> feature displays detailed information about your sales customers, but occasionally you may find that the expected data is not visible. To resolve this, follow these troubleshooting steps carefully.</p>\n<h3>Step 1: Verify Filters and Date Range</h3>\n<p>Check if any <strong>filters</strong> are applied that might restrict the displayed data. Common filters include <em>status filters</em> and <em>team scope filters</em> which can hide records unintentionally. Additionally, ensure the <strong>date range</strong> setting covers the period you expect to see data for.</p>\n<h3>Step 2: Review Ownership Rules and User Permissions</h3>\n<p>Ownership rules might limit visibility to certain customer records based on team assignments. Confirm that your <strong>user permissions</strong> allow access to the relevant data within the Customer Profile.</p>\n<h3>Step 3: Examine Data Integrations and Automations</h3>\n<p>If the issue persists, investigate recent <strong>data imports</strong>, <strong>integrations</strong>, or <strong>automation rules</strong> that interact with the Customer Profile. Sometimes these processes can affect data visibility or mappings.</p>\n<h3>Step 4: Compare Records</h3>\n<p>To pinpoint the cause, select one <strong>affected customer record</strong> and compare it against a similar <strong>working record</strong>. Look for differences in status, ownership, or data mappings that could explain the discrepancy.</p>\n<div class=\"tip\">💡 Tip: Regularly review your filters and permissions after updates or changes to maintain accurate data visibility.</div>\n<div class=\"note\">📝 Note: Proper data mapping during imports is crucial to avoid missing information in the Customer Profile.</div>",
    "answerAr": "<h2>لماذا لا يعرض ملف العميل البيانات المتوقعة؟</h2>\n<p>يُعرض <strong>ملف العميل</strong> معلومات مفصلة عن عملائك في قسم المبيعات، ولكن في بعض الأحيان قد لا تظهر البيانات المتوقعة. لحل هذه المشكلة، اتبع خطوات استكشاف الأخطاء التالية بدقة.</p>\n<h3>الخطوة 1: التحقق من الفلاتر والفترة الزمنية</h3>\n<p>تحقق مما إذا كانت هناك <strong>فلاتر</strong> مفعلة قد تحد من عرض البيانات. تشمل الفلاتر الشائعة <em>فلاتر الحالة</em> و<em>نطاق الفريق</em> التي قد تخفي السجلات عن غير قصد. كما تأكد من أن إعداد <strong>الفترة الزمنية</strong> يغطي المدة التي تتوقع ظهور البيانات خلالها.</p>\n<h3>الخطوة 2: مراجعة قواعد الملكية وصلاحيات المستخدم</h3>\n<p>قد تحد قواعد الملكية من إمكانية رؤية بعض سجلات العملاء بناءً على تعيينات الفريق. تحقق من أن <strong>صلاحيات المستخدم</strong> الخاصة بك تسمح بالوصول إلى البيانات ذات الصلة في ملف العميل.</p>\n<h3>الخطوة 3: فحص التكاملات وقواعد الأتمتة</h3>\n<p>إذا استمرت المشكلة، قم بمراجعة <strong>عمليات الاستيراد</strong> الأخيرة، و<strong>التكاملات</strong>، و<strong>قواعد الأتمتة</strong> التي تؤثر على ملف العميل. قد تؤثر هذه العمليات أحيانًا على ظهور البيانات أو على الربط بين الحقول.</p>\n<h3>الخطوة 4: مقارنة السجلات</h3>\n<p>لتحديد السبب بدقة، اختر <strong>سجل عميل متأثر</strong> وقارنه بسجل <strong>يعمل بشكل صحيح</strong>. ابحث عن اختلافات في الحالة، الملكية، أو الربط بين الحقول التي قد تفسر المشكلة.</p>\n<div class=\"tip\">💡 نصيحة: قم بمراجعة الفلاتر والصلاحيات بانتظام بعد التحديثات أو التغييرات للحفاظ على دقة عرض البيانات.</div>\n<div class=\"note\">📝 ملاحظة: الربط الصحيح للبيانات أثناء الاستيراد أمر ضروري لتجنب فقدان المعلومات في ملف العميل.</div>",
    "keywords": [
      "customer profile",
      "ملف العميل",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "campaigns-getting-started",
    "categoryId": "marketing-campaigns",
    "sectionId": "campaigns",
    "questionEn": "How do I start using Campaigns in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام الحملات في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Campaigns in Tamiyouz CRM</h2><p>To begin utilizing the <strong>Campaigns</strong> feature in Tamiyouz CRM, start by navigating to the <strong>Campaigns</strong> area via the main navigation menu. This section is designed to help you manage and monitor your marketing campaigns efficiently.</p><p>First, take some time to review the available fields in the campaign setup. These fields are essential for capturing the necessary campaign data and ensuring consistency.</p><h3>Step-by-Step Setup Process</h3><ol><li><strong>Define Naming Conventions:</strong> Establish clear naming rules for your campaigns to maintain organization and simplify future reporting.</li><li><strong>Set Ownership Rules:</strong> Assign ownership to appropriate team members to clarify responsibility and improve accountability.</li><li><strong>Configure Visibility Settings:</strong> Determine who can view and access each campaign to protect sensitive information and keep your data secure.</li></ol><p>After completing these configuration steps, it is recommended to <strong>test the workflow</strong> with one or two sample records. This testing phase ensures that the campaign statuses update correctly, notifications are sent as expected, and permissions are properly enforced for all users involved.</p><div class=\"tip\">💡 Tip: Regularly review and update your campaign settings to adapt to changing marketing strategies and team structures.</div><div class=\"note\">📝 Note: Proper setup at the beginning will help maintain clean data and facilitate accurate reporting across your campaigns.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام الحملات في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>الحملات</strong> في Tamiyouz CRM، قم أولاً بالدخول إلى قسم <strong>الحملات</strong> من خلال قائمة التنقل الرئيسية. تم تصميم هذا القسم لمساعدتك في إدارة ومتابعة حملاتك التسويقية بشكل فعّال.</p><p>ابدأ بمراجعة الحقول المتاحة ضمن إعدادات الحملة، حيث تعد هذه الحقول ضرورية لجمع البيانات المطلوبة وضمان تناسق المعلومات.</p><h3>خطوات إعداد الحملة</h3><ol><li><strong>تحديد قواعد التسمية:</strong> ضع قواعد واضحة لتسمية الحملات للحفاظ على التنظيم وتسهيل إعداد التقارير المستقبلية.</li><li><strong>تعيين قواعد الملكية:</strong> حدد مالكي الحملات من أعضاء الفريق المناسبين لتعزيز المسؤولية والشفافية.</li><li><strong>تكوين إعدادات الظهور:</strong> حدد من يمكنه عرض والوصول إلى كل حملة لحماية المعلومات الحساسة وضمان أمان البيانات.</li></ol><p>بعد إكمال هذه الخطوات، يُنصح <strong>باختبار سير العمل</strong> باستخدام سجل أو سجلين تجريبيين. تساعد هذه المرحلة على التأكد من تحديث حالة الحملة بصورة صحيحة، وإرسال التنبيهات المتوقعة، وتطبيق الصلاحيات بشكل مناسب لجميع المستخدمين المعنيين.</p><div class=\"tip\">💡 نصيحة: قم بمراجعة وتحديث إعدادات الحملات بانتظام لمواكبة تغييرات الاستراتيجيات التسويقية وهيكلية الفريق.</div><div class=\"note\">📝 ملاحظة: الإعداد الصحيح في البداية يساعد على الحفاظ على بيانات نظيفة ويسهل إعداد تقارير دقيقة لجميع الحملات.</div>",
    "keywords": [
      "campaigns",
      "الحملات",
      "marketing & campaigns",
      "التسويق والحملات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": true
  },
  {
    "id": "campaigns-troubleshooting",
    "categoryId": "marketing-campaigns",
    "sectionId": "campaigns",
    "questionEn": "Why is Campaigns not showing the expected data?",
    "questionAr": "لماذا لا يعرض الحملات البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Campaigns Not Showing the Expected Data?</h2><p>When you find that the <strong>Campaigns</strong> feature is not displaying the expected data, several underlying factors could be the cause. Begin by thoroughly checking the following:</p><ul><li><strong>Filters:</strong> Status filters can inadvertently hide relevant campaign records.</li><li><strong>Date Range:</strong> Ensure the selected date range covers the period of the campaigns you want to view.</li><li><strong>Ownership Rules:</strong> Verify that ownership settings do not restrict data visibility.</li><li><strong>User Permissions:</strong> Confirm that your user role has the necessary permissions to access campaign data.</li></ul><p>In many cases, although the data exists, it may be concealed due to the above criteria or due to team scope limitations and missing field mappings.</p><div class=\"tip\">💡 Tip: Adjust filters and expand date ranges to widen your data search.</div><p>If the problem persists, proceed with a detailed review of:</p><ul><li>Recent data imports related to campaigns.</li><li>Active integrations that might affect campaign data flow.</li><li>Automation rules configured for campaigns.</li></ul><p>To diagnose the issue efficiently, compare a campaign record that is not displaying correctly against one that is functioning properly. This comparison can help you quickly identify discrepancies and resolve the problem.</p>",
    "answerAr": "<h2>لماذا لا يعرض قسم الحملات البيانات المتوقعة؟</h2><p>عندما تلاحظ أن ميزة <strong>الحملات</strong> لا تعرض البيانات المتوقعة، فقد يكون السبب عدة عوامل أساسية. ابدأ بالتحقق بدقة من الأمور التالية:</p><ul><li><strong>الفلاتر:</strong> قد تخفي فلاتر الحالة سجلات الحملات ذات الصلة دون قصد.</li><li><strong>الفترة الزمنية:</strong> تأكد من أن الفترة الزمنية المحددة تغطي فترة الحملات التي ترغب في عرضها.</li><li><strong>قواعد الملكية:</strong> تحقق من أن إعدادات الملكية لا تقيد رؤية البيانات.</li><li><strong>صلاحيات المستخدم:</strong> تأكد من أن دور المستخدم الخاص بك يمتلك الصلاحيات اللازمة للوصول إلى بيانات الحملات.</li></ul><p>في كثير من الحالات، تكون البيانات موجودة لكنها مخفية بسبب المعايير المذكورة أعلاه أو بسبب حدود نطاق الفريق ونقص الربط بين الحقول.</p><div class=\"tip\">💡 نصيحة: قم بتعديل الفلاتر وتوسيع الفترات الزمنية لتوسيع نطاق البحث عن البيانات.</div><p>إذا استمرت المشكلة، تابع بمراجعة مفصلة لـ:</p><ul><li>آخر عمليات استيراد البيانات المتعلقة بالحملات.</li><li>التكاملات النشطة التي قد تؤثر على تدفق بيانات الحملات.</li><li>قواعد الأتمتة المطبقة على الحملات.</li></ul><p>لتشخيص المشكلة بفعالية، قارن سجل حملة لا يعرض بشكل صحيح مع سجل يعمل بشكل سليم. يمكن أن تساعدك هذه المقارنة في تحديد الاختلافات وحل المشكلة بسرعة.</p>",
    "keywords": [
      "campaigns",
      "الحملات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "meta-campaigns-getting-started",
    "categoryId": "marketing-campaigns",
    "sectionId": "meta-campaigns",
    "questionEn": "How do I start using Meta Campaigns in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام حملات ميتا في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Meta Campaigns in Tamiyouz CRM</h2><p>To effectively utilize the <strong>Meta Campaigns</strong> feature within Tamiyouz CRM, begin by accessing the Meta Campaigns section from the main navigation menu. This area provides a comprehensive overview of all relevant fields and settings necessary for your campaign management.</p><p>Follow these essential setup steps to ensure your campaigns run smoothly and data remains consistent:</p><ol><li><strong>Define Naming Conventions:</strong> Establish clear and standardized naming rules for your campaigns to maintain uniformity and facilitate easier tracking.</li><li><strong>Set Ownership Rules:</strong> Assign responsible users or teams to each campaign to clarify accountability and improve collaboration.</li><li><strong>Configure Visibility Settings:</strong> Control who can view or edit campaign data to protect sensitive information and streamline user access.</li></ol><p>After completing the configuration, it is critical to <strong>test the workflow</strong> by creating one or two sample campaign records. This testing phase helps verify that campaign statuses update correctly, notifications are triggered as expected, and permission levels align with your organizational policies.</p><div class=\"tip\">💡 Tip: Regularly review and update your setup as your marketing strategies evolve to keep your Meta Campaigns optimized.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام حملات ميتا في Tamiyouz CRM</h2><p>للاستفادة الفعّالة من ميزة <strong>حملات ميتا</strong> داخل Tamiyouz CRM، ابدأ بالدخول إلى قسم حملات ميتا من قائمة التنقل الرئيسية. يوفر هذا القسم نظرة شاملة على جميع الحقول والإعدادات المتعلقة بإدارة حملاتك.</p><p>اتبع هذه الخطوات الأساسية لضمان سير الحملات بسلاسة والحفاظ على اتساق البيانات:</p><ol><li><strong>تحديد قواعد التسمية:</strong> ضع قواعد واضحة وموحدة لأسماء الحملات للحفاظ على التنسيق وتسهل عملية التتبع.</li><li><strong>تعيين قواعد الملكية:</strong> قم بتحديد المستخدمين أو الفرق المسؤولة عن كل حملة لتوضيح المسؤوليات وتعزيز التعاون.</li><li><strong>ضبط إعدادات الظهور:</strong> تحكم في من يمكنه مشاهدة أو تعديل بيانات الحملة لحماية المعلومات الحساسة وتبسيط صلاحيات الوصول.</li></ol><p>بعد إتمام الإعداد، من الضروري <strong>اختبار سير العمل</strong> من خلال إنشاء سجل أو اثنين كعينات للحملات. تساعد هذه المرحلة في التأكد من تحديث حالات الحملات بشكل صحيح، وتنشيط التنبيهات كما هو متوقع، وتوافق مستويات الصلاحيات مع سياسات المؤسسة.</p><div class=\"tip\">💡 نصيحة: قم بمراجعة وتحديث الإعدادات بانتظام مع تطور استراتيجيات التسويق لديك للحفاظ على تحسين حملات ميتا.</div>",
    "keywords": [
      "meta campaigns",
      "حملات ميتا",
      "marketing & campaigns",
      "التسويق والحملات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "meta-campaigns-troubleshooting",
    "categoryId": "marketing-campaigns",
    "sectionId": "meta-campaigns",
    "questionEn": "Why is Meta Campaigns not showing the expected data?",
    "questionAr": "لماذا لا يعرض حملات ميتا البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Meta Campaigns Not Showing the Expected Data?</h2><p>When you encounter issues with <strong>Meta Campaigns</strong> not displaying the expected data, several factors could be affecting the visibility and accuracy of your campaign information. Follow these steps to troubleshoot effectively:</p><ol><li><strong>Verify Filters and Date Range:</strong> Ensure that all applied filters, including status filters, and the selected date range are set correctly. Incorrect or overly restrictive filters can hide relevant data.</li><li><strong>Check Ownership Rules and User Permissions:</strong> Confirm that your user role has sufficient permissions to view the data and that ownership rules are properly configured to include your account or team scope.</li><li><strong>Review Team Scope:</strong> Data may be limited based on your team's scope or access rights, so verify that you are viewing within the correct organizational boundaries.</li><li><strong>Inspect Data Mappings:</strong> Missing or incorrect field mappings can cause data to not appear as expected. Check that the Meta Campaigns fields are correctly mapped within the system.</li><li><strong>Evaluate Recent Imports and Integrations:</strong> If data is still missing, review any recent data imports or integrations related to Meta Campaigns that might have affected data synchronization.</li><li><strong>Analyze Automation Rules:</strong> Automation rules impacting Meta Campaigns may alter data visibility or status. Review these rules for any unintended effects.</li><li><strong>Compare Records:</strong> To quickly identify discrepancies, compare a record that is not showing data properly with one that is functioning correctly.</li></ol><div class=\"tip\">💡 Tip: Regularly auditing your filters and integrations helps maintain accurate and up-to-date campaign data.</div><div class=\"note\">📝 Note: Access permissions and ownership settings are common causes for data visibility issues in Meta Campaigns.</div>",
    "answerAr": "<h2>لماذا لا يعرض حملات ميتا البيانات المتوقعة؟</h2><p>عند مواجهة مشكلة في <strong>حملات ميتا</strong> وعدم ظهور البيانات المتوقعة، هناك عدة عوامل قد تؤثر على رؤية ودقة معلومات الحملة الخاصة بك. اتبع الخطوات التالية لاستكشاف المشكلة بفعالية:</p><ol><li><strong>تحقق من الفلاتر والفترة الزمنية:</strong> تأكد من صحة جميع الفلاتر المطبقة، بما في ذلك فلاتر الحالة، والفترة الزمنية المختارة. قد تؤدي الفلاتر غير الصحيحة أو المقيدة بشدة إلى إخفاء البيانات ذات الصلة.</li><li><strong>مراجعة قواعد الملكية وصلاحيات المستخدم:</strong> تأكد من أن دور المستخدم الخاص بك يمتلك الصلاحيات الكافية لرؤية البيانات وأن قواعد الملكية مُعدة بشكل صحيح لتشمل حسابك أو نطاق الفريق.</li><li><strong>التحقق من نطاق الفريق:</strong> قد تقتصر البيانات بناءً على نطاق فريقك أو حقوق الوصول الخاصة بك، لذا تحقق من أنك تعرض البيانات ضمن الحدود التنظيمية الصحيحة.</li><li><strong>فحص ربط الحقول:</strong> قد يؤدي نقص أو خطأ في ربط الحقول إلى عدم ظهور البيانات كما هو متوقع. تحقق من أن حقول حملات ميتا مرتبطة بشكل صحيح داخل النظام.</li><li><strong>مراجعة عمليات الاستيراد والتكاملات الأخيرة:</strong> إذا استمرت البيانات في الاختفاء، راجع أي عمليات استيراد بيانات أو تكاملات حديثة مرتبطة بحملات ميتا والتي قد تكون أثرت على تزامن البيانات.</li><li><strong>تحليل قواعد الأتمتة:</strong> قد تؤثر قواعد الأتمتة التي تؤثر على حملات ميتا في ظهور أو حالة البيانات. راجع هذه القواعد للتأكد من عدم وجود تأثيرات غير مقصودة.</li><li><strong>مقارنة السجلات:</strong> لتحديد الفروقات بسرعة، قارن بين سجل لا يظهر البيانات بشكل صحيح وآخر يعمل بشكل سليم.</li></ol><div class=\"tip\">💡 نصيحة: تدقيق الفلاتر والتكاملات بشكل دوري يساعد على الحفاظ على بيانات الحملة دقيقة ومحدثة.</div><div class=\"note\">📝 ملاحظة: صلاحيات الوصول وقواعد الملكية من الأسباب الشائعة لمشاكل رؤية البيانات في حملات ميتا.</div>",
    "keywords": [
      "meta campaigns",
      "حملات ميتا",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "tiktok-campaigns-getting-started",
    "categoryId": "marketing-campaigns",
    "sectionId": "tiktok-campaigns",
    "questionEn": "How do I start using TikTok Campaigns in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام حملات تيك توك في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using TikTok Campaigns in Tamiyouz CRM</h2><p>To begin leveraging the <strong>TikTok Campaigns</strong> feature within Tamiyouz CRM, follow a structured setup process to ensure effectiveness and data integrity.</p><ol><li><strong>Access the TikTok Campaigns Area:</strong> Navigate to the main menu and select the TikTok Campaigns section to explore the available fields and options.</li><li><strong>Configure Essential Settings:</strong> Begin by establishing <em>naming conventions</em> to standardize campaign titles, define <em>ownership rules</em> to assign responsibility, and set <em>visibility permissions</em> to control who can access campaign data. This foundational setup keeps your data organized and facilitates accurate reporting.</li><li><strong>Invite Your Team:</strong> Once initial configurations are complete, invite team members to collaborate on campaigns, ensuring they understand their roles and access rights.</li><li><strong>Conduct Workflow Testing:</strong> Create one or two sample campaign records to test the workflow. Verify that campaign statuses update as expected, notifications are triggered correctly, and permissions are enforced according to setup.</li></ol><div class=\"tip\">💡 Tip: Regularly review and update ownership and visibility settings as your team and campaign needs evolve to maintain clean and secure data management.</div><div class=\"note\">📝 Note: Proper initial setup reduces errors and streamlines campaign reporting and analysis.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام حملات تيك توك في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>حملات تيك توك</strong> ضمن Tamiyouz CRM، اتبع عملية إعداد منظمة لضمان الفعالية وسلامة البيانات.</p><ol><li><strong>الوصول إلى قسم حملات تيك توك:</strong> انتقل إلى القائمة الرئيسية واختر قسم حملات تيك توك لاستعراض الحقول والخيارات المتاحة.</li><li><strong>ضبط الإعدادات الأساسية:</strong> ابدأ بوضع <em>قواعد التسمية</em> لتوحيد عناوين الحملات، وتعريف <em>قواعد الملكية</em> لتحديد المسؤوليات، وتعيين <em>صلاحيات الظهور</em> للتحكم في من يمكنه الوصول إلى بيانات الحملات. هذا الإعداد الأساسي يحافظ على تنظيم البيانات ويسهل إعداد التقارير بدقة.</li><li><strong>دعوة الفريق:</strong> بعد إكمال الإعدادات الأولية، قم بدعوة أعضاء الفريق للتعاون في الحملات مع توضيح أدوارهم وصلاحياتهم.</li><li><strong>اختبار سير العمل:</strong> أنشئ سجل أو سجلين تجريبيين للحملات لاختبار سير العمل. تحقق من تحديث حالات الحملات كما هو متوقع، وتنشيط التنبيهات بشكل صحيح، وتطبيق الصلاحيات وفقاً للإعدادات.</li></ol><div class=\"tip\">💡 نصيحة: قم بمراجعة وتحديث قواعد الملكية وصلاحيات الظهور بانتظام مع تطور فريقك واحتياجات الحملات للحفاظ على إدارة بيانات نظيفة وآمنة.</div><div class=\"note\">📝 ملاحظة: الإعداد الصحيح في البداية يقلل الأخطاء ويسهل إعداد تقارير وتحليل الحملات.</div>",
    "keywords": [
      "tiktok campaigns",
      "حملات تيك توك",
      "marketing & campaigns",
      "التسويق والحملات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "tiktok-campaigns-troubleshooting",
    "categoryId": "marketing-campaigns",
    "sectionId": "tiktok-campaigns",
    "questionEn": "Why is TikTok Campaigns not showing the expected data?",
    "questionAr": "لماذا لا يعرض حملات تيك توك البيانات المتوقعة؟",
    "answerEn": "<h2>Why is TikTok Campaigns not showing the expected data?</h2><p>When you notice that your <strong>TikTok Campaigns</strong> data is not displaying as expected, several factors could be causing this issue. Start by thoroughly checking the <strong>filters</strong> applied to your view, including the <strong>date range</strong>, <strong>ownership rules</strong>, and <strong>user permissions</strong>. Often, the data exists but is hidden due to restrictive status filters, limited team scope, or missing mappings between TikTok data fields and your CRM.</p><p>To troubleshoot further:</p><ol><li><strong>Review Filters and Date Range:</strong> Ensure that the filters applied do not exclude relevant campaign data. Adjust the date range to cover the entire period of interest.</li><li><strong>Verify Ownership and Permissions:</strong> Confirm that your user account has the necessary permissions and that ownership rules are not limiting data visibility.</li><li><strong>Inspect Recent Imports and Integrations:</strong> Examine recent data imports and integrations related to TikTok Campaigns to ensure they are functioning correctly and up to date.</li><li><strong>Check Automation Rules:</strong> Review any automation rules that might affect how TikTok Campaign data is processed or displayed.</li><li><strong>Compare Records:</strong> Identify one record that is affected and compare it against a correctly displaying record to spot discrepancies quickly.</li></ol><div class=\"tip\">💡 Tip: Regularly auditing your filters and integration settings can prevent data visibility issues before they arise.</div><div class=\"note\">📝 Note: Changes in TikTok’s API or CRM mappings may require updates to your integration setup.</div>",
    "answerAr": "<h2>لماذا لا يعرض حملات تيك توك البيانات المتوقعة؟</h2><p>عندما تلاحظ أن بيانات <strong>حملات تيك توك</strong> لا تظهر كما هو متوقع، فقد تكون هناك عدة أسباب لهذه المشكلة. ابدأ بفحص <strong>الفلاتر</strong> المطبقة على العرض الخاص بك، بما في ذلك <strong>الفترة الزمنية</strong>، <strong>قواعد الملكية</strong>، و<strong>صلاحيات المستخدم</strong>. غالبًا ما تكون البيانات موجودة لكنها مخفية بسبب فلاتر الحالة المقيدة، نطاق الفريق المحدود، أو نقص الربط بين حقول بيانات تيك توك ونظام إدارة علاقات العملاء الخاص بك.</p><p>للمزيد من استكشاف الأخطاء وإصلاحها:</p><ol><li><strong>راجع الفلاتر والفترة الزمنية:</strong> تأكد من أن الفلاتر المطبقة لا تستبعد بيانات الحملات ذات الصلة. قم بضبط الفترة الزمنية لتشمل كامل الفترة المطلوبة.</li><li><strong>تحقق من الملكية والصلاحيات:</strong> تأكد من أن حساب المستخدم الخاص بك يمتلك الصلاحيات اللازمة وأن قواعد الملكية لا تقيد رؤية البيانات.</li><li><strong>افحص عمليات الاستيراد والتكامل الأخيرة:</strong> تحقق من أن عمليات الاستيراد والتكامل المتعلقة بحملات تيك توك تعمل بشكل صحيح ومحدثة.</li><li><strong>راجع قواعد الأتمتة:</strong> تحقق من أي قواعد أتمتة قد تؤثر على كيفية معالجة أو عرض بيانات حملات تيك توك.</li><li><strong>قارن السجلات:</strong> حدد سجلًا متأثرًا وقارنه بسجل يعرض البيانات بشكل صحيح لاكتشاف الفروقات بسرعة.</li></ol><div class=\"tip\">💡 نصيحة: التدقيق المنتظم في الفلاتر وإعدادات التكامل يمكن أن يمنع مشاكل رؤية البيانات قبل حدوثها.</div><div class=\"note\">📝 ملاحظة: قد تتطلب التحديثات في واجهة برمجة تطبيقات تيك توك أو خرائط النظام تحديث إعدادات التكامل الخاصة بك.</div>",
    "keywords": [
      "tiktok campaigns",
      "حملات تيك توك",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "campaign-analytics-getting-started",
    "categoryId": "marketing-campaigns",
    "sectionId": "campaign-analytics",
    "questionEn": "How do I start using Campaign Analytics in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام تحليلات الحملات في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Campaign Analytics in Tamiyouz CRM</h2><p>To effectively utilize the <strong>Campaign Analytics</strong> feature within Tamiyouz CRM, follow these structured steps to ensure accurate data tracking and reporting:</p><ol><li><strong>Access Campaign Analytics:</strong> Navigate to the <em>Campaign Analytics</em> section via the main navigation menu.</li><li><strong>Review Available Fields:</strong> Examine all the data fields provided to understand what information will be captured and reported.</li><li><strong>Complete Initial Setup:</strong> Configure essential settings including:</li><ul><li><strong>Naming Conventions:</strong> Establish standardized names for campaigns to maintain consistency.</li><li><strong>Ownership Rules:</strong> Define who owns each campaign to assign accountability.</li><li><strong>Visibility Settings:</strong> Set permissions to control who can view and edit campaign data.</li></ul><li><strong>Test Your Workflow:</strong> Run a pilot test with one or two sample campaign records to verify that statuses, notifications, and permissions function as expected.</li><li><strong>Invite Your Team:</strong> Once testing confirms everything is working properly, invite team members to start using the analytics tools for their campaigns.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Maintaining clear ownership and consistent naming conventions ensures your campaign data remains clean and easy to analyze.</div><div class=\"note\">📝 <strong>Note:</strong> Proper initial setup helps prevent data discrepancies and improves reporting accuracy.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام تحليلات الحملات في Tamiyouz CRM</h2><p>للاستفادة الفعالة من ميزة <strong>تحليلات الحملات</strong> داخل Tamiyouz CRM، اتبع الخطوات المنظمة التالية لضمان تتبع البيانات والتقارير بدقة:</p><ol><li><strong>الوصول إلى تحليلات الحملات:</strong> انتقل إلى قسم <em>تحليلات الحملات</em> من خلال قائمة التنقل الرئيسية.</li><li><strong>مراجعة الحقول المتاحة:</strong> تفقد جميع حقول البيانات المتوفرة لفهم المعلومات التي سيتم جمعها والإبلاغ عنها.</li><li><strong>إكمال الإعدادات الأولية:</strong> قم بضبط الإعدادات الأساسية بما في ذلك:</li><ul><li><strong>قواعد التسمية:</strong> وضع أسماء موحدة للحملات للحفاظ على الاتساق.</li><li><strong>قواعد الملكية:</strong> تحديد من يملك كل حملة لتعيين المسؤولية.</li><li><strong>إعدادات الصلاحيات:</strong> ضبط من يمكنه رؤية وتحرير بيانات الحملات.</li></ul><li><strong>اختبر سير العمل:</strong> قم بتجربة مبدئية على سجل أو سجلين من الحملات للتأكد من أن الحالات والتنبيهات والصلاحيات تعمل كما هو متوقع.</li><li><strong>دعوة الفريق:</strong> بعد التأكد من صحة سير العمل، قم بدعوة أعضاء الفريق لبدء استخدام أدوات التحليل للحملات الخاصة بهم.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> الحفاظ على ملكية واضحة وقواعد تسمية موحدة يضمن بقاء بيانات الحملات نظيفة وسهلة التحليل.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> الإعداد الصحيح في البداية يساعد على تجنب التناقضات في البيانات ويحسن دقة التقارير.</div>",
    "keywords": [
      "campaign analytics",
      "تحليلات الحملات",
      "marketing & campaigns",
      "التسويق والحملات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "campaign-analytics-troubleshooting",
    "categoryId": "marketing-campaigns",
    "sectionId": "campaign-analytics",
    "questionEn": "Why is Campaign Analytics not showing the expected data?",
    "questionAr": "لماذا لا يعرض تحليلات الحملات البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Campaign Analytics Not Showing the Expected Data?</h2><p>When you notice that <strong>Campaign Analytics</strong> is not displaying the data you expect, it is essential to perform a systematic check of several factors to diagnose the issue effectively.</p><ol><li><strong>Verify Filters and Date Range:</strong> Ensure that the applied filters and the selected date range accurately reflect the period and criteria you want to analyze. Often, incorrect or overly restrictive filters may hide relevant data.</li><li><strong>Check Ownership and Permissions:</strong> Review the ownership rules and user permissions. Data visibility in Campaign Analytics depends on these settings, and insufficient permissions or scope restrictions can prevent data from appearing.</li><li><strong>Inspect Status Filters and Team Scope:</strong> Data might exist but be concealed due to active status filters or the team scope settings limiting the view to certain records.</li><li><strong>Review Mappings:</strong> Missing or incorrect field mappings can cause data to not appear properly. Confirm that all relevant fields are correctly mapped within your campaign setup.</li><li><strong>Analyze Recent Imports, Integrations, and Automation Rules:</strong> If the issue persists, examine any recent data imports, third-party integrations, or automation workflows that interact with Campaign Analytics. These processes might affect data availability or accuracy.</li><li><strong>Compare Records:</strong> Select one record that is not showing data correctly and compare it against a record that displays as expected. This comparison can quickly highlight discrepancies that explain the issue.</li></ol><div class=\"tip\">💡 Tip: Regularly auditing your filters, permissions, and automation rules helps maintain accurate and comprehensive campaign analytics data.</div>",
    "answerAr": "<h2>لماذا لا يعرض تحليلات الحملات البيانات المتوقعة؟</h2><p>عند ملاحظة أن <strong>تحليلات الحملات</strong> لا تعرض البيانات المتوقعة، من الضروري إجراء فحص منهجي لعدة عوامل لتشخيص المشكلة بشكل فعال.</p><ol><li><strong>تحقق من الفلاتر والفترة الزمنية:</strong> تأكد من أن الفلاتر المطبقة والفترة الزمنية المختارة تعكس بدقة الفترة والمعايير التي تريد تحليلها. غالباً ما تؤدي الفلاتر غير الصحيحة أو المقيدة بشكل مفرط إلى إخفاء البيانات ذات الصلة.</li><li><strong>راجع قواعد الملكية والصلاحيات:</strong> تحقق من قواعد الملكية وصلاحيات المستخدم. تعتمد رؤية البيانات في تحليلات الحملات على هذه الإعدادات، وقد تمنع الصلاحيات غير الكافية أو القيود على النطاق ظهور البيانات.</li><li><strong>افحص فلاتر الحالة ونطاق الفريق:</strong> قد تكون البيانات موجودة لكنها مخفية بسبب فلاتر الحالة النشطة أو إعدادات نطاق الفريق التي تحد من عرض سجلات معينة فقط.</li><li><strong>راجع الربط بين الحقول:</strong> قد يؤدي الربط الناقص أو الخاطئ للحقول إلى عدم ظهور البيانات بشكل صحيح. تأكد من أن جميع الحقول ذات الصلة مرتبطة بشكل صحيح داخل إعداد الحملة.</li><li><strong>حلل عمليات الاستيراد الأخيرة والتكاملات وقواعد الأتمتة:</strong> إذا استمرت المشكلة، افحص أي عمليات استيراد بيانات حديثة أو تكاملات مع أطراف ثالثة أو قواعد أتمتة تتفاعل مع تحليلات الحملات. قد تؤثر هذه العمليات على توفر أو دقة البيانات.</li><li><strong>قارن بين السجلات:</strong> اختر سجلاً لا يعرض البيانات بشكل صحيح وقارنه بسجل يظهر بشكل سليم. يمكن لهذا الفحص السريع أن يبرز الفروقات التي تشرح المشكلة.</li></ol><div class=\"tip\">💡 نصيحة: يساعد التدقيق الدوري للفلاتر والصلاحيات وقواعد الأتمتة في الحفاظ على بيانات تحليلات الحملات دقيقة وشاملة.</div>",
    "keywords": [
      "campaign analytics",
      "تحليلات الحملات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "meta-integration-getting-started",
    "categoryId": "marketing-campaigns",
    "sectionId": "meta-integration",
    "questionEn": "How do I start using Meta Integration in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام تكامل ميتا في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Meta Integration in Tamiyouz CRM</h2><p>To begin leveraging the <strong>Meta Integration</strong> feature within Tamiyouz CRM, follow these detailed steps to ensure a smooth setup and effective collaboration:</p><ol><li><strong>Access the Meta Integration Area:</strong> Navigate to the Meta Integration section from the main navigation menu of your CRM dashboard.</li><li><strong>Review Available Fields:</strong> Familiarize yourself with the fields provided to understand what data points will be synchronized or managed.</li><li><strong>Complete Required Setup:</strong> Configure essential settings such as <strong>naming conventions</strong>, <strong>ownership rules</strong>, and <strong>visibility settings</strong>. These configurations are critical to maintaining clean data and facilitating accurate reporting.</li><li><strong>Invite Your Team:</strong> Once the setup is complete, invite team members to use the integration, ensuring that everyone understands the configured rules.</li><li><strong>Test the Workflow:</strong> Before full deployment, perform testing using one or two sample records. Confirm that the status updates, notifications, and permissions behave as expected to avoid disruptions.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Regularly review and update ownership and visibility rules to adapt to your team's evolving needs and maintain data integrity.</div><div class=\"note\">📝 <strong>Note:</strong> Proper initial configuration of Meta Integration significantly reduces errors and enhances your marketing campaign management.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام تكامل ميتا في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>تكامل ميتا</strong> في Tamiyouz CRM، اتبع الخطوات التفصيلية التالية لضمان إعداد سلس وتعاون فعال:</p><ol><li><strong>الوصول إلى قسم تكامل ميتا:</strong> افتح قسم تكامل ميتا من قائمة التنقل الرئيسية في لوحة تحكم النظام.</li><li><strong>مراجعة الحقول المتاحة:</strong> تعرف على الحقول المتوفرة لفهم نقاط البيانات التي سيتم مزامنتها أو إدارتها.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> قم بضبط الإعدادات الأساسية مثل <strong>قواعد التسمية</strong>، <strong>قواعد الملكية</strong>، و<strong>إعدادات الظهور</strong>. هذه الإعدادات ضرورية للحفاظ على بيانات نظيفة وتسهل إعداد التقارير بدقة.</li><li><strong>دعوة الفريق:</strong> بعد الانتهاء من الإعداد، قم بدعوة أعضاء الفريق لاستخدام التكامل مع توضيح القواعد التي تم ضبطها.</li><li><strong>اختبار سير العمل:</strong> قبل التنفيذ الكامل، قم بتجربة سير العمل على سجل أو سجليْن للتأكد من أن تحديثات الحالة، والتنبيهات، والصلاحيات تعمل كما هو متوقع لتجنب أي مشكلات.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> قم بمراجعة وتحديث قواعد الملكية والظهور بانتظام لتتناسب مع احتياجات فريقك المتغيرة وللحفاظ على سلامة البيانات.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> الإعداد الصحيح لتكامل ميتا في البداية يقلل من الأخطاء ويعزز إدارة حملاتك التسويقية.</div>",
    "keywords": [
      "meta integration",
      "تكامل ميتا",
      "marketing & campaigns",
      "التسويق والحملات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "meta-integration-troubleshooting",
    "categoryId": "marketing-campaigns",
    "sectionId": "meta-integration",
    "questionEn": "Why is Meta Integration not showing the expected data?",
    "questionAr": "لماذا لا يعرض تكامل ميتا البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Meta Integration Not Showing the Expected Data?</h2><p>When encountering issues with <strong>Meta Integration</strong> not displaying the expected data within your marketing campaigns, several factors should be examined to diagnose and resolve the problem effectively.</p><ol><li><strong>Verify Filters and Date Range:</strong> Ensure that the applied filters, including status filters and date ranges, are correctly set to capture the relevant data. Often, data may exist but become hidden due to overly restrictive filters or incorrect date selections.</li><li><strong>Check Ownership and User Permissions:</strong> Review the ownership rules and user permissions to confirm that you have access to view the necessary records. Restrictions here can prevent data visibility.</li><li><strong>Review Team Scope Settings:</strong> Confirm that the team scope settings align with your expected data view, as data might be limited to specific teams or users.</li><li><strong>Analyze Mappings:</strong> Missing or incorrect field mappings between Meta Integration and your CRM can cause data not to appear as expected. Validate that all required mappings are properly configured.</li><li><strong>Inspect Recent Imports and Integrations:</strong> Look into recent data imports, integration processes, and automation rules related to Meta Integration. Errors or misconfigurations during these processes can affect data availability.</li><li><strong>Compare Records:</strong> To identify discrepancies, compare an affected record against one that is displaying correctly. This can help pinpoint differences quickly and inform corrective actions.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Regularly auditing your integration settings and permissions helps maintain accurate data synchronization and visibility.</div>",
    "answerAr": "<h2>لماذا لا يعرض تكامل ميتا البيانات المتوقعة؟</h2><p>عند مواجهة مشاكل في <strong>تكامل ميتا</strong> وعدم ظهور البيانات المتوقعة ضمن حملات التسويق الخاصة بك، يجب فحص عدة عوامل لتشخيص المشكلة وحلها بكفاءة.</p><ol><li><strong>تحقق من الفلاتر والفترة الزمنية:</strong> تأكد من أن الفلاتر المطبقة، بما في ذلك فلاتر الحالة والفترات الزمنية، مضبوطة بشكل صحيح لالتقاط البيانات ذات الصلة. غالباً ما تكون البيانات موجودة لكنها مخفية بسبب فلاتر مفرطة التقييد أو اختيار فترة زمنية غير صحيحة.</li><li><strong>راجع قواعد الملكية وصلاحيات المستخدم:</strong> تحقق من قواعد الملكية وصلاحيات المستخدم لضمان أن لديك حق الوصول لرؤية السجلات اللازمة. يمكن أن تمنع القيود هنا رؤية البيانات.</li><li><strong>افحص إعدادات نطاق الفريق:</strong> تأكد من توافق إعدادات نطاق الفريق مع طريقة عرض البيانات المتوقعة، حيث قد تكون البيانات محدودة لفريق أو مستخدمين معينين.</li><li><strong>تحليل الربط بين الحقول:</strong> يمكن أن يؤدي الربط الناقص أو غير الصحيح بين تكامل ميتا ونظام إدارة علاقات العملاء إلى عدم ظهور البيانات كما هو متوقع. تحقق من تكوين جميع الروابط المطلوبة بشكل صحيح.</li><li><strong>راجع عمليات الاستيراد والتكاملات الأخيرة:</strong> تحقق من عمليات استيراد البيانات، عمليات التكامل، وقواعد الأتمتة المرتبطة بتكامل ميتا. يمكن أن تؤثر الأخطاء أو الإعدادات غير الصحيحة خلال هذه العمليات على توافر البيانات.</li><li><strong>قارن السجلات:</strong> لتحديد الفروقات، قارن سجلاً متأثراً بسجل يظهر بشكل صحيح. هذا يساعد في تحديد الفروقات بسرعة واتخاذ الإجراءات التصحيحية.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> يساعد التدقيق المنتظم لإعدادات التكامل والصلاحيات في الحفاظ على تزامن البيانات ودقتها.</div>",
    "keywords": [
      "meta integration",
      "تكامل ميتا",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "tiktok-integration-getting-started",
    "categoryId": "marketing-campaigns",
    "sectionId": "tiktok-integration",
    "questionEn": "How do I start using TikTok Integration in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام تكامل تيك توك في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using TikTok Integration in Tamiyouz CRM</h2><p>To begin leveraging the <strong>TikTok Integration</strong> feature within Tamiyouz CRM, follow these structured steps to ensure an optimal setup and smooth workflow:</p><ol><li><strong>Access the Integration Module:</strong> Navigate to the <em>TikTok Integration</em> section via the main navigation menu. This centralized area provides all relevant settings and data fields.</li><li><strong>Review Available Fields:</strong> Examine the preconfigured data fields that synchronize with TikTok to understand what information will be exchanged.</li><li><strong>Complete Required Setup:</strong> Configure essential parameters including:</li><ul><li><strong>Naming Conventions:</strong> Define consistent naming rules for records to maintain clarity and uniformity.</li><li><strong>Ownership Rules:</strong> Assign data ownership to appropriate team members to streamline accountability.</li><li><strong>Visibility Settings:</strong> Set permissions to control who can view or modify TikTok-related data, ensuring data security and privacy.</li></ul><li><strong>Invite Team Members:</strong> Once the setup is finalized, invite relevant team members to collaborate using the integration.</li><li><strong>Test the Workflow:</strong> Run tests with one or two sample records to verify that statuses update correctly, notifications are sent as expected, and permissions are enforced properly.</li></ol><div class=\"tip\">💡 Tip: Regularly review integration settings to keep data consistent and adapt to any changes in TikTok’s API or your marketing strategies.</div><div class=\"note\">📝 Note: Proper initial configuration reduces errors and enhances reporting accuracy across your marketing campaigns.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام تكامل تيك توك في Tamiyouz CRM</h2><p>لبدء الاستفادة من ميزة <strong>تكامل تيك توك</strong> داخل Tamiyouz CRM، اتبع هذه الخطوات المنظمة لضمان إعداد مثالي وسير عمل سلس:</p><ol><li><strong>الوصول إلى وحدة التكامل:</strong> انتقل إلى قسم <em>تكامل تيك توك</em> عبر قائمة التنقل الرئيسية. يوفر هذا القسم جميع الإعدادات والحقول المتعلقة بالتكامل.</li><li><strong>مراجعة الحقول المتاحة:</strong> استعرض الحقول المعرفة مسبقًا التي تتزامن مع تيك توك لفهم نوع المعلومات التي سيتم تبادلها.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> قم بتكوين المعايير الأساسية مثل:</li><ul><li><strong>قواعد التسمية:</strong> حدد قواعد تسمية موحدة للسجلات للحفاظ على الوضوح والاتساق.</li><li><strong>قواعد الملكية:</strong> خصص ملكية البيانات لأعضاء الفريق المناسبين لتسهيل المسؤولية والمتابعة.</li><li><strong>إعدادات الظهور:</strong> اضبط الصلاحيات للتحكم بمن يمكنه عرض أو تعديل البيانات المتعلقة بتيك توك، مما يضمن أمان البيانات وخصوصيتها.</li></ul><li><strong>دعوة أعضاء الفريق:</strong> بعد الانتهاء من الإعدادات، قم بدعوة الأعضاء المعنيين للتعاون باستخدام التكامل.</li><li><strong>اختبار سير العمل:</strong> نفذ اختبارات على سجل أو سجلين للتأكد من تحديث الحالات بشكل صحيح، وإرسال التنبيهات كما هو متوقع، وتطبيق الصلاحيات بدقة.</li></ol><div class=\"tip\">💡 نصيحة: قم بمراجعة إعدادات التكامل بانتظام للحفاظ على تناسق البيانات والتكيف مع أي تغييرات في واجهة برمجة تطبيقات تيك توك أو استراتيجيات التسويق الخاصة بك.</div><div class=\"note\">📝 ملاحظة: يقلل الإعداد السليم في البداية من الأخطاء ويعزز دقة التقارير في حملاتك التسويقية.</div>",
    "keywords": [
      "tiktok integration",
      "تكامل تيك توك",
      "marketing & campaigns",
      "التسويق والحملات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "tiktok-integration-troubleshooting",
    "categoryId": "marketing-campaigns",
    "sectionId": "tiktok-integration",
    "questionEn": "Why is TikTok Integration not showing the expected data?",
    "questionAr": "لماذا لا يعرض تكامل تيك توك البيانات المتوقعة؟",
    "answerEn": "<h2>Why is TikTok Integration Not Showing the Expected Data?</h2><p>When you encounter issues with missing or unexpected data in the <strong>TikTok Integration</strong>, several factors can be responsible. Start by thoroughly checking the following elements:</p><ul><li><strong>Filters:</strong> Ensure that no status or custom filters are inadvertently hiding data.</li><li><strong>Date Range:</strong> Confirm that the selected date range encompasses the period for which you expect data to appear.</li><li><strong>Ownership Rules:</strong> Verify that ownership parameters do not restrict access to certain records.</li><li><strong>User Permissions:</strong> Check that your user role has the necessary permissions to view TikTok-related data.</li></ul><p>In many cases, the data does exist but remains hidden due to restrictive filters, limited team scopes, or missing field mappings between TikTok and Tamiyouz CRM.</p><div class=\"tip\">💡 Tip: Use the filter reset option to quickly clear all active filters and reassess the data visibility.</div><p>If these initial checks do not resolve the issue, proceed with a detailed review of:</p><ul><li>Recent data imports involving TikTok sources.</li><li>Active integrations to ensure they are functioning correctly without errors.</li><li>Automation rules connected to the TikTok Integration that could be affecting data processing or visibility.</li></ul><p>For a precise diagnosis, select one record that is affected by the problem and compare it side-by-side with a similar record that displays the correct data. This comparison helps identify discrepancies such as missing mappings or configuration differences swiftly.</p><div class=\"note\">📝 Note: Regularly reviewing integration settings and permissions helps maintain seamless data flow and accurate reporting.</div>",
    "answerAr": "<h2>لماذا لا يعرض تكامل تيك توك البيانات المتوقعة؟</h2><p>عند مواجهة مشكلات في عدم ظهور البيانات المتوقعة أو فقدانها في <strong>تكامل تيك توك</strong>، هناك عدة عوامل قد تكون السبب. ابدأ بالتحقق الدقيق من العناصر التالية:</p><ul><li><strong>الفلاتر:</strong> تأكد من عدم وجود فلاتر حالة أو فلاتر مخصصة تخفي البيانات عن غير قصد.</li><li><strong>الفترة الزمنية:</strong> تحقق من أن الفترة الزمنية المحددة تغطي الفترة التي تتوقع ظهور البيانات خلالها.</li><li><strong>قواعد الملكية:</strong> تحقق من أن معايير الملكية لا تقيد الوصول إلى سجلات معينة.</li><li><strong>صلاحيات المستخدم:</strong> تأكد من أن دور المستخدم لديك يمتلك الأذونات اللازمة لعرض البيانات المتعلقة بتيك توك.</li></ul><p>في كثير من الحالات، تكون البيانات موجودة ولكنها مخفية بسبب الفلاتر المقيدة، أو نطاق الفريق المحدود، أو نقص الربط بين الحقول بين تيك توك وتاميوز CRM.</p><div class=\"tip\">💡 نصيحة: استخدم خيار إعادة تعيين الفلاتر لمسح جميع الفلاتر النشطة بسرعة وإعادة تقييم ظهور البيانات.</div><p>إذا لم تحل هذه الفحوصات الأولية المشكلة، تابع بمراجعة مفصلة لـ:</p><ul><li>عمليات الاستيراد الأخيرة التي تشمل مصادر تيك توك.</li><li>التكاملات النشطة للتأكد من عملها بشكل صحيح ودون أخطاء.</li><li>قواعد الأتمتة المرتبطة بتكامل تيك توك والتي قد تؤثر على معالجة البيانات أو ظهورها.</li></ul><p>للتشخيص الدقيق، اختر سجلاً واحداً متأثراً بالمشكلة وقارنه جنباً إلى جنب مع سجل مشابه يعرض البيانات بشكل صحيح. تساعد هذه المقارنة في التعرف بسرعة على الفروقات مثل نقص الربط أو اختلافات الإعدادات.</p><div class=\"note\">📝 ملاحظة: مراجعة إعدادات التكامل والصلاحيات بشكل دوري تساعد في الحفاظ على تدفق البيانات بسلاسة ودقة التقارير.</div>",
    "keywords": [
      "tiktok integration",
      "تكامل تيك توك",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "team-dashboard-getting-started",
    "categoryId": "reports-analytics",
    "sectionId": "team-dashboard",
    "questionEn": "How do I start using Team Dashboard in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام لوحة الفريق في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with the Team Dashboard in Tamiyouz CRM</h2><p>The <strong>Team Dashboard</strong> is a powerful feature within the <strong>Reports Analytics</strong> category designed to provide comprehensive insights into your team's performance and activities. To start using the Team Dashboard effectively, follow these detailed steps to ensure proper setup and smooth operation.</p><ol><li><strong>Access the Team Dashboard:</strong> Navigate to the <em>Team Dashboard</em> section from the main navigation menu within Tamiyouz CRM.</li><li><strong>Review Available Fields:</strong> Familiarize yourself with the various fields and data points available on the dashboard to understand what can be tracked and reported.</li><li><strong>Complete Required Setup:</strong> Before inviting your team members, configure essential settings including:<ul><li><strong>Naming Conventions:</strong> Establish consistent naming standards to maintain organized and easy-to-understand data.</li><li><strong>Ownership Rules:</strong> Define clear ownership of records to streamline responsibility and accountability.</li><li><strong>Visibility Settings:</strong> Set appropriate permissions to control who can view or edit specific data, ensuring data security and relevance.</li></ul></li><li><strong>Test the Workflow:</strong> Create one or two sample records to verify that all statuses, notifications, and permissions behave as expected. This ensures your team’s experience will be smooth and error-free.</li><li><strong>Invite Your Team:</strong> Once testing is satisfactory, invite your team members to start collaborating and leveraging the dashboard’s capabilities.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Regularly review and update your naming conventions and permissions to keep data clean and maintain accurate reporting.</div><div class=\"note\">📝 <strong>Note:</strong> Proper initial setup is crucial to maximize the effectiveness of your Team Dashboard and avoid future data inconsistencies.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام لوحة الفريق في Tamiyouz CRM</h2><p>تُعد <strong>لوحة الفريق</strong> ميزة قوية ضمن فئة <strong>تقارير وتحليلات</strong>، تهدف إلى تقديم رؤى شاملة حول أداء فريقك وأنشطته. للبدء باستخدام لوحة الفريق بشكل فعال، اتبع الخطوات المفصلة التالية لضمان الإعداد الصحيح وسير العمل بسلاسة.</p><ol><li><strong>الوصول إلى لوحة الفريق:</strong> انتقل إلى قسم <em>لوحة الفريق</em> من قائمة التنقل الرئيسية داخل Tamiyouz CRM.</li><li><strong>مراجعة الحقول المتاحة:</strong> تعرّف على الحقول ونقاط البيانات المختلفة المتوفرة في اللوحة لفهم ما يمكن تتبعه والإبلاغ عنه.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> قبل دعوة أعضاء الفريق، قم بتكوين الإعدادات الأساسية بما في ذلك:<ul><li><strong>قواعد التسمية:</strong> وضع معايير تسمية متسقة للحفاظ على بيانات منظمة وسهلة الفهم.</li><li><strong>قواعد الملكية:</strong> تحديد ملكية واضحة للسجلات لتسهيل المسؤولية والمحاسبة.</li><li><strong>إعدادات الصلاحيات:</strong> تعيين الأذونات المناسبة للتحكم في من يمكنه عرض أو تعديل البيانات، مما يضمن أمان البيانات وملاءمتها.</li></ul></li><li><strong>اختبار سير العمل:</strong> أنشئ سجلًا أو سجلين تجريبيين للتحقق من أن الحالات والتنبيهات والصلاحيات تعمل كما هو متوقع. هذا يضمن تجربة سلسة وخالية من الأخطاء لفريقك.</li><li><strong>دعوة الفريق:</strong> بعد إتمام الاختبار بنجاح، قم بدعوة أعضاء الفريق للبدء في التعاون والاستفادة من إمكانيات اللوحة.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> قم بمراجعة وتحديث قواعد التسمية والصلاحيات بانتظام للحفاظ على نظافة البيانات ودقة التقارير.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> الإعداد الأولي السليم ضروري لتعظيم فعالية لوحة الفريق وتجنب عدم اتساق البيانات مستقبلاً.</div>",
    "keywords": [
      "team dashboard",
      "لوحة الفريق",
      "reports & analytics",
      "التقارير والتحليلات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": true
  },
  {
    "id": "team-dashboard-troubleshooting",
    "categoryId": "reports-analytics",
    "sectionId": "team-dashboard",
    "questionEn": "Why is Team Dashboard not showing the expected data?",
    "questionAr": "لماذا لا يعرض لوحة الفريق البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Team Dashboard Not Showing the Expected Data?</h2><p>The <strong>Team Dashboard</strong> is a vital tool within Tamiyouz CRM that provides a comprehensive overview of team performance through various reports and analytics. If you notice that the dashboard is not displaying the expected data, there are several common factors to investigate:</p><ol><li><strong>Check Filters and Date Range:</strong> Ensure that the applied filters (such as status, team scope, or specific user selections) and the date range are correctly set to include the data you want to analyze. Incorrect filters often hide relevant information.</li><li><strong>Ownership Rules and User Permissions:</strong> Verify that you have the necessary permissions to view all relevant records. Ownership and role-based access control settings might restrict visibility of certain data on the dashboard.</li><li><strong>Data Mappings and Field Associations:</strong> Sometimes data exists but is not properly linked or mapped to the dashboard fields, causing it to be excluded from reports.</li><li><strong>Review Recent Imports, Integrations, and Automation Rules:</strong> Check if any recent system changes, such as data imports or third-party integrations, might have affected the data accuracy. Automation rules configured for the Team Dashboard could also influence which records are displayed.</li><li><strong>Compare Affected vs. Working Records:</strong> Select a record that is not appearing as expected and compare it with a similar record that is visible. Analyzing differences in status, ownership, or field values can help identify the root cause.</li></ol><div class=\"tip\">💡 Tip: Regularly review and update your dashboard filters and permissions to ensure consistent data visibility and accuracy.</div>",
    "answerAr": "<h2>لماذا لا يعرض لوحة الفريق البيانات المتوقعة؟</h2><p>تُعد <strong>لوحة الفريق</strong> أداة أساسية في نظام Tamiyouz CRM توفر نظرة شاملة على أداء الفريق من خلال تقارير وتحليلات متعددة. إذا لاحظت أن اللوحة لا تعرض البيانات المتوقعة، فهناك عدة عوامل شائعة يجب التحقق منها:</p><ol><li><strong>التحقق من الفلاتر والفترة الزمنية:</strong> تأكد من أن الفلاتر المطبقة (مثل الحالة، نطاق الفريق، أو اختيار المستخدم المحدد) والفترة الزمنية مضبوطان بشكل صحيح ليشملوا البيانات التي ترغب في تحليلها. الفلاتر غير الصحيحة غالباً ما تخفي المعلومات ذات الصلة.</li><li><strong>قواعد الملكية وصلاحيات المستخدم:</strong> تحقق من أن لديك الصلاحيات اللازمة لرؤية جميع السجلات ذات الصلة. قد تقيد إعدادات الملكية والتحكم القائم على الدور رؤية بيانات معينة على اللوحة.</li><li><strong>ربط البيانات والحقول:</strong> أحياناً تكون البيانات موجودة لكن غير مرتبطة أو غير مرتبطة بشكل صحيح بحقول اللوحة، مما يؤدي إلى استبعادها من التقارير.</li><li><strong>مراجعة عمليات الاستيراد الأخيرة والتكاملات وقواعد الأتمتة:</strong> تحقق مما إذا كانت هناك تغييرات حديثة في النظام، مثل استيراد البيانات أو تكاملات الطرف الثالث، قد أثرت على دقة البيانات. يمكن أيضاً أن تؤثر قواعد الأتمتة المطبقة على لوحة الفريق على السجلات المعروضة.</li><li><strong>مقارنة السجلات المتأثرة بالسجلات العاملة:</strong> اختر سجلاً لا يظهر كما هو متوقع وقارنه بسجل مشابه يظهر بشكل صحيح. تحليل الفروقات في الحالة أو الملكية أو قيم الحقول يمكن أن يساعد في تحديد السبب الجذري.</li></ol><div class=\"tip\">💡 نصيحة: قم بمراجعة وتحديث فلاتر وصلاحيات اللوحة بانتظام لضمان ظهور البيانات بدقة وثبات.</div>",
    "keywords": [
      "team dashboard",
      "لوحة الفريق",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "audit-log-getting-started",
    "categoryId": "reports-analytics",
    "sectionId": "audit-log",
    "questionEn": "How do I start using Audit Log in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام سجل التدقيق في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Audit Log in Tamiyouz CRM</h2><p>The <strong>Audit Log</strong> feature in Tamiyouz CRM provides a comprehensive and secure way to track changes and activities within your CRM system. To begin using this feature effectively, follow these detailed steps:</p><ol><li><strong>Access the Audit Log:</strong> Navigate to the <em>Audit Log</em> section from the main navigation menu. This area displays all tracked events and changes.</li><li><strong>Review Available Fields:</strong> Familiarize yourself with the fields available for auditing. These typically include user actions, timestamps, affected records, and types of changes.</li><li><strong>Complete Required Setup:</strong> Before inviting your team, configure essential settings such as:</li><ul><li><strong>Naming Conventions:</strong> Define clear and consistent naming rules to maintain organized records.</li><li><strong>Ownership Rules:</strong> Set ownership permissions to control who can view or modify audit data.</li><li><strong>Visibility Settings:</strong> Adjust visibility to ensure sensitive information is accessible only to authorized users.</li></ul><li><strong>Test the Workflow:</strong> Create one or two sample records to simulate typical usage. Verify that the audit log correctly captures the status changes, sends notifications as expected, and enforces proper permissions.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Regularly review and update your audit log settings to adapt to organizational changes and maintain data integrity.</div><div class=\"note\">📝 <strong>Note:</strong> Proper configuration upfront helps ensure the audit log remains a reliable source for compliance and reporting.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام سجل التدقيق في Tamiyouz CRM</h2><p>يُوفر <strong>سجل التدقيق</strong> في Tamiyouz CRM طريقة شاملة وآمنة لتتبع التغييرات والأنشطة داخل نظام إدارة علاقات العملاء. للبدء في استخدام هذه الميزة بشكل فعال، اتبع الخطوات التفصيلية التالية:</p><ol><li><strong>الوصول إلى سجل التدقيق:</strong> افتح قسم <em>سجل التدقيق</em> من قائمة التنقل الرئيسية. تعرض هذه المنطقة جميع الأحداث والتغييرات التي تم تتبعها.</li><li><strong>مراجعة الحقول المتاحة:</strong> تعرّف على الحقول المتاحة للتدقيق مثل إجراءات المستخدمين، والطوابع الزمنية، والسجلات المتأثرة، وأنواع التغييرات.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> قبل دعوة الفريق، قم بتكوين الإعدادات الأساسية مثل:</li><ul><li><strong>قواعد التسمية:</strong> حدد قواعد واضحة ومتسقة للاسم للحفاظ على تنظيم السجلات.</li><li><strong>قواعد الملكية:</strong> اضبط صلاحيات الملكية للتحكم في من يمكنه عرض أو تعديل بيانات السجل.</li><li><strong>إعدادات الظهور:</strong> عدّل إعدادات الظهور لضمان وصول المعلومات الحساسة فقط للمستخدمين المصرح لهم.</li></ul><li><strong>اختبار سير العمل:</strong> أنشئ سجلاً أو سجّلين تجريبيين لمحاكاة الاستخدام المعتاد. تحقق من أن سجل التدقيق يسجل التغييرات في الحالة بشكل صحيح، ويرسل التنبيهات المتوقعة، ويطبق الصلاحيات الملائمة.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> راجع وقم بتحديث إعدادات سجل التدقيق بانتظام لتتوافق مع التغيرات التنظيمية وتحافظ على سلامة البيانات.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> الإعداد السليم من البداية يساعد في ضمان أن يكون سجل التدقيق مصدرًا موثوقًا للامتثال والتقارير.</div>",
    "keywords": [
      "audit log",
      "سجل التدقيق",
      "reports & analytics",
      "التقارير والتحليلات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "audit-log-troubleshooting",
    "categoryId": "reports-analytics",
    "sectionId": "audit-log",
    "questionEn": "Why is Audit Log not showing the expected data?",
    "questionAr": "لماذا لا يعرض سجل التدقيق البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Audit Log Not Showing the Expected Data?</h2><p>The <strong>Audit Log</strong> is a critical feature within the <em>Reports Analytics</em> category that tracks changes and activities across the system. If you notice that the Audit Log is not displaying the expected data, several factors may be causing this behavior.</p><h3>Step-by-Step Troubleshooting</h3><ol><li><strong>Verify Filters and Date Range:</strong> Ensure that all applied filters, including status filters and date ranges, are correctly set. Filters may inadvertently hide relevant audit entries.</li><li><strong>Check Ownership Rules:</strong> Confirm that ownership or team scope rules are not limiting the visibility of audit records. Sometimes, audit entries exist but are restricted based on user or team permissions.</li><li><strong>Review User Permissions:</strong> Audit Log access depends on user permissions. Verify that your user role has adequate rights to view the required data.</li><li><strong>Inspect Recent Imports and Integrations:</strong> Data imported or integrated into the system may affect audit records. Review recent data imports, third-party integrations, or synchronization processes that interact with the Audit Log.</li><li><strong>Analyze Automation Rules:</strong> Automation workflows or triggers related to the Audit Log might impact what data appears. Check for any automation that modifies or filters audit data.</li><li><strong>Compare Records:</strong> To identify discrepancies, compare a record that is affected (missing expected audit data) against a similar record that is displaying correctly. This helps pinpoint configuration or data differences quickly.</li></ol><div class=\"tip\">💡 Keeping your filters and permissions correctly configured ensures the Audit Log remains a reliable source for monitoring system changes.</div>",
    "answerAr": "<h2>لماذا لا يعرض سجل التدقيق البيانات المتوقعة؟</h2><p>يُعد <strong>سجل التدقيق</strong> ميزة أساسية ضمن فئة <em>تقارير التحليلات</em> التي تتتبع التغييرات والأنشطة عبر النظام. إذا لاحظت أن سجل التدقيق لا يعرض البيانات المتوقعة، فقد تكون هناك عدة عوامل تسبب هذا السلوك.</p><h3>خطوات استكشاف الأخطاء وإصلاحها</h3><ol><li><strong>تحقق من الفلاتر والفترة الزمنية:</strong> تأكد من ضبط جميع الفلاتر المطبقة، بما في ذلك فلاتر الحالة والفترات الزمنية، بشكل صحيح. فقد تقوم الفلاتر بإخفاء إدخالات التدقيق ذات الصلة عن غير قصد.</li><li><strong>مراجعة قواعد الملكية:</strong> تحقق من أن قواعد الملكية أو نطاق الفريق لا تقيد رؤية سجلات التدقيق. في بعض الأحيان، تكون إدخالات التدقيق موجودة ولكنها مقيدة بناءً على صلاحيات المستخدم أو الفريق.</li><li><strong>التحقق من صلاحيات المستخدم:</strong> يعتمد الوصول إلى سجل التدقيق على صلاحيات المستخدم. تأكد من أن دور المستخدم الخاص بك لديه الحقوق الكافية لعرض البيانات المطلوبة.</li><li><strong>مراجعة عمليات الاستيراد والتكاملات الأخيرة:</strong> قد تؤثر البيانات المستوردة أو المتكاملة على سجلات التدقيق. راجع عمليات الاستيراد الأخيرة، والتكاملات مع الأطراف الخارجية، أو عمليات المزامنة التي تتفاعل مع سجل التدقيق.</li><li><strong>تحليل قواعد الأتمتة:</strong> قد تؤثر سير العمل أو المشغلات الأتمتية المرتبطة بسجل التدقيق على البيانات الظاهرة. تحقق من وجود أي أتمتة تقوم بتعديل أو تصفية بيانات التدقيق.</li><li><strong>مقارنة السجلات:</strong> لتحديد الاختلافات، قارن بين سجل متأثر (يفتقد البيانات المتوقعة) وسجل مماثل يعمل بشكل صحيح. هذا يساعد في تحديد الفرق في التكوين أو البيانات بسرعة.</li></ol><div class=\"tip\">💡 يساعد الحفاظ على إعدادات الفلاتر والصلاحيات بشكل صحيح في ضمان أن يظل سجل التدقيق مصدراً موثوقاً لمراقبة تغييرات النظام.</div>",
    "keywords": [
      "audit log",
      "سجل التدقيق",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "meta-aggregated-analytics-getting-started",
    "categoryId": "reports-analytics",
    "sectionId": "meta-aggregated-analytics",
    "questionEn": "How do I start using Aggregated Meta Analytics in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام تحليلات ميتا المجمعة في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Aggregated Meta Analytics in Tamiyouz CRM</h2><p>To begin utilizing the <strong>Aggregated Meta Analytics</strong> feature within Tamiyouz CRM, follow these structured steps to ensure an efficient setup and smooth operation.</p><ol><li><strong>Access the Analytics Section:</strong> Navigate to the <em>Aggregated Meta Analytics</em> area via the main navigation menu of your CRM dashboard.</li><li><strong>Review Available Fields:</strong> Thoroughly examine all the fields and data points available for aggregation to understand the scope of analytics you can customize.</li><li><strong>Complete Initial Setup:</strong> Configure essential settings including:</li><ul><li><strong>Naming Conventions:</strong> Establish consistent naming rules to maintain data clarity and uniformity.</li><li><strong>Ownership Rules:</strong> Define who owns or manages each data segment to ensure accountability.</li><li><strong>Visibility Settings:</strong> Set appropriate access permissions so that data remains secure and visible only to authorized users.</li></ul><li><strong>Test the Workflow:</strong> Before fully rolling out, create one or two sample records to validate that the status updates, notification triggers, and permission controls work as expected.</li><li><strong>Invite Your Team:</strong> Once testing is complete and confirmed, invite your team members to begin using the feature for real-time analytics and reporting.</li></ol><div class=\"tip\">💡 Tip: Maintaining clean, well-structured data through these initial steps will greatly simplify your reporting and enhance analytical accuracy.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام تحليلات ميتا المجمعة في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>تحليلات ميتا المجمعة</strong> داخل Tamiyouz CRM، اتبع الخطوات المنظمة التالية لضمان إعداد فعّال وسير عمل سلس.</p><ol><li><strong>الوصول إلى قسم التحليلات:</strong> انتقل إلى قسم <em>تحليلات ميتا المجمعة</em> عبر قائمة التنقل الرئيسية في لوحة تحكم نظام إدارة علاقات العملاء.</li><li><strong>مراجعة الحقول المتاحة:</strong> استعرض بدقة جميع الحقول ونقاط البيانات المتوفرة للتجميع لفهم نطاق التحليلات التي يمكنك تخصيصها.</li><li><strong>إكمال الإعداد الأولي:</strong> قم بضبط الإعدادات الأساسية بما في ذلك:</li><ul><li><strong>قواعد التسمية:</strong> وضع قواعد تسمية متسقة للحفاظ على وضوح البيانات وتجانسها.</li><li><strong>قواعد الملكية:</strong> تحديد من يملك أو يدير كل جزء من البيانات لضمان المساءلة.</li><li><strong>إعدادات الظهور:</strong> ضبط صلاحيات الوصول المناسبة لضمان بقاء البيانات آمنة ومرئية فقط للمستخدمين المصرح لهم.</li></ul><li><strong>اختبار سير العمل:</strong> قبل البدء الكامل، أنشئ سجلًا أو سجلين تجريبيين للتحقق من أن تحديثات الحالة، وتنبيهات الإشعارات، وضوابط الصلاحيات تعمل كما هو متوقع.</li><li><strong>دعوة فريق العمل:</strong> بمجرد الانتهاء من الاختبار والتأكد من صحته، قم بدعوة أعضاء فريقك لبدء استخدام الميزة لتحليلات وتقارير الوقت الحقيقي.</li></ol><div class=\"tip\">💡 نصيحة: الحفاظ على بيانات نظيفة ومنظمة جيدًا من خلال هذه الخطوات الأولية سيسهل بشكل كبير إعداد التقارير ويعزز دقة التحليل.</div>",
    "keywords": [
      "aggregated meta analytics",
      "تحليلات ميتا المجمعة",
      "reports & analytics",
      "التقارير والتحليلات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "meta-aggregated-analytics-troubleshooting",
    "categoryId": "reports-analytics",
    "sectionId": "meta-aggregated-analytics",
    "questionEn": "Why is Aggregated Meta Analytics not showing the expected data?",
    "questionAr": "لماذا لا يعرض تحليلات ميتا المجمعة البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Aggregated Meta Analytics Not Showing the Expected Data?</h2><p>When you encounter issues with <strong>Aggregated Meta Analytics</strong> not displaying the expected results, several factors may be influencing the data visibility. Follow these steps to troubleshoot effectively:</p><ol><li><strong>Verify Filters:</strong> Ensure that the applied filters such as status filters or other conditional filters are not unintentionally excluding relevant data.</li><li><strong>Check Date Range:</strong> Confirm that the selected date range encompasses the period for which you expect to see data. Narrow or incorrect date ranges can lead to missing records.</li><li><strong>Review Ownership Rules:</strong> Ownership settings may restrict data visibility to specific users or teams. Validate the ownership configuration aligns with your access requirements.</li><li><strong>Assess User Permissions:</strong> Make sure your user role has sufficient permissions to view the aggregated data. Permission limitations can hide certain analytics.</li><li><strong>Investigate Data Mappings:</strong> Missing or incorrect field mappings between integrated systems can result in data not appearing in reports.</li><li><strong>Examine Recent Imports and Integrations:</strong> Check if recent data imports or integrations have processed correctly and that no errors have occurred that might affect data aggregation.</li><li><strong>Review Automation Rules:</strong> Automation rules related to Aggregated Meta Analytics can impact data processing. Verify these rules are functioning as intended.</li><li><strong>Compare Records:</strong> Select one record that is not showing correctly and compare it with a similar record that appears as expected. This comparison can help quickly identify discrepancies or configuration issues.</li></ol><div class=\"tip\">💡 Tip: Regularly reviewing your filters, permissions, and integration statuses helps maintain accurate and comprehensive analytics.</div>",
    "answerAr": "<h2>لماذا لا يعرض تحليلات ميتا المجمعة البيانات المتوقعة؟</h2><p>عند مواجهة مشكلة في <strong>تحليلات ميتا المجمعة</strong> وعدم ظهور النتائج المتوقعة، قد تؤثر عدة عوامل على إمكانية رؤية البيانات. اتبع الخطوات التالية لاستكشاف المشكلة بشكل فعال:</p><ol><li><strong>التحقق من الفلاتر:</strong> تأكد من أن الفلاتر المطبقة مثل فلاتر الحالة أو الفلاتر الشرطية الأخرى لا تستبعد البيانات ذات الصلة عن غير قصد.</li><li><strong>مراجعة الفترة الزمنية:</strong> تحقق من أن الفترة الزمنية المحددة تشمل الفترة التي تتوقع رؤية البيانات فيها. قد تؤدي الفترات الزمنية الضيقة أو غير الصحيحة إلى فقدان السجلات.</li><li><strong>مراجعة قواعد الملكية:</strong> قد تقيد إعدادات الملكية رؤية البيانات لمستخدمين أو فرق محددة. تأكد من توافق إعدادات الملكية مع متطلبات وصولك.</li><li><strong>تقييم صلاحيات المستخدم:</strong> تأكد من أن دور المستخدم الخاص بك يمتلك الصلاحيات الكافية لعرض البيانات المجمعة. قد تؤدي القيود في الصلاحيات إلى إخفاء بعض التحليلات.</li><li><strong>التحقق من ربط الحقول:</strong> قد يؤدي نقص أو خطأ في ربط الحقول بين الأنظمة المتكاملة إلى عدم ظهور البيانات في التقارير.</li><li><strong>مراجعة عمليات الاستيراد والتكامل الأخيرة:</strong> تحقق من أن عمليات الاستيراد أو التكامل الأخيرة تمت بنجاح دون أخطاء تؤثر على تجميع البيانات.</li><li><strong>مراجعة قواعد الأتمتة:</strong> قواعد الأتمتة المتعلقة بتحليلات ميتا المجمعة قد تؤثر على معالجة البيانات. تحقق من عمل هذه القواعد بشكل صحيح.</li><li><strong>مقارنة السجلات:</strong> اختر سجلاً لا يظهر بشكل صحيح وقارنه بسجل مشابه يظهر كما هو متوقع. تساعد هذه المقارنة في تحديد الاختلافات أو مشاكل الإعداد بسرعة.</li></ol><div class=\"tip\">💡 نصيحة: مراجعة الفلاتر والصلاحيات وحالة التكامل بانتظام تساعد في الحفاظ على تحليلات دقيقة وشاملة.</div>",
    "keywords": [
      "aggregated meta analytics",
      "تحليلات ميتا المجمعة",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "account-manager-dashboard-getting-started",
    "categoryId": "reports-analytics",
    "sectionId": "account-manager-dashboard",
    "questionEn": "How do I start using Account Manager Dashboard in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام لوحة مدير الحساب في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with the Account Manager Dashboard in Tamiyouz CRM</h2><p>The <strong>Account Manager Dashboard</strong> is a powerful feature within Tamiyouz CRM’s <strong>Reports Analytics</strong> category, designed to provide comprehensive insights and efficient management of account-related data. To start using it effectively, follow these detailed steps.</p><h3>Step 1: Accessing the Dashboard</h3><p>Navigate to the <strong>Account Manager Dashboard</strong> from the main navigation menu. This area presents various fields and metrics essential for managing accounts.</p><h3>Step 2: Initial Setup</h3><p>Before inviting your team, it is critical to complete the dashboard setup to ensure data integrity and usability:</p><ul><li><strong>Naming Conventions:</strong> Define clear and consistent naming rules for accounts to maintain uniformity.</li><li><strong>Ownership Rules:</strong> Set accurate ownership and assignment protocols to track responsibility.</li><li><strong>Visibility Settings:</strong> Configure who can view or edit data to maintain confidentiality and relevance.</li></ul><h3>Step 3: Testing Workflow</h3><p>After setup, test the dashboard by creating one or two sample records. Verify that the status updates, notifications, and permissions behave as expected. This step helps identify and resolve potential issues before full deployment.</p><div class=\"tip\">💡 <strong>Tip:</strong> Regularly review and update your settings as your team or business needs evolve to keep data clean and reports insightful.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام لوحة مدير الحساب في Tamiyouz CRM</h2><p>تُعد <strong>لوحة مدير الحساب</strong> ميزة قوية ضمن فئة <strong>تقارير التحليلات</strong> في Tamiyouz CRM، مصممة لتوفير رؤى شاملة وإدارة فعالة للبيانات المتعلقة بالحسابات. للبدء في استخدامها بفعالية، اتبع الخطوات التفصيلية التالية.</p><h3>الخطوة 1: الوصول إلى اللوحة</h3><p>انتقل إلى <strong>لوحة مدير الحساب</strong> من قائمة التنقل الرئيسية. تعرض هذه المنطقة العديد من الحقول والمؤشرات الأساسية لإدارة الحسابات.</p><h3>الخطوة 2: الإعداد الأولي</h3><p>قبل دعوة فريقك، من الضروري إكمال إعداد اللوحة لضمان سلامة البيانات وسهولة الاستخدام:</p><ul><li><strong>قواعد التسمية:</strong> حدد قواعد واضحة ومتسقة لتسمية الحسابات للحفاظ على التوحيد.</li><li><strong>قواعد الملكية:</strong> قم بتعيين ملكية دقيقة وبروتوكولات التوزيع لتتبع المسؤوليات.</li><li><strong>إعدادات الظهور:</strong> اضبط من يمكنه عرض أو تعديل البيانات للحفاظ على السرية والأهمية.</li></ul><h3>الخطوة 3: اختبار سير العمل</h3><p>بعد الإعداد، اختبر اللوحة عن طريق إنشاء سجل أو سجلين تجريبيين. تحقق من تحديثات الحالة، والتنبيهات، والصلاحيات للتأكد من عملها كما هو متوقع. تساعد هذه الخطوة في اكتشاف وحل المشكلات المحتملة قبل الاستخدام الكامل.</p><div class=\"tip\">💡 <strong>نصيحة:</strong> قم بمراجعة وتحديث إعداداتك بانتظام مع تطور فريقك أو احتياجات عملك للحفاظ على نظافة البيانات ووضوح التقارير.</div>",
    "keywords": [
      "account manager dashboard",
      "لوحة مدير الحساب",
      "reports & analytics",
      "التقارير والتحليلات",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "account-manager-dashboard-troubleshooting",
    "categoryId": "reports-analytics",
    "sectionId": "account-manager-dashboard",
    "questionEn": "Why is Account Manager Dashboard not showing the expected data?",
    "questionAr": "لماذا لا يعرض لوحة مدير الحساب البيانات المتوقعة؟",
    "answerEn": "<h2>Why is the Account Manager Dashboard Not Showing the Expected Data?</h2>\n<p>The <strong>Account Manager Dashboard</strong> provides critical insights into account performance and management activities. If you notice that the dashboard is not displaying the expected data, several factors might be causing this issue.</p>\n<h3>Steps to Troubleshoot</h3>\n<ol>\n  <li><strong>Check Filters and Date Range:</strong> Ensure that the filters applied, such as status filters or team scope, are correctly set. Incorrect filter settings can hide relevant data.</li>\n  <li><strong>Review Ownership Rules:</strong> Verify that the <em>ownership rules</em> for accounts are correctly configured. Data may be restricted based on ownership, affecting visibility.</li>\n  <li><strong>Confirm User Permissions:</strong> The dashboard data visibility depends on your user permissions. Make sure you have adequate rights to view all necessary records.</li>\n  <li><strong>Investigate Data Mappings:</strong> Missing or incorrect field mappings can cause data to not appear as expected.</li>\n</ol>\n<div class=\"tip\">💡 Tip: Often, the data exists but is hidden due to filters or scope settings, so double-check these before deeper troubleshooting.</div>\n<h3>If the Issue Persists</h3>\n<p>If after the above checks the problem continues, take the following additional steps:</p>\n<ul>\n  <li>Review recent <strong>data imports</strong> and <strong>integrations</strong> related to the Account Manager Dashboard to ensure data synchronization is functioning properly.</li>\n  <li>Examine any <strong>automation rules</strong> that might affect data presentation or visibility.</li>\n  <li>Compare an <strong>affected record</strong> with a correctly displayed record to identify discrepancies quickly.</li>\n</ul>\n<div class=\"note\">📝 Note: System updates or changes in team configurations can sometimes alter dashboard behavior.</div>",
    "answerAr": "<h2>لماذا لا يعرض لوحة مدير الحساب البيانات المتوقعة؟</h2>\n<p>توفر <strong>لوحة مدير الحساب</strong> رؤى هامة حول أداء الحسابات وأنشطة الإدارة. إذا لاحظت أن اللوحة لا تعرض البيانات المتوقعة، فقد تكون هناك عدة عوامل تسبب هذه المشكلة.</p>\n<h3>خطوات استكشاف الأخطاء وإصلاحها</h3>\n<ol>\n  <li><strong>التحقق من الفلاتر والفترة الزمنية:</strong> تأكد من أن الفلاتر المطبقة، مثل فلاتر الحالة أو نطاق الفريق، مضبوطة بشكل صحيح. الإعدادات غير الصحيحة للفلاتر قد تخفي البيانات ذات الصلة.</li>\n  <li><strong>مراجعة قواعد الملكية:</strong> تحقق من صحة تكوين <em>قواعد الملكية</em> للحسابات. قد يتم تقييد البيانات بناءً على الملكية، مما يؤثر على إمكانية العرض.</li>\n  <li><strong>تأكيد صلاحيات المستخدم:</strong> تعتمد رؤية بيانات اللوحة على صلاحيات المستخدم الخاصة بك. تأكد من أن لديك الحقوق الكافية لعرض جميع السجلات الضرورية.</li>\n  <li><strong>التحقق من ربط الحقول:</strong> يمكن أن يتسبب الربط المفقود أو غير الصحيح للحقول في عدم ظهور البيانات كما هو متوقع.</li>\n</ol>\n<div class=\"tip\">💡 نصيحة: غالباً ما تكون البيانات موجودة لكنها مخفية بسبب الفلاتر أو إعدادات النطاق، لذا تحقق منها جيداً قبل المتابعة لاستكشاف الأخطاء بشكل أعمق.</div>\n<h3>إذا استمرت المشكلة</h3>\n<p>إذا استمرت المشكلة بعد التحقق مما سبق، قم بالخطوات الإضافية التالية:</p>\n<ul>\n  <li>راجع عمليات <strong>الاستيراد</strong> و<strong>التكاملات</strong> الأخيرة المتعلقة بلوحة مدير الحساب لضمان عمل مزامنة البيانات بشكل صحيح.</li>\n  <li>افحص أي <strong>قواعد أتمتة</strong> قد تؤثر على عرض البيانات أو رؤيتها.</li>\n  <li>قارن بين <strong>سجل متأثر</strong> وسجل يتم عرضه بشكل صحيح لتحديد الاختلافات بسرعة.</li>\n</ul>\n<div class=\"note\">📝 ملاحظة: قد تؤدي تحديثات النظام أو تغييرات تكوين الفريق أحياناً إلى تغيير سلوك اللوحة.</div>",
    "keywords": [
      "account manager dashboard",
      "لوحة مدير الحساب",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "rakan-ai-getting-started",
    "categoryId": "smart-tools-ai",
    "sectionId": "rakan-ai",
    "questionEn": "How do I start using Rakan AI in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام راكان الذكي في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using <strong>Rakan AI</strong> in Tamiyouz CRM</h2><p>To begin leveraging the powerful capabilities of <strong>Rakan AI</strong> within Tamiyouz CRM, follow these structured steps to ensure a smooth setup and effective usage:</p><ol><li><strong>Access the Rakan AI Module:</strong> Navigate to the main menu and select the <em>Rakan AI</em> section to open the dedicated workspace.</li><li><strong>Review Available Fields:</strong> Examine all the AI-configurable fields to understand what data points can be automated or enhanced using Rakan AI.</li><li><strong>Complete Initial Setup:</strong> Configure essential settings including:</li><ul><li><strong>Naming Conventions:</strong> Define clear and consistent rules for naming records to maintain data integrity.</li><li><strong>Ownership Rules:</strong> Set ownership and assignment guidelines to control data responsibility.</li><li><strong>Visibility Settings:</strong> Adjust permissions to ensure appropriate access levels across your team.</li></ul><li><strong>Invite Your Team:</strong> Once initial configurations are in place, invite team members to collaborate and utilize the AI features.</li><li><strong>Test with Sample Records:</strong> Create one or two test entries to validate workflow automation, ensuring that statuses, notifications, and permissions behave as expected.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Proper initial setup is critical to keep your data clean and reporting accurate, so take time to review each setting carefully.</div><div class=\"note\">📝 <strong>Note:</strong> Testing workflows before full deployment helps identify potential issues early.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام <strong>راكان الذكي</strong> في Tamiyouz CRM</h2><p>للاستفادة من قدرات <strong>راكان الذكي</strong> المتقدمة داخل Tamiyouz CRM، اتبع الخطوات المنظمة التالية لضمان إعداد سلس واستخدام فعال:</p><ol><li><strong>الوصول إلى وحدة راكان الذكي:</strong> انتقل إلى القائمة الرئيسية واختر قسم <em>راكان الذكي</em> لفتح مساحة العمل المخصصة.</li><li><strong>مراجعة الحقول المتاحة:</strong> تفحص جميع الحقول القابلة للإعداد بواسطة الذكاء الاصطناعي لفهم نقاط البيانات التي يمكن أتمتتها أو تحسينها باستخدام راكان الذكي.</li><li><strong>إكمال الإعدادات الأولية:</strong> قم بتكوين الإعدادات الأساسية بما في ذلك:</li><ul><li><strong>قواعد التسمية:</strong> حدد قواعد واضحة ومتسقة لتسمية السجلات للحفاظ على سلامة البيانات.</li><li><strong>قواعد الملكية:</strong> اضبط إرشادات الملكية والتعيين للتحكم بمسؤولية البيانات.</li><li><strong>إعدادات الظهور:</strong> عدل الأذونات لضمان مستويات وصول مناسبة لأعضاء الفريق.</li></ul><li><strong>دعوة الفريق:</strong> بعد الانتهاء من التهيئات الأساسية، قم بدعوة أعضاء الفريق للتعاون واستخدام ميزات الذكاء الاصطناعي.</li><li><strong>اختبار بسجلات تجريبية:</strong> أنشئ سجل أو سجلين اختباريين للتحقق من سير العمل الآلي، والتأكد من أن الحالات والتنبيهات والصلاحيات تعمل كما هو متوقع.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> الإعداد الصحيح في البداية ضروري للحفاظ على نظافة البيانات ودقة التقارير، لذا خذ الوقت الكافي لمراجعة كل إعداد بعناية.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> يساعد اختبار سير العمل قبل النشر الكامل في اكتشاف المشكلات المحتملة مبكراً.</div>",
    "keywords": [
      "rakan ai",
      "راكان الذكي",
      "smart tools & ai",
      "الأدوات الذكية",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": true
  },
  {
    "id": "rakan-ai-troubleshooting",
    "categoryId": "smart-tools-ai",
    "sectionId": "rakan-ai",
    "questionEn": "Why is Rakan AI not showing the expected data?",
    "questionAr": "لماذا لا يعرض راكان الذكي البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Rakan AI not showing the expected data?</h2><p>When Rakan AI does not display the expected data, several factors could be responsible. Start by <strong>checking the applied filters</strong>, including any <strong>status filters</strong> that might be hiding relevant records. Additionally, verify the <strong>date range</strong> settings to ensure the data falls within the specified period. Ownership rules and user permissions often restrict visibility, so <strong>confirm that you have the necessary access rights</strong> to view the data.</p><p>In many cases, the data actually exists but remains hidden due to team scope limitations or missing field mappings within Rakan AI. To troubleshoot further, review recent activities such as <strong>imports, integrations, and automation rules</strong> that affect the module.</p><p>For a detailed diagnosis, compare one of the affected records against a similar record that is displaying correctly. Look for discrepancies in field values, ownership, or status that might explain why the data is not appearing as expected.</p><div class=\"tip\">💡 Tip: Regularly update your mappings and verify automation rules to maintain consistent data visibility in Rakan AI.</div>",
    "answerAr": "<h2>لماذا لا يعرض راكان الذكي البيانات المتوقعة؟</h2><p>عندما لا يعرض راكان الذكي البيانات المتوقعة، قد يكون هناك عدة أسباب وراء ذلك. ابدأ <strong>بفحص الفلاتر المطبقة</strong>، بما في ذلك <strong>فلاتر الحالة</strong> التي قد تُخفي السجلات ذات الصلة. كما يجب التحقق من <strong>الفترة الزمنية</strong> المحددة للتأكد من أن البيانات تقع ضمن النطاق المطلوب. غالباً ما تحد قواعد الملكية وصلاحيات المستخدم من إمكانية الرؤية، لذا <strong>تأكد من حصولك على الصلاحيات اللازمة</strong> لعرض البيانات.</p><p>في كثير من الحالات تكون البيانات موجودة لكنها مخفية بسبب قيود نطاق الفريق أو نقص الربط بين الحقول داخل راكان الذكي. لمزيد من التحليل، راجع الأنشطة الأخيرة مثل <strong>عمليات الاستيراد، والتكاملات، وقواعد الأتمتة</strong> المؤثرة على القسم.</p><p>لإجراء تشخيص دقيق، قارن بين سجل متأثر وآخر يعمل بشكل صحيح. ابحث عن اختلافات في قيم الحقول، الملكية، أو الحالة التي قد تفسر سبب عدم ظهور البيانات كما هو متوقع.</p><div class=\"tip\">💡 نصيحة: قم بتحديث الربط بين الحقول بانتظام وتحقق من قواعد الأتمتة لضمان ظهور البيانات بشكل مستمر في راكان الذكي.</div>",
    "keywords": [
      "rakan ai",
      "راكان الذكي",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "lead-intelligence-getting-started",
    "categoryId": "smart-tools-ai",
    "sectionId": "lead-intelligence",
    "questionEn": "How do I start using Lead Intelligence in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام ذكاء العملاء المحتملين في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Lead Intelligence in Tamiyouz CRM</h2><p>To begin leveraging the <strong>Lead Intelligence</strong> feature within Tamiyouz CRM, follow a structured setup process to ensure your data remains organized and actionable.</p><ol><li><strong>Access the Lead Intelligence Area:</strong> Navigate to the <em>Lead Intelligence</em> section from the main navigation menu in Tamiyouz CRM.</li><li><strong>Review Available Fields:</strong> Familiarize yourself with the predefined fields and data points available for lead tracking and analysis.</li><li><strong>Complete Required Setup:</strong> Configure essential settings including:</li><ul><li><strong>Naming Conventions:</strong> Establish clear and consistent naming rules to maintain data clarity.</li><li><strong>Ownership Rules:</strong> Define who owns each lead to streamline responsibility and follow-up.</li><li><strong>Visibility Settings:</strong> Set permissions to control which team members can view or edit lead information, ensuring data security and relevance.</li></ul><li><strong>Invite Your Team:</strong> Once configurations are complete, invite relevant team members to access and utilize Lead Intelligence.</li><li><strong>Test the Workflow:</strong> Create one or two sample lead records to verify that statuses, notifications, and permission settings function as expected.</li></ol><div class=\"tip\">💡 Tip: Regularly review and update ownership and visibility rules to adapt to team changes and keep data management efficient.</div><div class=\"note\">📝 Note: Proper setup at the start helps maintain clean data and enhances reporting accuracy.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام ذكاء العملاء المحتملين في Tamiyouz CRM</h2><p>لبدء استخدام ميزة <strong>ذكاء العملاء المحتملين</strong> داخل Tamiyouz CRM، اتبع عملية إعداد منظمة لضمان تنظيم البيانات وجعلها قابلة للاستخدام بفعالية.</p><ol><li><strong>الوصول إلى قسم ذكاء العملاء المحتملين:</strong> انتقل إلى قسم <em>ذكاء العملاء المحتملين</em> من قائمة التنقل الرئيسية في Tamiyouz CRM.</li><li><strong>مراجعة الحقول المتاحة:</strong> تعرّف على الحقول ونقاط البيانات المحددة مسبقًا والمتاحة لتتبع وتحليل العملاء المحتملين.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> قم بتكوين الإعدادات الأساسية بما في ذلك:</li><ul><li><strong>قواعد التسمية:</strong> وضع قواعد واضحة ومتسقة للتسمية للحفاظ على وضوح البيانات.</li><li><strong>قواعد الملكية:</strong> تحديد من يملك كل عميل محتمل لتسهيل المسؤولية والمتابعة.</li><li><strong>إعدادات الصلاحيات:</strong> ضبط الأذونات للتحكم في من يمكنه عرض أو تعديل معلومات العملاء المحتملين، مما يضمن أمان البيانات وملاءمتها.</li></ul><li><strong>دعوة الفريق:</strong> بعد إكمال التكوينات، قم بدعوة أعضاء الفريق المعنيين للوصول إلى واستخدام ذكاء العملاء المحتملين.</li><li><strong>اختبار سير العمل:</strong> أنشئ سجل أو سجلين تجريبيين للتأكد من أن الحالات والتنبيهات وإعدادات الصلاحيات تعمل كما هو متوقع.</li></ol><div class=\"tip\">💡 تلميح: راجع وقم بتحديث قواعد الملكية والصلاحيات بانتظام لمواكبة تغييرات الفريق والحفاظ على كفاءة إدارة البيانات.</div><div class=\"note\">📝 ملاحظة: يساعد الإعداد الصحيح في البداية على الحفاظ على بيانات نظيفة وتحسين دقة التقارير.</div>",
    "keywords": [
      "lead intelligence",
      "ذكاء العملاء المحتملين",
      "smart tools & ai",
      "الأدوات الذكية",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "lead-intelligence-troubleshooting",
    "categoryId": "smart-tools-ai",
    "sectionId": "lead-intelligence",
    "questionEn": "Why is Lead Intelligence not showing the expected data?",
    "questionAr": "لماذا لا يعرض ذكاء العملاء المحتملين البيانات المتوقعة؟",
    "answerEn": "<h2>Why Is Lead Intelligence Not Showing the Expected Data?</h2><p>When you notice that <strong>Lead Intelligence</strong> is not displaying the data you expect, several factors may be contributing to this issue. To troubleshoot effectively, follow these steps:</p><ol><li><strong>Check Filters and Date Range:</strong> Ensure that any applied filters such as status, lead source, or custom filters are not inadvertently hiding relevant data. Also, verify the selected date range covers the period you want to analyze.</li><li><strong>Review Ownership Rules and User Permissions:</strong> Data visibility depends on ownership settings and user roles. Confirm that you have the appropriate permissions and that ownership rules do not restrict access to certain leads.</li><li><strong>Examine Team Scope:</strong> In some cases, the data may be filtered by team or department. Make sure the team scope includes the leads you expect to see.</li><li><strong>Check Field Mappings:</strong> Missing or incorrect mappings between lead data fields and the intelligence system can cause data to be hidden.</li><li><strong>Inspect Recent Imports, Integrations, and Automation Rules:</strong> If the issue persists, review recent data imports and integrations for errors or omissions. Similarly, automation rules that process lead data could be affecting what is displayed in Lead Intelligence.</li><li><strong>Compare Records:</strong> Select one affected record and compare it side-by-side with a working record to identify discrepancies or missing data points quickly.</li></ol><div class=\"tip\">💡 Tip: Regularly auditing filters and permissions can help prevent data visibility issues before they arise.</div>",
    "answerAr": "<h2>لماذا لا يعرض ذكاء العملاء المحتملين البيانات المتوقعة؟</h2><p>عندما تلاحظ أن <strong>ذكاء العملاء المحتملين</strong> لا يعرض البيانات التي تتوقعها، فقد تكون هناك عدة عوامل تؤدي إلى هذه المشكلة. لتتمكن من استكشاف الأخطاء وإصلاحها بشكل فعّال، اتبع الخطوات التالية:</p><ol><li><strong>تحقق من الفلاتر والفترة الزمنية:</strong> تأكد من أن الفلاتر المطبقة مثل الحالة، مصدر العميل المحتمل، أو الفلاتر المخصصة لا تخفي البيانات المهمة. كما ينبغي التحقق من أن الفترة الزمنية المحددة تغطي المدة التي ترغب في تحليلها.</li><li><strong>راجع قواعد الملكية وصلاحيات المستخدم:</strong> تعتمد رؤية البيانات على إعدادات الملكية وأدوار المستخدمين. تأكد من أن لديك الصلاحيات المناسبة وأن قواعد الملكية لا تقيد الوصول إلى بعض العملاء المحتملين.</li><li><strong>افحص نطاق الفريق:</strong> في بعض الحالات، قد يتم تصفية البيانات بناءً على الفريق أو القسم. تأكد من أن نطاق الفريق يشمل العملاء المحتملين الذين تتوقع رؤيتهم.</li><li><strong>تحقق من ربط الحقول:</strong> قد يؤدي نقص أو خلل في ربط حقول بيانات العملاء المحتملين بنظام الذكاء إلى إخفاء البيانات.</li><li><strong>راجع عمليات الاستيراد والتكاملات وقواعد الأتمتة الأخيرة:</strong> إذا استمرت المشكلة، افحص عمليات الاستيراد والتكاملات الأخيرة بحثًا عن أخطاء أو سهو. وكذلك قواعد الأتمتة التي تعالج بيانات العملاء المحتملين قد تؤثر على ما يظهر في ذكاء العملاء المحتملين.</li><li><strong>قارن السجلات:</strong> اختر سجلًا متأثرًا وقارنه بجانب سجل يعمل بشكل صحيح لتحديد الاختلافات أو نقاط البيانات المفقودة بسرعة.</li></ol><div class=\"tip\">💡 نصيحة: المراجعة الدورية للفلاتر والصلاحيات تساعد في تجنب مشاكل رؤية البيانات قبل حدوثها.</div>",
    "keywords": [
      "lead intelligence",
      "ذكاء العملاء المحتملين",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "conversation-monitoring-getting-started",
    "categoryId": "smart-tools-ai",
    "sectionId": "conversation-monitoring",
    "questionEn": "How do I start using Conversation Monitoring in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام مراقبة المحادثات في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Conversation Monitoring in Tamiyouz CRM</h2><p>To effectively utilize the <strong>Conversation Monitoring</strong> feature within Tamiyouz CRM, follow these detailed steps to ensure your team benefits from clean, organized, and actionable conversation data.</p><ol><li><strong>Access the Conversation Monitoring Area:</strong> Navigate to the main menu and select the Conversation Monitoring section. This is your central hub for managing conversation data.</li><li><strong>Review Available Fields:</strong> Familiarize yourself with the fields and data points that can be tracked and analyzed. Understanding these will help tailor your setup to your business needs.</li><li><strong>Complete Initial Setup:</strong> Configure essential settings before inviting team members. Begin with:</li><ul><li><strong>Naming Conventions:</strong> Establish clear rules for naming conversations to maintain consistency.</li><li><strong>Ownership Rules:</strong> Define who owns or is responsible for each conversation to ensure accountability.</li><li><strong>Visibility Settings:</strong> Set permissions to control who can view or edit conversation data, keeping sensitive information secure.</li></ul><li><strong>Test the Workflow:</strong> Before full deployment, run tests using one or two sample records. Verify that conversation statuses update correctly, notifications trigger as expected, and permissions are properly enforced.</li></ol><div class=\"tip\">💡 Tip: Regularly review and update your setup as your team grows or processes evolve to keep conversation monitoring efficient and relevant.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام مراقبة المحادثات في Tamiyouz CRM</h2><p>لاستخدام ميزة <strong>مراقبة المحادثات</strong> بفعالية داخل Tamiyouz CRM، اتبع هذه الخطوات التفصيلية لضمان استفادة فريقك من بيانات المحادثات النظيفة والمنظمة والقابلة للتحليل.</p><ol><li><strong>الوصول إلى قسم مراقبة المحادثات:</strong> انتقل إلى القائمة الرئيسية واختر قسم مراقبة المحادثات، وهو المركز الرئيسي لإدارة بيانات المحادثات.</li><li><strong>مراجعة الحقول المتاحة:</strong> تعرف على الحقول ونقاط البيانات التي يمكن تتبعها وتحليلها، حيث سيساعدك هذا على تخصيص الإعدادات حسب احتياجات عملك.</li><li><strong>إكمال الإعدادات الأولية:</strong> قم بتكوين الإعدادات الأساسية قبل دعوة أعضاء الفريق، بدءاً من:</li><ul><li><strong>قواعد التسمية:</strong> وضع قواعد واضحة لتسمية المحادثات للحفاظ على الاتساق.</li><li><strong>قواعد الملكية:</strong> تحديد من يمتلك أو يكون مسؤولاً عن كل محادثة لضمان المساءلة.</li><li><strong>إعدادات الظهور:</strong> ضبط الصلاحيات للتحكم بمن يمكنه عرض أو تعديل بيانات المحادثات، مما يحفظ سرية المعلومات.</li></ul><li><strong>اختبار سير العمل:</strong> قبل التطبيق الكامل، قم بإجراء اختبارات باستخدام سجل أو سجلين تجريبيين. تحقق من تحديث حالات المحادثات بشكل صحيح، وتنبيه الإشعارات كما هو متوقع، وتطبيق الصلاحيات بشكل سليم.</li></ol><div class=\"tip\">💡 نصيحة: قم بمراجعة وتحديث إعداداتك بانتظام مع نمو فريقك أو تطور العمليات للحفاظ على فعالية مراقبة المحادثات وملاءمتها.</div>",
    "keywords": [
      "conversation monitoring",
      "مراقبة المحادثات",
      "smart tools & ai",
      "الأدوات الذكية",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "conversation-monitoring-troubleshooting",
    "categoryId": "smart-tools-ai",
    "sectionId": "conversation-monitoring",
    "questionEn": "Why is Conversation Monitoring not showing the expected data?",
    "questionAr": "لماذا لا يعرض مراقبة المحادثات البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Conversation Monitoring Not Showing the Expected Data?</h2><p>The <strong>Conversation Monitoring</strong> feature is designed to provide comprehensive insights into your interactions, but sometimes it may not display the expected data. To resolve this issue, follow these detailed steps:</p><ol><li><strong>Check Filters:</strong> Review all active filters including status filters that may be hiding certain conversations. Filters can limit visibility to specific conversation states.</li><li><strong>Date Range:</strong> Confirm that the selected date range encompasses the period when the conversations occurred. An incorrect date range often leads to missing data.</li><li><strong>Ownership Rules:</strong> Ensure that ownership settings align with your user permissions and team scopes. Conversations outside your scope may not appear.</li><li><strong>User Permissions:</strong> Verify that your user role grants access to view the relevant conversations. Insufficient permissions can limit data visibility.</li></ol><p>If these checks do not resolve the issue, proceed with the following:</p><ol start=\"5\"><li><strong>Review Recent Imports and Integrations:</strong> Examine any recent data imports or third-party integrations that might affect how conversations are logged or displayed.</li><li><strong>Automation Rules:</strong> Check automation rules linked to Conversation Monitoring to ensure they are correctly configured and not inadvertently filtering out data.</li><li><strong>Compare Records:</strong> Select one conversation record that is not displaying correctly and compare it with a working record. Look for differences in fields, ownership, status, or timestamps to quickly identify potential causes.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Regularly auditing your filters and permissions can prevent data visibility issues in Conversation Monitoring.</div>",
    "answerAr": "<h2>لماذا لا يعرض مراقبة المحادثات البيانات المتوقعة؟</h2><p>تم تصميم ميزة <strong>مراقبة المحادثات</strong> لتوفير رؤى شاملة حول التفاعلات الخاصة بك، ولكن قد لا تظهر البيانات المتوقعة في بعض الأحيان. لحل هذه المشكلة، اتبع الخطوات التفصيلية التالية:</p><ol><li><strong>تحقق من الفلاتر:</strong> راجع جميع الفلاتر النشطة بما في ذلك فلاتر الحالة التي قد تخفي بعض المحادثات. يمكن أن تحد الفلاتر من رؤية المحادثات بحالات معينة.</li><li><strong>الفترة الزمنية:</strong> تأكد من أن الفترة الزمنية المحددة تغطي الفترة التي حدثت فيها المحادثات. قد يؤدي اختيار فترة زمنية خاطئة إلى فقدان البيانات.</li><li><strong>قواعد الملكية:</strong> تأكد من أن إعدادات الملكية تتوافق مع صلاحيات المستخدم ونطاق الفريق الخاص بك. قد لا تظهر المحادثات خارج نطاقك.</li><li><strong>صلاحيات المستخدم:</strong> تحقق من أن دور المستخدم الخاص بك يمنحك حق الوصول لعرض المحادثات ذات الصلة. قد تؤدي الصلاحيات غير الكافية إلى تقييد رؤية البيانات.</li></ol><p>إذا لم تحل هذه الفحوصات المشكلة، فتابع الخطوات التالية:</p><ol start=\"5\"><li><strong>راجع عمليات الاستيراد والتكاملات الأخيرة:</strong> افحص أي عمليات استيراد بيانات أو تكاملات مع أطراف ثالثة قد تؤثر على كيفية تسجيل أو عرض المحادثات.</li><li><strong>قواعد الأتمتة:</strong> تحقق من قواعد الأتمتة المرتبطة بمراقبة المحادثات للتأكد من تكوينها بشكل صحيح وعدم تصفيتها للبيانات عن غير قصد.</li><li><strong>قارن السجلات:</strong> اختر سجلاً لمحادثة لا يظهر بشكل صحيح وقارنه بسجل يعمل بشكل سليم. ابحث عن اختلافات في الحقول أو الملكية أو الحالة أو الطوابع الزمنية لتحديد الأسباب المحتملة بسرعة.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> تدقيق الفلاتر والصلاحيات بشكل دوري يمكن أن يمنع مشاكل رؤية البيانات في مراقبة المحادثات.</div>",
    "keywords": [
      "conversation monitoring",
      "مراقبة المحادثات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "custom-fields-getting-started",
    "categoryId": "settings-advanced",
    "sectionId": "custom-fields",
    "questionEn": "How do I start using Custom Fields in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام الحقول المخصصة في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Custom Fields in Tamiyouz CRM</h2><p>To begin utilizing <strong>Custom Fields</strong> in Tamiyouz CRM, navigate to the <strong>Custom Fields</strong> section via the main navigation menu. This area allows you to view and manage all existing custom fields tailored to your organizational needs.</p><p>Before enabling team-wide usage, it is crucial to complete the initial setup to ensure data integrity and usability. Follow these key steps:</p><ol><li><strong>Define Naming Conventions:</strong> Establish clear and consistent naming rules for your fields to maintain clarity and ease of identification across your CRM.</li><li><strong>Set Ownership Rules:</strong> Determine which users or teams own specific fields to control data responsibility and accountability.</li><li><strong>Configure Visibility Settings:</strong> Adjust field visibility permissions so that sensitive or irrelevant data is only accessible to appropriate users, enhancing data security and relevance.</li></ol><p>After configuring these settings, perform a thorough test of the workflow by creating one or two sample records. This testing phase helps validate that statuses update correctly, notifications trigger as expected, and permissions function properly.</p><div class=\"tip\">💡 Tip: Regularly review and update your custom fields as your business processes evolve to keep your CRM data clean and reporting accurate.</div><div class=\"note\">📝 Note: Proper setup of custom fields significantly improves your ability to generate meaningful reports and insights.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام الحقول المخصصة في Tamiyouz CRM</h2><p>لبدء استخدام <strong>الحقول المخصصة</strong> في Tamiyouz CRM، انتقل إلى قسم <strong>الحقول المخصصة</strong> من خلال قائمة التنقل الرئيسية. يتيح لك هذا القسم عرض وإدارة جميع الحقول المخصصة المتاحة والمصممة لتلبية احتياجات مؤسستك.</p><p>قبل السماح للفريق باستخدام الحقول بشكل شامل، من الضروري إكمال الإعدادات الأولية لضمان سلامة البيانات وسهولة استخدامها. اتبع الخطوات الرئيسية التالية:</p><ol><li><strong>تحديد قواعد التسمية:</strong> ضع قواعد واضحة ومتسقة لتسمية الحقول للحفاظ على الوضوح وسهولة التعرف عليها في النظام.</li><li><strong>تعيين قواعد الملكية:</strong> حدد المستخدمين أو الفرق المسؤولة عن كل حقل للتحكم في مسؤولية البيانات ومحاسبة أصحابها.</li><li><strong>ضبط إعدادات الظهور:</strong> قم بتعديل صلاحيات ظهور الحقول بحيث يتمكن المستخدمون المناسبون فقط من الوصول إلى البيانات الحساسة أو غير ذات الصلة، مما يعزز أمان البيانات وملاءمتها.</li></ol><p>بعد إكمال هذه الإعدادات، قم بإجراء اختبار شامل لسير العمل عن طريق إنشاء سجل أو سجلين تجريبيين. تساعدك هذه المرحلة على التأكد من تحديث الحالات بشكل صحيح، وتنشيط التنبيهات كما هو متوقع، وعمل الصلاحيات بشكل سليم.</p><div class=\"tip\">💡 نصيحة: قم بمراجعة وتحديث الحقول المخصصة بانتظام مع تطور عمليات عملك للحفاظ على نظافة البيانات ودقة التقارير.</div><div class=\"note\">📝 ملاحظة: الإعداد الصحيح للحقول المخصصة يعزز بشكل كبير قدرتك على توليد تقارير ورؤى ذات مغزى.</div>",
    "keywords": [
      "custom fields",
      "الحقول المخصصة",
      "settings & advanced",
      "الإعدادات والمتقدمة",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "custom-fields-troubleshooting",
    "categoryId": "settings-advanced",
    "sectionId": "custom-fields",
    "questionEn": "Why is Custom Fields not showing the expected data?",
    "questionAr": "لماذا لا يعرض الحقول المخصصة البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Custom Fields not showing the expected data?</h2><p>When you notice that <strong>Custom Fields</strong> are not displaying the expected data, several factors could be causing this issue. Begin by verifying the following:</p><ul><li><strong>Filters:</strong> Ensure that no active filters such as status filters are hiding the data you expect to see.</li><li><strong>Date Range:</strong> Confirm that the selected date range includes the period when the data was created or updated.</li><li><strong>Ownership Rules:</strong> Check if ownership or team scope constraints are limiting visibility to certain records.</li><li><strong>User Permissions:</strong> Make sure your user role has the necessary rights to view the custom field data.</li></ul><p>Often, the data exists but is simply not visible due to one of the above reasons. If the problem persists, perform a detailed review of related system components:</p><ul><li><strong>Recent Imports:</strong> Verify if recent data imports were correctly mapped to custom fields.</li><li><strong>Integrations:</strong> Check if connected applications or APIs are properly syncing the custom field data.</li><li><strong>Automation Rules:</strong> Review any automation workflows that might affect the visibility or population of these fields.</li></ul><p>For a thorough diagnosis, compare an affected record with one that displays data correctly. This side-by-side comparison can quickly highlight discrepancies and help you identify the root cause.</p><div class=\"tip\">💡 <strong>Tip:</strong> Regularly auditing your filters and permissions can prevent most visibility issues related to Custom Fields.</div>",
    "answerAr": "<h2>لماذا لا يعرض الحقول المخصصة البيانات المتوقعة؟</h2><p>عندما تلاحظ أن <strong>الحقول المخصصة</strong> لا تعرض البيانات المتوقعة، قد يكون هناك عدة أسباب تؤدي إلى هذه المشكلة. ابدأ بالتحقق من العناصر التالية:</p><ul><li><strong>الفلاتر:</strong> تأكد من عدم وجود فلاتر نشطة مثل فلاتر الحالة التي قد تخفي البيانات التي تتوقع رؤيتها.</li><li><strong>الفترة الزمنية:</strong> تحقق من أن النطاق الزمني المحدد يشمل الفترة التي تم فيها إنشاء أو تحديث البيانات.</li><li><strong>قواعد الملكية:</strong> افحص إذا كانت قيود الملكية أو نطاق الفريق تحد من إمكانية رؤية سجلات معينة.</li><li><strong>صلاحيات المستخدم:</strong> تأكد من أن دور المستخدم لديك يملك الصلاحيات اللازمة لعرض بيانات الحقول المخصصة.</li></ul><p>غالبًا ما تكون البيانات موجودة لكنها غير مرئية بسبب أحد الأسباب المذكورة أعلاه. إذا استمرت المشكلة، قم بمراجعة دقيقة للعناصر المرتبطة بالنظام:</p><ul><li><strong>عمليات الاستيراد الأخيرة:</strong> تحقق مما إذا تم ربط البيانات المستوردة حديثًا بالحقول المخصصة بشكل صحيح.</li><li><strong>التكاملات:</strong> افحص ما إذا كانت التطبيقات أو واجهات برمجة التطبيقات المتصلة تقوم بمزامنة بيانات الحقول المخصصة بشكل صحيح.</li><li><strong>قواعد الأتمتة:</strong> راجع أي قواعد أتمتة قد تؤثر على ظهور أو ملء هذه الحقول.</li></ul><p>للحصول على تشخيص دقيق، قارن سجلًا متأثرًا بسجل يعرض البيانات بشكل صحيح. سيساعدك هذا المقارنة الجانبية في تحديد الفروقات بسرعة ومعرفة السبب الجذري للمشكلة.</p><div class=\"tip\">💡 <strong>نصيحة:</strong> قم بمراجعة الفلاتر والصلاحيات بانتظام لتجنب معظم مشاكل الرؤية المتعلقة بالحقول المخصصة.</div>",
    "keywords": [
      "custom fields",
      "الحقول المخصصة",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "lead-sources-getting-started",
    "categoryId": "settings-advanced",
    "sectionId": "lead-sources",
    "questionEn": "How do I start using Lead Sources in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام مصادر العملاء في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Lead Sources in Tamiyouz CRM</h2><p>To effectively utilize <strong>Lead Sources</strong> in Tamiyouz CRM, begin by navigating to the <strong>Lead Sources</strong> section via the main navigation menu. This area allows you to manage and customize the sources from which your leads originate, ensuring your data is organized and actionable.</p><h3>Step 1: Review Available Fields</h3><p>Familiarize yourself with the fields provided for lead sources. Understanding these fields will help tailor the setup to your business needs.</p><h3>Step 2: Complete Required Setup</h3><ol><li><strong>Naming Conventions:</strong> Define clear and consistent naming rules for lead sources to maintain data clarity.</li><li><strong>Ownership Rules:</strong> Assign ownership to specific team members or departments to streamline responsibility.</li><li><strong>Visibility Settings:</strong> Set permissions to control who can view or edit lead source data, keeping information secure and relevant.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Proper setup ensures your data remains clean and simplifies reporting.</div><h3>Step 3: Test the Workflow</h3><p>Before rolling out to the entire team, create one or two sample lead records using the configured lead sources. Verify that statuses update correctly, notifications trigger as expected, and permissions function properly.</p><div class=\"note\">📝 <strong>Note:</strong> Testing helps identify any misconfigurations early, avoiding issues when scaling usage.</div><p>After successful testing, invite your team members to use the feature, ensuring they understand the established rules and workflows.</p>",
    "answerAr": "<h2>كيف أبدأ باستخدام مصادر العملاء في Tamiyouz CRM</h2><p>للاستفادة الفعالة من <strong>مصادر العملاء</strong> في Tamiyouz CRM، ابدأ بالانتقال إلى قسم <strong>مصادر العملاء</strong> من خلال قائمة التنقل الرئيسية. يتيح لك هذا القسم إدارة وتخصيص المصادر التي تأتي منها بيانات العملاء المحتملين، مما يضمن تنظيم البيانات وجعلها قابلة للتحليل.</p><h3>الخطوة 1: مراجعة الحقول المتاحة</h3><p>تعرف على الحقول المقدمة لمصادر العملاء. فهم هذه الحقول يساعدك في تهيئة الإعدادات بما يتناسب مع احتياجات عملك.</p><h3>الخطوة 2: إكمال الإعدادات المطلوبة</h3><ol><li><strong>قواعد التسمية:</strong> حدد قواعد واضحة ومتناسقة لتسمية مصادر العملاء للحفاظ على وضوح البيانات.</li><li><strong>قواعد الملكية:</strong> قم بتعيين ملكية مصادر العملاء لأعضاء فريق معينين أو أقسام لتسهيل توزيع المسؤوليات.</li><li><strong>إعدادات الظهور:</strong> اضبط الصلاحيات للتحكم بمن يمكنه عرض أو تعديل بيانات مصادر العملاء، مما يحافظ على أمان المعلومات وملاءمتها.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> الإعداد الصحيح يضمن بقاء البيانات نظيفة ويسهل إعداد التقارير.</div><h3>الخطوة 3: اختبار سير العمل</h3><p>قبل تعميم الاستخدام على الفريق بالكامل، أنشئ سجل أو سجلين تجريبيين باستخدام مصادر العملاء المُعدة. تحقق من تحديث الحالات بشكل صحيح، وتنفيذ التنبيهات كما هو متوقع، وعمل الصلاحيات بشكل سليم.</p><div class=\"note\">📝 <strong>ملاحظة:</strong> يساعد الاختبار على اكتشاف أي أخطاء في الإعداد مبكرًا وتجنب المشاكل عند توسيع الاستخدام.</div><p>بعد نجاح الاختبار، قم بدعوة أعضاء فريقك لاستخدام هذه الميزة مع التأكد من فهمهم للقواعد وسير العمل المعتمد.</p>",
    "keywords": [
      "lead sources",
      "مصادر العملاء",
      "settings & advanced",
      "الإعدادات والمتقدمة",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "lead-sources-troubleshooting",
    "categoryId": "settings-advanced",
    "sectionId": "lead-sources",
    "questionEn": "Why is Lead Sources not showing the expected data?",
    "questionAr": "لماذا لا يعرض مصادر العملاء البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Lead Sources not showing the expected data?</h2><p>When you notice that the <strong>Lead Sources</strong> feature is not displaying the data you expect, it's important to systematically verify several key areas to identify and resolve the issue:</p><ol><li><strong>Check Filters and Date Range:</strong> Ensure that all applied filters, including status and date ranges, are correctly set to include the data you want to view. Sometimes, data may exist but be hidden due to restrictive filters.</li><li><strong>Review Ownership and User Permissions:</strong> Confirm that your user role has the necessary permissions to view the relevant lead source data. Ownership rules can limit visibility to only specific teams or users.</li><li><strong>Inspect Team Scope:</strong> The data visibility might be constrained by team scopes configured in your system, so verify that the appropriate teams are selected or included.</li><li><strong>Analyze Data Mappings:</strong> Missing or incorrect field mappings related to lead sources can cause data not to appear. Check that all mappings are properly configured and up to date.</li><li><strong>Evaluate Recent Imports, Integrations, and Automation:</strong> If the issue persists, review any recent data imports, integration setups, or automation rules that might affect lead sources data. Such processes can inadvertently alter or filter the data.</li><li><strong>Compare Records:</strong> To quickly identify discrepancies, compare an affected lead record against a properly displaying one to spot differences in fields, statuses, or ownership.</li></ol><div class=\"tip\">💡 Tip: Regularly auditing your filters, permissions, and integrations will help maintain consistent and accurate data visibility in Lead Sources.</div>",
    "answerAr": "<h2>لماذا لا يعرض مصادر العملاء البيانات المتوقعة؟</h2><p>عند ملاحظة أن خاصية <strong>مصادر العملاء</strong> لا تعرض البيانات المتوقعة، من المهم التحقق بشكل منهجي من عدة جوانب رئيسية لتحديد المشكلة وحلها:</p><ol><li><strong>تحقق من الفلاتر والفترة الزمنية:</strong> تأكد من ضبط جميع الفلاتر المطبقة، بما في ذلك الحالة والفترة الزمنية، بشكل صحيح لتشمل البيانات التي ترغب في مشاهدتها. في بعض الأحيان تكون البيانات موجودة لكنها مخفية بسبب فلاتر مقيدة.</li><li><strong>مراجعة قواعد الملكية وصلاحيات المستخدم:</strong> تحقق من أن دور المستخدم الخاص بك يمتلك الصلاحيات اللازمة لعرض بيانات مصادر العملاء ذات الصلة. قواعد الملكية قد تحد من الرؤية لتشمل فرقًا أو مستخدمين محددين فقط.</li><li><strong>فحص نطاق الفريق:</strong> قد تكون رؤية البيانات مقيدة بنطاقات الفريق المكونة في النظام، لذا تحقق من اختيار أو تضمين الفرق المناسبة.</li><li><strong>تحليل الربط بين الحقول:</strong> قد تؤدي الربط الخاطئ أو الناقص للحقول المتعلقة بمصادر العملاء إلى عدم ظهور البيانات. تحقق من صحة إعدادات الربط وتحديثها بشكل مستمر.</li><li><strong>تقييم عمليات الاستيراد والتكامل والأتمتة الأخيرة:</strong> إذا استمرت المشكلة، راجع أي عمليات استيراد بيانات حديثة، أو إعدادات التكامل، أو قواعد الأتمتة التي قد تؤثر على بيانات مصادر العملاء. قد تؤدي هذه العمليات إلى تعديل أو ترشيح البيانات عن غير قصد.</li><li><strong>قارن بين السجلات:</strong> لتحديد الاختلافات بسرعة، قارن بين سجل متأثر لا تظهر بياناته وسجل يعمل بشكل صحيح لرصد الفروقات في الحقول أو الحالة أو الملكية.</li></ol><div class=\"tip\">💡 نصيحة: المراجعة الدورية للفلاتر والصلاحيات والتكاملات تساعد في الحفاظ على رؤية دقيقة ومستمرة لبيانات مصادر العملاء.</div>",
    "keywords": [
      "lead sources",
      "مصادر العملاء",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "notifications-getting-started",
    "categoryId": "settings-advanced",
    "sectionId": "notifications",
    "questionEn": "How do I start using Notifications in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام الإشعارات في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Notifications in Tamiyouz CRM</h2><p>To effectively utilize the <strong>Notifications</strong> feature in Tamiyouz CRM, begin by accessing the <strong>Notifications</strong> area through the main navigation menu. This section allows you to configure all notification-related settings to suit your organization's needs.</p><h3>Step-by-Step Setup</h3><ol><li><strong>Review Available Fields:</strong> Examine all notification fields and options presented to understand what can be customized.</li><li><strong>Configure Naming Conventions:</strong> Establish consistent naming rules for notifications to maintain clarity and uniformity across the system.</li><li><strong>Set Ownership Rules:</strong> Define who owns each notification or related data to ensure accountability and streamlined management.</li><li><strong>Adjust Visibility Settings:</strong> Control which users or teams can view specific notifications, enhancing data privacy and relevance.</li><li><strong>Test the Workflow:</strong> Use one or two sample records to validate that notifications trigger correctly, statuses update as expected, and permissions are properly enforced.</li></ol><div class=\"tip\">💡 Tip: Regularly revisiting your notification setup helps keep your CRM data clean and simplifies reporting.</div><div class=\"note\">📝 Note: Proper configuration before team rollout ensures smoother adoption and reduces the need for troubleshooting later.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام الإشعارات في Tamiyouz CRM</h2><p>للاستفادة بشكل فعال من ميزة <strong>الإشعارات</strong> في Tamiyouz CRM، ابدأ بفتح قسم <strong>الإشعارات</strong> من قائمة التنقل الرئيسية. يتيح لك هذا القسم ضبط جميع الإعدادات المتعلقة بالإشعارات بما يتناسب مع احتياجات منظمتك.</p><h3>خطوات الإعداد</h3><ol><li><strong>مراجعة الحقول المتاحة:</strong> استعرض جميع حقول وخيارات الإشعارات لفهم ما يمكن تخصيصه.</li><li><strong>تكوين قواعد التسمية:</strong> ضع قواعد تسمية متسقة للإشعارات للحفاظ على الوضوح والاتساق في النظام.</li><li><strong>تحديد قواعد الملكية:</strong> عرّف من يمتلك كل إشعار أو البيانات المرتبطة به لضمان المساءلة والإدارة السلسة.</li><li><strong>ضبط إعدادات الظهور:</strong> تحكم في من يمكنه رؤية الإشعارات المحددة لتعزيز خصوصية البيانات وملاءمتها.</li><li><strong>اختبار سير العمل:</strong> استخدم سجلًا أو سجلين نموذجيين للتحقق من تفعيل الإشعارات بشكل صحيح، وتحديث الحالات كما هو متوقع، وتطبيق الصلاحيات بدقة.</li></ol><div class=\"tip\">💡 تلميح: مراجعة إعدادات الإشعارات بانتظام تساعد في الحفاظ على نظافة بيانات CRM وتسهيل إعداد التقارير.</div><div class=\"note\">📝 ملاحظة: الإعداد السليم قبل بدء استخدام الفريق يضمن اعتمادًا أكثر سلاسة ويقلل الحاجة إلى حل المشكلات لاحقًا.</div>",
    "keywords": [
      "notifications",
      "الإشعارات",
      "settings & advanced",
      "الإعدادات والمتقدمة",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": true
  },
  {
    "id": "notifications-troubleshooting",
    "categoryId": "settings-advanced",
    "sectionId": "notifications",
    "questionEn": "Why is Notifications not showing the expected data?",
    "questionAr": "لماذا لا يعرض الإشعارات البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Notifications not showing the expected data?</h2><p>When you notice that the <strong>Notifications</strong> feature is not displaying the expected information, several factors could be influencing this behavior. To troubleshoot effectively, start by verifying the following:</p><ul><li><strong>Filters:</strong> Ensure that no status or category filters are hiding relevant notifications.</li><li><strong>Date Range:</strong> Confirm that the selected date range includes the timeframe for the notifications you expect to see.</li><li><strong>Ownership Rules:</strong> Check if ownership or team scope restrictions limit the visibility of certain notifications.</li><li><strong>User Permissions:</strong> Review the permissions assigned to your user role to confirm you have access rights to the relevant data.</li></ul><p>Frequently, the data exists but is obscured due to the above filters or missing field mappings that affect how notifications are linked and displayed.</p><div class=\"tip\">💡 Tip: After initial checks, if the issue persists, examine recent <strong>imports</strong>, <strong>integrations</strong>, and <strong>automation rules</strong> connected to the Notifications module. These might alter data visibility or processing.</div><p>To identify discrepancies quickly, select one notification record that is affected by the problem and compare it side-by-side with a record that displays correctly. Look for differences in field values, ownership, or status that might explain why one appears and the other does not.</p>",
    "answerAr": "<h2>لماذا لا يعرض الإشعارات البيانات المتوقعة؟</h2><p>عندما تلاحظ أن ميزة <strong>الإشعارات</strong> لا تعرض المعلومات المتوقعة، هناك عدة عوامل قد تؤثر على هذا السلوك. للقيام باستكشاف الأخطاء وإصلاحها بشكل فعال، ابدأ بالتحقق من الأمور التالية:</p><ul><li><strong>الفلاتر:</strong> تأكد من عدم وجود فلاتر حالة أو فئات تُخفي الإشعارات ذات الصلة.</li><li><strong>الفترة الزمنية:</strong> تحقق من أن الفترة الزمنية المختارة تشمل الإشعارات التي تتوقع ظهورها.</li><li><strong>قواعد الملكية:</strong> تحقق مما إذا كانت قيود الملكية أو نطاق الفريق تُحد من رؤية بعض الإشعارات.</li><li><strong>صلاحيات المستخدم:</strong> راجع الصلاحيات الممنوحة لدور المستخدم الخاص بك للتأكد من وجود حق الوصول إلى البيانات ذات الصلة.</li></ul><p>غالباً ما تكون البيانات موجودة لكنها مخفية بسبب الفلاتر السابقة أو نقص الربط بين الحقول التي تؤثر على كيفية ربط الإشعارات وعرضها.</p><div class=\"tip\">💡 نصيحة: بعد الفحوصات الأولية، إذا استمرت المشكلة، قم بمراجعة آخر <strong>عمليات الاستيراد</strong>، و<strong>عمليات التكامل</strong>، و<strong>قواعد الأتمتة</strong> المرتبطة بوحدة الإشعارات. قد تؤثر هذه على ظهور البيانات أو معالجتها.</div><p>لتحديد الفروقات بسرعة، اختر سجلاً متأثراً بالمشكلة وقارنه جانباً إلى جنب مع سجل يظهر بشكل صحيح. ابحث عن اختلافات في قيم الحقول أو الملكية أو الحالة التي قد تفسر سبب ظهور أحدهما وعدم ظهور الآخر.</p>",
    "keywords": [
      "notifications",
      "الإشعارات",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "dark-mode-getting-started",
    "categoryId": "settings-advanced",
    "sectionId": "dark-mode",
    "questionEn": "How do I start using Dark Mode in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام الوضع الداكن في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Dark Mode in Tamiyouz CRM</h2><p>To enable and effectively use <strong>Dark Mode</strong> in Tamiyouz CRM, follow a structured setup process to ensure optimal team adoption and data integrity.</p><ol><li><strong>Access the Dark Mode Settings:</strong> Navigate to the <em>Dark Mode</em> section via the main navigation menu. This is where all configuration options are available.</li><li><strong>Review Available Fields:</strong> Examine the fields and parameters presented. Understanding these options is crucial for proper setup.</li><li><strong>Complete Required Setup:</strong> Begin with defining <strong>naming conventions</strong> to maintain consistency across records. Then, configure <strong>ownership rules</strong> to assign data responsibilities appropriately. Finally, adjust <strong>visibility settings</strong> to control which users or teams can view specific data, helping keep your data clean and easy to report on.</li><li><strong>Test the Workflow:</strong> Before rolling out Dark Mode to the entire team, create one or two sample records to validate the workflow. Confirm that the status changes, notifications, and permissions behave as expected.</li><li><strong>Invite Your Team:</strong> Once testing is successful, invite your team members to start using Dark Mode with confidence.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Regularly review visibility and ownership rules as your team grows to maintain data clarity and security.</div><div class=\"note\">📝 <strong>Note:</strong> Testing with sample records helps prevent disruptions during full deployment.</div>",
    "answerAr": "<h2>كيف أبدأ باستخدام الوضع الداكن في Tamiyouz CRM</h2><p>لتمكين واستخدام <strong>الوضع الداكن</strong> بشكل فعّال في Tamiyouz CRM، اتبع خطوات إعداد منظمة لضمان اعتماد الفريق وجودة البيانات.</p><ol><li><strong>الوصول إلى إعدادات الوضع الداكن:</strong> افتح قسم <em>الوضع الداكن</em> من قائمة التنقل الرئيسية حيث تتوفر جميع خيارات التكوين.</li><li><strong>مراجعة الحقول المتاحة:</strong> اطلع على الحقول والمعايير المعروضة. فهم هذه الخيارات ضروري لإعداد صحيح.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> ابدأ بتحديد <strong>قواعد التسمية</strong> للحفاظ على اتساق السجلات. ثم قم بضبط <strong>قواعد الملكية</strong> لتعيين مسؤوليات البيانات بشكل مناسب. وأخيراً، عدل <strong>إعدادات الظهور</strong> للتحكم في من يمكنه رؤية البيانات، مما يساعد على إبقاء بياناتك نظيفة وسهلة في التقارير.</li><li><strong>اختبار سير العمل:</strong> قبل تعميم الوضع الداكن على الفريق، أنشئ سجل أو سجلين تجريبيين للتحقق من سير العمل. تأكد من أن تغييرات الحالة والتنبيهات والصلاحيات تعمل كما هو متوقع.</li><li><strong>دعوة الفريق:</strong> بعد نجاح الاختبار، قم بدعوة أعضاء الفريق لبدء استخدام الوضع الداكن بثقة.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> راجع قواعد الظهور والملكية بانتظام مع نمو الفريق للحفاظ على وضوح وأمان البيانات.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> يساعد اختبار السجلات التجريبية على تجنب المشاكل أثناء النشر الكامل.</div>",
    "keywords": [
      "dark mode",
      "الوضع الداكن",
      "settings & advanced",
      "الإعدادات والمتقدمة",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "dark-mode-troubleshooting",
    "categoryId": "settings-advanced",
    "sectionId": "dark-mode",
    "questionEn": "Why is Dark Mode not showing the expected data?",
    "questionAr": "لماذا لا يعرض الوضع الداكن البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Dark Mode not showing the expected data?</h2>\n<p>When Dark Mode does not display the expected data, there are several key areas to investigate to resolve the issue efficiently.</p>\n<h3>Step 1: Verify Filters and Date Range</h3>\n<p>Start by reviewing all applied filters, including status filters and ownership rules, as well as the selected date range. Often, data is present but filtered out due to restrictive criteria.</p>\n<h3>Step 2: Check User Permissions and Team Scope</h3>\n<p>Ensure that your user permissions allow access to the relevant data sets. Additionally, confirm whether the team scope settings might be limiting visibility.</p>\n<h3>Step 3: Examine Mappings and Data Integrity</h3>\n<p>Missing or incorrect field mappings can cause data to be hidden in Dark Mode views. Validate that all necessary mappings are correctly configured.</p>\n<h3>Step 4: Review Imports, Integrations, and Automation Rules</h3>\n<p>Assess recent data imports and integrations to verify data consistency. Also, inspect automation rules related to Dark Mode, as these may affect data visibility.</p>\n<h3>Step 5: Compare Affected vs. Working Records</h3>\n<p>To quickly identify discrepancies, compare a record that is not displaying data correctly with one that is functioning as expected. This comparison can highlight differences causing the issue.</p>\n<div class=\"tip\">💡 Tip: Keeping a checklist of these troubleshooting steps can streamline resolving data visibility problems in Dark Mode.</div>",
    "answerAr": "<h2>لماذا لا يعرض الوضع الداكن البيانات المتوقعة؟</h2>\n<p>عندما لا يعرض الوضع الداكن البيانات المتوقعة، هناك عدة نقاط رئيسية يجب فحصها لحل المشكلة بكفاءة.</p>\n<h3>الخطوة 1: التحقق من الفلاتر والفترة الزمنية</h3>\n<p>ابدأ بمراجعة جميع الفلاتر المطبقة، بما في ذلك فلاتر الحالة وقواعد الملكية، بالإضافة إلى الفترة الزمنية المحددة. غالبًا ما تكون البيانات موجودة ولكنها مخفية بسبب معايير تصفية صارمة.</p>\n<h3>الخطوة 2: التحقق من صلاحيات المستخدم ونطاق الفريق</h3>\n<p>تأكد من أن صلاحيات المستخدم لديك تسمح بالوصول إلى مجموعات البيانات ذات الصلة. كما يجب التأكد مما إذا كانت إعدادات نطاق الفريق قد تحد من الرؤية.</p>\n<h3>الخطوة 3: فحص الربط وسلامة البيانات</h3>\n<p>قد تؤدي الربطات المفقودة أو غير الصحيحة للحقول إلى إخفاء البيانات في عرض الوضع الداكن. تحقق من أن جميع الربطات الضرورية مُعدة بشكل صحيح.</p>\n<h3>الخطوة 4: مراجعة عمليات الاستيراد والتكاملات وقواعد الأتمتة</h3>\n<p>قم بتقييم عمليات الاستيراد والتكاملات الأخيرة للتحقق من اتساق البيانات. كما ينبغي فحص قواعد الأتمتة المرتبطة بالوضع الداكن، إذ قد تؤثر على ظهور البيانات.</p>\n<h3>الخطوة 5: مقارنة السجلات المتأثرة بتلك العاملة</h3>\n<p>لتحديد الفروقات بسرعة، قارن بين سجل لا يعرض البيانات بشكل صحيح وآخر يعمل كما هو متوقع. يمكن أن تكشف هذه المقارنة عن الاختلافات التي تسبب المشكلة.</p>\n<div class=\"tip\">💡 نصيحة: الاحتفاظ بقائمة تحقق لهذه الخطوات يمكن أن يسهل حل مشكلات رؤية البيانات في الوضع الداكن.</div>",
    "keywords": [
      "dark mode",
      "الوضع الداكن",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "language-getting-started",
    "categoryId": "settings-advanced",
    "sectionId": "language",
    "questionEn": "How do I start using Language in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام اللغة في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with the Language Feature in Tamiyouz CRM</h2><p>The <strong>Language</strong> feature in Tamiyouz CRM empowers you to customize and manage language settings to ensure your data remains consistent and accessible across your team. To begin using this feature, follow these detailed steps:</p><ol><li><strong>Access the Language Section:</strong> From the main navigation menu, select the <em>Language</em> area to open the language management interface.</li><li><strong>Review Available Fields:</strong> Examine the fields provided for language settings, including naming conventions, ownership rules, and visibility options.</li><li><strong>Complete Required Setup:</strong> Configure the necessary parameters carefully. Start by defining naming conventions to maintain uniformity. Set ownership rules to control data responsibility and assign visibility settings to specify who can access certain language data.</li><li><strong>Test the Configuration:</strong> Before rolling out to your entire team, create one or two sample records to simulate typical workflows. Verify that the statuses update correctly, notifications are sent as expected, and permissions restrict or allow access appropriately.</li><li><strong>Invite Your Team:</strong> Once testing confirms the setup works smoothly, invite team members to start using the language feature effectively.</li></ol><div class=\"tip\">💡 <strong>Tip:</strong> Establishing clear naming conventions and ownership rules early helps keep your data clean and reporting straightforward.</div><div class=\"note\">📝 <strong>Note:</strong> Testing workflows with sample records is essential to avoid unexpected issues when the feature is fully deployed.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام ميزة اللغة في Tamiyouz CRM</h2><p>تتيح لك ميزة <strong>اللغة</strong> في Tamiyouz CRM تخصيص وإدارة إعدادات اللغة لضمان بقاء بياناتك دقيقة ومتسقة وسهلة الوصول لجميع أعضاء الفريق. للبدء باستخدام هذه الميزة، اتبع الخطوات التفصيلية التالية:</p><ol><li><strong>الوصول إلى قسم اللغة:</strong> من قائمة التنقل الرئيسية، اختر قسم <em>اللغة</em> لفتح واجهة إدارة إعدادات اللغة.</li><li><strong>مراجعة الحقول المتاحة:</strong> اطلع على الحقول الخاصة بإعدادات اللغة، بما في ذلك قواعد التسمية وقواعد الملكية وخيارات الظهور.</li><li><strong>إكمال الإعدادات المطلوبة:</strong> قم بتكوين المعايير اللازمة بدقة. ابدأ بتحديد قواعد التسمية للحفاظ على التناسق. حدد قواعد الملكية للتحكم في مسؤولية البيانات، واضبط إعدادات الظهور لتحديد من يمكنه الوصول إلى بيانات اللغة.</li><li><strong>اختبار التهيئة:</strong> قبل تعميم الميزة على الفريق بالكامل، أنشئ سجلًا أو سجلين تجريبيين لمحاكاة سير العمل النموذجي. تحقق من تحديث الحالات بشكل صحيح، وإرسال الإشعارات كما هو متوقع، والتحكم في الصلاحيات لمنع أو السماح بالوصول المناسب.</li><li><strong>دعوة الفريق:</strong> بعد التأكد من نجاح الاختبار، قم بدعوة أعضاء الفريق للبدء في استخدام ميزة اللغة بشكل فعّال.</li></ol><div class=\"tip\">💡 <strong>نصيحة:</strong> وضع قواعد تسمية واضحة وقواعد ملكية في البداية يساعد على الحفاظ على نظافة البيانات وتسهيل إعداد التقارير.</div><div class=\"note\">📝 <strong>ملاحظة:</strong> اختبار سير العمل باستخدام سجلات تجريبية أمر ضروري لتجنب المشاكل غير المتوقعة عند نشر الميزة بالكامل.</div>",
    "keywords": [
      "language",
      "اللغة",
      "settings & advanced",
      "الإعدادات والمتقدمة",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "language-troubleshooting",
    "categoryId": "settings-advanced",
    "sectionId": "language",
    "questionEn": "Why is Language not showing the expected data?",
    "questionAr": "لماذا لا يعرض اللغة البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Language not showing the expected data?</h2><p>When the <strong>Language</strong> feature does not display the expected data, there are several common factors to consider. First, <strong>check all active filters</strong>, including status filters and date ranges, as these can inadvertently exclude relevant data from view. Additionally, verify the <strong>ownership rules</strong> and <strong>user permissions</strong> to ensure that you have access to all necessary records.</p><p>Often, the data exists within the system but is hidden due to limitations set by <strong>team scope</strong> or missing mappings between fields. It is essential to ensure that all relevant data fields are properly mapped and integrated within your CRM configuration.</p><p>If the problem persists, conduct a thorough review of recent <strong>imports, integrations, and automation rules</strong> related to the Language feature. These processes can sometimes alter data visibility unintentionally.</p><div class=\"tip\">💡 Tip: Compare one affected record with a working record side-by-side to quickly identify discrepancies or configuration differences that might be causing the issue.</div>",
    "answerAr": "<h2>لماذا لا يعرض اللغة البيانات المتوقعة؟</h2><p>عندما لا تعرض خاصية <strong>اللغة</strong> البيانات المتوقعة، هناك عدة عوامل شائعة يجب مراعاتها. أولاً، <strong>تحقق من جميع الفلاتر النشطة</strong>، بما في ذلك فلاتر الحالة والفترات الزمنية، حيث يمكن أن تستبعد هذه الفلاتر البيانات ذات الصلة بشكل غير مقصود. بالإضافة إلى ذلك، تحقق من <strong>قواعد الملكية</strong> و<strong>صلاحيات المستخدم</strong> لضمان أن لديك حق الوصول إلى جميع السجلات الضرورية.</p><p>غالباً ما تكون البيانات موجودة داخل النظام لكنها مخفية بسبب القيود التي يفرضها <strong>نطاق الفريق</strong> أو نقص الربط بين الحقول. من الضروري التأكد من أن جميع حقول البيانات ذات الصلة مرتبطة بشكل صحيح ومُدمجة ضمن إعدادات نظام إدارة علاقات العملاء الخاص بك.</p><p>إذا استمرت المشكلة، قم بمراجعة دقيقة لعمليات <strong>الاستيراد والتكامل وقواعد الأتمتة</strong> الحديثة المتعلقة بقسم اللغة. فقد تؤثر هذه العمليات أحياناً على ظهور البيانات بشكل غير مقصود.</p><div class=\"tip\">💡 نصيحة: قارن سجلاً متأثراً بسجل يعمل بشكل صحيح جنباً إلى جنب لتحديد الفروقات أو الاختلافات في التكوين التي قد تكون سبب المشكلة بسرعة.</div>",
    "keywords": [
      "language",
      "اللغة",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "reset-password-getting-started",
    "categoryId": "settings-advanced",
    "sectionId": "reset-password",
    "questionEn": "How do I start using Reset Password in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام إعادة تعيين كلمة المرور في Tamiyouz CRM؟",
    "answerEn": "<h2>How to Start Using Reset Password in Tamiyouz CRM</h2>\n<p>The <strong>Reset Password</strong> feature in Tamiyouz CRM is designed to enhance security and streamline password management for your team. To begin utilizing this feature, follow these detailed steps to ensure a smooth setup and optimal configuration.</p>\n<ol>\n  <li><strong>Access the Reset Password Section:</strong> Navigate to the main menu and select the <em>Reset Password</em> area under the <strong>Settings &gt; Advanced</strong> category.</li>\n  <li><strong>Review Available Fields:</strong> Familiarize yourself with the fields and options provided within this section. Understanding these will help you tailor the feature to your organization’s needs.</li>\n  <li><strong>Complete Required Setup:</strong> Configure essential settings including:\n    <ul>\n      <li><strong>Naming Conventions:</strong> Define clear and consistent naming rules to maintain data integrity.</li>\n      <li><strong>Ownership Rules:</strong> Assign responsibility for password resets to appropriate users or teams.</li>\n      <li><strong>Visibility Settings:</strong> Control who can view and manage password reset requests to protect sensitive information.</li>\n    </ul>\n  </li>\n  <li><strong>Test the Workflow:</strong> Before rolling out to the entire team, perform tests using one or two sample records. Confirm that the workflow behaves as expected, including status updates, notification dispatch, and permission enforcement.</li>\n  <li><strong>Invite Your Team:</strong> Once testing is successful, invite team members to start using the Reset Password feature, ensuring they understand the process and their roles.</li>\n</ol>\n<div class=\"tip\">💡 Tip: Regularly review ownership and visibility settings to keep your password reset process secure and efficient.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام إعادة تعيين كلمة المرور في Tamiyouz CRM</h2>\n<p>تُعد ميزة <strong>إعادة تعيين كلمة المرور</strong> في Tamiyouz CRM أداة مهمة لتعزيز الأمان وتسهيل إدارة كلمات المرور لفريقك. لبدء استخدام هذه الميزة، اتبع الخطوات التفصيلية التالية لضمان إعداد سلس وتكوين مثالي.</p>\n<ol>\n  <li><strong>الوصول إلى قسم إعادة تعيين كلمة المرور:</strong> انتقل إلى القائمة الرئيسية واختر قسم <em>إعادة تعيين كلمة المرور</em> ضمن فئة <strong>الإعدادات &gt; متقدم</strong>.</li>\n  <li><strong>مراجعة الحقول المتاحة:</strong> تعرّف على الحقول والخيارات الموجودة في هذا القسم. فهم هذه التفاصيل سيساعدك على تخصيص الميزة بما يتناسب مع احتياجات مؤسستك.</li>\n  <li><strong>إكمال الإعدادات المطلوبة:</strong> قم بتكوين الإعدادات الأساسية، والتي تتضمن:\n    <ul>\n      <li><strong>قواعد التسمية:</strong> تحديد قواعد واضحة ومتسقة للتسمية للحفاظ على سلامة البيانات.</li>\n      <li><strong>قواعد الملكية:</strong> تعيين المسؤولية عن إعادة تعيين كلمات المرور للمستخدمين أو الفرق المناسبة.</li>\n      <li><strong>إعدادات الظهور:</strong> التحكم في من يمكنه عرض وإدارة طلبات إعادة تعيين كلمة المرور لحماية المعلومات الحساسة.</li>\n    </ul>\n  </li>\n  <li><strong>اختبار سير العمل:</strong> قبل تعميم الاستخدام على الفريق بالكامل، قم بإجراء اختبارات باستخدام سجل أو سجلين تجريبيين. تحقق من أن سير العمل يعمل كما هو متوقع، بما في ذلك تحديثات الحالة، وإرسال التنبيهات، وتطبيق الصلاحيات.</li>\n  <li><strong>دعوة الفريق:</strong> بعد نجاح الاختبار، قم بدعوة أعضاء الفريق لبدء استخدام ميزة إعادة تعيين كلمة المرور مع التأكد من فهمهم للعملية وأدوارهم.</li>\n</ol>\n<div class=\"tip\">💡 نصيحة: راجع بانتظام إعدادات الملكية والظهور للحفاظ على أمان وكفاءة عملية إعادة تعيين كلمة المرور.</div>",
    "keywords": [
      "reset password",
      "إعادة تعيين كلمة المرور",
      "settings & advanced",
      "الإعدادات والمتقدمة",
      "setup",
      "tamiyouz",
      "crm"
    ],
    "popular": false
  },
  {
    "id": "reset-password-troubleshooting",
    "categoryId": "settings-advanced",
    "sectionId": "reset-password",
    "questionEn": "Why is Reset Password not showing the expected data?",
    "questionAr": "لماذا لا يعرض إعادة تعيين كلمة المرور البيانات المتوقعة؟",
    "answerEn": "<h2>Why is Reset Password Not Showing the Expected Data?</h2><p>If you find that the <strong>Reset Password</strong> feature is not displaying the expected data, several factors could be affecting the visibility and accuracy of the information. Begin by verifying the following key areas:</p><ol><li><strong>Filters and Date Range:</strong> Ensure that any applied filters or date ranges are set correctly. Incorrect filter settings often hide relevant records.</li><li><strong>Ownership Rules:</strong> Review the ownership and access permissions configured for the data. Ownership rules can restrict the display of certain records based on team or user scope.</li><li><strong>User Permissions:</strong> Confirm that your user account has the necessary permissions to view all relevant data associated with the Reset Password feature.</li></ol><p>In many cases, the data exists but remains hidden due to status filters, team scope restrictions, or missing field mappings that affect data visibility.</p><div class=\"tip\">💡 To diagnose the issue more effectively, compare a record that is not showing data against one that behaves correctly. This can help identify discrepancies in configuration or data.</div><p>If the problem persists after these checks, investigate recent system activities such as imports, integrations, or automation rules related to the Reset Password functionality. These processes might have altered data visibility or introduced data inconsistencies.</p><div class=\"note\">📝 Regularly reviewing automation and integration settings can prevent unexpected data hiding or loss within the Reset Password feature.</div>",
    "answerAr": "<h2>لماذا لا يعرض إعادة تعيين كلمة المرور البيانات المتوقعة؟</h2><p>إذا لاحظت أن ميزة <strong>إعادة تعيين كلمة المرور</strong> لا تعرض البيانات المتوقعة، فقد تؤثر عدة عوامل على وضوح ودقة المعلومات المعروضة. ابدأ بالتحقق من المجالات الأساسية التالية:</p><ol><li><strong>الفلاتر والفترة الزمنية:</strong> تأكد من ضبط أي فلاتر أو نطاقات زمنية بشكل صحيح. غالباً ما تؤدي إعدادات الفلاتر غير الدقيقة إلى إخفاء السجلات ذات الصلة.</li><li><strong>قواعد الملكية:</strong> راجع قواعد الملكية والصلاحيات المطبقة على البيانات. قد تحد قواعد الملكية من عرض بعض السجلات بناءً على نطاق الفريق أو المستخدم.</li><li><strong>صلاحيات المستخدم:</strong> تحقق من أن حساب المستخدم الخاص بك يمتلك الصلاحيات اللازمة لعرض جميع البيانات المرتبطة بميزة إعادة تعيين كلمة المرور.</li></ol><p>في كثير من الحالات، تكون البيانات موجودة لكنها مخفية بسبب فلاتر الحالة، أو قيود نطاق الفريق، أو نقص الربط بين الحقول التي تؤثر على رؤية البيانات.</p><div class=\"tip\">💡 للمساعدة في تشخيص المشكلة بشكل فعال، قارن بين سجل لا يظهر بيانات وسجل يعمل بشكل صحيح. سيساعدك ذلك في تحديد الفروقات في الإعدادات أو البيانات.</div><p>إذا استمرت المشكلة بعد هذه الفحوصات، قم بمراجعة الأنشطة النظامية الأخيرة مثل عمليات الاستيراد، والتكاملات، وقواعد الأتمتة المرتبطة بوظيفة إعادة تعيين كلمة المرور. فقد تكون هذه العمليات قد أثرت على رؤية البيانات أو أدخلت تناقضات فيها.</p><div class=\"note\">📝 يساعد المراجعة الدورية لإعدادات الأتمتة والتكاملات في منع إخفاء البيانات أو فقدانها بشكل غير متوقع ضمن ميزة إعادة تعيين كلمة المرور.</div>",
    "keywords": [
      "reset password",
      "إعادة تعيين كلمة المرور",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
  },
  {
    "id": "tamara-getting-started",
    "categoryId": "sales-customers",
    "sectionId": "tamara-payments",
    "questionEn": "How do I start using Tamara Payments in Tamiyouz CRM?",
    "questionAr": "كيف أبدأ باستخدام مدفوعات تمارا في Tamiyouz CRM؟",
    "answerEn": "<h2>Getting Started with Tamara Payments in Tamiyouz CRM</h2><p><strong>Tamara</strong> is a Buy Now, Pay Later (BNPL) payment gateway integrated into Tamiyouz CRM. It allows your clients to pay in installments (split into 3 payments) for both new deals and contract renewals.</p><h3>Prerequisites</h3><ul><li><strong>Tamara must be enabled</strong> by an Admin from the <em>Settings</em> page.</li><li>The Admin must configure the <strong>API Token</strong>, <strong>Notification URL</strong> (webhook), and <strong>Merchant URL</strong>.</li><li>Once enabled, Tamara buttons will appear automatically for Sales Agents and Account Managers.</li></ul><h3>For Sales Agents — Sending Tamara Links for Deals</h3><ol><li>Open a <strong>Lead Profile</strong> page and click <strong>New Deal</strong>.</li><li>Fill in the deal details (package, value, currency).</li><li>Toggle the <strong>Send via Tamara</strong> switch to enable installment payment.</li><li>Click <strong>Create Deal</strong>. A Tamara checkout page will open in a new tab.</li><li>Share the payment link with the client or let them complete the payment.</li><li>Once the client pays, the deal status automatically changes to <strong>Won</strong>.</li><li>Notifications are sent to the responsible sales agent, all admins, and sales managers.</li></ol><h3>For Account Managers — Sending Tamara Links for Contract Renewals</h3><ol><li>Open a <strong>Client Profile</strong> page and go to the <strong>Contracts</strong> tab.</li><li>Find the contract you want to renew in the contracts table.</li><li>Click the <strong>Pay</strong> button (purple gradient) in the Tamara column.</li><li>A Tamara checkout page will open in a new tab.</li><li>Once the client pays, the contract status changes to <strong>Active</strong> and renewal status to <strong>Renewed</strong>.</li><li>Notifications are sent to the responsible account manager and all admins.</li></ol><h3>What Happens After Payment?</h3><ul><li><strong>Automatic Status Update:</strong> Deal becomes \"Won\" or Contract becomes \"Renewed\".</li><li><strong>In-App Notifications:</strong> Sent to the responsible team member and all admins.</li><li><strong>Audit Log:</strong> Every Tamara transaction is recorded in the audit log for traceability.</li></ul><div class=\"tip\">💡 Tip: Make sure the client's phone number is in the correct Saudi format (+966XXXXXXXXX) for Tamara to process the payment correctly.</div><div class=\"note\">📝 Note: The Tamara Pay button only appears when Tamara is enabled in the system settings. Contact your admin if you don't see it.</div>",
    "answerAr": "<h2>كيفية البدء باستخدام مدفوعات تمارا في Tamiyouz CRM</h2><p><strong>تمارا</strong> هي بوابة دفع بنظام \"اشترِ الآن وادفع لاحقاً\" (BNPL) مدمجة في Tamiyouz CRM. تتيح لعملائك الدفع بالتقسيط (مقسمة على 3 دفعات) سواء للصفقات الجديدة أو تجديد العقود.</p><h3>المتطلبات الأساسية</h3><ul><li><strong>يجب تفعيل تمارا</strong> من قبل المسؤول (Admin) من صفحة <em>الإعدادات</em>.</li><li>يجب على المسؤول إعداد <strong>رمز API</strong> و<strong>رابط الإشعارات</strong> (webhook) و<strong>رابط المتجر</strong>.</li><li>بمجرد التفعيل، ستظهر أزرار تمارا تلقائياً لموظفي المبيعات ومديري الحسابات.</li></ul><h3>لموظفي المبيعات — إرسال روابط تمارا للصفقات</h3><ol><li>افتح صفحة <strong>ملف العميل المحتمل</strong> واضغط على <strong>صفقة جديدة</strong>.</li><li>أدخل تفاصيل الصفقة (الباقة، القيمة، العملة).</li><li>فعّل مفتاح <strong>الإرسال عبر تمارا</strong> لتفعيل الدفع بالتقسيط.</li><li>اضغط <strong>إنشاء صفقة</strong>. ستفتح صفحة دفع تمارا في تبويب جديد.</li><li>شارك رابط الدفع مع العميل أو اتركه يكمل الدفع.</li><li>بمجرد دفع العميل، تتغير حالة الصفقة تلقائياً إلى <strong>مكتسبة (Won)</strong>.</li><li>يتم إرسال إشعارات لموظف المبيعات المسؤول وجميع المسؤولين ومديري المبيعات.</li></ol><h3>لمديري الحسابات — إرسال روابط تمارا لتجديد العقود</h3><ol><li>افتح صفحة <strong>ملف العميل</strong> وانتقل إلى تبويب <strong>العقود</strong>.</li><li>ابحث عن العقد المراد تجديده في جدول العقود.</li><li>اضغط على زر <strong>Pay</strong> (بتدرج بنفسجي) في عمود تمارا.</li><li>ستفتح صفحة دفع تمارا في تبويب جديد.</li><li>بمجرد دفع العميل، تتغير حالة العقد إلى <strong>نشط (Active)</strong> وحالة التجديد إلى <strong>مُجدد (Renewed)</strong>.</li><li>يتم إرسال إشعارات لمدير الحساب المسؤول وجميع المسؤولين.</li></ol><h3>ماذا يحدث بعد الدفع؟</h3><ul><li><strong>تحديث تلقائي للحالة:</strong> الصفقة تصبح \"مكتسبة\" أو العقد يصبح \"مُجدد\".</li><li><strong>إشعارات داخلية:</strong> تُرسل للمسؤول المعني وجميع المسؤولين.</li><li><strong>سجل التدقيق:</strong> كل معاملة تمارا تُسجل في سجل العمليات للتتبع.</li></ul><div class=\"tip\">💡 نصيحة: تأكد من أن رقم هاتف العميل بالصيغة السعودية الصحيحة (+966XXXXXXXXX) حتى تتم معالجة الدفع بشكل صحيح.</div><div class=\"note\">📝 ملاحظة: زر الدفع عبر تمارا يظهر فقط عند تفعيل تمارا في إعدادات النظام. تواصل مع المسؤول إذا لم تجده.</div>",
    "keywords": [
      "tamara",
      "تمارا",
      "payments",
      "مدفوعات",
      "installments",
      "تقسيط",
      "BNPL",
      "deals",
      "contracts",
      "عقود",
      "صفقات"
    ],
    "popular": true
  },
  {
    "id": "tamara-troubleshooting",
    "categoryId": "sales-customers",
    "sectionId": "tamara-payments",
    "questionEn": "Why is Tamara Payments not working as expected?",
    "questionAr": "لماذا لا تعمل مدفوعات تمارا كما هو متوقع؟",
    "answerEn": "<h2>Troubleshooting Tamara Payments</h2><p>If you encounter issues with <strong>Tamara Payments</strong> in Tamiyouz CRM, follow these steps to diagnose and resolve common problems.</p><h3>Issue 1: Tamara Button Not Appearing</h3><ul><li><strong>Check Tamara Settings:</strong> Go to <em>Settings</em> and verify that Tamara is <strong>enabled</strong>. The Pay button and Send via Tamara toggle only appear when Tamara is active.</li><li><strong>Check Your Role:</strong> Tamara for deals is available to <strong>Sales Agents</strong>. Tamara for contracts is available to <strong>Account Managers</strong>. Ensure you have the correct role.</li><li><strong>Refresh the Page:</strong> After the admin enables Tamara, you may need to refresh the page for changes to take effect.</li></ul><h3>Issue 2: Payment Link Not Opening</h3><ul><li><strong>Check Browser Popup Blocker:</strong> Tamara opens the payment page in a new tab. If your browser blocks popups, the link won't open. Allow popups for the CRM domain.</li><li><strong>Verify API Token:</strong> If the admin entered an incorrect API token, the checkout session will fail. Ask the admin to verify the token in Settings.</li><li><strong>Check Client Data:</strong> Tamara requires a valid phone number and name. Ensure the lead or client profile has complete information.</li></ul><h3>Issue 3: Payment Approved but Status Not Updated</h3><ul><li><strong>Webhook URL:</strong> The Notification URL (webhook) must be correctly configured in Tamara settings. If it's wrong, Tamara can't notify the CRM about successful payments.</li><li><strong>Server Status:</strong> Ensure the CRM server is running and accessible. If the server was down when the payment was made, the webhook may have been missed.</li><li><strong>Check Audit Logs:</strong> Go to <em>Audit Log</em> and search for \"tamara_payment\" or \"tamara_contract_payment\" to see if the webhook was received.</li></ul><h3>Issue 4: Notifications Not Received</h3><ul><li><strong>Check Notification Settings:</strong> Ensure in-app notifications are enabled for your account.</li><li><strong>Verify User Role:</strong> Notifications are sent to the responsible agent/manager and all admins. If you're not in these groups, you won't receive them.</li><li><strong>Check Inbox:</strong> Notifications appear in the <strong>Inbox</strong> (bell icon). Make sure you're checking the right section.</li></ul><h3>Issue 5: How to Verify Tamara Transactions</h3><ol><li>Navigate to <strong>Audit Log</strong> from the sidebar.</li><li>Search for entries with action type <strong>tamara_payment</strong> (for deals) or <strong>tamara_contract_payment</strong> (for contracts).</li><li>Each entry shows the order ID, amount, and timestamp for full traceability.</li></ol><div class=\"tip\">💡 Tip: If a payment was made but the status didn't update, the admin can manually update the deal or contract status while investigating the webhook issue.</div><div class=\"note\">📝 Note: For persistent issues, check the server logs or contact technical support with the Tamara order ID for faster resolution.</div>",
    "answerAr": "<h2>حل مشاكل مدفوعات تمارا</h2><p>إذا واجهت مشاكل مع <strong>مدفوعات تمارا</strong> في Tamiyouz CRM، اتبع هذه الخطوات لتشخيص وحل المشاكل الشائعة.</p><h3>المشكلة 1: زر تمارا غير ظاهر</h3><ul><li><strong>تحقق من إعدادات تمارا:</strong> اذهب إلى <em>الإعدادات</em> وتأكد من أن تمارا <strong>مفعّلة</strong>. زر الدفع ومفتاح الإرسال عبر تمارا يظهران فقط عند تفعيل تمارا.</li><li><strong>تحقق من دورك:</strong> تمارا للصفقات متاحة لـ<strong>موظفي المبيعات</strong>. تمارا للعقود متاحة لـ<strong>مديري الحسابات</strong>. تأكد من أن لديك الدور الصحيح.</li><li><strong>حدّث الصفحة:</strong> بعد تفعيل المسؤول لتمارا، قد تحتاج لتحديث الصفحة لتظهر التغييرات.</li></ul><h3>المشكلة 2: رابط الدفع لا يفتح</h3><ul><li><strong>تحقق من مانع النوافذ المنبثقة:</strong> تمارا تفتح صفحة الدفع في تبويب جديد. إذا كان المتصفح يحظر النوافذ المنبثقة، لن يفتح الرابط. اسمح بالنوافذ المنبثقة لنطاق النظام.</li><li><strong>تحقق من رمز API:</strong> إذا أدخل المسؤول رمز API خاطئ، ستفشل جلسة الدفع. اطلب من المسؤول التحقق من الرمز في الإعدادات.</li><li><strong>تحقق من بيانات العميل:</strong> تمارا تتطلب رقم هاتف واسم صالحين. تأكد من اكتمال بيانات العميل المحتمل أو العميل.</li></ul><h3>المشكلة 3: تم الدفع لكن الحالة لم تتحدث</h3><ul><li><strong>رابط الإشعارات (Webhook):</strong> يجب إعداد رابط الإشعارات بشكل صحيح في إعدادات تمارا. إذا كان خاطئاً، لن تستطيع تمارا إبلاغ النظام بالمدفوعات الناجحة.</li><li><strong>حالة السيرفر:</strong> تأكد من أن سيرفر النظام يعمل ويمكن الوصول إليه. إذا كان السيرفر متوقفاً وقت الدفع، قد يكون الإشعار قد فُقد.</li><li><strong>تحقق من سجل التدقيق:</strong> اذهب إلى <em>سجل العمليات</em> وابحث عن \"tamara_payment\" أو \"tamara_contract_payment\" للتحقق من استلام الإشعار.</li></ul><h3>المشكلة 4: الإشعارات لا تصل</h3><ul><li><strong>تحقق من إعدادات الإشعارات:</strong> تأكد من تفعيل الإشعارات الداخلية لحسابك.</li><li><strong>تحقق من دور المستخدم:</strong> الإشعارات تُرسل للموظف/المدير المسؤول وجميع المسؤولين. إذا لم تكن ضمن هذه المجموعات، لن تستقبلها.</li><li><strong>تحقق من صندوق الوارد:</strong> الإشعارات تظهر في <strong>صندوق الوارد</strong> (أيقونة الجرس). تأكد من أنك تتحقق من القسم الصحيح.</li></ul><h3>المشكلة 5: كيفية التحقق من معاملات تمارا</h3><ol><li>انتقل إلى <strong>سجل العمليات</strong> من القائمة الجانبية.</li><li>ابحث عن الإدخالات بنوع الإجراء <strong>tamara_payment</strong> (للصفقات) أو <strong>tamara_contract_payment</strong> (للعقود).</li><li>كل إدخال يعرض رقم الطلب والمبلغ والتوقيت للتتبع الكامل.</li></ol><div class=\"tip\">💡 نصيحة: إذا تم الدفع ولم تتحدث الحالة، يمكن للمسؤول تحديث حالة الصفقة أو العقد يدوياً أثناء التحقيق في مشكلة الإشعارات.</div><div class=\"note\">📝 ملاحظة: للمشاكل المستمرة، تحقق من سجلات السيرفر أو تواصل مع الدعم الفني مع رقم طلب تمارا لحل أسرع.</div>",
    "keywords": [
      "tamara",
      "تمارا",
      "troubleshooting",
      "payments",
      "مدفوعات",
      "webhook",
      "notifications",
      "إشعارات",
      "error",
      "خطأ"
    ],
    "popular": false
  },
  {
    "id": "client-handover-guide",
    "categoryId": "sales-customers",
    "sectionId": "client-handover",
    "questionEn": "How does the Client Handover & Onboarding workflow work?",
    "questionAr": "كيف تعمل عملية تسليم العميل والتهيئة؟",
    "answerEn": "<h2>Client Handover &amp; Onboarding Workflow Guide</h2><p>The <strong>Client Handover &amp; Onboarding</strong> workflow ensures that every new client is properly passed from the Sales team to their Account Manager and guided through onboarding — without anything slipping through the cracks.</p><p>This workflow starts automatically the moment a deal is marked as <strong>Won</strong>. From that point, the CRM tracks every step — from assigning an Account Manager to completing the final onboarding phase.</p><h3>How It Works — A Real Scenario</h3><p>Here is how the full process looks in practice:</p><ol><li>A lead comes in and is worked on by the Sales team.</li><li>When the deal is closed, the Sales agent marks the lead as <strong>Won</strong>.</li><li>The CRM <strong>automatically creates a Client</strong> record and places it in the <strong>Client Pool</strong>.</li><li>An <strong>Admin</strong> reviews the new client and assigns an <strong>Account Manager</strong>.</li><li>The <strong>Sales agent</strong> fills in and submits a <strong>Handover Brief</strong> — a summary of everything the Account Manager needs to know about this client.</li><li>The <strong>Account Manager</strong> reviews the brief on the Client Profile.</li><li>Onboarding begins. The Account Manager works through <strong>Phases 2 to 6</strong>, checking off tasks as they go.</li></ol><h3>The Screens Involved</h3><h3>Lead Profile</h3><p>This is where the <strong>Sales agent</strong> submits the Handover Brief. When a deal is Won, a banner appears at the top of the Lead Profile with a <strong>Submit Handover Brief</strong> button. Clicking it opens a form to fill in all relevant client details for the handover.</p><p>The brief can be saved as a <strong>Draft</strong> and completed later, or submitted directly when ready.</p><h3>Client Pool</h3><p>The Client Pool is the central view where <strong>Admins</strong> manage all clients who came through a Won deal. From here you can:</p><ul><li>See each client's current <strong>handover status</strong>.</li><li>Filter clients by status to quickly find those needing attention.</li><li><strong>Assign an Account Manager</strong> to a client using the Assign button.</li></ul><h3>Client Profile</h3><p>The Client Profile has three tabs that cover the full handover lifecycle:</p><ul><li><strong>Handover tab:</strong> Where the Account Manager reviews the submitted brief from Sales.</li><li><strong>Onboarding tab:</strong> Where the Account Manager tracks progress through each phase and checks off completed tasks.</li><li><strong>History tab:</strong> A full audit trail of every important change — who did what and when.</li></ul><h3>Who Does What — Roles</h3><ul><li><strong>Sales Agent:</strong> Marks deals as Won and submits the Handover Brief in the Lead Profile.</li><li><strong>Admin:</strong> Reviews new clients in the Client Pool and assigns an Account Manager.</li><li><strong>Account Manager:</strong> Reviews the Handover Brief, manages onboarding phases, and checks off tasks as they are completed.</li></ul><h3>Handover Statuses</h3><p>Every client in the Client Pool shows a status badge so you know exactly where they are in the process:</p><ul><li><strong>Awaiting Assignment:</strong> The client was created from a Won deal but no Account Manager has been assigned yet.</li><li><strong>Awaiting Sales Brief:</strong> An Account Manager has been assigned but the Sales agent has not submitted the brief yet.</li><li><strong>Brief Submitted:</strong> The Sales agent has submitted the full Handover Brief. The Account Manager can now review it.</li><li><strong>In Onboarding:</strong> Onboarding is actively underway. The Account Manager is working through the phases.</li><li><strong>Ready For Activation:</strong> All onboarding phases are complete. The client is ready to go live.</li></ul><h3>Brief Statuses</h3><p>The Handover Brief itself also has its own status:</p><ul><li><strong>Not Started:</strong> The Sales agent has not yet opened the brief form.</li><li><strong>Draft:</strong> The brief has been started and saved, but not yet submitted.</li><li><strong>Submitted:</strong> The brief has been fully submitted for the Account Manager to review.</li><li><strong>Reviewed:</strong> The Account Manager has reviewed the brief.</li><li><strong>Needs Info:</strong> The Account Manager has flagged that additional information is required from Sales.</li></ul><h3>Onboarding Phases</h3><p>Once a client enters onboarding, the Account Manager works through five structured phases:</p><h3>Phase 2 — Account Manager Preparation</h3><p>Before contacting the client, the Account Manager prepares internally. This includes reviewing all client information and the contract, identifying any missing details, preparing questions, and forming an initial plan concept.</p><h3>Phase 3 — First Client Contact</h3><p>The Account Manager reaches out to the client within 24 hours, introduces themselves as the main point of contact, and schedules an onboarding meeting.</p><h3>Phase 4 — Onboarding Meeting</h3><p>A structured meeting with the client to align on expectations. This covers introducing the team, understanding the business in depth, defining the target audience, identifying competitors, setting clear KPIs, explaining the process, agreeing on reporting frequency, and deciding on communication channels.</p><h3>Phase 5 — Access &amp; Setup</h3><p>The Account Manager gathers all access and assets needed to start work: social media access, website access, ads account access if applicable, adding the client to communication channels, and recording all client information in the CRM.</p><h3>Phase 6 — Internal Team Activation</h3><p>The Account Manager briefs the internal team so they can begin work. This includes sending a clear brief to each department, defining objectives, setting deadlines for monthly reports, and holding an internal team meeting if needed.</p><h3>Tracking Progress</h3><p>Each onboarding phase contains a checklist of tasks. As the Account Manager checks off items, the overall onboarding <strong>progress percentage increases</strong>. This gives everyone — including Admins — a clear view of how far along onboarding is.</p><p>Account Managers can also <strong>customize checklist items</strong> to match the specific needs of each client, adding or editing tasks within any phase.</p><div class=\"tip\">💡 Tip: A client with 100% progress across all phases is ready for full activation. Use the progress bar on the Client Profile to keep track at a glance.</div><h3>History &amp; Audit Trail</h3><p>Every important action in the handover and onboarding process is recorded automatically. On the <strong>History tab</strong> of the Client Profile you can see:</p><ul><li>When the client was created from a Won deal.</li><li>When an Account Manager was assigned and by whom.</li><li>When the Handover Brief was submitted.</li><li>When onboarding tasks were completed.</li><li>Any status changes throughout the process.</li></ul><p>This makes it easy to review the full timeline and hold the right people accountable at every step.</p><h3>Frequently Asked Questions</h3><div class=\"note\"><strong>When does the Handover Brief appear?</strong><br/>The brief button appears in the Lead Profile once the deal is marked as Won. It will not appear for leads that are still in progress.</div><div class=\"note\"><strong>Does the brief show for every lead?</strong><br/>No. It only appears for leads where the deal status is Won.</div><div class=\"note\"><strong>Who assigns the Account Manager?</strong><br/>The Admin assigns the Account Manager from the Client Pool using the Assign button on the client row.</div><div class=\"note\"><strong>Where do I find onboarding?</strong><br/>Open the Client Profile from the Client Pool and go to the <strong>Onboarding</strong> tab. The full phase checklist is there.</div><div class=\"note\"><strong>What happens after a deal becomes Won?</strong><br/>The CRM automatically creates a Client record. It immediately appears in the Client Pool with the status Awaiting Assignment.</div><div class=\"note\"><strong>Can onboarding items be edited?</strong><br/>Yes. Account Managers can customize checklist items within each phase to fit the specific client needs.</div><div class=\"note\"><strong>Who can update the brief?</strong><br/>The Sales agent who owns the lead can fill in and submit the brief. Admins can also access and review it.</div>",
    "answerAr": "<h2>دليل سير عمل تسليم العميل والتهيئة</h2><p>تضمن عملية <strong>تسليم العميل والتهيئة</strong> أن كل عميل جديد يُنقل بشكل صحيح من فريق المبيعات إلى مدير الحساب ويُرشَد خلال مراحل التهيئة دون أي إغفال.</p><p>تبدأ هذه العملية تلقائياً لحظة تحديد الصفقة كـ<strong>مكتملة</strong>. من تلك اللحظة، يتابع النظام كل خطوة — من تعيين مدير الحساب إلى إتمام المرحلة الأخيرة من التهيئة.</p><h3>كيف تسير العملية — سيناريو واقعي</h3><p>إليك كيف تبدو العملية الكاملة عملياً:</p><ol><li>يصل عميل محتمل ويبدأ فريق المبيعات العمل عليه.</li><li>عند إغلاق الصفقة، يُحدد مندوب المبيعات الصفقة كـ<strong>مكتملة</strong>.</li><li>يقوم النظام <strong>تلقائياً بإنشاء سجل عميل</strong> ويضعه في <strong>مجموعة العملاء</strong>.</li><li>يراجع <strong>المسؤول</strong> العميل الجديد ويعيّن له <strong>مدير حساب</strong>.</li><li>يملأ <strong>مندوب المبيعات</strong> ويقدم <strong>ملخص التسليم</strong> — وهو ملخص بكل ما يحتاج مدير الحساب معرفته عن هذا العميل.</li><li>يراجع <strong>مدير الحساب</strong> الملخص من ملف العميل.</li><li>تبدأ عملية التهيئة. يعمل مدير الحساب عبر <strong>المراحل من 2 إلى 6</strong>، مع تأشير المهام المنجزة.</li></ol><h3>الشاشات المعنية</h3><h3>ملف العميل المحتمل</h3><p>هنا يقوم <strong>مندوب المبيعات</strong> بتقديم ملخص التسليم. عند إتمام صفقة، تظهر لافتة في أعلى ملف العميل المحتمل تحتوي على زر <strong>تقديم ملخص التسليم</strong>. يفتح الضغط عليه نموذجاً لملء جميع تفاصيل العميل اللازمة.</p><p>يمكن حفظ الملخص كـ<strong>مسودة</strong> للإكمال لاحقاً، أو تقديمه مباشرة عند الجاهزية.</p><h3>مجموعة العملاء</h3><p>مجموعة العملاء هي العرض المركزي حيث يدير <strong>المسؤولون</strong> جميع العملاء القادمين من صفقات مكتملة. يمكنك من هناك:</p><ul><li>رؤية <strong>حالة التسليم</strong> الحالية لكل عميل.</li><li>تصفية العملاء حسب الحالة للعثور بسرعة على من يحتاجون انتباهاً.</li><li><strong>تعيين مدير حساب</strong> للعميل باستخدام زر التعيين.</li></ul><h3>ملف العميل</h3><p>يحتوي ملف العميل على ثلاث تبويبات تغطي دورة التسليم الكاملة:</p><ul><li><strong>تبويب التسليم:</strong> حيث يراجع مدير الحساب الملخص المقدم من المبيعات.</li><li><strong>تبويب التهيئة:</strong> حيث يتتبع مدير الحساب التقدم عبر كل مرحلة ويؤشر على المهام المنجزة.</li><li><strong>تبويب السجل:</strong> سجل تدقيق كامل لكل تغيير مهم — من فعل ماذا ومتى.</li></ul><h3>من يفعل ماذا — الأدوار</h3><ul><li><strong>مندوب المبيعات:</strong> يحدد الصفقات كمكتملة ويقدم ملخص التسليم من ملف العميل المحتمل.</li><li><strong>المسؤول:</strong> يراجع العملاء الجدد في مجموعة العملاء ويعيّن مدير الحساب.</li><li><strong>مدير الحساب:</strong> يراجع ملخص التسليم، ويدير مراحل التهيئة، ويؤشر على المهام عند إنجازها.</li></ul><h3>حالات التسليم</h3><p>يعرض كل عميل في مجموعة العملاء شارة حالة لتعرف بالضبط أين هو في العملية:</p><ul><li><strong>في انتظار التعيين:</strong> تم إنشاء العميل من صفقة مكتملة لكن لم يُعيَّن له مدير حساب بعد.</li><li><strong>في انتظار ملخص المبيعات:</strong> تم تعيين مدير الحساب لكن مندوب المبيعات لم يقدم الملخص بعد.</li><li><strong>تم تقديم الملخص:</strong> قدّم مندوب المبيعات الملخص الكامل. يمكن لمدير الحساب الآن مراجعته.</li><li><strong>في التهيئة:</strong> التهيئة جارية فعلياً. مدير الحساب يعمل عبر المراحل.</li><li><strong>جاهز للتفعيل:</strong> اكتملت جميع مراحل التهيئة. العميل جاهز للانطلاق.</li></ul><h3>حالات الملخص</h3><p>يحمل ملخص التسليم أيضاً حالته الخاصة:</p><ul><li><strong>لم يبدأ:</strong> لم يفتح مندوب المبيعات نموذج الملخص بعد.</li><li><strong>مسودة:</strong> بدأ الملخص وحُفظ، لكن لم يُقدَّم بعد.</li><li><strong>مقدَّم:</strong> قُدِّم الملخص كاملاً لمراجعة مدير الحساب.</li><li><strong>تمت المراجعة:</strong> راجع مدير الحساب الملخص.</li><li><strong>يحتاج معلومات:</strong> أشار مدير الحساب إلى الحاجة لمعلومات إضافية من المبيعات.</li></ul><h3>مراحل التهيئة</h3><p>بمجرد دخول العميل في التهيئة، يعمل مدير الحساب عبر خمس مراحل منظمة:</p><h3>المرحلة 2 — تحضير مدير الحساب</h3><p>قبل التواصل مع العميل، يتحضر مدير الحساب داخلياً. يشمل ذلك مراجعة جميع معلومات العميل والعقد، وتحديد المعلومات الناقصة، وإعداد الأسئلة، وتكوين مفهوم أولي للخطة.</p><h3>المرحلة 3 — أول تواصل مع العميل</h3><p>يتواصل مدير الحساب مع العميل خلال 24 ساعة، ويُعرِّف بنفسه كنقطة الاتصال الرئيسية، ويجدول اجتماع التهيئة.</p><h3>المرحلة 4 — اجتماع التهيئة</h3><p>اجتماع منظم مع العميل لتوحيد التوقعات. يغطي تعريف الفريق، وفهم الأعمال بعمق، وتحديد الجمهور المستهدف، وتحديد المنافسين، وضبط مؤشرات الأداء، وشرح العملية، والاتفاق على دورية التقارير وقنوات التواصل.</p><h3>المرحلة 5 — الوصول والإعداد</h3><p>يجمع مدير الحساب كافة الوصول والأصول اللازمة للبدء: وصول لوسائل التواصل الاجتماعي، الموقع الإلكتروني، حسابات الإعلانات إن وُجدت، إضافة العميل لقنوات التواصل، وتسجيل جميع معلوماته في النظام.</p><h3>المرحلة 6 — تفعيل الفريق الداخلي</h3><p>يُحيط مدير الحساب الفريق الداخلي علماً لبدء العمل. يشمل ذلك إرسال موجز واضح لكل قسم، وتحديد أهدافهم، وضبط مواعيد التقارير الشهرية، وعقد اجتماع داخلي إن لزم.</p><h3>متابعة التقدم</h3><p>تحتوي كل مرحلة من مراحل التهيئة على قائمة مهام. كلما أشّر مدير الحساب على مهام منجزة، <strong>ترتفع نسبة التقدم الإجمالية</strong>. يمنح ذلك الجميع — بما في ذلك المسؤولون — رؤية واضحة عن مدى اكتمال التهيئة.</p><p>يمكن لمدير الحساب أيضاً <strong>تخصيص عناصر قائمة المهام</strong> لتتناسب مع احتياجات كل عميل، بإضافة أو تعديل المهام داخل أي مرحلة.</p><div class=\"tip\">💡 نصيحة: العميل الذي حقق 100% تقدماً عبر جميع المراحل جاهز للتفعيل الكامل. استخدم شريط التقدم في ملف العميل للمتابعة السريعة.</div><h3>السجل وسجل التدقيق</h3><p>يُسجَّل كل إجراء مهم في عملية التسليم والتهيئة تلقائياً. في <strong>تبويب السجل</strong> بملف العميل يمكنك رؤية:</p><ul><li>متى تم إنشاء العميل من صفقة مكتملة.</li><li>متى تم تعيين مدير الحساب ومن قام بذلك.</li><li>متى تم تقديم ملخص التسليم.</li><li>متى اكتملت مهام التهيئة.</li><li>أي تغييرات في الحالة طوال العملية.</li></ul><p>يسهّل ذلك مراجعة الجدول الزمني الكامل وتحديد المسؤوليات بدقة في كل خطوة.</p><h3>الأسئلة الشائعة</h3><div class=\"note\"><strong>متى يظهر ملخص التسليم؟</strong><br/>يظهر زر الملخص في ملف العميل المحتمل فور تحديد الصفقة كمكتملة. لن يظهر للعملاء المحتملين الذين لا تزال صفقاتهم قيد العمل.</div><div class=\"note\"><strong>هل يظهر الملخص لكل عميل محتمل؟</strong><br/>لا. يظهر فقط للعملاء المحتملين الذين حالة صفقتهم مكتملة.</div><div class=\"note\"><strong>من يعيّن مدير الحساب؟</strong><br/>يقوم المسؤول بتعيين مدير الحساب من مجموعة العملاء باستخدام زر التعيين في صف العميل.</div><div class=\"note\"><strong>أين أجد التهيئة؟</strong><br/>افتح ملف العميل من مجموعة العملاء وانتقل إلى تبويب <strong>التهيئة</strong>. ستجد قائمة مراحل المهام هناك.</div><div class=\"note\"><strong>ماذا يحدث بعد أن تصبح الصفقة مكتملة؟</strong><br/>يقوم النظام تلقائياً بإنشاء سجل عميل. يظهر فوراً في مجموعة العملاء بحالة في انتظار التعيين.</div><div class=\"note\"><strong>هل يمكن تعديل عناصر التهيئة؟</strong><br/>نعم. يمكن لمديري الحسابات تخصيص عناصر قائمة المهام داخل كل مرحلة لتناسب احتياجات العميل.</div><div class=\"note\"><strong>من يمكنه تحديث الملخص؟</strong><br/>مندوب المبيعات المسؤول عن العميل المحتمل يمكنه ملء وتقديم الملخص. يمكن للمسؤولين أيضاً الوصول إليه ومراجعته.</div>",
    "keywords": [
      "handover",
      "onboarding",
      "client pool",
      "client handover",
      "account manager",
      "brief",
      "won deal",
      "تسليم",
      "تهيئة",
      "مجموعة العملاء",
      "مدير الحساب",
      "ملخص التسليم",
      "sales & customers management",
      "إدارة المبيعات والعملاء"
    ],
    "popular": true
  }
]
;


function buildCategories(): CategoryDef[] {
  return CATEGORIES_RAW.map((cat) => ({
    id: cat.id,
    nameEn: cat.nameEn,
    nameAr: cat.nameAr,
    descriptionEn: cat.descriptionEn,
    descriptionAr: cat.descriptionAr,
    icon: cat.icon,
    color: cat.color,
    sections: cat.sectionIds
      .map((sid) => {
        const meta = SECTIONS_META[sid];
        if (!meta) return null;
        const sectionArticles = ARTICLES.filter((a) => a.sectionId === sid);
        return {
          id: sid,
          nameEn: meta.nameEn,
          nameAr: meta.nameAr,
          descriptionEn: meta.descriptionEn,
          descriptionAr: meta.descriptionAr,
          icon: meta.icon,
          articles: sectionArticles,
        };
      })
      .filter(Boolean) as SectionDef[],
  }));
}

const categories = buildCategories();
const popularArticles = ARTICLES.filter((a) => a.popular);

export default function HelpCenter() {
  const { t, isRTL, lang } = useLanguage();
  const { tokens } = useThemeTokens();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/help-center/:slug");

  const isEn = lang === "en";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id || "");
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse slug: "catId--secId" or "catId"
  const slug = params?.slug || null;
  const urlCatId = slug ? slug.split("--")[0] : null;
  const urlSecId = slug && slug.includes("--") ? slug.split("--")[1] : null;

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === (urlCatId || activeCategoryId)) || categories[0],
    [urlCatId, activeCategoryId]
  );

  const activeSection = useMemo(
    () => (urlSecId ? activeCategory?.sections.find((s) => s.id === urlSecId) : null),
    [urlSecId, activeCategory]
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const results: SearchResult[] = [];
    for (const cat of categories) {
      for (const sec of cat.sections) {
        for (const art of sec.articles) {
          const match =
            art.questionEn.toLowerCase().includes(q) ||
            art.questionAr.includes(q) ||
            art.answerEn.toLowerCase().includes(q) ||
            art.answerAr.includes(q) ||
            art.keywords.some((k) => k.toLowerCase().includes(q));
          if (match) {
            results.push({
              ...art,
              categoryNameEn: cat.nameEn,
              categoryNameAr: cat.nameAr,
              sectionNameEn: sec.nameEn,
              sectionNameAr: sec.nameAr,
              sectionIcon: sec.icon,
            });
          }
        }
      }
    }
    return results.slice(0, 10);
  }, [searchQuery]);

  const handleCategoryClick = useCallback((catId: string) => {
    setActiveCategoryId(catId);
    navigate("/help-center");
  }, [navigate]);

  const handleSectionClick = useCallback((catId: string, secId: string) => {
    navigate(`/help-center/${catId}--${secId}`);
  }, [navigate]);

  const handleSearchResultClick = useCallback((result: SearchResult) => {
    setSearchQuery("");
    navigate(`/help-center/${result.categoryId}--${result.sectionId}`);
    setTimeout(() => setExpandedArticle(result.id), 100);
  }, [navigate]);

  return (
    <CRMLayout>
      <div className={`min-h-full space-y-6 p-4 md:p-6 ${isRTL ? "font-sans" : ""}`} dir={isRTL ? "rtl" : "ltr"}>

        {/* Hero Search */}
        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="relative" style={{ background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)" }}>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 left-8 w-32 h-32 rounded-full bg-white/20" />
              <div className="absolute bottom-4 right-12 w-24 h-24 rounded-full bg-white/15" />
              <div className="absolute top-1/2 left-1/3 w-16 h-16 rounded-full bg-white/10" />
            </div>
            <div className="relative px-6 py-10 md:py-14 text-center">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 mb-4">
                <HelpCircle className="h-4 w-4 text-white" />
                <span className="text-white/90 text-sm font-medium">Tamiyouz CRM</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {isEn ? "Help Center" : "\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629"}
              </h1>
              <p className="text-white/80 text-sm md:text-base mb-6 max-w-lg mx-auto">
                {isEn ? "Find answers, guides, and tips to get the most out of your CRM" : "\u0627\u0639\u062b\u0631 \u0639\u0644\u0649 \u0625\u062c\u0627\u0628\u0627\u062a \u0648\u0623\u062f\u0644\u0629 \u0648\u0646\u0635\u0627\u0626\u062d \u0644\u0644\u0627\u0633\u062a\u0641\u0627\u062f\u0629 \u0627\u0644\u0642\u0635\u0648\u0649 \u0645\u0646 \u0646\u0638\u0627\u0645\u0643"}
              </p>
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute top-1/2 -translate-y-1/2 start-4 h-5 w-5 text-slate-400" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  placeholder={isEn ? "Search for help articles..." : "\u0627\u0628\u062d\u062b \u0641\u064a \u0645\u0642\u0627\u0644\u0627\u062a \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629..."}
                  className="ps-12 pe-10 h-12 rounded-xl border-0 bg-white shadow-lg text-sm placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute top-1/2 -translate-y-1/2 end-3">
                    <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
                {searchResults.length > 0 && (
                  <div className="absolute top-full mt-2 inset-x-0 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 max-h-80 overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleSearchResultClick(r)}
                        className="w-full text-start px-4 py-3 hover:bg-slate-50 flex items-start gap-3 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <span className="mt-0.5 text-slate-400">{getIcon(r.sectionIcon)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{isEn ? r.questionEn : r.questionAr}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isEn ? r.categoryNameEn : r.categoryNameAr} &rsaquo; {isEn ? r.sectionNameEn : r.sectionNameAr}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="absolute top-full mt-2 inset-x-0 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-6 text-center">
                    <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">{isEn ? "No results found" : "\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Popular Articles */}
        {!urlSecId && popularArticles.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              {isEn ? "Popular Articles" : "\u0627\u0644\u0645\u0642\u0627\u0644\u0627\u062a \u0627\u0644\u0634\u0627\u0626\u0639\u0629"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {popularArticles.slice(0, 6).map((art) => {
                const cat = categories.find((c) => c.id === art.categoryId);
                const sec = cat?.sections.find((s) => s.id === art.sectionId);
                return (
                  <Card
                    key={art.id}
                    className="border-0 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]"
                    onClick={() => handleSearchResultClick({
                      ...art,
                      categoryNameEn: cat?.nameEn || "",
                      categoryNameAr: cat?.nameAr || "",
                      sectionNameEn: sec?.nameEn || "",
                      sectionNameAr: sec?.nameAr || "",
                      sectionIcon: sec?.icon || "",
                    })}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-slate-400">{getIcon(sec?.icon || "")}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 line-clamp-2">{isEn ? art.questionEn : art.questionAr}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {isEn ? cat?.nameEn : cat?.nameAr} &rsaquo; {isEn ? sec?.nameEn : sec?.nameAr}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {urlSecId && activeSection
                  ? (isEn ? activeSection.nameEn : activeSection.nameAr)
                  : (isEn ? "Browse by Category" : "\u062a\u0635\u0641\u062d \u062d\u0633\u0628 \u0627\u0644\u0641\u0626\u0629")}
              </h2>
              {!urlSecId && (
                <p className="text-sm text-slate-500 mt-0.5">
                  {isEn
                    ? `${categories.length} categories \u00B7 ${categories.reduce((s: number, c: CategoryDef) => s + c.sections.length, 0)} sections`
                    : `${categories.length} \u0641\u0626\u0627\u062a \u00B7 ${categories.reduce((s: number, c: CategoryDef) => s + c.sections.length, 0)} \u0642\u0633\u0645`}
                </p>
              )}
            </div>
            {urlSecId && (
              <Button variant="outline" size="sm" onClick={() => navigate("/help-center")} className="gap-2">
                {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {isEn ? "Back" : "\u0631\u062c\u0648\u0639"}
              </Button>
            )}
          </div>

          {urlSecId && activeSection ? (
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: activeCategory.color }} />
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl p-4 text-white" style={{ backgroundColor: activeCategory.color }}>
                    {getIcon(activeSection.icon)}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{isEn ? activeSection.nameEn : activeSection.nameAr}</CardTitle>
                    <CardDescription className="mt-1">
                      {isEn ? activeSection.descriptionEn : activeSection.descriptionAr}
                    </CardDescription>
                    <Badge variant="secondary" className="mt-2 rounded-full" style={{ color: activeCategory.color, backgroundColor: `${activeCategory.color}15` }}>
                      {activeSection.articles.length} {isEn ? "articles" : "\u0645\u0642\u0627\u0644"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {activeSection.articles.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    {isEn ? "No articles yet in this section." : "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0642\u0627\u0644\u0627\u062a \u0628\u0639\u062f \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645."}
                  </div>
                ) : (
                  activeSection.articles.map((art, idx) => (
                    <Accordion key={art.id} type="single" collapsible value={expandedArticle === art.id ? art.id : undefined} onValueChange={(v) => setExpandedArticle(v || null)}>
                      <AccordionItem value={art.id} className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline py-4">
                          <span className="flex items-center gap-3 text-start">
                            <span className="flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ backgroundColor: activeCategory.color }}>
                              {idx + 1}
                            </span>
                            {isEn ? art.questionEn : art.questionAr}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 ps-10">
                          <div
                            className="article-content max-w-none"
                            dangerouslySetInnerHTML={{ __html: isEn ? art.answerEn : art.answerAr }}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-6 xl:flex-row">
              {/* Sidebar */}
              <div className="hidden xl:block xl:w-72 flex-shrink-0">
                <Card className="border-0 shadow-sm sticky top-24">
                  <CardContent className="p-3 space-y-1">
                    {categories.map((cat) => {
                      const isActive = cat.id === activeCategoryId;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => handleCategoryClick(cat.id)}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-start transition-all ${
                            isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className={`rounded-xl p-2 ${isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                            {getIcon(cat.icon)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate ${isActive ? "text-blue-700" : "text-slate-700"}`}>
                              {isEn ? cat.nameEn : cat.nameAr}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {cat.sections.length} {isEn ? "sections" : "\u0642\u0633\u0645"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Mobile Tabs */}
              <div className="xl:hidden overflow-x-auto pb-2 -mx-4 px-4">
                <div className="flex gap-2 min-w-max">
                  {categories.map((cat) => {
                    const isActive = cat.id === activeCategoryId;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
                          isActive ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {getIcon(cat.icon)}
                        {isEn ? cat.nameEn : cat.nameAr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Content */}
              <div className="flex-1 min-w-0">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-slate-700">
                    {isEn ? activeCategory.nameEn : activeCategory.nameAr}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {isEn ? activeCategory.descriptionEn : activeCategory.descriptionAr}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeCategory.sections.map((sec) => (
                    <Card
                      key={sec.id}
                      className="border-0 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] group"
                      onClick={() => handleSectionClick(activeCategory.id, sec.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl p-2.5 text-white transition-transform group-hover:scale-110" style={{ backgroundColor: activeCategory.color }}>
                            {getIcon(sec.icon)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">{isEn ? sec.nameEn : sec.nameAr}</p>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{isEn ? sec.descriptionEn : sec.descriptionAr}</p>
                            <Badge variant="secondary" className="mt-2 rounded-full text-xs" style={{ color: activeCategory.color, backgroundColor: `${activeCategory.color}12` }}>
                              {sec.articles.length} {isEn ? "articles" : "\u0645\u0642\u0627\u0644"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Support Section */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-1" style={{ background: "linear-gradient(90deg, #2563EB, #7C3AED, #EC4899)" }} />
          <CardContent className="p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mb-3">
                <LifeBuoy className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">
                {isEn ? "Still need help?" : "\u0647\u0644 \u062a\u062d\u062a\u0627\u062c \u0645\u0633\u0627\u0639\u062f\u0629 \u0625\u0636\u0627\u0641\u064a\u0629\u061f"}
              </h3>
              <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
                {isEn
                  ? "Our support team is here to help you with any questions."
                  : "\u0641\u0631\u064a\u0642 \u0627\u0644\u062f\u0639\u0645 \u0644\u062f\u064a\u0646\u0627 \u0647\u0646\u0627 \u0644\u0645\u0633\u0627\u0639\u062f\u062a\u0643 \u0641\u064a \u0623\u064a \u0627\u0633\u062a\u0641\u0633\u0627\u0631."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a href="mailto:support@tamiyouz.com" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                  <Mail className="h-4 w-4" />
                  {isEn ? "Email Support" : "\u062f\u0639\u0645 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a"}
                </a>
                <a href="https://wa.me/966500000000" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <MessageCircle className="h-4 w-4" />
                  {isEn ? "WhatsApp" : "\u0648\u0627\u062a\u0633\u0627\u0628"}
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </CRMLayout>
  );
}

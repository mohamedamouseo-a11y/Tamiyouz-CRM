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
  ChevronDown, ChevronUp, ClipboardList, DatabaseZap, FileUser, Funnel,
  Gauge, Globe, Handshake, HardDriveDownload, HelpCircle, KeyRound,
  Languages, LayoutDashboard, LifeBuoy, Link2, LocateFixed, Megaphone,
  MessagesSquare, MoonStar, Music2, PlugZap, Presentation, RefreshCw,
  Rocket, Rows3, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, UserRound, Users, X, BookOpen, Mail, Phone, MessageCircle
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
  Funnel: <Funnel className="h-5 w-5" />,
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
      "customer-profile"
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
    "answerEn": "Open the Dashboard area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم لوحة التحكم من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Dashboard, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم لوحة التحكم، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Settings area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم الإعدادات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Settings, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم الإعدادات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Roles & Permissions area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم الأدوار والصلاحيات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Roles & Permissions, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم الأدوار والصلاحيات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Data Import area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم استيراد البيانات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Data Import, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم استيراد البيانات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Backup area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم النسخ الاحتياطي من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Backup, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم النسخ الاحتياطي، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Leads area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم العملاء المحتملون من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Leads, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم العملاء المحتملون، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Deals area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم الصفقات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Deals, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم الصفقات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Sales Funnel area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم قمع المبيعات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Sales Funnel, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم قمع المبيعات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Activities area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم الأنشطة من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Activities, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم الأنشطة، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Renewals area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم التجديدات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Renewals, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم التجديدات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Customers area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم العملاء من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Customers, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم العملاء، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Customer Profile area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم ملف العميل من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Customer Profile, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم ملف العميل، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Campaigns area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم الحملات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Campaigns, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم الحملات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Meta Campaigns area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم حملات ميتا من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Meta Campaigns, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم حملات ميتا، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the TikTok Campaigns area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم حملات تيك توك من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to TikTok Campaigns, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم حملات تيك توك، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Campaign Analytics area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم تحليلات الحملات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Campaign Analytics, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم تحليلات الحملات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Meta Integration area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم تكامل ميتا من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Meta Integration, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم تكامل ميتا، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the TikTok Integration area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم تكامل تيك توك من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to TikTok Integration, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم تكامل تيك توك، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Team Dashboard area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم لوحة الفريق من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Team Dashboard, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم لوحة الفريق، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Audit Log area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم سجل التدقيق من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Audit Log, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم سجل التدقيق، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Aggregated Meta Analytics area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم تحليلات ميتا المجمعة من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Aggregated Meta Analytics, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم تحليلات ميتا المجمعة، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Account Manager Dashboard area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم لوحة مدير الحساب من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Account Manager Dashboard, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم لوحة مدير الحساب، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Rakan AI area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم راكان الذكي من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Rakan AI, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم راكان الذكي، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Lead Intelligence area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم ذكاء العملاء المحتملين من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Lead Intelligence, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم ذكاء العملاء المحتملين، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Conversation Monitoring area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم مراقبة المحادثات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Conversation Monitoring, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم مراقبة المحادثات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Custom Fields area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم الحقول المخصصة من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Custom Fields, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم الحقول المخصصة، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Lead Sources area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم مصادر العملاء من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Lead Sources, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم مصادر العملاء، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Notifications area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم الإشعارات من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Notifications, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم الإشعارات، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Dark Mode area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم الوضع الداكن من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Dark Mode, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم الوضع الداكن، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Language area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم اللغة من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Language, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم اللغة، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
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
    "answerEn": "Open the Reset Password area from the main navigation, review the available fields, then complete the required setup before inviting the team to use it. Start with naming conventions, ownership rules, and visibility settings so data stays clean and easy to report on. After that, test the workflow with one or two sample records and confirm the expected status, notifications, and permissions.",
    "answerAr": "افتح قسم إعادة تعيين كلمة المرور من التنقل الرئيسي، وراجع الحقول المتاحة، ثم أكمل الإعدادات المطلوبة قبل أن يبدأ الفريق باستخدامه. ابدأ بقواعد التسمية وملكية البيانات وصلاحيات الظهور حتى تبقى البيانات نظيفة وسهلة في التقارير. بعد ذلك جرّب سير العمل على سجل أو سجلين للتأكد من الحالة والتنبيهات والصلاحيات المتوقعة.",
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
    "answerEn": "Check filters, date range, ownership rules, and user permissions first. In many cases, the data exists but is hidden by status filters, team scope, or missing mappings. If the issue continues, review recent imports, integrations, and automation rules related to Reset Password, then compare one affected record against a working one to identify differences quickly.",
    "answerAr": "تحقق أولاً من الفلاتر والفترة الزمنية وقواعد الملكية وصلاحيات المستخدم. في كثير من الحالات تكون البيانات موجودة لكن مخفية بسبب فلاتر الحالة أو نطاق الفريق أو نقص الربط بين الحقول. إذا استمرت المشكلة فراجع آخر عمليات الاستيراد والتكاملات وقواعد الأتمتة المرتبطة بقسم إعادة تعيين كلمة المرور، ثم قارن سجلاً متأثراً بسجل يعمل بشكل صحيح لمعرفة الفرق بسرعة.",
    "keywords": [
      "reset password",
      "إعادة تعيين كلمة المرور",
      "troubleshooting",
      "permissions",
      "filters",
      "data"
    ],
    "popular": false
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
  const { t, isRTL, language } = useLanguage();
  const { tokens } = useThemeTokens();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/help-center/:catId/:secId");
  const [, catOnlyParams] = useRoute("/help-center/:catId");

  const isEn = language === "en";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id || "");
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const urlCatId = params?.catId || catOnlyParams?.catId || null;
  const urlSecId = params?.secId || null;

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
    navigate(`/help-center/${catId}/${secId}`);
  }, [navigate]);

  const handleSearchResultClick = useCallback((result: SearchResult) => {
    setSearchQuery("");
    navigate(`/help-center/${result.categoryId}/${result.sectionId}`);
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
                        <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 ps-10">
                          {isEn ? art.answerEn : art.answerAr}
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

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeTokenProvider } from "./contexts/ThemeTokenContext";
import Login from "./pages/Login";
import AgentDashboard from "./pages/AgentDashboard";
import TeamDashboard from "./pages/TeamDashboard";
import SalesFunnelDashboard from "./pages/SalesFunnelDashboard";
import TaskSlaDashboard from "./pages/TaskSlaDashboard";
import CampaignAnalytics from "./pages/CampaignAnalytics";
import LeadsList from "./pages/LeadsList";
import LeadProfile from "./pages/LeadProfile";
import AdminSettings from "./pages/AdminSettings";
import ImportLeads from "./pages/ImportLeads";
import CampaignsList from "./pages/CampaignsList";
import CampaignDetail from "./pages/CampaignDetail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SalesHeroesChat from "./components/SalesHeroesChat";
import ChatMonitor from "./pages/ChatMonitor";
import TrashPage from "./pages/TrashPage";
import AuditLogPage from "./pages/AuditLogPage";
import CalendarPage from "./pages/CalendarPage";
import ClientPool from "./pages/ClientPool";
import ClientProfile from "./pages/ClientProfile";
import RenewalPipeline from "./pages/RenewalPipeline";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AgentDashboard} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={AgentDashboard} />
      <Route path="/team-dashboard" component={TeamDashboard} />
      <Route path="/sales-funnel" component={SalesFunnelDashboard} />
      <Route path="/task-sla" component={TaskSlaDashboard} />
      <Route path="/campaign-analytics" component={CampaignAnalytics} />
      <Route path="/leads" component={LeadsList} />
      <Route path="/leads/:id" component={LeadProfile} />
      <Route path="/campaigns" component={CampaignsList} />
      <Route path="/campaigns/:name" component={CampaignDetail} />
      <Route path="/admin" component={AdminSettings} />
      <Route path="/settings" component={AdminSettings} />
      <Route path="/import" component={ImportLeads} />
      <Route path="/admin/chat" component={ChatMonitor} />
      <Route path="/trash" component={TrashPage} />
      <Route path="/audit-log" component={AuditLogPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/clients" component={ClientPool} />
      <Route path="/clients/:id" component={ClientProfile} />
      <Route path="/renewals" component={RenewalPipeline} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <ThemeTokenProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
              <SalesHeroesChat />
            </TooltipProvider>
          </ThemeTokenProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

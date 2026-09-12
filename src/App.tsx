import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import Aircraft from "./pages/Aircraft";
import Login from "./pages/Login";
import Contact from "./pages/Contact";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Notifications from "./pages/Notifications";
import KPIs from "./pages/KPIs";
import CRM from "./pages/CRM";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import LeadForm from "./pages/LeadForm";
import LeadTeamChat from "./pages/LeadTeamChat";
import LeadHandoff from "./pages/LeadHandoff";
import OperationsQueue from "./pages/OperationsQueue";
import FlightSourcing from "./pages/FlightSourcing";
import Quotations from "./pages/Quotations";

import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import { PageAccessGate } from "@/components/layout/PageAccessGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/flights/:id" element={<FlightSourcing />} />
            <Route path="/messages" element={<PageAccessGate pageKey="messages"><Messages /></PageAccessGate>} />
            <Route path="/aircraft" element={<PageAccessGate pageKey="aircraft"><Aircraft /></PageAccessGate>} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users" element={<PageAccessGate pageKey="users"><Users /></PageAccessGate>} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/kpis" element={<PageAccessGate pageKey="kpis"><KPIs /></PageAccessGate>} />
            <Route path="/crm" element={<PageAccessGate pageKey="clients"><CRM /></PageAccessGate>} />
            <Route path="/leads" element={<PageAccessGate pageKey="flights"><Leads /></PageAccessGate>} />
            <Route path="/leads/new" element={<LeadForm />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/leads/:id/edit" element={<LeadForm />} />
            <Route path="/leads/:id/chat" element={<LeadTeamChat />} />
            <Route path="/leads/:id/handoff" element={<LeadHandoff />} />
            <Route path="/request-queue" element={<PageAccessGate pageKey="request_queue"><OperationsQueue /></PageAccessGate>} />
            <Route path="/quotations" element={<PageAccessGate pageKey="quotations"><Quotations /></PageAccessGate>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Timeline from "./pages/Timeline";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// CrisisWatch pages
import CrisisLanding from "./crisiswatch/pages/CrisisLanding";
import CrisisDashboard from "./crisiswatch/pages/CrisisDashboard";
import CrisisMap from "./crisiswatch/pages/CrisisMap";
import CrisisAssets from "./crisiswatch/pages/CrisisAssets";
import AnalystQueue from "./crisiswatch/pages/AnalystQueue";
import AlertHistory from "./crisiswatch/pages/AlertHistory";
import CrisisAlertRules from "./crisiswatch/pages/CrisisAlertRules";
import ApiDocs from "./crisiswatch/pages/ApiDocs";
import CrisisSettings from "./crisiswatch/pages/CrisisSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />

            {/* CrisisWatch */}
            <Route path="/crisiswatch/landing" element={<CrisisLanding />} />
            <Route path="/crisiswatch" element={<ProtectedRoute><CrisisDashboard /></ProtectedRoute>} />
            <Route path="/crisiswatch/map" element={<ProtectedRoute><CrisisMap /></ProtectedRoute>} />
            <Route path="/crisiswatch/assets" element={<ProtectedRoute><CrisisAssets /></ProtectedRoute>} />
            <Route path="/crisiswatch/analyst-queue" element={<ProtectedRoute><AnalystQueue /></ProtectedRoute>} />
            <Route path="/crisiswatch/alerts" element={<ProtectedRoute><AlertHistory /></ProtectedRoute>} />
            <Route path="/crisiswatch/alert-rules" element={<ProtectedRoute><CrisisAlertRules /></ProtectedRoute>} />
            <Route path="/crisiswatch/api-docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
            <Route path="/crisiswatch/settings" element={<ProtectedRoute><CrisisSettings /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

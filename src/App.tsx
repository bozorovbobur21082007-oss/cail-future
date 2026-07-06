import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import SubscriptionGate from "@/components/SubscriptionGate";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import WorkersPage from "@/pages/WorkersPage";
import OperationsPage from "@/pages/OperationsPage";
import LogsPage from "@/pages/LogsPage";
import SectorsPage from "@/pages/SectorsPage";
import TransferPage from "@/pages/TransferPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children, allowWorker = false }: { children: React.ReactNode; allowWorker?: boolean }) {
  const { user, role, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  // Worker can only access pages where allowWorker is true
  if (role === 'worker' && !allowWorker) return <Navigate to="/operatsiyalar" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) {
    return <Navigate to={role === 'worker' ? '/operatsiyalar' : '/'} replace />;
  }
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute allowWorker><SubscriptionGate><AppLayout /></SubscriptionGate></ProtectedRoute>}>
              <Route index element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="mahsulotlar" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
              <Route path="ishchilar" element={<ProtectedRoute><WorkersPage /></ProtectedRoute>} />
              <Route path="operatsiyalar" element={<ProtectedRoute allowWorker><OperationsPage /></ProtectedRoute>} />
              <Route path="loglar" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
              <Route path="sektorlar" element={<ProtectedRoute><SectorsPage /></ProtectedRoute>} />
              <Route path="kochirish" element={<ProtectedRoute><TransferPage /></ProtectedRoute>} />
              <Route path="sozlamalar" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

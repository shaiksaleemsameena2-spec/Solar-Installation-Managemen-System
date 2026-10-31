import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router";
import { ToastProvider } from "@/components/toast";
import { useSession } from "@/hooks/useSession";
import LoginPage from "@/pages/LoginPage";
import AppShell from "@/layout/AppShell";

// Route-level code splitting: each page bundle loads on first visit,
// keeping the initial JS payload small (demo loads fast).
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const CustomerDetailPage = lazy(() => import("@/pages/CustomerDetailPage"));
const SurveysPage = lazy(() => import("@/pages/SurveysPage"));
const QuotationsPage = lazy(() => import("@/pages/QuotationsPage"));
const QuotationDetailPage = lazy(() => import("@/pages/QuotationDetailPage"));
const InventoryPage = lazy(() => import("@/pages/InventoryPage"));
const InstallationsPage = lazy(() => import("@/pages/InstallationsPage"));
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetailPage"));
const WarrantiesPage = lazy(() => import("@/pages/WarrantiesPage"));
const ServicePage = lazy(() => import("@/pages/ServicePage"));
const PaymentsPage = lazy(() => import("@/pages/PaymentsPage"));
const SubsidiesPage = lazy(() => import("@/pages/SubsidiesPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const PortalShell = lazy(() => import("@/portal/shell").then((m) => ({ default: m.PortalShell })));
const PortalHome = lazy(() => import("@/portal/PortalHome"));
const PortalTechnician = lazy(() => import("@/portal/TechnicianLocator"));
const Spinner = lazy(() => import("@/components/ui").then((m) => ({ default: m.Spinner })));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label="Loading module…" />
    </div>
  );
}

export default function App() {
  const session = useSession();
  const isCustomer = session?.role === "customer";

  return (
    <ToastProvider>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={session && !isCustomer ? <Navigate to="/dashboard" replace /> : session && isCustomer ? <Navigate to="/portal" replace /> : <LoginPage />} />
        <Route path="/portal" element={session ? <PortalShell /> : <Navigate to="/login" replace />}>
          <Route index element={<PortalHome />} />
          <Route path="technician" element={<PortalTechnician />} />
        </Route>
        <Route
          path="/"
          element={!session ? <Navigate to="/login" replace /> : isCustomer ? <Navigate to="/portal" replace /> : <AppShell />}
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="surveys" element={<SurveysPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="quotations/:id" element={<QuotationDetailPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="installations" element={<InstallationsPage />} />
          <Route path="installations/:id" element={<ProjectDetailPage />} />
          <Route path="warranties" element={<WarrantiesPage />} />
          <Route path="service" element={<ServicePage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="subsidies" element={<SubsidiesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
      </Suspense>
    </ToastProvider>
  );
}

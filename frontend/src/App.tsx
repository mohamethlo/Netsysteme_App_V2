// ─────────────────────────────────────────────────────────────────────────────
//  src/App.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import LandingPage   from "./pages/LandingPage";
import LoginPage     from "./pages/auth/LoginPage";
import MainLayout    from "./layouts/MainLayout";
import DashboardPage from "./pages/dashboard/Dashboardpage";
import UsersPage from "./pages/users/UsersPage";
import BillingClientsPage from "./pages/billing-clients/BillingClientsPage";
import ProductsPage from "./pages/products/ProductsPage";
import InvoicesPage from "./pages/invoices/InvoicesPage";
import ProformasPage from "./pages/proformas/ProformasPage";
import BillingPage from "./pages/billing/BillingPage";

import InstallationsPage from "./pages/installations/InstallationsPage";
import PaymentRemindersPage from "./pages/installations/PaymentRemindersPage";
import AttendancePage from "./pages/attendance/AttendancePage";

import WorkLocationsPage from "./pages/attendance/WorkLocationsPage";

import ExpensesPage from "./pages/expenses/ExpensesPage";
import ClientsPage from "./pages/clients/ClientsPage";
import SMSPage from "./pages/sms/SMSPage";
import InventoryPage from "./pages/inventory/InventoryPage";
import InterventionsPage from "./pages/interventions/InterventionsPage";
import AssignmentsPage from "./pages/assignments/AssignmentsPage";
import AdvancesPage from "./pages/advances/AdvancesPage";
import DevisPage from "./pages/devis/DevisPage";
import MonthlyReportPage from "./pages/reports/MonthlyReportPage";
import ProfilePage from "./pages/profile/ProfilePage";
import ChangePasswordPage from "./pages/profile/ChangePasswordPage";
import CalendarPage from "./pages/calendrier/CalendarPage";
import RolesPage from "./pages/users/RolesPage";
import TechDashboardPage from "./pages/dashboard/TechDashboardPage";
import TechLocationsPage from "./pages/attendance/TechLocationsPage";
import ChantiersPage from "./pages/chantiers/ChantiersPage";
import OutillagePage from "./pages/outillage/OutillagePage";
import DepensesTerrainPage from "./pages/depenses_terrain/DepensesTerrainPage";


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function DashboardHome() {
  const { user } = useAuthStore();
  const isAdmin = user?.is_staff || user?.role === "Administrateur";
  const isRT    = user?.role === "Responsable Technique";
  if (isAdmin) return <DashboardPage />;
  if (isRT)    return <Navigate to="/dashboard/tech" replace />;
  return <Navigate to="/dashboard/attendance" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"      element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — MainLayout wraps all dashboard pages */}
        <Route path="/dashboard"        element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index                  element={<DashboardHome />} />
          <Route path="clients"         element={<ClientsPage />} />
          <Route path="interventions"   element={<InterventionsPage/>} />
          <Route path="inventory"       element={<InventoryPage/>} />
          <Route path="advances"        element={<AdvancesPage/>} />
          <Route path="attendance"      element={<AttendancePage />} />
          <Route path="monthly" element={<MonthlyReportPage />} />
          <Route path="messaging"       element={<div style={{color:"inherit",padding:"1rem"}}>Messagerie — à venir</div>} />
          <Route path="profile"         element={<ProfilePage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="users"           element={<UsersPage />} />
          <Route path="roles"           element={<RolesPage />} />
          <Route path="billing"         element={<BillingPage />} />
          <Route path="billing-clients" element={<BillingClientsPage />} />
          <Route path="products"        element={<ProductsPage />} />
          <Route path="invoices"        element={<InvoicesPage />} />
          <Route path="proformas"       element={<ProformasPage />} />
          <Route path="installations"         element={<InstallationsPage />} />
          <Route path="payment-reminders"   element={<PaymentRemindersPage />} />
          <Route path="work-locations"  element={<WorkLocationsPage />} />
          <Route path="expenses"        element={<ExpensesPage />} />
          <Route path="sms"             element={<SMSPage />} />
          <Route path="assignments"     element={<AssignmentsPage />} />
          <Route path="devis"           element={<DevisPage />} />
          <Route path="calendar"        element={<CalendarPage />} />
          <Route path="tech"            element={<TechDashboardPage />} />
          <Route path="tech-locations"  element={<TechLocationsPage />} />
          <Route path="chantiers"        element={<ChantiersPage />} />
          <Route path="outillage"        element={<OutillagePage />} />
          <Route path="depenses-terrain" element={<DepensesTerrainPage />} />


        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
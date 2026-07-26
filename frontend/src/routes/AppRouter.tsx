import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../components/common/ProtectedRoute";

import AuthPage from "../pages/auth/AuthPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import CustomersPage from "../pages/customers/CustomersPage";
import CustomerLedgerPage from "../pages/customers/CustomerLedgerPage";
import LoansPage from "../pages/loans/LoansPage";
import LoanDetailPage from "../pages/loans/LoanDetailPage";
import PaymentsPage from "../pages/payments/PaymentsPage";
import RenewalsPage from "../pages/renewals/RenewalsPage";
import SettingsPage from "../pages/settings/SettingsPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<AuthPage />} />

        {/* Protected */}
        <Route
          path="/dashboard"
          element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
        />
        <Route
          path="/customers"
          element={<ProtectedRoute><CustomersPage /></ProtectedRoute>}
        />
        <Route
          path="/customers/:customerId/ledger"
          element={<ProtectedRoute><CustomerLedgerPage /></ProtectedRoute>}
        />
        <Route
          path="/loans"
          element={<ProtectedRoute><LoansPage /></ProtectedRoute>}
        />
        <Route
          path="/loans/:loanId"
          element={<ProtectedRoute><LoanDetailPage /></ProtectedRoute>}
        />
        <Route
          path="/payments"
          element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>}
        />
        <Route
          path="/renewals"
          element={<ProtectedRoute><RenewalsPage /></ProtectedRoute>}
        />
        <Route
          path="/settings"
          element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}
        />

        {/* Fallback: authenticated users go to dashboard, others to login */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

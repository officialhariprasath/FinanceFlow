import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../components/common/ProtectedRoute";
import OwnerRoute from "../components/common/OwnerRoute";

import AuthPage from "../pages/auth/AuthPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import CustomersPage from "../pages/customers/CustomersPage";
import CustomerLedgerPage from "../pages/customers/CustomerLedgerPage";
import LoansPage from "../pages/loans/LoansPage";
import LoanDetailPage from "../pages/loans/LoanDetailPage";
import PaymentsPage from "../pages/payments/PaymentsPage";
import RenewalsPage from "../pages/renewals/RenewalsPage";
import SettingsPage from "../pages/settings/SettingsPage";
import CapitalPage from "../pages/capital/CapitalPage";
import ProfitPage from "../pages/profit/ProfitPage";
import LedgersPage from "../pages/ledgers/LedgersPage";
import ExpensesPage from "../pages/expenses/ExpensesPage";
import DefaultsPage from "../pages/defaults/DefaultsPage";
import ReportsPage from "../pages/reports/ReportsPage";
import SimulationPage from "../pages/simulation/SimulationPage";
import ReconciliationPage from "../pages/reconciliation/ReconciliationPage";
import AuditPage from "../pages/audit/AuditPage";
import CollectionsPage from "../pages/collections/CollectionsPage";
import AgentsPage from "../pages/agents/AgentsPage";
import AgentSettlementPage from "../pages/settlements/AgentSettlementPage";
import OwnerSettlementsPage from "../pages/settlements/OwnerSettlementsPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<AuthPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected */}
        <Route
          path="/dashboard"
          element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
        />
        <Route
          path="/capital"
          element={<ProtectedRoute><CapitalPage /></ProtectedRoute>}
        />
        <Route
          path="/profit"
          element={<ProtectedRoute><ProfitPage /></ProtectedRoute>}
        />
        <Route
          path="/ledgers"
          element={<ProtectedRoute><LedgersPage /></ProtectedRoute>}
        />
        <Route
          path="/expenses"
          element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>}
        />
        <Route
          path="/defaults"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <DefaultsPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={<ProtectedRoute><ReportsPage /></ProtectedRoute>}
        />
        <Route
          path="/simulation"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <SimulationPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reconciliation"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <ReconciliationPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <AuditPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/collections"
          element={<ProtectedRoute><CollectionsPage /></ProtectedRoute>}
        />
        <Route
          path="/settlements"
          element={<ProtectedRoute><AgentSettlementPage /></ProtectedRoute>}
        />
        <Route
          path="/agent-settlements"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <OwnerSettlementsPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents"
          element={
            <ProtectedRoute>
              <OwnerRoute>
                <AgentsPage />
              </OwnerRoute>
            </ProtectedRoute>
          }
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

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AuthPage from "../pages/auth/AuthPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import CustomersPage from "../pages/customers/CustomersPage";
import CustomerLedgerPage from "../pages/customers/CustomerLedgerPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />

        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/customers" element={<CustomersPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />

        <Route path="/customers/:customerId/ledger"element={<CustomerLedgerPage />}/>
      </Routes>
    </BrowserRouter>
  );
}
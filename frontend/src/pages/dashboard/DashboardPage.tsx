import { useEffect, useState } from "react";

import DashboardCard from "../../components/dashboard/DashboardCard";
import MainLayout from "../../components/layout/MainLayout";
import RecentLoansTable from "../../components/dashboard/RecentLoansTable";
import RecentPaymentsTable from "../../components/dashboard/RecentPaymentsTable";

import { getDashboard } from "../../services/dashboardService";
import type { DashboardResponse } from "../../types/dashboard";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const data = await getDashboard();

      setDashboard(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: string) =>
    `₹${Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-lg font-medium">
          Loading dashboard...
        </div>
      </MainLayout>
    );
  }

  if (error || !dashboard) {
    return (
      <MainLayout>
        <div className="p-6 text-red-600">
          {error || "Unable to load dashboard."}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 p-6">
        <div>
          <h1 className="text-3xl font-bold">
            Dashboard
          </h1>

          <p className="mt-1 text-slate-600">
            Welcome to Your Finance
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Total Customers"
            value={dashboard.total_customers}
          />

          <DashboardCard
            title="Active Loans"
            value={dashboard.active_loans}
          />

          <DashboardCard
            title="Closed Loans"
            value={dashboard.closed_loans}
          />

          <DashboardCard
            title="Today's Collection"
            value={formatCurrency(
              dashboard.today_collection
            )}
          />

          <DashboardCard
            title="Principal Disbursed"
            value={formatCurrency(
              dashboard.total_principal_disbursed
            )}
          />

          <DashboardCard
            title="Remaining Principal"
            value={formatCurrency(
              dashboard.remaining_principal
            )}
          />

          <DashboardCard
            title="Principal Paid"
            value={formatCurrency(
              dashboard.total_principal_paid
            )}
          />

          <DashboardCard
            title="Interest Paid"
            value={formatCurrency(
              dashboard.total_interest_paid
            )}
          />
        </div>

        <RecentLoansTable
          loans={dashboard.recent_loans}
        />

        <RecentPaymentsTable
          payments={dashboard.recent_payments}
        />
      </div>
    </MainLayout>
  );
}
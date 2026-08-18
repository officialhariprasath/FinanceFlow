import { useEffect, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import DashboardCard from "../../components/dashboard/DashboardCard";
import { PageError, PageLoading } from "../../components/common/PageStates";
import { getReconciliation } from "../../services/extendedService";
import type { Reconciliation } from "../../services/extendedService";
import { fmt } from "../../utils/fmt";

export default function ReconciliationPage() {
  const [data, setData] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      setData(await getReconciliation());
    } catch {
      setError("Failed to load reconciliation.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading reconciliation..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <PageError message={error} onRetry={load} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Reconciliation</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Owner admin view — capital, profit, and agent cash</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard title="Capital available" value={fmt(data?.capital_available)} />
          <DashboardCard title="Capital lent" value={fmt(data?.capital_lent)} />
          <DashboardCard title="Profit available" value={fmt(data?.profit_available)} />
          <DashboardCard
            title="Unsettled with agents"
            value={fmt(data?.unsettled_with_agents)}
          />
          <DashboardCard
            title="Pending settlements"
            value={String(data?.pending_settlement_count ?? 0)}
          />
          <DashboardCard
            title="Pending settlement ₹"
            value={fmt(data?.pending_settlement_total ?? "0")}
          />
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                data?.is_balanced ? "bg-green-500" : "bg-amber-500"
              }`}
            />
            <p className="font-medium">
              {data?.is_balanced
                ? "Agent wallets are settled — no unsettled cash or pending settlements"
                : data?.pending_settlement_count
                  ? `${data.pending_settlement_count} settlement(s) awaiting approval — review Agent Settlements`
                  : "Unsettled agent cash detected — review settlements"}
            </p>
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">{data?.notes}</p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500 dark:text-slate-400">Total capital added</dt>
              <dd className="font-medium">{fmt(data?.total_capital_added)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-slate-400">Gross profit</dt>
              <dd className="font-medium">{fmt(data?.gross_profit)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-slate-400">Total expenses</dt>
              <dd className="font-medium">{fmt(data?.total_expenses)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-slate-400">Net profit</dt>
              <dd className="font-medium">{fmt(data?.net_profit)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </MainLayout>
  );
}

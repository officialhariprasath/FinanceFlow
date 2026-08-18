import { useEffect, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import { PageError, PageLoading } from "../../components/common/PageStates";
import {
  downloadTransactionsCsv,
  getCollectionsReport,
  getFinancialReport,
  getPortfolioReport,
} from "../../services/extendedService";
import { fmt } from "../../utils/fmt";

export default function ReportsPage() {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [portfolio, setPortfolio] = useState<Record<string, unknown> | null>(null);
  const [collections, setCollections] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [s, p, c] = await Promise.all([
        getFinancialReport(),
        getPortfolioReport(),
        getCollectionsReport(30),
      ]);
      setSummary(s);
      setPortfolio(p);
      setCollections(c);
    } catch {
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleExport() {
    const blob = await downloadTransactionsCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading reports..." />
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

  const cap = summary?.capital as Record<string, string> | undefined;
  const net = summary?.net_profit as Record<string, string> | undefined;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Financial summaries and exports</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white"
          >
            Export transactions CSV
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="surface-card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Capital</h3>
            <p className="mt-2 text-sm">Available: {fmt(cap?.available_capital)}</p>
            <p className="text-sm">Lent: {fmt(cap?.capital_currently_lent)}</p>
          </div>
          <div className="surface-card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Profit</h3>
            <p className="mt-2 text-sm">Gross: {fmt(net?.gross_profit)}</p>
            <p className="text-sm">Net: {fmt(net?.net_profit)}</p>
            <p className="text-sm">Available: {fmt(net?.available_profit)}</p>
          </div>
          <div className="surface-card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Portfolio</h3>
            <p className="mt-2 text-sm">Active loans: {portfolio?.active_count as number}</p>
            <p className="text-sm">Defaulted: {portfolio?.defaulted_count as number}</p>
            <p className="text-sm">
              Outstanding: {fmt(portfolio?.total_principal_outstanding as string)}
            </p>
          </div>
        </div>

        <div className="surface-card p-4">
          <h3 className="font-semibold">Collections (30 days)</h3>
          <p className="mt-2 text-sm">
            Total: {fmt(collections?.total_collected as string)} —{" "}
            {collections?.payment_count as number} payments
          </p>
        </div>
      </div>
    </MainLayout>
  );
}

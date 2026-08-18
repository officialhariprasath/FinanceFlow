import { useEffect, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import DashboardCard from "../../components/dashboard/DashboardCard";
import { PageError, PageLoading } from "../../components/common/PageStates";
import {
  addCapital,
  getCapitalSummary,
  getCapitalTransactions,
} from "../../services/capitalService";
import { withdrawCapital } from "../../services/extendedService";
import type { CapitalSummary, CapitalTransaction } from "../../types/capital";
import { fmt } from "../../utils/fmt";
import { useToast } from "../../context/ToastContext";

function formatType(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDirection(direction: string, amount: string): string {
  const prefix = direction === "CREDIT" ? "+" : "-";
  return `${prefix}${fmt(amount).replace("₹", "₹")}`;
}

export default function CapitalPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<CapitalSummary | null>(null);
  const [transactions, setTransactions] = useState<CapitalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadCapital() {
    try {
      setLoading(true);
      setError("");
      const [summaryData, transactionData] = await Promise.all([
        getCapitalSummary(),
        getCapitalTransactions(),
      ]);
      setSummary(summaryData);
      setTransactions(transactionData.transactions);
    } catch {
      setError("Failed to load capital data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCapital();
  }, []);

  async function handleWithdrawCapital(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      setFormError("Enter a valid amount greater than zero.");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      await withdrawCapital(parsed.toFixed(2), description.trim() || undefined);
      setAmount("");
      setDescription("");
      setShowWithdraw(false);
      await loadCapital();
      toast.success("Capital withdrawn successfully.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setFormError(
        typeof detail === "string" ? detail : "Failed to withdraw capital."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCapital(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      setFormError("Enter a valid amount greater than zero.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      await addCapital({
        amount: parsed.toFixed(2),
        description: description.trim() || undefined,
      });
      setAmount("");
      setDescription("");
      setShowForm(false);
      await loadCapital();
      toast.success("Capital added successfully.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setFormError(
        typeof detail === "string" ? detail : "Failed to add capital."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading capital..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <PageError message={error} onRetry={loadCapital} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Capital</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Ledger-backed money available for lending
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setShowWithdraw(true);
              }}
              className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              Withdraw Capital
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setShowForm(true);
              }}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Add Capital
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Available Capital"
            value={fmt(summary?.available_capital)}
          />
          <DashboardCard
            title="Total Capital Added"
            value={fmt(summary?.total_capital_added)}
          />
          <DashboardCard
            title="Ledger Entries"
            value={summary?.transaction_count ?? 0}
          />
        </div>

        {showWithdraw && (
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Withdraw Capital</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Reduces available lending capital. Cannot exceed available balance.
            </p>
            <form onSubmit={handleWithdrawCapital} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Amount (INR)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Confirm Withdrawal"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowWithdraw(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showForm && (
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Add Capital</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Record money the owner puts into the business.
            </p>
            <form onSubmit={handleAddCapital} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Amount (INR)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="50000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Initial business capital"
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Confirm Add Capital"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="surface-card">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Capital Ledger
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Every balance is derived from these transactions.
            </p>
          </div>
          {transactions.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500 dark:text-slate-400">
              No capital transactions yet. Add capital to start the ledger.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-slate-400">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-slate-400">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-slate-400">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-slate-400">
                      Balance After
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-slate-400">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-6 py-3 text-gray-700 dark:text-slate-300">
                        {new Date(tx.created_at).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-3 text-gray-700 dark:text-slate-300">
                        {formatType(tx.type)}
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-slate-100">
                        {formatDirection(tx.direction, tx.amount)}
                      </td>
                      <td className="px-6 py-3 text-gray-700 dark:text-slate-300">
                        {fmt(tx.balance_after)}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-slate-400">
                        {tx.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

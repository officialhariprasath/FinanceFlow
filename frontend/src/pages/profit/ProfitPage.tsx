import { useEffect, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import DashboardCard from "../../components/dashboard/DashboardCard";
import { PageError, PageLoading } from "../../components/common/PageStates";
import {
  getNetProfitSummary,
  getProfitSummary,
  getProfitTransactions,
  reinvestProfit,
  withdrawProfit,
} from "../../services/extendedService";
import type { ProfitTransaction } from "../../services/extendedService";
import { fmt } from "../../utils/fmt";
import { useToast } from "../../context/ToastContext";

export default function ProfitPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<{
    available_profit: string;
    total_profit_earned: string;
  } | null>(null);
  const [net, setNet] = useState<{
    gross_profit: string;
    total_expenses: string;
    net_profit: string;
    available_profit: string;
  } | null>(null);
  const [transactions, setTransactions] = useState<ProfitTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"withdraw" | "reinvest" | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [s, n, txs] = await Promise.all([
        getProfitSummary(),
        getNetProfitSummary(),
        getProfitTransactions(),
      ]);
      setSummary(s);
      setNet(n);
      setTransactions(txs);
    } catch {
      setError("Failed to load profit data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      setFormError("Enter a valid amount.");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      const amt = parsed.toFixed(2);
      const wasWithdraw = action === "withdraw";
      if (action === "withdraw") {
        await withdrawProfit(amt, description.trim() || undefined);
      } else if (action === "reinvest") {
        await reinvestProfit(amt, description.trim() || undefined);
      }
      setAmount("");
      setDescription("");
      setAction(null);
      await load();
      toast.success(wasWithdraw ? "Profit withdrawn." : "Profit reinvested.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading profit..." />
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Profit</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Recognized interest profit — withdraw or reinvest to capital
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setAction("withdraw");
              }}
              className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              Withdraw Profit
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setAction("reinvest");
              }}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Reinvest to Capital
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard title="Available Profit" value={fmt(summary?.available_profit)} />
          <DashboardCard title="Gross Profit" value={fmt(net?.gross_profit)} />
          <DashboardCard title="Total Expenses" value={fmt(net?.total_expenses)} />
          <DashboardCard title="Net Profit" value={fmt(net?.net_profit)} />
        </div>

        {action && (
          <div className="surface-card p-6">
            <h2 className="section-title">
              {action === "withdraw" ? "Withdraw Profit" : "Reinvest Profit to Capital"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Amount (INR)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setAction(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="table-shell">
          <div className="border-b px-6 py-4">
            <h2 className="section-title">Profit Ledger</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Amount</th>
                <th className="px-6 py-3 text-left">Balance</th>
                <th className="px-6 py-3 text-left">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-6 py-3">{new Date(tx.created_at).toLocaleString("en-IN")}</td>
                  <td className="px-6 py-3">{tx.type.replace(/_/g, " ")}</td>
                  <td className="px-6 py-3 font-medium">
                    {tx.direction === "CREDIT" ? "+" : "-"}
                    {fmt(tx.amount)}
                  </td>
                  <td className="px-6 py-3">{fmt(tx.balance_after)}</td>
                  <td className="px-6 py-3 text-gray-600 dark:text-slate-400">{tx.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}

import { useEffect, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import DashboardCard from "../../components/dashboard/DashboardCard";
import { PageError, PageLoading } from "../../components/common/PageStates";
import {
  createExpense,
  getExpenseCategories,
  getNetProfitSummary,
  listExpenses,
} from "../../services/extendedService";
import type { Expense } from "../../services/extendedService";
import { fmt } from "../../utils/fmt";
import { useToast } from "../../context/ToastContext";

export default function ExpensesPage() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [net, setNet] = useState<{
    gross_profit: string;
    total_expenses: string;
    net_profit: string;
    available_profit: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("");
  const [fundingSource, setFundingSource] = useState<"PROFIT" | "CAPITAL">("PROFIT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [ex, cats, n] = await Promise.all([
        listExpenses(),
        getExpenseCategories(),
        getNetProfitSummary(),
      ]);
      setExpenses(ex);
      setCategories(cats);
      setNet(n);
      if (cats.length) setCategory(cats[0]);
    } catch {
      setError("Failed to load expenses.");
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
      await createExpense({
        category,
        amount: parsed.toFixed(2),
        description: description.trim() || undefined,
        funding_source: fundingSource,
      });
      setAmount("");
      setDescription("");
      setShowForm(false);
      await load();
      toast.success("Expense recorded.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : "Failed to record expense.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading expenses..." />
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
            <h1 className="text-2xl font-bold">Expenses</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Business expenses deducted from profit</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white"
          >
            Add Expense
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <DashboardCard title="Total Expenses" value={fmt(net?.total_expenses)} />
          <DashboardCard title="Gross Profit" value={fmt(net?.gross_profit)} />
          <DashboardCard title="Net Profit" value={fmt(net?.net_profit)} />
        </div>

        {showForm && (
          <div className="surface-card p-6 max-w-md">
            <h2 className="section-title">Record Expense</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Pay from</label>
                <select
                  value={fundingSource}
                  onChange={(e) =>
                    setFundingSource(e.target.value as "PROFIT" | "CAPITAL")
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="PROFIT">Profit account</option>
                  <option value="CAPITAL">Capital account</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Amount</label>
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
                <label className="block text-sm font-medium">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="table-shell">
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map((ex) => (
                <tr key={ex.id}>
                  <td className="px-4 py-3">{new Date(ex.created_at).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">{ex.category}</td>
                  <td className="px-4 py-3">
                    {ex.funding_source === "CAPITAL" ? "Capital" : "Profit"}
                  </td>
                  <td className="px-4 py-3 font-medium">{fmt(ex.amount)}</td>
                  <td className="px-4 py-3">{ex.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}

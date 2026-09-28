import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import DashboardCard from "../../components/dashboard/DashboardCard";
import { PageError, PageLoading } from "../../components/common/PageStates";
import ScrollableTable from "../../components/common/ScrollableTable";
import { useToast } from "../../context/ToastContext";
import {
  getOwnerAccountSummary,
  getOwnerAccountTransactions,
  moveOwnerPrincipalToCapital,
  reinvestOwnerProfit,
  withdrawOwnerCash,
  withdrawOwnerProfit,
} from "../../services/ownerAccountService";
import type {
  OwnerAccountSummary,
  OwnerAccountTransaction,
} from "../../types/ownerAccount";
import { fmt } from "../../utils/fmt";

type ActionKind =
  | "move-capital"
  | "withdraw-profit"
  | "reinvest-profit"
  | "withdraw-cash"
  | null;

function typeLabel(type: string) {
  return type.replace(/_/g, " ");
}

export default function OwnerAccountPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<OwnerAccountSummary | null>(null);
  const [transactions, setTransactions] = useState<OwnerAccountTransaction[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<ActionKind>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError("");
      // Summary first so Owner Account bootstrap commits before ledger fetch.
      const s = await getOwnerAccountSummary();
      const txs = await getOwnerAccountTransactions();
      setSummary(s);
      setTransactions(txs);
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { detail?: string } };
        code?: string;
        message?: string;
      };
      const status = ax.response?.status;
      const detail = ax.response?.data?.detail;
      if (status === 404) {
        setError(
          "Owner Account API is not available on the server yet. Pull to refresh or try again in a minute."
        );
      } else if (status === 401) {
        setError("Session expired. Please log in again.");
      } else if (!ax.response && (ax.code === "ECONNABORTED" || /timeout/i.test(ax.message || ""))) {
        setError("Server took too long to respond. Tap Retry (cold start can be slow).");
      } else if (typeof detail === "string" && detail.trim()) {
        setError(detail);
      } else {
        setError("Failed to load Owner Account. Check your connection and tap Retry.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAction(kind: ActionKind, preset?: string) {
    setAction(kind);
    setAmount(preset || "");
    setDescription("");
    setFormError("");
  }

  async function submitAction(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      setFormError("Enter a valid amount greater than zero.");
      return;
    }
    const value = parsed.toFixed(2);
    const note = description.trim() || undefined;
    try {
      setSaving(true);
      setFormError("");
      let result;
      if (action === "move-capital") {
        result = await moveOwnerPrincipalToCapital(value, note);
        toast.success("Moved to Available Capital — you can lend this now.");
      } else if (action === "withdraw-profit") {
        result = await withdrawOwnerProfit(value, note);
        toast.success("Profit withdrawn from Owner Account.");
      } else if (action === "reinvest-profit") {
        result = await reinvestOwnerProfit(value, note);
        toast.success("Profit reinvested into Available Capital.");
      } else if (action === "withdraw-cash") {
        result = await withdrawOwnerCash(value, note);
        toast.success("Cash withdrawn from Owner Account.");
      } else {
        return;
      }
      setSummary(result.summary);
      setAction(null);
      setAmount("");
      setDescription("");
      const txs = await getOwnerAccountTransactions();
      setTransactions(txs);
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
        <PageLoading message="Loading Owner Account..." />
      </MainLayout>
    );
  }

  if (error || !summary) {
    return (
      <MainLayout>
        <PageError message={error || "Failed to load."} onRetry={load} />
      </MainLayout>
    );
  }

  const actionTitle =
    action === "move-capital"
      ? "Move principal to Available Capital"
      : action === "withdraw-profit"
        ? "Withdraw profit"
        : action === "reinvest-profit"
          ? "Reinvest profit to Available Capital"
          : action === "withdraw-cash"
            ? "Withdraw cash (principal)"
            : "";

  const maxHint =
    action === "move-capital" || action === "withdraw-cash"
      ? summary.principal_balance
      : action === "withdraw-profit" || action === "reinvest-profit"
        ? summary.profit_balance
        : "0";

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Owner Account
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              {summary.notes}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/agent-settlements")}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Review agent settlements
          </button>
        </div>

        {summary.over_lent_against_unsettled && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Available to lend is below zero because some loans were funded while
            cash was still with the agent. Approve settlements into this account,
            then move principal to Available Capital before new loans.
          </div>
        )}

        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Owner Account balances
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardCard
              title="Total in Owner Account"
              value={fmt(summary.total_balance)}
            />
            <DashboardCard
              title="Principal (can move to lend)"
              value={fmt(summary.principal_balance)}
            />
            <DashboardCard
              title="Profit (withdraw / reinvest)"
              value={fmt(summary.profit_balance)}
            />
            <DashboardCard
              title="Available to lend"
              value={fmt(summary.available_to_lend)}
              onClick={() => navigate("/capital")}
            />
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Still outside this account
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardCard
              title="With agents (unsettled)"
              value={fmt(summary.unsettled_with_agents)}
              onClick={() => navigate("/agent-settlements")}
            />
            <DashboardCard
              title="Principal with agents"
              value={fmt(summary.capital_with_agents)}
            />
            <DashboardCard
              title="Profit with agents"
              value={fmt(summary.profit_with_agents)}
            />
            <DashboardCard
              title="Currently lent"
              value={fmt(summary.capital_currently_lent)}
            />
          </div>
        </div>

        <div className="surface-card p-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Actions
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Settlement money sits here until you choose. Add Capital (pocket
            money) stays on the Capital page.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              disabled={Number(summary.principal_balance) <= 0}
              onClick={() =>
                openAction("move-capital", summary.principal_balance)
              }
              className="rounded-lg bg-blue-700 px-4 py-3 text-left text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Move to Available Capital
              <span className="mt-1 block text-xs font-normal text-blue-100">
                Unlock principal for new loans
              </span>
            </button>
            <button
              type="button"
              disabled={Number(summary.profit_balance) <= 0}
              onClick={() =>
                openAction("reinvest-profit", summary.profit_balance)
              }
              className="rounded-lg border border-blue-700 px-4 py-3 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300"
            >
              Reinvest profit
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Add profit into lendable capital
              </span>
            </button>
            <button
              type="button"
              disabled={Number(summary.profit_balance) <= 0}
              onClick={() =>
                openAction("withdraw-profit", summary.profit_balance)
              }
              className="rounded-lg border px-4 py-3 text-left text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
            >
              Withdraw profit
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Take profit out of the business
              </span>
            </button>
            <button
              type="button"
              disabled={Number(summary.principal_balance) <= 0}
              onClick={() =>
                openAction("withdraw-cash", summary.principal_balance)
              }
              className="rounded-lg border border-red-300 px-4 py-3 text-left text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
            >
              Withdraw cash
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Draw principal out of business
              </span>
            </button>
          </div>

          {action && (
            <form
              onSubmit={submitAction}
              className="mt-5 space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700"
            >
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {actionTitle}
              </h3>
              <p className="text-xs text-slate-500">Max available: {fmt(maxHint)}</p>
              <div>
                <label className="block text-sm font-medium">Amount (INR)</label>
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
                <label className="block text-sm font-medium">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Confirm"}
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
          )}
        </div>

        <div className="surface-card overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Owner Account ledger
            </h2>
          </div>
          <ScrollableTable>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Principal</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No Owner Account movements yet. Approve an agent
                      settlement to credit this account.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const sign = tx.direction === "CREDIT" ? "+" : "−";
                    return (
                      <tr key={tx.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">{typeLabel(tx.type)}</td>
                        <td className="px-4 py-3">{tx.description || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {sign}
                          {fmt(tx.principal_amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {sign}
                          {fmt(tx.profit_amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {sign}
                          {fmt(tx.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </div>
    </MainLayout>
  );
}

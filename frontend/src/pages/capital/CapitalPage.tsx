import { useEffect, useState } from "react";

import ScrollableTable from "../../components/common/ScrollableTable";
import MainLayout from "../../components/layout/MainLayout";
import DashboardCard from "../../components/dashboard/DashboardCard";
import { PageError, PageLoading } from "../../components/common/PageStates";
import ConfirmModal from "../../components/common/ConfirmModal";
import {
  addCapital,
  applySettlementRecycleRepair,
  getCapitalSummary,
  getCapitalTransactions,
  previewSettlementRecycleRepair,
} from "../../services/capitalService";
import { withdrawCapital } from "../../services/extendedService";
import type {
  CapitalRepairPreview,
  CapitalSummary,
  CapitalTransaction,
} from "../../types/capital";
import { fmt } from "../../utils/fmt";
import { useToast } from "../../context/ToastContext";

function formatType(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDirection(direction: string, amount: string): string {
  const prefix = direction === "CREDIT" ? "+" : "-";
  return `${prefix}${fmt(amount)}`;
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
  const [confirmRecycle, setConfirmRecycle] = useState(false);
  const [repairPreview, setRepairPreview] = useState<CapitalRepairPreview | null>(
    null
  );
  const [showRepairConfirm, setShowRepairConfirm] = useState(false);
  const [repairing, setRepairing] = useState(false);

  async function loadCapital() {
    try {
      setLoading(true);
      setError("");
      const [summaryData, transactionData, repair] = await Promise.all([
        getCapitalSummary(),
        getCapitalTransactions(),
        previewSettlementRecycleRepair().catch(() => null),
      ]);
      setSummary(summaryData);
      setTransactions(transactionData.transactions);
      setRepairPreview(repair);
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
        confirm_settlement_recycle: confirmRecycle || undefined,
      });
      setAmount("");
      setDescription("");
      setConfirmRecycle(false);
      setShowForm(false);
      await loadCapital();
      toast.success("Capital added successfully.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      const message =
        typeof detail === "string" ? detail : "Failed to add capital.";
      setFormError(message);
      if (message.toLowerCase().includes("settlement")) {
        setConfirmRecycle(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function runRepair() {
    try {
      setRepairing(true);
      const result = await applySettlementRecycleRepair();
      setShowRepairConfirm(false);
      await loadCapital();
      toast.success(result.message || "Capital repair applied.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Repair failed.");
    } finally {
      setRepairing(false);
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

  const availableToLend =
    summary?.available_to_lend ?? summary?.available_capital ?? "0";

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Capital
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Available to lend excludes principal still with agents. Approve
              settlements to unlock — do not Add Capital for the same money.
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
                setConfirmRecycle(false);
                setShowForm(true);
              }}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Add Capital
            </button>
          </div>
        </div>

        {summary?.over_lent_against_unsettled && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Lending capacity is below unsettled agent principal. Approve agent
            settlements before creating new loans.
          </div>
        )}

        {repairPreview?.repair_needed && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
            <p className="font-semibold text-red-900 dark:text-red-100">
              Double-counted capital detected
            </p>
            <p className="mt-1 text-sm text-red-800 dark:text-red-200">
              {repairPreview.message}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-red-800 dark:text-red-200">
              {repairPreview.entries.map((e) => (
                <li key={e.capital_transaction_id}>
                  #{e.capital_transaction_id}: {fmt(e.amount)} —{" "}
                  {e.description || "Add Capital"}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowRepairConfirm(true)}
              className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Repair ₹{repairPreview.total_to_reverse} (safe for loans)
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="Available to lend" value={fmt(availableToLend)} />
          <DashboardCard
            title="Capital with agents"
            value={fmt(summary?.capital_with_agents ?? "0")}
          />
          <DashboardCard
            title="Profit with agents"
            value={fmt(summary?.profit_with_agents ?? "0")}
          />
          <DashboardCard
            title="Unsettled with agents"
            value={fmt(summary?.unsettled_with_agents ?? "0")}
          />
          <DashboardCard
            title="Total capital added"
            value={fmt(summary?.total_capital_added)}
          />
          <DashboardCard
            title="Currently lent"
            value={fmt(summary?.capital_currently_lent)}
          />
          <DashboardCard
            title="Ledger capital (book)"
            value={fmt(summary?.ledger_capital ?? summary?.available_capital)}
          />
          <DashboardCard
            title="Ledger entries"
            value={summary?.transaction_count ?? 0}
          />
        </div>

        {showWithdraw && (
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Withdraw Capital
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Only from Available to lend. Cannot withdraw money still with
              agents.
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Add Capital
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Use only for <strong>new external money</strong>. Agent settlement
              approval already unlocks collected principal — do not add the same
              amount again.
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
                  placeholder="External capital / finance approval"
                />
              </div>
              {formError && (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">{formError}</p>
                  {formError.toLowerCase().includes("settlement") && (
                    <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={confirmRecycle}
                        onChange={(e) => setConfirmRecycle(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        I confirm this is brand-new external capital, not the
                        settlement I just approved. Allow Add Capital.
                      </span>
                    </label>
                  )}
                </div>
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
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="surface-card overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-gray-900 dark:text-slate-100">
              Capital ledger
            </h2>
          </div>
          <ScrollableTable>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Ledger after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{formatType(tx.type)}</td>
                    <td className="px-4 py-3">{tx.description || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatDirection(tx.direction, tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmt(tx.balance_after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </div>

      {showRepairConfirm && repairPreview && (
        <ConfirmModal
          title="Repair double-counted capital?"
          message={`This reverses ₹${repairPreview.total_to_reverse} of Add Capital that recycled approved settlements. Loans, customers, payments, and agent wallets are not changed.`}
          confirmLabel="Apply repair"
          confirmClass="bg-red-700 hover:bg-red-800"
          loading={repairing}
          onConfirm={runRepair}
          onCancel={() => setShowRepairConfirm(false)}
        />
      )}
    </MainLayout>
  );
}

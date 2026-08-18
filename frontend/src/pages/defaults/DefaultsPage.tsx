import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import { useToast } from "../../context/ToastContext";
import { PageError, PageLoading } from "../../components/common/PageStates";
import {
  getOverdueLoans,
  markLoanDefaulted,
  writeOffLoan,
} from "../../services/extendedService";
import type { OverdueLoan } from "../../services/extendedService";
import { fmt } from "../../utils/fmt";

export default function DefaultsPage() {
  const toast = useToast();
  const [overdue, setOverdue] = useState<OverdueLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoanId, setActionLoanId] = useState<number | null>(null);
  const [recovered, setRecovered] = useState("0");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError("");
      setOverdue(await getOverdueLoans());
    } catch {
      setError("Failed to load overdue loans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDefault(loanId: number) {
    try {
      setSaving(true);
      await markLoanDefaulted(loanId, reason || undefined);
      toast.success("Loan marked as defaulted.");
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to mark defaulted.");
    } finally {
      setSaving(false);
    }
  }

  async function handleWriteOff(e: React.FormEvent) {
    e.preventDefault();
    if (!actionLoanId) return;
    try {
      setSaving(true);
      setFormError("");
      await writeOffLoan(actionLoanId, recovered || "0", reason || undefined);
      setActionLoanId(null);
      setRecovered("0");
      setReason("");
      toast.success("Loan written off.");
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : "Write-off failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading defaults..." />
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
          <h1 className="text-2xl font-bold">Defaults & Write-offs</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Overdue daily-collection loans and recovery actions</p>
        </div>

        {actionLoanId && (
          <div className="surface-card p-6 max-w-md">
            <h2 className="section-title">Write off loan #{actionLoanId}</h2>
            <form onSubmit={handleWriteOff} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Amount recovered</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={recovered}
                  onChange={(e) => setRecovered(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white">
                  Confirm write-off
                </button>
                <button type="button" onClick={() => setActionLoanId(null)} className="rounded-lg border px-4 py-2 text-sm">
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
                <th className="px-4 py-3 text-left">Loan</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Overdue date</th>
                <th className="px-4 py-3 text-left">Pending</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {overdue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                    No overdue schedule entries.
                  </td>
                </tr>
              ) : (
                overdue.map((row) => (
                  <tr key={`${row.loan_id}-${row.schedule_date}`}>
                    <td className="px-4 py-3">
                      <Link to={`/loans/${row.loan_id}`} className="text-blue-700 hover:underline">
                        #{row.loan_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.customer_name}</td>
                    <td className="px-4 py-3">{row.schedule_date}</td>
                    <td className="px-4 py-3 font-medium">{fmt(row.pending_amount)}</td>
                    <td className="px-4 py-3 space-x-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleDefault(row.loan_id)}
                        className="text-sm text-amber-700 hover:underline"
                      >
                        Mark defaulted
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionLoanId(row.loan_id)}
                        className="text-sm text-red-700 hover:underline"
                      >
                        Write off
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}

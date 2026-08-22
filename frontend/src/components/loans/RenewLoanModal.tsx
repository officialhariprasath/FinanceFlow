import { useState } from "react";
import { renewLoan } from "../../services/renewalService";
import type { LoanResponse } from "../../types/loan";
import type { LoanRenewalCreate } from "../../types/renewal";

interface Props {
  loan: LoanResponse;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RenewLoanModal({ loan, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<LoanRenewalCreate>({
    renewal_type: "CONTINUE",
    new_due_date: "",
    interest_method: loan.interest_method as "PERCENTAGE" | "RUPEES_PER_100",
    interest_rate: loan.interest_rate,
    remarks: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.new_due_date) e.new_due_date = "New due date is required.";
    if (!form.interest_rate || Number(form.interest_rate) <= 0)
      e.interest_rate = "Enter a valid interest rate.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSaving(true);
      setApiError("");
      await renewLoan(loan.id, form);
      onSuccess();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setApiError(typeof detail === "string" ? detail : "Failed to renew loan.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (k: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[k] ? "border-red-400" : "border-slate-300"}`;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-md">
        <h2 className="mb-2 text-xl font-semibold text-slate-800 dark:text-slate-100">Renew Loan #{loan.id}</h2>
        <p className="mb-4 text-sm text-slate-500">
          Current due date: <strong>{loan.due_date}</strong> · Rate: <strong>{loan.interest_rate}</strong>
        </p>

        {apiError && (
          <div className="mb-4 rounded-lg alert-error border p-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Renewal Type</label>
            <select
              value={form.renewal_type}
              onChange={(e) => setForm({ ...form, renewal_type: e.target.value as "CONTINUE" | "CAPITALIZE" })}
              className={inputCls("renewal_type")}
            >
              <option value="CONTINUE">Continue (same loan, updated terms)</option>
              <option value="CAPITALIZE">Capitalize (add interest to principal, new loan)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {form.renewal_type === "CONTINUE"
                ? "The existing loan continues with updated due date and interest terms."
                : "Outstanding interest is added to the principal and a new loan is created."}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New Due Date</label>
            <input
              type="date"
              value={form.new_due_date}
              onChange={(e) => setForm({ ...form, new_due_date: e.target.value })}
              className={inputCls("new_due_date")}
            />
            {errors.new_due_date && <p className="mt-1 text-xs text-red-600">{errors.new_due_date}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Interest Method</label>
            <select
              value={form.interest_method}
              onChange={(e) => setForm({ ...form, interest_method: e.target.value as "PERCENTAGE" | "RUPEES_PER_100" })}
              className={inputCls("interest_method")}
            >
              <option value="PERCENTAGE">Percentage (% per month)</option>
              <option value="RUPEES_PER_100">Rupees per ₹100 per month</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Interest Rate</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.interest_rate}
              onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
              className={inputCls("interest_rate")}
            />
            {errors.interest_rate && <p className="mt-1 text-xs text-red-600">{errors.interest_rate}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Remarks (optional)</label>
            <input
              type="text"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Optional renewal note"
              className={inputCls("remarks")}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {saving ? "Renewing..." : "Renew Loan"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

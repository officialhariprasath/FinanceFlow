import { useEffect, useState } from "react";
import { updateLoan } from "../../services/loanService";
import type { LoanResponse, LoanUpdate } from "../../types/loan";
import { useToast } from "../../context/ToastContext";
import { fmt } from "../../utils/fmt";

interface Props {
  loan: LoanResponse;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditLoanModal({ loan, onClose, onSuccess }: Props) {
  const toast = useToast();
  const isInstallment = loan.collection_model === "DAILY_COLLECTION";

  const [interestMethod, setInterestMethod] = useState(loan.interest_method);
  const [interestRate, setInterestRate] = useState(loan.interest_rate);
  const [dueDate, setDueDate] = useState(loan.due_date);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    setInterestMethod(loan.interest_method);
    setInterestRate(loan.interest_rate);
    setDueDate(loan.due_date);
    setErrors({});
    setApiError("");
  }, [loan]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!dueDate) next.due_date = "Due date is required.";
    if (!isInstallment) {
      if (!interestMethod) next.interest_method = "Interest method is required.";
      if (!interestRate || Number(interestRate) <= 0) {
        next.interest_rate = "Enter a valid interest rate.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: LoanUpdate = {
      interest_method: isInstallment ? loan.interest_method : interestMethod,
      interest_rate: isInstallment ? loan.interest_rate : interestRate,
      due_date: dueDate,
    };

    try {
      setSaving(true);
      setApiError("");
      await updateLoan(loan.id, payload);
      toast.success("Loan updated.");
      onSuccess();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setApiError(typeof detail === "string" ? detail : "Failed to update loan.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (key: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors[key] ? "border-red-400" : "border-slate-300 dark:border-slate-600"
    }`;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-h-[90vh] max-w-lg overflow-y-auto">
        <h2 className="mb-1 text-xl font-semibold text-slate-800 dark:text-slate-100">
          Edit Loan #{loan.id}
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Update terms that are safe to change after disbursement. Principal and
          installment schedule stay locked.
        </p>

        {apiError && (
          <div className="mb-4 rounded-lg alert-error border p-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
          <div>
            <p className="text-xs text-slate-500">Principal</p>
            <p className="font-medium">{fmt(loan.principal_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Remaining</p>
            <p className="font-medium">{fmt(loan.remaining_principal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Issue date</p>
            <p className="font-medium">{loan.issue_date}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Model</p>
            <p className="font-medium">
              {isInstallment
                ? (loan.collection_frequency ?? "DAILY").replace(/_/g, " ")
                : "Standard"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!isInstallment ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Interest method
                </label>
                <select
                  value={interestMethod}
                  onChange={(e) => setInterestMethod(e.target.value)}
                  className={inputCls("interest_method")}
                >
                  <option value="PERCENTAGE">Percentage / month</option>
                  <option value="RUPEES_PER_100">₹ per ₹100</option>
                </select>
                {errors.interest_method && (
                  <p className="mt-1 text-xs text-red-600">{errors.interest_method}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Interest rate
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className={inputCls("interest_rate")}
                />
                {errors.interest_rate && (
                  <p className="mt-1 text-xs text-red-600">{errors.interest_rate}</p>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              Installment amount ({fmt(loan.daily_payment ?? "0")}) and schedule
              cannot be edited here — they stay as created.
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls("due_date")}
            />
            {errors.due_date && (
              <p className="mt-1 text-xs text-red-600">{errors.due_date}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

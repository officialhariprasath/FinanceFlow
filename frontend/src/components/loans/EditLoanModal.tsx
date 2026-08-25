import { useEffect, useMemo, useState } from "react";
import { updateLoan } from "../../services/loanService";
import { getLoanPayments } from "../../services/paymentService";
import type { LoanResponse, LoanUpdate } from "../../types/loan";
import { useToast } from "../../context/ToastContext";
import { fmt } from "../../utils/fmt";
import {
  calculateInstallmentLoanTerms,
  dueDateFromStart,
  FREQUENCY_COUNT_LABELS,
  FREQUENCY_LABELS,
  type CollectionFrequency,
} from "../../utils/loanCalc";

interface Props {
  loan: LoanResponse;
  onClose: () => void;
  onSuccess: () => void;
}

const FREQUENCIES: CollectionFrequency[] = [
  "DAILY",
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
];

function interestPercentFromLoan(loan: LoanResponse): string {
  const principal = Number(loan.principal_amount) || 0;
  const count = Number(loan.installment_count) || 0;
  const totalProfit = Number(loan.total_expected_profit) || 0;
  if (principal > 0 && totalProfit > 0) {
    return ((totalProfit / principal) * 100).toFixed(2).replace(/\.00$/, "");
  }
  if (principal > 0 && count > 0) {
    const per = Number(loan.daily_profit) || 0;
    return (((per * count) / principal) * 100).toFixed(2).replace(/\.00$/, "");
  }
  return "20";
}

export default function EditLoanModal({ loan, onClose, onSuccess }: Props) {
  const toast = useToast();
  const isInstallment = loan.collection_model === "DAILY_COLLECTION";

  const [checking, setChecking] = useState(isInstallment);
  const [canRebuildTerms, setCanRebuildTerms] = useState(!isInstallment);

  const [interestMethod, setInterestMethod] = useState(loan.interest_method);
  const [interestRate, setInterestRate] = useState(loan.interest_rate);
  const [dueDate, setDueDate] = useState(loan.due_date);

  const [frequency, setFrequency] = useState<CollectionFrequency>(
    (loan.collection_frequency as CollectionFrequency) || "DAILY"
  );
  const [interestPercent, setInterestPercent] = useState(
    interestPercentFromLoan(loan)
  );
  const [installmentCount, setInstallmentCount] = useState(
    String(loan.installment_count ?? 100)
  );
  const [dueStartDate, setDueStartDate] = useState(
    loan.due_start_date ?? loan.issue_date
  );

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");

  const terms = useMemo(() => {
    const principal = Number(loan.principal_amount) || 0;
    const interest = Number(interestPercent) || 0;
    const count = Number(installmentCount) || 0;
    if (principal <= 0 || interest <= 0 || count <= 0) return null;
    return calculateInstallmentLoanTerms(principal, interest, count);
  }, [loan.principal_amount, interestPercent, installmentCount]);

  const computedDueDate = useMemo(() => {
    if (!isInstallment || !canRebuildTerms) return dueDate;
    const count = Number(installmentCount) || 0;
    if (!dueStartDate || count <= 0) return dueDate;
    return dueDateFromStart(dueStartDate, frequency, count);
  }, [
    isInstallment,
    canRebuildTerms,
    dueStartDate,
    frequency,
    installmentCount,
    dueDate,
  ]);

  useEffect(() => {
    setInterestMethod(loan.interest_method);
    setInterestRate(loan.interest_rate);
    setDueDate(loan.due_date);
    setFrequency((loan.collection_frequency as CollectionFrequency) || "DAILY");
    setInterestPercent(interestPercentFromLoan(loan));
    setInstallmentCount(String(loan.installment_count ?? 100));
    setDueStartDate(loan.due_start_date ?? loan.issue_date);
    setErrors({});
    setApiError("");

    if (!isInstallment) {
      setCanRebuildTerms(true);
      setChecking(false);
      return;
    }

    setChecking(true);
    getLoanPayments(loan.id)
      .then((payments) => {
        setCanRebuildTerms(payments.length === 0);
      })
      .catch(() => setCanRebuildTerms(false))
      .finally(() => setChecking(false));
  }, [loan, isInstallment]);

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (isInstallment && canRebuildTerms) {
      if (!FREQUENCIES.includes(frequency)) {
        next.frequency = "Select a frequency.";
      }
      if (!interestPercent || Number(interestPercent) <= 0) {
        next.interest_percent = "Enter a valid interest %.";
      }
      if (!installmentCount || Number(installmentCount) <= 0) {
        next.installment_count = "Enter installment count.";
      }
      if (!dueStartDate) next.due_start_date = "First collection date is required.";
      else if (dueStartDate < loan.issue_date) {
        next.due_start_date = "Cannot be before issue date.";
      }
      if (!terms) next.terms = "Could not calculate installment terms.";
    } else if (!isInstallment) {
      if (!interestMethod) next.interest_method = "Interest method is required.";
      if (!interestRate || Number(interestRate) <= 0) {
        next.interest_rate = "Enter a valid interest rate.";
      }
      if (!dueDate) next.due_date = "Due date is required.";
      else if (dueDate <= loan.issue_date) {
        next.due_date = "Due date must be after issue date.";
      }
    } else if (!dueDate) {
      next.due_date = "Due date is required.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    let payload: LoanUpdate;

    if (isInstallment && canRebuildTerms && terms) {
      payload = {
        interest_method: "DAILY_COLLECTION",
        interest_rate: "0",
        due_date: computedDueDate,
        collection_frequency: frequency,
        installment_count: Number(installmentCount),
        due_start_date: dueStartDate,
        daily_payment: terms.installmentAmount.toFixed(2),
        daily_principal: terms.installmentPrincipal.toFixed(2),
        daily_profit: terms.installmentProfit.toFixed(2),
      };
    } else if (isInstallment) {
      payload = {
        interest_method: loan.interest_method,
        interest_rate: loan.interest_rate,
        due_date: dueDate,
      };
    } else {
      payload = {
        interest_method: interestMethod,
        interest_rate: interestRate,
        due_date: dueDate,
      };
    }

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
          Customer, principal, and issue date stay locked (capital already
          disbursed).{" "}
          {isInstallment
            ? canRebuildTerms
              ? "No collections yet — you can rebuild installment terms like New Loan."
              : "Collections already recorded — only due date can change."
            : "Update interest terms and due date."}
        </p>

        {apiError && (
          <div className="mb-4 rounded-lg alert-error border p-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
          <div>
            <p className="text-xs text-slate-500">Principal (locked)</p>
            <p className="font-medium">{fmt(loan.principal_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Remaining</p>
            <p className="font-medium">{fmt(loan.remaining_principal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Issue date (locked)</p>
            <p className="font-medium">{loan.issue_date}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Model (locked)</p>
            <p className="font-medium">
              {isInstallment
                ? (loan.collection_frequency ?? "DAILY").replace(/_/g, " ")
                : "Standard"}
            </p>
          </div>
        </div>

        {checking ? (
          <p className="text-sm text-slate-500">Checking collection history...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isInstallment && canRebuildTerms ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Collection frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as CollectionFrequency)
                    }
                    className={inputCls("frequency")}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {FREQUENCY_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Interest %
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={interestPercent}
                      onChange={(e) => setInterestPercent(e.target.value)}
                      className={inputCls("interest_percent")}
                    />
                    {errors.interest_percent && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.interest_percent}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      {FREQUENCY_COUNT_LABELS[frequency]}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                      className={inputCls("installment_count")}
                    />
                    {errors.installment_count && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.installment_count}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    First collection date
                  </label>
                  <input
                    type="date"
                    value={dueStartDate}
                    min={loan.issue_date}
                    onChange={(e) => setDueStartDate(e.target.value)}
                    className={inputCls("due_start_date")}
                  />
                  {errors.due_start_date && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.due_start_date}
                    </p>
                  )}
                </div>

                {terms && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
                    <div>
                      <p className="text-xs text-slate-500">Installment</p>
                      <p className="font-semibold">
                        {fmt(terms.installmentAmount.toFixed(2))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total profit</p>
                      <p className="font-semibold">
                        {fmt(terms.totalProfit.toFixed(2))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Final due</p>
                      <p className="font-semibold">{computedDueDate}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Saving rebuilds the full unpaid schedule from these terms.
                </p>
              </>
            ) : !isInstallment ? (
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
              </>
            ) : (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  Payments already exist on this loan, so frequency / installment
                  amount / schedule stay locked to keep collections correct.
                </div>
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
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || checking}
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
        )}
      </div>
    </div>
  );
}

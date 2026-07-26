import { useState } from "react";
import { createPayment } from "../../services/paymentService";
import type { PaymentCreate } from "../../types/payment";

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];

interface Props {
  loanId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordPaymentModal({ loanId, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<PaymentCreate>({
    loan_id: loanId,
    payment_date: new Date().toISOString().split("T")[0],
    amount_paid: "",
    payment_mode: "Cash",
    remarks: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.amount_paid || Number(form.amount_paid) <= 0)
      e.amount_paid = "Enter a valid payment amount.";
    if (!form.payment_date) e.payment_date = "Payment date is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSaving(true);
      setApiError("");
      await createPayment(form);
      onSuccess();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setApiError(typeof detail === "string" ? detail : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (k: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[k] ? "border-red-400" : "border-slate-300"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-xl font-semibold text-slate-800">Record Payment</h2>
        <p className="mb-4 text-sm text-slate-500">
          The backend will automatically allocate interest first, then reduce principal.
        </p>

        {apiError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Payment Date</label>
            <input
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
              className={inputCls("payment_date")}
            />
            {errors.payment_date && <p className="mt-1 text-xs text-red-600">{errors.payment_date}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount Received (₹)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount_paid}
              onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
              placeholder="Enter amount received"
              className={inputCls("amount_paid")}
            />
            {errors.amount_paid && <p className="mt-1 text-xs text-red-600">{errors.amount_paid}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Payment Mode</label>
            <select
              value={form.payment_mode}
              onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
              className={inputCls("payment_mode")}
            >
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Remarks (optional)</label>
            <input
              type="text"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Optional note"
              className={inputCls("remarks")}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Recording..." : "Record Payment"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

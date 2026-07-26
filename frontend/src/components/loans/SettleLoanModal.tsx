import { useEffect, useState } from "react";
import { getSettlementPreview, settleLoan } from "../../services/loanService";
import type { LoanResponse, SettlementPreviewResponse } from "../../types/loan";
import { fmt } from "../../utils/fmt";

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];

interface Props {
  loan: LoanResponse;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SettleLoanModal({ loan, onClose, onSuccess }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [settlementDate, setSettlementDate] = useState(today);
  const [preview, setPreview] = useState<SettlementPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [settlementAmount, setSettlementAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    loadPreview();
  }, [settlementDate]);

  async function loadPreview() {
    try {
      setPreviewLoading(true);
      const data = await getSettlementPreview(loan.id, settlementDate);
      setPreview(data);
      setSettlementAmount(data.total_outstanding);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!settlementAmount || Number(settlementAmount) <= 0) return;
    try {
      setSaving(true);
      setApiError("");
      await settleLoan(loan.id, {
        settlement_amount: settlementAmount,
        settlement_date: settlementDate,
        payment_mode: paymentMode,
        settlement_reason: reason || undefined,
      });
      onSuccess();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setApiError(typeof detail === "string" ? detail : "Failed to settle loan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-xl font-semibold text-slate-800">Settle Loan #{loan.id}</h2>
        <p className="mb-4 text-sm text-slate-500">
          Settlement closes the loan. Any waived amount will be recorded.
        </p>

        {apiError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSettle} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Settlement Date</label>
            <input
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {previewLoading ? (
            <p className="text-sm text-slate-500">Calculating outstanding...</p>
          ) : preview ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Principal</p>
                  <p className="font-semibold">{fmt(preview.principal_outstanding)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Interest</p>
                  <p className="font-semibold text-amber-600">{fmt(preview.interest_outstanding)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Due</p>
                  <p className="font-semibold text-red-600">{fmt(preview.total_outstanding)}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Settlement Amount (₹)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={settlementAmount}
              onChange={(e) => setSettlementAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {preview && settlementAmount && Number(settlementAmount) < Number(preview.total_outstanding) && (
              <p className="mt-1 text-xs text-amber-600">
                Waived: {fmt(String(Number(preview.total_outstanding) - Number(settlementAmount)))}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Settlement Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer requested early closure"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !settlementAmount}
              className="rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Settling..." : "Confirm Settlement"}
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

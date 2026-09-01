import { useEffect, useMemo, useRef, useState } from "react";
import { createPayment, previewPayment } from "../../services/paymentService";
import { getUnpaidSchedules } from "../../services/loanService";
import { useAuth } from "../../context/AuthContext";
import type { PaymentCreate } from "../../types/payment";
import type { UnpaidSchedule } from "../../types/loan";
import { fmt } from "../../utils/fmt";
import { useToast } from "../../context/ToastContext";

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];

interface Props {
  loanId: number;
  onClose: () => void;
  onSuccess: () => void;
  collectionModel?: string;
  defaultAmount?: string;
  defaultScheduleDate?: string;
}

type PreviewLine = {
  schedule_date: string;
  expected_pending: string;
  applied_amount: string;
  remaining_pending: string;
  status_after: string;
};

type Preview = {
  principal_amount: string;
  profit_amount: string;
  total_amount: string;
  installment_count?: number;
  unapplied_amount?: string;
  lines?: PreviewLine[];
};

function formatScheduleLabel(row: UnpaidSchedule): string {
  const date = new Date(row.schedule_date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const tag = row.is_today
    ? " · Today"
    : row.is_future
      ? " · Advance"
      : row.status === "OVERDUE"
        ? " · Overdue"
        : row.status === "PARTIAL"
          ? " · Partial"
          : "";
  return `${date} — ${fmt(row.pending_amount)}${tag}`;
}

function formatShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function sumPending(rows: UnpaidSchedule[], dates: string[]): number {
  return rows
    .filter((r) => dates.includes(r.schedule_date))
    .reduce((sum, r) => sum + Number(r.pending_amount), 0);
}

export default function RecordPaymentModal({
  loanId,
  onClose,
  onSuccess,
  collectionModel = "STANDARD",
  defaultAmount = "",
  defaultScheduleDate = "",
}: Props) {
  const { session } = useAuth();
  const toast = useToast();
  const isAgent = session && !session.is_owner;
  const isInstallment = collectionModel === "DAILY_COLLECTION";

  const today = new Date().toISOString().split("T")[0];
  const [unpaidSchedules, setUnpaidSchedules] = useState<UnpaidSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(isInstallment);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  const [form, setForm] = useState<PaymentCreate>({
    loan_id: loanId,
    payment_date: defaultScheduleDate || today,
    amount_paid: defaultAmount,
    payment_mode: "Cash",
    remarks: "",
    payment_reference: "",
  });

  const [preview, setPreview] = useState<Preview | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  const selectedTotal = useMemo(
    () => sumPending(unpaidSchedules, selectedDates),
    [unpaidSchedules, selectedDates]
  );

  const amountNum = Number(form.amount_paid) || 0;
  const isPartial =
    isInstallment &&
    selectedDates.length > 0 &&
    amountNum > 0 &&
    amountNum + 0.001 < selectedTotal;
  const isAdvance =
    isInstallment &&
    selectedDates.length > 0 &&
    amountNum > selectedTotal + 0.01;

  const prevSelectedTotal = useRef(0);

  useEffect(() => {
    if (!isInstallment) return;
    setSchedulesLoading(true);
    getUnpaidSchedules(loanId)
      .then((rows) => {
        setUnpaidSchedules(rows);
        if (rows.length === 0) return;

        const overdueDates = rows
          .filter((r) => r.status === "OVERDUE")
          .map((r) => r.schedule_date);
        const todayDate = rows.find((r) => r.is_today)?.schedule_date;

        let initial: string[];
        if (overdueDates.length > 0) {
          initial = todayDate ? [...overdueDates, todayDate] : [...overdueDates];
        } else if (
          defaultScheduleDate &&
          rows.some((r) => r.schedule_date === defaultScheduleDate)
        ) {
          initial = [defaultScheduleDate];
        } else if (todayDate) {
          initial = [todayDate];
        } else {
          initial = [rows[0].schedule_date];
        }

        setSelectedDates(initial);
        const total = sumPending(rows, initial);
        setForm((prev) => ({
          ...prev,
          payment_date: initial[0],
          amount_paid: defaultAmount || total.toFixed(2),
        }));
      })
      .catch(() => setUnpaidSchedules([]))
      .finally(() => setSchedulesLoading(false));
  }, [loanId, isInstallment, defaultScheduleDate, defaultAmount]);

  useEffect(() => {
    if (!isInstallment || selectedDates.length === 0) return;
    setForm((prev) => {
      const amt = Number(prev.amount_paid) || 0;
      const wasSynced =
        !prev.amount_paid || Math.abs(amt - prevSelectedTotal.current) < 0.01;
      prevSelectedTotal.current = selectedTotal;
      return {
        ...prev,
        payment_date: selectedDates[0],
        amount_paid: wasSynced ? selectedTotal.toFixed(2) : prev.amount_paid,
        schedule_dates: selectedDates,
      };
    });
  }, [selectedDates, selectedTotal, isInstallment]);

  // Overpay spills to the next installment(s) automatically.
  useEffect(() => {
    if (!isInstallment || unpaidSchedules.length === 0 || selectedDates.length === 0) return;
    const target = Number(form.amount_paid);
    if (!target || target <= selectedTotal + 0.01) return;

    const anchor = selectedDates[0];
    const startIdx = unpaidSchedules.findIndex((r) => r.schedule_date >= anchor);
    if (startIdx < 0) return;

    let running = 0;
    const picked: string[] = [];
    for (let i = startIdx; i < unpaidSchedules.length; i++) {
      picked.push(unpaidSchedules[i].schedule_date);
      running += Number(unpaidSchedules[i].pending_amount);
      if (running >= target - 0.001) break;
    }

    const same =
      picked.length === selectedDates.length &&
      picked.every((d, i) => d === selectedDates[i]);
    if (!same) setSelectedDates(picked);
  }, [form.amount_paid, selectedTotal, unpaidSchedules, selectedDates, isInstallment]);

  useEffect(() => {
    if (!isInstallment || !form.amount_paid || Number(form.amount_paid) <= 0) {
      setPreview(null);
      return;
    }
    if (selectedDates.length === 0) {
      setPreview(null);
      return;
    }
    previewPayment(loanId, selectedDates[0], form.amount_paid, selectedDates)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [form.amount_paid, selectedDates, loanId, isInstallment]);

  function toggleDate(scheduleDate: string) {
    setSelectedDates((prev) =>
      prev.includes(scheduleDate)
        ? prev.filter((d) => d !== scheduleDate)
        : [...prev, scheduleDate].sort()
    );
  }

  function selectNext(count: number) {
    const dates = unpaidSchedules.slice(0, count).map((r) => r.schedule_date);
    setSelectedDates(dates);
  }

  function selectFromAmount() {
    const target = Number(form.amount_paid);
    if (!target || target <= 0) return;
    let running = 0;
    const picked: string[] = [];
    for (const row of unpaidSchedules) {
      const pending = Number(row.pending_amount);
      picked.push(row.schedule_date);
      running += pending;
      if (running >= target - 0.001) break;
    }
    if (picked.length > 0) setSelectedDates(picked);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.amount_paid || Number(form.amount_paid) <= 0)
      e.amount_paid = "Enter a valid payment amount.";
    if (isInstallment) {
      if (unpaidSchedules.length === 0)
        e.payment_date = "No unpaid installments on this loan.";
      else if (selectedDates.length === 0)
        e.payment_date = "Select at least one installment date.";
    } else if (!form.payment_date) {
      e.payment_date = "Payment date is required.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSaving(true);
      setApiError("");
      const payload: PaymentCreate = {
        ...form,
        payment_reference: form.payment_reference?.trim() || undefined,
        remarks: form.remarks?.trim() || undefined,
        ...(isInstallment && selectedDates.length > 0
          ? { schedule_dates: selectedDates, payment_date: selectedDates[0] }
          : {}),
      };
      await createPayment(payload);
      toast.success(isAgent ? "Collection recorded." : "Payment recorded.");
      onSuccess();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string | unknown } } })
        ?.response?.data?.detail;
      setApiError(typeof detail === "string" ? detail : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (k: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors[k] ? "border-red-400" : "border-slate-300"
    }`;

  const hasFutureSelected = selectedDates.some(
    (d) => unpaidSchedules.find((r) => r.schedule_date === d)?.is_future
  );

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-h-[90vh] max-w-lg overflow-y-auto">
        <h2 className="mb-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
          {isAgent ? "Confirm Collection" : "Record Payment"}
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          {isInstallment
            ? "Enter cash received. Less than due fills oldest days and leaves the rest pending. More than today spills to the next day(s) as advance."
            : "Interest is allocated first, then principal."}
        </p>

        {apiError && (
          <div className="mb-4 rounded-lg alert-error border p-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        {preview && isInstallment && (
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Allocation preview — {preview.installment_count ?? selectedDates.length}{" "}
              installment(s)
              {isPartial ? " (partial)" : isAdvance ? " (advance)" : ""}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-slate-500">Principal</p>
                <p className="font-semibold">{fmt(preview.principal_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Profit</p>
                <p className="font-semibold text-green-700">{fmt(preview.profit_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Applied</p>
                <p className="font-semibold">{fmt(preview.total_amount)}</p>
              </div>
            </div>
            {preview.lines && preview.lines.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-blue-100 pt-2 dark:border-blue-900">
                {preview.lines.map((line) => (
                  <li
                    key={line.schedule_date}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-blue-900 dark:text-blue-100"
                  >
                    <span className="font-medium">{formatShortDate(line.schedule_date)}</span>
                    <span>
                      {fmt(line.applied_amount)} of {fmt(line.expected_pending)}
                      {Number(line.remaining_pending) > 0.009 && (
                        <span className="text-amber-700 dark:text-amber-300">
                          {" "}
                          · {fmt(line.remaining_pending)} pending
                        </span>
                      )}
                      {line.status_after === "PAID" && (
                        <span className="text-green-700 dark:text-green-300"> · paid</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {isInstallment ? (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Installments to pay ({selectedDates.length} selected)
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => selectNext(5)}
                    className="rounded border px-2 py-0.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    Next 5
                  </button>
                  <button
                    type="button"
                    onClick={() => selectNext(10)}
                    className="rounded border px-2 py-0.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    Next 10
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDates(unpaidSchedules.map((r) => r.schedule_date))
                    }
                    className="rounded border px-2 py-0.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDates([])}
                    className="rounded border px-2 py-0.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {schedulesLoading ? (
                <p className="text-sm text-slate-500">Loading schedule...</p>
              ) : unpaidSchedules.length === 0 ? (
                <p className="text-sm text-amber-700">All installments are paid.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {unpaidSchedules.map((row) => (
                    <label
                      key={row.schedule_date}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDates.includes(row.schedule_date)}
                        onChange={() => toggleDate(row.schedule_date)}
                      />
                      <span>{formatScheduleLabel(row)}</span>
                    </label>
                  ))}
                </div>
              )}

              {hasFutureSelected && (
                <p className="mt-1 text-xs text-blue-700">
                  Advance payment — selected future dates will not show as due on those days.
                </p>
              )}
              {errors.payment_date && (
                <p className="mt-1 text-xs text-red-600">{errors.payment_date}</p>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Payment date
              </label>
              <input
                type="date"
                value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                className={inputCls("payment_date")}
              />
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Amount Received (₹)
              </label>
              {isInstallment && unpaidSchedules.length > 0 && (
                <button
                  type="button"
                  onClick={selectFromAmount}
                  className="text-xs text-blue-700 hover:underline"
                >
                  Match amount to installments
                </button>
              )}
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount_paid}
              onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
              className={inputCls("amount_paid")}
            />
            {isInstallment && selectedDates.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Selected total {fmt(selectedTotal.toFixed(2))}
                {isPartial
                  ? " — partial: fills earliest dates first, rest stays pending."
                  : isAdvance
                    ? " — advance: extra applies to the next day(s); preview shows split."
                    : " — you can pay less (partial) or more (advance)."}
              </p>
            )}
            {errors.amount_paid && (
              <p className="mt-1 text-xs text-red-600">{errors.amount_paid}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Payment Method
            </label>
            <div className="flex flex-wrap gap-3">
              {PAYMENT_MODES.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="payment_mode"
                    checked={form.payment_mode === m}
                    onChange={() => setForm({ ...form, payment_mode: m })}
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>

          {(form.payment_mode === "UPI" || form.payment_mode === "Bank Transfer") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Reference (optional)
              </label>
              <input
                type="text"
                value={form.payment_reference ?? ""}
                onChange={(e) => setForm({ ...form, payment_reference: e.target.value })}
                placeholder="UPI / bank txn no. (optional)"
                className={inputCls("payment_reference")}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Notes (optional)
            </label>
            <input
              type="text"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className={inputCls("remarks")}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={
                saving ||
                schedulesLoading ||
                (isInstallment &&
                  (unpaidSchedules.length === 0 || selectedDates.length === 0))
              }
              className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : isAgent ? "Confirm Collection" : "Record Payment"}
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

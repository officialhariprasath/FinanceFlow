import { useEffect, useMemo, useRef, useState } from "react";
import { createPayment, previewPayment } from "../../services/paymentService";
import { getUnpaidSchedules } from "../../services/loanService";
import { useAuth } from "../../context/AuthContext";
import type { AllocationMode, PaymentCreate } from "../../types/payment";
import type { UnpaidSchedule } from "../../types/loan";
import { fmt } from "../../utils/fmt";
import { useToast } from "../../context/ToastContext";

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];

const ALLOCATION_OPTIONS: { value: AllocationMode; label: string; hint: string }[] = [
  { value: "DUE_ONLY", label: "Due only", hint: "Collect installment only; leave penalty" },
  { value: "PENALTY_ONLY", label: "Penalty only", hint: "Collect penalty only; leave due" },
  { value: "BOTH", label: "Due + Penalty", hint: "Apply to installment then penalty" },
];

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
  due_applied?: string;
  penalty_applied?: string;
};

type Preview = {
  principal_amount: string;
  profit_amount: string;
  late_fee_amount?: string;
  total_amount: string;
  installment_count?: number;
  unapplied_amount?: string;
  allocation_mode?: string;
  lines?: PreviewLine[];
};

function rowDueOutstanding(row: UnpaidSchedule): number {
  if (row.installment_outstanding != null && row.installment_outstanding !== "") {
    return Number(row.installment_outstanding);
  }
  const total = Number(row.total_payable ?? row.pending_amount);
  const penalty = Number(row.penalty_outstanding ?? 0);
  return Math.max(total - penalty, 0);
}

function rowPenaltyOutstanding(row: UnpaidSchedule): number {
  return Number(row.penalty_outstanding ?? 0);
}

function rowModeAmount(row: UnpaidSchedule, mode: AllocationMode): number {
  if (mode === "DUE_ONLY") return rowDueOutstanding(row);
  if (mode === "PENALTY_ONLY") return rowPenaltyOutstanding(row);
  return Number(row.total_payable ?? row.pending_amount);
}

function formatShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function formatWeekdayDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function statusTag(row: UnpaidSchedule): string {
  if (row.is_today) return "Today";
  if (row.is_future) return "Advance";
  if (row.within_grace) return "Grace";
  if (row.status === "OVERDUE") return "Overdue";
  if (row.status === "PARTIAL") return "Partial";
  return row.status;
}

function sumPending(
  rows: UnpaidSchedule[],
  dates: string[],
  mode: AllocationMode
): number {
  return rows
    .filter((r) => dates.includes(r.schedule_date))
    .reduce((sum, r) => sum + rowModeAmount(r, mode), 0);
}

/** Earliest unpaid days whose mode totals cover `target` (or all if target is huge). */
function pickDatesForAmount(
  rows: UnpaidSchedule[],
  target: number,
  mode: AllocationMode
): string[] {
  if (!(target > 0)) return [];
  let running = 0;
  const picked: string[] = [];
  for (const row of rows) {
    const pending = rowModeAmount(row, mode);
    if (pending <= 0.009) continue;
    picked.push(row.schedule_date);
    running += pending;
    if (running >= target - 0.001) break;
  }
  return picked;
}

function ScheduleRowContent({
  row,
  selected,
  mode,
}: {
  row: UnpaidSchedule;
  selected: boolean;
  mode: AllocationMode;
}) {
  const due = rowDueOutstanding(row);
  const penalty = rowPenaltyOutstanding(row);
  const payable = Number(row.total_payable ?? row.pending_amount);

  // Color rules when selected:
  // BOTH → due + penalty both green
  // DUE_ONLY → due green, penalty orange
  // PENALTY_ONLY → penalty green, due orange (still pending)
  // Unselected → muted
  const dueClass = !selected
    ? "text-slate-700 dark:text-slate-200"
    : mode === "PENALTY_ONLY"
      ? "text-amber-700 dark:text-amber-300"
      : "text-green-700 dark:text-green-300";

  const penaltyClass = !selected
    ? "text-slate-700 dark:text-slate-200"
    : mode === "DUE_ONLY"
      ? "text-amber-700 dark:text-amber-300"
      : "text-green-700 dark:text-green-300";

  return (
    <span className="min-w-0 flex-1">
      <span className="block font-medium text-slate-800 dark:text-slate-100">
        {formatWeekdayDate(row.schedule_date)}
        <span className="ml-1 text-xs font-normal text-slate-500">
          · {statusTag(row)}
        </span>
      </span>
      <p className="mt-0.5 text-xs">
        <span className={dueClass}>Due {fmt(due)}</span>
        <span className="text-slate-400"> + </span>
        <span className={penaltyClass}>Penalty {fmt(penalty)}</span>
        <span className="text-slate-500">
          {" "}
          = {fmt(payable)} payable
        </span>
      </p>
      {mode === "DUE_ONLY" && due <= 0.009 && penalty > 0.009 && (
        <p className="mt-0.5 text-[11px] text-amber-700">Due cleared — only penalty left</p>
      )}
      {mode === "PENALTY_ONLY" && penalty <= 0.009 && due > 0.009 && (
        <p className="mt-0.5 text-[11px] text-amber-700">No penalty — only due left</p>
      )}
    </span>
  );
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
  const [allocationMode, setAllocationMode] = useState<AllocationMode>("BOTH");
  /** When true, amount follows selection/mode totals. Manual amount edits turn this off. */
  const amountFollowsSelection = useRef(true);

  const [form, setForm] = useState<PaymentCreate>({
    loan_id: loanId,
    payment_date: defaultScheduleDate || today,
    amount_paid: defaultAmount,
    payment_mode: "Cash",
    remarks: "",
    payment_reference: "",
    allocation_mode: "BOTH",
  });

  const [preview, setPreview] = useState<Preview | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  const selectedTotal = useMemo(
    () => sumPending(unpaidSchedules, selectedDates, allocationMode),
    [unpaidSchedules, selectedDates, allocationMode]
  );

  const amountNum = Number(form.amount_paid) || 0;
  const isPartial =
    isInstallment &&
    selectedDates.length > 0 &&
    amountNum > 0 &&
    amountNum + 0.001 < selectedTotal;
  const isOverSelected =
    isInstallment &&
    selectedDates.length > 0 &&
    amountNum > selectedTotal + 0.01;

  useEffect(() => {
    if (!isInstallment) return;
    setSchedulesLoading(true);
    getUnpaidSchedules(loanId)
      .then((rows) => {
        setUnpaidSchedules(rows);
        if (rows.length === 0) return;

        // Keep checkboxes in sync with the amount that will actually be applied:
        // - specific day (collections) → that day only
        // - default amount → select enough days to cover it
        // - otherwise → all open days (amount follows selection)
        let initial: string[];
        if (
          defaultScheduleDate &&
          rows.some((r) => r.schedule_date === defaultScheduleDate)
        ) {
          initial = [defaultScheduleDate];
          amountFollowsSelection.current = !defaultAmount;
        } else if (defaultAmount && Number(defaultAmount) > 0) {
          initial = pickDatesForAmount(rows, Number(defaultAmount), "BOTH");
          if (initial.length === 0) initial = [rows[0].schedule_date];
          amountFollowsSelection.current = false;
        } else {
          initial = rows
            .filter((r) => rowModeAmount(r, "BOTH") > 0.009)
            .map((r) => r.schedule_date);
          if (initial.length === 0) initial = [rows[0].schedule_date];
          amountFollowsSelection.current = true;
        }

        setSelectedDates(initial);
        const total = sumPending(rows, initial, "BOTH");
        setForm((prev) => ({
          ...prev,
          payment_date: initial[0],
          amount_paid: defaultAmount || (total > 0 ? total.toFixed(2) : ""),
          allocation_mode: "BOTH",
        }));
      })
      .catch(() => setUnpaidSchedules([]))
      .finally(() => setSchedulesLoading(false));
  }, [loanId, isInstallment, defaultScheduleDate, defaultAmount]);

  // Keep amount in sync with selection when user hasn't manually overridden it.
  useEffect(() => {
    if (!isInstallment) return;
    setForm((prev) => ({
      ...prev,
      payment_date: selectedDates[0] || prev.payment_date,
      schedule_dates: selectedDates,
      allocation_mode: allocationMode,
      amount_paid: amountFollowsSelection.current
        ? selectedTotal > 0
          ? selectedTotal.toFixed(2)
          : ""
        : prev.amount_paid,
    }));
  }, [selectedDates, selectedTotal, isInstallment, allocationMode]);

  useEffect(() => {
    if (!isInstallment || !form.amount_paid || Number(form.amount_paid) <= 0) {
      setPreview(null);
      return;
    }
    if (selectedDates.length === 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    previewPayment(
      loanId,
      selectedDates[0],
      form.amount_paid,
      selectedDates,
      allocationMode
    )
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.amount_paid, selectedDates, loanId, isInstallment, allocationMode]);

  function toggleDate(scheduleDate: string) {
    amountFollowsSelection.current = true;
    setSelectedDates((prev) =>
      prev.includes(scheduleDate)
        ? prev.filter((d) => d !== scheduleDate)
        : [...prev, scheduleDate].sort()
    );
  }

  function changeAllocationMode(mode: AllocationMode) {
    amountFollowsSelection.current = true;
    setAllocationMode(mode);
  }

  function selectAll() {
    amountFollowsSelection.current = true;
    setSelectedDates(unpaidSchedules.map((r) => r.schedule_date));
  }

  function clearSelection() {
    amountFollowsSelection.current = true;
    setSelectedDates([]);
  }

  function selectFromAmount() {
    const target = Number(form.amount_paid);
    if (!target || target <= 0) return;
    const picked = pickDatesForAmount(unpaidSchedules, target, allocationMode);
    if (picked.length > 0) {
      amountFollowsSelection.current = false; // keep typed amount
      setSelectedDates(picked);
    }
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
      else if (selectedTotal <= 0.009) {
        e.payment_date =
          allocationMode === "PENALTY_ONLY"
            ? "Selected days have no outstanding penalty."
            : allocationMode === "DUE_ONLY"
              ? "Selected days have no outstanding due."
              : "Selected days have nothing outstanding.";
      } else if (amountNum > selectedTotal + 0.01) {
        e.amount_paid = `Amount exceeds selected ${
          allocationMode === "DUE_ONLY"
            ? "due"
            : allocationMode === "PENALTY_ONLY"
              ? "penalty"
              : "payable"
        } total (${fmt(selectedTotal)}). Lower the amount or select more days.`;
      }
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
        ...(isInstallment
          ? {
              allocation_mode: allocationMode,
              ...(selectedDates.length > 0
                ? { schedule_dates: selectedDates, payment_date: selectedDates[0] }
                : {}),
            }
          : { allocation_mode: undefined }),
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
            ? "Choose what to collect (due, penalty, or both), then enter cash received. Green = collecting now; orange = still pending."
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
              day(s)
              {isPartial ? " (partial)" : ""}
              {" · "}
              {allocationMode === "DUE_ONLY"
                ? "Due only"
                : allocationMode === "PENALTY_ONLY"
                  ? "Penalty only"
                  : "Due + Penalty"}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Principal</p>
                <p className="font-semibold">{fmt(preview.principal_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Profit</p>
                <p className="font-semibold text-green-700">{fmt(preview.profit_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Penalty</p>
                <p className="font-semibold text-amber-700">
                  {fmt(preview.late_fee_amount ?? "0")}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Applied</p>
                <p className="font-semibold">{fmt(preview.total_amount)}</p>
              </div>
            </div>
            {preview.lines &&
              preview.lines.some((line) => Number(line.remaining_pending) > 0.009) && (
                <ul className="mt-3 space-y-1 border-t border-blue-100 pt-2 dark:border-blue-900">
                  {preview.lines
                    .filter((line) => Number(line.remaining_pending) > 0.009)
                    .map((line) => (
                      <li
                        key={line.schedule_date}
                        className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-blue-900 dark:text-blue-100"
                      >
                        <span className="font-medium">
                          {formatShortDate(line.schedule_date)}
                        </span>
                        <span>
                          {fmt(line.applied_amount)} of {fmt(line.expected_pending)}
                          <span className="text-amber-700 dark:text-amber-300">
                            {" "}
                            · {fmt(line.remaining_pending)} left in this mode
                          </span>
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
              <div className="mb-3">
                <p className="mb-1.5 text-sm font-medium text-slate-700">Collect</p>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-600">
                  {ALLOCATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.hint}
                      onClick={() => changeAllocationMode(opt.value)}
                      className={`cursor-pointer rounded-md px-2 py-2 text-xs font-medium transition ${
                        allocationMode === opt.value
                          ? "bg-blue-600 text-white"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {ALLOCATION_OPTIONS.find((o) => o.value === allocationMode)?.hint}
                </p>
              </div>

              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Installments to pay ({selectedDates.length} selected)
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="cursor-pointer rounded border px-2 py-0.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="cursor-pointer rounded border px-2 py-0.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {unpaidSchedules.map((row) => {
                    const selected = selectedDates.includes(row.schedule_date);
                    const modeAmt = rowModeAmount(row, allocationMode);
                    return (
                      <label
                        key={row.schedule_date}
                        className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm ${
                          selected
                            ? "bg-blue-50 dark:bg-blue-950/30"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        } ${modeAmt <= 0.009 ? "opacity-70" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected}
                          onChange={() => toggleDate(row.schedule_date)}
                        />
                        <ScheduleRowContent
                          row={row}
                          selected={selected}
                          mode={allocationMode}
                        />
                      </label>
                    );
                  })}
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
                  className="cursor-pointer text-xs text-blue-700 hover:underline"
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
              onChange={(e) => {
                amountFollowsSelection.current = false;
                setForm({ ...form, amount_paid: e.target.value });
              }}
              className={inputCls("amount_paid")}
            />
            {isInstallment && selectedDates.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Selected{" "}
                {allocationMode === "DUE_ONLY"
                  ? "due"
                  : allocationMode === "PENALTY_ONLY"
                    ? "penalty"
                    : "payable"}{" "}
                total {fmt(selectedTotal.toFixed(2))}
                {isPartial
                  ? " — partial OK; remainder stays pending on those days."
                  : isOverSelected
                    ? " — amount is higher than selected total (fix more days or lower amount)."
                    : " — toggle days freely; amount follows selection unless you type a custom amount."}
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
              className="cursor-pointer rounded-lg bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : isAgent ? "Confirm Collection" : "Record Payment"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cursor-pointer rounded-lg border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

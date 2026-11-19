import type { AllocationMode } from "../types/payment";
import type { UnpaidSchedule } from "../types/loan";

/** API may return YYYY-MM-DD or a full ISO datetime. */
export function normalizeScheduleDate(value: string): string {
  return String(value ?? "").slice(0, 10);
}

export function rowDueOutstanding(row: UnpaidSchedule): number {
  if (row.installment_outstanding != null && row.installment_outstanding !== "") {
    return Number(row.installment_outstanding);
  }
  const total = Number(row.total_payable ?? row.pending_amount);
  const penalty = Number(row.penalty_outstanding ?? 0);
  return Math.max(total - penalty, 0);
}

export function rowPenaltyOutstanding(row: UnpaidSchedule): number {
  return Number(row.penalty_outstanding ?? 0);
}

export function rowModeAmount(row: UnpaidSchedule, mode: AllocationMode): number {
  if (mode === "DUE_ONLY") return rowDueOutstanding(row);
  if (mode === "PENALTY_ONLY") return rowPenaltyOutstanding(row);
  return Number(row.total_payable ?? row.pending_amount);
}

export function sumPending(
  rows: UnpaidSchedule[],
  dates: string[],
  mode: AllocationMode
): number {
  const wanted = new Set(dates.map(normalizeScheduleDate));
  return rows
    .filter((r) => wanted.has(normalizeScheduleDate(r.schedule_date)))
    .reduce((sum, r) => sum + rowModeAmount(r, mode), 0);
}

/** Earliest unpaid days whose mode totals cover `target`. */
export function pickDatesForAmount(
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
    picked.push(normalizeScheduleDate(row.schedule_date));
    running += pending;
    if (running >= target - 0.001) break;
  }
  return picked;
}

/**
 * Auto-expand checkboxes only when the amount is manually locked
 * (amountFollowsSelection === false). When the user toggles / Clear / All,
 * amount follows selection — never fight their clicks.
 */
export function shouldAutoCoverAmount(opts: {
  amountFollowsSelection: boolean;
  amountNum: number;
  selectedTotal: number;
}): boolean {
  if (opts.amountFollowsSelection) return false;
  return opts.amountNum > opts.selectedTotal + 0.01;
}

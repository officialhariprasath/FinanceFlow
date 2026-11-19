/**
 * Node smoke tests for Record Payment selection helpers.
 * Run: node frontend/src/utils/paymentSelection.test.mjs
 */

function normalizeScheduleDate(value) {
  return String(value ?? "").slice(0, 10);
}

function rowDueOutstanding(row) {
  if (row.installment_outstanding != null && row.installment_outstanding !== "") {
    return Number(row.installment_outstanding);
  }
  const total = Number(row.total_payable ?? row.pending_amount);
  const penalty = Number(row.penalty_outstanding ?? 0);
  return Math.max(total - penalty, 0);
}

function rowPenaltyOutstanding(row) {
  return Number(row.penalty_outstanding ?? 0);
}

function rowModeAmount(row, mode) {
  if (mode === "DUE_ONLY") return rowDueOutstanding(row);
  if (mode === "PENALTY_ONLY") return rowPenaltyOutstanding(row);
  return Number(row.total_payable ?? row.pending_amount);
}

function sumPending(rows, dates, mode) {
  const wanted = new Set(dates.map(normalizeScheduleDate));
  return rows
    .filter((r) => wanted.has(normalizeScheduleDate(r.schedule_date)))
    .reduce((sum, r) => sum + rowModeAmount(r, mode), 0);
}

function pickDatesForAmount(rows, target, mode) {
  if (!(target > 0)) return [];
  let running = 0;
  const picked = [];
  for (const row of rows) {
    const pending = rowModeAmount(row, mode);
    if (pending <= 0.009) continue;
    picked.push(normalizeScheduleDate(row.schedule_date));
    running += pending;
    if (running >= target - 0.001) break;
  }
  return picked;
}

function shouldAutoCoverAmount({ amountFollowsSelection, amountNum, selectedTotal }) {
  if (amountFollowsSelection) return false;
  return amountNum > selectedTotal + 0.01;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const rows = [
  {
    schedule_date: "2025-09-01",
    total_payable: "40",
    pending_amount: "40",
    installment_outstanding: "40",
    penalty_outstanding: "0",
  },
  {
    schedule_date: "2025-09-02T00:00:00",
    total_payable: "120",
    pending_amount: "120",
    installment_outstanding: "120",
    penalty_outstanding: "0",
  },
  {
    schedule_date: "2025-09-03",
    total_payable: "120",
    pending_amount: "120",
    installment_outstanding: "120",
    penalty_outstanding: "0",
  },
];

// normalize
assert(normalizeScheduleDate("2025-09-02T00:00:00") === "2025-09-02", "normalize iso");

// pick covers amount across days
const picked160 = pickDatesForAmount(rows, 160, "BOTH");
assert(picked160.length === 2, `expected 2 days for 160, got ${picked160.length}`);
assert(picked160[0] === "2025-09-01" && picked160[1] === "2025-09-02", "order");

// sum uses normalized dates
assert(
  Math.abs(sumPending(rows, ["2025-09-02"], "BOTH") - 120) < 0.01,
  "sum with normalized date"
);

// CRITICAL: after Clear / uncheck, amount follows selection → never auto-reselect
assert(
  shouldAutoCoverAmount({
    amountFollowsSelection: true,
    amountNum: 5800,
    selectedTotal: 0,
  }) === false,
  "must NOT auto-cover when amount follows selection (Clear/uncheck)"
);

assert(
  shouldAutoCoverAmount({
    amountFollowsSelection: true,
    amountNum: 5800,
    selectedTotal: 40,
  }) === false,
  "must NOT auto-cover after unchecking while following selection"
);

// Manual amount higher than selection → may auto-cover
assert(
  shouldAutoCoverAmount({
    amountFollowsSelection: false,
    amountNum: 5800,
    selectedTotal: 40,
  }) === true,
  "auto-cover when amount is locked and higher than selection"
);

assert(
  shouldAutoCoverAmount({
    amountFollowsSelection: false,
    amountNum: 40,
    selectedTotal: 40,
  }) === false,
  "no auto-cover when amount matches selection"
);

// Simulate Clear then guard
let selected = pickDatesForAmount(rows, 280, "BOTH");
assert(selected.length === 3, "initial cover all");
const amountFollowsSelection = true; // Clear/toggle sets this
selected = []; // Clear
assert(
  shouldAutoCoverAmount({
    amountFollowsSelection,
    amountNum: 280,
    selectedTotal: sumPending(rows, selected, "BOTH"),
  }) === false,
  "Clear must not be undone by auto-cover"
);

console.log("payment_selection_tests_ok");

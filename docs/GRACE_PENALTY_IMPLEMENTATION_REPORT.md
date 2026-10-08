# Implementation Report — Configurable Grace Installments & Fixed Penalty

**Status:** Audit complete. Implementation follows this report.  
**Date:** 2026-10-08  
**Branch:** `cursor/grace-installment-penalty-aedf`

---

## 1. Existing architecture

### Where loan products are stored
There is **no production loan-product catalog**. Installment terms are stored **per loan** on `loans` (`collection_model`, `collection_frequency`, `installment_count`, `daily_payment` / `daily_principal` / `daily_profit`, `due_start_date`).

Admin defaults live in `finance_settings` (interest method/rate, duration, unused `default_grace_period` in **days**). Simulation has a separate `LoanProductConfig` unused by live lending.

### Where loan frequency is stored
`loans.collection_frequency`: `DAILY` | `WEEKLY` | `BI_WEEKLY` | `MONTHLY` (`CollectionFrequency` enum).

### Where installments are generated
`backend/app/services/schedule_service.py` → `generate_installment_schedule`  
Creates equal `loan_schedules` rows via `installment_schedule_date` in `backend/app/utils/date_helpers.py`.

### Where installment amounts are calculated
**UI:** `frontend/src/utils/loanCalc.ts` → `calculateInstallmentLoanTerms`  
**Backend:** validates `daily_principal + daily_profit == daily_payment`; does not re-derive from interest %.

### Where payment records are stored
`payments` + `payment_allocations` (`principal_amount`, `profit_amount`, `late_fee_amount` always **0**, `other_amount`).

### Where outstanding balances are calculated
- **STANDARD:** `calculate_current_outstanding` / `calculate_outstanding_amount` (principal + accrued interest).
- **Installment:** per-schedule `max(expected_amount - paid_amount, 0)`; loan book uses `remaining_principal`.

### Where Record Payment gets its amount
`RecordPaymentModal` → `GET /loans/{id}/schedules/unpaid` → sums selected `pending_amount`. Collections passes `item.pending_amount`.

### Where reports get overdue amounts
- Dashboard maturity overdue: `due_date < today` (`dashboard_service.get_overdue_loans`).
- Defaults / collections: schedule `OVERDUE` + `schedule_pending_amount` (`default_service`, `collection_service`).

---

## 2. Existing calculation (formulas)

| Concept | Formula |
|--------|---------|
| Installment amount | `total_repayment / N` (UI); stored as `daily_payment` |
| Schedule pending | `max(expected_amount − paid_amount, 0)` |
| Overdue mark | `schedule_date < as_of` AND status in PENDING/PARTIAL → OVERDUE (**no grace**) |
| Payment allocation | **Profit first, then principal** (`allocate_payment_amount`) |
| Across schedules | Chronological; same rule per row |
| Late fee | Always `0` |
| `default_grace_period` | Stored; **never applied** |

---

## 3. Audit findings (penalty-relevant)

1. No penalty engine; `late_fee_amount` is a stub.
2. Grace days field is dead config — must not reuse as “grace installments”.
3. Pending amounts ignore fees — all collection/payment paths use `schedule_pending_amount`.
4. No per-installment penalty fields on `loan_schedules`.
5. Existing loans must default to **zero penalty** (no silent fees).

---

## 4. Grace-threshold rule (exact)

**First N overdue free (generic across frequencies):**

```
overdue_unpaid = schedules with schedule_date < as_of AND outstanding > 0
                 ordered oldest-first
for index, installment in enumerate(overdue_unpaid):
    if index < grace_installments:
        penalty = 0       # free grace block
    else:
        penalty = fixed   # after the grace block
# current/future (schedule_date >= as_of) → penalty = 0
```

**Day 1–6 (Daily, grace=3, penalty=₹10):** Day 5 → Day 4 @ ₹130; Days 1–3 free; Day 5 current @ ₹120.

**User case (grace=5, penalty=₹50, today=8 Oct):** Oct 2–6 free @ ₹120; Oct 7 @ ₹170; Oct 8 today @ ₹120.

Penalty never compounds; original `expected_amount` is never mutated.

---

## 5. Files / components that MUST change

| Area | Files |
|------|--------|
| Migration | New Alembic revision |
| Settings model/schema/API | `finance_settings.py` (model + schema + service), Settings UI/types |
| Loan snapshot | `models/loan.py`, create_loan in `loan_service.py`, loan schemas |
| Schedule | `models/loan_schedule.py` (`paid_penalty`) |
| **New** penalty engine | `services/penalty_service.py` |
| Schedule pending / lists | `schedule_service.py`, loan schemas (`UnpaidScheduleResponse`, etc.) |
| Payment | `payment_allocation_service.py`, `payment_service.py` (late_fee) |
| Collections / defaults | `collection_service.py`, `default_service.py` (pending includes penalty) |
| Frontend | `SettingsPage`, `RecordPaymentModal`, loan/settings types, Loan detail schedule display |
| Tests | `backend/app/tests/test_grace_penalty.py` |

---

## 6. Files / components that should NOT change

- STANDARD interest engine (`interest_calculator.py`)
- Schedule date helpers (frequency stepping) — reused as-is
- Capital / profit ledger writers (except applying `late_fee` into allocation totals where needed)
- Agent wallet credit flow (still credits full collected amount)
- Simulation engine (out of scope unless shared helpers)
- Dashboard maturity-overdue-by-`due_date` logic (different concept)
- Auth, customers, agents, settlements delivery

---

## 7. Integration plan

1. **Settings:** per-frequency `grace_installments` + `penalty_per_installment` on `finance_settings` (defaults **0**).
2. **Live source of truth:** payable math resolves config from **current finance settings** by loan frequency (grace 5→3 takes effect immediately on existing loans).
3. **Backfill on every Settings save:** copies matching frequency values onto **all** installment loans for that owner (including previously backfilled). API returns `penalty_loans_updated`.
4. **Loan create:** still snapshots current settings onto the loan for display consistency.
5. **Engine / payment / collection / schedule:** apply live settings before computing payables.
6. **UI:** Settings warns that save updates all existing installment loans; toast shows count; Record Payment + schedule show Original / Penalty / Payable.
7. **Tests:** Day 1–6, frequencies, partial pay, compounding, **settings 5→3 on existing loan**, backfill sync.

---

## 8. Potential conflicts

- Changing `schedule_pending_amount` signature affects payment, collection, defaults — all updated together.
- PAID status today ignores fees — must require unpaid penalty cleared.
- Spill-forward / max-pending caps must include penalty in pending totals.
- Do not reuse `default_grace_period` (days) for grace installments.

"""
Installment grace + penalty engine (calendar days from today).

Grace N means: an overdue installment stays free while
(as_of - due_date).days <= N.

When (as_of - due_date).days > N:
  - Normal dues get a fixed penalty_per_installment once
  - The loan's last due accumulates (days_late - N) × penalty
    so post-maturity days keep adding onto the final installment

Today / future dues never get an early penalty.
Original installment amounts are never mutated.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Sequence

from backend.app.models.loan import Loan
from backend.app.models.loan_schedule import LoanSchedule

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")

FREQUENCY_PENALTY_FIELDS = {
    "DAILY": ("daily_grace_installments", "daily_penalty_per_installment"),
    "WEEKLY": ("weekly_grace_installments", "weekly_penalty_per_installment"),
    "BI_WEEKLY": ("bi_weekly_grace_installments", "bi_weekly_penalty_per_installment"),
    "MONTHLY": ("monthly_grace_installments", "monthly_penalty_per_installment"),
}


@dataclass(frozen=True)
class InstallmentPayable:
    schedule_id: int
    schedule_date: date
    original_amount: Decimal
    paid_amount: Decimal
    installment_outstanding: Decimal
    grace_installments: int
    installments_elapsed: int
    grace_crossed: bool
    penalty_amount: Decimal
    paid_penalty: Decimal
    penalty_outstanding: Decimal
    total_payable: Decimal
    # True when overdue unpaid and still inside calendar grace from today.
    within_grace: bool = False
    # Days late vs as_of (0 for today/future). None if not applicable.
    overdue_rank: int | None = None

    @property
    def grace_status(self) -> str:
        if self.installment_outstanding <= ZERO and self.penalty_outstanding <= ZERO:
            return "SETTLED"
        if self.within_grace:
            return "WITHIN_GRACE"
        if self.grace_crossed:
            return "GRACE_EXCEEDED"
        return "NOT_APPLICABLE"


def loan_grace_installments(loan: Loan) -> int:
    value = getattr(loan, "grace_installments", None)
    if value is None:
        return 0
    return max(int(value), 0)


def loan_penalty_per_installment(loan: Loan) -> Decimal:
    value = getattr(loan, "penalty_per_installment", None)
    if value is None:
        return ZERO
    return max(Decimal(value), ZERO).quantize(TWOPLACES)


def penalty_defaults_from_settings(settings, frequency: str) -> tuple[int, Decimal]:
    freq = (frequency or "DAILY").upper()
    fields = FREQUENCY_PENALTY_FIELDS.get(freq)
    if settings is None or fields is None:
        return 0, ZERO
    grace_attr, penalty_attr = fields
    grace = getattr(settings, grace_attr, None)
    penalty = getattr(settings, penalty_attr, None)
    grace_n = max(int(grace), 0) if grace is not None else 0
    penalty_d = max(Decimal(penalty), ZERO).quantize(TWOPLACES) if penalty is not None else ZERO
    return grace_n, penalty_d


def effective_penalty_config(loan: Loan, settings=None) -> tuple[int, Decimal]:
    if settings is not None and getattr(loan, "collection_model", None) == "DAILY_COLLECTION":
        return penalty_defaults_from_settings(
            settings, getattr(loan, "collection_frequency", None) or "DAILY"
        )
    return loan_grace_installments(loan), loan_penalty_per_installment(loan)


def sync_loan_penalty_fields(loan: Loan, settings) -> None:
    if getattr(loan, "collection_model", None) != "DAILY_COLLECTION":
        loan.grace_installments = 0
        loan.penalty_per_installment = ZERO
        return
    grace, penalty = penalty_defaults_from_settings(
        settings, getattr(loan, "collection_frequency", None) or "DAILY"
    )
    loan.grace_installments = grace
    loan.penalty_per_installment = penalty


def fetch_finance_settings(db, finance_owner_id: int):
    from backend.app.models.finance_settings import FinanceSettings

    return (
        db.query(FinanceSettings)
        .filter(FinanceSettings.finance_owner_id == finance_owner_id)
        .first()
    )


def ensure_loan_penalty_from_settings(db, loan: Loan):
    if getattr(loan, "collection_model", None) != "DAILY_COLLECTION":
        return None
    settings = fetch_finance_settings(db, loan.finance_owner_id)
    if settings is None:
        return None
    sync_loan_penalty_fields(loan, settings)
    return settings


def _as_decimal(value) -> Decimal:
    return Decimal(value or 0).quantize(TWOPLACES)


def _installment_outstanding(schedule: LoanSchedule) -> Decimal:
    original = Decimal(schedule.expected_amount).quantize(TWOPLACES)
    paid_amount = Decimal(schedule.paid_amount or 0).quantize(TWOPLACES)
    return max(original - paid_amount, ZERO).quantize(TWOPLACES)


def _days_late(schedule_date: date, as_of: date) -> int:
    return max((as_of - schedule_date).days, 0)


def _computed_penalty_for_row(
    *,
    days_late: int,
    grace_n: int,
    fixed_penalty: Decimal,
    is_last_due: bool,
    needs_penalty_base: bool,
) -> Decimal:
    if not needs_penalty_base or days_late <= 0 or fixed_penalty <= ZERO:
        return ZERO
    if days_late <= grace_n:
        return ZERO
    if is_last_due:
        units = days_late - grace_n
        return (fixed_penalty * units).quantize(TWOPLACES)
    return fixed_penalty


def compute_loan_payables(
    schedules: Sequence[LoanSchedule],
    *,
    grace_installments: int,
    penalty_per_installment: Decimal,
    as_of: date,
) -> dict[int, InstallmentPayable]:
    ordered = sorted(schedules, key=lambda row: (row.schedule_date, row.id or 0))
    grace_n = max(int(grace_installments), 0)
    fixed_penalty = max(Decimal(penalty_per_installment), ZERO).quantize(TWOPLACES)
    last_due = ordered[-1].schedule_date if ordered else None

    result: dict[int, InstallmentPayable] = {}
    for row in ordered:
        original = Decimal(row.expected_amount).quantize(TWOPLACES)
        paid_amount = Decimal(row.paid_amount or 0).quantize(TWOPLACES)
        paid_penalty = _as_decimal(getattr(row, "paid_penalty", None))
        frozen = _as_decimal(getattr(row, "assessed_penalty", None))
        installment_outstanding = max(original - paid_amount, ZERO).quantize(TWOPLACES)

        days_late = _days_late(row.schedule_date, as_of)
        is_last_due = last_due is not None and row.schedule_date == last_due
        still_open = installment_outstanding > ZERO or paid_penalty > ZERO or frozen > ZERO
        needs_penalty_base = installment_outstanding > ZERO or paid_penalty > ZERO or frozen > ZERO

        computed = _computed_penalty_for_row(
            days_late=days_late,
            grace_n=grace_n,
            fixed_penalty=fixed_penalty,
            is_last_due=is_last_due,
            needs_penalty_base=needs_penalty_base and still_open,
        )

        # Keep the higher of frozen assessed vs live computed (allows last-due growth).
        if installment_outstanding <= ZERO and paid_penalty <= ZERO and frozen <= ZERO:
            penalty_amount = ZERO
        else:
            penalty_amount = max(frozen, computed, paid_penalty)

        if penalty_amount > frozen and hasattr(row, "assessed_penalty"):
            row.assessed_penalty = penalty_amount

        penalty_outstanding = max(penalty_amount - paid_penalty, ZERO).quantize(TWOPLACES)
        total_payable = (installment_outstanding + penalty_outstanding).quantize(TWOPLACES)

        within_grace = (
            installment_outstanding > ZERO
            and row.schedule_date < as_of
            and days_late > 0
            and days_late <= grace_n
            and penalty_amount <= ZERO
        )

        result[row.id] = InstallmentPayable(
            schedule_id=row.id,
            schedule_date=row.schedule_date,
            original_amount=original,
            paid_amount=paid_amount,
            installment_outstanding=installment_outstanding,
            grace_installments=grace_n,
            installments_elapsed=days_late,
            grace_crossed=penalty_amount > ZERO,
            penalty_amount=penalty_amount,
            paid_penalty=paid_penalty,
            penalty_outstanding=penalty_outstanding,
            total_payable=total_payable,
            within_grace=within_grace,
            overdue_rank=days_late if row.schedule_date < as_of else None,
        )
    return result


def compute_installment_payable(
    schedule: LoanSchedule,
    *,
    ordered_schedules: Sequence[LoanSchedule],
    grace_installments: int,
    penalty_per_installment: Decimal,
    as_of: date,
) -> InstallmentPayable:
    ordered = list(ordered_schedules)
    if not any(row.id == schedule.id for row in ordered):
        ordered = sorted(
            [*ordered, schedule],
            key=lambda row: (row.schedule_date, row.id or 0),
        )
    payables = compute_loan_payables(
        ordered,
        grace_installments=grace_installments,
        penalty_per_installment=penalty_per_installment,
        as_of=as_of,
    )
    return payables[schedule.id]


def compute_loan_payables_for_loan(
    loan: Loan,
    schedules: Sequence[LoanSchedule] | None = None,
    *,
    as_of: date | None = None,
    settings=None,
) -> dict[int, InstallmentPayable]:
    rows = list(schedules if schedules is not None else (loan.schedules or []))
    grace, penalty = effective_penalty_config(loan, settings)
    return compute_loan_payables(
        rows,
        grace_installments=grace,
        penalty_per_installment=penalty,
        as_of=as_of or date.today(),
    )


def schedule_total_pending(
    schedule: LoanSchedule,
    *,
    loan: Loan,
    all_schedules: Sequence[LoanSchedule],
    as_of: date | None = None,
    settings=None,
) -> Decimal:
    grace, penalty = effective_penalty_config(loan, settings)
    payable = compute_installment_payable(
        schedule,
        ordered_schedules=all_schedules,
        grace_installments=grace,
        penalty_per_installment=penalty,
        as_of=as_of or date.today(),
    )
    return payable.total_payable

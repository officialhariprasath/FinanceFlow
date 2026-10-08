"""
Installment grace + fixed penalty engine.

Grace is a count of overdue installments (sequence), not calendar days:

  - Among unpaid installments due before as_of (oldest first), the first
    `grace_installments` stay at the original amount (no penalty).
  - Any additional overdue installment gets the fixed penalty.
  - Today's / future installment never gets an early penalty.

Works the same for daily / weekly / bi-weekly / monthly schedules.
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

# Settings / loan field prefixes by CollectionFrequency value
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

    @property
    def grace_status(self) -> str:
        if self.installment_outstanding <= ZERO and self.penalty_outstanding <= ZERO:
            return "SETTLED"
        if self.grace_crossed:
            return "GRACE_EXCEEDED"
        return "WITHIN_GRACE"


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
    """Return (grace_installments, penalty_per_installment) for a frequency."""
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
    """
    Live penalty config for a loan.

    Prefer finance settings for the loan's frequency so a settings change
    (e.g. grace 5 → 3) applies to existing loans immediately. Fall back to
    the loan snapshot columns when settings are unavailable.
    """
    if settings is not None and getattr(loan, "collection_model", None) == "DAILY_COLLECTION":
        return penalty_defaults_from_settings(
            settings, getattr(loan, "collection_frequency", None) or "DAILY"
        )
    return loan_grace_installments(loan), loan_penalty_per_installment(loan)


def sync_loan_penalty_fields(loan: Loan, settings) -> None:
    """Copy frequency settings onto the loan snapshot columns."""
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
    """Read settings without auto-creating (safe mid-transaction)."""
    from backend.app.models.finance_settings import FinanceSettings

    return (
        db.query(FinanceSettings)
        .filter(FinanceSettings.finance_owner_id == finance_owner_id)
        .first()
    )


def ensure_loan_penalty_from_settings(db, loan: Loan):
    """
    Apply current finance settings onto the loan object (in-memory + dirty).

    Call before any payable/pending calculation so existing loans reflect
    the latest Settings page values without waiting for a separate job.
    """
    if getattr(loan, "collection_model", None) != "DAILY_COLLECTION":
        return None
    settings = fetch_finance_settings(db, loan.finance_owner_id)
    if settings is None:
        return None
    sync_loan_penalty_fields(loan, settings)
    return settings


def _installment_outstanding(schedule: LoanSchedule) -> Decimal:
    original = Decimal(schedule.expected_amount).quantize(TWOPLACES)
    paid_amount = Decimal(schedule.paid_amount or 0).quantize(TWOPLACES)
    return max(original - paid_amount, ZERO).quantize(TWOPLACES)


def _penalty_eligible_schedule_ids(
    ordered: Sequence[LoanSchedule],
    *,
    grace_installments: int,
    as_of: date,
) -> set[int]:
    """
    First `grace_installments` overdue unpaid rows (oldest first) are free.
    Any further overdue unpaid row is penalty-eligible.
    """
    grace_n = max(int(grace_installments), 0)
    overdue_unpaid: list[LoanSchedule] = []
    for row in ordered:
        if row.schedule_date >= as_of:
            continue
        if _installment_outstanding(row) <= ZERO:
            continue
        overdue_unpaid.append(row)

    eligible: set[int] = set()
    for index, row in enumerate(overdue_unpaid):
        if index >= grace_n:
            eligible.add(row.id)
    return eligible


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
    eligible_ids = _penalty_eligible_schedule_ids(
        ordered, grace_installments=grace_n, as_of=as_of
    )

    # Rank among overdue unpaid (for display / diagnostics).
    overdue_rank: dict[int, int] = {}
    rank = 0
    for row in ordered:
        if row.schedule_date >= as_of:
            continue
        if _installment_outstanding(row) <= ZERO:
            continue
        overdue_rank[row.id] = rank
        rank += 1

    result: dict[int, InstallmentPayable] = {}
    for row in ordered:
        original = Decimal(row.expected_amount).quantize(TWOPLACES)
        paid_amount = Decimal(row.paid_amount or 0).quantize(TWOPLACES)
        paid_penalty = Decimal(getattr(row, "paid_penalty", None) or 0).quantize(TWOPLACES)
        installment_outstanding = max(original - paid_amount, ZERO).quantize(TWOPLACES)

        in_eligible = row.id in eligible_ids
        # Penalty applies when this overdue row sits past the free grace block,
        # or when a penalty was already partially collected on it.
        if installment_outstanding <= ZERO and paid_penalty <= ZERO:
            penalty_amount = ZERO
        elif in_eligible or (paid_penalty > ZERO and row.schedule_date < as_of):
            penalty_amount = fixed_penalty
        else:
            penalty_amount = ZERO

        penalty_outstanding = max(penalty_amount - paid_penalty, ZERO).quantize(TWOPLACES)
        total_payable = (installment_outstanding + penalty_outstanding).quantize(TWOPLACES)
        elapsed = overdue_rank.get(row.id, 0)

        result[row.id] = InstallmentPayable(
            schedule_id=row.id,
            schedule_date=row.schedule_date,
            original_amount=original,
            paid_amount=paid_amount,
            installment_outstanding=installment_outstanding,
            grace_installments=grace_n,
            installments_elapsed=elapsed,
            grace_crossed=penalty_amount > ZERO,
            penalty_amount=penalty_amount,
            paid_penalty=paid_penalty,
            penalty_outstanding=penalty_outstanding,
            total_payable=total_payable,
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
    """Single-row helper; always evaluates against the full schedule set."""
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

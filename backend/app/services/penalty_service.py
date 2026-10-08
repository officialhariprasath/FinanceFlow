"""
Installment grace + fixed penalty engine.

Grace protects the **last N overdue unpaid installments** (closest to today).
Penalty applies to the **most late** overdue installments beyond that window.

Example (grace=5):
  - 6 overdue → oldest 1 gets penalty; last 5 free
  - 7 overdue → oldest 2 get penalty; last 5 free

After payments, the overdue unpaid list is rebuilt and grace is recalculated.
Today / future installments never get an early penalty.

Works for daily / weekly / bi-weekly / monthly schedules.
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
    # True for overdue unpaid rows inside the free last-N grace window.
    within_grace: bool = False
    # 0-based rank among overdue unpaid (oldest = 0). None if not overdue unpaid.
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


def _installment_outstanding(schedule: LoanSchedule) -> Decimal:
    original = Decimal(schedule.expected_amount).quantize(TWOPLACES)
    paid_amount = Decimal(schedule.paid_amount or 0).quantize(TWOPLACES)
    return max(original - paid_amount, ZERO).quantize(TWOPLACES)


def _penalty_eligible_schedule_ids(
    ordered: Sequence[LoanSchedule],
    *,
    grace_installments: int,
    as_of: date,
) -> tuple[set[int], dict[int, int], set[int]]:
    """
    Last `grace_installments` overdue unpaid rows (newest / closest to today)
    are free. Older overdue unpaid rows (most late) are penalty-eligible.

    Returns (eligible_ids, overdue_rank_by_id, within_grace_ids).
    """
    grace_n = max(int(grace_installments), 0)
    overdue_unpaid: list[LoanSchedule] = []
    for row in ordered:
        if row.schedule_date >= as_of:
            continue
        if _installment_outstanding(row) <= ZERO:
            continue
        overdue_unpaid.append(row)

    overdue_rank = {row.id: index for index, row in enumerate(overdue_unpaid)}
    count = len(overdue_unpaid)
    # Oldest (count - grace) rows get penalty when count > grace.
    penalty_cut = max(0, count - grace_n)

    eligible: set[int] = set()
    within_grace: set[int] = set()
    for index, row in enumerate(overdue_unpaid):
        if index < penalty_cut:
            eligible.add(row.id)
        else:
            within_grace.add(row.id)
    return eligible, overdue_rank, within_grace


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
    eligible_ids, overdue_rank, within_grace_ids = _penalty_eligible_schedule_ids(
        ordered, grace_installments=grace_n, as_of=as_of
    )

    result: dict[int, InstallmentPayable] = {}
    for row in ordered:
        original = Decimal(row.expected_amount).quantize(TWOPLACES)
        paid_amount = Decimal(row.paid_amount or 0).quantize(TWOPLACES)
        paid_penalty = Decimal(getattr(row, "paid_penalty", None) or 0).quantize(TWOPLACES)
        installment_outstanding = max(original - paid_amount, ZERO).quantize(TWOPLACES)

        in_eligible = row.id in eligible_ids
        # Keep collecting a partially paid penalty even if ranking shifts after pays.
        if installment_outstanding <= ZERO and paid_penalty <= ZERO:
            penalty_amount = ZERO
        elif in_eligible or (paid_penalty > ZERO and row.schedule_date < as_of):
            penalty_amount = fixed_penalty
        else:
            penalty_amount = ZERO

        penalty_outstanding = max(penalty_amount - paid_penalty, ZERO).quantize(TWOPLACES)
        total_payable = (installment_outstanding + penalty_outstanding).quantize(TWOPLACES)
        rank = overdue_rank.get(row.id)
        within_grace = (
            row.id in within_grace_ids
            and installment_outstanding > ZERO
            and penalty_amount <= ZERO
        )

        result[row.id] = InstallmentPayable(
            schedule_id=row.id,
            schedule_date=row.schedule_date,
            original_amount=original,
            paid_amount=paid_amount,
            installment_outstanding=installment_outstanding,
            grace_installments=grace_n,
            installments_elapsed=rank if rank is not None else 0,
            grace_crossed=penalty_amount > ZERO,
            penalty_amount=penalty_amount,
            paid_penalty=paid_penalty,
            penalty_outstanding=penalty_outstanding,
            total_payable=total_payable,
            within_grace=within_grace,
            overdue_rank=rank,
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

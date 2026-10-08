from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.enums import ScheduleStatus
from backend.app.models.loan import Loan
from backend.app.models.loan_schedule import LoanSchedule
from backend.app.services.penalty_service import (
    compute_installment_payable,
    compute_loan_payables_for_loan,
    effective_penalty_config,
    ensure_loan_penalty_from_settings,
)
from backend.app.utils.date_helpers import installment_schedule_date
from backend.app.utils.loan_helpers import is_installment_loan

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def generate_installment_schedule(
    db: Session,
    loan: Loan,
) -> list[LoanSchedule]:
    schedules: list[LoanSchedule] = []

    if not is_installment_loan(loan):
        return schedules

    count = loan.installment_count or loan.duration_days
    if count is None or loan.daily_payment is None:
        return schedules

    due_start = loan.due_start_date or loan.issue_date
    frequency = loan.collection_frequency or "DAILY"

    for index in range(count):
        schedule_date = installment_schedule_date(due_start, frequency, index)
        schedule = LoanSchedule(
            loan_id=loan.id,
            schedule_date=schedule_date,
            expected_amount=loan.daily_payment,
            expected_principal=loan.daily_principal or ZERO,
            expected_profit=loan.daily_profit or ZERO,
            paid_amount=ZERO,
            paid_principal=ZERO,
            paid_profit=ZERO,
            paid_penalty=ZERO,
            status=ScheduleStatus.PENDING.value,
        )
        db.add(schedule)
        schedules.append(schedule)

    db.flush()
    return schedules


# Backward-compatible alias
generate_daily_schedule = generate_installment_schedule


def get_schedule_for_payment(
    db: Session,
    loan: Loan,
    payment_date: date,
    allow_fallback: bool = True,
) -> LoanSchedule | None:
    schedule = (
        db.query(LoanSchedule)
        .filter(
            LoanSchedule.loan_id == loan.id,
            LoanSchedule.schedule_date == payment_date,
        )
        .first()
    )

    if schedule is not None:
        return schedule

    today = date.today()
    # Future advance payments must target an exact schedule date.
    if payment_date > today or not allow_fallback:
        return None

    return (
        db.query(LoanSchedule)
        .filter(
            LoanSchedule.loan_id == loan.id,
            LoanSchedule.status.in_(
                [
                    ScheduleStatus.PENDING.value,
                    ScheduleStatus.PARTIAL.value,
                    ScheduleStatus.OVERDUE.value,
                ]
            ),
        )
        .order_by(LoanSchedule.schedule_date.asc())
        .first()
    )


def _schedule_row_dict(
    schedule: LoanSchedule,
    payable,
    *,
    today: date,
) -> dict:
    return {
        "schedule_date": schedule.schedule_date,
        "expected_amount": payable.original_amount,
        "paid_amount": payable.paid_amount,
        "pending_amount": payable.total_payable,
        "status": schedule.status,
        "is_today": schedule.schedule_date == today,
        "is_future": schedule.schedule_date > today,
        "original_amount": payable.original_amount,
        "penalty_amount": payable.penalty_amount,
        "paid_penalty": payable.paid_penalty,
        "penalty_outstanding": payable.penalty_outstanding,
        "installment_outstanding": payable.installment_outstanding,
        "total_payable": payable.total_payable,
        "grace_status": payable.grace_status,
        "grace_crossed": payable.grace_crossed,
        "within_grace": payable.within_grace,
        "overdue_rank": payable.overdue_rank,
    }


def list_unpaid_schedules(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
    as_of: date | None = None,
) -> list[dict]:
    loan = (
        db.query(Loan)
        .filter(Loan.id == loan_id, Loan.finance_owner_id == finance_owner_id)
        .first()
    )
    if loan is None:
        return []

    open_statuses = [
        ScheduleStatus.PENDING.value,
        ScheduleStatus.PARTIAL.value,
        ScheduleStatus.OVERDUE.value,
    ]

    rows = (
        db.query(LoanSchedule)
        .filter(
            LoanSchedule.loan_id == loan_id,
            LoanSchedule.status.in_(open_statuses),
        )
        .order_by(LoanSchedule.schedule_date.asc())
        .all()
    )

    # Full schedule set required so grace ranks overdue rows oldest-first.
    all_rows = (
        db.query(LoanSchedule)
        .filter(LoanSchedule.loan_id == loan_id)
        .order_by(LoanSchedule.schedule_date.asc())
        .all()
    )

    today = as_of or date.today()
    settings = ensure_loan_penalty_from_settings(db, loan)
    payables = compute_loan_payables_for_loan(
        loan, all_rows, as_of=today, settings=settings
    )
    result = []
    for schedule in rows:
        payable = payables[schedule.id]
        if payable.total_payable <= ZERO:
            continue
        result.append(_schedule_row_dict(schedule, payable, today=today))
    return result


def list_loan_schedules(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
    as_of: date | None = None,
) -> list[dict]:
    """Full installment schedule for a loan (paid, partial, pending, overdue)."""
    loan = (
        db.query(Loan)
        .filter(Loan.id == loan_id, Loan.finance_owner_id == finance_owner_id)
        .first()
    )
    if loan is None:
        return []

    rows = (
        db.query(LoanSchedule)
        .filter(LoanSchedule.loan_id == loan_id)
        .order_by(LoanSchedule.schedule_date.asc())
        .all()
    )

    today = as_of or date.today()
    settings = ensure_loan_penalty_from_settings(db, loan)
    payables = compute_loan_payables_for_loan(
        loan, rows, as_of=today, settings=settings
    )
    result = []
    for schedule in rows:
        payable = payables[schedule.id]
        result.append(_schedule_row_dict(schedule, payable, today=today))
    return result


def get_open_schedules_for_loan(
    db: Session,
    loan_id: int,
    after_date: date | None = None,
) -> list[LoanSchedule]:
    open_statuses = [
        ScheduleStatus.PENDING.value,
        ScheduleStatus.PARTIAL.value,
        ScheduleStatus.OVERDUE.value,
    ]
    q = (
        db.query(LoanSchedule)
        .filter(
            LoanSchedule.loan_id == loan_id,
            LoanSchedule.status.in_(open_statuses),
        )
        .order_by(LoanSchedule.schedule_date.asc())
    )
    if after_date is not None:
        q = q.filter(LoanSchedule.schedule_date > after_date)
    return q.all()


def get_schedules_for_dates(
    db: Session,
    loan_id: int,
    schedule_dates: list[date],
) -> list[LoanSchedule]:
    if not schedule_dates:
        return []

    unique_dates = sorted(set(schedule_dates))
    rows = (
        db.query(LoanSchedule)
        .filter(
            LoanSchedule.loan_id == loan_id,
            LoanSchedule.schedule_date.in_(unique_dates),
        )
        .order_by(LoanSchedule.schedule_date.asc())
        .all()
    )
    by_date = {row.schedule_date: row for row in rows}
    missing = [d for d in unique_dates if d not in by_date]
    if missing:
        raise ValueError(f"No schedule for date(s): {', '.join(str(d) for d in missing)}")
    return [by_date[d] for d in unique_dates]


def schedule_installment_pending(schedule: LoanSchedule) -> Decimal:
    """Installment principal+profit pending only (excludes penalty)."""
    expected = Decimal(schedule.expected_amount)
    paid = Decimal(schedule.paid_amount)
    return max(expected - paid, ZERO).quantize(TWOPLACES)


def schedule_pending_amount(
    schedule: LoanSchedule,
    loan: Loan | None = None,
    all_schedules: list[LoanSchedule] | None = None,
    as_of: date | None = None,
    settings=None,
) -> Decimal:
    """
    Total payable for a schedule.

    When loan + all_schedules are provided, includes sequence-based penalty.
    Otherwise returns installment-only pending (legacy / tests without context).
    """
    if loan is not None and all_schedules is not None:
        grace, penalty = effective_penalty_config(loan, settings)
        payable = compute_installment_payable(
            schedule,
            ordered_schedules=all_schedules,
            grace_installments=grace,
            penalty_per_installment=penalty,
            as_of=as_of or date.today(),
        )
        return payable.total_payable
    return schedule_installment_pending(schedule)


def update_schedule_after_payment(
    schedule: LoanSchedule,
    principal_paid: Decimal,
    profit_paid: Decimal,
    amount_paid: Decimal,
    penalty_paid: Decimal = ZERO,
    *,
    loan: Loan | None = None,
    all_schedules: list[LoanSchedule] | None = None,
    as_of: date | None = None,
    settings=None,
) -> None:
    schedule.paid_principal += principal_paid
    schedule.paid_profit += profit_paid
    schedule.paid_amount += amount_paid
    if penalty_paid > ZERO:
        schedule.paid_penalty = (Decimal(schedule.paid_penalty or 0) + penalty_paid).quantize(
            TWOPLACES
        )

    installment_cleared = (
        schedule.paid_principal >= schedule.expected_principal
        and schedule.paid_profit >= schedule.expected_profit
    )

    penalty_cleared = True
    if loan is not None and all_schedules is not None:
        grace, penalty = effective_penalty_config(loan, settings)
        payable = compute_installment_payable(
            schedule,
            ordered_schedules=all_schedules,
            grace_installments=grace,
            penalty_per_installment=penalty,
            as_of=as_of or date.today(),
        )
        penalty_cleared = payable.penalty_outstanding <= ZERO

    if installment_cleared and penalty_cleared:
        schedule.status = ScheduleStatus.PAID.value
    elif schedule.paid_amount > ZERO or Decimal(schedule.paid_penalty or 0) > ZERO:
        schedule.status = ScheduleStatus.PARTIAL.value


def mark_overdue_schedules(
    db: Session,
    finance_owner_id: int,
    as_of: date,
) -> None:
    from backend.app.models.enums import CollectionModel

    schedules = (
        db.query(LoanSchedule)
        .join(Loan, LoanSchedule.loan_id == Loan.id)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
            Loan.collection_model == CollectionModel.DAILY_COLLECTION.value,
            LoanSchedule.schedule_date < as_of,
            LoanSchedule.status.in_(
                [ScheduleStatus.PENDING.value, ScheduleStatus.PARTIAL.value]
            ),
        )
        .all()
    )

    for schedule in schedules:
        schedule.status = ScheduleStatus.OVERDUE.value

    db.flush()

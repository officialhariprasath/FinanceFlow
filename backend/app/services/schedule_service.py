from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.enums import ScheduleStatus
from backend.app.models.loan import Loan
from backend.app.models.loan_schedule import LoanSchedule
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


def list_unpaid_schedules(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
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

    today = date.today()
    result = []
    for schedule in rows:
        expected = Decimal(schedule.expected_amount)
        paid = Decimal(schedule.paid_amount)
        pending = max(expected - paid, ZERO).quantize(TWOPLACES)
        result.append(
            {
                "schedule_date": schedule.schedule_date,
                "expected_amount": expected,
                "paid_amount": paid,
                "pending_amount": pending,
                "status": schedule.status,
                "is_today": schedule.schedule_date == today,
                "is_future": schedule.schedule_date > today,
            }
        )
    return result


def list_loan_schedules(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
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

    today = date.today()
    result = []
    for schedule in rows:
        expected = Decimal(schedule.expected_amount)
        paid = Decimal(schedule.paid_amount)
        pending = max(expected - paid, ZERO).quantize(TWOPLACES)
        result.append(
            {
                "schedule_date": schedule.schedule_date,
                "expected_amount": expected,
                "paid_amount": paid,
                "pending_amount": pending,
                "status": schedule.status,
                "is_today": schedule.schedule_date == today,
                "is_future": schedule.schedule_date > today,
            }
        )
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


def schedule_pending_amount(schedule: LoanSchedule) -> Decimal:
    expected = Decimal(schedule.expected_amount)
    paid = Decimal(schedule.paid_amount)
    return max(expected - paid, ZERO).quantize(TWOPLACES)


def update_schedule_after_payment(
    schedule: LoanSchedule,
    principal_paid: Decimal,
    profit_paid: Decimal,
    amount_paid: Decimal,
) -> None:
    schedule.paid_principal += principal_paid
    schedule.paid_profit += profit_paid
    schedule.paid_amount += amount_paid

    if (
        schedule.paid_principal >= schedule.expected_principal
        and schedule.paid_profit >= schedule.expected_profit
    ):
        schedule.status = ScheduleStatus.PAID.value
    elif schedule.paid_amount > ZERO:
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

"""Build CIBIL-style behavioral features for a customer."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models.financeflow_extended import LoanWriteOff
from backend.app.models.loan import Loan
from backend.app.models.loan_schedule import LoanSchedule


ZERO = Decimal("0.00")


def _as_float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


def build_customer_features(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
    as_of: date | None = None,
) -> dict[str, Any]:
    as_of = as_of or date.today()

    loans = (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.customer_id == customer_id,
        )
        .order_by(Loan.issue_date.asc())
        .all()
    )

    loan_ids = [loan.id for loan in loans]
    schedules: list[LoanSchedule] = []
    if loan_ids:
        schedules = (
            db.query(LoanSchedule)
            .filter(LoanSchedule.loan_id.in_(loan_ids))
            .order_by(LoanSchedule.schedule_date.asc())
            .all()
        )

    writeoff_count = 0
    if loan_ids:
        writeoff_count = (
            db.query(LoanWriteOff)
            .filter(
                LoanWriteOff.finance_owner_id == finance_owner_id,
                LoanWriteOff.loan_id.in_(loan_ids),
            )
            .count()
        )

    history_depth = len(loans)
    closed_loan_count = sum(1 for loan in loans if loan.status == "CLOSED")
    active_loan_count = sum(1 for loan in loans if loan.status == "ACTIVE")
    defaulted_count = sum(1 for loan in loans if loan.status == "DEFAULTED")

    # Prior loan amounts for dynamic suggest: prefer closed successful loans;
    # if none, use all non-defaulted principals.
    prior_principals: list[Decimal] = []
    closed_principals: list[Decimal] = []
    max_successful_principal = ZERO
    last_closed_principal = ZERO
    first_issue: date | None = None
    basic_loan_completed = 0
    total_outstanding = ZERO
    total_principal_all = ZERO

    for loan in loans:
        principal = Decimal(loan.principal_amount)
        total_principal_all += principal
        total_outstanding += Decimal(loan.remaining_principal)
        if first_issue is None or loan.issue_date < first_issue:
            first_issue = loan.issue_date

        if loan.status != "DEFAULTED":
            prior_principals.append(principal)

        if loan.status == "CLOSED" and (loan.closure_type or "NORMAL") != "WRITE_OFF":
            closed_principals.append(principal)
            last_closed_principal = principal
            if principal > max_successful_principal:
                max_successful_principal = principal
            if principal <= Decimal("3000.00"):
                basic_loan_completed = 1

        if (
            loan.status == "ACTIVE"
            and principal <= Decimal("3000.00")
            and Decimal(loan.remaining_principal) <= principal * Decimal("0.1")
        ):
            basic_loan_completed = max(basic_loan_completed, 1)

    avg_prior_principal = None
    if closed_principals:
        avg_prior_principal = float(sum(closed_principals) / len(closed_principals))
    elif prior_principals:
        avg_prior_principal = float(sum(prior_principals) / len(prior_principals))

    paid_schedules = [s for s in schedules if s.paid_on is not None]
    due_schedules = [s for s in schedules if s.schedule_date <= as_of]
    expected_total = sum((Decimal(s.expected_amount) for s in schedules), ZERO)
    expected_due = sum((Decimal(s.expected_amount) for s in due_schedules), ZERO)
    paid_total = sum((Decimal(s.paid_amount) for s in schedules), ZERO)
    penalty_paid_total = sum((Decimal(s.paid_penalty or 0) for s in schedules), ZERO)
    overdue_amount = sum(
        (
            Decimal(s.expected_amount) - Decimal(s.paid_amount)
            for s in schedules
            if (
                s.status == "OVERDUE"
                or (s.paid_on is None and s.schedule_date < as_of and s.status != "PAID")
            )
        ),
        ZERO,
    )

    on_time = 0
    late_days: list[int] = []
    dpd_7 = 0
    dpd_30 = 0
    last_late_on: date | None = None
    last_paid_on: date | None = None
    on_time_streak = 0
    streak_broken = False

    for schedule in paid_schedules:
        if last_paid_on is None or schedule.paid_on > last_paid_on:
            last_paid_on = schedule.paid_on
        lag = (schedule.paid_on - schedule.schedule_date).days
        if lag <= 0:
            on_time += 1
            late_days.append(0)
            if not streak_broken:
                on_time_streak += 1
        else:
            late_days.append(lag)
            streak_broken = True
            on_time_streak = 0
            if last_late_on is None or schedule.paid_on > last_late_on:
                last_late_on = schedule.paid_on
            if lag >= 7:
                dpd_7 += 1
            if lag >= 30:
                dpd_30 += 1

    # Streak from most recent paid schedules backward.
    on_time_streak = 0
    for schedule in reversed(paid_schedules):
        lag = (schedule.paid_on - schedule.schedule_date).days
        if lag <= 0:
            on_time_streak += 1
        else:
            break

    paid_count = len(paid_schedules)
    due_count = len(due_schedules)
    total_schedule_count = len(schedules)
    on_time_rate = (on_time / paid_count) if paid_count else None
    late_rate = ((paid_count - on_time) / paid_count) if paid_count else None
    avg_days_late = (sum(late_days) / len(late_days)) if late_days else None
    max_days_late = max(late_days) if late_days else None
    dpd_7_rate = (dpd_7 / paid_count) if paid_count else None
    dpd_30_rate = (dpd_30 / paid_count) if paid_count else None
    repayment_ratio = float(paid_total / expected_total) if expected_total > ZERO else None
    completion_ratio = (
        float(paid_total / expected_due) if expected_due > ZERO else None
    )
    schedule_completion = (
        (paid_count / total_schedule_count) if total_schedule_count else None
    )
    outstanding_ratio = (
        float(total_outstanding / total_principal_all) if total_principal_all > ZERO else None
    )
    overdue_amount_ratio = (
        float(overdue_amount / expected_due) if expected_due > ZERO else 0.0
    )

    current_overdue_count = sum(
        1
        for s in schedules
        if s.status == "OVERDUE"
        or (s.paid_on is None and s.schedule_date < as_of and s.status != "PAID")
    )

    days_since_last_late = None
    if last_late_on is not None:
        days_since_last_late = (as_of - last_late_on).days

    days_since_last_payment = None
    if last_paid_on is not None:
        days_since_last_payment = (as_of - last_paid_on).days

    months_as_customer = 0
    if first_issue is not None:
        months_as_customer = max(
            0,
            (as_of.year - first_issue.year) * 12 + (as_of.month - first_issue.month),
        )

    if history_depth == 0:
        file_type = "THIN"
    elif paid_count > 0 or closed_loan_count > 0 or basic_loan_completed:
        file_type = "THICK"
    else:
        file_type = "THIN"

    return {
        "history_depth": history_depth,
        "closed_loan_count": closed_loan_count,
        "active_loan_count": active_loan_count,
        "defaulted_count": defaulted_count,
        "writeoff_count": writeoff_count,
        "on_time_rate": on_time_rate,
        "late_rate": late_rate,
        "avg_days_late": avg_days_late,
        "max_days_late": max_days_late,
        "dpd_7_rate": dpd_7_rate,
        "dpd_30_rate": dpd_30_rate,
        "current_overdue_count": current_overdue_count,
        "repayment_ratio": repayment_ratio,
        "completion_ratio": completion_ratio,
        "schedule_completion": schedule_completion,
        "outstanding_ratio": outstanding_ratio,
        "overdue_amount_ratio": overdue_amount_ratio,
        "penalty_paid_total": _as_float(penalty_paid_total),
        "max_successful_principal": _as_float(max_successful_principal),
        "last_closed_principal": _as_float(last_closed_principal) or 0.0,
        "avg_prior_principal": avg_prior_principal,
        "prior_loan_count": len(closed_principals) or len(prior_principals),
        "months_as_customer": months_as_customer,
        "days_since_last_late": days_since_last_late,
        "days_since_last_payment": days_since_last_payment,
        "on_time_streak": on_time_streak,
        "paid_schedule_count": paid_count,
        "due_schedule_count": due_count,
        "total_schedule_count": total_schedule_count,
        "basic_loan_completed": basic_loan_completed,
        "file_type": file_type,
        "computed_as_of": as_of.isoformat(),
        "computed_at": datetime.utcnow().isoformat() + "Z",
    }

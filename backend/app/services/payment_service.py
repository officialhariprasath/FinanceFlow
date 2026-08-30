from datetime import date, datetime, time
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.customer import Customer
from backend.app.models.enums import CollectionModel, ScheduleStatus
from backend.app.models.loan import Loan
from backend.app.models.loan_schedule import LoanSchedule
from backend.app.models.payment import Payment
from backend.app.models.payment_allocation import PaymentAllocation
from backend.app.schemas.payment import PaymentCreate
from backend.app.services.capital_service import (
    record_principal_recovery,
)
from backend.app.services.payment_allocation_service import allocate_payment_amount
from backend.app.services.profit_service import record_profit_recognition
from backend.app.services.schedule_service import (
    get_schedule_for_payment,
    get_schedules_for_dates,
    mark_overdue_schedules,
    schedule_pending_amount,
    update_schedule_after_payment,
)
from backend.app.utils.interest_calculator import calculate_interest

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def calculate_outstanding_amount(
    loan: Loan,
    payment_date: date,
):
    interest_due = calculate_interest(
        principal=loan.remaining_principal,
        rate=loan.interest_rate,
        method=loan.interest_method,
        start_date=loan.last_interest_calculated_on,
        end_date=payment_date,
    )

    principal_due = loan.remaining_principal
    total_due = principal_due + interest_due

    return {
        "principal_due": principal_due,
        "interest_due": interest_due,
        "total_due": total_due,
    }


def _resolve_installment_schedules(
    db: Session,
    loan: Loan,
    payment: PaymentCreate,
) -> list[LoanSchedule]:
    if payment.schedule_dates:
        try:
            schedules = get_schedules_for_dates(db, loan.id, payment.schedule_dates)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
    else:
        schedule = get_schedule_for_payment(db, loan, payment.payment_date)
        if schedule is None:
            today = date.today()
            if payment.payment_date > today:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No installment scheduled for that date. Pick dates from the unpaid schedule list.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No open installment found for this payment date.",
            )
        schedules = [schedule]

    for schedule in schedules:
        if schedule.status == ScheduleStatus.PAID.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Installment on {schedule.schedule_date} is already paid.",
            )

    return schedules


def _allocate_across_schedules(
    amount: Decimal,
    schedules: list[LoanSchedule],
) -> tuple[Decimal, Decimal, list[tuple[LoanSchedule, Decimal, Decimal, Decimal]]]:
    """
    Apply payment amount across schedules in date order.
    Returns total principal, total profit, and per-schedule breakdown.
    """
    remaining = amount.quantize(TWOPLACES)
    total_principal = ZERO
    total_profit = ZERO
    breakdown: list[tuple[LoanSchedule, Decimal, Decimal, Decimal]] = []

    for schedule in schedules:
        if remaining <= ZERO:
            break

        profit_remaining = (schedule.expected_profit - schedule.paid_profit).quantize(TWOPLACES)
        principal_remaining = (schedule.expected_principal - schedule.paid_principal).quantize(TWOPLACES)
        pending = schedule_pending_amount(schedule)

        if pending <= ZERO:
            continue

        alloc_amount = min(remaining, pending)
        principal_paid, profit_paid = allocate_payment_amount(
            amount=alloc_amount,
            profit_remaining=profit_remaining,
            principal_remaining=principal_remaining,
        )
        paid_total = (principal_paid + profit_paid).quantize(TWOPLACES)
        if paid_total <= ZERO:
            continue

        breakdown.append((schedule, principal_paid, profit_paid, paid_total))
        total_principal += principal_paid
        total_profit += profit_paid
        remaining -= paid_total

    return (
        total_principal.quantize(TWOPLACES),
        total_profit.quantize(TWOPLACES),
        breakdown,
    )


def _create_daily_collection_payment(
    db: Session,
    payment: PaymentCreate,
    finance_owner_id: int,
    loan: Loan,
    collected_by_agent_id: int | None = None,
) -> Payment:
    amount = payment.amount_paid.quantize(TWOPLACES)

    if amount <= ZERO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than zero.",
        )

    mark_overdue_schedules(db, finance_owner_id, date.today())

    schedules = _resolve_installment_schedules(db, loan, payment)

    expected_total = sum(
        (schedule_pending_amount(s) for s in schedules), ZERO
    ).quantize(TWOPLACES)

    # Partial payments are allowed: apply oldest-first within the selected dates.
    # Reject only when amount exceeds what the selected installments still owe.
    if amount > expected_total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Amount ₹{amount} is more than ₹{expected_total} pending "
                f"on the selected installment(s). Reduce the amount or select more dates."
            ),
        )

    total_principal, total_profit, breakdown = _allocate_across_schedules(amount, schedules)

    if total_principal + total_profit <= ZERO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment does not match any outstanding schedule amount.",
        )

    applied = (total_principal + total_profit).quantize(TWOPLACES)
    if applied != amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not fully apply the payment amount to selected installments.",
        )

    first_date = breakdown[0][0].schedule_date
    last_date = breakdown[-1][0].schedule_date
    if len(breakdown) > 1:
        coverage_note = (
            f"Covers {len(breakdown)} installment(s) from {first_date} to {last_date}"
        )
    elif applied < expected_total:
        pending_left = (expected_total - applied).quantize(TWOPLACES)
        coverage_note = (
            f"Partial on {first_date}: paid ₹{applied}, ₹{pending_left} still pending"
        )
    else:
        coverage_note = None
    remarks = payment.remarks
    if coverage_note:
        remarks = f"{coverage_note}. {remarks}".strip() if remarks else coverage_note

    loan.remaining_principal -= total_principal
    loan.total_principal_paid += total_principal
    loan.total_profit_paid = (loan.total_profit_paid or ZERO) + total_profit
    loan.total_interest_paid = loan.total_profit_paid
    loan.last_interest_calculated_on = last_date

    if loan.remaining_principal <= ZERO:
        loan.remaining_principal = ZERO
        loan.status = "CLOSED"
        loan.closed_at = datetime.utcnow()

    db_payment = Payment(
        finance_owner_id=finance_owner_id,
        loan_id=loan.id,
        payment_date=first_date,
        amount_paid=total_principal + total_profit,
        interest_paid=total_profit,
        principal_paid=total_principal,
        payment_mode=payment.payment_mode,
        remarks=remarks,
        collected_by_agent_id=collected_by_agent_id,
        payment_reference=payment.payment_reference,
        is_locked=True,
    )
    db.add(db_payment)
    db.flush()

    allocation = PaymentAllocation(
        payment_id=db_payment.id,
        loan_id=loan.id,
        principal_amount=total_principal,
        profit_amount=total_profit,
        late_fee_amount=ZERO,
        other_amount=ZERO,
        total_amount=total_principal + total_profit,
    )
    db.add(allocation)

    for schedule, principal_paid, profit_paid, paid_total in breakdown:
        update_schedule_after_payment(
            schedule=schedule,
            principal_paid=principal_paid,
            profit_paid=profit_paid,
            amount_paid=paid_total,
        )

    if total_principal > ZERO:
        record_principal_recovery(
            db=db,
            finance_owner_id=finance_owner_id,
            loan_id=loan.id,
            payment_id=db_payment.id,
            amount=total_principal,
        )

    if total_profit > ZERO:
        record_profit_recognition(
            db=db,
            finance_owner_id=finance_owner_id,
            loan_id=loan.id,
            payment_id=db_payment.id,
            amount=total_profit,
        )

    if collected_by_agent_id is not None:
        from backend.app.services.agent_wallet_service import (
            credit_agent_wallet,
            payment_mode_to_channel,
        )

        credit_agent_wallet(
            db=db,
            agent_id=collected_by_agent_id,
            finance_owner_id=finance_owner_id,
            channel=payment_mode_to_channel(payment.payment_mode),
            amount=total_principal + total_profit,
            payment_id=db_payment.id,
            payment_reference=payment.payment_reference,
            notes=remarks,
        )

    db.commit()
    db.refresh(db_payment)
    return db_payment


def create_payment(
    db: Session,
    payment: PaymentCreate,
    finance_owner_id: int,
    collected_by_agent_id: int | None = None,
):
    loan = (
        db.query(Loan)
        .filter(
            Loan.id == payment.loan_id,
            Loan.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found.",
        )

    if loan.status == "CLOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loan is already closed.",
        )

    if loan.collection_model == CollectionModel.DAILY_COLLECTION.value:
        return _create_daily_collection_payment(
            db=db,
            payment=payment,
            finance_owner_id=finance_owner_id,
            loan=loan,
            collected_by_agent_id=collected_by_agent_id,
        )

    amount = Decimal(payment.amount_paid)

    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than zero.",
        )

    due = calculate_outstanding_amount(
        loan=loan,
        payment_date=payment.payment_date,
    )

    interest_due = due["interest_due"]

    interest_paid = min(amount, interest_due)
    principal_paid = amount - interest_paid

    if principal_paid > loan.remaining_principal:
        principal_paid = loan.remaining_principal

    loan.remaining_principal -= principal_paid
    loan.total_principal_paid += principal_paid
    loan.total_interest_paid += interest_paid
    loan.last_interest_calculated_on = payment.payment_date

    if loan.remaining_principal <= Decimal("0.00"):
        loan.remaining_principal = Decimal("0.00")
        loan.status = "CLOSED"
        loan.closed_at = datetime.utcnow()

    db_payment = Payment(
        finance_owner_id=finance_owner_id,
        loan_id=loan.id,
        payment_date=payment.payment_date,
        amount_paid=payment.amount_paid,
        interest_paid=interest_paid,
        principal_paid=principal_paid,
        payment_mode=payment.payment_mode,
        remarks=payment.remarks,
        collected_by_agent_id=collected_by_agent_id,
        payment_reference=payment.payment_reference,
        is_locked=True,
    )

    db.add(db_payment)
    db.flush()

    if collected_by_agent_id is not None:
        from backend.app.services.agent_wallet_service import (
            credit_agent_wallet,
            payment_mode_to_channel,
        )

        credit_agent_wallet(
            db=db,
            agent_id=collected_by_agent_id,
            finance_owner_id=finance_owner_id,
            channel=payment_mode_to_channel(payment.payment_mode),
            amount=Decimal(payment.amount_paid).quantize(TWOPLACES),
            payment_id=db_payment.id,
            payment_reference=payment.payment_reference,
            notes=payment.remarks,
        )

    db.commit()
    db.refresh(db_payment)

    return db_payment


def get_payment_preview(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
    payment_date: date,
    amount_paid: Decimal,
    schedule_dates: list[date] | None = None,
):
    loan = (
        db.query(Loan)
        .filter(
            Loan.id == loan_id,
            Loan.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found.",
        )

    amount = amount_paid.quantize(TWOPLACES)

    if loan.collection_model != CollectionModel.DAILY_COLLECTION.value:
        due = calculate_outstanding_amount(loan=loan, payment_date=payment_date)
        interest_due = due["interest_due"]
        interest_paid = min(amount, interest_due)
        principal_paid = min(amount - interest_paid, loan.remaining_principal)
        total = (principal_paid + interest_paid).quantize(TWOPLACES)
        return {
            "principal_amount": principal_paid.quantize(TWOPLACES),
            "profit_amount": interest_paid.quantize(TWOPLACES),
            "total_amount": total,
            "installment_count": 1,
            "unapplied_amount": (amount - total).quantize(TWOPLACES),
            "lines": [],
        }

    preview_payment = PaymentCreate(
        loan_id=loan_id,
        payment_date=payment_date,
        amount_paid=amount,
        payment_mode="Cash",
        schedule_dates=schedule_dates,
    )
    schedules = _resolve_installment_schedules(db, loan, preview_payment)
    total_principal, total_profit, breakdown = _allocate_across_schedules(amount, schedules)
    applied = (total_principal + total_profit).quantize(TWOPLACES)

    applied_by_schedule = {s.id: paid_total for s, _, _, paid_total in breakdown}

    lines = []
    for schedule in schedules:
        pending = schedule_pending_amount(schedule)
        applied_amt = applied_by_schedule.get(schedule.id, ZERO).quantize(TWOPLACES)
        remaining = (pending - applied_amt).quantize(TWOPLACES)
        if applied_amt <= ZERO and remaining <= ZERO:
            continue
        if remaining <= ZERO and applied_amt > ZERO:
            status_after = "PAID"
        elif applied_amt > ZERO:
            status_after = "PARTIAL"
        else:
            status_after = schedule.status
        lines.append(
            {
                "schedule_date": schedule.schedule_date,
                "expected_pending": pending,
                "applied_amount": applied_amt,
                "remaining_pending": max(remaining, ZERO),
                "status_after": status_after,
            }
        )

    return {
        "principal_amount": total_principal,
        "profit_amount": total_profit,
        "total_amount": applied,
        "installment_count": len(breakdown),
        "unapplied_amount": (amount - applied).quantize(TWOPLACES),
        "lines": lines,
    }


def get_payment(
    db: Session,
    payment_id: int,
    finance_owner_id: int,
):
    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id,
            Payment.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found.",
        )

    return payment


def get_loan_payments(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
):
    return (
        db.query(Payment)
        .filter(
            Payment.loan_id == loan_id,
            Payment.finance_owner_id == finance_owner_id,
        )
        .order_by(Payment.payment_date.desc())
        .all()
    )


def delete_payment(
    db: Session,
    payment_id: int,
    finance_owner_id: int,
):
    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id,
            Payment.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found.",
        )

    if payment.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Locked payments cannot be deleted. Request a reversal from the owner.",
        )

    loan = (
        db.query(Loan)
        .filter(
            Loan.id == payment.loan_id,
            Loan.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found.",
        )

    if loan.collection_model == CollectionModel.DAILY_COLLECTION.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment deletion is not supported for daily collection loans yet.",
        )

    latest_payment = (
        db.query(Payment)
        .filter(
            Payment.loan_id == payment.loan_id,
            Payment.finance_owner_id == finance_owner_id,
        )
        .order_by(Payment.payment_date.desc(), Payment.id.desc())
        .first()
    )

    if latest_payment.id != payment.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only the latest payment can be deleted.",
        )

    loan.remaining_principal += payment.principal_paid
    loan.total_principal_paid -= payment.principal_paid
    loan.total_interest_paid -= payment.interest_paid

    previous_payment = (
        db.query(Payment)
        .filter(
            Payment.loan_id == loan.id,
            Payment.finance_owner_id == finance_owner_id,
            Payment.payment_date < payment.payment_date,
        )
        .order_by(Payment.payment_date.desc())
        .first()
    )

    if previous_payment:
        loan.last_interest_calculated_on = previous_payment.payment_date
    else:
        loan.last_interest_calculated_on = loan.issue_date

    if loan.status == "CLOSED":
        loan.status = "ACTIVE"
        loan.closed_at = None

    db.delete(payment)
    db.commit()

    return {
        "message": "Payment deleted successfully"
    }

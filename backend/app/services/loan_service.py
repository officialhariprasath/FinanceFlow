from datetime import datetime, date, timedelta
from sqlalchemy import extract
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.customer import Customer
from backend.app.models.payment import Payment
from backend.app.models.loan import Loan
from backend.app.models.enums import CollectionModel, CollectionFrequency
from backend.app.schemas.loan import LoanCreate, LoanUpdate
from backend.app.utils.interest_calculator import calculate_interest
from backend.app.schemas.loan import (
    LoanStatementPaymentResponse,
    LoanStatementResponse,
)
from backend.app.services.capital_service import (
    get_available_capital,
    record_loan_disbursement,
)
from backend.app.services.schedule_service import generate_installment_schedule
from backend.app.utils.date_helpers import last_installment_date

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def create_loan(
    db: Session,
    loan: LoanCreate,
    finance_owner_id: int,
):
    customer = (
        db.query(Customer)
        .filter(
            Customer.id == loan.customer_id,
            Customer.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    principal = loan.principal_amount.quantize(TWOPLACES)
    available = get_available_capital(db, finance_owner_id)

    if principal > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient available capital.",
        )

    collection_model = loan.collection_model or CollectionModel.STANDARD.value

    if collection_model == CollectionModel.DAILY_COLLECTION.value:
        frequency = (loan.collection_frequency or CollectionFrequency.DAILY.value).upper()
        if frequency not in {f.value for f in CollectionFrequency}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid collection frequency.",
            )

        installment_count = loan.installment_count or loan.duration_days
        if not installment_count or installment_count <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Installment count is required for collection loans.",
            )
        if not loan.daily_payment or loan.daily_payment <= ZERO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Installment amount is required for collection loans.",
            )

        daily_principal = (loan.daily_principal or ZERO).quantize(TWOPLACES)
        daily_profit = (loan.daily_profit or ZERO).quantize(TWOPLACES)
        daily_payment = loan.daily_payment.quantize(TWOPLACES)

        if daily_principal + daily_profit != daily_payment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Installment principal plus profit must equal installment amount.",
            )

        due_start_date = loan.due_start_date or loan.issue_date
        if due_start_date < loan.issue_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="First collection date cannot be before issue date.",
            )

        due_date = last_installment_date(due_start_date, frequency, installment_count)
        total_expected_profit = daily_profit * installment_count
        interest_method = CollectionModel.DAILY_COLLECTION.value
        interest_rate = ZERO
        duration_days = installment_count if frequency == CollectionFrequency.DAILY.value else None
    else:
        due_date = loan.due_date
        daily_principal = None
        daily_profit = None
        daily_payment = None
        total_expected_profit = None
        interest_method = loan.interest_method
        interest_rate = loan.interest_rate
        frequency = None
        installment_count = None
        due_start_date = None
        duration_days = None

        if due_date <= loan.issue_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Due date must be after issue date.",
            )

    db_loan = Loan(
        finance_owner_id=finance_owner_id,
        customer_id=loan.customer_id,
        principal_amount=principal,
        remaining_principal=principal,
        total_principal_paid=ZERO,
        total_interest_paid=ZERO,
        interest_method=interest_method,
        interest_rate=interest_rate,
        issue_date=loan.issue_date,
        due_date=due_date,
        interest_start_date=loan.issue_date,
        last_interest_calculated_on=loan.issue_date,
        status="ACTIVE",
        collection_model=collection_model,
        duration_days=duration_days if collection_model == CollectionModel.DAILY_COLLECTION.value else None,
        collection_frequency=frequency or CollectionFrequency.DAILY.value,
        installment_count=installment_count,
        due_start_date=due_start_date,
        daily_payment=daily_payment,
        daily_principal=daily_principal,
        daily_profit=daily_profit,
        total_expected_profit=total_expected_profit,
        total_profit_paid=ZERO,
    )

    db.add(db_loan)
    db.flush()

    if collection_model == CollectionModel.DAILY_COLLECTION.value:
        generate_installment_schedule(db, db_loan)

    record_loan_disbursement(
        db=db,
        finance_owner_id=finance_owner_id,
        loan_id=db_loan.id,
        amount=principal,
    )

    db.commit()
    db.refresh(db_loan)

    return db_loan


def get_loans(
    db: Session,
    finance_owner_id: int,
):
    return (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id
        )
        .all()
    )


def get_loan_by_id(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
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

    return loan


def get_loans_by_customer(
    db: Session,
    customer_id: int,
    finance_owner_id: int,
):
    """
    Return all loans belonging to the specified customer.
    """

    return (
        db.query(Loan)
        .filter(
            Loan.customer_id == customer_id,
            Loan.finance_owner_id == finance_owner_id,
        )
        .all()
    )


def update_loan(
    db: Session,
    loan_id: int,
    loan_data: LoanUpdate,
    finance_owner_id: int,
):
    """
    Update editable loan information.
    """

    loan = (
        db.query(Loan)
        .filter(
            Loan.id == loan_id,
            Loan.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    if not loan:
        return None

    if loan.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only active loans can be edited.",
        )

    loan.interest_method = loan_data.interest_method
    loan.interest_rate = loan_data.interest_rate
    loan.due_date = loan_data.due_date

    db.commit()
    db.refresh(loan)

    return loan


def search_loans(
    db: Session,
    finance_owner_id: int,
    customer_name: Optional[str] = None,
    mobile_number: Optional[str] = None,
    status_filter: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    """
    Search loans using one or more optional filters.
    """

    query = (
        db.query(Loan)
        .join(Customer)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Customer.finance_owner_id == finance_owner_id,
        )
    )

    if mobile_number:
        query = query.filter(
            Customer.phone.ilike(f"%{mobile_number}%")
        )

    if status_filter:
        query = query.filter(
            Loan.status == status_filter.upper()
        )

    if from_date:
        query = query.filter(
            Loan.issue_date >= from_date
        )

    if to_date:
        query = query.filter(
            Loan.issue_date <= to_date
        )

    return (
        query.order_by(Loan.issue_date.desc())
        .all()
    )

def get_loans_due_this_month(
    db: Session,
    finance_owner_id: int,
):
    """
    Return all active loans whose due date falls in the current month.
    """

    today = date.today()

    return (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
            extract("month", Loan.due_date) == today.month,
            extract("year", Loan.due_date) == today.year,
        )
        .order_by(Loan.due_date.asc())
        .all()
    )

def get_loans_due_by_month(
    db: Session,
    finance_owner_id: int,
    month: int,
    year: int,
):
    """
    Return all active loans due in the specified month and year.
    """

    return (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
            extract("month", Loan.due_date) == month,
            extract("year", Loan.due_date) == year,
        )
        .order_by(Loan.due_date.asc())
        .all()
    )

def calculate_current_outstanding(
    loan: Loan,
    calculation_date: date,
):
    """
    Calculate the current outstanding amount for a loan.
    Nothing is persisted to the database.
    """

    accrued_interest = calculate_interest(
        principal=loan.remaining_principal,
        rate=loan.interest_rate,
        method=loan.interest_method,
        start_date=loan.last_interest_calculated_on,
        end_date=calculation_date,
    )

    total_outstanding = (
        loan.remaining_principal +
        accrued_interest
    )

    return {
        "accrued_interest": accrued_interest,
        "total_outstanding": total_outstanding,
    }

def get_interest_summary(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
):
    """
    Return the current interest summary for a loan.

    The calculation is performed dynamically using today's date.
    Nothing is stored in the database.
    """

    # Fetch the requested loan only if it belongs to
    # the authenticated finance owner.
    loan = (
        db.query(Loan)
        .filter(
            Loan.id == loan_id,
            Loan.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    # Loan does not exist or belongs to another owner.
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found.",
        )

    # Interest is calculated up to today's date.
    today = date.today()

    # Use the existing utility so that the same
    outstanding = calculate_current_outstanding(
        loan=loan,
        calculation_date=today,
    )

    # Return a lightweight summary.
    # This endpoint will later be reused by:
    # - Dashboard
    # - Loan Closure
    # - Profit Reports
    # Normalize the interest method before returning it
    # so every API response follows the same format.
    interest_method = loan.interest_method.strip().upper()

    return {
        "loan_id": loan.id,
        "principal_amount": loan.principal_amount,
        "remaining_principal": loan.remaining_principal,
        "interest_method": interest_method,
        "interest_rate": loan.interest_rate,
        "accrued_interest": outstanding["accrued_interest"],
        "total_payable": outstanding["total_outstanding"],
        "calculated_to": today,
    }

def get_loan_statement(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
):
    """
    Return the complete statement for a single loan.
    """

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

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == loan.customer_id,
            Customer.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    payments = (
        db.query(Payment)
        .filter(
            Payment.loan_id == loan.id,
            Payment.finance_owner_id == finance_owner_id,
        )
        .order_by(Payment.payment_date.desc())
        .all()
    )

    outstanding = calculate_current_outstanding(
        loan=loan,
        calculation_date=date.today(),
    )

    payment_history = []

    for payment in payments:
        payment_history.append(
            LoanStatementPaymentResponse(
                payment_date=payment.payment_date,
                amount_paid=payment.amount_paid,
                principal_paid=payment.principal_paid,
                interest_paid=payment.interest_paid,
                payment_mode=payment.payment_mode,
                remarks=payment.remarks,
            )
        )

    return LoanStatementResponse(
        loan=loan,
        customer_name=customer.full_name,
        customer_phone=customer.phone,
        accrued_interest=outstanding["accrued_interest"],
        total_outstanding=outstanding["total_outstanding"],
        payments=payment_history,
    )

def get_settlement_preview(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
    settlement_date: date,
):
    loan = get_loan_by_id(
        db=db,
        loan_id=loan_id,
        finance_owner_id=finance_owner_id,
    )

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == loan.customer_id,
            Customer.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    outstanding = calculate_current_outstanding(
        loan=loan,
        calculation_date=settlement_date,
    )

    return {
        "loan_id": loan.id,
        "customer_name": customer.full_name,
        "principal_outstanding": loan.remaining_principal,
        "interest_outstanding": outstanding["accrued_interest"],
        "total_outstanding": outstanding["total_outstanding"],
    }

def settle_loan(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
    settlement,
):
    """
    Settle a loan by accepting a negotiated amount and
    waiving the remaining balance.
    """

    loan = get_loan_by_id(
        db=db,
        loan_id=loan_id,
        finance_owner_id=finance_owner_id,
    )

    if loan.status == "CLOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loan is already closed.",
        )

    outstanding = calculate_current_outstanding(
        loan=loan,
        calculation_date=settlement.settlement_date,
    )

    interest_due = outstanding["accrued_interest"]
    total_due = outstanding["total_outstanding"]

    settlement_amount = Decimal(settlement.settlement_amount)

    if settlement_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settlement amount must be greater than zero.",
        )

    if settlement_amount > total_due:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settlement amount cannot exceed total outstanding.",
        )

    interest_paid = min(settlement_amount, interest_due)

    principal_paid = settlement_amount - interest_paid

    if principal_paid <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settlement amount must include some principal payment.",
        )

    if principal_paid > loan.remaining_principal:
        principal_paid = loan.remaining_principal

    waived_amount = total_due - settlement_amount

    payment = Payment(
        finance_owner_id=finance_owner_id,
        loan_id=loan.id,
        payment_date=settlement.settlement_date,
        amount_paid=settlement_amount,
        principal_paid=principal_paid,
        interest_paid=interest_paid,
        payment_mode=settlement.payment_mode,
        remarks=settlement.settlement_reason,
    )

    db.add(payment)

    loan.total_interest_paid += interest_paid
    loan.total_principal_paid += principal_paid
    loan.remaining_principal = Decimal("0.00")
    loan.last_interest_calculated_on = settlement.settlement_date

    loan.status = "CLOSED"
    loan.closed_at = datetime.utcnow()

    loan.settlement_amount = settlement_amount
    loan.waived_amount = waived_amount
    loan.settlement_date = settlement.settlement_date
    loan.settlement_reason = settlement.settlement_reason
    loan.closure_type = "SETTLEMENT"

    db.commit()
    db.refresh(loan)

    return loan
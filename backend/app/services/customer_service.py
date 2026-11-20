from sqlalchemy import or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.app.models.customer import Customer
from backend.app.schemas.customer import (
    CustomerCreate,
    CustomerCreditScoreSummary,
    CustomerLedgerPaymentResponse,
    CustomerLedgerLoanResponse,
    CustomerLedgerSummaryResponse,
    CustomerLedgerResponse,
)

from backend.app.models.loan import Loan
from backend.app.models.payment import Payment
from backend.app.utils.interest_calculator import calculate_interest

from decimal import Decimal
from datetime import date


_KYC_ATTRS = (
    "id_type",
    "id_number",
    "alternate_phone",
    "date_of_birth",
    "gender",
    "occupation",
    "business_name",
    "monthly_income",
    "area_landmark",
    "house_ownership",
    "guarantor_name",
    "guarantor_phone",
    "reference1_name",
    "reference1_phone",
    "reference2_name",
    "reference2_phone",
    "has_other_loans",
    "other_loans_emi",
)


def _apply_customer_fields(db_customer: Customer, data: CustomerCreate) -> None:
    db_customer.full_name = data.full_name
    db_customer.phone = data.phone
    db_customer.permanent_address = data.permanent_address
    db_customer.temporary_address = data.temporary_address
    for attr in _KYC_ATTRS:
        setattr(db_customer, attr, getattr(data, attr, None))


def create_customer(
    db: Session,
    customer: CustomerCreate,
    finance_owner_id: int,
) -> Customer:
    """
    Create a new customer for the authenticated finance owner.
    """
    from backend.app.utils.display_codes import allocate_display_code

    display_code = allocate_display_code(db, finance_owner_id, "customer")

    db_customer = Customer(
        finance_owner_id=finance_owner_id,
        display_code=display_code,
    )
    _apply_customer_fields(db_customer, customer)

    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)

    return db_customer


def get_customers(
    db: Session,
    finance_owner_id: int,
):
    """
    Return all customers belonging to the authenticated finance owner.
    """

    return (
        db.query(Customer)
        .filter(Customer.finance_owner_id == finance_owner_id)
        .all()
    )


def get_customer_names(
    db: Session,
    finance_owner_id: int,
):
    """
    Return only customer IDs and names for dropdown selection.
    """

    return (
        db.query(Customer.id, Customer.display_code, Customer.full_name)
        .filter(Customer.finance_owner_id == finance_owner_id)
        .order_by(Customer.full_name)
        .all()
    )

def search_customers(
    db: Session,
    finance_owner_id: int,
    query: str,
):
    """
    Search customers by name, phone, or display code.
    """

    return (
        db.query(Customer)
        .filter(
            Customer.finance_owner_id == finance_owner_id,
            or_(
                Customer.full_name.ilike(f"%{query}%"),
                Customer.phone.ilike(f"%{query}%"),
                Customer.display_code.ilike(f"%{query}%"),
            ),
        )
        .order_by(Customer.full_name)
        .all()
    )

def get_customer_by_id(
    db: Session,
    customer_id: int,
    finance_owner_id: int,
) -> Customer:
    """
    Return a single customer by ID.
    """

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    return customer


def update_customer(
    db: Session,
    customer_id: int,
    finance_owner_id: int,
    data: CustomerCreate,
) -> Customer:
    """
    Update an existing customer's details.
    """

    customer = get_customer_by_id(
        db=db,
        customer_id=customer_id,
        finance_owner_id=finance_owner_id,
    )

    _apply_customer_fields(customer, data)

    db.commit()
    db.refresh(customer)

    return customer


def delete_customer(
    db: Session,
    customer_id: int,
    finance_owner_id: int,
) -> None:
    """
    Delete a customer and all associated records.
    """

    customer = get_customer_by_id(
        db=db,
        customer_id=customer_id,
        finance_owner_id=finance_owner_id,
    )

    db.delete(customer)
    db.commit()


def get_customer_ledger(
    db: Session,
    customer_id: int,
    finance_owner_id: int,
):
    """
    Return the complete ledger for a customer.
    """

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.finance_owner_id == finance_owner_id,
        )
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    loans = (
        db.query(Loan)
        .filter(
            Loan.customer_id == customer.id,
            Loan.finance_owner_id == finance_owner_id,
        )
        .order_by(Loan.issue_date.desc())
        .all()
    )

    ledger_loans = []

    total_principal = Decimal("0.00")
    remaining_principal = Decimal("0.00")
    total_interest_paid = Decimal("0.00")
    accrued_interest = Decimal("0.00")

    active_loans = 0
    closed_loans = 0

    today = date.today()

    for loan in loans:

        if loan.status == "ACTIVE":
            active_loans += 1
        else:
            closed_loans += 1

        total_principal += loan.principal_amount
        remaining_principal += loan.remaining_principal
        total_interest_paid += loan.total_interest_paid

        current_interest = calculate_interest(
            principal=loan.remaining_principal,
            rate=loan.interest_rate,
            method=loan.interest_method,
            start_date=loan.last_interest_calculated_on,
            end_date=today,
        )

        accrued_interest += current_interest

        payments = (
            db.query(Payment)
            .filter(
                Payment.loan_id == loan.id,
                Payment.finance_owner_id == finance_owner_id,
            )
            .order_by(Payment.payment_date.desc())
            .all()
        )

        ledger_payments = []

        for payment in payments:
            ledger_payments.append(
                CustomerLedgerPaymentResponse(
                    payment_date=payment.payment_date,
                    amount_paid=payment.amount_paid,
                    principal_paid=payment.principal_paid,
                    interest_paid=payment.interest_paid,
                    payment_mode=payment.payment_mode,
                    remarks=payment.remarks,
                )
            )

        ledger_loans.append(
            CustomerLedgerLoanResponse(
                loan_id=loan.id,
                display_code=getattr(loan, "display_code", None) or f"#{loan.id}",
                principal_amount=loan.principal_amount,
                remaining_principal=loan.remaining_principal,
                total_principal_paid=loan.total_principal_paid,
                total_interest_paid=loan.total_interest_paid,
                accrued_interest=current_interest,
                total_outstanding=loan.remaining_principal + current_interest,
                issue_date=loan.issue_date,
                due_date=loan.due_date,
                status=loan.status,
                payments=ledger_payments,
            )
        )

    credit_score = None
    try:
        from backend.app.services.credit_score.score_service import (
            get_or_compute_customer_score,
            score_to_response_dict,
        )

        score_row = get_or_compute_customer_score(
            db, finance_owner_id, customer_id, commit=True
        )
        payload = score_to_response_dict(score_row)
        credit_score = CustomerCreditScoreSummary(
            score=payload["score"],
            band=payload["band"],
            file_type=payload["file_type"],
            suggested_max_amount=payload["suggested_max_amount"],
            reasons=payload.get("reasons") or [],
            scorecard_version=payload.get("scorecard_version"),
            computed_at=str(payload.get("computed_at") or ""),
            advisory_only=True,
            score_max=1000,
        )
    except Exception:
        # Last-resort visible score so the UI never looks empty.
        credit_score = CustomerCreditScoreSummary(
            score=500,
            band="THIN_FILE",
            file_type="THIN",
            suggested_max_amount=Decimal("2000.00"),
            reasons=[
                {
                    "code": "SCORE_FALLBACK",
                    "label": "Score temporarily estimated — refresh after deploy/migration",
                    "points": 0,
                }
            ],
            scorecard_version="fallback",
            computed_at="",
            advisory_only=True,
            score_max=1000,
        )

    return CustomerLedgerResponse(
        customer=customer,
        summary=CustomerLedgerSummaryResponse(
            total_loans=len(loans),
            active_loans=active_loans,
            closed_loans=closed_loans,
            total_principal=total_principal,
            remaining_principal=remaining_principal,
            total_interest_paid=total_interest_paid,
            accrued_interest=accrued_interest,
            total_outstanding=remaining_principal + accrued_interest,
        ),
        loans=ledger_loans,
        credit_score=credit_score,
    )
from decimal import Decimal
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy import and_

from backend.app.models.customer import Customer
from backend.app.models.loan import Loan
from backend.app.models.payment import Payment
from backend.app.utils.interest_calculator import calculate_interest
from backend.app.schemas.dashboard import (
    DashboardResponse,
    RecentLoanItem,
    RecentPaymentItem,
    ProfitSummaryResponse,
    MaturityLoanResponse,
    MaturityReportResponse,
    OverdueLoanResponse,
    OverdueLoansResponse,
    ClosedLoanResponse,
    ClosedLoansReportResponse,
)
from backend.app.models.enums import PaymentMode


def get_dashboard(
    db: Session,
    finance_owner_id: int,
):
    """
    Return dashboard statistics for the authenticated finance owner.
    """

    # ---------------------------------
    # Customer Statistics
    # ---------------------------------

    total_customers = (
        db.query(Customer)
        .filter(
            Customer.finance_owner_id == finance_owner_id,
        )
        .count()
    )

    # ---------------------------------
    # Loan Statistics
    # ---------------------------------

    active_loans = (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
        )
        .count()
    )

    closed_loans = (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "CLOSED",
        )
        .count()
    )

    # ---------------------------------
    # Financial Statistics
    # ---------------------------------

    # SUM(principal_amount) across all loans — matches the raw SQL.
    total_principal_disbursed = (
        db.query(
            func.coalesce(
                func.sum(Loan.principal_amount),
                Decimal("0.00"),
            )
        )
        .filter(
            Loan.finance_owner_id == finance_owner_id,
        )
        .scalar()
    )

    # SUM(remaining_principal) across all loans — matches the raw SQL.
    remaining_principal = (
        db.query(
            func.coalesce(
                func.sum(Loan.remaining_principal),
                Decimal("0.00"),
            )
        )
        .filter(
            Loan.finance_owner_id == finance_owner_id,
        )
        .scalar()
    )

    # Sum payments directly from the Payment table — single source of truth.
    total_principal_paid = (
        db.query(
            func.coalesce(
                func.sum(Payment.principal_paid),
                Decimal("0.00"),
            )
        )
        .filter(
            Payment.finance_owner_id == finance_owner_id,
        )
        .scalar()
    )

    total_interest_paid = (
        db.query(
            func.coalesce(
                func.sum(Payment.interest_paid),
                Decimal("0.00"),
            )
        )
        .filter(
            Payment.finance_owner_id == finance_owner_id,
        )
        .scalar()
    )

    today_collection = (
        db.query(
            func.coalesce(
                func.sum(Payment.amount_paid),
                Decimal("0.00"),
            )
        )
        .filter(
            Payment.finance_owner_id == finance_owner_id,
            Payment.payment_date == date.today(),
        )
        .scalar()
    )

    # ---------------------------------
    # Recent Activity
    # ---------------------------------

    recent_loans = (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
        )
        .order_by(Loan.id.desc())
        .limit(5)
        .all()
    )

    recent_payments = (
        db.query(Payment)
        .filter(
            Payment.finance_owner_id == finance_owner_id,
        )
        .order_by(Payment.id.desc())
        .limit(5)
        .all()
    )

    # Normalize legacy payment modes from the database.
    payment_mode_map = {
        "cash": PaymentMode.CASH,
        "upi": PaymentMode.UPI,
        "bank transfer": PaymentMode.BANK_TRANSFER,
        "bank_transfer": PaymentMode.BANK_TRANSFER,
        "banktransfer": PaymentMode.BANK_TRANSFER,
        "cheque": PaymentMode.CHEQUE,
        "check": PaymentMode.CHEQUE,
        # Legacy value used by older versions
        "settlement": PaymentMode.CASH,
    }

    for payment in recent_payments:
        value = str(payment.payment_mode).strip().lower()
        if value in payment_mode_map:
            payment.payment_mode = payment_mode_map[value]

    # Build customer id -> name map for recent loans and payments.
    loan_customer_ids = {loan.customer_id for loan in recent_loans}
    payment_loan_ids = {p.loan_id for p in recent_payments}

    # Fetch customer names for recent loans.
    loan_customers = (
        db.query(Customer)
        .filter(Customer.id.in_(loan_customer_ids))
        .all()
    ) if loan_customer_ids else []
    customer_name_map = {c.id: c.full_name for c in loan_customers}

    # Fetch loan->customer mapping for recent payments.
    payment_loans = (
        db.query(Loan)
        .filter(Loan.id.in_(payment_loan_ids))
        .all()
    ) if payment_loan_ids else []
    loan_customer_id_map = {l.id: l.customer_id for l in payment_loans}
    # Merge any new customer ids from payment loans.
    extra_ids = set(loan_customer_id_map.values()) - set(customer_name_map.keys())
    if extra_ids:
        extra_customers = (
            db.query(Customer)
            .filter(Customer.id.in_(extra_ids))
            .all()
        )
        for c in extra_customers:
            customer_name_map[c.id] = c.full_name

    enriched_loans = []
    for loan in recent_loans:
        item = RecentLoanItem.model_validate(loan)
        item.customer_name = customer_name_map.get(loan.customer_id, "")
        enriched_loans.append(item)

    enriched_payments = []
    for payment in recent_payments:
        item = RecentPaymentItem.model_validate(payment)
        cid = loan_customer_id_map.get(payment.loan_id)
        item.customer_name = customer_name_map.get(cid, "") if cid else ""
        enriched_payments.append(item)

    # ---------------------------------
    # Return Dashboard
    # ---------------------------------

    return DashboardResponse(
        total_customers=total_customers,
        active_loans=active_loans,
        closed_loans=closed_loans,
        total_principal_disbursed=total_principal_disbursed,
        remaining_principal=remaining_principal,
        total_principal_paid=total_principal_paid,
        total_interest_paid=total_interest_paid,
        today_collection=today_collection,
        recent_loans=enriched_loans,
        recent_payments=enriched_payments,
    )


def get_profit_summary(
    db: Session,
    finance_owner_id: int,
    from_date: date,
    to_date: date,
):
    """
    Return the profit summary for the selected date range.

    Interest is calculated dynamically up to today so the
    report always reflects the latest accrued amount.
    """

    # Fetch all loans issued within the selected period.
    loans = (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.issue_date >= from_date,
            Loan.issue_date <= to_date,
        )
        .all()
    )

    total_principal = Decimal("0.00")
    total_interest = Decimal("0.00")

    today = date.today()

    # Calculate the latest accrued interest for every loan.
    for loan in loans:

        total_principal += loan.principal_amount

        accrued_interest = calculate_interest(
            principal=loan.remaining_principal,
            rate=loan.interest_rate,
            method=loan.interest_method,
            start_date=loan.last_interest_calculated_on,
            end_date=today,
        )

        # Add both collected interest and currently accrued interest.
        total_interest += (
            loan.total_interest_paid +
            accrued_interest
        )

    return ProfitSummaryResponse(
        total_principal=total_principal,
        total_interest=total_interest,
        total_amount=total_principal + total_interest,
        loan_count=len(loans),
    )

def get_maturity_report(
    db: Session,
    finance_owner_id: int,
    month: int,
    year: int,
):
    """
    Return all loans maturing in the selected month and year.
    """

    loans = (
        db.query(Loan, Customer)
        .join(
            Customer,
            Loan.customer_id == Customer.id,
        )
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            func.extract("month", Loan.due_date) == month,
            func.extract("year", Loan.due_date) == year,
        )
        .order_by(Loan.due_date.asc())
        .all()
    )

    maturity_loans = []

    for loan, customer in loans:
        maturity_loans.append(
            MaturityLoanResponse(
                loan_id=loan.id,
                customer_name=customer.full_name,
                mobile_number=customer.phone,
                principal_amount=loan.principal_amount,
                remaining_principal=loan.remaining_principal,
                issue_date=loan.issue_date,
                due_date=loan.due_date,
                status=loan.status,
            )
        )

    return MaturityReportResponse(
        month=month,
        year=year,
        loan_count=len(maturity_loans),
        loans=maturity_loans,
    )

def get_overdue_loans(
    db: Session,
    finance_owner_id: int,
):
    """
    Return all overdue active loans for the authenticated
    finance owner.
    """

    today = date.today()

    loans = (
        db.query(Loan, Customer)
        .join(
            Customer,
            Loan.customer_id == Customer.id,
        )
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
            Loan.due_date < today,
        )
        .order_by(Loan.due_date.asc())
        .all()
    )

    overdue_loans = []
    total_overdue_principal = Decimal("0.00")

    for loan, customer in loans:

        total_overdue_principal += loan.remaining_principal

        overdue_loans.append(
            OverdueLoanResponse(
                loan_id=loan.id,
                customer_name=customer.full_name,
                mobile_number=customer.phone,
                due_date=loan.due_date,
                days_overdue=(today - loan.due_date).days,
                remaining_principal=loan.remaining_principal,
                status=loan.status,
            )
        )

    return OverdueLoansResponse(
        overdue_count=len(overdue_loans),
        total_overdue_principal=total_overdue_principal,
        loans=overdue_loans,
    )

def get_closed_loans(
    db: Session,
    finance_owner_id: int,
    from_date: date | None = None,
    to_date: date | None = None,
    closure_type: str | None = None,
):
    """
    Return all closed loans for the authenticated finance owner.
    """

    loans = (
        db.query(Loan, Customer)
        .join(
            Customer,
            Loan.customer_id == Customer.id,
        )
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "CLOSED",
        )
    )

    if from_date:
        loans = loans.filter(
            func.date(Loan.closed_at) >= from_date,
        )

    if to_date:
        loans = loans.filter(
            func.date(Loan.closed_at) <= to_date,
        )

    if closure_type:
        loans = loans.filter(
            Loan.closure_type == closure_type.upper(),
        )

    results = (
        loans.order_by(Loan.closed_at.desc())
        .all()
    )

    closed_loans = []

    for loan, customer in results:
        closed_loans.append(
            ClosedLoanResponse(
                loan_id=loan.id,
                customer_name=customer.full_name,
                mobile_number=customer.phone,
                principal_amount=loan.principal_amount,
                total_principal_paid=loan.total_principal_paid,
                total_interest_paid=loan.total_interest_paid,
                settlement_amount=loan.settlement_amount,
                waived_amount=loan.waived_amount,
                closure_type=loan.closure_type,
                closed_date=loan.closed_at.date()
                if loan.closed_at
                else None,
            )
        )

    return ClosedLoansReportResponse(
        loan_count=len(closed_loans),
        loans=closed_loans,
    )
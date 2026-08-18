from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner, require_permissions
from backend.app.core.auth_context import AuthContext
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.models.payment_allocation import PaymentAllocation
from backend.app.schemas.payment import (
    PaymentCreate,
    PaymentResponse,
)
from backend.app.schemas.payment_allocation import PaymentAllocationPreviewResponse
from backend.app.services.payment_service import (
    create_payment,
    get_payment,
    get_loan_payments,
    delete_payment,
    get_payment_preview,
)

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


def _enrich_payment(db: Session, payment) -> PaymentResponse:
    allocation = (
        db.query(PaymentAllocation)
        .filter(PaymentAllocation.payment_id == payment.id)
        .first()
    )
    response = PaymentResponse.model_validate(payment)
    if allocation is not None:
        response.profit_amount = allocation.profit_amount
    return response


@router.get(
    "/preview",
    response_model=PaymentAllocationPreviewResponse,
)
def preview_payment_endpoint(
    loan_id: int = Query(...),
    payment_date: date = Query(...),
    amount_paid: Decimal = Query(...),
    schedule_dates: Optional[List[date]] = Query(None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["payments"])),
):
    return get_payment_preview(
        db=db,
        loan_id=loan_id,
        finance_owner_id=ctx.finance_owner_id,
        payment_date=payment_date,
        amount_paid=amount_paid,
        schedule_dates=schedule_dates,
    )


@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment_endpoint(
    payment: PaymentCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["payments"])),
):
    created = create_payment(
        db=db,
        payment=payment,
        finance_owner_id=ctx.finance_owner_id,
        collected_by_agent_id=ctx.actor_id if not ctx.is_owner else None,
    )
    if not ctx.is_owner:
        from backend.app.models.customer import Customer
        from backend.app.services.notification_service import create_notification

        loan = db.query(Loan).filter(Loan.id == payment.loan_id).first()
        customer = (
            db.query(Customer).filter(Customer.id == loan.customer_id).first()
            if loan
            else None
        )
        loan_label = customer.full_name if customer else f"Loan #{payment.loan_id}"
        create_notification(
            db,
            ctx.finance_owner_id,
            "Collection recorded",
            f"Agent collected ₹{payment.amount_paid} for {loan_label}.",
            "info",
            action_url="/collections",
        )
        db.commit()
    return _enrich_payment(db, created)


@router.get(
    "/loan/{loan_id}",
    response_model=List[PaymentResponse],
)
def get_loan_payments_endpoint(
    loan_id: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["payments"])),
):
    payments = get_loan_payments(
        db=db,
        loan_id=loan_id,
        finance_owner_id=ctx.finance_owner_id,
    )
    return [_enrich_payment(db, p) for p in payments]


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
)
def get_payment_endpoint(
    payment_id: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["payments"])),
):
    payment = get_payment(
        db=db,
        payment_id=payment_id,
        finance_owner_id=ctx.finance_owner_id,
    )
    return _enrich_payment(db, payment)


@router.delete(
    "/{payment_id}",
    status_code=status.HTTP_200_OK,
)
def delete_payment_endpoint(
    payment_id: int,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return delete_payment(
        db=db,
        payment_id=payment_id,
        finance_owner_id=owner.id,
    )
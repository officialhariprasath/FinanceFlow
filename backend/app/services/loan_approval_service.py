from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.customer import Customer
from backend.app.models.enums import LoanApprovalStatus
from backend.app.models.loan_approval import LoanApprovalRequest
from backend.app.schemas.loan import LoanCreate
from backend.app.schemas.loan_approval import LoanApprovalCreate, LoanApprovalReject
from backend.app.services.finance_settings_service import get_finance_settings
from backend.app.services.loan_service import create_loan
from backend.app.services.notification_service import create_notification
from backend.app.utils.date_helpers import last_installment_date


def _serialize_with_score(db: Session, row: LoanApprovalRequest) -> dict:
    customer = row.customer
    submitted = row.submitted_by_agent
    reviewed = row.reviewed_by_agent
    collector = row.collection_agent
    credit_score = None
    credit_band = None
    try:
        from backend.app.services.credit_score.score_service import (
            get_or_compute_customer_score,
        )

        score_row = get_or_compute_customer_score(
            db, row.finance_owner_id, row.customer_id, commit=False
        )
        if score_row:
            credit_score = getattr(score_row, "score", None)
            credit_band = getattr(score_row, "band", None)
    except Exception:
        pass

    return {
        "id": row.id,
        "finance_owner_id": row.finance_owner_id,
        "customer_id": row.customer_id,
        "customer_name": customer.full_name if customer else None,
        "customer_display_code": getattr(customer, "display_code", None) if customer else None,
        "customer_phone": customer.phone if customer else None,
        "status": row.status,
        "principal_amount": row.principal_amount,
        "interest_rate": row.interest_rate,
        "collection_frequency": row.collection_frequency,
        "installment_count": row.installment_count,
        "issue_date": row.issue_date,
        "due_start_date": row.due_start_date,
        "daily_payment": row.daily_payment,
        "daily_principal": row.daily_principal,
        "daily_profit": row.daily_profit,
        "collection_agent_id": row.collection_agent_id,
        "collection_agent_name": getattr(collector, "full_name", None) if collector else None,
        "submitted_by_agent_id": row.submitted_by_agent_id,
        "submitted_by_name": getattr(submitted, "full_name", None) if submitted else None,
        "reviewed_by_agent_id": row.reviewed_by_agent_id,
        "reviewed_by_name": getattr(reviewed, "full_name", None) if reviewed else None,
        "reviewed_at": row.reviewed_at,
        "rejection_reason": row.rejection_reason,
        "created_loan_id": row.created_loan_id,
        "notes": row.notes,
        "created_at": row.created_at,
        "credit_score": credit_score,
        "credit_band": credit_band,
    }


def submit_loan_approval(
    db: Session,
    finance_owner_id: int,
    payload: LoanApprovalCreate,
    submitted_by_agent_id: int | None,
) -> dict:
    customer = (
        db.query(Customer)
        .filter(
            Customer.id == payload.customer_id,
            Customer.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    if payload.installment_count <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Installment count must be positive."
        )
    if payload.principal_amount <= 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Principal must be positive."
        )

    row = LoanApprovalRequest(
        finance_owner_id=finance_owner_id,
        customer_id=payload.customer_id,
        status=LoanApprovalStatus.PENDING.value,
        principal_amount=payload.principal_amount,
        interest_rate=payload.interest_rate or Decimal("0"),
        collection_frequency=payload.collection_frequency,
        installment_count=payload.installment_count,
        issue_date=payload.issue_date,
        due_start_date=payload.due_start_date,
        daily_payment=payload.daily_payment,
        daily_principal=payload.daily_principal,
        daily_profit=payload.daily_profit,
        collection_agent_id=payload.collection_agent_id,
        submitted_by_agent_id=submitted_by_agent_id,
        notes=payload.notes,
    )
    db.add(row)
    create_notification(
        db,
        finance_owner_id=finance_owner_id,
        title="Loan approval requested",
        message=(
            f"{customer.full_name} — ₹{payload.principal_amount} "
            f"({payload.installment_count} installments) awaits approval."
        ),
        level="info",
        action_url="/approvals",
    )
    db.commit()
    db.refresh(row)
    return _serialize_with_score(db, row)


def list_loan_approvals(
    db: Session,
    finance_owner_id: int,
    status_filter: str | None = None,
) -> list[dict]:
    q = db.query(LoanApprovalRequest).filter(
        LoanApprovalRequest.finance_owner_id == finance_owner_id
    )
    if status_filter:
        q = q.filter(LoanApprovalRequest.status == status_filter.upper())
    rows = q.order_by(LoanApprovalRequest.created_at.desc()).limit(200).all()
    return [_serialize_with_score(db, r) for r in rows]


def get_loan_approval(
    db: Session,
    finance_owner_id: int,
    request_id: int,
) -> dict:
    row = (
        db.query(LoanApprovalRequest)
        .filter(
            LoanApprovalRequest.id == request_id,
            LoanApprovalRequest.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Approval request not found.")
    return _serialize_with_score(db, row)


def count_pending_approvals(db: Session, finance_owner_id: int) -> int:
    return (
        db.query(LoanApprovalRequest)
        .filter(
            LoanApprovalRequest.finance_owner_id == finance_owner_id,
            LoanApprovalRequest.status == LoanApprovalStatus.PENDING.value,
        )
        .count()
    )


def approve_loan_request(
    db: Session,
    finance_owner_id: int,
    request_id: int,
    reviewed_by_agent_id: int | None,
) -> dict:
    row = (
        db.query(LoanApprovalRequest)
        .filter(
            LoanApprovalRequest.id == request_id,
            LoanApprovalRequest.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Approval request not found.")
    if row.status != LoanApprovalStatus.PENDING.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already {row.status}.",
        )

    due_date = last_installment_date(
        row.due_start_date, row.collection_frequency, row.installment_count
    )

    loan_payload = LoanCreate(
        customer_id=row.customer_id,
        principal_amount=row.principal_amount,
        interest_method="DAILY_COLLECTION",
        interest_rate=row.interest_rate or Decimal("0"),
        issue_date=row.issue_date,
        due_date=due_date,
        collection_model="DAILY_COLLECTION",
        collection_frequency=row.collection_frequency,
        installment_count=row.installment_count,
        due_start_date=row.due_start_date,
        daily_payment=row.daily_payment,
        daily_principal=row.daily_principal,
        daily_profit=row.daily_profit,
        collection_agent_id=row.collection_agent_id,
    )
    loan = create_loan(db, loan_payload, finance_owner_id)

    row.status = LoanApprovalStatus.APPROVED.value
    row.reviewed_by_agent_id = reviewed_by_agent_id
    row.reviewed_at = datetime.now(timezone.utc)
    row.created_loan_id = loan.id
    create_notification(
        db,
        finance_owner_id=finance_owner_id,
        title="Loan approved",
        message=(
            f"Loan request #{row.id} approved. "
            f"Loan {getattr(loan, 'display_code', loan.id)} is now active."
        ),
        level="success",
        recipient_agent_id=row.submitted_by_agent_id,
        action_url=f"/loans/{loan.id}",
    )
    db.commit()
    db.refresh(row)
    return _serialize_with_score(db, row)


def reject_loan_request(
    db: Session,
    finance_owner_id: int,
    request_id: int,
    payload: LoanApprovalReject,
    reviewed_by_agent_id: int | None,
) -> dict:
    row = (
        db.query(LoanApprovalRequest)
        .filter(
            LoanApprovalRequest.id == request_id,
            LoanApprovalRequest.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Approval request not found.")
    if row.status != LoanApprovalStatus.PENDING.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already {row.status}.",
        )

    row.status = LoanApprovalStatus.REJECTED.value
    row.rejection_reason = payload.reason.strip()
    row.reviewed_by_agent_id = reviewed_by_agent_id
    row.reviewed_at = datetime.now(timezone.utc)
    create_notification(
        db,
        finance_owner_id=finance_owner_id,
        title="Loan rejected",
        message=f"Loan request #{row.id} was rejected: {row.rejection_reason}",
        level="warning",
        recipient_agent_id=row.submitted_by_agent_id,
        action_url="/approvals",
    )
    db.commit()
    db.refresh(row)
    return _serialize_with_score(db, row)


def should_require_approval(
    db: Session,
    finance_owner_id: int,
    *,
    is_owner: bool,
    has_loans_create: bool,
) -> bool:
    """Owner never forced. Others: missing create perm OR settings flag."""
    if is_owner:
        return False
    if not has_loans_create:
        return True
    settings = get_finance_settings(db, finance_owner_id)
    return bool(getattr(settings, "require_loan_approval", False))

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.core.auth import require_permissions
from backend.app.core.auth_context import AuthContext
from backend.app.database.deps import get_db
from backend.app.schemas.loan_approval import (
    LoanApprovalCreate,
    LoanApprovalReject,
    LoanApprovalResponse,
)
from backend.app.services import loan_approval_service as svc

router = APIRouter(
    prefix="/loan-approvals",
    tags=["Loan Approvals"],
)


def _reviewer_agent_id(ctx: AuthContext) -> int | None:
    if ctx.is_owner:
        return None
    return ctx.actor_id


@router.post(
    "/",
    response_model=LoanApprovalResponse,
    summary="Submit loan for approval",
)
def submit_approval(
    payload: LoanApprovalCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["loans"])),
):
    submitted_by = None if ctx.is_owner else ctx.actor_id
    return svc.submit_loan_approval(
        db,
        finance_owner_id=ctx.finance_owner_id,
        payload=payload,
        submitted_by_agent_id=submitted_by,
    )


@router.get(
    "/",
    response_model=List[LoanApprovalResponse],
    summary="List loan approval requests",
)
def list_approvals(
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["loans"])),
):
    return svc.list_loan_approvals(
        db,
        finance_owner_id=ctx.finance_owner_id,
        status_filter=status,
    )


@router.get(
    "/pending-count",
    summary="Count pending approvals",
)
def pending_count(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["loans"])),
):
    return {
        "count": svc.count_pending_approvals(db, ctx.finance_owner_id),
    }


@router.get(
    "/require-flag",
    summary="Whether current actor must submit loans for approval",
)
def require_flag(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["loans"])),
):
    has_create = ctx.is_owner or "loans.create" in ctx.permissions
    require_approval = svc.should_require_approval(
        db,
        ctx.finance_owner_id,
        is_owner=ctx.is_owner,
        has_loans_create=has_create,
    )
    return {
        "require_approval": require_approval,
        "can_approve": ctx.is_owner or "loans.approve" in ctx.permissions,
        "can_create_live": has_create and not require_approval,
    }


@router.get(
    "/{request_id}",
    response_model=LoanApprovalResponse,
)
def get_approval(
    request_id: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["loans"])),
):
    return svc.get_loan_approval(db, ctx.finance_owner_id, request_id)


@router.post(
    "/{request_id}/approve",
    response_model=LoanApprovalResponse,
    summary="Approve pending loan request (creates live loan)",
)
def approve(
    request_id: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["loans.approve"])),
):
    return svc.approve_loan_request(
        db,
        finance_owner_id=ctx.finance_owner_id,
        request_id=request_id,
        reviewed_by_agent_id=_reviewer_agent_id(ctx),
    )


@router.post(
    "/{request_id}/reject",
    response_model=LoanApprovalResponse,
    summary="Reject pending loan request",
)
def reject(
    request_id: int,
    payload: LoanApprovalReject,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["loans.approve"])),
):
    return svc.reject_loan_request(
        db,
        finance_owner_id=ctx.finance_owner_id,
        request_id=request_id,
        payload=payload,
        reviewed_by_agent_id=_reviewer_agent_id(ctx),
    )

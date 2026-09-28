from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner, require_permissions
from backend.app.core.auth_context import AuthContext
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.capital import (
    CapitalAddRequest,
    CapitalSummaryResponse,
    CapitalTransactionListResponse,
    CapitalTransactionResponse,
)
from backend.app.services.capital_repair_service import (
    apply_settlement_recycle_repair,
    preview_settlement_recycle_repair,
)
from backend.app.services.capital_service import (
    add_capital,
    get_capital_summary,
    list_capital_transactions,
)

router = APIRouter(
    prefix="/capital",
    tags=["Capital"],
)


@router.get(
    "/summary",
    response_model=CapitalSummaryResponse,
)
def get_capital_summary_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["capital"])),
):
    return get_capital_summary(db, ctx.finance_owner_id)


@router.get(
    "/transactions",
    response_model=CapitalTransactionListResponse,
)
def list_capital_transactions_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["capital"])),
):
    summary = get_capital_summary(db, ctx.finance_owner_id)
    _, transactions = list_capital_transactions(db, ctx.finance_owner_id)

    return {
        "transactions": transactions,
        "available_capital": summary["available_to_lend"],
        "available_to_lend": summary["available_to_lend"],
        "capital_with_agents": summary["capital_with_agents"],
    }


@router.post(
    "/add",
    response_model=CapitalTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_capital_endpoint(
    payload: CapitalAddRequest,
    db: Session = Depends(get_db),
    current_owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return add_capital(
        db=db,
        finance_owner_id=current_owner.id,
        payload=payload,
    )


@router.get("/repair/settlement-recycle")
def preview_recycle_repair(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return preview_settlement_recycle_repair(db, owner.id)


@router.post("/repair/settlement-recycle")
def apply_recycle_repair(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return apply_settlement_recycle_repair(db, owner.id, owner.id)

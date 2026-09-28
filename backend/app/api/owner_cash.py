from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.owner_cash import (
    OwnerCashActionResponse,
    OwnerCashAmountRequest,
    OwnerCashSummary,
    OwnerCashTransactionResponse,
)
from backend.app.services.owner_cash_service import (
    get_owner_cash_summary,
    list_owner_cash_transactions,
    move_to_available_capital,
    reinvest_profit_from_owner_account,
    withdraw_cash_from_owner_account,
    withdraw_profit_from_owner_account,
)

router = APIRouter(prefix="/owner-account", tags=["Owner Account"])


@router.get("/summary", response_model=OwnerCashSummary)
def owner_account_summary(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    summary = get_owner_cash_summary(db, owner.id)
    db.commit()  # persist Owner Account bootstrap / opening balance if created
    return summary


@router.get("/transactions", response_model=list[OwnerCashTransactionResponse])
def owner_account_transactions(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    rows = list_owner_cash_transactions(db, owner.id)
    db.commit()
    return rows


@router.post("/move-to-capital", response_model=OwnerCashActionResponse)
def owner_move_to_capital(
    payload: OwnerCashAmountRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return move_to_available_capital(
        db, owner.id, owner.id, payload.amount, payload.description
    )


@router.post("/withdraw-profit", response_model=OwnerCashActionResponse)
def owner_withdraw_profit(
    payload: OwnerCashAmountRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return withdraw_profit_from_owner_account(
        db, owner.id, owner.id, payload.amount, payload.description
    )


@router.post("/reinvest-profit", response_model=OwnerCashActionResponse)
def owner_reinvest_profit(
    payload: OwnerCashAmountRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return reinvest_profit_from_owner_account(
        db, owner.id, owner.id, payload.amount, payload.description
    )


@router.post("/withdraw-cash", response_model=OwnerCashActionResponse)
def owner_withdraw_cash(
    payload: OwnerCashAmountRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return withdraw_cash_from_owner_account(
        db, owner.id, owner.id, payload.amount, payload.description
    )

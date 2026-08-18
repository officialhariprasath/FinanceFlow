from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.enums import LedgerDirection, ProfitTransactionType
from backend.app.services.audit_service import log_audit
from backend.app.services.profit_service import (
    get_available_profit,
    get_or_create_profit_account,
    TWOPLACES,
    ZERO,
)
from backend.app.models.profit_transaction import ProfitTransaction


def _profit_debit(
    db: Session,
    finance_owner_id: int,
    amount: Decimal,
    tx_type: ProfitTransactionType,
    reference_type: str,
    reference_id: int | None,
    description: str,
) -> ProfitTransaction:
    amount = amount.quantize(TWOPLACES)
    available = get_available_profit(db, finance_owner_id)
    if amount > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient profit. Available: {available}",
        )
    account = get_or_create_profit_account(db, finance_owner_id)
    new_balance = available - amount
    tx = ProfitTransaction(
        profit_account_id=account.id,
        type=tx_type.value,
        amount=amount,
        direction=LedgerDirection.DEBIT.value,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
        balance_after=new_balance,
        created_by=finance_owner_id,
    )
    db.add(tx)
    db.flush()
    return tx


def withdraw_profit(
    db: Session,
    finance_owner_id: int,
    amount: Decimal,
    description: str | None = None,
) -> ProfitTransaction:
    amount = amount.quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    tx = _profit_debit(
        db,
        finance_owner_id,
        amount,
        ProfitTransactionType.PROFIT_WITHDRAWAL,
        "PROFIT_WITHDRAWAL",
        None,
        description or "Profit withdrawal by owner",
    )
    log_audit(
        db,
        finance_owner_id,
        "PROFIT_WITHDRAWAL",
        "profit_transaction",
        tx.id,
        f"Amount: {amount}",
    )
    db.commit()
    db.refresh(tx)
    return tx


def reinvest_profit(
    db: Session,
    finance_owner_id: int,
    amount: Decimal,
    description: str | None = None,
):
    from backend.app.services.capital_service import record_profit_reinvestment

    amount = amount.quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    profit_tx = _profit_debit(
        db,
        finance_owner_id,
        amount,
        ProfitTransactionType.PROFIT_REINVESTMENT,
        "PROFIT_REINVESTMENT",
        None,
        description or "Profit reinvested to capital",
    )
    capital_tx = record_profit_reinvestment(
        db=db,
        finance_owner_id=finance_owner_id,
        amount=amount,
        profit_transaction_id=profit_tx.id,
        description=description or "Profit reinvestment",
    )
    profit_tx.reference_id = capital_tx.id
    log_audit(
        db,
        finance_owner_id,
        "PROFIT_REINVESTMENT",
        "profit_transaction",
        profit_tx.id,
        f"Amount: {amount}, capital_tx: {capital_tx.id}",
    )
    db.commit()
    db.refresh(profit_tx)
    return {"profit_transaction": profit_tx, "capital_transaction": capital_tx}


def list_profit_transactions(db: Session, finance_owner_id: int):
    account = get_or_create_profit_account(db, finance_owner_id)
    return (
        db.query(ProfitTransaction)
        .filter(ProfitTransaction.profit_account_id == account.id)
        .order_by(ProfitTransaction.created_at.desc(), ProfitTransaction.id.desc())
        .all()
    )

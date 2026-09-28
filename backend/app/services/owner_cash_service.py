"""Owner Settlement Account — cash received from agents before allocation."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models.enums import (
    LedgerDirection,
    OwnerCashTransactionType,
    ProfitTransactionType,
)
from backend.app.models.owner_cash_account import OwnerCashAccount, OwnerCashTransaction
from backend.app.models.profit_transaction import ProfitTransaction
from backend.app.services.audit_service import log_audit
from backend.app.services.capital_service import (
    ZERO,
    TWOPLACES,
    record_capital_adjustment,
)
from backend.app.services.profit_service import (
    get_available_profit,
    get_or_create_profit_account,
)

COMPLETED_SETTLEMENT_STATUSES = ("COMPLETED", "APPROVED")


def get_or_create_owner_cash_account(
    db: Session,
    finance_owner_id: int,
) -> OwnerCashAccount:
    account = (
        db.query(OwnerCashAccount)
        .filter(OwnerCashAccount.finance_owner_id == finance_owner_id)
        .first()
    )
    if account is None:
        account = OwnerCashAccount(
            finance_owner_id=finance_owner_id,
            principal_balance=ZERO,
            profit_balance=ZERO,
            currency="INR",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(account)
        db.flush()
        _bootstrap_opening_profit(db, account, finance_owner_id)
    return account


def _bootstrap_opening_profit(
    db: Session,
    account: OwnerCashAccount,
    finance_owner_id: int,
) -> None:
    """Seed settled profit already with owner (not still with agents)."""
    from backend.app.services.capital_location_service import unsettled_collection_split
    from backend.app.services.profit_service import get_total_profit_earned

    # Only bootstrap once (no prior txs)
    existing = (
        db.query(OwnerCashTransaction)
        .filter(OwnerCashTransaction.owner_cash_account_id == account.id)
        .first()
    )
    if existing is not None:
        return

    split = unsettled_collection_split(db, finance_owner_id)
    total_profit = get_total_profit_earned(db, finance_owner_id)
    settled_profit = (total_profit - split["profit_with_agents"]).quantize(TWOPLACES)
    if settled_profit <= ZERO:
        return

    account.profit_balance = settled_profit
    account.updated_at = datetime.utcnow()
    tx = OwnerCashTransaction(
        owner_cash_account_id=account.id,
        finance_owner_id=finance_owner_id,
        type=OwnerCashTransactionType.OPENING_BALANCE.value,
        direction=LedgerDirection.CREDIT.value,
        amount=settled_profit,
        principal_amount=ZERO,
        profit_amount=settled_profit,
        principal_balance_after=ZERO,
        profit_balance_after=settled_profit,
        reference_type="BOOTSTRAP",
        reference_id=None,
        description=(
            "Opening Owner Account profit — settled collections already received "
            "(not still with agents)"
        ),
        created_by=finance_owner_id,
        created_at=datetime.utcnow(),
    )
    db.add(tx)
    db.flush()


def _append_tx(
    db: Session,
    account: OwnerCashAccount,
    finance_owner_id: int,
    tx_type: OwnerCashTransactionType,
    direction: LedgerDirection,
    principal_amount: Decimal,
    profit_amount: Decimal,
    description: str,
    created_by: int,
    reference_type: str | None = None,
    reference_id: int | None = None,
) -> OwnerCashTransaction:
    principal_amount = principal_amount.quantize(TWOPLACES)
    profit_amount = profit_amount.quantize(TWOPLACES)
    amount = (principal_amount + profit_amount).quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero.")

    if direction == LedgerDirection.CREDIT:
        account.principal_balance = (
            Decimal(account.principal_balance) + principal_amount
        ).quantize(TWOPLACES)
        account.profit_balance = (
            Decimal(account.profit_balance) + profit_amount
        ).quantize(TWOPLACES)
    else:
        if principal_amount > Decimal(account.principal_balance):
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient Owner Account principal. Available: {account.principal_balance}",
            )
        if profit_amount > Decimal(account.profit_balance):
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient Owner Account profit. Available: {account.profit_balance}",
            )
        account.principal_balance = (
            Decimal(account.principal_balance) - principal_amount
        ).quantize(TWOPLACES)
        account.profit_balance = (
            Decimal(account.profit_balance) - profit_amount
        ).quantize(TWOPLACES)

    account.updated_at = datetime.utcnow()
    tx = OwnerCashTransaction(
        owner_cash_account_id=account.id,
        finance_owner_id=finance_owner_id,
        type=tx_type.value,
        direction=direction.value,
        amount=amount,
        principal_amount=principal_amount,
        profit_amount=profit_amount,
        principal_balance_after=Decimal(account.principal_balance).quantize(TWOPLACES),
        profit_balance_after=Decimal(account.profit_balance).quantize(TWOPLACES),
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
        created_by=created_by,
        created_at=datetime.utcnow(),
    )
    db.add(tx)
    db.flush()
    return tx


def credit_settlement_to_owner_account(
    db: Session,
    finance_owner_id: int,
    owner_id: int,
    settlement_id: int,
    principal_amount: Decimal,
    profit_amount: Decimal,
    description: str,
) -> OwnerCashTransaction:
    account = get_or_create_owner_cash_account(db, finance_owner_id)
    return _append_tx(
        db,
        account,
        finance_owner_id,
        OwnerCashTransactionType.SETTLEMENT_IN,
        LedgerDirection.CREDIT,
        principal_amount,
        profit_amount,
        description,
        created_by=owner_id,
        reference_type="AGENT_SETTLEMENT",
        reference_id=settlement_id,
    )


def get_owner_cash_summary(db: Session, finance_owner_id: int) -> dict:
    from backend.app.services.capital_location_service import get_capital_location_summary

    account = get_or_create_owner_cash_account(db, finance_owner_id)
    location = get_capital_location_summary(db, finance_owner_id)
    principal = Decimal(account.principal_balance).quantize(TWOPLACES)
    profit = Decimal(account.profit_balance).quantize(TWOPLACES)
    return {
        "principal_balance": principal,
        "profit_balance": profit,
        "total_balance": (principal + profit).quantize(TWOPLACES),
        "currency": account.currency,
        "available_to_lend": location["available_to_lend"],
        "capital_with_agents": location["capital_with_agents"],
        "profit_with_agents": location["profit_with_agents"],
        "unsettled_with_agents": location["unsettled_with_agents"],
        "ledger_capital": location["ledger_capital"],
        "total_capital_added": location["total_capital_added"],
        "capital_currently_lent": location["capital_currently_lent"],
        "available_profit_ledger": get_available_profit(db, finance_owner_id),
        "over_lent_against_unsettled": location["over_lent_against_unsettled"],
        "notes": (
            "Money from approved agent settlements lands here first. "
            "Move principal to Available Capital to lend, or withdraw profit/cash. "
            "Add Capital is only for new money from your pocket."
        ),
    }


def list_owner_cash_transactions(
    db: Session,
    finance_owner_id: int,
    limit: int = 200,
):
    account = get_or_create_owner_cash_account(db, finance_owner_id)
    return (
        db.query(OwnerCashTransaction)
        .filter(OwnerCashTransaction.owner_cash_account_id == account.id)
        .order_by(
            OwnerCashTransaction.created_at.desc(),
            OwnerCashTransaction.id.desc(),
        )
        .limit(limit)
        .all()
    )


def move_to_available_capital(
    db: Session,
    finance_owner_id: int,
    owner_id: int,
    amount: Decimal,
    description: str | None = None,
) -> dict:
    """Unlock principal from Owner Account into Available to lend.

    Principal was already booked in the capital ledger at collection time; this
    only releases the Owner Account reservation.
    """
    amount = Decimal(amount).quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    account = get_or_create_owner_cash_account(db, finance_owner_id)
    if amount > Decimal(account.principal_balance):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move more than Owner Account principal ({account.principal_balance}).",
        )

    tx = _append_tx(
        db,
        account,
        finance_owner_id,
        OwnerCashTransactionType.MOVE_TO_CAPITAL,
        LedgerDirection.DEBIT,
        principal_amount=amount,
        profit_amount=ZERO,
        description=description
        or f"Moved ₹{amount} from Owner Account to Available Capital",
        created_by=owner_id,
        reference_type="MOVE_TO_CAPITAL",
        reference_id=None,
    )
    log_audit(
        db,
        finance_owner_id,
        "OWNER_CASH_MOVE_TO_CAPITAL",
        "owner_cash_transaction",
        tx.id,
        f"Moved ₹{amount} to Available Capital",
        actor_type="owner",
        actor_id=owner_id,
    )
    db.commit()
    return {
        "transaction": tx,
        "summary": get_owner_cash_summary(db, finance_owner_id),
    }


def withdraw_profit_from_owner_account(
    db: Session,
    finance_owner_id: int,
    owner_id: int,
    amount: Decimal,
    description: str | None = None,
) -> dict:
    amount = Decimal(amount).quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    account = get_or_create_owner_cash_account(db, finance_owner_id)
    if amount > Decimal(account.profit_balance):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot withdraw more than Owner Account profit ({account.profit_balance}).",
        )

    available_profit = get_available_profit(db, finance_owner_id)
    if amount > available_profit:
        raise HTTPException(
            status_code=400,
            detail=f"Profit ledger available is only {available_profit}.",
        )

    tx = _append_tx(
        db,
        account,
        finance_owner_id,
        OwnerCashTransactionType.WITHDRAW_PROFIT,
        LedgerDirection.DEBIT,
        principal_amount=ZERO,
        profit_amount=amount,
        description=description or f"Withdraw profit ₹{amount} from Owner Account",
        created_by=owner_id,
        reference_type="PROFIT_WITHDRAWAL",
        reference_id=None,
    )

    profit_account = get_or_create_profit_account(db, finance_owner_id)
    new_balance = available_profit - amount
    profit_tx = ProfitTransaction(
        profit_account_id=profit_account.id,
        type=ProfitTransactionType.PROFIT_WITHDRAWAL.value,
        amount=amount,
        direction=LedgerDirection.DEBIT.value,
        reference_type="OWNER_CASH",
        reference_id=tx.id,
        description=description or "Profit withdrawn from Owner Account",
        balance_after=new_balance,
        created_by=finance_owner_id,
    )
    db.add(profit_tx)
    db.flush()
    tx.reference_id = profit_tx.id

    log_audit(
        db,
        finance_owner_id,
        "OWNER_CASH_WITHDRAW_PROFIT",
        "owner_cash_transaction",
        tx.id,
        f"Withdrew profit ₹{amount}",
        actor_type="owner",
        actor_id=owner_id,
    )
    db.commit()
    return {
        "transaction": tx,
        "summary": get_owner_cash_summary(db, finance_owner_id),
    }


def reinvest_profit_from_owner_account(
    db: Session,
    finance_owner_id: int,
    owner_id: int,
    amount: Decimal,
    description: str | None = None,
) -> dict:
    """Move Owner Account profit into Available Capital via profit reinvestment."""
    from backend.app.services.profit_operations_service import reinvest_profit

    amount = Decimal(amount).quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    account = get_or_create_owner_cash_account(db, finance_owner_id)
    if amount > Decimal(account.profit_balance):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reinvest more than Owner Account profit ({account.profit_balance}).",
        )

    tx = _append_tx(
        db,
        account,
        finance_owner_id,
        OwnerCashTransactionType.MOVE_TO_CAPITAL,
        LedgerDirection.DEBIT,
        principal_amount=ZERO,
        profit_amount=amount,
        description=description
        or f"Reinvested Owner Account profit ₹{amount} to Available Capital",
        created_by=owner_id,
        reference_type="PROFIT_REINVESTMENT",
        reference_id=None,
    )
    result = reinvest_profit(
        db,
        finance_owner_id,
        amount,
        description=description
        or f"Reinvested from Owner Account (tx #{tx.id})",
        commit=False,
    )
    capital_tx = result["capital_transaction"]
    tx.reference_id = capital_tx.id
    log_audit(
        db,
        finance_owner_id,
        "OWNER_CASH_REINVEST_PROFIT",
        "owner_cash_transaction",
        tx.id,
        f"Reinvested profit ₹{amount} to capital",
        actor_type="owner",
        actor_id=owner_id,
    )
    db.commit()
    return {
        "transaction": tx,
        "summary": get_owner_cash_summary(db, finance_owner_id),
    }


def withdraw_cash_from_owner_account(
    db: Session,
    finance_owner_id: int,
    owner_id: int,
    amount: Decimal,
    description: str | None = None,
) -> dict:
    """Withdraw principal cash from Owner Account (owner draw)."""
    amount = Decimal(amount).quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    account = get_or_create_owner_cash_account(db, finance_owner_id)
    if amount > Decimal(account.principal_balance):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot withdraw more than Owner Account principal ({account.principal_balance}).",
        )

    tx = _append_tx(
        db,
        account,
        finance_owner_id,
        OwnerCashTransactionType.WITHDRAW_CASH,
        LedgerDirection.DEBIT,
        principal_amount=amount,
        profit_amount=ZERO,
        description=description or f"Withdraw cash ₹{amount} from Owner Account",
        created_by=owner_id,
        reference_type="CAPITAL_WITHDRAWAL",
        reference_id=None,
    )
    capital_tx = record_capital_adjustment(
        db,
        finance_owner_id,
        amount,
        LedgerDirection.DEBIT,
        description=description
        or f"Owner Account cash withdrawal ₹{amount}",
        reference_type="OWNER_CASH_WITHDRAW",
        reference_id=tx.id,
        commit=False,
    )
    tx.reference_id = capital_tx.id

    log_audit(
        db,
        finance_owner_id,
        "OWNER_CASH_WITHDRAW_CASH",
        "owner_cash_transaction",
        tx.id,
        f"Withdrew cash/capital ₹{amount}",
        actor_type="owner",
        actor_id=owner_id,
    )
    db.commit()
    return {
        "transaction": tx,
        "summary": get_owner_cash_summary(db, finance_owner_id),
    }


def get_owner_account_principal_reserved(db: Session, finance_owner_id: int) -> Decimal:
    account = (
        db.query(OwnerCashAccount)
        .filter(OwnerCashAccount.finance_owner_id == finance_owner_id)
        .first()
    )
    if account is None:
        return ZERO
    return Decimal(account.principal_balance).quantize(TWOPLACES)

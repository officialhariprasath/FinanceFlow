from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.capital_account import CapitalAccount
from backend.app.models.capital_transaction import CapitalTransaction
from backend.app.models.enums import CapitalTransactionType, LedgerDirection
from backend.app.schemas.capital import CapitalAddRequest

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def get_or_create_capital_account(
    db: Session,
    finance_owner_id: int,
) -> CapitalAccount:
    account = (
        db.query(CapitalAccount)
        .filter(CapitalAccount.finance_owner_id == finance_owner_id)
        .first()
    )

    if account is None:
        account = CapitalAccount(
            finance_owner_id=finance_owner_id,
            currency="INR",
        )
        db.add(account)
        db.flush()

    return account


def get_available_capital(
    db: Session,
    finance_owner_id: int,
) -> Decimal:
    account = get_or_create_capital_account(db, finance_owner_id)

    latest = (
        db.query(CapitalTransaction)
        .filter(CapitalTransaction.capital_account_id == account.id)
        .order_by(
            CapitalTransaction.created_at.desc(),
            CapitalTransaction.id.desc(),
        )
        .first()
    )

    if latest is None:
        return ZERO

    return latest.balance_after


def get_total_capital_added(
    db: Session,
    capital_account_id: int,
) -> Decimal:
    rows = (
        db.query(CapitalTransaction)
        .filter(
            CapitalTransaction.capital_account_id == capital_account_id,
            CapitalTransaction.type == CapitalTransactionType.CAPITAL_ADDED.value,
        )
        .all()
    )

    total = ZERO
    for row in rows:
        total += row.amount

    return total


def get_capital_lent(
    db: Session,
    finance_owner_id: int,
) -> Decimal:
    """Principal outstanding across active loans."""
    from backend.app.models.loan import Loan

    rows = (
        db.query(Loan.remaining_principal)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
        )
        .all()
    )

    total = ZERO
    for row in rows:
        total += row[0] or ZERO

    return total


def list_capital_transactions(
    db: Session,
    finance_owner_id: int,
):
    account = get_or_create_capital_account(db, finance_owner_id)

    transactions = (
        db.query(CapitalTransaction)
        .filter(CapitalTransaction.capital_account_id == account.id)
        .order_by(
            CapitalTransaction.created_at.desc(),
            CapitalTransaction.id.desc(),
        )
        .all()
    )

    return account, transactions


def get_capital_summary(
    db: Session,
    finance_owner_id: int,
):
    account, transactions = list_capital_transactions(db, finance_owner_id)
    available = get_available_capital(db, finance_owner_id)

    return {
        "available_capital": available,
        "total_capital_added": get_total_capital_added(db, account.id),
        "capital_currently_lent": get_capital_lent(db, finance_owner_id),
        "currency": account.currency,
        "transaction_count": len(transactions),
    }


def _create_capital_transaction(
    db: Session,
    account: CapitalAccount,
    finance_owner_id: int,
    transaction_type: CapitalTransactionType,
    amount: Decimal,
    direction: LedgerDirection,
    reference_type: str,
    reference_id: int | None,
    description: str,
) -> CapitalTransaction:
    amount = amount.quantize(TWOPLACES)
    current_balance = get_available_capital(db, finance_owner_id)

    if direction == LedgerDirection.CREDIT:
        new_balance = current_balance + amount
    else:
        if amount > current_balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient available capital.",
            )
        new_balance = current_balance - amount

    transaction = CapitalTransaction(
        capital_account_id=account.id,
        type=transaction_type.value,
        amount=amount,
        direction=direction.value,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
        balance_after=new_balance,
        created_by=finance_owner_id,
    )
    db.add(transaction)
    db.flush()
    return transaction


def add_capital(
    db: Session,
    finance_owner_id: int,
    payload: CapitalAddRequest,
) -> CapitalTransaction:
    amount = payload.amount.quantize(TWOPLACES)

    if amount <= ZERO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Capital amount must be greater than zero.",
        )

    account = get_or_create_capital_account(db, finance_owner_id)
    transaction = _create_capital_transaction(
        db=db,
        account=account,
        finance_owner_id=finance_owner_id,
        transaction_type=CapitalTransactionType.CAPITAL_ADDED,
        amount=amount,
        direction=LedgerDirection.CREDIT,
        reference_type="CAPITAL_ADDITION",
        reference_id=None,
        description=payload.description or "Capital added by owner",
    )
    db.commit()
    db.refresh(transaction)
    return transaction


def record_loan_disbursement(
    db: Session,
    finance_owner_id: int,
    loan_id: int,
    amount: Decimal,
) -> CapitalTransaction:
    account = get_or_create_capital_account(db, finance_owner_id)
    return _create_capital_transaction(
        db=db,
        account=account,
        finance_owner_id=finance_owner_id,
        transaction_type=CapitalTransactionType.LOAN_DISBURSEMENT,
        amount=amount.quantize(TWOPLACES),
        direction=LedgerDirection.DEBIT,
        reference_type="LOAN",
        reference_id=loan_id,
        description=f"Loan disbursement for loan #{loan_id}",
    )


def record_principal_recovery(
    db: Session,
    finance_owner_id: int,
    loan_id: int,
    payment_id: int,
    amount: Decimal,
) -> CapitalTransaction:
    account = get_or_create_capital_account(db, finance_owner_id)
    return _create_capital_transaction(
        db=db,
        account=account,
        finance_owner_id=finance_owner_id,
        transaction_type=CapitalTransactionType.PRINCIPAL_RECOVERY,
        amount=amount.quantize(TWOPLACES),
        direction=LedgerDirection.CREDIT,
        reference_type="PAYMENT",
        reference_id=payment_id,
        description=f"Principal recovery for loan #{loan_id}",
    )


def record_profit_reinvestment(
    db: Session,
    finance_owner_id: int,
    amount: Decimal,
    profit_transaction_id: int,
    description: str,
) -> CapitalTransaction:
    account = get_or_create_capital_account(db, finance_owner_id)
    return _create_capital_transaction(
        db=db,
        account=account,
        finance_owner_id=finance_owner_id,
        transaction_type=CapitalTransactionType.PROFIT_REINVESTMENT,
        amount=amount.quantize(TWOPLACES),
        direction=LedgerDirection.CREDIT,
        reference_type="PROFIT_REINVESTMENT",
        reference_id=profit_transaction_id,
        description=description,
    )


def withdraw_capital(
    db: Session,
    finance_owner_id: int,
    amount: Decimal,
    description: str | None = None,
) -> dict:
    amount = amount.quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    available_before = get_available_capital(db, finance_owner_id)
    available_after = available_before - amount

    account = get_or_create_capital_account(db, finance_owner_id)
    tx = _create_capital_transaction(
        db=db,
        account=account,
        finance_owner_id=finance_owner_id,
        transaction_type=CapitalTransactionType.CAPITAL_WITHDRAWAL,
        amount=amount,
        direction=LedgerDirection.DEBIT,
        reference_type="CAPITAL_WITHDRAWAL",
        reference_id=None,
        description=description or "Capital withdrawal by owner",
    )

    from backend.app.services.audit_service import log_audit

    log_audit(
        db,
        finance_owner_id,
        "CAPITAL_WITHDRAWAL",
        "capital_transaction",
        tx.id,
        f"Amount: {amount}",
    )
    db.commit()
    db.refresh(tx)
    return {
        "transaction": tx,
        "available_before": available_before,
        "available_after": available_after,
        "warning": (
            f"Withdrawal reduces available lending capital to {available_after}."
            if available_after < available_before
            else None
        ),
    }


def record_capital_expense(
    db: Session,
    finance_owner_id: int,
    amount: Decimal,
    expense_id: int,
    description: str,
) -> CapitalTransaction:
    amount = amount.quantize(TWOPLACES)
    available = get_available_capital(db, finance_owner_id)
    if amount > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient capital. Available: {available}",
        )

    account = get_or_create_capital_account(db, finance_owner_id)
    return _create_capital_transaction(
        db=db,
        account=account,
        finance_owner_id=finance_owner_id,
        transaction_type=CapitalTransactionType.CAPITAL_EXPENSE,
        amount=amount,
        direction=LedgerDirection.DEBIT,
        reference_type="EXPENSE",
        reference_id=expense_id,
        description=description,
    )

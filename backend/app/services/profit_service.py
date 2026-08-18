from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.enums import LedgerDirection, ProfitTransactionType
from backend.app.models.profit_account import ProfitAccount
from backend.app.models.profit_transaction import ProfitTransaction

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def get_or_create_profit_account(
    db: Session,
    finance_owner_id: int,
) -> ProfitAccount:
    account = (
        db.query(ProfitAccount)
        .filter(ProfitAccount.finance_owner_id == finance_owner_id)
        .first()
    )

    if account is None:
        account = ProfitAccount(
            finance_owner_id=finance_owner_id,
            currency="INR",
        )
        db.add(account)
        db.flush()

    return account


def get_available_profit(
    db: Session,
    finance_owner_id: int,
) -> Decimal:
    account = get_or_create_profit_account(db, finance_owner_id)

    latest = (
        db.query(ProfitTransaction)
        .filter(ProfitTransaction.profit_account_id == account.id)
        .order_by(
            ProfitTransaction.created_at.desc(),
            ProfitTransaction.id.desc(),
        )
        .first()
    )

    if latest is None:
        return ZERO

    return latest.balance_after


def get_total_profit_earned(
    db: Session,
    finance_owner_id: int,
) -> Decimal:
    account = get_or_create_profit_account(db, finance_owner_id)

    rows = (
        db.query(ProfitTransaction)
        .filter(
            ProfitTransaction.profit_account_id == account.id,
            ProfitTransaction.type == ProfitTransactionType.PROFIT_RECOGNITION.value,
        )
        .all()
    )

    total = ZERO
    for row in rows:
        total += row.amount

    return total


def get_profit_summary(
    db: Session,
    finance_owner_id: int,
):
    account = get_or_create_profit_account(db, finance_owner_id)
    transactions = (
        db.query(ProfitTransaction)
        .filter(ProfitTransaction.profit_account_id == account.id)
        .order_by(
            ProfitTransaction.created_at.desc(),
            ProfitTransaction.id.desc(),
        )
        .all()
    )

    return {
        "available_profit": get_available_profit(db, finance_owner_id),
        "total_profit_earned": get_total_profit_earned(db, finance_owner_id),
        "currency": account.currency,
        "transaction_count": len(transactions),
    }


def record_profit_recognition(
    db: Session,
    finance_owner_id: int,
    loan_id: int,
    payment_id: int,
    amount: Decimal,
) -> ProfitTransaction:
    amount = amount.quantize(TWOPLACES)
    account = get_or_create_profit_account(db, finance_owner_id)
    current = get_available_profit(db, finance_owner_id)
    new_balance = current + amount

    transaction = ProfitTransaction(
        profit_account_id=account.id,
        type=ProfitTransactionType.PROFIT_RECOGNITION.value,
        amount=amount,
        direction=LedgerDirection.CREDIT.value,
        reference_type="PAYMENT",
        reference_id=payment_id,
        description=f"Profit recognition for loan #{loan_id}",
        balance_after=new_balance,
        created_by=finance_owner_id,
    )
    db.add(transaction)
    db.flush()
    return transaction


def get_profit_for_period(
    db: Session,
    finance_owner_id: int,
    from_date,
    to_date,
) -> Decimal:
    account = get_or_create_profit_account(db, finance_owner_id)

    rows = (
        db.query(ProfitTransaction)
        .filter(
            ProfitTransaction.profit_account_id == account.id,
            ProfitTransaction.type == ProfitTransactionType.PROFIT_RECOGNITION.value,
            ProfitTransaction.created_at >= from_date,
            ProfitTransaction.created_at <= to_date,
        )
        .all()
    )

    total = ZERO
    for row in rows:
        total += row.amount

    return total

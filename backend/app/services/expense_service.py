from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.enums import ExpenseFundingSource, LedgerDirection, ProfitTransactionType
from backend.app.models.financeflow_extended import Expense
from backend.app.models.profit_transaction import ProfitTransaction
from backend.app.services.audit_service import log_audit
from backend.app.services.capital_service import get_available_capital, record_capital_expense
from backend.app.services.profit_service import (
    get_available_profit,
    get_or_create_profit_account,
    get_total_profit_earned,
    TWOPLACES,
    ZERO,
)

EXPENSE_CATEGORIES = [
    "Office",
    "Transport",
    "Salary",
    "Software",
    "Bank Charges",
    "Collection",
    "Marketing",
    "Other",
]


def create_expense(
    db: Session,
    finance_owner_id: int,
    category: str,
    amount: Decimal,
    description: str | None = None,
    expense_date: date | None = None,
    funding_source: str = ExpenseFundingSource.PROFIT.value,
) -> Expense:
    amount = amount.quantize(TWOPLACES)
    if amount <= ZERO:
        raise HTTPException(status_code=400, detail="Amount must be positive.")
    if category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid expense category.")

    source = (funding_source or ExpenseFundingSource.PROFIT.value).upper()
    if source not in {s.value for s in ExpenseFundingSource}:
        raise HTTPException(status_code=400, detail="Invalid funding source.")

    expense = Expense(
        finance_owner_id=finance_owner_id,
        category=category,
        amount=amount,
        description=description,
        funding_source=source,
    )
    db.add(expense)
    db.flush()

    if source == ExpenseFundingSource.CAPITAL.value:
        available = get_available_capital(db, finance_owner_id)
        if amount > available:
            raise HTTPException(
                status_code=400,
                detail=f"Expense exceeds available capital. Available: {available}",
            )
        capital_tx = record_capital_expense(
            db,
            finance_owner_id,
            amount,
            expense.id,
            f"{category}: {description or 'Business expense'}",
        )
        expense.capital_transaction_id = capital_tx.id
    else:
        available = get_available_profit(db, finance_owner_id)
        account = get_or_create_profit_account(db, finance_owner_id)
        new_balance = available - amount
        if new_balance < ZERO:
            raise HTTPException(
                status_code=400,
                detail=f"Expense exceeds available profit. Available: {available}",
            )

        profit_tx = ProfitTransaction(
            profit_account_id=account.id,
            type=ProfitTransactionType.EXPENSE.value,
            amount=amount,
            direction=LedgerDirection.DEBIT.value,
            reference_type="EXPENSE",
            reference_id=expense.id,
            description=f"{category}: {description or 'Business expense'}",
            balance_after=new_balance,
            created_by=finance_owner_id,
        )
        db.add(profit_tx)
        db.flush()
        expense.profit_transaction_id = profit_tx.id

    log_audit(
        db,
        finance_owner_id,
        "EXPENSE_CREATED",
        "expense",
        expense.id,
        f"{category} {amount} from {source}",
    )
    from backend.app.services.notification_service import create_notification

    create_notification(
        db,
        finance_owner_id,
        "Expense recorded",
        f"₹{amount} expense ({category}) recorded from {source}.",
        "info",
    )
    db.commit()
    db.refresh(expense)
    return expense


def list_expenses(db: Session, finance_owner_id: int):
    return (
        db.query(Expense)
        .filter(Expense.finance_owner_id == finance_owner_id)
        .order_by(Expense.created_at.desc())
        .all()
    )


def get_expense_totals(db: Session, finance_owner_id: int, funding_source: str | None = None) -> Decimal:
    rows = list_expenses(db, finance_owner_id)
    if funding_source:
        rows = [r for r in rows if r.funding_source == funding_source]
    return sum((Decimal(r.amount) for r in rows), ZERO).quantize(TWOPLACES)


def get_net_profit_summary(db: Session, finance_owner_id: int):
    gross = get_total_profit_earned(db, finance_owner_id)
    profit_expenses = get_expense_totals(db, finance_owner_id, ExpenseFundingSource.PROFIT.value)
    capital_expenses = get_expense_totals(db, finance_owner_id, ExpenseFundingSource.CAPITAL.value)
    available = get_available_profit(db, finance_owner_id)
    return {
        "gross_profit": gross,
        "total_expenses": profit_expenses,
        "capital_expenses": capital_expenses,
        "net_profit": (gross - profit_expenses).quantize(TWOPLACES),
        "available_profit": available,
    }

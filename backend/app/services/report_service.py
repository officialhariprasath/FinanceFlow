from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.loan import Loan
from backend.app.models.payment import Payment
from backend.app.models.customer import Customer
from backend.app.services.capital_service import get_capital_summary, list_capital_transactions
from backend.app.services.profit_service import get_profit_summary
from backend.app.services.expense_service import get_net_profit_summary, list_expenses
from backend.app.services.profit_operations_service import list_profit_transactions

ZERO = Decimal("0.00")


def get_collections_report(db: Session, finance_owner_id: int, days: int = 30):
    start = date.today() - timedelta(days=days)
    payments = (
        db.query(Payment, Customer)
        .join(Loan, Payment.loan_id == Loan.id)
        .join(Customer, Loan.customer_id == Customer.id)
        .filter(
            Payment.finance_owner_id == finance_owner_id,
            Payment.payment_date >= start,
        )
        .order_by(Payment.payment_date.desc())
        .all()
    )
    total = sum((Decimal(p.amount_paid) for p, _ in payments), ZERO)
    by_day: dict[str, Decimal] = {}
    for p, _ in payments:
        key = str(p.payment_date)
        by_day[key] = by_day.get(key, ZERO) + Decimal(p.amount_paid)

    return {
        "period_days": days,
        "total_collected": str(total.quantize(ZERO)),
        "payment_count": len(payments),
        "by_day": {k: str(v.quantize(ZERO)) for k, v in sorted(by_day.items())},
        "payments": [
            {
                "id": p.id,
                "date": str(p.payment_date),
                "customer_name": c.full_name,
                "amount": str(p.amount_paid),
                "mode": str(p.payment_mode),
                "loan_id": p.loan_id,
            }
            for p, c in payments
        ],
    }


def get_portfolio_report(db: Session, finance_owner_id: int):
    loans = (
        db.query(Loan, Customer)
        .join(Customer, Loan.customer_id == Customer.id)
        .filter(Loan.finance_owner_id == finance_owner_id)
        .all()
    )
    active = [l for l, _ in loans if l.status == "ACTIVE"]
    defaulted = [l for l, _ in loans if l.status == "DEFAULTED"]
    closed = [l for l, _ in loans if l.status == "CLOSED"]

    return {
        "total_loans": len(loans),
        "active_count": len(active),
        "defaulted_count": len(defaulted),
        "closed_count": len(closed),
        "total_principal_outstanding": str(
            sum(
                (Decimal(l.remaining_principal) for l in active + defaulted),
                ZERO,
            ).quantize(ZERO)
        ),
        "loans": [
            {
                "loan_id": loan.id,
                "customer_name": customer.full_name,
                "status": loan.status,
                "principal": str(loan.principal_amount),
                "remaining_principal": str(loan.remaining_principal),
                "interest_rate": str(loan.interest_rate),
            }
            for loan, customer in loans
        ],
    }


def _decimal_dict(data: dict) -> dict:
    out = {}
    for key, val in data.items():
        if isinstance(val, Decimal):
            out[key] = str(val)
        else:
            out[key] = val
    return out


def get_financial_summary_report(db: Session, finance_owner_id: int):
    capital = _decimal_dict(get_capital_summary(db, finance_owner_id))
    profit = _decimal_dict(get_profit_summary(db, finance_owner_id))
    net = _decimal_dict(get_net_profit_summary(db, finance_owner_id))
    portfolio = get_portfolio_report(db, finance_owner_id)
    collections = get_collections_report(db, finance_owner_id, days=30)

    return {
        "capital": capital,
        "profit": profit,
        "net_profit": net,
        "portfolio": {
            "total_loans": portfolio["total_loans"],
            "active_count": portfolio["active_count"],
            "defaulted_count": portfolio["defaulted_count"],
            "total_principal_outstanding": portfolio["total_principal_outstanding"],
        },
        "collections_30d": {
            "total_collected": collections["total_collected"],
            "payment_count": collections["payment_count"],
        },
    }


def export_transactions_csv(db: Session, finance_owner_id: int) -> str:
    _, cap_txs = list_capital_transactions(db, finance_owner_id)
    profit_txs = list_profit_transactions(db, finance_owner_id)
    lines = ["ledger,type,direction,amount,balance_after,description,created_at"]
    for tx in cap_txs:
        lines.append(
            f"CAPITAL,{tx.type},{tx.direction},{tx.amount},{tx.balance_after},"
            f"{tx.description or ''},{tx.created_at.isoformat()}"
        )
    for tx in profit_txs:
        lines.append(
            f"PROFIT,{tx.type},{tx.direction},{tx.amount},{tx.balance_after},"
            f"{tx.description or ''},{tx.created_at.isoformat()}"
        )
    return "\n".join(lines)

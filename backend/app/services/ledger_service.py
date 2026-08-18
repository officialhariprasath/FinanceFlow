from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.capital_transaction import CapitalTransaction
from backend.app.models.profit_transaction import ProfitTransaction
from backend.app.services.capital_service import get_or_create_capital_account, get_available_capital
from backend.app.services.profit_service import get_or_create_profit_account, get_available_profit
from backend.app.services.expense_service import get_expense_totals, list_expenses


def get_business_ledger(db: Session, finance_owner_id: int, limit: int = 500):
    cap_account = get_or_create_capital_account(db, finance_owner_id)
    profit_account = get_or_create_profit_account(db, finance_owner_id)

    cap_rows = (
        db.query(CapitalTransaction)
        .filter(CapitalTransaction.capital_account_id == cap_account.id)
        .order_by(CapitalTransaction.created_at.desc())
        .limit(limit)
        .all()
    )
    profit_rows = (
        db.query(ProfitTransaction)
        .filter(ProfitTransaction.profit_account_id == profit_account.id)
        .order_by(ProfitTransaction.created_at.desc())
        .limit(limit)
        .all()
    )

    entries = []
    for row in cap_rows:
        entries.append(
            {
                "ledger": "CAPITAL",
                "id": row.id,
                "type": row.type,
                "direction": row.direction,
                "amount": row.amount,
                "balance_after": row.balance_after,
                "description": row.description,
                "reference_type": row.reference_type,
                "reference_id": row.reference_id,
                "created_at": row.created_at,
            }
        )
    for row in profit_rows:
        entries.append(
            {
                "ledger": "PROFIT",
                "id": row.id,
                "type": row.type,
                "direction": row.direction,
                "amount": row.amount,
                "balance_after": row.balance_after,
                "description": row.description,
                "reference_type": row.reference_type,
                "reference_id": row.reference_id,
                "created_at": row.created_at,
            }
        )

    entries.sort(key=lambda e: e["created_at"], reverse=True)
    return entries[:limit]


def get_reconciliation(db: Session, finance_owner_id: int):
    from backend.app.services.agent_wallet_service import list_all_agent_wallets
    from backend.app.services.capital_service import get_capital_lent, get_total_capital_added
    from backend.app.services.profit_service import get_total_profit_earned
    from backend.app.services.expense_service import get_net_profit_summary

    capital_available = get_available_capital(db, finance_owner_id)
    profit_available = get_available_profit(db, finance_owner_id)
    net = get_net_profit_summary(db, finance_owner_id)
    agent_wallets = list_all_agent_wallets(db, finance_owner_id)
    unsettled_agents = sum(
        Decimal(str(w.get("unsettled_balance", w.get("total_balance", 0))))
        for w in agent_wallets
    )
    from backend.app.services.agent_settlement_service import (
        count_pending_settlements,
        sum_pending_settlement_totals,
    )

    pending_total = sum_pending_settlement_totals(db, finance_owner_id)
    pending_count = count_pending_settlements(db, finance_owner_id)

    cap_account = get_or_create_capital_account(db, finance_owner_id)
    notes = "Unsettled agent cash should be settled or reconciled with owner."
    if pending_count > 0:
        notes = (
            f"{pending_count} settlement(s) pending approval (₹{pending_total}). "
            "Unsettled wallet balances remain until approved."
        )
    return {
        "capital_available": capital_available,
        "capital_lent": get_capital_lent(db, finance_owner_id),
        "total_capital_added": get_total_capital_added(db, cap_account.id),
        "profit_available": profit_available,
        "gross_profit": get_total_profit_earned(db, finance_owner_id),
        "total_expenses": net["total_expenses"],
        "net_profit": net["net_profit"],
        "unsettled_with_agents": unsettled_agents,
        "pending_settlement_total": pending_total,
        "pending_settlement_count": pending_count,
        "is_balanced": unsettled_agents == Decimal("0.00") and pending_count == 0,
        "notes": notes,
    }

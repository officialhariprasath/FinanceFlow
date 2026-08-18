from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.models.customer import Customer
from backend.app.models.enums import CollectionModel, ScheduleStatus
from backend.app.models.loan import Loan
from backend.app.models.loan_schedule import LoanSchedule
from backend.app.models.payment import Payment
from backend.app.models.payment_allocation import PaymentAllocation
from backend.app.services.capital_service import (
    get_available_capital,
    get_capital_lent,
    get_total_capital_added,
)
from backend.app.services.collection_service import get_today_collections
from backend.app.services.profit_service import (
    get_available_profit,
    get_total_profit_earned,
)

ZERO = Decimal("0.00")


def get_financeflow_dashboard(
    db: Session,
    finance_owner_id: int,
):
    today = date.today()
    start_of_day = datetime.combine(today, time.min)
    end_of_day = datetime.combine(today, time.max)

    available_capital = get_available_capital(db, finance_owner_id)
    total_capital_added = get_total_capital_added(
        db,
        __capital_account_id(db, finance_owner_id),
    )
    capital_lent = get_capital_lent(db, finance_owner_id)
    principal_outstanding = capital_lent

    available_profit = get_available_profit(db, finance_owner_id)
    total_profit = get_total_profit_earned(db, finance_owner_id)

    profit_today = (
        db.query(func.coalesce(func.sum(PaymentAllocation.profit_amount), ZERO))
        .join(Payment, PaymentAllocation.payment_id == Payment.id)
        .filter(
            Payment.finance_owner_id == finance_owner_id,
            Payment.payment_date == today,
        )
        .scalar()
    )

    month_start = today.replace(day=1)
    profit_this_month = (
        db.query(func.coalesce(func.sum(PaymentAllocation.profit_amount), ZERO))
        .join(Payment, PaymentAllocation.payment_id == Payment.id)
        .filter(
            Payment.finance_owner_id == finance_owner_id,
            Payment.payment_date >= month_start,
            Payment.payment_date <= today,
        )
        .scalar()
    )

    active_loans = (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
        )
        .count()
    )

    completed_loans = (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "CLOSED",
        )
        .count()
    )

    overdue_loans = (
        db.query(LoanSchedule)
        .join(Loan, LoanSchedule.loan_id == Loan.id)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
            LoanSchedule.status == ScheduleStatus.OVERDUE.value,
        )
        .count()
    )

    total_borrowers = (
        db.query(Customer)
        .filter(Customer.finance_owner_id == finance_owner_id)
        .count()
    )

    collections = get_today_collections(db, finance_owner_id, today)

    from backend.app.services.agent_wallet_service import list_all_agent_wallets
    from backend.app.services.agent_settlement_service import (
        count_pending_settlements,
        sum_pending_settlement_totals,
    )

    agent_wallets = list_all_agent_wallets(db, finance_owner_id)
    unsettled_with_agents = sum(
        Decimal(str(w.get("unsettled_balance", w.get("total_balance", 0))))
        for w in agent_wallets
    )
    pending_count = count_pending_settlements(db, finance_owner_id)
    pending_total = sum_pending_settlement_totals(db, finance_owner_id)

    return {
        "capital_added": total_capital_added,
        "available_capital": available_capital,
        "capital_currently_lent": capital_lent,
        "principal_outstanding": principal_outstanding,
        "profit_today": profit_today or ZERO,
        "profit_this_month": profit_this_month or ZERO,
        "total_profit": total_profit,
        "available_profit": available_profit,
        "active_loans": active_loans,
        "completed_loans": completed_loans,
        "overdue_loans": overdue_loans,
        "total_borrowers": total_borrowers,
        "expected_today": collections["expected_collection"],
        "collected_today": collections["collected"],
        "pending_today": collections["pending"],
        "collection_rate": collections["collection_rate"],
        "unsettled_with_agents": unsettled_with_agents,
        "pending_settlement_count": pending_count,
        "pending_settlement_total": pending_total,
    }


def __capital_account_id(db: Session, finance_owner_id: int) -> int:
    from backend.app.services.capital_service import get_or_create_capital_account

    account = get_or_create_capital_account(db, finance_owner_id)
    return account.id

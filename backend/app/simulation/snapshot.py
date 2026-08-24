"""
Read-only snapshot of current business state for CURRENT_BUSINESS simulation.

Does not create/modify loans, payments, capital, or ledger rows.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.loan import Loan
from backend.app.models.loan_schedule import LoanSchedule
from backend.app.services.capital_service import get_available_capital, get_capital_lent
from backend.app.simulation.models import (
    ExistingLoanState,
    LoanProductConfig,
    LoanProjectionStatus,
    ProfitModel,
    RepaymentFrequency,
    SimulationSnapshot,
)
from backend.app.simulation.money import ZERO, money
from backend.app.utils.loan_helpers import is_installment_loan


def _map_frequency(raw: str | None) -> RepaymentFrequency:
    if not raw:
        return RepaymentFrequency.DAILY
    try:
        return RepaymentFrequency(raw)
    except ValueError:
        return RepaymentFrequency.DAILY


def build_business_snapshot(
    db: Session,
    finance_owner_id: int,
    *,
    as_of: date | None = None,
    default_product: LoanProductConfig | None = None,
) -> SimulationSnapshot:
    today = as_of or date.today()
    available = money(get_available_capital(db, finance_owner_id))
    outstanding = money(get_capital_lent(db, finance_owner_id))

    active_loans = (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
        )
        .all()
    )

    existing: list[ExistingLoanState] = []
    product_counts: dict[str, LoanProductConfig] = {}

    for loan in active_loans:
        if not is_installment_loan(loan):
            # STANDARD accruing loans: approximate remaining as a single bullet
            # using remaining_principal as custom principal with monthly stub —
            # skip detailed schedule; treat remaining principal as custom product cohort.
            if money(loan.remaining_principal) <= ZERO:
                continue
            pid = f"STD-{loan.id}"
            existing.append(
                ExistingLoanState(
                    loan_id=f"L{loan.id}",
                    product_id=pid,
                    principal=money(loan.remaining_principal),
                    installment_amount=money(loan.remaining_principal),
                    installment_principal=money(loan.remaining_principal),
                    installment_profit=ZERO,
                    frequency=RepaymentFrequency.CUSTOM,
                    remaining_installments=1,
                    next_due_date=loan.due_date or today,
                    custom_interval_days=max(1, (loan.due_date - today).days)
                    if loan.due_date and loan.due_date > today
                    else 1,
                    status=LoanProjectionStatus.ACTIVE,
                )
            )
            continue

        pending = (
            db.query(LoanSchedule)
            .filter(
                LoanSchedule.loan_id == loan.id,
                LoanSchedule.status.in_(["PENDING", "PARTIAL", "OVERDUE"]),
            )
            .order_by(LoanSchedule.due_date.asc())
            .all()
        )
        if not pending:
            continue

        remaining = len(pending)
        next_due = pending[0].due_date
        inst_amt = money(loan.daily_payment or 0)
        inst_prin = money(loan.daily_principal or 0)
        inst_profit = money(loan.daily_profit or 0)
        freq = _map_frequency(loan.collection_frequency)
        pid = (
            f"{freq.value}-{inst_amt}-{loan.installment_count or remaining}"
        )
        existing.append(
            ExistingLoanState(
                loan_id=f"L{loan.id}",
                product_id=pid,
                principal=money(loan.principal_amount or 0),
                installment_amount=inst_amt,
                installment_principal=inst_prin,
                installment_profit=inst_profit,
                frequency=freq,
                remaining_installments=remaining,
                next_due_date=next_due,
                status=LoanProjectionStatus.ACTIVE,
            )
        )
        if pid not in product_counts:
            product_counts[pid] = LoanProductConfig(
                product_id=pid,
                name=f"{freq.value} {inst_amt}",
                principal=money(loan.principal_amount or 0),
                installment_amount=inst_amt,
                installment_principal=inst_prin,
                installment_profit=inst_profit,
                installment_count=int(loan.installment_count or remaining),
                frequency=freq,
                profit_model=ProfitModel.FIXED_INSTALLMENT,
            )

    products = list(product_counts.values())
    if not products and default_product is not None:
        products = [default_product]

    return SimulationSnapshot(
        snapshot_date=today,
        available_cash=available,
        outstanding_principal=outstanding,
        active_loan_count=len(existing),
        existing_loans=existing,
        products=products,
        meta={
            "finance_owner_id": finance_owner_id,
            "source": "live_readonly",
            "standard_loans_approximated": True,
        },
    )


def resolve_starting_cash(
    *,
    capital_source: str,
    snapshot: SimulationSnapshot,
    manual: Decimal,
    additional: Decimal,
) -> Decimal:
    from backend.app.simulation.models import CapitalSource

    src = CapitalSource(capital_source)
    if src == CapitalSource.CURRENT:
        return money(snapshot.available_cash)
    if src == CapitalSource.CURRENT_PLUS_ADDITIONAL:
        return money(snapshot.available_cash + money(additional))
    if src in (CapitalSource.MANUAL, CapitalSource.CUSTOM):
        return money(manual)
    return money(snapshot.available_cash)

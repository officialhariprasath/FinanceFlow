"""Option A: cash-location view of capital.

Ledger `available_capital` still includes principal recovered at collection time.
`capital_with_agents` is the principal portion still sitting in agent wallets
(FIFO against completed settlements). Available to lend is ledger capital minus
that in-transit principal.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.agent_settlement import AgentSettlement
from backend.app.models.enums import SettlementStatus
from backend.app.models.payment import Payment
from backend.app.services.agent_wallet_service import list_all_agent_wallets
from backend.app.services.capital_service import (
    ZERO,
    TWOPLACES,
    get_available_capital,
    get_capital_lent,
    get_or_create_capital_account,
    get_total_capital_added,
)

COMPLETED = {
    SettlementStatus.COMPLETED.value,
    SettlementStatus.APPROVED.value,
}


def _agent_payments_oldest_first(db: Session, finance_owner_id: int) -> list[Payment]:
    return (
        db.query(Payment)
        .filter(
            Payment.finance_owner_id == finance_owner_id,
            Payment.collected_by_agent_id.isnot(None),
        )
        .order_by(Payment.payment_date.asc(), Payment.id.asc())
        .all()
    )


def _completed_settlement_total(db: Session, finance_owner_id: int) -> Decimal:
    rows = (
        db.query(AgentSettlement)
        .filter(
            AgentSettlement.finance_owner_id == finance_owner_id,
            AgentSettlement.status.in_(list(COMPLETED)),
        )
        .all()
    )
    total = ZERO
    for row in rows:
        total += Decimal(row.total_amount or ZERO)
    return total.quantize(TWOPLACES)


def unsettled_collection_split(
    db: Session,
    finance_owner_id: int,
) -> dict:
    """FIFO: oldest agent collections are covered by completed settlements first."""
    payments = _agent_payments_oldest_first(db, finance_owner_id)
    remaining_settled = _completed_settlement_total(db, finance_owner_id)

    unsettled_principal = ZERO
    unsettled_profit = ZERO
    unsettled_total = ZERO
    settled_principal = ZERO
    settled_profit = ZERO

    for payment in payments:
        amount = Decimal(payment.amount_paid or ZERO).quantize(TWOPLACES)
        principal = Decimal(payment.principal_paid or ZERO).quantize(TWOPLACES)
        profit = Decimal(payment.interest_paid or ZERO).quantize(TWOPLACES)
        if amount <= ZERO:
            continue

        if remaining_settled <= ZERO:
            unsettled_principal += principal
            unsettled_profit += profit
            unsettled_total += amount
            continue

        if remaining_settled >= amount:
            remaining_settled -= amount
            settled_principal += principal
            settled_profit += profit
            continue

        # Partial cover of this payment
        covered = remaining_settled
        uncovered = amount - covered
        ratio_uncovered = uncovered / amount
        part_principal = (principal * ratio_uncovered).quantize(TWOPLACES)
        part_profit = (uncovered - part_principal).quantize(TWOPLACES)
        unsettled_principal += part_principal
        unsettled_profit += part_profit
        unsettled_total += uncovered
        settled_principal += (principal - part_principal).quantize(TWOPLACES)
        settled_profit += (profit - part_profit).quantize(TWOPLACES)
        remaining_settled = ZERO

    wallets = list_all_agent_wallets(db, finance_owner_id)
    wallet_unsettled = sum(
        (Decimal(str(w.get("unsettled_balance", w.get("total_balance", 0)))) for w in wallets),
        ZERO,
    ).quantize(TWOPLACES)

    # Prefer live wallet total if FIFO drift from rounding; scale principal/profit.
    if wallet_unsettled != unsettled_total and unsettled_total > ZERO:
        scale = wallet_unsettled / unsettled_total
        unsettled_principal = (unsettled_principal * scale).quantize(TWOPLACES)
        unsettled_profit = (wallet_unsettled - unsettled_principal).quantize(TWOPLACES)
        unsettled_total = wallet_unsettled
    elif unsettled_total == ZERO and wallet_unsettled > ZERO:
        # No payment history match — treat all unsettled wallet as principal risk
        unsettled_total = wallet_unsettled
        unsettled_principal = wallet_unsettled
        unsettled_profit = ZERO

    return {
        "unsettled_total": unsettled_total.quantize(TWOPLACES),
        "capital_with_agents": unsettled_principal.quantize(TWOPLACES),
        "profit_with_agents": unsettled_profit.quantize(TWOPLACES),
        "settled_principal": settled_principal.quantize(TWOPLACES),
        "settled_profit": settled_profit.quantize(TWOPLACES),
        "wallet_unsettled": wallet_unsettled,
    }


def split_settlement_amount(
    db: Session,
    finance_owner_id: int,
    settlement_amount: Decimal,
) -> dict:
    """Allocate a settlement amount against oldest unsettled collections (FIFO)."""
    amount = Decimal(settlement_amount).quantize(TWOPLACES)
    if amount <= ZERO:
        return {
            "settlement_amount": ZERO,
            "principal_amount": ZERO,
            "profit_amount": ZERO,
        }

    payments = _agent_payments_oldest_first(db, finance_owner_id)
    remaining_settled = _completed_settlement_total(db, finance_owner_id)

    principal_part = ZERO
    profit_part = ZERO
    need = amount

    for payment in payments:
        pay_amt = Decimal(payment.amount_paid or ZERO).quantize(TWOPLACES)
        principal = Decimal(payment.principal_paid or ZERO).quantize(TWOPLACES)
        profit = Decimal(payment.interest_paid or ZERO).quantize(TWOPLACES)
        if pay_amt <= ZERO:
            continue

        if remaining_settled >= pay_amt:
            remaining_settled -= pay_amt
            continue

        if remaining_settled > ZERO:
            uncovered = pay_amt - remaining_settled
            ratio = uncovered / pay_amt
            unc_principal = (principal * ratio).quantize(TWOPLACES)
            unc_profit = (uncovered - unc_principal).quantize(TWOPLACES)
            remaining_settled = ZERO
        else:
            uncovered = pay_amt
            unc_principal = principal
            unc_profit = profit

        take = min(need, uncovered)
        if take <= ZERO:
            continue
        ratio_take = take / uncovered
        principal_part += (unc_principal * ratio_take).quantize(TWOPLACES)
        profit_part += (take - (unc_principal * ratio_take).quantize(TWOPLACES)).quantize(
            TWOPLACES
        )
        need -= take
        if need <= ZERO:
            break

    if need > ZERO:
        # Fallback: leftover treated as principal
        principal_part += need

    principal_part = principal_part.quantize(TWOPLACES)
    profit_part = (amount - principal_part).quantize(TWOPLACES)
    return {
        "settlement_amount": amount,
        "principal_amount": principal_part,
        "profit_amount": profit_part,
    }


def get_available_to_lend(db: Session, finance_owner_id: int) -> Decimal:
    ledger = get_available_capital(db, finance_owner_id)
    split = unsettled_collection_split(db, finance_owner_id)
    return (ledger - split["capital_with_agents"]).quantize(TWOPLACES)


def get_capital_location_summary(db: Session, finance_owner_id: int) -> dict:
    account = get_or_create_capital_account(db, finance_owner_id)
    ledger_available = get_available_capital(db, finance_owner_id)
    split = unsettled_collection_split(db, finance_owner_id)
    available_to_lend = (ledger_available - split["capital_with_agents"]).quantize(TWOPLACES)
    capital_lent = get_capital_lent(db, finance_owner_id)
    total_added = get_total_capital_added(db, account.id)

    return {
        "available_capital": available_to_lend,  # lending-safe number for UI primary card
        "ledger_capital": ledger_available,
        "available_to_lend": available_to_lend,
        "capital_with_agents": split["capital_with_agents"],
        "profit_with_agents": split["profit_with_agents"],
        "unsettled_with_agents": split["unsettled_total"],
        "capital_with_owner": available_to_lend,
        "total_capital_added": total_added,
        "capital_currently_lent": capital_lent,
        "currency": account.currency,
        "over_lent_against_unsettled": available_to_lend < ZERO,
    }

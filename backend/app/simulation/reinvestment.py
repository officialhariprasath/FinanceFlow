"""Reinvestment and withdrawal cash split helpers."""

from __future__ import annotations

from decimal import Decimal

from backend.app.simulation.models import ReinvestmentMode, ReinvestmentPolicy, WithdrawalPolicy
from backend.app.simulation.money import money


def split_day_cash(
    *,
    principal_recovered: Decimal,
    profit_collected: Decimal,
    reinvestment: ReinvestmentPolicy,
    withdrawal: WithdrawalPolicy,
    day_number: int,
) -> tuple[Decimal, Decimal, Decimal]:
    """
    Returns (eligible_for_lending, withdrawn_profit, retained_not_deployable).

    Withdrawal is applied to profit first (after wait period). Reinvestment %
    then applies to the remaining pool so both can be non-zero together
    (e.g. 70% reinvest + 30% withdraw).
    """
    principal = money(principal_recovered)
    profit = money(profit_collected)
    reinvest_pct = money(reinvestment.percentage)
    withdraw_pct = money(withdrawal.percentage)

    if reinvest_pct < 0:
        reinvest_pct = money(0)
    if reinvest_pct > 100:
        reinvest_pct = money(100)
    if withdraw_pct < 0:
        withdraw_pct = money(0)
    if withdraw_pct > 100:
        withdraw_pct = money(100)

    withdrawal_active = day_number >= max(0, withdrawal.start_day)
    withdrawn = (
        money(profit * withdraw_pct / Decimal("100")) if withdrawal_active else money(0)
    )
    if withdrawn > profit:
        withdrawn = profit
    remaining_profit = money(profit - withdrawn)

    if reinvestment.mode == ReinvestmentMode.FULL_PRINCIPAL_PLUS_PROFIT_PCT:
        profit_reinvest = money(remaining_profit * reinvest_pct / Decimal("100"))
        eligible = money(principal + profit_reinvest)
        retained = money(remaining_profit - profit_reinvest)
        return eligible, withdrawn, retained

    if reinvestment.mode == ReinvestmentMode.PCT_OF_BOTH:
        pool = money(principal + remaining_profit)
        eligible = money(pool * reinvest_pct / Decimal("100"))
        retained = money(pool - eligible)
        return eligible, withdrawn, retained

    # TOTAL_ELIGIBLE_CASH: % of (principal + profit left after withdrawal)
    pool = money(principal + remaining_profit)
    eligible = money(pool * reinvest_pct / Decimal("100"))
    retained = money(pool - eligible)
    return eligible, withdrawn, retained

"""Target metric resolution — extensible, no hardcoded targets."""

from __future__ import annotations

from decimal import Decimal

from backend.app.simulation.models import (
    DailySnapshot,
    MonthlyProfitMethod,
    TargetConfiguration,
    TargetType,
)
from backend.app.simulation.money import money


def resolve_target_metric(
    day: DailySnapshot,
    target: TargetConfiguration,
    *,
    calendar_month_profit: Decimal | None = None,
) -> Decimal:
    t = target.target_type
    if t == TargetType.DAILY_PROFIT:
        return money(day.profit)
    if t == TargetType.WEEKLY_PROFIT:
        return money(day.profit * Decimal("7"))
    if t == TargetType.MONTHLY_PROFIT:
        if (
            target.monthly_method == MonthlyProfitMethod.CALENDAR_MONTH
            and calendar_month_profit is not None
        ):
            return money(calendar_month_profit)
        return money(day.profit * Decimal("30"))
    if t == TargetType.ANNUAL_PROFIT:
        return money(day.profit * Decimal("365"))
    if t == TargetType.OWNER_WITHDRAWAL:
        return money(day.withdrawn_profit)
    if t == TargetType.LENDING_CAPITAL:
        return money(day.ending_cash)
    if t == TargetType.ACTIVE_LOAN_COUNT:
        return money(day.active_loans)
    if t == TargetType.TOTAL_PORTFOLIO:
        return money(day.total_portfolio)
    if t == TargetType.TOTAL_COLLECTIONS:
        return money(day.cumulative_collections)
    if t == TargetType.CUMULATIVE_PROFIT:
        return money(day.cumulative_profit)
    # CUSTOM falls back to monthly run-rate unless caller overrides
    return money(day.profit * Decimal("30"))


def progress_pct(metric: Decimal, target_value: Decimal) -> Decimal:
    target_value = money(target_value)
    if target_value <= 0:
        return money(0)
    return money((money(metric) / target_value) * Decimal("100"))

"""Repayment schedule generation from frequency + calendar dates."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from backend.app.simulation.models import RepaymentFrequency
from backend.app.simulation.money import money
from backend.app.utils.date_helpers import add_months


@dataclass(frozen=True)
class CollectionEvent:
    due_date: date
    principal: Decimal
    profit: Decimal
    total: Decimal
    installment_index: int


def next_due_after(
    from_date: date,
    frequency: RepaymentFrequency,
    custom_interval_days: int = 1,
) -> date:
    if frequency == RepaymentFrequency.WEEKLY:
        return from_date + timedelta(days=7)
    if frequency == RepaymentFrequency.BI_WEEKLY:
        return from_date + timedelta(days=14)
    if frequency == RepaymentFrequency.MONTHLY:
        return add_months(from_date, 1)
    if frequency == RepaymentFrequency.CUSTOM:
        return from_date + timedelta(days=max(1, custom_interval_days))
    return from_date + timedelta(days=1)


def due_date_at_index(
    start: date,
    frequency: RepaymentFrequency,
    index: int,
    custom_interval_days: int = 1,
) -> date:
    if index < 0:
        return start
    if frequency == RepaymentFrequency.WEEKLY:
        return start + timedelta(days=7 * index)
    if frequency == RepaymentFrequency.BI_WEEKLY:
        return start + timedelta(days=14 * index)
    if frequency == RepaymentFrequency.MONTHLY:
        return add_months(start, index)
    if frequency == RepaymentFrequency.CUSTOM:
        return start + timedelta(days=max(1, custom_interval_days) * index)
    return start + timedelta(days=index)


def build_schedule(
    *,
    first_due: date,
    installment_count: int,
    principal_per: Decimal,
    profit_per: Decimal,
    frequency: RepaymentFrequency,
    custom_interval_days: int = 1,
) -> list[CollectionEvent]:
    events: list[CollectionEvent] = []
    p = money(principal_per)
    pr = money(profit_per)
    total = money(p + pr)
    for i in range(max(0, installment_count)):
        d = due_date_at_index(first_due, frequency, i, custom_interval_days)
        events.append(
            CollectionEvent(
                due_date=d,
                principal=p,
                profit=pr,
                total=total,
                installment_index=i,
            )
        )
    return events

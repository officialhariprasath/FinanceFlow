"""Safe monetary helpers using Decimal (minor-unit friendly via 2dp quantization)."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

TWOPLACES = Decimal("0.01")
ZERO = Decimal("0.00")


def money(value: Decimal | int | float | str | None) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        d = value
    else:
        d = Decimal(str(value))
    return d.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def floor_div(available: Decimal, unit: Decimal) -> int:
    """How many whole units fit into available cash."""
    unit = money(unit)
    if unit <= ZERO:
        return 0
    available = money(available)
    if available < unit:
        return 0
    return int(available // unit)

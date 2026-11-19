from decimal import Decimal
from typing import Literal

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")

AllocationMode = Literal["BOTH", "DUE_ONLY", "PENALTY_ONLY"]


def normalize_allocation_mode(value: str | None) -> AllocationMode:
    key = (value or "BOTH").strip().upper()
    if key in ("DUE_ONLY", "DUE", "INSTALLMENT_ONLY"):
        return "DUE_ONLY"
    if key in ("PENALTY_ONLY", "PENALTY"):
        return "PENALTY_ONLY"
    return "BOTH"


def allocate_payment_amount(
    amount: Decimal,
    profit_remaining: Decimal,
    principal_remaining: Decimal,
    penalty_remaining: Decimal = ZERO,
    allocation_mode: AllocationMode = "BOTH",
) -> tuple[Decimal, Decimal, Decimal]:
    """
    Allocate payment by mode:
      BOTH         — profit → principal → penalty
      DUE_ONLY     — profit → principal (ignore penalty)
      PENALTY_ONLY — penalty only (ignore due)
    """
    amount = amount.quantize(TWOPLACES)
    profit_remaining = max(profit_remaining.quantize(TWOPLACES), ZERO)
    principal_remaining = max(principal_remaining.quantize(TWOPLACES), ZERO)
    penalty_remaining = max(penalty_remaining.quantize(TWOPLACES), ZERO)
    mode = normalize_allocation_mode(allocation_mode)

    if mode == "PENALTY_ONLY":
        penalty_paid = min(amount, penalty_remaining)
        return ZERO, ZERO, penalty_paid.quantize(TWOPLACES)

    if mode == "DUE_ONLY":
        profit_paid = min(amount, profit_remaining)
        remainder = amount - profit_paid
        principal_paid = min(remainder, principal_remaining)
        return (
            principal_paid.quantize(TWOPLACES),
            profit_paid.quantize(TWOPLACES),
            ZERO,
        )

    # BOTH
    profit_paid = min(amount, profit_remaining)
    remainder = amount - profit_paid
    principal_paid = min(remainder, principal_remaining)
    remainder -= principal_paid
    penalty_paid = min(remainder, penalty_remaining)

    return (
        principal_paid.quantize(TWOPLACES),
        profit_paid.quantize(TWOPLACES),
        penalty_paid.quantize(TWOPLACES),
    )

from decimal import Decimal

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def allocate_payment_amount(
    amount: Decimal,
    profit_remaining: Decimal,
    principal_remaining: Decimal,
) -> tuple[Decimal, Decimal]:
    """
    Allocate payment: profit first, then principal (README default).
    """
    amount = amount.quantize(TWOPLACES)
    profit_remaining = max(profit_remaining.quantize(TWOPLACES), ZERO)
    principal_remaining = max(principal_remaining.quantize(TWOPLACES), ZERO)

    profit_paid = min(amount, profit_remaining)
    principal_paid = min(amount - profit_paid, principal_remaining)

    return principal_paid.quantize(TWOPLACES), profit_paid.quantize(TWOPLACES)

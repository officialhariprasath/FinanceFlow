from decimal import Decimal

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def allocate_payment_amount(
    amount: Decimal,
    profit_remaining: Decimal,
    principal_remaining: Decimal,
    penalty_remaining: Decimal = ZERO,
) -> tuple[Decimal, Decimal, Decimal]:
    """
    Allocate payment: profit first, then principal, then penalty.

    Preserves the existing profit→principal order; penalty is an additional
    fixed charge collected after the installment components.
    """
    amount = amount.quantize(TWOPLACES)
    profit_remaining = max(profit_remaining.quantize(TWOPLACES), ZERO)
    principal_remaining = max(principal_remaining.quantize(TWOPLACES), ZERO)
    penalty_remaining = max(penalty_remaining.quantize(TWOPLACES), ZERO)

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

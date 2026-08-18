from decimal import Decimal

from fastapi import HTTPException, status

from backend.app.models.enums import SettlementDeliveryMethod

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def _quantize(amount: Decimal) -> Decimal:
    return amount.quantize(TWOPLACES)


def validate_settlement_delivery(
    total_cleared: Decimal,
    delivery_method: str,
    delivery_cash: Decimal,
    delivery_upi: Decimal,
    delivery_other: Decimal,
    transfer_reference: str | None,
) -> tuple[Decimal, Decimal, Decimal, str]:
    method = (delivery_method or SettlementDeliveryMethod.CASH.value).upper()
    if method not in {m.value for m in SettlementDeliveryMethod}:
        raise HTTPException(status_code=400, detail="Invalid delivery method.")

    delivery_cash = _quantize(delivery_cash)
    delivery_upi = _quantize(delivery_upi)
    delivery_other = _quantize(delivery_other)
    total_cleared = _quantize(total_cleared)
    delivery_total = (delivery_cash + delivery_upi + delivery_other).quantize(TWOPLACES)

    ref = (transfer_reference or "").strip()

    if method == SettlementDeliveryMethod.CASH.value:
        delivery_cash = total_cleared
        delivery_upi = ZERO
        delivery_other = ZERO
    elif method == SettlementDeliveryMethod.UPI.value:
        delivery_cash = ZERO
        delivery_upi = total_cleared
        delivery_other = ZERO
        if not ref:
            raise HTTPException(
                status_code=400,
                detail="UPI reference is required when delivery method is UPI.",
            )
    elif method == SettlementDeliveryMethod.BANK.value:
        delivery_cash = ZERO
        delivery_upi = ZERO
        delivery_other = total_cleared
        if not ref:
            raise HTTPException(
                status_code=400,
                detail="Bank transfer reference is required when delivery method is Bank.",
            )
    elif method == SettlementDeliveryMethod.MIXED.value:
        if delivery_total != total_cleared:
            raise HTTPException(
                status_code=400,
                detail="Delivery amounts must equal the total being settled.",
            )
        if delivery_upi > ZERO and not ref:
            raise HTTPException(
                status_code=400,
                detail="UPI reference is required when UPI is part of the delivery.",
            )
    else:
        raise HTTPException(status_code=400, detail="Invalid delivery method.")

    if delivery_cash + delivery_upi + delivery_other != total_cleared:
        raise HTTPException(
            status_code=400,
            detail="Delivery breakdown must match total settlement amount.",
        )

    return delivery_cash, delivery_upi, delivery_other, method


def delivery_summary(
    delivery_method: str,
    delivery_cash: Decimal,
    delivery_upi: Decimal,
    delivery_other: Decimal,
    transfer_reference: str | None,
) -> str:
    parts = []
    if delivery_cash > ZERO:
        parts.append(f"Cash {delivery_cash}")
    if delivery_upi > ZERO:
        parts.append(f"UPI {delivery_upi}")
    if delivery_other > ZERO:
        parts.append(f"Bank/Other {delivery_other}")
    summary = f"Received via {delivery_method}"
    if parts:
        summary += f" ({', '.join(parts)})"
    if transfer_reference:
        summary += f" — ref {transfer_reference}"
    return summary

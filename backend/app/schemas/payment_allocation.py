from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class PaymentAllocationLine(BaseModel):
    schedule_date: date
    expected_pending: Decimal
    applied_amount: Decimal
    remaining_pending: Decimal
    status_after: str
    due_applied: Decimal = Decimal("0.00")
    penalty_applied: Decimal = Decimal("0.00")


class PaymentAllocationPreviewResponse(BaseModel):
    principal_amount: Decimal
    profit_amount: Decimal
    late_fee_amount: Decimal = Decimal("0.00")
    total_amount: Decimal
    installment_count: int = 1
    unapplied_amount: Decimal = Decimal("0.00")
    allocation_mode: str | None = None
    lines: list[PaymentAllocationLine] = []

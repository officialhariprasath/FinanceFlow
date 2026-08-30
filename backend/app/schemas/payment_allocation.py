from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class PaymentAllocationLine(BaseModel):
    schedule_date: date
    expected_pending: Decimal
    applied_amount: Decimal
    remaining_pending: Decimal
    status_after: str


class PaymentAllocationPreviewResponse(BaseModel):
    principal_amount: Decimal
    profit_amount: Decimal
    total_amount: Decimal
    installment_count: int = 1
    unapplied_amount: Decimal = Decimal("0.00")
    lines: list[PaymentAllocationLine] = []

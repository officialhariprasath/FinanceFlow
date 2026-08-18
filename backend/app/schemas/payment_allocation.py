from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class PaymentAllocationPreviewResponse(BaseModel):
    principal_amount: Decimal
    profit_amount: Decimal
    total_amount: Decimal
    installment_count: int = 1
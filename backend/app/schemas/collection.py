from datetime import date
from decimal import Decimal
from typing import List

from pydantic import BaseModel, ConfigDict


class CollectionItemResponse(BaseModel):
    loan_id: int
    customer_id: int
    customer_name: str
    customer_phone: str
    schedule_date: date
    expected_amount: Decimal
    paid_amount: Decimal
    pending_amount: Decimal
    overdue_pending_amount: Decimal = Decimal("0.00")
    expected_principal: Decimal
    expected_profit: Decimal
    status: str
    is_assigned_to_agent: bool = True


class CollectionSummaryResponse(BaseModel):
    date: date
    expected_collection: Decimal
    collected: Decimal
    pending: Decimal
    overdue_pending: Decimal = Decimal("0.00")
    collection_rate: Decimal
    overdue_count: int
    unassigned_due_count: int = 0
    unassigned_due_total: Decimal = Decimal("0.00")
    unassigned_borrower_names: List[str] = []
    items: List[CollectionItemResponse]

    model_config = ConfigDict(from_attributes=True)

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
    expected_principal: Decimal
    expected_profit: Decimal
    status: str


class CollectionSummaryResponse(BaseModel):
    date: date
    expected_collection: Decimal
    collected: Decimal
    pending: Decimal
    collection_rate: Decimal
    overdue_count: int
    items: List[CollectionItemResponse]

    model_config = ConfigDict(from_attributes=True)

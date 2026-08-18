from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CapitalAddRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None


class CapitalTransactionResponse(BaseModel):
    id: int
    type: str
    amount: Decimal
    direction: str
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    description: Optional[str] = None
    balance_after: Decimal
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CapitalSummaryResponse(BaseModel):
    available_capital: Decimal
    total_capital_added: Decimal
    capital_currently_lent: Decimal = Decimal("0.00")
    currency: str
    transaction_count: int


class CapitalTransactionListResponse(BaseModel):
    transactions: List[CapitalTransactionResponse]
    available_capital: Decimal

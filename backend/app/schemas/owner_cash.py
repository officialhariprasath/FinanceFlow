from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class OwnerCashSummary(BaseModel):
    principal_balance: Decimal
    profit_balance: Decimal
    total_balance: Decimal
    currency: str
    available_to_lend: Decimal
    capital_with_agents: Decimal
    profit_with_agents: Decimal
    unsettled_with_agents: Decimal
    ledger_capital: Decimal
    total_capital_added: Decimal
    capital_currently_lent: Decimal
    available_profit_ledger: Decimal
    over_lent_against_unsettled: bool = False
    notes: str


class OwnerCashTransactionResponse(BaseModel):
    id: int
    type: str
    direction: str
    amount: Decimal
    principal_amount: Decimal
    profit_amount: Decimal
    principal_balance_after: Decimal
    profit_balance_after: Decimal
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    description: Optional[str] = None
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OwnerCashAmountRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None


class OwnerCashActionResponse(BaseModel):
    transaction: OwnerCashTransactionResponse
    summary: OwnerCashSummary

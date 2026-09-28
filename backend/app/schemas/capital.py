from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CapitalAddRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None
    confirm_settlement_recycle: bool = False


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
    ledger_capital: Decimal = Decimal("0.00")
    available_to_lend: Decimal = Decimal("0.00")
    capital_with_agents: Decimal = Decimal("0.00")
    profit_with_agents: Decimal = Decimal("0.00")
    unsettled_with_agents: Decimal = Decimal("0.00")
    owner_account_principal: Decimal = Decimal("0.00")
    capital_with_owner: Decimal = Decimal("0.00")
    total_capital_added: Decimal
    capital_currently_lent: Decimal = Decimal("0.00")
    currency: str
    transaction_count: int
    over_lent_against_unsettled: bool = False


class CapitalTransactionListResponse(BaseModel):
    transactions: List[CapitalTransactionResponse]
    available_capital: Decimal
    available_to_lend: Decimal = Decimal("0.00")
    capital_with_agents: Decimal = Decimal("0.00")

from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AmountRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None


class ProfitTransactionResponse(BaseModel):
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


class ProfitReinvestResponse(BaseModel):
    profit_transaction: ProfitTransactionResponse
    capital_transaction_id: int


class NetProfitSummaryResponse(BaseModel):
    gross_profit: Decimal
    total_expenses: Decimal
    capital_expenses: Decimal = Decimal("0")
    net_profit: Decimal
    available_profit: Decimal


class ExpenseCreateRequest(BaseModel):
    category: str
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None
    funding_source: str = "PROFIT"


class ExpenseResponse(BaseModel):
    id: int
    category: str
    amount: Decimal
    description: Optional[str] = None
    funding_source: str = "PROFIT"
    profit_transaction_id: Optional[int] = None
    capital_transaction_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LedgerEntryResponse(BaseModel):
    ledger: str
    id: int
    type: str
    direction: str
    amount: Decimal
    balance_after: Decimal
    description: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    created_at: datetime


class ReconciliationResponse(BaseModel):
    capital_available: Decimal
    capital_lent: Decimal
    total_capital_added: Decimal
    profit_available: Decimal
    gross_profit: Decimal
    total_expenses: Decimal
    net_profit: Decimal
    unsettled_with_agents: Decimal
    pending_settlement_total: Decimal = Decimal("0")
    pending_settlement_count: int = 0
    is_balanced: bool
    notes: str


class OverdueLoanResponse(BaseModel):
    loan_id: int
    customer_name: str
    schedule_date: date
    expected_amount: Decimal
    paid_amount: Decimal
    pending_amount: Decimal


class WriteOffRequest(BaseModel):
    amount_recovered: Decimal = Field(default=Decimal("0"), ge=0)
    reason: Optional[str] = None


class DefaultRequest(BaseModel):
    reason: Optional[str] = None


class WriteOffResponse(BaseModel):
    id: int
    loan_id: int
    principal_outstanding: Decimal
    amount_recovered: Decimal
    principal_loss: Decimal
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    id: int
    actor_type: str
    actor_id: Optional[int] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    level: str
    is_read: bool
    action_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationCountResponse(BaseModel):
    unread_count: int


from backend.app.schemas.capital import CapitalTransactionResponse


class CapitalWithdrawResponse(BaseModel):
    transaction: CapitalTransactionResponse
    available_before: Decimal
    available_after: Decimal
    warning: Optional[str] = None

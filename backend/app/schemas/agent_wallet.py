from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator
from datetime import date, datetime


class AgentWalletBalance(BaseModel):
    agent_id: Optional[int] = None
    agent_name: Optional[str] = None
    assigned_area: Optional[str] = None
    cash_balance: Decimal
    upi_balance: Decimal
    other_balance: Decimal
    total_balance: Decimal
    today_collected: Optional[Decimal] = None
    unsettled_balance: Optional[Decimal] = None
    pending_settlement_total: Optional[Decimal] = None
    has_pending_settlement: Optional[bool] = None
    status: Optional[str] = None


class AgentLedgerEntryResponse(BaseModel):
    id: int
    entry_type: str
    channel: str
    credit_amount: Decimal
    debit_amount: Decimal
    balance_after: Decimal
    payment_id: Optional[int] = None
    settlement_id: Optional[int] = None
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentSettlementCreate(BaseModel):
    cash_amount: Decimal = Decimal("0")
    upi_amount: Decimal = Decimal("0")
    other_amount: Decimal = Decimal("0")
    delivery_method: str = "CASH"
    delivery_cash_amount: Decimal = Decimal("0")
    delivery_upi_amount: Decimal = Decimal("0")
    delivery_other_amount: Decimal = Decimal("0")
    transfer_reference: Optional[str] = None
    transfer_date: Optional[date] = None
    proof_notes: Optional[str] = None
    reconciliation_note: Optional[str] = None


class AgentSettlementReject(BaseModel):
    reason: str


class AgentSettlementResponse(BaseModel):
    id: int
    agent_id: int
    agent_name: Optional[str] = None
    status: str
    cash_amount: Decimal
    upi_amount: Decimal
    other_amount: Decimal
    total_amount: Decimal
    delivery_method: str
    delivery_cash_amount: Decimal
    delivery_upi_amount: Decimal
    delivery_other_amount: Decimal
    transfer_reference: Optional[str] = None
    transfer_date: Optional[date] = None
    proof_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    reconciliation_note: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AgentDashboardResponse(BaseModel):
    expected_today: Decimal
    collected_today: Decimal
    pending_today: Decimal
    wallet: AgentWalletBalance
    reconciliation_difference: Decimal
    is_balanced: bool


class AgentAssignmentCreate(BaseModel):
    customer_ids: List[int]


class AgentAssignmentResponse(BaseModel):
    agent_id: int
    customer_id: int
    customer_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

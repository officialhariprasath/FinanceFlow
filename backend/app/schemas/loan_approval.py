from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoanApprovalCreate(BaseModel):
    customer_id: int
    principal_amount: Decimal
    interest_rate: Decimal = Decimal("0")
    collection_frequency: str = "DAILY"
    installment_count: int
    issue_date: date
    due_start_date: date
    daily_payment: Optional[Decimal] = None
    daily_principal: Optional[Decimal] = None
    daily_profit: Optional[Decimal] = None
    collection_agent_id: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("collection_frequency", mode="before")
    @classmethod
    def normalize_freq(cls, value):
        if value is None:
            return "DAILY"
        return str(value).strip().upper()


class LoanApprovalReject(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class LoanApprovalResponse(BaseModel):
    id: int
    finance_owner_id: int
    customer_id: int
    customer_name: str | None = None
    customer_display_code: str | None = None
    customer_phone: str | None = None
    status: str
    principal_amount: Decimal
    interest_rate: Decimal
    collection_frequency: str
    installment_count: int
    issue_date: date
    due_start_date: date
    daily_payment: Decimal | None = None
    daily_principal: Decimal | None = None
    daily_profit: Decimal | None = None
    collection_agent_id: int | None = None
    collection_agent_name: str | None = None
    submitted_by_agent_id: int | None = None
    submitted_by_name: str | None = None
    reviewed_by_agent_id: int | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None
    created_loan_id: int | None = None
    notes: str | None = None
    created_at: datetime | None = None
    credit_score: int | None = None
    credit_band: str | None = None

    model_config = ConfigDict(from_attributes=True)

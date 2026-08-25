from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator


class LoanCreate(BaseModel):
    customer_id: int
    principal_amount: Decimal
    interest_method: str
    interest_rate: Decimal
    issue_date: date
    due_date: date
    collection_model: str = "STANDARD"
    collection_frequency: Optional[str] = "DAILY"
    installment_count: Optional[int] = None
    due_start_date: Optional[date] = None
    duration_days: Optional[int] = None
    daily_payment: Optional[Decimal] = None
    daily_principal: Optional[Decimal] = None
    daily_profit: Optional[Decimal] = None

    @field_validator("collection_model", mode="before")
    @classmethod
    def normalize_collection_model(cls, value):
        if value is None:
            return "STANDARD"
        return str(value).strip().upper()

    @field_validator("collection_frequency", mode="before")
    @classmethod
    def normalize_collection_frequency(cls, value):
        if value is None:
            return "DAILY"
        return str(value).strip().upper()


class LoanUpdate(BaseModel):
    """
    Editable loan terms.

    Standard loans: interest_method, interest_rate, due_date.
    Installment loans with no collections yet: frequency, count,
    first collection date, and installment amounts (schedule rebuilt).
    Customer, principal, issue date, and collection model stay locked.
    """

    interest_method: str
    interest_rate: Decimal
    due_date: date
    collection_frequency: Optional[str] = None
    installment_count: Optional[int] = None
    due_start_date: Optional[date] = None
    daily_payment: Optional[Decimal] = None
    daily_principal: Optional[Decimal] = None
    daily_profit: Optional[Decimal] = None

    @field_validator("collection_frequency", mode="before")
    @classmethod
    def normalize_collection_frequency(cls, value):
        if value is None or value == "":
            return None
        return str(value).strip().upper()

class LoanResponse(BaseModel):
    id: int
    customer_id: int
    principal_amount: Decimal
    remaining_principal: Decimal
    total_principal_paid: Decimal
    total_interest_paid: Decimal
    interest_method: str
    interest_rate: Decimal
    issue_date: date
    due_date: date
    interest_start_date: date
    last_interest_calculated_on: date
    status: str

    settlement_amount: Decimal | None = None
    waived_amount: Decimal | None = None
    settlement_date: date | None = None
    settlement_reason: str | None = None
    closure_type: str | None = None

    collection_model: str = "STANDARD"
    collection_frequency: str = "DAILY"
    installment_count: int | None = None
    due_start_date: date | None = None
    duration_days: int | None = None
    daily_payment: Decimal | None = None
    daily_principal: Decimal | None = None
    daily_profit: Decimal | None = None
    total_expected_profit: Decimal | None = None
    total_profit_paid: Decimal | None = None

    model_config = ConfigDict(from_attributes=True)

class LoanStatementPaymentResponse(BaseModel):
    """
    Payment details for the loan statement.
    """

    payment_date: date
    amount_paid: Decimal
    principal_paid: Decimal
    interest_paid: Decimal
    payment_mode: str
    remarks: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UnpaidScheduleResponse(BaseModel):
    schedule_date: date
    expected_amount: Decimal
    paid_amount: Decimal
    pending_amount: Decimal
    status: str
    is_today: bool
    is_future: bool


class LoanStatementResponse(BaseModel):
    """
    Complete statement for a single loan.
    """

    loan: LoanResponse
    customer_name: str
    customer_phone: str
    accrued_interest: Decimal
    total_outstanding: Decimal
    payments: List[LoanStatementPaymentResponse]
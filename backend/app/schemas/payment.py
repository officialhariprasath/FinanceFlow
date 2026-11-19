from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator
from backend.app.models.enums import PaymentMode


_PAYMENT_MODE_MAP = {
    "cash": PaymentMode.CASH,
    "upi": PaymentMode.UPI,
    "bank transfer": PaymentMode.BANK_TRANSFER,
    "bank_transfer": PaymentMode.BANK_TRANSFER,
    "banktransfer": PaymentMode.BANK_TRANSFER,
    "cheque": PaymentMode.CHEQUE,
    "check": PaymentMode.CHEQUE,
}


class PaymentCreate(BaseModel):
    loan_id: int
    payment_date: date
    amount_paid: Decimal
    payment_mode: PaymentMode
    remarks: Optional[str] = None
    payment_reference: Optional[str] = None
    schedule_dates: Optional[List[date]] = None
    # BOTH | DUE_ONLY | PENALTY_ONLY — installment daily-collection only.
    allocation_mode: Optional[str] = "BOTH"

    @field_validator("payment_mode", mode="before")
    @classmethod
    def normalize_payment_mode(cls, value):
        if isinstance(value, PaymentMode):
            return value

        key = str(value).strip().lower()

        if key in _PAYMENT_MODE_MAP:
            return _PAYMENT_MODE_MAP[key]

        return value

    @field_validator("allocation_mode", mode="before")
    @classmethod
    def normalize_allocation_mode(cls, value):
        if value is None or value == "":
            return "BOTH"
        key = str(value).strip().upper()
        if key in ("DUE_ONLY", "DUE", "INSTALLMENT_ONLY"):
            return "DUE_ONLY"
        if key in ("PENALTY_ONLY", "PENALTY"):
            return "PENALTY_ONLY"
        return "BOTH"


class PaymentResponse(BaseModel):
    id: int
    loan_id: int
    finance_owner_id: int
    payment_date: date
    amount_paid: Decimal
    interest_paid: Decimal
    principal_paid: Decimal
    payment_mode: PaymentMode
    remarks: Optional[str] = None
    created_at: datetime
    profit_amount: Optional[Decimal] = None
    collected_by_agent_id: Optional[int] = None
    payment_reference: Optional[str] = None
    is_locked: bool = True

    model_config = ConfigDict(from_attributes=True)

    @field_validator("payment_mode", mode="before")
    @classmethod
    def normalize_payment_mode(cls, value):
        if isinstance(value, PaymentMode):
            return value

        key = str(value).strip().lower()

        if key in _PAYMENT_MODE_MAP:
            return _PAYMENT_MODE_MAP[key]

        return value
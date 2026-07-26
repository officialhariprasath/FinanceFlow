from datetime import date, datetime
from decimal import Decimal
from typing import Optional

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

    @field_validator("payment_mode", mode="before")
    @classmethod
    def normalize_payment_mode(cls, value):
        if isinstance(value, PaymentMode):
            return value

        key = str(value).strip().lower()

        if key in _PAYMENT_MODE_MAP:
            return _PAYMENT_MODE_MAP[key]

        return value


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
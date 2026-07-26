from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FinanceSettingsBase(BaseModel):
    business_name: Optional[str] = Field(None, max_length=150)
    owner_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(None, max_length=300)

    default_interest_method: Optional[str] = None
    default_interest_rate: Optional[Decimal] = None
    default_loan_duration: Optional[int] = None
    default_grace_period: Optional[int] = None

    currency: Optional[str] = None
    date_format: Optional[str] = None
    timezone: Optional[str] = None

    maturity_alert_days: Optional[int] = None


class FinanceSettingsUpdate(FinanceSettingsBase):
    pass


class FinanceSettingsResponse(FinanceSettingsBase):
    id: int
    finance_owner_id: int

    model_config = ConfigDict(from_attributes=True)
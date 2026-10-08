from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


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

    daily_grace_installments: Optional[int] = Field(None, ge=0)
    daily_penalty_per_installment: Optional[Decimal] = Field(None, ge=0)
    weekly_grace_installments: Optional[int] = Field(None, ge=0)
    weekly_penalty_per_installment: Optional[Decimal] = Field(None, ge=0)
    bi_weekly_grace_installments: Optional[int] = Field(None, ge=0)
    bi_weekly_penalty_per_installment: Optional[Decimal] = Field(None, ge=0)
    monthly_grace_installments: Optional[int] = Field(None, ge=0)
    monthly_penalty_per_installment: Optional[Decimal] = Field(None, ge=0)

    @field_validator(
        "daily_grace_installments",
        "weekly_grace_installments",
        "bi_weekly_grace_installments",
        "monthly_grace_installments",
        mode="before",
    )
    @classmethod
    def non_negative_grace(cls, value):
        if value is None:
            return value
        if int(value) < 0:
            raise ValueError("Grace installments must be >= 0")
        return int(value)

    @field_validator(
        "daily_penalty_per_installment",
        "weekly_penalty_per_installment",
        "bi_weekly_penalty_per_installment",
        "monthly_penalty_per_installment",
        mode="before",
    )
    @classmethod
    def non_negative_penalty(cls, value):
        if value is None:
            return value
        amount = Decimal(str(value))
        if amount < 0:
            raise ValueError("Penalty per installment must be >= 0")
        return amount


class FinanceSettingsUpdate(FinanceSettingsBase):
    pass


class FinanceSettingsResponse(FinanceSettingsBase):
    id: int
    finance_owner_id: int
    # Populated on PUT when installment loans are backfilled from settings.
    penalty_loans_updated: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
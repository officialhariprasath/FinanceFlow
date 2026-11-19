from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from backend.app.services.credit_score.band_policy import validate_score_band_cutoffs


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

    score_enabled: Optional[bool] = None
    score_band_poor_max: Optional[int] = Field(None, ge=0, le=1000)
    score_band_fair_max: Optional[int] = Field(None, ge=0, le=1000)
    score_band_good_max: Optional[int] = Field(None, ge=0, le=1000)
    score_suggest_mult_thin: Optional[Decimal] = Field(None, ge=0)
    score_suggest_mult_poor: Optional[Decimal] = Field(None, ge=0)
    score_suggest_mult_fair: Optional[Decimal] = Field(None, ge=0)
    score_suggest_mult_good: Optional[Decimal] = Field(None, ge=0)
    score_suggest_mult_excellent: Optional[Decimal] = Field(None, ge=0)
    score_baseline_amount: Optional[Decimal] = Field(None, ge=0)
    score_max_amount: Optional[Decimal] = Field(None, ge=0)
    score_max_stepup_mult: Optional[Decimal] = Field(None, ge=0)

    customer_code_prefix: Optional[str] = Field(None, min_length=2, max_length=12)
    loan_code_prefix: Optional[str] = Field(None, min_length=2, max_length=12)
    code_number_padding: Optional[int] = Field(None, ge=3, le=8)

    @field_validator("customer_code_prefix", "loan_code_prefix", mode="before")
    @classmethod
    def normalize_code_prefix(cls, value):
        if value is None or value == "":
            return value
        text = str(value).strip().upper()
        if not text.isalnum() or not (2 <= len(text) <= 12):
            raise ValueError("Prefix must be 2–12 letters or digits (e.g. VMFC).")
        return text

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

    @model_validator(mode="after")
    def score_bands_contiguous(self):
        # Only validate when all three cutoffs are present (partial PATCH merges later).
        if (
            self.score_band_poor_max is not None
            and self.score_band_fair_max is not None
            and self.score_band_good_max is not None
        ):
            try:
                validate_score_band_cutoffs(
                    self.score_band_poor_max,
                    self.score_band_fair_max,
                    self.score_band_good_max,
                )
            except ValueError as exc:
                raise ValueError(str(exc)) from exc
        return self


class FinanceSettingsUpdate(FinanceSettingsBase):
    pass


class FinanceSettingsResponse(FinanceSettingsBase):
    id: int
    finance_owner_id: int
    customer_code_next: int = 1
    loan_code_next: int = 1
    # Populated on PUT when installment loans are backfilled from settings.
    penalty_loans_updated: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
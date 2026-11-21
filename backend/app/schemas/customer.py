from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List, Any
from decimal import Decimal
from datetime import date


ID_TYPES = {"AADHAAR", "VOTER", "PAN", "DL"}
GENDERS = {"MALE", "FEMALE", "OTHER"}
HOUSE_OWNERSHIPS = {"OWN", "RENT"}


class CustomerKycFields(BaseModel):
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    alternate_phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    occupation_detail: Optional[str] = None
    business_name: Optional[str] = None
    monthly_income: Optional[Decimal] = None
    area_landmark: Optional[str] = None
    house_ownership: Optional[str] = None
    guarantor_name: Optional[str] = None
    guarantor_phone: Optional[str] = None
    reference1_name: Optional[str] = None
    reference1_phone: Optional[str] = None
    reference2_name: Optional[str] = None
    reference2_phone: Optional[str] = None
    has_other_loans: Optional[bool] = None
    other_loans_emi: Optional[Decimal] = None

    addr_line1: Optional[str] = None
    addr_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    address_comment: Optional[str] = None
    temp_addr_line1: Optional[str] = None
    temp_addr_line2: Optional[str] = None
    temp_city: Optional[str] = None
    temp_state: Optional[str] = None
    temp_postal_code: Optional[str] = None
    temp_address_comment: Optional[str] = None

    @field_validator("id_type")
    @classmethod
    def normalize_id_type(cls, v):
        if v is None or v == "":
            return None
        value = str(v).strip().upper()
        if value not in ID_TYPES:
            raise ValueError("ID type must be AADHAAR, VOTER, PAN, or DL.")
        return value

    @field_validator("gender")
    @classmethod
    def normalize_gender(cls, v):
        if v is None or v == "":
            return None
        value = str(v).strip().upper()
        if value not in GENDERS:
            raise ValueError("Gender must be MALE, FEMALE, or OTHER.")
        return value

    @field_validator("occupation")
    @classmethod
    def normalize_occupation(cls, v):
        if v is None or v == "":
            return None
        return str(v).strip().upper().replace(" ", "_")

    @field_validator("house_ownership")
    @classmethod
    def normalize_house(cls, v):
        if v is None or v == "":
            return None
        value = str(v).strip().upper()
        if value not in HOUSE_OWNERSHIPS:
            raise ValueError("House ownership must be OWN or RENT.")
        return value

    @field_validator(
        "alternate_phone",
        "guarantor_phone",
        "reference1_phone",
        "reference2_phone",
        mode="before",
    )
    @classmethod
    def normalize_phone(cls, v):
        if v is None or v == "":
            return None
        digits = "".join(ch for ch in str(v) if ch.isdigit())
        if len(digits) != 10:
            raise ValueError("Phone must be a 10-digit mobile number.")
        return digits


class CustomerCreate(CustomerKycFields):
    full_name: str
    phone: str
    permanent_address: Optional[str] = None
    temporary_address: Optional[str] = None
    require_full_kyc: bool = False
    # Optional FE echo of rules (ignored for security; server loads settings)
    kyc_field_rules: Optional[dict[str, Any]] = None

    @field_validator("phone", mode="before")
    @classmethod
    def primary_phone(cls, v):
        digits = "".join(ch for ch in str(v or "") if ch.isdigit())
        if len(digits) != 10:
            raise ValueError("Phone must be a 10-digit mobile number.")
        return digits

    @model_validator(mode="after")
    def baseline_name(self):
        if not (self.full_name or "").strip() or len(self.full_name.strip()) < 2:
            raise ValueError("Full name is required.")
        return self


class CustomerUpdate(CustomerKycFields):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    permanent_address: Optional[str] = None
    temporary_address: Optional[str] = None


class CustomerResponse(CustomerKycFields):
    id: int
    display_code: str
    full_name: str
    phone: str
    permanent_address: Optional[str] = None
    temporary_address: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CustomerListResponse(BaseModel):
    id: int
    display_code: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class CustomerLedgerPaymentResponse(BaseModel):
    payment_date: date
    amount_paid: Decimal
    principal_paid: Decimal
    interest_paid: Decimal
    payment_mode: str
    remarks: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CustomerLedgerLoanResponse(BaseModel):
    loan_id: int
    display_code: str = ""
    principal_amount: Decimal
    remaining_principal: Decimal
    total_principal_paid: Decimal
    total_interest_paid: Decimal
    accrued_interest: Decimal
    total_outstanding: Decimal
    issue_date: date
    due_date: date
    status: str
    payments: List[CustomerLedgerPaymentResponse]


class CustomerLedgerSummaryResponse(BaseModel):
    total_loans: int
    active_loans: int
    closed_loans: int
    total_principal: Decimal
    remaining_principal: Decimal
    total_interest_paid: Decimal
    accrued_interest: Decimal
    total_outstanding: Decimal


class CustomerCreditScoreSummary(BaseModel):
    score: int
    band: str
    file_type: str
    suggested_max_amount: Decimal


class CustomerLedgerResponse(BaseModel):
    customer: CustomerResponse
    loans: List[CustomerLedgerLoanResponse]
    summary: CustomerLedgerSummaryResponse
    credit_score: CustomerCreditScoreSummary | None = None

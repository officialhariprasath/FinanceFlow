from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime


ID_TYPES = {"AADHAAR", "VOTER", "PAN", "DL"}
GENDERS = {"MALE", "FEMALE", "OTHER"}
OCCUPATIONS = {"SALARY", "SHOP", "DAILY_WAGE", "OTHER"}
HOUSE_OWNERSHIPS = {"OWN", "RENT"}


class CustomerKycFields(BaseModel):
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    alternate_phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
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
        value = str(v).strip().upper()
        if value not in OCCUPATIONS:
            raise ValueError("Occupation must be SALARY, SHOP, DAILY_WAGE, or OTHER.")
        return value

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
    permanent_address: str
    temporary_address: Optional[str] = None
    # FE wizard sends true. Default false so legacy/minimal API creates still work
    # and existing customers can stay with empty KYC until edited.
    require_full_kyc: bool = False

    @field_validator("phone", mode="before")
    @classmethod
    def primary_phone(cls, v):
        digits = "".join(ch for ch in str(v or "") if ch.isdigit())
        if len(digits) != 10:
            raise ValueError("Phone must be a 10-digit mobile number.")
        return digits

    @model_validator(mode="after")
    def validate_full_kyc(self):
        if not self.require_full_kyc:
            return self
        missing: list[str] = []
        if not (self.full_name or "").strip() or len(self.full_name.strip()) < 2:
            missing.append("full_name")
        if not self.phone:
            missing.append("phone")
        if not (self.permanent_address or "").strip():
            missing.append("permanent_address")
        if not self.id_type:
            missing.append("id_type")
        if not (self.id_number or "").strip():
            missing.append("id_number")
        if not (self.guarantor_name or "").strip():
            missing.append("guarantor_name")
        if not self.guarantor_phone:
            missing.append("guarantor_phone")
        if not self.alternate_phone:
            missing.append("alternate_phone")
        if not (self.temporary_address or "").strip():
            missing.append("temporary_address")
        if not self.occupation:
            missing.append("occupation")
        if self.occupation == "SHOP" and not (self.business_name or "").strip():
            missing.append("business_name")
        if self.monthly_income is None or self.monthly_income < 0:
            missing.append("monthly_income")
        if not (self.area_landmark or "").strip():
            missing.append("area_landmark")
        if not self.date_of_birth:
            missing.append("date_of_birth")
        if not self.gender:
            missing.append("gender")
        if not self.house_ownership:
            missing.append("house_ownership")
        if not (self.reference1_name or "").strip() or not self.reference1_phone:
            missing.append("reference1")
        if self.has_other_loans is None:
            missing.append("has_other_loans")
        if self.has_other_loans and (self.other_loans_emi is None or self.other_loans_emi < 0):
            missing.append("other_loans_emi")
        if missing:
            raise ValueError(
                "Complete borrower KYC is required: " + ", ".join(missing)
            )
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

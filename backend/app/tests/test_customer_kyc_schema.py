"""KYC schema validation edge cases (no DB)."""

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from backend.app.schemas.customer import CustomerCreate


def _full_kyc(**overrides):
    base = {
        "full_name": "Test Borrower",
        "phone": "9876543210",
        "permanent_address": "12 Main St",
        "temporary_address": "12 Main St",
        "require_full_kyc": True,
        "id_type": "AADHAAR",
        "id_number": "1234-5678-9012",
        "alternate_phone": "9876543211",
        "date_of_birth": date(1990, 5, 1),
        "gender": "MALE",
        "occupation": "SALARY",
        "monthly_income": Decimal("15000"),
        "area_landmark": "Near temple",
        "house_ownership": "RENT",
        "guarantor_name": "Guarantor One",
        "guarantor_phone": "9876543212",
        "reference1_name": "Ref One",
        "reference1_phone": "9876543213",
        "has_other_loans": False,
    }
    base.update(overrides)
    return CustomerCreate(**base)


def test_full_kyc_accepted():
    c = _full_kyc()
    assert c.id_type == "AADHAAR"
    assert c.phone == "9876543210"


def test_incomplete_kyc_rejected():
    with pytest.raises(ValidationError) as exc:
        CustomerCreate(
            full_name="A",
            phone="9876543210",
            permanent_address="x",
            require_full_kyc=True,
        )
    assert "Complete borrower KYC" in str(exc.value)


def test_minimal_create_allowed_without_full_kyc_flag():
    c = CustomerCreate(
        full_name="Legacy",
        phone="9876543299",
        permanent_address="Addr",
        require_full_kyc=False,
    )
    assert c.id_type is None
    assert c.guarantor_name is None


def test_shop_requires_business_name():
    with pytest.raises(ValidationError):
        _full_kyc(occupation="SHOP", business_name=None)


def test_other_loans_requires_emi():
    with pytest.raises(ValidationError):
        _full_kyc(has_other_loans=True, other_loans_emi=None)


def test_invalid_id_type():
    with pytest.raises(ValidationError):
        _full_kyc(id_type="PASSPORT")


def test_phone_normalized_digits():
    c = _full_kyc(phone="98765-43210", alternate_phone="98765 43211")
    assert c.phone == "9876543210"
    assert c.alternate_phone == "9876543211"

"""KYC schema validation edge cases (no DB)."""

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from backend.app.schemas.customer import CustomerCreate
from backend.app.services.kyc_defaults import (
    missing_required_kyc,
    normalize_kyc_field_rules,
    compose_address,
)


def _full_kyc(**overrides):
    base = {
        "full_name": "Test Borrower",
        "phone": "9876543210",
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
        "addr_line1": "12 Main St",
        "city": "Hyderabad",
        "state": "Telangana",
        "postal_code": "500001",
        "temp_addr_line1": "12 Main St",
        "temp_city": "Hyderabad",
        "temp_state": "Telangana",
        "temp_postal_code": "500001",
    }
    base.update(overrides)
    return CustomerCreate(**base)


def test_full_kyc_accepted():
    c = _full_kyc()
    assert c.id_type == "AADHAAR"
    assert c.phone == "9876543210"
    assert missing_required_kyc(c, normalize_kyc_field_rules(None)) == []


def test_incomplete_kyc_detected_by_rules():
    c = CustomerCreate(
        full_name="A Name",
        phone="9876543210",
        require_full_kyc=True,
    )
    missing = missing_required_kyc(c, normalize_kyc_field_rules(None))
    assert "id_type" in missing
    assert "guarantor_name" in missing


def test_minimal_create_allowed_without_full_kyc_flag():
    c = CustomerCreate(
        full_name="Legacy",
        phone="9876543299",
        permanent_address="Addr",
        require_full_kyc=False,
    )
    assert c.id_type is None
    assert c.guarantor_name is None


def test_invalid_id_type():
    with pytest.raises(ValidationError):
        _full_kyc(id_type="PASSPORT")


def test_phone_normalized_digits():
    c = _full_kyc(phone="98765-43210", alternate_phone="98765 43211")
    assert c.phone == "9876543210"
    assert c.alternate_phone == "9876543211"


def test_compose_address():
    assert (
        compose_address(
            line1="12 Street",
            city="Hyd",
            state="TS",
            postal_code="500001",
        )
        == "12 Street, Hyd, TS, 500001"
    )

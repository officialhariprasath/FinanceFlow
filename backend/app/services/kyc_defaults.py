"""Default borrower-form field rules and occupation options."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


# enabled = show on form; required = must fill when enabled (and require_full_kyc)
DEFAULT_KYC_FIELD_RULES: dict[str, dict[str, bool]] = {
    "date_of_birth": {"enabled": True, "required": True},
    "gender": {"enabled": True, "required": True},
    "alternate_phone": {"enabled": True, "required": True},
    "id_type": {"enabled": True, "required": True},
    "id_number": {"enabled": True, "required": True},
    "addr_line1": {"enabled": True, "required": True},
    "addr_line2": {"enabled": True, "required": False},
    "city": {"enabled": True, "required": True},
    "state": {"enabled": True, "required": True},
    "postal_code": {"enabled": True, "required": True},
    "address_comment": {"enabled": True, "required": False},
    "temporary_address_block": {"enabled": True, "required": True},
    "area_landmark": {"enabled": True, "required": True},
    "house_ownership": {"enabled": True, "required": True},
    "occupation": {"enabled": True, "required": True},
    "occupation_detail": {"enabled": True, "required": False},
    "business_name": {"enabled": True, "required": False},  # required when SHOP
    "monthly_income": {"enabled": True, "required": True},
    "has_other_loans": {"enabled": True, "required": True},
    "other_loans_emi": {"enabled": True, "required": False},  # when has_other_loans
    "guarantor_name": {"enabled": True, "required": True},
    "guarantor_phone": {"enabled": True, "required": True},
    "reference1": {"enabled": True, "required": True},
    "reference2": {"enabled": True, "required": False},
}

DEFAULT_OCCUPATION_OPTIONS: list[dict[str, str]] = [
    {"value": "SALARY", "label": "Salary"},
    {"value": "SHOP", "label": "Shop"},
    {"value": "DAILY_WAGE", "label": "Daily wage"},
    {"value": "OTHER", "label": "Other"},
]

ALWAYS_REQUIRED = ("full_name", "phone")


def normalize_kyc_field_rules(raw: Any) -> dict[str, dict[str, bool]]:
    base = deepcopy(DEFAULT_KYC_FIELD_RULES)
    if not isinstance(raw, dict):
        return base
    for key, defaults in base.items():
        incoming = raw.get(key)
        if isinstance(incoming, dict):
            enabled = bool(incoming.get("enabled", defaults["enabled"]))
            required = bool(incoming.get("required", defaults["required"]))
            if not enabled:
                required = False
            base[key] = {"enabled": enabled, "required": required}
    return base


def normalize_occupation_options(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list) or not raw:
        return deepcopy(DEFAULT_OCCUPATION_OPTIONS)
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        value = str(item.get("value") or "").strip().upper().replace(" ", "_")
        label = str(item.get("label") or value).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append({"value": value, "label": label or value})
    if not out:
        return deepcopy(DEFAULT_OCCUPATION_OPTIONS)
    if not any(o["value"] == "OTHER" for o in out):
        out.append({"value": "OTHER", "label": "Other"})
    return out


def missing_required_kyc(data: Any, rules: dict[str, dict[str, bool]]) -> list[str]:
    """Return list of missing field keys for require_full_kyc creates."""
    missing: list[str] = []

    def rule(key: str) -> dict[str, bool]:
        return rules.get(key) or DEFAULT_KYC_FIELD_RULES.get(key) or {
            "enabled": False,
            "required": False,
        }

    def need(key: str, ok: bool) -> None:
        r = rule(key)
        if r.get("enabled") and r.get("required") and not ok:
            missing.append(key)

    need("date_of_birth", bool(getattr(data, "date_of_birth", None)))
    need("gender", bool(getattr(data, "gender", None)))
    need("alternate_phone", bool(getattr(data, "alternate_phone", None)))
    need("id_type", bool(getattr(data, "id_type", None)))
    need("id_number", bool((getattr(data, "id_number", None) or "").strip()))

    has_parts = bool((getattr(data, "addr_line1", None) or "").strip())
    has_legacy = bool((getattr(data, "permanent_address", None) or "").strip())
    need("addr_line1", has_parts or has_legacy)
    need("city", bool((getattr(data, "city", None) or "").strip()) or has_legacy)
    need("state", bool((getattr(data, "state", None) or "").strip()) or has_legacy)
    need(
        "postal_code",
        bool((getattr(data, "postal_code", None) or "").strip()) or has_legacy,
    )

    temp_ok = bool(
        (getattr(data, "temporary_address", None) or "").strip()
        or (getattr(data, "temp_addr_line1", None) or "").strip()
        or getattr(data, "same_as_permanent", False)
    )
    # same_as not on schema — treat temp parts or temporary_address
    need("temporary_address_block", temp_ok or has_parts)

    need("area_landmark", bool((getattr(data, "area_landmark", None) or "").strip()))
    need("house_ownership", bool(getattr(data, "house_ownership", None)))
    need("occupation", bool(getattr(data, "occupation", None)))
    occ = getattr(data, "occupation", None)
    if occ == "SHOP":
        need("business_name", bool((getattr(data, "business_name", None) or "").strip()))
    if occ == "OTHER":
        r = rule("occupation_detail")
        if r.get("enabled") and not (getattr(data, "occupation_detail", None) or "").strip():
            # Other always needs detail when occupation is OTHER
            missing.append("occupation_detail")

    income = getattr(data, "monthly_income", None)
    need("monthly_income", income is not None and income >= 0)
    need("has_other_loans", getattr(data, "has_other_loans", None) is not None)
    if getattr(data, "has_other_loans", None) is True:
        emi = getattr(data, "other_loans_emi", None)
        if emi is None or emi < 0:
            missing.append("other_loans_emi")

    need("guarantor_name", bool((getattr(data, "guarantor_name", None) or "").strip()))
    need("guarantor_phone", bool(getattr(data, "guarantor_phone", None)))
    need(
        "reference1",
        bool((getattr(data, "reference1_name", None) or "").strip())
        and bool(getattr(data, "reference1_phone", None)),
    )
    return missing


def compose_address(
    *,
    line1: str | None = None,
    line2: str | None = None,
    city: str | None = None,
    state: str | None = None,
    postal_code: str | None = None,
    comment: str | None = None,
    landmark: str | None = None,
) -> str | None:
    parts = [
        (line1 or "").strip(),
        (line2 or "").strip(),
        ", ".join(
            p
            for p in [
                (city or "").strip(),
                (state or "").strip(),
                (postal_code or "").strip(),
            ]
            if p
        ),
        (landmark or "").strip(),
        (comment or "").strip(),
    ]
    text = ", ".join(p for p in parts if p)
    return text or None

"""Per-owner display codes for customers and loans (e.g. VMFC0001, VMFL0001)."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

_PREFIX_RE = re.compile(r"^[A-Za-z0-9]{2,12}$")


def normalize_prefix(raw: str | None, fallback: str) -> str:
    value = (raw or fallback).strip().upper()
    if not _PREFIX_RE.match(value):
        raise ValueError(
            "Prefix must be 2–12 letters or digits (e.g. VMFC, VMFL)."
        )
    return value


def normalize_padding(raw: int | None, fallback: int = 4) -> int:
    padding = int(raw if raw is not None else fallback)
    if padding < 3 or padding > 8:
        raise ValueError("Number padding must be between 3 and 8.")
    return padding


def format_display_code(prefix: str, sequence: int, padding: int) -> str:
    """VMFL0001 … VMFL9999 then VMFL10000 (width grows past padding)."""
    if sequence < 1:
        raise ValueError("Sequence must be >= 1.")
    width = max(padding, len(str(sequence)))
    return f"{prefix}{sequence:0{width}d}"


def allocate_display_code(
    db: "Session",
    finance_owner_id: int,
    kind: str,
) -> str:
    """
    Allocate next customer/loan display code for the owner.

    Locks the finance_settings row so concurrent creates stay unique.
    """
    from backend.app.models.finance_settings import FinanceSettings

    settings = (
        db.query(FinanceSettings)
        .filter(FinanceSettings.finance_owner_id == finance_owner_id)
        .with_for_update()
        .first()
    )
    if settings is None:
        from backend.app.services.finance_settings_service import get_finance_settings

        settings = get_finance_settings(db, finance_owner_id)
        settings = (
            db.query(FinanceSettings)
            .filter(FinanceSettings.finance_owner_id == finance_owner_id)
            .with_for_update()
            .first()
        )
    assert settings is not None

    padding = normalize_padding(getattr(settings, "code_number_padding", None), 4)

    if kind == "customer":
        prefix = normalize_prefix(
            getattr(settings, "customer_code_prefix", None), "VMFC"
        )
        next_n = int(getattr(settings, "customer_code_next", None) or 1)
        settings.customer_code_next = next_n + 1
    elif kind == "loan":
        prefix = normalize_prefix(getattr(settings, "loan_code_prefix", None), "VMFL")
        next_n = int(getattr(settings, "loan_code_next", None) or 1)
        settings.loan_code_next = next_n + 1
    else:
        raise ValueError(f"Unknown display code kind: {kind}")

    return format_display_code(prefix, next_n, padding)

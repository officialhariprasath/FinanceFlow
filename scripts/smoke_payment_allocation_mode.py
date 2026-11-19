"""Offline smoke: payment allocation modes DUE_ONLY / PENALTY_ONLY / BOTH."""

from __future__ import annotations

import ast
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.payment_allocation_service import (
    allocate_payment_amount,
    normalize_allocation_mode,
)


def test_modes():
    # Due 120 (profit 20 + principal 100) + penalty 50
    profit, principal, penalty = Decimal("20"), Decimal("100"), Decimal("50")

    p, pr, pe = allocate_payment_amount(
        Decimal("120"), profit, principal, penalty, "BOTH"
    )
    # BOTH: profit→principal→penalty → 20+100=120, penalty 0
    assert (p, pr, pe) == (Decimal("100.00"), Decimal("20.00"), Decimal("0.00")), (
        p,
        pr,
        pe,
    )

    p, pr, pe = allocate_payment_amount(
        Decimal("120"), profit, principal, penalty, "DUE_ONLY"
    )
    assert (p, pr, pe) == (Decimal("100.00"), Decimal("20.00"), Decimal("0.00"))

    p, pr, pe = allocate_payment_amount(
        Decimal("120"), profit, principal, penalty, "PENALTY_ONLY"
    )
    assert (p, pr, pe) == (Decimal("0.00"), Decimal("0.00"), Decimal("50.00")), (p, pr, pe)

    p, pr, pe = allocate_payment_amount(
        Decimal("50"), profit, principal, penalty, "PENALTY_ONLY"
    )
    assert pe == Decimal("50.00") and p == Decimal("0.00") and pr == Decimal("0.00")

    # Partial due only leaves penalty untouched
    p, pr, pe = allocate_payment_amount(
        Decimal("70"), profit, principal, penalty, "DUE_ONLY"
    )
    assert pe == Decimal("0.00")
    assert (pr + p) == Decimal("70.00")


def test_normalize():
    assert normalize_allocation_mode("due") == "DUE_ONLY"
    assert normalize_allocation_mode("penalty") == "PENALTY_ONLY"
    assert normalize_allocation_mode(None) == "BOTH"


def test_frontend_has_controls():
    src = (ROOT / "frontend/src/components/loans/RecordPaymentModal.tsx").read_text(
        encoding="utf-8"
    )
    assert "DUE_ONLY" in src and "PENALTY_ONLY" in src
    assert "Next 5" not in src and "Next 10" not in src
    assert "All" in src and "Clear" in src
    assert "changeAllocationMode" in src


def main() -> int:
    print("== payment allocation mode smoke ==")
    test_modes()
    test_normalize()
    test_frontend_has_controls()
    for rel in [
        "backend/app/services/payment_allocation_service.py",
        "backend/app/services/payment_service.py",
        "backend/app/schemas/payment.py",
        "backend/app/api/payment.py",
    ]:
        ast.parse((ROOT / rel).read_text(encoding="utf-8"), filename=rel)
    print("offline_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

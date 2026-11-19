"""Run full allocation-mode test suite (not a toy smoke)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    print("== payment allocation mode: full pytest suite ==")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            str(ROOT / "backend/app/tests/test_payment_allocation_modes.py"),
            "-v",
            "--tb=short",
        ],
        cwd=str(ROOT),
    )
    if result.returncode != 0:
        return result.returncode

    modal = (ROOT / "frontend/src/components/loans/RecordPaymentModal.tsx").read_text(
        encoding="utf-8"
    )
    assert "Next 5" not in modal and "Next 10" not in modal
    assert "amountFollowsSelection" in modal
    assert "Due left" not in modal and "Penalty left" not in modal
    assert "left in this mode" in modal
    assert "late_fee_amount" in modal
    assert "DUE_ONLY" in modal and "PENALTY_ONLY" in modal
    print("frontend_checks_ok")
    print("offline_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

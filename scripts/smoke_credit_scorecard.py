"""Smoke: CIBIL score + avg-prior × multiplier suggest."""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.credit_score.scorecard_engine import (
    apply_scorecard,
    resolve_band,
    suggested_max_amount,
)


def main() -> int:
    print("== CIBIL + avg×multiplier smoke ==")
    fair_suggest = suggested_max_amount(
        "FAIR",
        2000,
        2000,
        Decimal("2000"),
        {"FAIR": Decimal("1.5")},
        Decimal("20000"),
        Decimal("2.0"),
    )
    assert fair_suggest == Decimal("3000.00"), fair_suggest

    avg_ex = suggested_max_amount(
        "EXCELLENT",
        (2000 + 5000 + 10000) / 3,
        10000,
        Decimal("2000"),
        {"EXCELLENT": Decimal("2.5")},
        Decimal("20000"),
        Decimal("2.0"),
    )
    assert avg_ex == Decimal("14166.67"), avg_ex

    basic = apply_scorecard(
        {
            "on_time_rate": 1.0,
            "dpd_30_rate": 0,
            "defaulted_count": 0,
            "writeoff_count": 0,
            "current_overdue_count": 0,
            "completion_ratio": 0.1,
            "paid_schedule_count": 2,
            "months_as_customer": 1,
            "closed_loan_count": 0,
            "history_depth": 1,
            "basic_loan_completed": 0,
            "on_time_streak": 2,
            "days_since_last_payment": 0,
            "file_type": "THICK",
        }
    )
    band = resolve_band(basic["score"], "THICK")
    print(f"basic_2pays score={basic['score']} band={band} fair_suggest={fair_suggest} avg_ex={avg_ex}")
    assert 0 <= basic["score"] <= 1000
    print("offline_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

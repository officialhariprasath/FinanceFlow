"""End-to-end smoke for hybrid credit scorecard (0–1000).

Usage:
  python scripts/smoke_credit_scorecard.py
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.credit_score.expert_definition import EXPERT_DEFINITION
from backend.app.services.credit_score.scorecard_engine import (
    apply_scorecard,
    resolve_band,
    suggested_max_amount,
)


def main() -> int:
    print("== Offline scorecard smoke (0-1000) ==")
    thin = apply_scorecard(
        {
            "history_depth": 0,
            "paid_schedule_count": 0,
            "on_time_rate": None,
            "avg_days_late": None,
            "max_days_late": None,
            "dpd_30_rate": None,
            "current_overdue_count": 0,
            "defaulted_count": 0,
            "writeoff_count": 0,
            "repayment_ratio": None,
            "days_since_last_late": None,
            "closed_loan_count": 0,
            "basic_loan_completed": 0,
        },
        EXPERT_DEFINITION,
    )
    basic_two_pays = apply_scorecard(
        {
            "history_depth": 1,
            "paid_schedule_count": 2,
            "on_time_rate": 1.0,
            "avg_days_late": 0,
            "max_days_late": 0,
            "dpd_30_rate": 0,
            "current_overdue_count": 0,
            "defaulted_count": 0,
            "writeoff_count": 0,
            "repayment_ratio": 0.1,
            "days_since_last_late": None,
            "closed_loan_count": 0,
            "basic_loan_completed": 0,
        },
        EXPERT_DEFINITION,
    )
    basic_done = apply_scorecard(
        {
            "history_depth": 1,
            "paid_schedule_count": 20,
            "on_time_rate": 0.95,
            "avg_days_late": 0,
            "max_days_late": 0,
            "dpd_30_rate": 0,
            "current_overdue_count": 0,
            "defaulted_count": 0,
            "writeoff_count": 0,
            "repayment_ratio": 1.0,
            "days_since_last_late": None,
            "closed_loan_count": 1,
            "basic_loan_completed": 1,
        },
        EXPERT_DEFINITION,
    )
    assert 0 <= thin["score"] <= 1000
    assert basic_two_pays["score"] > thin["score"]
    assert basic_done["score"] >= basic_two_pays["score"]
    band = resolve_band(basic_done["score"], "THICK", 499, 649, 799)
    suggest = suggested_max_amount(
        band,
        2000,
        Decimal("2000"),
        {"FAIR": Decimal("2.5"), "GOOD": Decimal("5"), "EXCELLENT": Decimal("10")},
    )
    print(
        f"thin={thin['score']} basic_2pays={basic_two_pays['score']} "
        f"basic_done={basic_done['score']} band={band} suggest={suggest}"
    )
    assert Decimal("3000") <= suggest <= Decimal("20000")
    print("offline_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

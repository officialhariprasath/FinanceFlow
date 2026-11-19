"""Unit smoke tests for hybrid credit scorecard (no DB required)."""

from decimal import Decimal

from backend.app.services.credit_score.expert_definition import EXPERT_DEFINITION
from backend.app.services.credit_score.scorecard_engine import (
    apply_scorecard,
    resolve_band,
    suggested_max_amount,
)


def test_thin_file_scores_and_bands():
    features = {
        "history_depth": 0,
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
        "file_type": "THIN",
        "max_successful_principal": 0,
    }
    result = apply_scorecard(features, EXPERT_DEFINITION)
    assert 300 <= result["score"] <= 850
    assert any(r["code"] == "THIN_FILE" for r in result["all_reasons"])
    band = resolve_band(result["score"], "THIN")
    assert band == "THIN_FILE"
    amount = suggested_max_amount(
        band,
        None,
        Decimal("10000"),
        {"THIN_FILE": Decimal("0.5")},
    )
    assert amount == Decimal("5000.00")


def test_strong_payer_scores_higher_than_chronic_late():
    strong = apply_scorecard(
        {
            "history_depth": 5,
            "on_time_rate": 0.95,
            "avg_days_late": 0,
            "max_days_late": 0,
            "dpd_30_rate": 0,
            "current_overdue_count": 0,
            "defaulted_count": 0,
            "writeoff_count": 0,
            "repayment_ratio": 1.0,
            "days_since_last_late": None,
            "closed_loan_count": 4,
        },
        EXPERT_DEFINITION,
    )
    weak = apply_scorecard(
        {
            "history_depth": 5,
            "on_time_rate": 0.4,
            "avg_days_late": 20,
            "max_days_late": 45,
            "dpd_30_rate": 0.3,
            "current_overdue_count": 5,
            "defaulted_count": 1,
            "writeoff_count": 0,
            "repayment_ratio": 0.4,
            "days_since_last_late": 5,
            "closed_loan_count": 1,
        },
        EXPERT_DEFINITION,
    )
    assert strong["score"] > weak["score"]
    assert resolve_band(strong["score"], "THICK") in ("GOOD", "EXCELLENT", "FAIR")
    assert resolve_band(weak["score"], "THICK") in ("POOR", "FAIR")


def test_suggested_max_uses_successful_principal():
    amount = suggested_max_amount(
        "GOOD",
        20000,
        Decimal("10000"),
        {"GOOD": Decimal("1.0")},
    )
    assert amount == Decimal("20000.00")

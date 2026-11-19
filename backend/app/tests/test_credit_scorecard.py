"""Unit smoke tests for hybrid credit scorecard (0–1000, no DB required)."""

from decimal import Decimal

from backend.app.services.credit_score.expert_definition import EXPERT_DEFINITION
from backend.app.services.credit_score.scorecard_engine import (
    apply_scorecard,
    resolve_band,
    suggested_max_amount,
)


def test_thin_file_scores_out_of_1000():
    features = {
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
        "file_type": "THIN",
        "max_successful_principal": 0,
    }
    result = apply_scorecard(features, EXPERT_DEFINITION)
    assert 0 <= result["score"] <= 1000
    assert any(r["code"] == "THIN_FILE" for r in result["all_reasons"])
    band = resolve_band(result["score"], "THIN")
    assert band == "THIN_FILE"
    amount = suggested_max_amount(
        band,
        None,
        Decimal("2000"),
        {"THIN_FILE": Decimal("1.0")},
    )
    assert amount == Decimal("2000.00")


def test_basic_loan_with_two_payments_gets_visible_score():
    """₹2,000 / 20 days starter with 2 early payments should score and not be blank."""
    features = {
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
        "file_type": "THICK",
        "max_successful_principal": 0,
    }
    result = apply_scorecard(features, EXPERT_DEFINITION)
    assert result["score"] >= 500
    assert any(r["code"] == "EARLY_PAYMENTS" for r in result["all_reasons"])


def test_completed_basic_loan_suggests_next_size_band():
    features = {
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
        "file_type": "THICK",
        "max_successful_principal": 2000,
    }
    result = apply_scorecard(features, EXPERT_DEFINITION)
    band = resolve_band(result["score"], "THICK", 499, 649, 799)
    assert band in ("FAIR", "GOOD", "EXCELLENT")
    suggest = suggested_max_amount(
        band,
        2000,
        Decimal("2000"),
        {
            "FAIR": Decimal("2.5"),
            "GOOD": Decimal("5.0"),
            "EXCELLENT": Decimal("10.0"),
        },
    )
    assert Decimal("3000.00") <= suggest <= Decimal("20000.00")


def test_strong_payer_scores_higher_than_chronic_late():
    strong = apply_scorecard(
        {
            "history_depth": 5,
            "paid_schedule_count": 40,
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
            "basic_loan_completed": 1,
        },
        EXPERT_DEFINITION,
    )
    weak = apply_scorecard(
        {
            "history_depth": 5,
            "paid_schedule_count": 40,
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
            "basic_loan_completed": 0,
        },
        EXPERT_DEFINITION,
    )
    assert strong["score"] > weak["score"]

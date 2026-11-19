"""Unit tests: CIBIL-weighted score + avg-prior × multiplier suggest."""

from decimal import Decimal

from backend.app.services.credit_score.scorecard_engine import (
    apply_scorecard,
    resolve_band,
    suggested_max_amount,
)


def test_thin_file_uses_baseline():
    result = apply_scorecard(
        {
            "history_depth": 0,
            "paid_schedule_count": 0,
            "file_type": "THIN",
            "defaulted_count": 0,
            "writeoff_count": 0,
            "current_overdue_count": 0,
            "closed_loan_count": 0,
            "basic_loan_completed": 0,
            "months_as_customer": 0,
            "on_time_streak": 0,
        }
    )
    assert 0 <= result["score"] <= 1000
    band = resolve_band(result["score"], "THIN")
    assert band == "THIN_FILE"
    amount = suggested_max_amount(
        band,
        None,
        None,
        Decimal("2000"),
        {"THIN_FILE": Decimal("1.0")},
        Decimal("20000"),
        Decimal("2.0"),
    )
    assert amount == Decimal("2000.00")


def test_avg_prior_times_excellent_multiplier():
    # (2000+5000+10000)/3 = 5666.666... × 2.5 ≈ 14166.67
    amount = suggested_max_amount(
        "EXCELLENT",
        5666.6666,
        10000,
        Decimal("2000"),
        {"EXCELLENT": Decimal("2.5")},
        Decimal("20000"),
        Decimal("2.0"),
    )
    # step-up cap: last closed 10000 × 2 = 20000, so avg×2.5 wins unless > step cap
    assert amount == Decimal("14166.67")


def test_fair_on_single_2k_loan_is_reasonable():
    # avg 2000 × Fair 1.5 = 3000 (not 12500)
    amount = suggested_max_amount(
        "FAIR",
        2000,
        2000,
        Decimal("2000"),
        {"FAIR": Decimal("1.5")},
        Decimal("20000"),
        Decimal("2.0"),
    )
    assert amount == Decimal("3000.00")


def test_stepup_cap_limits_jump():
    # avg 10000 × 2.5 = 25000 but max amount 20000 and stepup 2× last 5000 = 10000
    amount = suggested_max_amount(
        "EXCELLENT",
        10000,
        5000,
        Decimal("2000"),
        {"EXCELLENT": Decimal("2.5")},
        Decimal("20000"),
        Decimal("2.0"),
    )
    assert amount == Decimal("10000.00")


def test_cibil_score_rewards_strong_history():
    strong = apply_scorecard(
        {
            "on_time_rate": 0.95,
            "dpd_30_rate": 0,
            "defaulted_count": 0,
            "writeoff_count": 0,
            "current_overdue_count": 0,
            "completion_ratio": 1.0,
            "repayment_ratio": 1.0,
            "overdue_amount_ratio": 0,
            "outstanding_ratio": 0.1,
            "months_as_customer": 12,
            "closed_loan_count": 3,
            "history_depth": 3,
            "basic_loan_completed": 1,
            "on_time_streak": 10,
            "days_since_last_payment": 1,
            "paid_schedule_count": 40,
            "file_type": "THICK",
        }
    )
    weak = apply_scorecard(
        {
            "on_time_rate": 0.4,
            "dpd_30_rate": 0.3,
            "defaulted_count": 1,
            "writeoff_count": 0,
            "current_overdue_count": 5,
            "completion_ratio": 0.3,
            "repayment_ratio": 0.3,
            "overdue_amount_ratio": 0.4,
            "outstanding_ratio": 0.8,
            "months_as_customer": 2,
            "closed_loan_count": 0,
            "history_depth": 1,
            "basic_loan_completed": 0,
            "on_time_streak": 0,
            "days_since_last_payment": 20,
            "paid_schedule_count": 5,
            "file_type": "THICK",
        }
    )
    assert strong["score"] > weak["score"]

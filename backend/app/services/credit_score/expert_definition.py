"""Expert-seeded hybrid scorecard on a 0–1000 scale.

Business track:
- Starter/basic loan ~₹2,000 for ~20 days (e.g. ₹120/day).
- A few early payments create a visible basic score.
- Completing the basic loan unlocks stronger next-loan suggestions (₹3,000–₹20,000).
"""

from __future__ import annotations

EXPERT_SCORECARD_VERSION = "expert-v3-1000"

EXPERT_DEFINITION = {
    "base_score": 480,
    "min_score": 0,
    "max_score": 1000,
    "features": {
        "history_depth": {
            "label": "Loan history depth",
            "bins": [
                {"max": 0, "points": -60, "code": "THIN_FILE", "reason": "New customer / no loan history"},
                {"max": 1, "points": 25, "code": "BASIC_HISTORY", "reason": "On basic first-loan track"},
                {"max": 3, "points": 55, "code": "MODERATE_HISTORY", "reason": "Moderate loan history"},
                {"max": None, "points": 90, "code": "STRONG_HISTORY", "reason": "Strong multi-loan history"},
            ],
        },
        "paid_schedule_count": {
            "label": "Installments paid",
            "bins": [
                {"max": 0, "points": -30, "code": "NO_PAYMENTS", "reason": "No installment payments yet"},
                {"max": 2, "points": 35, "code": "EARLY_PAYMENTS", "reason": "Early basic repayments recorded"},
                {"max": 10, "points": 70, "code": "STEADY_PAYMENTS", "reason": "Steady installment payments"},
                {"max": None, "points": 110, "code": "STRONG_PAYMENTS", "reason": "Strong installment payment count"},
            ],
        },
        "on_time_rate": {
            "label": "On-time repayment rate",
            "bins": [
                {"max": None, "points": 0, "code": "NO_ON_TIME_DATA", "reason": "No repayment timing data", "null": True},
                {"max": 0.5, "points": -100, "code": "LOW_ON_TIME", "reason": "Low on-time repayment rate"},
                {"max": 0.75, "points": -35, "code": "FAIR_ON_TIME", "reason": "Fair on-time repayment rate"},
                {"max": 0.9, "points": 35, "code": "GOOD_ON_TIME", "reason": "Good on-time repayment rate"},
                {"max": None, "points": 70, "code": "STRONG_ON_TIME", "reason": "Strong on-time repayment rate"},
            ],
        },
        "avg_days_late": {
            "label": "Average days late",
            "bins": [
                {"max": None, "points": 0, "code": "NO_LATE_AVG", "reason": "No late-day average", "null": True},
                {"max": 0, "points": 30, "code": "NO_AVG_LATE", "reason": "Pays on or before due date"},
                {"max": 3, "points": 5, "code": "MILD_AVG_LATE", "reason": "Mild average lateness"},
                {"max": 10, "points": -35, "code": "MODERATE_AVG_LATE", "reason": "Moderate average lateness"},
                {"max": None, "points": -90, "code": "HIGH_AVG_LATE", "reason": "High average lateness"},
            ],
        },
        "max_days_late": {
            "label": "Max days late",
            "bins": [
                {"max": None, "points": 0, "code": "NO_MAX_LATE", "reason": "No max late data", "null": True},
                {"max": 0, "points": 20, "code": "NEVER_LATE", "reason": "Never paid late"},
                {"max": 7, "points": -10, "code": "MAX_LATE_7", "reason": "Max lateness within 7 days"},
                {"max": 30, "points": -50, "code": "MAX_LATE_30", "reason": "Max lateness within 30 days"},
                {"max": None, "points": -100, "code": "MAX_LATE_SEVERE", "reason": "Severe max lateness"},
            ],
        },
        "dpd_30_rate": {
            "label": "30+ DPD rate",
            "bins": [
                {"max": None, "points": 0, "code": "NO_DPD30", "reason": "No 30+ DPD data", "null": True},
                {"max": 0, "points": 25, "code": "ZERO_DPD30", "reason": "No 30+ day late payments"},
                {"max": 0.1, "points": -45, "code": "SOME_DPD30", "reason": "Some 30+ day late payments"},
                {"max": None, "points": -120, "code": "HIGH_DPD30", "reason": "High 30+ day late rate"},
            ],
        },
        "current_overdue_count": {
            "label": "Current overdue installments",
            "bins": [
                {"max": 0, "points": 20, "code": "NO_CURRENT_OVERDUE", "reason": "No current overdue installments"},
                {"max": 2, "points": -35, "code": "FEW_OVERDUE", "reason": "A few overdue installments"},
                {"max": None, "points": -100, "code": "MANY_OVERDUE", "reason": "Many overdue installments"},
            ],
        },
        "defaulted_count": {
            "label": "Prior defaults",
            "bins": [
                {"max": 0, "points": 25, "code": "NO_DEFAULTS", "reason": "No prior defaults"},
                {"max": 1, "points": -160, "code": "PRIOR_DEFAULT", "reason": "Prior default on file"},
                {"max": None, "points": -260, "code": "MULTIPLE_DEFAULTS", "reason": "Multiple prior defaults"},
            ],
        },
        "writeoff_count": {
            "label": "Write-offs",
            "bins": [
                {"max": 0, "points": 15, "code": "NO_WRITEOFFS", "reason": "No write-offs"},
                {"max": None, "points": -200, "code": "HAS_WRITEOFF", "reason": "Prior write-off"},
            ],
        },
        "repayment_ratio": {
            "label": "Repayment ratio",
            "bins": [
                {"max": None, "points": 0, "code": "NO_REPAY_RATIO", "reason": "No repayment ratio", "null": True},
                {"max": 0.15, "points": 15, "code": "EARLY_REPAY_RATIO", "reason": "Early-stage repayments on basic loan"},
                {"max": 0.5, "points": -20, "code": "LOW_REPAY_RATIO", "reason": "Low repayment vs expected"},
                {"max": 0.9, "points": 35, "code": "OK_REPAY_RATIO", "reason": "Adequate repayment ratio"},
                {"max": None, "points": 70, "code": "HIGH_REPAY_RATIO", "reason": "Strong repayment ratio"},
            ],
        },
        "basic_loan_completed": {
            "label": "Basic starter loan completed",
            "bins": [
                {"max": 0, "points": 0, "code": "BASIC_NOT_DONE", "reason": "Basic starter loan not completed yet"},
                {"max": None, "points": 120, "code": "BASIC_DONE", "reason": "Basic starter loan completed — ready for next size"},
            ],
        },
        "days_since_last_late": {
            "label": "Days since last late payment",
            "bins": [
                {"max": None, "points": 15, "code": "NO_RECENT_LATE", "reason": "No recorded late payment", "null": True},
                {"max": 30, "points": -55, "code": "RECENT_LATE", "reason": "Late payment in last 30 days"},
                {"max": 90, "points": -20, "code": "LATE_WITHIN_90", "reason": "Late payment within 90 days"},
                {"max": None, "points": 35, "code": "LATE_LONG_AGO", "reason": "Last late payment was long ago"},
            ],
        },
        "closed_loan_count": {
            "label": "Closed loans",
            "bins": [
                {"max": 0, "points": 0, "code": "NO_CLOSED", "reason": "No closed loans yet"},
                {"max": 1, "points": 45, "code": "ONE_CLOSED", "reason": "One closed loan (basic track)"},
                {"max": 3, "points": 75, "code": "SOME_CLOSED", "reason": "Several closed loans"},
                {"max": None, "points": 100, "code": "MANY_CLOSED", "reason": "Many successfully closed loans"},
            ],
        },
    },
}

DEFAULT_SCORE_POLICY = {
    "score_enabled": True,
    "score_band_poor_max": 499,
    "score_band_fair_max": 649,
    "score_band_good_max": 799,
    "score_suggest_mult_thin": "1.0",
    "score_suggest_mult_poor": "1.5",
    "score_suggest_mult_fair": "2.5",
    "score_suggest_mult_good": "5.0",
    "score_suggest_mult_excellent": "10.0",
    "score_baseline_amount": "2000",
}

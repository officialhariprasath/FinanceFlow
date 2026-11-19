"""Expert-seeded hybrid scorecard (points bins). Runtime does not need scorecardpy."""

from __future__ import annotations

EXPERT_SCORECARD_VERSION = "expert-v1"

# Base score before feature points. Points can raise/lower within 300–850.
EXPERT_DEFINITION = {
    "base_score": 620,
    "min_score": 300,
    "max_score": 850,
    "features": {
        "history_depth": {
            "label": "Loan history depth",
            "bins": [
                {"max": 0, "points": -40, "code": "THIN_FILE", "reason": "New customer / thin file"},
                {"max": 1, "points": -10, "code": "LIMITED_HISTORY", "reason": "Limited loan history"},
                {"max": 3, "points": 10, "code": "MODERATE_HISTORY", "reason": "Moderate loan history"},
                {"max": None, "points": 25, "code": "STRONG_HISTORY", "reason": "Strong loan history"},
            ],
        },
        "on_time_rate": {
            "label": "On-time repayment rate",
            "bins": [
                {"max": None, "points": 0, "code": "NO_ON_TIME_DATA", "reason": "No repayment timing data", "null": True},
                {"max": 0.5, "points": -50, "code": "LOW_ON_TIME", "reason": "Low on-time repayment rate"},
                {"max": 0.75, "points": -15, "code": "FAIR_ON_TIME", "reason": "Fair on-time repayment rate"},
                {"max": 0.9, "points": 15, "code": "GOOD_ON_TIME", "reason": "Good on-time repayment rate"},
                {"max": None, "points": 40, "code": "STRONG_ON_TIME", "reason": "Strong on-time repayment rate"},
            ],
        },
        "avg_days_late": {
            "label": "Average days late",
            "bins": [
                {"max": None, "points": 0, "code": "NO_LATE_AVG", "reason": "No late-day average", "null": True},
                {"max": 0, "points": 20, "code": "NO_AVG_LATE", "reason": "Pays on or before due date"},
                {"max": 3, "points": 5, "code": "MILD_AVG_LATE", "reason": "Mild average lateness"},
                {"max": 10, "points": -15, "code": "MODERATE_AVG_LATE", "reason": "Moderate average lateness"},
                {"max": None, "points": -40, "code": "HIGH_AVG_LATE", "reason": "High average lateness"},
            ],
        },
        "max_days_late": {
            "label": "Max days late",
            "bins": [
                {"max": None, "points": 0, "code": "NO_MAX_LATE", "reason": "No max late data", "null": True},
                {"max": 0, "points": 10, "code": "NEVER_LATE", "reason": "Never paid late"},
                {"max": 7, "points": -5, "code": "MAX_LATE_7", "reason": "Max lateness within 7 days"},
                {"max": 30, "points": -25, "code": "MAX_LATE_30", "reason": "Max lateness within 30 days"},
                {"max": None, "points": -45, "code": "MAX_LATE_SEVERE", "reason": "Severe max lateness"},
            ],
        },
        "dpd_30_rate": {
            "label": "30+ DPD rate",
            "bins": [
                {"max": None, "points": 0, "code": "NO_DPD30", "reason": "No 30+ DPD data", "null": True},
                {"max": 0, "points": 15, "code": "ZERO_DPD30", "reason": "No 30+ day late payments"},
                {"max": 0.1, "points": -20, "code": "SOME_DPD30", "reason": "Some 30+ day late payments"},
                {"max": None, "points": -50, "code": "HIGH_DPD30", "reason": "High 30+ day late rate"},
            ],
        },
        "current_overdue_count": {
            "label": "Current overdue installments",
            "bins": [
                {"max": 0, "points": 10, "code": "NO_CURRENT_OVERDUE", "reason": "No current overdue installments"},
                {"max": 2, "points": -15, "code": "FEW_OVERDUE", "reason": "A few overdue installments"},
                {"max": None, "points": -40, "code": "MANY_OVERDUE", "reason": "Many overdue installments"},
            ],
        },
        "defaulted_count": {
            "label": "Prior defaults",
            "bins": [
                {"max": 0, "points": 15, "code": "NO_DEFAULTS", "reason": "No prior defaults"},
                {"max": 1, "points": -60, "code": "PRIOR_DEFAULT", "reason": "Prior default on file"},
                {"max": None, "points": -90, "code": "MULTIPLE_DEFAULTS", "reason": "Multiple prior defaults"},
            ],
        },
        "writeoff_count": {
            "label": "Write-offs",
            "bins": [
                {"max": 0, "points": 5, "code": "NO_WRITEOFFS", "reason": "No write-offs"},
                {"max": None, "points": -70, "code": "HAS_WRITEOFF", "reason": "Prior write-off"},
            ],
        },
        "repayment_ratio": {
            "label": "Repayment ratio",
            "bins": [
                {"max": None, "points": 0, "code": "NO_REPAY_RATIO", "reason": "No repayment ratio", "null": True},
                {"max": 0.5, "points": -30, "code": "LOW_REPAY_RATIO", "reason": "Low repayment vs expected"},
                {"max": 0.9, "points": 0, "code": "OK_REPAY_RATIO", "reason": "Adequate repayment ratio"},
                {"max": None, "points": 20, "code": "HIGH_REPAY_RATIO", "reason": "Strong repayment ratio"},
            ],
        },
        "days_since_last_late": {
            "label": "Days since last late payment",
            "bins": [
                {"max": None, "points": 10, "code": "NO_RECENT_LATE", "reason": "No recorded late payment", "null": True},
                {"max": 30, "points": -25, "code": "RECENT_LATE", "reason": "Late payment in last 30 days"},
                {"max": 90, "points": -10, "code": "LATE_WITHIN_90", "reason": "Late payment within 90 days"},
                {"max": None, "points": 15, "code": "LATE_LONG_AGO", "reason": "Last late payment was long ago"},
            ],
        },
        "closed_loan_count": {
            "label": "Closed loans",
            "bins": [
                {"max": 0, "points": 0, "code": "NO_CLOSED", "reason": "No closed loans yet"},
                {"max": 2, "points": 10, "code": "SOME_CLOSED", "reason": "Some closed loans"},
                {"max": None, "points": 20, "code": "MANY_CLOSED", "reason": "Many successfully closed loans"},
            ],
        },
    },
}

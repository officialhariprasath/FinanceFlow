"""CIBIL-style weighted credit scorecard (0–1000) + suggest multipliers.

Suggest formula:
  avg_prior_principal × band_multiplier
  (thin/new customers use baseline amount)
"""

from __future__ import annotations

EXPERT_SCORECARD_VERSION = "cibil-v1-1000"

# Pillar weights (sum = 1.0) — CIBIL-inspired for collection lending.
CIBIL_WEIGHTS = {
    "payment_history": 0.35,
    "amounts_exposure": 0.30,
    "history_length": 0.15,
    "credit_mix": 0.10,
    "discipline": 0.10,
}

EXPERT_DEFINITION = {
    "mode": "CIBIL_WEIGHTED",
    "min_score": 0,
    "max_score": 1000,
    "weights": CIBIL_WEIGHTS,
}

# Band multipliers applied to avg of previous loans.
DEFAULT_SCORE_POLICY = {
    "score_enabled": True,
    "score_band_poor_max": 499,
    "score_band_fair_max": 649,
    "score_band_good_max": 799,
    # Multipliers on avg prior principal
    "score_suggest_mult_thin": "1.0",
    "score_suggest_mult_poor": "1.0",
    "score_suggest_mult_fair": "1.5",
    "score_suggest_mult_good": "2.0",
    "score_suggest_mult_excellent": "2.5",
    "score_baseline_amount": "2000",
    "score_max_amount": "20000",
    "score_max_stepup_mult": "2.0",  # never > 2× last closed loan
}

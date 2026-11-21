"""Ledger credit score must expose reasons + features to the UI."""

from decimal import Decimal

from backend.app.schemas.customer import CustomerCreditScoreSummary


def test_ledger_score_keeps_reasons_and_features():
    summary = CustomerCreditScoreSummary(
        score=518,
        band="FAIR",
        file_type="THICK",
        suggested_max_amount=Decimal("8000.00"),
        reasons=[
            {
                "code": "PH_GOOD",
                "label": "Strong payment history",
                "points": 40,
                "feature": "payment_history",
            }
        ],
        features={
            "on_time_rate": 0.99,
            "months_as_customer": 24,
            "pillars": {"payment_history": 90},
        },
        scorecard_version="v1",
        computed_at="2026-11-21T10:00:00",
        advisory_only=True,
        score_max=1000,
    )
    data = summary.model_dump()
    assert data["score"] == 518
    assert len(data["reasons"]) == 1
    assert data["reasons"][0]["code"] == "PH_GOOD"
    assert data["features"]["on_time_rate"] == 0.99
    assert data["features"]["pillars"]["payment_history"] == 90


def test_ledger_score_defaults_empty_collections():
    summary = CustomerCreditScoreSummary(
        score=500,
        band="THIN_FILE",
        file_type="THIN",
        suggested_max_amount=Decimal("2000"),
    )
    data = summary.model_dump()
    assert data["reasons"] == []
    assert data["features"] == {}

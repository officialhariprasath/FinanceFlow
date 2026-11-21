"""Score band settings must drive resolve_band used by the gauge label."""

from backend.app.services.credit_score.scorecard_engine import resolve_band


def test_default_cutoffs():
    assert resolve_band(400, "THICK") == "POOR"
    assert resolve_band(518, "THICK") == "FAIR"
    assert resolve_band(700, "THICK") == "GOOD"
    assert resolve_band(850, "THICK") == "EXCELLENT"
    assert resolve_band(900, "THIN") == "THIN_FILE"


def test_custom_cutoffs_change_band():
    # Tighten fair band so 518 becomes GOOD
    assert (
        resolve_band(518, "THICK", poor_max=400, fair_max=500, good_max=799)
        == "GOOD"
    )
    # Widen poor so 518 becomes POOR
    assert (
        resolve_band(518, "THICK", poor_max=600, fair_max=700, good_max=850)
        == "POOR"
    )


def test_broken_cutoffs_fall_back_to_defaults():
    # Invalid ordering should not crash — falls back to defaults
    assert resolve_band(518, "THICK", poor_max=800, fair_max=500, good_max=600) == "FAIR"

"""Contract tests mirroring frontend creditScoreGaugeGeometry (0–1000 scale)."""

from __future__ import annotations


SCORE_MIN = 0
SCORE_MAX = 1000
SEGMENT_GAP_DEG = 3.2
SEGMENTS = [
    (0, 125),
    (125, 250),
    (250, 375),
    (375, 500),
    (500, 625),
    (625, 750),
    (750, 875),
    (875, 1000),
]


def clamp_score(score: float) -> float:
    return min(SCORE_MAX, max(SCORE_MIN, score))


def score_to_angle(score: float) -> float:
    return (clamp_score(score) / SCORE_MAX) * 180.0


def segment_arc_angles(from_score: float, to_score: float):
    start = score_to_angle(from_score) + SEGMENT_GAP_DEG / 2
    end = score_to_angle(to_score) - SEGMENT_GAP_DEG / 2
    if end <= start:
        return None
    return start, end


def band_label(band: str) -> str:
    if band == "THIN_FILE":
        return "Thin file"
    if not band:
        return "—"
    return band[0] + band[1:].lower()


def band_message(band: str) -> str:
    return {
        "EXCELLENT": "Excellent score!",
        "GOOD": "Great score!",
        "FAIR": "Fair score",
        "POOR": "Needs attention",
        "THIN_FILE": "Thin file",
    }.get(band, band_label(band))


def test_score_to_angle_endpoints():
    assert score_to_angle(0) == 0
    assert score_to_angle(500) == 90
    assert score_to_angle(1000) == 180


def test_clamp():
    assert clamp_score(-5) == 0
    assert clamp_score(1200) == 1000


def test_eight_gapped_segments():
    assert len(SEGMENTS) == 8
    for a, b in SEGMENTS:
        angles = segment_arc_angles(a, b)
        assert angles is not None
        start, end = angles
        assert end > start
        assert start >= score_to_angle(a)
        assert end <= score_to_angle(b)


def test_band_copy():
    assert band_label("POOR") == "Poor"
    assert band_message("GOOD") == "Great score!"
    assert band_message("POOR") == "Needs attention"

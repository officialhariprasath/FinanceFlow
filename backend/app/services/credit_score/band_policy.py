"""Contiguous score-band cutoffs (0–1000) with no gaps or overlaps."""

from __future__ import annotations

SCORE_SCALE_MIN = 0
SCORE_SCALE_MAX = 1000


def validate_score_band_cutoffs(
    poor_max: int,
    fair_max: int,
    good_max: int,
    *,
    scale_min: int = SCORE_SCALE_MIN,
    scale_max: int = SCORE_SCALE_MAX,
) -> None:
    """Require contiguous Poor→Fair→Good→Excellent covering scale_min..scale_max.

    Stored cutoffs define:
      Poor:      scale_min .. poor_max
      Fair:      poor_max+1 .. fair_max
      Good:      fair_max+1 .. good_max
      Excellent: good_max+1 .. scale_max
    """
    poor_max = int(poor_max)
    fair_max = int(fair_max)
    good_max = int(good_max)

    if not (scale_min <= poor_max < fair_max < good_max < scale_max):
        raise ValueError(
            "Score bands must be contiguous with no gaps or overlaps: "
            f"0 ≤ Poor To < Fair To < Good To < {scale_max} "
            f"(got Poor={poor_max}, Fair={fair_max}, Good={good_max}). "
            f"Excellent is then {good_max + 1}–{scale_max}."
        )


def band_ranges_from_cutoffs(
    poor_max: int,
    fair_max: int,
    good_max: int,
    *,
    scale_min: int = SCORE_SCALE_MIN,
    scale_max: int = SCORE_SCALE_MAX,
) -> dict[str, tuple[int, int]]:
    validate_score_band_cutoffs(
        poor_max, fair_max, good_max, scale_min=scale_min, scale_max=scale_max
    )
    return {
        "POOR": (scale_min, poor_max),
        "FAIR": (poor_max + 1, fair_max),
        "GOOD": (fair_max + 1, good_max),
        "EXCELLENT": (good_max + 1, scale_max),
    }

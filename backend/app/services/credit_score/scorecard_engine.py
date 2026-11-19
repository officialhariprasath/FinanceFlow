"""Apply a stored points scorecard to feature vectors."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from backend.app.services.credit_score.expert_definition import EXPERT_DEFINITION


TWOPLACES = Decimal("0.01")


def _pick_bin(bins: list[dict], value: Any) -> dict | None:
    if value is None:
        for item in bins:
            if item.get("null"):
                return item
        return None

    numeric = float(value)
    for item in bins:
        if item.get("null"):
            continue
        upper = item.get("max")
        if upper is None or numeric <= float(upper):
            return item
    return bins[-1] if bins else None


def apply_scorecard(
    features: dict[str, Any],
    definition: dict[str, Any] | None = None,
) -> dict[str, Any]:
    card = definition or EXPERT_DEFINITION
    base = int(card.get("base_score", 620))
    min_score = int(card.get("min_score", 300))
    max_score = int(card.get("max_score", 850))
    feature_defs = card.get("features", {})

    reasons: list[dict[str, Any]] = []
    total_points = 0

    for key, spec in feature_defs.items():
        bins = spec.get("bins", [])
        chosen = _pick_bin(bins, features.get(key))
        if chosen is None:
            continue
        points = int(chosen.get("points", 0))
        total_points += points
        reasons.append(
            {
                "code": chosen.get("code") or key.upper(),
                "label": chosen.get("reason") or spec.get("label") or key,
                "points": points,
                "feature": key,
            }
        )

    score = max(min_score, min(max_score, base + total_points))

    # Prefer impactful reasons: largest absolute points first.
    reasons_sorted = sorted(reasons, key=lambda r: abs(int(r["points"])), reverse=True)
    top_reasons = [r for r in reasons_sorted if int(r["points"]) != 0][:6]
    if not top_reasons:
        top_reasons = reasons_sorted[:3]

    return {
        "score": score,
        "points_total": total_points,
        "base_score": base,
        "reasons": top_reasons,
        "all_reasons": reasons_sorted,
    }


def resolve_band(
    score: int,
    file_type: str,
    poor_max: int = 579,
    fair_max: int = 669,
    good_max: int = 739,
) -> str:
    if file_type == "THIN":
        return "THIN_FILE"
    if score <= poor_max:
        return "POOR"
    if score <= fair_max:
        return "FAIR"
    if score <= good_max:
        return "GOOD"
    return "EXCELLENT"


def suggested_max_amount(
    band: str,
    max_successful_principal: float | None,
    baseline_amount: Decimal,
    multipliers: dict[str, Decimal],
) -> Decimal:
    base = Decimal(str(max_successful_principal or 0))
    if base <= 0:
        base = Decimal(baseline_amount)
    mult = multipliers.get(band, Decimal("0.5"))
    return (base * Decimal(mult)).quantize(TWOPLACES)

"""CIBIL-style weighted scoring + dynamic suggested loan amount."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from backend.app.services.credit_score.expert_definition import (
    CIBIL_WEIGHTS,
    EXPERT_DEFINITION,
)


TWOPLACES = Decimal("0.01")


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _payment_history_score(f: dict[str, Any]) -> tuple[float, list[dict]]:
    """~35% — on-time, DPD, defaults, write-offs, overdue."""
    reasons: list[dict] = []
    score = 55.0  # neutral start when little data

    on_time = f.get("on_time_rate")
    if on_time is None:
        reasons.append({"code": "PH_NO_DATA", "label": "Limited payment history", "points": 0, "feature": "payment_history"})
    else:
        # 0% → 0, 100% → 100 contribution before mix
        score = on_time * 100
        reasons.append(
            {
                "code": "PH_ON_TIME",
                "label": f"On-time rate {on_time:.0%}",
                "points": int(round((on_time - 0.7) * 100)),
                "feature": "payment_history",
            }
        )

    dpd30 = f.get("dpd_30_rate")
    if dpd30 is not None and dpd30 > 0:
        hit = min(40.0, dpd30 * 100)
        score -= hit
        reasons.append(
            {
                "code": "PH_DPD30",
                "label": "30+ day late payments hurt score",
                "points": -int(hit),
                "feature": "payment_history",
            }
        )

    defaults = int(f.get("defaulted_count") or 0)
    if defaults:
        hit = min(50.0, defaults * 35)
        score -= hit
        reasons.append(
            {
                "code": "PH_DEFAULT",
                "label": "Prior default on file",
                "points": -int(hit),
                "feature": "payment_history",
            }
        )

    writeoffs = int(f.get("writeoff_count") or 0)
    if writeoffs:
        hit = min(40.0, writeoffs * 40)
        score -= hit
        reasons.append(
            {
                "code": "PH_WRITEOFF",
                "label": "Prior write-off",
                "points": -int(hit),
                "feature": "payment_history",
            }
        )

    overdue = int(f.get("current_overdue_count") or 0)
    if overdue:
        hit = min(25.0, overdue * 8)
        score -= hit
        reasons.append(
            {
                "code": "PH_OVERDUE",
                "label": f"{overdue} overdue installment(s)",
                "points": -int(hit),
                "feature": "payment_history",
            }
        )
    elif f.get("paid_schedule_count"):
        score += 5
        reasons.append(
            {
                "code": "PH_CLEAR",
                "label": "No current overdue installments",
                "points": 5,
                "feature": "payment_history",
            }
        )

    return _clamp(score), reasons


def _amounts_exposure_score(f: dict[str, Any]) -> tuple[float, list[dict]]:
    """~30% — repayment/completion vs outstanding."""
    reasons: list[dict] = []
    score = 50.0

    completion = f.get("completion_ratio")
    if completion is not None:
        score = _clamp(completion * 100)
        reasons.append(
            {
                "code": "AE_COMPLETION",
                "label": f"Paid vs due so far {completion:.0%}",
                "points": int(round((completion - 0.5) * 50)),
                "feature": "amounts_exposure",
            }
        )
    elif f.get("repayment_ratio") is not None:
        rr = float(f["repayment_ratio"])
        score = _clamp(rr * 100)
        reasons.append(
            {
                "code": "AE_REPAY",
                "label": f"Overall repayment ratio {rr:.0%}",
                "points": int(round((rr - 0.5) * 40)),
                "feature": "amounts_exposure",
            }
        )
    else:
        reasons.append(
            {
                "code": "AE_NO_DATA",
                "label": "Limited amount/exposure history",
                "points": 0,
                "feature": "amounts_exposure",
            }
        )

    overdue_amt = float(f.get("overdue_amount_ratio") or 0)
    if overdue_amt > 0:
        hit = min(30.0, overdue_amt * 40)
        score -= hit
        reasons.append(
            {
                "code": "AE_OVERDUE_AMT",
                "label": "Overdue amount vs due",
                "points": -int(hit),
                "feature": "amounts_exposure",
            }
        )

    outstanding = f.get("outstanding_ratio")
    if outstanding is not None and outstanding > 0.9 and int(f.get("paid_schedule_count") or 0) < 2:
        score -= 10
        reasons.append(
            {
                "code": "AE_HIGH_OUTSTANDING",
                "label": "High outstanding vs principal (early stage)",
                "points": -10,
                "feature": "amounts_exposure",
            }
        )

    return _clamp(score), reasons


def _history_length_score(f: dict[str, Any]) -> tuple[float, list[dict]]:
    """~15% — tenure, closed loans, depth."""
    reasons: list[dict] = []
    months = int(f.get("months_as_customer") or 0)
    closed = int(f.get("closed_loan_count") or 0)
    depth = int(f.get("history_depth") or 0)

    score = min(40.0, months * 4) + min(35.0, closed * 15) + min(25.0, depth * 8)
    reasons.append(
        {
            "code": "HL_TENURE",
            "label": f"{months} month(s) with you · {closed} closed · {depth} loan(s)",
            "points": int(score - 50),
            "feature": "history_length",
        }
    )
    return _clamp(score), reasons


def _credit_mix_score(f: dict[str, Any]) -> tuple[float, list[dict]]:
    """~10% — basic completed, file maturity."""
    reasons: list[dict] = []
    score = 40.0
    if int(f.get("basic_loan_completed") or 0):
        score += 35
        reasons.append(
            {
                "code": "CM_BASIC_DONE",
                "label": "Basic starter loan completed",
                "points": 35,
                "feature": "credit_mix",
            }
        )
    elif int(f.get("history_depth") or 0) == 0:
        score = 25
        reasons.append(
            {
                "code": "CM_THIN",
                "label": "New / thin file",
                "points": -25,
                "feature": "credit_mix",
            }
        )
    else:
        reasons.append(
            {
                "code": "CM_IN_PROGRESS",
                "label": "Basic track in progress",
                "points": 0,
                "feature": "credit_mix",
            }
        )

    if int(f.get("closed_loan_count") or 0) >= 2:
        score += 15
        reasons.append(
            {
                "code": "CM_REPEAT",
                "label": "Repeat closed loans",
                "points": 15,
                "feature": "credit_mix",
            }
        )

    return _clamp(score), reasons


def _discipline_score(f: dict[str, Any]) -> tuple[float, list[dict]]:
    """~10% — streak, recency of payment, schedule progress."""
    reasons: list[dict] = []
    score = 45.0

    streak = int(f.get("on_time_streak") or 0)
    if streak:
        bump = min(30.0, streak * 5)
        score += bump
        reasons.append(
            {
                "code": "DI_STREAK",
                "label": f"On-time streak: {streak}",
                "points": int(bump),
                "feature": "discipline",
            }
        )

    days_since_pay = f.get("days_since_last_payment")
    if days_since_pay is None:
        reasons.append(
            {
                "code": "DI_NO_PAY",
                "label": "No payments recorded yet",
                "points": -15,
                "feature": "discipline",
            }
        )
        score -= 15
    elif days_since_pay <= 3:
        score += 15
        reasons.append(
            {
                "code": "DI_RECENT_PAY",
                "label": "Recent payment activity",
                "points": 15,
                "feature": "discipline",
            }
        )
    elif days_since_pay > 14:
        hit = min(25.0, (days_since_pay - 14) * 1.5)
        score -= hit
        reasons.append(
            {
                "code": "DI_STALE_PAY",
                "label": "Long gap since last payment",
                "points": -int(hit),
                "feature": "discipline",
            }
        )

    paid = int(f.get("paid_schedule_count") or 0)
    if paid >= 2:
        score += 10
        reasons.append(
            {
                "code": "DI_EARLY_TRACK",
                "label": "Early repayment track started",
                "points": 10,
                "feature": "discipline",
            }
        )

    return _clamp(score), reasons


def apply_scorecard(
    features: dict[str, Any],
    definition: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compute 0–1000 score using CIBIL-style weighted pillars."""
    card = definition or EXPERT_DEFINITION
    weights = card.get("weights") or CIBIL_WEIGHTS
    min_score = int(card.get("min_score", 0))
    max_score = int(card.get("max_score", 1000))

    pillars = {
        "payment_history": _payment_history_score(features),
        "amounts_exposure": _amounts_exposure_score(features),
        "history_length": _history_length_score(features),
        "credit_mix": _credit_mix_score(features),
        "discipline": _discipline_score(features),
    }

    weighted = 0.0
    all_reasons: list[dict] = []
    pillar_breakdown: dict[str, float] = {}

    for name, (pillar_score, reasons) in pillars.items():
        w = float(weights.get(name, 0))
        weighted += pillar_score * w
        pillar_breakdown[name] = round(pillar_score, 1)
        all_reasons.extend(reasons)
        all_reasons.append(
            {
                "code": f"PILLAR_{name.upper()}",
                "label": f"{name.replace('_', ' ').title()} pillar: {pillar_score:.0f}/100",
                "points": int(round(pillar_score * w * 10)),
                "feature": name,
            }
        )

    # weighted is 0–100; scale to 0–1000
    score = int(round(weighted * 10))
    score = max(min_score, min(max_score, score))

    reasons_sorted = sorted(all_reasons, key=lambda r: abs(int(r.get("points") or 0)), reverse=True)
    top_reasons = [r for r in reasons_sorted if int(r.get("points") or 0) != 0][:8]
    if not top_reasons:
        top_reasons = reasons_sorted[:4]

    return {
        "score": score,
        "points_total": score,
        "base_score": 0,
        "reasons": top_reasons,
        "all_reasons": reasons_sorted,
        "pillars": pillar_breakdown,
    }


def resolve_band(
    score: int,
    file_type: str,
    poor_max: int = 499,
    fair_max: int = 649,
    good_max: int = 799,
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
    avg_prior_principal: float | None,
    last_closed_principal: float | None,
    baseline_amount: Decimal,
    multipliers: dict[str, Decimal],
    max_amount: Decimal,
    max_stepup_mult: Decimal,
) -> Decimal:
    """suggested = avg(previous loans) × band multiplier, with clamps."""
    mult = Decimal(str(multipliers.get(band, Decimal("1.0"))))

    if band == "THIN_FILE" or not avg_prior_principal or avg_prior_principal <= 0:
        base = Decimal(baseline_amount)
        suggested = (base * mult).quantize(TWOPLACES)
    else:
        base = Decimal(str(avg_prior_principal))
        suggested = (base * mult).quantize(TWOPLACES)

    # Optional step-up guard vs last closed loan.
    if last_closed_principal and last_closed_principal > 0 and max_stepup_mult > 0:
        step_cap = (Decimal(str(last_closed_principal)) * Decimal(max_stepup_mult)).quantize(
            TWOPLACES
        )
        if suggested > step_cap:
            suggested = step_cap

    if suggested < Decimal(baseline_amount):
        suggested = Decimal(baseline_amount).quantize(TWOPLACES)
    if max_amount > 0 and suggested > max_amount:
        suggested = Decimal(max_amount).quantize(TWOPLACES)

    return suggested

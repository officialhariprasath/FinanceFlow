"""Compute, persist, and snapshot CIBIL-style credit scores (0–1000)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.credit_score import CustomerCreditScore, ScorecardDefinition
from backend.app.models.customer import Customer
from backend.app.services.credit_score.expert_definition import (
    DEFAULT_SCORE_POLICY,
    EXPERT_DEFINITION,
    EXPERT_SCORECARD_VERSION,
)
from backend.app.services.credit_score.feature_builder import build_customer_features
from backend.app.services.credit_score.scorecard_engine import (
    apply_scorecard,
    resolve_band,
    suggested_max_amount,
)
from backend.app.services.finance_settings_service import get_finance_settings


STALE_AFTER = timedelta(days=1)


def _setting(settings: Any, key: str, default: Any) -> Any:
    value = getattr(settings, key, default)
    return default if value is None else value


def _policy_multipliers(settings: Any) -> dict[str, Decimal]:
    return {
        "THIN_FILE": Decimal(str(_setting(settings, "score_suggest_mult_thin", DEFAULT_SCORE_POLICY["score_suggest_mult_thin"]))),
        "POOR": Decimal(str(_setting(settings, "score_suggest_mult_poor", DEFAULT_SCORE_POLICY["score_suggest_mult_poor"]))),
        "FAIR": Decimal(str(_setting(settings, "score_suggest_mult_fair", DEFAULT_SCORE_POLICY["score_suggest_mult_fair"]))),
        "GOOD": Decimal(str(_setting(settings, "score_suggest_mult_good", DEFAULT_SCORE_POLICY["score_suggest_mult_good"]))),
        "EXCELLENT": Decimal(str(_setting(settings, "score_suggest_mult_excellent", DEFAULT_SCORE_POLICY["score_suggest_mult_excellent"]))),
    }


def get_active_scorecard_definition(
    db: Session,
    finance_owner_id: int,
) -> tuple[dict, str]:
    try:
        row = (
            db.query(ScorecardDefinition)
            .filter(
                ScorecardDefinition.is_active.is_(True),
                ScorecardDefinition.finance_owner_id == finance_owner_id,
            )
            .order_by(ScorecardDefinition.id.desc())
            .first()
        )
        if row is None:
            row = (
                db.query(ScorecardDefinition)
                .filter(
                    ScorecardDefinition.is_active.is_(True),
                    ScorecardDefinition.finance_owner_id.is_(None),
                )
                .order_by(ScorecardDefinition.id.desc())
                .first()
            )
        if row is None:
            return EXPERT_DEFINITION, EXPERT_SCORECARD_VERSION
        # Always prefer CIBIL weighted mode for runtime if old point cards linger.
        definition = row.definition_json or EXPERT_DEFINITION
        if definition.get("mode") != "CIBIL_WEIGHTED":
            return EXPERT_DEFINITION, EXPERT_SCORECARD_VERSION
        return definition, row.version
    except Exception:
        db.rollback()
        return EXPERT_DEFINITION, EXPERT_SCORECARD_VERSION


def ensure_platform_expert_scorecard(db: Session) -> None:
    try:
        existing = (
            db.query(ScorecardDefinition)
            .filter(
                ScorecardDefinition.finance_owner_id.is_(None),
                ScorecardDefinition.version == EXPERT_SCORECARD_VERSION,
            )
            .first()
        )
        if existing is None:
            db.query(ScorecardDefinition).filter(
                ScorecardDefinition.finance_owner_id.is_(None),
                ScorecardDefinition.is_active.is_(True),
            ).update({"is_active": False})
            db.add(
                ScorecardDefinition(
                    finance_owner_id=None,
                    version=EXPERT_SCORECARD_VERSION,
                    is_active=True,
                    definition_json=EXPERT_DEFINITION,
                    source="EXPERT",
                )
            )
            db.commit()
    except Exception:
        db.rollback()


def score_to_response_dict(row: Any) -> dict:
    return {
        "customer_id": getattr(row, "customer_id", None),
        "score": int(row.score),
        "band": row.band,
        "file_type": row.file_type,
        "suggested_max_amount": row.suggested_max_amount,
        "reasons": row.reasons_json or [],
        "features": getattr(row, "features_json", None) or {},
        "scorecard_version": row.scorecard_version,
        "computed_at": getattr(row, "computed_at", None),
        "advisory_only": True,
        "score_max": 1000,
    }


def _build_score_payload(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
    settings: Any,
) -> dict[str, Any]:
    features = build_customer_features(db, finance_owner_id, customer_id)
    definition, version = get_active_scorecard_definition(db, finance_owner_id)

    enabled = bool(_setting(settings, "score_enabled", True))
    if not enabled:
        result = {
            "score": 500,
            "reasons": [
                {
                    "code": "SCORING_DISABLED",
                    "label": "Scoring disabled in settings",
                    "points": 0,
                    "feature": "policy",
                }
            ],
            "pillars": {},
        }
        file_type = features.get("file_type") or "THIN"
        band = "THIN_FILE"
    else:
        result = apply_scorecard(features, definition)
        file_type = features.get("file_type") or "THIN"
        band = resolve_band(
            result["score"],
            file_type,
            poor_max=int(_setting(settings, "score_band_poor_max", 499)),
            fair_max=int(_setting(settings, "score_band_fair_max", 649)),
            good_max=int(_setting(settings, "score_band_good_max", 799)),
        )

    baseline = Decimal(str(_setting(settings, "score_baseline_amount", "2000")))
    max_amount = Decimal(str(_setting(settings, "score_max_amount", "20000")))
    stepup = Decimal(str(_setting(settings, "score_max_stepup_mult", "2.0")))

    suggest = suggested_max_amount(
        band=band,
        avg_prior_principal=features.get("avg_prior_principal"),
        last_closed_principal=features.get("last_closed_principal"),
        baseline_amount=baseline,
        multipliers=_policy_multipliers(settings),
        max_amount=max_amount,
        max_stepup_mult=stepup,
    )

    return {
        "score": result["score"],
        "band": band,
        "file_type": file_type,
        "suggested_max_amount": suggest,
        "reasons": result["reasons"],
        "features": {
            **features,
            "pillars": result.get("pillars") or {},
            "avg_prior_used": features.get("avg_prior_principal"),
            "suggest_multiplier_band": band,
        },
        "scorecard_version": version,
    }


def compute_customer_score(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
    *,
    commit: bool = True,
) -> Any:
    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    try:
        settings = get_finance_settings(db, finance_owner_id)
    except Exception:
        db.rollback()
        settings = SimpleNamespace(**DEFAULT_SCORE_POLICY)

    payload = _build_score_payload(db, finance_owner_id, customer_id, settings)
    now = datetime.now(timezone.utc)

    try:
        row = (
            db.query(CustomerCreditScore)
            .filter(
                CustomerCreditScore.finance_owner_id == finance_owner_id,
                CustomerCreditScore.customer_id == customer_id,
            )
            .first()
        )
        if row is None:
            row = CustomerCreditScore(
                finance_owner_id=finance_owner_id,
                customer_id=customer_id,
                score=payload["score"],
                band=payload["band"],
                file_type=payload["file_type"],
                suggested_max_amount=payload["suggested_max_amount"],
                reasons_json=payload["reasons"],
                features_json=payload["features"],
                scorecard_version=payload["scorecard_version"],
                computed_at=now,
            )
            db.add(row)
        else:
            row.score = payload["score"]
            row.band = payload["band"]
            row.file_type = payload["file_type"]
            row.suggested_max_amount = payload["suggested_max_amount"]
            row.reasons_json = payload["reasons"]
            row.features_json = payload["features"]
            row.scorecard_version = payload["scorecard_version"]
            row.computed_at = now

        if commit:
            db.commit()
            db.refresh(row)
        else:
            db.flush()
        return row
    except Exception:
        db.rollback()
        return SimpleNamespace(
            customer_id=customer_id,
            score=payload["score"],
            band=payload["band"],
            file_type=payload["file_type"],
            suggested_max_amount=payload["suggested_max_amount"],
            reasons_json=payload["reasons"],
            features_json=payload["features"],
            scorecard_version=payload["scorecard_version"],
            computed_at=now,
        )


def get_or_compute_customer_score(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
    *,
    force: bool = False,
    commit: bool = True,
) -> Any:
    if not force:
        try:
            row = (
                db.query(CustomerCreditScore)
                .filter(
                    CustomerCreditScore.finance_owner_id == finance_owner_id,
                    CustomerCreditScore.customer_id == customer_id,
                )
                .first()
            )
            if row is not None:
                computed_at = row.computed_at
                if computed_at is not None and computed_at.tzinfo is None:
                    computed_at = computed_at.replace(tzinfo=timezone.utc)
                if computed_at and datetime.now(timezone.utc) - computed_at < STALE_AFTER:
                    return row
        except Exception:
            db.rollback()
    return compute_customer_score(
        db, finance_owner_id, customer_id, commit=commit
    )


def snapshot_for_loan(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
) -> dict:
    try:
        row = get_or_compute_customer_score(
            db, finance_owner_id, customer_id, force=True, commit=False
        )
        return {
            "origination_score": int(row.score),
            "origination_band": row.band,
            "origination_suggested_max": row.suggested_max_amount,
            "origination_reasons_json": row.reasons_json,
            "origination_scorecard_version": row.scorecard_version,
        }
    except Exception:
        db.rollback()
        return {
            "origination_score": None,
            "origination_band": None,
            "origination_suggested_max": None,
            "origination_reasons_json": None,
            "origination_scorecard_version": None,
        }


def refresh_customer_score_safe(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
) -> None:
    try:
        compute_customer_score(db, finance_owner_id, customer_id, commit=True)
    except Exception:
        db.rollback()

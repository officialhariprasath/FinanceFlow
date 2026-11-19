"""Compute, persist, and snapshot hybrid credit scores."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.credit_score import CustomerCreditScore, ScorecardDefinition
from backend.app.models.customer import Customer
from backend.app.models.finance_settings import FinanceSettings
from backend.app.services.credit_score.expert_definition import (
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


def _policy_multipliers(settings: FinanceSettings) -> dict[str, Decimal]:
    return {
        "THIN_FILE": Decimal(settings.score_suggest_mult_thin),
        "POOR": Decimal(settings.score_suggest_mult_poor),
        "FAIR": Decimal(settings.score_suggest_mult_fair),
        "GOOD": Decimal(settings.score_suggest_mult_good),
        "EXCELLENT": Decimal(settings.score_suggest_mult_excellent),
    }


def get_active_scorecard_definition(
    db: Session,
    finance_owner_id: int,
) -> tuple[dict, str]:
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
    return row.definition_json, row.version


def ensure_platform_expert_scorecard(db: Session) -> None:
    existing = (
        db.query(ScorecardDefinition)
        .filter(
            ScorecardDefinition.finance_owner_id.is_(None),
            ScorecardDefinition.version == EXPERT_SCORECARD_VERSION,
        )
        .first()
    )
    if existing is None:
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


def score_to_response_dict(row: CustomerCreditScore) -> dict:
    return {
        "customer_id": row.customer_id,
        "score": row.score,
        "band": row.band,
        "file_type": row.file_type,
        "suggested_max_amount": row.suggested_max_amount,
        "reasons": row.reasons_json or [],
        "features": row.features_json or {},
        "scorecard_version": row.scorecard_version,
        "computed_at": row.computed_at,
        "advisory_only": True,
    }


def compute_customer_score(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
    *,
    commit: bool = True,
) -> CustomerCreditScore:
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

    settings = get_finance_settings(db, finance_owner_id)
    features = build_customer_features(db, finance_owner_id, customer_id)
    definition, version = get_active_scorecard_definition(db, finance_owner_id)

    if not settings.score_enabled:
        # Still compute a neutral thin advisory so UI has a payload.
        result = {
            "score": 620,
            "reasons": [
                {
                    "code": "SCORING_DISABLED",
                    "label": "Scoring disabled in settings",
                    "points": 0,
                    "feature": "policy",
                }
            ],
        }
        band = "THIN_FILE"
        file_type = features.get("file_type") or "THIN"
    else:
        result = apply_scorecard(features, definition)
        file_type = features.get("file_type") or "THIN"
        band = resolve_band(
            result["score"],
            file_type,
            poor_max=int(settings.score_band_poor_max),
            fair_max=int(settings.score_band_fair_max),
            good_max=int(settings.score_band_good_max),
        )

    suggest = suggested_max_amount(
        band,
        features.get("max_successful_principal"),
        Decimal(settings.score_baseline_amount),
        _policy_multipliers(settings),
    )

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
            score=result["score"],
            band=band,
            file_type=file_type,
            suggested_max_amount=suggest,
            reasons_json=result["reasons"],
            features_json=features,
            scorecard_version=version,
            computed_at=datetime.now(timezone.utc),
        )
        db.add(row)
    else:
        row.score = result["score"]
        row.band = band
        row.file_type = file_type
        row.suggested_max_amount = suggest
        row.reasons_json = result["reasons"]
        row.features_json = features
        row.scorecard_version = version
        row.computed_at = datetime.now(timezone.utc)

    if commit:
        db.commit()
        db.refresh(row)
    else:
        db.flush()
    return row


def get_or_compute_customer_score(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
    *,
    force: bool = False,
    commit: bool = True,
) -> CustomerCreditScore:
    row = (
        db.query(CustomerCreditScore)
        .filter(
            CustomerCreditScore.finance_owner_id == finance_owner_id,
            CustomerCreditScore.customer_id == customer_id,
        )
        .first()
    )
    if row is not None and not force:
        computed_at = row.computed_at
        if computed_at is not None and computed_at.tzinfo is None:
            computed_at = computed_at.replace(tzinfo=timezone.utc)
        if computed_at and datetime.now(timezone.utc) - computed_at < STALE_AFTER:
            return row
    return compute_customer_score(
        db, finance_owner_id, customer_id, commit=commit
    )


def snapshot_for_loan(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
) -> dict:
    """Return origination fields to stamp onto a new loan (no commit)."""
    try:
        row = get_or_compute_customer_score(
            db, finance_owner_id, customer_id, force=True, commit=False
        )
    except Exception:
        # Never block loan create if scoring fails.
        return {
            "origination_score": None,
            "origination_band": None,
            "origination_suggested_max": None,
            "origination_reasons_json": None,
            "origination_scorecard_version": None,
        }
    return {
        "origination_score": row.score,
        "origination_band": row.band,
        "origination_suggested_max": row.suggested_max_amount,
        "origination_reasons_json": row.reasons_json,
        "origination_scorecard_version": row.scorecard_version,
    }


def refresh_customer_score_safe(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
) -> None:
    """Best-effort recompute after payments/defaults; never raises to callers."""
    try:
        compute_customer_score(db, finance_owner_id, customer_id, commit=True)
    except Exception:
        db.rollback()

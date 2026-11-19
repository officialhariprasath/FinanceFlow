from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.enums import CollectionModel
from backend.app.models.finance_owner import FinanceOwner
from backend.app.models.finance_settings import FinanceSettings
from backend.app.models.loan import Loan
from backend.app.schemas.finance_settings import FinanceSettingsUpdate
from backend.app.services.penalty_service import sync_loan_penalty_fields


def get_finance_settings(
    db: Session,
    finance_owner_id: int,
) -> FinanceSettings:
    settings = (
        db.query(FinanceSettings)
        .filter(
            FinanceSettings.finance_owner_id == finance_owner_id
        )
        .first()
    )

    # Auto-create a default settings row if none exists yet.
    if settings is None:
        settings = FinanceSettings(finance_owner_id=finance_owner_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


def backfill_installment_loan_penalties(
    db: Session,
    finance_owner_id: int,
    settings: FinanceSettings,
) -> int:
    """
    Push current per-frequency grace/penalty settings onto every installment
    loan for this owner (active, closed, defaulted — all of them).

    Dynamic payable math also reads live settings; this keeps loan snapshot
    columns and API responses aligned after Settings save.
    """
    loans = (
        db.query(Loan)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.collection_model == CollectionModel.DAILY_COLLECTION.value,
        )
        .all()
    )
    for loan in loans:
        sync_loan_penalty_fields(loan, settings)
    return len(loans)


def update_finance_settings(
    db: Session,
    finance_owner_id: int,
    settings_data: FinanceSettingsUpdate,
) -> FinanceSettings:
    settings = (
        db.query(FinanceSettings)
        .filter(
            FinanceSettings.finance_owner_id == finance_owner_id
        )
        .first()
    )

    if settings is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finance settings not found.",
        )

    update_data = settings_data.model_dump(exclude_unset=True)

    # Validate contiguous score bands against merged (existing + incoming) cutoffs.
    band_keys = (
        "score_band_poor_max",
        "score_band_fair_max",
        "score_band_good_max",
    )
    if any(k in update_data for k in band_keys):
        from backend.app.services.credit_score.band_policy import (
            validate_score_band_cutoffs,
        )

        merged_poor = update_data.get("score_band_poor_max", settings.score_band_poor_max)
        merged_fair = update_data.get("score_band_fair_max", settings.score_band_fair_max)
        merged_good = update_data.get("score_band_good_max", settings.score_band_good_max)
        try:
            validate_score_band_cutoffs(merged_poor, merged_fair, merged_good)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    for field, value in update_data.items():
        setattr(settings, field, value)

    # Mirror owner_name and business_name back to the FinanceOwner
    # record so that GET /finance-owners/me always returns the
    # latest name (used by the dashboard greeting).
    owner_fields = {"owner_name", "business_name", "phone", "email", "address"}
    owner_updates = {
        k: v for k, v in update_data.items() if k in owner_fields and v is not None
    }
    if owner_updates:
        owner = db.query(FinanceOwner).filter(
            FinanceOwner.id == finance_owner_id
        ).first()
        if owner:
            for field, value in owner_updates.items():
                setattr(owner, field, value)

    # Always backfill installment loans so existing + previously backfilled
    # loans pick up grace/penalty changes (e.g. 5 → 3) immediately.
    loans_updated = backfill_installment_loan_penalties(
        db, finance_owner_id, settings
    )

    db.commit()
    db.refresh(settings)
    # Transient attribute for API response (not an ORM column).
    settings.penalty_loans_updated = loans_updated
    return settings

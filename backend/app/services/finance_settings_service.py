from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.finance_owner import FinanceOwner
from backend.app.models.finance_settings import FinanceSettings
from backend.app.schemas.finance_settings import FinanceSettingsUpdate


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

    db.commit()
    db.refresh(settings)

    return settings
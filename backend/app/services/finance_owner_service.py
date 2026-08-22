"""
Finance Owner Service

Contains business logic for finance owner registration
and authentication.
"""

from sqlalchemy.orm import Session

from backend.app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.finance_owner import FinanceOwnerCreate
from backend.app.models.finance_settings import FinanceSettings


def create_finance_owner(
    db: Session,
    owner: FinanceOwnerCreate,
):
    """
    Register a new finance owner (email OTP must already be verified by the API layer).
    """
    from backend.app.services.email_otp_service import normalize_phone

    phone = normalize_phone(owner.phone) or owner.phone.strip()

    existing_owner = (
        db.query(FinanceOwner)
        .filter(
            (FinanceOwner.email == str(owner.email).lower())
            | (FinanceOwner.phone == phone)
        )
        .first()
    )

    if existing_owner:
        raise ValueError(
            "Finance owner already exists."
        )

    db_owner = FinanceOwner(
        business_name=owner.business_name,
        owner_name=owner.owner_name,
        phone=phone,
        email=str(owner.email).lower(),
        password_hash=hash_password(owner.password),
        address=owner.address,
    )

    db.add(db_owner)

    # Flush assigns the generated ID without committing.
    db.flush()

    default_settings = FinanceSettings(
        finance_owner_id=db_owner.id,
        business_name=db_owner.business_name,
        owner_name=db_owner.owner_name,
        phone=db_owner.phone,
        email=db_owner.email,
        address=db_owner.address,
    )

    db.add(default_settings)

    db.commit()
    db.refresh(db_owner)

    return db_owner


def authenticate_finance_owner(
    db: Session,
    username: str,
    password: str,
):
    """
    Authenticate a finance owner by email OR mobile number.
    """
    from backend.app.services.email_otp_service import (
        looks_like_email,
        normalize_identifier,
        normalize_phone,
    )

    raw = (username or "").strip()
    owner = None
    if looks_like_email(raw):
        owner = (
            db.query(FinanceOwner)
            .filter(FinanceOwner.email == normalize_identifier(raw))
            .first()
        )
    else:
        phone = normalize_phone(raw)
        owner = (
            db.query(FinanceOwner)
            .filter(FinanceOwner.phone == phone)
            .first()
        )
        if owner is None and phone:
            owner = (
                db.query(FinanceOwner)
                .filter(FinanceOwner.phone.endswith(phone[-10:]))
                .first()
            )

    if owner is None:
        raise ValueError("Invalid email/mobile or password.")

    if not verify_password(
        password,
        owner.password_hash,
    ):
        raise ValueError("Invalid email/mobile or password.")

    access_token = create_access_token(
        data={
            "sub": owner.email,
            "owner_id": owner.id,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
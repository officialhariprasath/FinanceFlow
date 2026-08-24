"""
Finance Owner API

Contains endpoints for finance owner registration,
authentication, and profile management.
"""

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner
from backend.app.database.session import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.finance_owner import (
    FinanceOwnerCreate,
    FinanceOwnerResponse,
    Token,
)
from backend.app.services.finance_owner_service import (
    authenticate_finance_owner,
    create_finance_owner,
)
from backend.app.services.email_otp_service import verify_otp

router = APIRouter(
    prefix="/finance-owners",
    tags=["Finance Owners"],
)


@router.post(
    "/register",
    response_model=FinanceOwnerResponse,
)
def register_finance_owner(
    owner: FinanceOwnerCreate,
    db: Session = Depends(get_db),
):
    """
    Register a new finance owner (requires email OTP from /auth/send-otp).

    Bootstrap exception: when the database has zero owners (fresh production),
    OTP is optional so the first owner can register without mail setup.
    """
    owner_count = db.query(FinanceOwner).count()
    bootstrap = owner_count == 0
    if not bootstrap:
        if not owner.otp_code or not verify_otp(
            db,
            email=str(owner.email),
            purpose="register_owner",
            code=owner.otp_code,
            consume=True,
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired email verification code. Request a new code.",
            )
    try:
        return create_finance_owner(db, owner)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.post(
    "/login",
    response_model=Token,
)
def login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Authenticate a finance owner and return a JWT access token.
    """
    try:
        return authenticate_finance_owner(
            db,
            username,
            password,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=401,
            detail=str(e),
        )

@router.get(
    "/me",
    response_model=FinanceOwnerResponse,
)
def get_profile(
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    """
    Return the currently authenticated finance owner's profile.
    """
    return owner
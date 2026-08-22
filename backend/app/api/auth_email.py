"""
Auth helpers: email OTP, password reset, email/phone login resolution.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.models.agent import Agent
from backend.app.models.finance_owner import FinanceOwner
from backend.app.core.security import hash_password
from backend.app.services.email_otp_service import (
    create_and_send_otp,
    looks_like_email,
    normalize_identifier,
    normalize_phone,
    verify_otp,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


class SendOtpRequest(BaseModel):
    email: EmailStr
    purpose: str = Field(
        description="register_owner | register_agent | reset_password"
    )


class ForgotPasswordRequest(BaseModel):
    """Email or mobile number — OTP is always sent to the account email."""

    identifier: str


class ResetPasswordRequest(BaseModel):
    identifier: str
    code: str
    new_password: str = Field(min_length=6)


def _resolve_account_email(db: Session, identifier: str) -> tuple[str, str]:
    """Return (email, actor_type) for owner or agent."""
    raw = (identifier or "").strip()
    if not raw:
        raise ValueError("Enter email or mobile number.")

    if looks_like_email(raw):
        email = normalize_identifier(raw)
        owner = db.query(FinanceOwner).filter(FinanceOwner.email == email).first()
        if owner:
            return owner.email, "owner"
        agent = db.query(Agent).filter(Agent.email == email).first()
        if agent:
            return agent.email, "agent"
        raise ValueError("No account found for that email.")

    phone = normalize_phone(raw)
    if len(phone) < 8:
        raise ValueError("Enter a valid email or mobile number.")

    owner = db.query(FinanceOwner).filter(FinanceOwner.phone == phone).first()
    if owner:
        return owner.email, "owner"
    # try with leading variants stored as-is
    owner = (
        db.query(FinanceOwner)
        .filter(FinanceOwner.phone.endswith(phone[-10:]))
        .first()
    )
    if owner:
        return owner.email, "owner"

    agent = db.query(Agent).filter(Agent.phone == phone).first()
    if agent:
        return agent.email, "agent"
    agent = db.query(Agent).filter(Agent.phone.endswith(phone[-10:])).first()
    if agent:
        return agent.email, "agent"

    raise ValueError("No account found for that mobile number.")


@router.post("/send-otp")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)):
    purpose = payload.purpose.strip()
    allowed = {"register_owner", "register_agent", "reset_password"}
    if purpose not in allowed:
        raise HTTPException(status_code=400, detail="Invalid OTP purpose.")
    try:
        return create_and_send_otp(db, email=str(payload.email), purpose=purpose)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    try:
        email, _actor = _resolve_account_email(db, payload.identifier)
        result = create_and_send_otp(db, email=email, purpose="reset_password")
        result["message"] = (
            "If an account exists, a reset code was sent to the registered email."
            if result.get("mailed")
            else result.get("message")
        )
        return result
    except ValueError as exc:
        # Do not leak whether account exists for email enumeration — still return generic for unknown
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        email, actor = _resolve_account_email(db, payload.identifier)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not verify_otp(
        db, email=email, purpose="reset_password", code=payload.code, consume=True
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    if actor == "owner":
        owner = db.query(FinanceOwner).filter(FinanceOwner.email == email).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Account not found.")
        owner.password_hash = hash_password(payload.new_password)
    else:
        agent = db.query(Agent).filter(Agent.email == email).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Account not found.")
        agent.password_hash = hash_password(payload.new_password)

    db.commit()
    return {"ok": True, "message": "Password updated. You can log in now."}

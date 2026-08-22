"""Email OTP codes for registration and password reset."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from backend.app.database.base import Base


class EmailOtp(Base):
    __tablename__ = "email_otps"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    purpose = Column(String(40), nullable=False)  # register_owner | register_agent | reset_password
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

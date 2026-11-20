from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    String,
    Numeric,
    ForeignKey,
    DateTime,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.base import Base


class FinanceSettings(Base):
    __tablename__ = "finance_settings"

    id = Column(Integer, primary_key=True, index=True)

    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    business_name = Column(String(150), nullable=True)
    owner_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(120), nullable=True)
    address = Column(String(300), nullable=True)

    default_interest_method = Column(
        String(20),
        nullable=False,
        default="PERCENTAGE",
    )

    default_interest_rate = Column(
        Numeric(10, 2),
        nullable=False,
        default=5.00,
    )

    default_loan_duration = Column(
        Integer,
        nullable=False,
        default=12,
    )

    default_grace_period = Column(
        Integer,
        nullable=False,
        default=0,
    )

    currency = Column(
        String(10),
        nullable=False,
        default="INR",
    )

    date_format = Column(
        String(20),
        nullable=False,
        default="DD/MM/YYYY",
    )

    timezone = Column(
        String(50),
        nullable=False,
        default="Asia/Kolkata",
    )

    maturity_alert_days = Column(
        Integer,
        nullable=False,
        default=30,
    )

    # Grace installments + fixed penalty per collection frequency (not grace days).
    daily_grace_installments = Column(Integer, nullable=False, default=0)
    daily_penalty_per_installment = Column(Numeric(12, 2), nullable=False, default=0)
    weekly_grace_installments = Column(Integer, nullable=False, default=0)
    weekly_penalty_per_installment = Column(Numeric(12, 2), nullable=False, default=0)
    bi_weekly_grace_installments = Column(Integer, nullable=False, default=0)
    bi_weekly_penalty_per_installment = Column(Numeric(12, 2), nullable=False, default=0)
    monthly_grace_installments = Column(Integer, nullable=False, default=0)
    monthly_penalty_per_installment = Column(Numeric(12, 2), nullable=False, default=0)

    # Hybrid credit scorecard policy (advisory only).
    score_enabled = Column(Boolean, nullable=False, default=True)
    score_band_poor_max = Column(Integer, nullable=False, default=499)
    score_band_fair_max = Column(Integer, nullable=False, default=649)
    score_band_good_max = Column(Integer, nullable=False, default=799)
    score_suggest_mult_thin = Column(Numeric(8, 4), nullable=False, default=1.0)
    score_suggest_mult_poor = Column(Numeric(8, 4), nullable=False, default=1.0)
    score_suggest_mult_fair = Column(Numeric(8, 4), nullable=False, default=1.5)
    score_suggest_mult_good = Column(Numeric(8, 4), nullable=False, default=2.0)
    score_suggest_mult_excellent = Column(Numeric(8, 4), nullable=False, default=2.5)
    score_baseline_amount = Column(Numeric(12, 2), nullable=False, default=2000)
    score_max_amount = Column(Numeric(12, 2), nullable=False, default=20000)
    score_max_stepup_mult = Column(Numeric(8, 4), nullable=False, default=2.0)

    # Display codes: VMFC0001 / VMFL0001 (padding grows after 9999 → VMFL10000).
    customer_code_prefix = Column(String(12), nullable=False, default="VMFC")
    loan_code_prefix = Column(String(12), nullable=False, default="VMFL")
    code_number_padding = Column(Integer, nullable=False, default=4)
    customer_code_next = Column(Integer, nullable=False, default=1)
    loan_code_next = Column(Integer, nullable=False, default=1)

    # When true, non-owner creates must go through loan approval requests.
    require_loan_approval = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    finance_owner = relationship(
        "FinanceOwner",
        back_populates="settings",
    )
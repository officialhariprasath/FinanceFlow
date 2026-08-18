from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    Date,
    DateTime,
    String,
    ForeignKey,
    Boolean,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id"),
        nullable=False,
    )

    loan_id = Column(
        Integer,
        ForeignKey("loans.id"),
        nullable=False,
    )

    payment_date = Column(
        Date,
        nullable=False,
    )

    amount_paid = Column(
        Numeric(12, 2),
        nullable=False,
    )

    interest_paid = Column(
        Numeric(12, 2),
        nullable=False,
    )

    principal_paid = Column(
        Numeric(12, 2),
        nullable=False,
    )

    payment_mode = Column(
        String(50),
        nullable=False,
    )

    remarks = Column(
        String(255),
        nullable=True,
    )

    collected_by_agent_id = Column(
        Integer,
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    payment_reference = Column(String(100), nullable=True)

    is_locked = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    finance_owner = relationship(
        "FinanceOwner",
        back_populates="payments",
    )

    loan = relationship(
        "Loan",
        back_populates="payments",
    )

    collected_by_agent = relationship("Agent", foreign_keys=[collected_by_agent_id])

    allocation = relationship(
        "PaymentAllocation",
        back_populates="payment",
        uselist=False,
        cascade="all, delete-orphan",
    )
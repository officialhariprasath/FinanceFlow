from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.app.database.base import Base


class CapitalAccount(Base):
    __tablename__ = "capital_accounts"

    id = Column(Integer, primary_key=True, index=True)

    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    currency = Column(String(10), nullable=False, default="INR")

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    finance_owner = relationship(
        "FinanceOwner",
        back_populates="capital_account",
    )

    transactions = relationship(
        "CapitalTransaction",
        back_populates="capital_account",
        cascade="all, delete-orphan",
        order_by="CapitalTransaction.created_at",
    )

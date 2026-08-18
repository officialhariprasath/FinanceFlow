from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from backend.app.database.base import Base


class ProfitAccount(Base):
    __tablename__ = "profit_accounts"

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
        back_populates="profit_account",
    )

    transactions = relationship(
        "ProfitTransaction",
        back_populates="profit_account",
        cascade="all, delete-orphan",
        order_by="ProfitTransaction.created_at",
    )

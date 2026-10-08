from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from backend.app.database.base import Base


class OwnerCashAccount(Base):
    __tablename__ = "owner_cash_accounts"

    id = Column(Integer, primary_key=True, index=True)
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    principal_balance = Column(Numeric(12, 2), nullable=False, default=0)
    profit_balance = Column(Numeric(12, 2), nullable=False, default=0)
    penalty_balance = Column(Numeric(12, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="INR")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    transactions = relationship(
        "OwnerCashTransaction",
        back_populates="account",
        cascade="all, delete-orphan",
        order_by="OwnerCashTransaction.created_at",
    )


class OwnerCashTransaction(Base):
    __tablename__ = "owner_cash_transactions"

    id = Column(Integer, primary_key=True, index=True)
    owner_cash_account_id = Column(
        Integer,
        ForeignKey("owner_cash_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    finance_owner_id = Column(Integer, nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)
    direction = Column(String(10), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    principal_amount = Column(Numeric(12, 2), nullable=False, default=0)
    profit_amount = Column(Numeric(12, 2), nullable=False, default=0)
    penalty_amount = Column(Numeric(12, 2), nullable=False, default=0)
    principal_balance_after = Column(Numeric(12, 2), nullable=False)
    profit_balance_after = Column(Numeric(12, 2), nullable=False)
    penalty_balance_after = Column(Numeric(12, 2), nullable=False, default=0)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    description = Column(String(255), nullable=True)
    created_by = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    account = relationship("OwnerCashAccount", back_populates="transactions")

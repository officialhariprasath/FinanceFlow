from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship

from backend.app.database.base import Base


class ProfitTransaction(Base):
    __tablename__ = "profit_transactions"

    id = Column(Integer, primary_key=True, index=True)

    profit_account_id = Column(
        Integer,
        ForeignKey("profit_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    transaction_id = Column(String(64), nullable=True, index=True)

    type = Column(String(50), nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=False)

    direction = Column(String(10), nullable=False)

    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)

    description = Column(String(255), nullable=True)

    balance_after = Column(Numeric(12, 2), nullable=False)

    created_by = Column(
        Integer,
        ForeignKey("finance_owners.id"),
        nullable=False,
    )

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    profit_account = relationship(
        "ProfitAccount",
        back_populates="transactions",
    )

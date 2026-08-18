from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship

from backend.app.database.base import Base


class AgentWallet(Base):
    __tablename__ = "agent_wallets"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(
        Integer,
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    cash_balance = Column(Numeric(14, 2), nullable=False, default=0)
    upi_balance = Column(Numeric(14, 2), nullable=False, default=0)
    other_balance = Column(Numeric(14, 2), nullable=False, default=0)

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    agent = relationship("Agent", back_populates="wallet")
    finance_owner = relationship("FinanceOwner")

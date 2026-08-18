from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.base import Base


class AgentLedgerEntry(Base):
    __tablename__ = "agent_ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(
        Integer,
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    entry_type = Column(String(30), nullable=False)
    channel = Column(String(20), nullable=False)
    credit_amount = Column(Numeric(14, 2), nullable=False, default=0)
    debit_amount = Column(Numeric(14, 2), nullable=False, default=0)
    balance_after = Column(Numeric(14, 2), nullable=False)

    payment_id = Column(
        Integer,
        ForeignKey("payments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    settlement_id = Column(
        Integer,
        ForeignKey("agent_settlements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    payment_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    agent = relationship("Agent", back_populates="ledger_entries")
    payment = relationship("Payment")
    settlement = relationship("AgentSettlement", back_populates="ledger_entries")

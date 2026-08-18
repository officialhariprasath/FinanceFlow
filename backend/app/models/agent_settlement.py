from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.base import Base


class AgentSettlement(Base):
    __tablename__ = "agent_settlements"

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

    status = Column(String(30), nullable=False, default="SUBMITTED")
    cash_amount = Column(Numeric(14, 2), nullable=False, default=0)
    upi_amount = Column(Numeric(14, 2), nullable=False, default=0)
    other_amount = Column(Numeric(14, 2), nullable=False, default=0)
    total_amount = Column(Numeric(14, 2), nullable=False, default=0)

    delivery_method = Column(String(20), nullable=False, default="CASH")
    delivery_cash_amount = Column(Numeric(14, 2), nullable=False, default=0)
    delivery_upi_amount = Column(Numeric(14, 2), nullable=False, default=0)
    delivery_other_amount = Column(Numeric(14, 2), nullable=False, default=0)

    transfer_reference = Column(String(100), nullable=True)
    transfer_date = Column(Date, nullable=True)
    proof_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    reconciliation_note = Column(Text, nullable=True)

    submitted_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="SET NULL"),
        nullable=True,
    )

    agent = relationship("Agent", back_populates="settlements")
    finance_owner = relationship("FinanceOwner", foreign_keys=[finance_owner_id])
    ledger_entries = relationship(
        "AgentLedgerEntry",
        back_populates="settlement",
        foreign_keys="AgentLedgerEntry.settlement_id",
    )

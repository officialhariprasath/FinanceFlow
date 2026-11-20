from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.base import Base


class LoanApprovalRequest(Base):
    __tablename__ = "loan_approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(
        Integer,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="PENDING", index=True)

    principal_amount = Column(Numeric(12, 2), nullable=False)
    interest_rate = Column(Numeric(10, 2), nullable=False, default=0)
    collection_frequency = Column(String(20), nullable=False, default="DAILY")
    installment_count = Column(Integer, nullable=False)
    issue_date = Column(Date, nullable=False)
    due_start_date = Column(Date, nullable=False)
    daily_payment = Column(Numeric(12, 2), nullable=True)
    daily_principal = Column(Numeric(12, 2), nullable=True)
    daily_profit = Column(Numeric(12, 2), nullable=True)

    collection_agent_id = Column(
        Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    submitted_by_agent_id = Column(
        Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_by_agent_id = Column(
        Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(String(500), nullable=True)
    created_loan_id = Column(
        Integer, ForeignKey("loans.id", ondelete="SET NULL"), nullable=True
    )
    notes = Column(String(500), nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    customer = relationship("Customer")
    collection_agent = relationship("Agent", foreign_keys=[collection_agent_id])
    submitted_by_agent = relationship("Agent", foreign_keys=[submitted_by_agent_id])
    reviewed_by_agent = relationship("Agent", foreign_keys=[reviewed_by_agent_id])

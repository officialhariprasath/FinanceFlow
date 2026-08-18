from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from backend.app.database.base import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category = Column(String(50), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    description = Column(String(255), nullable=True)
    expense_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    profit_transaction_id = Column(Integer, nullable=True)
    capital_transaction_id = Column(Integer, nullable=True)
    funding_source = Column(String(20), nullable=False, default="PROFIT")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_type = Column(String(20), nullable=False, default="owner")
    actor_id = Column(Integer, nullable=True)
    action = Column(String(80), nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    level = Column(String(20), nullable=False, default="info")
    is_read = Column(Boolean, default=False, nullable=False)
    recipient_agent_id = Column(Integer, nullable=True, index=True)
    action_url = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LoanWriteOff(Base):
    __tablename__ = "loan_write_offs"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(
        Integer,
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    principal_outstanding = Column(Numeric(14, 2), nullable=False)
    amount_recovered = Column(Numeric(14, 2), nullable=False, default=0)
    principal_loss = Column(Numeric(14, 2), nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

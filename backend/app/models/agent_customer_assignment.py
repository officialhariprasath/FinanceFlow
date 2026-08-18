from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.base import Base


class AgentCustomerAssignment(Base):
    __tablename__ = "agent_customer_assignments"
    __table_args__ = (
        UniqueConstraint("agent_id", "customer_id", name="uq_agent_customer"),
    )

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(
        Integer,
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(
        Integer,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    agent = relationship("Agent", back_populates="customer_assignments")
    customer = relationship("Customer")

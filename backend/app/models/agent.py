import json
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.app.database.base import Base


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)

    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    full_name = Column(String(100), nullable=False)
    phone = Column(String(15), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False)
    permissions = Column(Text, nullable=False)
    assigned_area = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    finance_owner = relationship(
        "FinanceOwner",
        back_populates="agents",
    )

    wallet = relationship(
        "AgentWallet",
        back_populates="agent",
        uselist=False,
        cascade="all, delete-orphan",
    )
    ledger_entries = relationship(
        "AgentLedgerEntry",
        back_populates="agent",
        foreign_keys="AgentLedgerEntry.agent_id",
    )
    settlements = relationship(
        "AgentSettlement",
        back_populates="agent",
        foreign_keys="AgentSettlement.agent_id",
    )
    customer_assignments = relationship(
        "AgentCustomerAssignment",
        back_populates="agent",
        cascade="all, delete-orphan",
    )

    def get_permissions_list(self) -> list[str]:
        try:
            data = json.loads(self.permissions)
            if isinstance(data, list):
                return [str(p) for p in data]
        except (json.JSONDecodeError, TypeError):
            pass
        return []

    def set_permissions_list(self, permissions: list[str]) -> None:
        self.permissions = json.dumps(permissions)

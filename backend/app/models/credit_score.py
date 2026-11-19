from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.base import Base


class ScorecardDefinition(Base):
    __tablename__ = "scorecard_definitions"

    id = Column(Integer, primary_key=True)
    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    version = Column(String(40), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    definition_json = Column(JSON, nullable=False)
    source = Column(String(30), nullable=False, default="EXPERT")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class CustomerCreditScore(Base):
    __tablename__ = "customer_credit_scores"
    __table_args__ = (
        UniqueConstraint(
            "finance_owner_id",
            "customer_id",
            name="uq_customer_credit_scores_owner_customer",
        ),
    )

    id = Column(Integer, primary_key=True)
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
    score = Column(Integer, nullable=False)
    band = Column(String(30), nullable=False)
    file_type = Column(String(20), nullable=False)
    suggested_max_amount = Column(Numeric(12, 2), nullable=False)
    reasons_json = Column(JSON, nullable=False)
    features_json = Column(JSON, nullable=False)
    scorecard_version = Column(String(40), nullable=False)
    computed_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    customer = relationship("Customer")

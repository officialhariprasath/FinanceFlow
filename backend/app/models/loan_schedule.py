from sqlalchemy import (
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship

from backend.app.database.base import Base


class LoanSchedule(Base):
    __tablename__ = "loan_schedules"

    id = Column(Integer, primary_key=True, index=True)

    loan_id = Column(
        Integer,
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    schedule_date = Column(Date, nullable=False, index=True)

    expected_amount = Column(Numeric(12, 2), nullable=False)
    expected_principal = Column(Numeric(12, 2), nullable=False)
    expected_profit = Column(Numeric(12, 2), nullable=False)

    paid_amount = Column(Numeric(12, 2), default=0, nullable=False)
    paid_principal = Column(Numeric(12, 2), default=0, nullable=False)
    paid_profit = Column(Numeric(12, 2), default=0, nullable=False)

    status = Column(String(20), nullable=False, default="PENDING")

    loan = relationship(
        "Loan",
        back_populates="schedules",
    )

from sqlalchemy import Column, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship

from backend.app.database.base import Base


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"

    id = Column(Integer, primary_key=True, index=True)

    payment_id = Column(
        Integer,
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    loan_id = Column(
        Integer,
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    principal_amount = Column(Numeric(12, 2), nullable=False)
    profit_amount = Column(Numeric(12, 2), nullable=False)
    late_fee_amount = Column(Numeric(12, 2), default=0, nullable=False)
    other_amount = Column(Numeric(12, 2), default=0, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)

    payment = relationship(
        "Payment",
        back_populates="allocation",
    )

    loan = relationship(
        "Loan",
        back_populates="payment_allocations",
    )

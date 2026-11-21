from sqlalchemy import (
    Boolean,
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from backend.app.database.base import Base


class Customer(Base):
    """
    Stores customer details belonging to a finance owner.
    """

    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint(
            "finance_owner_id",
            "display_code",
            name="uq_customers_owner_display_code",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    finance_owner_id = Column(
        Integer,
        ForeignKey("finance_owners.id"),
        nullable=False
    )

    display_code = Column(String(32), nullable=False, index=True)

    full_name = Column(String(100), nullable=False)

    phone = Column(
        String(15),
        unique=True,
        nullable=False
    )

    permanent_address = Column(String(300), nullable=True)
    temporary_address = Column(String(300), nullable=True)

    # KYC (nullable — existing customers stay empty until edited)
    id_type = Column(String(20), nullable=True)
    id_number = Column(String(50), nullable=True)
    alternate_phone = Column(String(15), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    occupation = Column(String(30), nullable=True)
    business_name = Column(String(150), nullable=True)
    monthly_income = Column(Numeric(12, 2), nullable=True)
    area_landmark = Column(String(200), nullable=True)
    house_ownership = Column(String(20), nullable=True)
    guarantor_name = Column(String(100), nullable=True)
    guarantor_phone = Column(String(15), nullable=True)
    reference1_name = Column(String(100), nullable=True)
    reference1_phone = Column(String(15), nullable=True)
    reference2_name = Column(String(100), nullable=True)
    reference2_phone = Column(String(15), nullable=True)
    has_other_loans = Column(Boolean, nullable=True)
    other_loans_emi = Column(Numeric(12, 2), nullable=True)

    # Split address (nullable; permanent_address / temporary_address stay composed)
    addr_line1 = Column(String(200), nullable=True)
    addr_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    address_comment = Column(String(500), nullable=True)
    temp_addr_line1 = Column(String(200), nullable=True)
    temp_addr_line2 = Column(String(200), nullable=True)
    temp_city = Column(String(100), nullable=True)
    temp_state = Column(String(100), nullable=True)
    temp_postal_code = Column(String(20), nullable=True)
    temp_address_comment = Column(String(500), nullable=True)
    occupation_detail = Column(String(150), nullable=True)

    finance_owner = relationship(
        "FinanceOwner",
        back_populates="customers"
    )

    loans = relationship(
        "Loan",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
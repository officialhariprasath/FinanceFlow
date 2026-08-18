from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.customer import Customer
from backend.app.models.enums import CollectionModel, ScheduleStatus
from backend.app.models.loan import Loan
from backend.app.models.loan_schedule import LoanSchedule
from backend.app.services.schedule_service import mark_overdue_schedules

ZERO = Decimal("0.00")


def get_today_collections(
    db: Session,
    finance_owner_id: int,
    target_date: date | None = None,
    agent_id: int | None = None,
):
    if target_date is None:
        target_date = date.today()

    mark_overdue_schedules(db, finance_owner_id, target_date)

    assigned_customer_ids: set[int] | None = None
    if agent_id is not None:
        from backend.app.models.agent_customer_assignment import AgentCustomerAssignment

        rows = (
            db.query(AgentCustomerAssignment.customer_id)
            .filter(
                AgentCustomerAssignment.agent_id == agent_id,
                AgentCustomerAssignment.finance_owner_id == finance_owner_id,
            )
            .all()
        )
        if rows:
            assigned_customer_ids = {r[0] for r in rows}

    loans = (
        db.query(Loan, Customer)
        .join(Customer, Loan.customer_id == Customer.id)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
            Loan.collection_model == CollectionModel.DAILY_COLLECTION.value,
        )
        .all()
    )

    items = []
    expected_total = ZERO
    collected_total = ZERO

    for loan, customer in loans:
        if assigned_customer_ids is not None and customer.id not in assigned_customer_ids:
            continue
        schedule = (
            db.query(LoanSchedule)
            .filter(
                LoanSchedule.loan_id == loan.id,
                LoanSchedule.schedule_date == target_date,
            )
            .first()
        )

        if schedule is None:
            continue

        expected = schedule.expected_amount
        paid = schedule.paid_amount
        pending = max(expected - paid, ZERO)

        expected_total += expected
        collected_total += paid

        if schedule.status == ScheduleStatus.PAID.value:
            status_label = "PAID"
        elif schedule.status == ScheduleStatus.OVERDUE.value:
            status_label = "OVERDUE"
        elif schedule.status == ScheduleStatus.PARTIAL.value:
            status_label = "PARTIAL"
        else:
            status_label = "PENDING"

        items.append(
            {
                "loan_id": loan.id,
                "customer_id": customer.id,
                "customer_name": customer.full_name,
                "customer_phone": customer.phone,
                "schedule_date": schedule.schedule_date,
                "expected_amount": expected,
                "paid_amount": paid,
                "pending_amount": pending,
                "expected_principal": schedule.expected_principal,
                "expected_profit": schedule.expected_profit,
                "status": status_label,
            }
        )

    pending_total = max(expected_total - collected_total, ZERO)
    collection_rate = (
        (collected_total / expected_total * Decimal("100")).quantize(Decimal("0.01"))
        if expected_total > ZERO
        else ZERO
    )

    overdue_count = sum(1 for item in items if item["status"] == "OVERDUE")

    return {
        "date": target_date,
        "expected_collection": expected_total,
        "collected": collected_total,
        "pending": pending_total,
        "collection_rate": collection_rate,
        "overdue_count": overdue_count,
        "items": items,
    }

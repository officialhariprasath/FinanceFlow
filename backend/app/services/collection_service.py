from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from backend.app.models.customer import Customer
from backend.app.models.enums import CollectionModel, ScheduleStatus
from backend.app.models.loan import Loan
from backend.app.models.loan_schedule import LoanSchedule
from backend.app.services.schedule_service import mark_overdue_schedules, schedule_pending_amount

ZERO = Decimal("0.00")
TWOPLACES = Decimal("0.01")


def _status_label(status: str) -> str:
    if status == ScheduleStatus.PAID.value:
        return "PAID"
    if status == ScheduleStatus.OVERDUE.value:
        return "OVERDUE"
    if status == ScheduleStatus.PARTIAL.value:
        return "PARTIAL"
    return "PENDING"


def get_today_collections(
    db: Session,
    finance_owner_id: int,
    target_date: date | None = None,
    agent_id: int | None = None,
):
    if target_date is None:
        target_date = date.today()

    mark_overdue_schedules(db, finance_owner_id, target_date)

    # Self-heal: sole active agent gets every unassigned active-loan borrower.
    from backend.app.services.agent_assignment_service import (
        auto_assign_orphan_customers_to_sole_agent,
        customer_assignment_ids,
    )

    auto_assign_orphan_customers_to_sole_agent(db, finance_owner_id)

    # Agents with no assignments must see nothing (not the full book).
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

    all_customer_ids = {customer.id for _, customer in loans}
    assigned_anywhere = customer_assignment_ids(db, finance_owner_id, all_customer_ids)

    items = []
    expected_total = ZERO
    collected_total = ZERO
    overdue_pending_total = ZERO
    overdue_installment_count = 0
    unassigned_due_count = 0
    unassigned_due_total = ZERO
    unassigned_names: list[str] = []

    for loan, customer in loans:
        if assigned_customer_ids is not None and customer.id not in assigned_customer_ids:
            continue

        today_schedule = (
            db.query(LoanSchedule)
            .filter(
                LoanSchedule.loan_id == loan.id,
                LoanSchedule.schedule_date == target_date,
            )
            .first()
        )

        overdue_schedules = (
            db.query(LoanSchedule)
            .filter(
                LoanSchedule.loan_id == loan.id,
                LoanSchedule.schedule_date < target_date,
                LoanSchedule.status == ScheduleStatus.OVERDUE.value,
            )
            .order_by(LoanSchedule.schedule_date.asc())
            .all()
        )

        if today_schedule is None and not overdue_schedules:
            continue

        today_expected = ZERO
        today_paid = ZERO
        today_pending = ZERO
        expected_principal = ZERO
        expected_profit = ZERO
        status_label = "PENDING"
        schedule_date = target_date

        if today_schedule is not None:
            today_expected = Decimal(today_schedule.expected_amount)
            today_paid = Decimal(today_schedule.paid_amount)
            today_pending = schedule_pending_amount(today_schedule)
            expected_principal = Decimal(today_schedule.expected_principal)
            expected_profit = Decimal(today_schedule.expected_profit)
            status_label = _status_label(today_schedule.status)
            schedule_date = today_schedule.schedule_date

            expected_total += today_expected
            collected_total += today_paid

        overdue_pending = ZERO
        for sched in overdue_schedules:
            overdue_pending += schedule_pending_amount(sched)
            overdue_installment_count += 1

        overdue_pending = overdue_pending.quantize(TWOPLACES)
        overdue_pending_total += overdue_pending

        # Arrears take priority in status and default collect date.
        if overdue_schedules:
            status_label = "OVERDUE"
            if today_schedule is None or today_pending <= ZERO:
                schedule_date = overdue_schedules[0].schedule_date
                if today_schedule is None:
                    expected_principal = Decimal(overdue_schedules[0].expected_principal)
                    expected_profit = Decimal(overdue_schedules[0].expected_profit)

        pending_amount = (today_pending + overdue_pending).quantize(TWOPLACES)

        # Skip fully settled loans with no arrears and nothing due today.
        if today_schedule is None and pending_amount <= ZERO:
            continue

        is_assigned = customer.id in assigned_anywhere
        if not is_assigned and pending_amount > ZERO:
            unassigned_due_count += 1
            unassigned_due_total += pending_amount
            unassigned_names.append(customer.full_name)

        items.append(
            {
                "loan_id": loan.id,
                "customer_id": customer.id,
                "customer_name": customer.full_name,
                "customer_phone": customer.phone,
                "schedule_date": schedule_date,
                "expected_amount": today_expected if today_schedule is not None else overdue_pending,
                "paid_amount": today_paid,
                "pending_amount": pending_amount,
                "overdue_pending_amount": overdue_pending,
                "expected_principal": expected_principal,
                "expected_profit": expected_profit,
                "status": status_label,
                "is_assigned_to_agent": is_assigned,
            }
        )

    # Sort: overdue first, then unpaid today, paid last.
    status_rank = {"OVERDUE": 0, "PARTIAL": 1, "PENDING": 2, "PAID": 3}
    items.sort(
        key=lambda item: (
            status_rank.get(item["status"], 9),
            item["customer_name"],
            item["loan_id"],
        )
    )

    pending_total = max(expected_total - collected_total, ZERO).quantize(TWOPLACES)
    collection_rate = (
        (collected_total / expected_total * Decimal("100")).quantize(TWOPLACES)
        if expected_total > ZERO
        else ZERO
    )

    return {
        "date": target_date,
        "expected_collection": expected_total.quantize(TWOPLACES),
        "collected": collected_total.quantize(TWOPLACES),
        "pending": pending_total,
        "overdue_pending": overdue_pending_total.quantize(TWOPLACES),
        "collection_rate": collection_rate,
        "overdue_count": overdue_installment_count,
        "unassigned_due_count": unassigned_due_count,
        "unassigned_due_total": unassigned_due_total.quantize(TWOPLACES),
        "unassigned_borrower_names": unassigned_names,
        "items": items,
    }

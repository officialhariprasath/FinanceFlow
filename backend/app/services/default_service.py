from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.enums import LedgerDirection, ProfitTransactionType
from backend.app.models.financeflow_extended import LoanWriteOff
from backend.app.models.loan import Loan
from backend.app.models.profit_transaction import ProfitTransaction
from backend.app.services.audit_service import log_audit
from backend.app.services.profit_service import get_available_profit, get_or_create_profit_account, TWOPLACES, ZERO


def mark_loan_defaulted(db: Session, loan_id: int, finance_owner_id: int, reason: str | None = None):
    loan = (
        db.query(Loan)
        .filter(Loan.id == loan_id, Loan.finance_owner_id == finance_owner_id)
        .first()
    )
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found.")
    if loan.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Only active loans can be marked defaulted.")
    loan.status = "DEFAULTED"
    log_audit(db, finance_owner_id, "LOAN_DEFAULTED", "loan", loan_id, reason or "")
    db.commit()
    db.refresh(loan)
    return loan


def write_off_loan(
    db: Session,
    loan_id: int,
    finance_owner_id: int,
    amount_recovered: Decimal,
    reason: str | None = None,
):
    loan = (
        db.query(Loan)
        .filter(Loan.id == loan_id, Loan.finance_owner_id == finance_owner_id)
        .first()
    )
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found.")
    if loan.status not in ("ACTIVE", "DEFAULTED"):
        raise HTTPException(status_code=400, detail="Loan cannot be written off.")

    principal_outstanding = Decimal(loan.remaining_principal).quantize(TWOPLACES)
    amount_recovered = amount_recovered.quantize(TWOPLACES)
    if amount_recovered > principal_outstanding:
        amount_recovered = principal_outstanding
    principal_loss = principal_outstanding - amount_recovered

    if principal_loss > ZERO:
        account = get_or_create_profit_account(db, finance_owner_id)
        available = get_available_profit(db, finance_owner_id)
        loss_amount = min(principal_loss, available)
        if loss_amount > ZERO:
            new_balance = available - loss_amount
            loss_tx = ProfitTransaction(
                profit_account_id=account.id,
                type=ProfitTransactionType.PRINCIPAL_LOSS.value,
                amount=loss_amount,
                direction=LedgerDirection.DEBIT.value,
                reference_type="LOAN_WRITE_OFF",
                reference_id=loan_id,
                description=f"Principal loss on loan #{loan_id}",
                balance_after=new_balance,
                created_by=finance_owner_id,
            )
            db.add(loss_tx)

    write_off = LoanWriteOff(
        loan_id=loan_id,
        finance_owner_id=finance_owner_id,
        principal_outstanding=principal_outstanding,
        amount_recovered=amount_recovered,
        principal_loss=principal_loss,
        reason=reason,
    )
    db.add(write_off)
    loan.remaining_principal = ZERO
    loan.status = "CLOSED"
    log_audit(
        db,
        finance_owner_id,
        "LOAN_WRITE_OFF",
        "loan",
        loan_id,
        f"Loss: {principal_loss}, recovered: {amount_recovered}",
    )
    db.commit()
    db.refresh(write_off)
    return write_off


def list_overdue_loans(db: Session, finance_owner_id: int):
    from datetime import date

    from backend.app.models.enums import CollectionModel, ScheduleStatus
    from backend.app.models.loan_schedule import LoanSchedule
    from backend.app.models.customer import Customer
    from backend.app.services.schedule_service import mark_overdue_schedules

    mark_overdue_schedules(db, finance_owner_id, date.today())

    rows = (
        db.query(Loan, Customer, LoanSchedule)
        .join(Customer, Loan.customer_id == Customer.id)
        .join(LoanSchedule, LoanSchedule.loan_id == Loan.id)
        .filter(
            Loan.finance_owner_id == finance_owner_id,
            Loan.status == "ACTIVE",
            Loan.collection_model == CollectionModel.DAILY_COLLECTION.value,
            LoanSchedule.status == ScheduleStatus.OVERDUE.value,
        )
        .all()
    )
    return [
        {
            "loan_id": loan.id,
            "customer_name": customer.full_name,
            "schedule_date": schedule.schedule_date,
            "expected_amount": schedule.expected_amount,
            "paid_amount": schedule.paid_amount,
            "pending_amount": max(
                Decimal(schedule.expected_amount) - Decimal(schedule.paid_amount),
                ZERO,
            ),
        }
        for loan, customer, schedule in rows
    ]

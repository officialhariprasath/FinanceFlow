from fastapi import APIRouter, Depends, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner, require_permissions
from backend.app.core.auth_context import AuthContext, get_auth_context
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.extended import (
    AmountRequest,
    AuditLogResponse,
    CapitalWithdrawResponse,
    DefaultRequest,
    ExpenseCreateRequest,
    ExpenseResponse,
    LedgerEntryResponse,
    NetProfitSummaryResponse,
    NotificationResponse,
    NotificationCountResponse,
    OverdueLoanResponse,
    ProfitReinvestResponse,
    ProfitTransactionResponse,
    ReconciliationResponse,
    WriteOffRequest,
    WriteOffResponse,
)
from backend.app.schemas.capital import CapitalTransactionResponse
from backend.app.services.audit_service import list_audit_logs
from backend.app.services.capital_service import withdraw_capital
from backend.app.services.default_service import (
    list_overdue_loans,
    mark_loan_defaulted,
    write_off_loan,
)
from backend.app.services.expense_service import (
    EXPENSE_CATEGORIES,
    create_expense,
    list_expenses,
    get_net_profit_summary,
)
from backend.app.services.ledger_service import get_business_ledger, get_reconciliation
from backend.app.services.notification_service import (
    count_unread_notifications,
    list_notifications,
    mark_notification_read,
)
from backend.app.services.profit_operations_service import (
    list_profit_transactions,
    reinvest_profit,
    withdraw_profit,
)
from backend.app.services.report_service import (
    export_transactions_csv,
    get_collections_report,
    get_financial_summary_report,
    get_portfolio_report,
)

router = APIRouter(tags=["FinanceFlow Extended"])


@router.get("/profit/transactions", response_model=list[ProfitTransactionResponse])
def list_profit_transactions_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["profit"])),
):
    return list_profit_transactions(db, ctx.finance_owner_id)


@router.post(
    "/profit/withdraw",
    response_model=ProfitTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
def withdraw_profit_endpoint(
    payload: AmountRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    from backend.app.services.notification_service import create_notification

    tx = withdraw_profit(db, owner.id, payload.amount, payload.description)
    create_notification(
        db,
        owner.id,
        "Profit withdrawn",
        f"₹{payload.amount} withdrawn from profit account.",
        "info",
    )
    db.commit()
    return tx


@router.post("/profit/reinvest", response_model=ProfitReinvestResponse)
def reinvest_profit_endpoint(
    payload: AmountRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    from backend.app.services.notification_service import create_notification

    result = reinvest_profit(db, owner.id, payload.amount, payload.description)
    create_notification(
        db,
        owner.id,
        "Profit reinvested",
        f"₹{payload.amount} moved from profit to capital.",
        "success",
    )
    db.commit()
    return {
        "profit_transaction": result["profit_transaction"],
        "capital_transaction_id": result["capital_transaction"].id,
    }


@router.get("/profit/net-summary", response_model=NetProfitSummaryResponse)
def net_profit_summary_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["profit"])),
):
    return get_net_profit_summary(db, ctx.finance_owner_id)


@router.post(
    "/capital/withdraw",
    response_model=CapitalWithdrawResponse,
    status_code=status.HTTP_201_CREATED,
)
def withdraw_capital_endpoint(
    payload: AmountRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    from backend.app.services.notification_service import create_notification

    result = withdraw_capital(db, owner.id, payload.amount, payload.description)
    create_notification(
        db,
        owner.id,
        "Capital withdrawn",
        f"₹{payload.amount} withdrawn from capital.",
        "warning",
    )
    db.commit()
    return {
        "transaction": CapitalTransactionResponse.model_validate(result["transaction"]),
        "available_before": result["available_before"],
        "available_after": result["available_after"],
        "warning": result.get("warning"),
    }


@router.get("/ledger/business", response_model=list[LedgerEntryResponse])
def business_ledger_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["ledger"])),
    limit: int = 500,
):
    return get_business_ledger(db, ctx.finance_owner_id, limit=limit)


@router.get("/ledger/reconciliation", response_model=ReconciliationResponse)
def reconciliation_endpoint(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return get_reconciliation(db, owner.id)


@router.get("/expenses/categories")
def expense_categories_endpoint():
    return {"categories": EXPENSE_CATEGORIES}


@router.get("/expenses", response_model=list[ExpenseResponse])
def list_expenses_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["expenses"])),
):
    return list_expenses(db, ctx.finance_owner_id)


@router.post(
    "/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_expense_endpoint(
    payload: ExpenseCreateRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return create_expense(
        db,
        owner.id,
        payload.category,
        payload.amount,
        payload.description,
        funding_source=payload.funding_source,
    )


@router.get("/defaults/overdue", response_model=list[OverdueLoanResponse])
def overdue_loans_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["loans"])),
):
    return list_overdue_loans(db, ctx.finance_owner_id)


@router.post("/defaults/{loan_id}/mark-defaulted")
def mark_defaulted_endpoint(
    loan_id: int,
    payload: DefaultRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    from backend.app.services.notification_service import create_notification

    loan = mark_loan_defaulted(db, loan_id, owner.id, payload.reason)
    create_notification(
        db,
        owner.id,
        "Loan marked defaulted",
        f"Loan #{loan_id} was marked as defaulted.",
        "warning",
    )
    db.commit()
    return {"loan_id": loan.id, "status": loan.status}


@router.post(
    "/defaults/{loan_id}/write-off",
    response_model=WriteOffResponse,
    status_code=status.HTTP_201_CREATED,
)
def write_off_endpoint(
    loan_id: int,
    payload: WriteOffRequest,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    from backend.app.services.notification_service import create_notification

    write_off = write_off_loan(
        db,
        loan_id,
        owner.id,
        payload.amount_recovered,
        payload.reason,
    )
    create_notification(
        db,
        owner.id,
        "Loan written off",
        f"Loan #{loan_id} written off. Principal loss: ₹{write_off.principal_loss}",
        "warning",
    )
    db.commit()
    return write_off


@router.get("/reports/summary")
def financial_summary_report(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["reports"])),
):
    return get_financial_summary_report(db, ctx.finance_owner_id)


@router.get("/reports/collections")
def collections_report(
    days: int = 30,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["reports"])),
):
    return get_collections_report(db, ctx.finance_owner_id, days=days)


@router.get("/reports/portfolio")
def portfolio_report(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["reports"])),
):
    return get_portfolio_report(db, ctx.finance_owner_id)


@router.get("/reports/export/transactions")
def export_transactions(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["reports"])),
):
    csv = export_transactions_csv(db, ctx.finance_owner_id)
    return PlainTextResponse(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


@router.get("/audit/logs", response_model=list[AuditLogResponse])
def audit_logs_endpoint(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
    limit: int = 200,
):
    return list_audit_logs(db, owner.id, limit=limit)


@router.get("/notifications", response_model=list[NotificationResponse])
def notifications_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
    unread_only: bool = False,
):
    if ctx.is_owner:
        return list_notifications(
            db, ctx.finance_owner_id, unread_only=unread_only, for_owner=True
        )
    return list_notifications(
        db,
        ctx.finance_owner_id,
        unread_only=unread_only,
        recipient_agent_id=ctx.actor_id,
        for_owner=False,
    )


@router.get("/notifications/count", response_model=NotificationCountResponse)
def notifications_count_endpoint(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
):
    if ctx.is_owner:
        count = count_unread_notifications(db, ctx.finance_owner_id, for_owner=True)
    else:
        count = count_unread_notifications(
            db, ctx.finance_owner_id, recipient_agent_id=ctx.actor_id, for_owner=False
        )
    return {"unread_count": count}


@router.post("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_read_endpoint(
    notification_id: int,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
):
    if ctx.is_owner:
        note = mark_notification_read(
            db, ctx.finance_owner_id, notification_id, for_owner=True
        )
    else:
        note = mark_notification_read(
            db,
            ctx.finance_owner_id,
            notification_id,
            recipient_agent_id=ctx.actor_id,
            for_owner=False,
        )
    if note is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Notification not found.")
    return note

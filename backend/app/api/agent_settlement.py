from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner, require_permissions
from backend.app.core.auth_context import AuthContext
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.agent_wallet import (
    AgentSettlementCreate,
    AgentSettlementReject,
    AgentSettlementResponse,
)
from backend.app.services.agent_settlement_service import (
    approve_settlement,
    create_settlement,
    list_all_settlements,
    list_pending_settlements,
    list_settlements_for_agent,
    reject_settlement,
    settlement_to_dict,
)

router = APIRouter(prefix="/agent-settlements", tags=["Agent Settlements"])


def _require_agent(ctx: AuthContext) -> int:
    if ctx.is_owner:
        raise HTTPException(status_code=400, detail="Agent-only endpoint.")
    return ctx.actor_id


@router.post("/", response_model=AgentSettlementResponse, status_code=status.HTTP_201_CREATED)
def submit_settlement(
    payload: AgentSettlementCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["settlements"])),
):
    agent_id = _require_agent(ctx)
    settlement = create_settlement(
        db=db,
        agent_id=agent_id,
        finance_owner_id=ctx.finance_owner_id,
        cash_amount=payload.cash_amount,
        upi_amount=payload.upi_amount,
        other_amount=payload.other_amount,
        delivery_method=payload.delivery_method,
        delivery_cash_amount=payload.delivery_cash_amount,
        delivery_upi_amount=payload.delivery_upi_amount,
        delivery_other_amount=payload.delivery_other_amount,
        transfer_reference=payload.transfer_reference,
        transfer_date=payload.transfer_date,
        proof_notes=payload.proof_notes,
        reconciliation_note=payload.reconciliation_note,
    )
    return settlement_to_dict(settlement)


@router.get("/me", response_model=list[AgentSettlementResponse])
def my_settlements(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_permissions(["settlements"])),
):
    agent_id = _require_agent(ctx)
    settlements = list_settlements_for_agent(db, agent_id, ctx.finance_owner_id)
    return [settlement_to_dict(s) for s in settlements]


@router.get("/pending", response_model=list[AgentSettlementResponse])
def pending_settlements(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    rows = list_pending_settlements(db, owner.id)
    return [settlement_to_dict(s, agent.full_name) for s, agent in rows]


@router.get("/", response_model=list[AgentSettlementResponse])
def all_settlements(
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    rows = list_all_settlements(db, owner.id, status_filter=status_filter)
    return [settlement_to_dict(s, agent.full_name) for s, agent in rows]


@router.post("/{settlement_id}/approve", response_model=AgentSettlementResponse)
def approve_settlement_endpoint(
    settlement_id: int,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    settlement = approve_settlement(db, settlement_id, owner.id, owner.id)
    return settlement_to_dict(settlement)


@router.post("/{settlement_id}/reject", response_model=AgentSettlementResponse)
def reject_settlement_endpoint(
    settlement_id: int,
    payload: AgentSettlementReject,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    settlement = reject_settlement(
        db, settlement_id, owner.id, owner.id, payload.reason
    )
    return settlement_to_dict(settlement)

from typing import List

from fastapi import APIRouter, Depends, Form, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.auth import get_current_finance_owner
from backend.app.core.auth_context import AuthContext, get_auth_context
from backend.app.database.deps import get_db
from backend.app.models.finance_owner import FinanceOwner
from backend.app.schemas.agent import (
    AgentCreate,
    AgentLoginResponse,
    AgentResponse,
    AgentUpdate,
    PERMISSION_OPTIONS,
    SessionResponse,
)
from backend.app.schemas.agent_wallet import AgentAssignmentCreate, AgentAssignmentResponse
from backend.app.services.agent_assignment_service import (
    assign_customers_to_agent,
    list_agent_assignments,
    remove_agent_assignment,
)
from backend.app.services.agent_service import (
    authenticate_agent,
    create_agent,
    delete_agent,
    get_agent,
    get_role_presets,
    list_agents,
    agent_to_response,
    update_agent,
)

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("/permissions/options")
def permission_options():
    return PERMISSION_OPTIONS


@router.get("/roles/presets")
def role_presets():
    return get_role_presets()


@router.post("/login", response_model=AgentLoginResponse)
def agent_login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    try:
        return authenticate_agent(db, username, password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/session", response_model=SessionResponse)
def get_session(ctx: AuthContext = Depends(get_auth_context)):
    return SessionResponse(
        actor_type=ctx.actor_type,
        display_name=ctx.display_name,
        finance_owner_id=ctx.finance_owner_id,
        agent_id=ctx.actor_id if not ctx.is_owner else None,
        permissions=ctx.permissions,
        is_owner=ctx.is_owner,
    )


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent_endpoint(
    payload: AgentCreate,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    agent = create_agent(db, owner.id, payload)
    return agent_to_response(agent)


@router.get("/", response_model=List[AgentResponse])
def list_agents_endpoint(
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return [agent_to_response(a) for a in list_agents(db, owner.id)]


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent_endpoint(
    agent_id: int,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    return agent_to_response(get_agent(db, owner.id, agent_id))


@router.put("/{agent_id}", response_model=AgentResponse)
def update_agent_endpoint(
    agent_id: int,
    payload: AgentUpdate,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    agent = update_agent(db, owner.id, agent_id, payload)
    return agent_to_response(agent)


@router.delete("/{agent_id}", status_code=status.HTTP_200_OK)
def delete_agent_endpoint(
    agent_id: int,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    delete_agent(db, owner.id, agent_id)
    return {"message": "Agent deleted successfully."}


@router.post("/{agent_id}/assignments", status_code=status.HTTP_200_OK)
def assign_customers_endpoint(
    agent_id: int,
    payload: AgentAssignmentCreate,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    get_agent(db, owner.id, agent_id)
    assign_customers_to_agent(db, owner.id, agent_id, payload.customer_ids)
    return {"message": "Customers assigned successfully."}


@router.get("/{agent_id}/assignments", response_model=list[AgentAssignmentResponse])
def list_assignments_endpoint(
    agent_id: int,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    get_agent(db, owner.id, agent_id)
    return list_agent_assignments(db, owner.id, agent_id)


@router.delete("/{agent_id}/assignments/{customer_id}", status_code=status.HTTP_200_OK)
def remove_assignment_endpoint(
    agent_id: int,
    customer_id: int,
    db: Session = Depends(get_db),
    owner: FinanceOwner = Depends(get_current_finance_owner),
):
    remove_agent_assignment(db, owner.id, agent_id, customer_id)
    return {"message": "Assignment removed."}

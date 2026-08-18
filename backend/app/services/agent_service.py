from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.permissions import resolve_permissions, ROLE_DEFAULT_PERMISSIONS
from backend.app.core.security import create_access_token, hash_password, verify_password
from backend.app.models.agent import Agent
from backend.app.models.enums import AgentRole
from backend.app.schemas.agent import AgentCreate, AgentUpdate


def create_agent(
    db: Session,
    finance_owner_id: int,
    payload: AgentCreate,
) -> Agent:
    existing = (
        db.query(Agent)
        .filter(
            (Agent.email == payload.email) | (Agent.phone == payload.phone)
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent email or phone already exists.",
        )

    permissions = resolve_permissions(payload.role, payload.permissions)

    agent = Agent(
        finance_owner_id=finance_owner_id,
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip(),
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
        assigned_area=payload.assigned_area,
    )
    agent.set_permissions_list(permissions)

    db.add(agent)
    db.flush()

    from backend.app.services.agent_wallet_service import get_or_create_wallet

    get_or_create_wallet(db, agent.id, finance_owner_id)

    db.commit()
    db.refresh(agent)
    return agent


def list_agents(db: Session, finance_owner_id: int):
    return (
        db.query(Agent)
        .filter(Agent.finance_owner_id == finance_owner_id)
        .order_by(Agent.full_name)
        .all()
    )


def get_agent(db: Session, finance_owner_id: int, agent_id: int) -> Agent:
    agent = (
        db.query(Agent)
        .filter(
            Agent.id == agent_id,
            Agent.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found.")
    return agent


def update_agent(
    db: Session,
    finance_owner_id: int,
    agent_id: int,
    payload: AgentUpdate,
) -> Agent:
    agent = get_agent(db, finance_owner_id, agent_id)

    if payload.email and str(payload.email).lower() != agent.email:
        conflict = (
            db.query(Agent)
            .filter(Agent.email == str(payload.email).lower())
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use.")

    if payload.full_name is not None:
        agent.full_name = payload.full_name.strip()
    if payload.phone is not None:
        agent.phone = payload.phone.strip()
    if payload.email is not None:
        agent.email = str(payload.email).lower()
    if payload.password:
        agent.password_hash = hash_password(payload.password)
    if payload.role is not None:
        agent.role = payload.role
    if payload.is_active is not None:
        agent.is_active = payload.is_active
    if payload.assigned_area is not None:
        agent.assigned_area = payload.assigned_area.strip() or None

    if payload.permissions is not None or payload.role is not None:
        role = payload.role or agent.role
        perms = resolve_permissions(role, payload.permissions)
        agent.set_permissions_list(perms)

    db.commit()
    db.refresh(agent)
    return agent


def delete_agent(db: Session, finance_owner_id: int, agent_id: int) -> None:
    agent = get_agent(db, finance_owner_id, agent_id)
    db.delete(agent)
    db.commit()


def authenticate_agent(db: Session, email: str, password: str):
    agent = (
        db.query(Agent)
        .filter(Agent.email == email.lower().strip(), Agent.is_active.is_(True))
        .first()
    )
    if agent is None or not verify_password(password, agent.password_hash):
        raise ValueError("Invalid email or password.")

    permissions = agent.get_permissions_list()
    token = create_access_token(
        data={
            "sub": agent.email,
            "owner_id": agent.finance_owner_id,
            "agent_id": agent.id,
            "actor_type": "agent",
            "permissions": permissions,
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "actor_type": "agent",
        "display_name": agent.full_name,
        "permissions": permissions,
    }


def agent_to_response(agent: Agent) -> dict:
    return {
        "id": agent.id,
        "finance_owner_id": agent.finance_owner_id,
        "full_name": agent.full_name,
        "phone": agent.phone,
        "email": agent.email,
        "role": agent.role,
        "permissions": agent.get_permissions_list(),
        "is_active": agent.is_active,
        "assigned_area": agent.assigned_area,
        "joined_at": agent.created_at,
    }


def get_role_presets() -> dict:
    return ROLE_DEFAULT_PERMISSIONS

from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.app.core.security import ALGORITHM, SECRET_KEY
from backend.app.database.session import get_db
from backend.app.models.agent import Agent
from backend.app.models.finance_owner import FinanceOwner

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/finance-owners/login")


@dataclass
class AuthContext:
    finance_owner_id: int
    actor_type: str
    actor_id: int
    display_name: str
    permissions: list[str]
    is_owner: bool

    @property
    def id(self) -> int:
        """Backward-compatible finance owner id for existing services."""
        return self.finance_owner_id


def _build_context_from_token(payload: dict, db: Session) -> AuthContext:
    owner_id = payload.get("owner_id")
    if owner_id is None:
        raise HTTPException(status_code=401, detail="Invalid token.")

    agent_id = payload.get("agent_id")
    actor_type = payload.get("actor_type", "owner")

    if agent_id is not None:
        agent = (
            db.query(Agent)
            .filter(
                Agent.id == agent_id,
                Agent.finance_owner_id == owner_id,
                Agent.is_active.is_(True),
            )
            .first()
        )
        if agent is None:
            raise HTTPException(status_code=401, detail="Agent not found or inactive.")

        # Always use live agent permissions so owner edits apply without waiting
        # for an exact token refresh edge-case.
        permissions = agent.get_permissions_list()

        return AuthContext(
            finance_owner_id=owner_id,
            actor_type="agent",
            actor_id=agent.id,
            display_name=agent.full_name,
            permissions=permissions,
            is_owner=False,
        )

    owner = db.query(FinanceOwner).filter(FinanceOwner.id == owner_id).first()
    if owner is None:
        raise HTTPException(status_code=401, detail="Finance owner not found.")

    from backend.app.core.permissions import ALL_PERMISSIONS

    return AuthContext(
        finance_owner_id=owner.id,
        actor_type="owner",
        actor_id=owner.id,
        display_name=owner.owner_name,
        permissions=ALL_PERMISSIONS,
        is_owner=True,
    )


def get_auth_context(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token.")

    return _build_context_from_token(payload, db)


def get_current_finance_owner(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> FinanceOwner:
    """Owner-only dependency for admin routes."""
    ctx = get_auth_context(token=token, db=db)
    if not ctx.is_owner:
        raise HTTPException(
            status_code=403,
            detail="Only the finance owner can perform this action.",
        )

    owner = db.query(FinanceOwner).filter(FinanceOwner.id == ctx.finance_owner_id).first()
    if owner is None:
        raise HTTPException(status_code=401, detail="Finance owner not found.")
    return owner


def require_permissions(required: list[str]) -> Callable:
    def dependency(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if ctx.is_owner:
            return ctx
        missing = [p for p in required if p not in ctx.permissions]
        if missing:
            raise HTTPException(
                status_code=403,
                detail=f"Missing permissions: {', '.join(missing)}",
            )
        return ctx

    return dependency

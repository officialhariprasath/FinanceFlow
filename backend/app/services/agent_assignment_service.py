from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models.agent import Agent
from backend.app.models.agent_customer_assignment import AgentCustomerAssignment
from backend.app.models.customer import Customer
from backend.app.models.loan import Loan


def list_active_agents(db: Session, finance_owner_id: int) -> list[Agent]:
    return (
        db.query(Agent)
        .filter(
            Agent.finance_owner_id == finance_owner_id,
            Agent.is_active.is_(True),
        )
        .order_by(Agent.id.asc())
        .all()
    )


def customer_assignment_ids(
    db: Session,
    finance_owner_id: int,
    customer_ids: set[int] | list[int] | None = None,
) -> set[int]:
    """Return customer ids that already have at least one agent assignment."""
    q = db.query(AgentCustomerAssignment.customer_id).filter(
        AgentCustomerAssignment.finance_owner_id == finance_owner_id,
    )
    if customer_ids is not None:
        ids = list(customer_ids)
        if not ids:
            return set()
        q = q.filter(AgentCustomerAssignment.customer_id.in_(ids))
    return {r[0] for r in q.distinct().all()}


def _add_assignment_if_missing(
    db: Session,
    finance_owner_id: int,
    agent_id: int,
    customer_id: int,
) -> bool:
    existing = (
        db.query(AgentCustomerAssignment)
        .filter(
            AgentCustomerAssignment.agent_id == agent_id,
            AgentCustomerAssignment.customer_id == customer_id,
        )
        .first()
    )
    if existing is not None:
        return False
    db.add(
        AgentCustomerAssignment(
            agent_id=agent_id,
            customer_id=customer_id,
            finance_owner_id=finance_owner_id,
        )
    )
    return True


def assign_customers_to_agent(
    db: Session,
    finance_owner_id: int,
    agent_id: int,
    customer_ids: list[int],
    *,
    commit: bool = True,
):
    for customer_id in customer_ids:
        customer = (
            db.query(Customer)
            .filter(
                Customer.id == customer_id,
                Customer.finance_owner_id == finance_owner_id,
            )
            .first()
        )
        if customer is None:
            raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")

        _add_assignment_if_missing(db, finance_owner_id, agent_id, customer_id)

    if commit:
        db.commit()


def ensure_customer_assigned(
    db: Session,
    finance_owner_id: int,
    customer_id: int,
    agent_id: int | None = None,
    *,
    commit: bool = True,
) -> int | None:
    """
    Make sure a customer is on at least one agent's collection list.

    - If already assigned to anyone, leave as-is (returns that agent when agent_id matches,
      otherwise the first existing assignee).
    - If agent_id is provided, assign to that agent.
    - Else if exactly one active agent exists, assign to them.
    - Else return None (owner must choose).
    """
    existing = (
        db.query(AgentCustomerAssignment)
        .filter(
            AgentCustomerAssignment.finance_owner_id == finance_owner_id,
            AgentCustomerAssignment.customer_id == customer_id,
        )
        .all()
    )
    if existing:
        if agent_id is not None:
            _add_assignment_if_missing(db, finance_owner_id, agent_id, customer_id)
            if commit:
                db.commit()
            return agent_id
        return existing[0].agent_id

    target_id = agent_id
    if target_id is None:
        agents = list_active_agents(db, finance_owner_id)
        if len(agents) == 1:
            target_id = agents[0].id
        else:
            return None

    agent = (
        db.query(Agent)
        .filter(
            Agent.id == target_id,
            Agent.finance_owner_id == finance_owner_id,
            Agent.is_active.is_(True),
        )
        .first()
    )
    if agent is None:
        raise HTTPException(status_code=404, detail="Collection agent not found.")

    _add_assignment_if_missing(db, finance_owner_id, target_id, customer_id)
    if commit:
        db.commit()
    return target_id


def auto_assign_orphan_customers_to_sole_agent(
    db: Session,
    finance_owner_id: int,
) -> int:
    """
    If there is exactly one active agent, assign every active-loan customer
    who has no agent yet. Returns how many customers were newly assigned.
    """
    agents = list_active_agents(db, finance_owner_id)
    if len(agents) != 1:
        return 0

    sole_id = agents[0].id
    active_customer_ids = {
        r[0]
        for r in (
            db.query(Loan.customer_id)
            .filter(
                Loan.finance_owner_id == finance_owner_id,
                Loan.status == "ACTIVE",
            )
            .distinct()
            .all()
        )
    }
    if not active_customer_ids:
        return 0

    already = customer_assignment_ids(db, finance_owner_id, active_customer_ids)
    orphans = active_customer_ids - already
    if not orphans:
        return 0

    for customer_id in orphans:
        _add_assignment_if_missing(db, finance_owner_id, sole_id, customer_id)
    db.commit()
    return len(orphans)


def list_agent_assignments(db: Session, finance_owner_id: int, agent_id: int):
    rows = (
        db.query(AgentCustomerAssignment, Customer)
        .join(Customer, AgentCustomerAssignment.customer_id == Customer.id)
        .filter(
            AgentCustomerAssignment.agent_id == agent_id,
            AgentCustomerAssignment.finance_owner_id == finance_owner_id,
        )
        .all()
    )
    return [
        {
            "agent_id": agent_id,
            "customer_id": customer.id,
            "customer_name": customer.full_name,
        }
        for _, customer in rows
    ]


def remove_agent_assignment(
    db: Session,
    finance_owner_id: int,
    agent_id: int,
    customer_id: int,
):
    row = (
        db.query(AgentCustomerAssignment)
        .filter(
            AgentCustomerAssignment.agent_id == agent_id,
            AgentCustomerAssignment.customer_id == customer_id,
            AgentCustomerAssignment.finance_owner_id == finance_owner_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    db.delete(row)
    db.commit()

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.models.agent_customer_assignment import AgentCustomerAssignment
from backend.app.models.customer import Customer


def assign_customers_to_agent(
    db: Session,
    finance_owner_id: int,
    agent_id: int,
    customer_ids: list[int],
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

        existing = (
            db.query(AgentCustomerAssignment)
            .filter(
                AgentCustomerAssignment.agent_id == agent_id,
                AgentCustomerAssignment.customer_id == customer_id,
            )
            .first()
        )
        if existing is None:
            db.add(
                AgentCustomerAssignment(
                    agent_id=agent_id,
                    customer_id=customer_id,
                    finance_owner_id=finance_owner_id,
                )
            )

    db.commit()


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

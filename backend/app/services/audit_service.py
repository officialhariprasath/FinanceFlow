from sqlalchemy.orm import Session

from backend.app.models.financeflow_extended import AuditLog


def log_audit(
    db: Session,
    finance_owner_id: int,
    action: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    details: str | None = None,
    actor_type: str = "owner",
    actor_id: int | None = None,
):
    entry = AuditLog(
        finance_owner_id=finance_owner_id,
        actor_type=actor_type,
        actor_id=actor_id or finance_owner_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(entry)
    db.flush()
    return entry


def list_audit_logs(db: Session, finance_owner_id: int, limit: int = 200):
    return (
        db.query(AuditLog)
        .filter(AuditLog.finance_owner_id == finance_owner_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

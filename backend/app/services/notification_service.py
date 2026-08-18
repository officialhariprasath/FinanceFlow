from sqlalchemy.orm import Session

from backend.app.models.financeflow_extended import Notification


def create_notification(
    db: Session,
    finance_owner_id: int,
    title: str,
    message: str,
    level: str = "info",
    recipient_agent_id: int | None = None,
    action_url: str | None = None,
):
    note = Notification(
        finance_owner_id=finance_owner_id,
        title=title,
        message=message,
        level=level,
        is_read=False,
        recipient_agent_id=recipient_agent_id,
        action_url=action_url,
    )
    db.add(note)
    db.flush()
    return note


def list_notifications(
    db: Session,
    finance_owner_id: int,
    unread_only: bool = False,
    recipient_agent_id: int | None = None,
    for_owner: bool = True,
):
    q = db.query(Notification).filter(Notification.finance_owner_id == finance_owner_id)
    if for_owner:
        q = q.filter(Notification.recipient_agent_id.is_(None))
    else:
        q = q.filter(Notification.recipient_agent_id == recipient_agent_id)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    return q.order_by(Notification.created_at.desc()).limit(100).all()


def count_unread_notifications(
    db: Session,
    finance_owner_id: int,
    recipient_agent_id: int | None = None,
    for_owner: bool = True,
) -> int:
    q = db.query(Notification).filter(
        Notification.finance_owner_id == finance_owner_id,
        Notification.is_read.is_(False),
    )
    if for_owner:
        q = q.filter(Notification.recipient_agent_id.is_(None))
    else:
        q = q.filter(Notification.recipient_agent_id == recipient_agent_id)
    return q.count()


def mark_notification_read(
    db: Session,
    finance_owner_id: int,
    notification_id: int,
    recipient_agent_id: int | None = None,
    for_owner: bool = True,
):
    q = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.finance_owner_id == finance_owner_id,
    )
    if for_owner:
        q = q.filter(Notification.recipient_agent_id.is_(None))
    else:
        q = q.filter(Notification.recipient_agent_id == recipient_agent_id)
    note = q.first()
    if note:
        note.is_read = True
        db.commit()
        db.refresh(note)
    return note

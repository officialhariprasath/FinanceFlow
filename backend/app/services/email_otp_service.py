"""
Email + OTP helpers.

Configure SMTP on Render (or local) via env:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_TLS=true

Optional: RESEND_API_KEY for Resend.com HTTP API.

If neither is configured, OTP is still created and returned as `dev_code`
so you can test without mail (set real SMTP/Resend before production use).
"""

from __future__ import annotations

import json
import os
import random
import smtplib
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Any

from sqlalchemy.orm import Session

from backend.app.models.email_otp import EmailOtp

OTP_TTL_MINUTES = 10


def _smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM"))


def _resend_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY"))


def email_delivery_ready() -> bool:
    return _smtp_configured() or _resend_configured()


def generate_otp_code(length: int = 6) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(length))


def normalize_identifier(value: str) -> str:
    return (value or "").strip().lower()


def looks_like_email(value: str) -> bool:
    v = (value or "").strip()
    return "@" in v and "." in v.split("@")[-1]


def normalize_phone(value: str) -> str:
    digits = "".join(c for c in (value or "") if c.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    return digits


def send_email(to_email: str, subject: str, body: str) -> None:
    to_email = to_email.strip().lower()
    if _resend_configured():
        api_key = os.getenv("RESEND_API_KEY", "")
        from_addr = (
            os.getenv("SMTP_FROM")
            or os.getenv("RESEND_FROM")
            or "FinanceFlow <onboarding@resend.dev>"
        )
        payload = json.dumps(
            {
                "from": from_addr,
                "to": [to_email],
                "subject": subject,
                "text": body,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status >= 400:
                    raise RuntimeError(resp.read().decode("utf-8", errors="ignore"))
        except urllib.error.HTTPError as exc:
            raise RuntimeError(exc.read().decode("utf-8", errors="ignore")) from exc
        return

    if not _smtp_configured():
        raise RuntimeError("Email is not configured (set SMTP_* or RESEND_API_KEY).")

    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("SMTP_FROM", user)
    use_tls = os.getenv("SMTP_TLS", "true").lower() in ("1", "true", "yes")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body)

    if use_tls:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.starttls(context=context)
            if user:
                server.login(user, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=30) as server:
            if user:
                server.login(user, password)
            server.send_message(msg)


def create_and_send_otp(
    db: Session,
    *,
    email: str,
    purpose: str,
) -> dict[str, Any]:
    email = normalize_identifier(email)
    if not looks_like_email(email):
        raise ValueError("Enter a valid email address.")

    code = generate_otp_code(6)
    row = EmailOtp(
        email=email,
        code=code,
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(row)
    db.commit()

    subject = "FinanceFlow verification code"
    body = (
        f"Your FinanceFlow verification code is: {code}\n\n"
        f"It expires in {OTP_TTL_MINUTES} minutes.\n"
        "If you did not request this, ignore this email."
    )

    mailed = False
    mail_error = None
    try:
        if email_delivery_ready():
            send_email(email, subject, body)
            mailed = True
    except Exception as exc:  # noqa: BLE001
        mail_error = str(exc)

    result: dict[str, Any] = {
        "ok": True,
        "email": email,
        "purpose": purpose,
        "expires_in_minutes": OTP_TTL_MINUTES,
        "mailed": mailed,
        "message": (
            "Verification code sent to your email."
            if mailed
            else "Email delivery is not configured; use the on-screen code for testing."
        ),
    }
    if not mailed:
        result["dev_code"] = code
        if mail_error:
            result["mail_error"] = mail_error
    return result


def verify_otp(
    db: Session,
    *,
    email: str,
    purpose: str,
    code: str,
    consume: bool = True,
) -> bool:
    email = normalize_identifier(email)
    code = (code or "").strip()
    if len(code) != 6 or not code.isdigit():
        return False

    row = (
        db.query(EmailOtp)
        .filter(
            EmailOtp.email == email,
            EmailOtp.purpose == purpose,
            EmailOtp.code == code,
            EmailOtp.consumed_at.is_(None),
            EmailOtp.expires_at >= datetime.utcnow(),
        )
        .order_by(EmailOtp.id.desc())
        .first()
    )
    if row is None:
        return False
    if consume:
        row.consumed_at = datetime.utcnow()
        db.commit()
    return True

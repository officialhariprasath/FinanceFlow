import os


def normalize_database_url(url: str | None) -> str | None:
    """Render/Heroku often provide postgres:// — SQLAlchemy needs postgresql://."""
    if not url:
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,https://finnect-finance-os.vercel.app",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


def is_production() -> bool:
    return os.getenv("RENDER") == "true" or os.getenv("ENVIRONMENT") == "production"

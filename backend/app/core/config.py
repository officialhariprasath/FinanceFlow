import os


def normalize_database_url(url: str | None) -> str | None:
    """Render/Heroku often provide postgres:// — SQLAlchemy needs postgresql://."""
    if not url:
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


# Capacitor Android/iOS WebView origins (androidScheme https → https://localhost).
# Always merged so the APK can call the API even if CORS_ORIGINS omits them.
_CAPACITOR_ORIGINS = (
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
    "ionic://localhost",
)


def cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,https://finance-flow-rho-ten.vercel.app,https://finnect-finance-os.vercel.app",
    )
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    for origin in _CAPACITOR_ORIGINS:
        if origin not in origins:
            origins.append(origin)
    return origins


def is_production() -> bool:
    return os.getenv("RENDER") == "true" or os.getenv("ENVIRONMENT") == "production"

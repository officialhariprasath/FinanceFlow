"""Shared API base URL for seed / smoke scripts."""

import os

DEFAULT_LOCAL = "http://127.0.0.1:8000"


def api_base() -> str:
    return (
        os.environ.get("FINNECT_API_BASE_URL")
        or os.environ.get("RENDER_EXTERNAL_URL")
        or DEFAULT_LOCAL
    ).rstrip("/")

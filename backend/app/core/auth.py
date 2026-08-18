"""
Authentication utilities.

Provides reusable authentication dependencies
for protected API endpoints.
"""

from backend.app.core.auth_context import (
    AuthContext,
    get_auth_context,
    get_current_finance_owner,
    require_permissions,
)

__all__ = [
    "AuthContext",
    "get_auth_context",
    "get_current_finance_owner",
    "require_permissions",
]

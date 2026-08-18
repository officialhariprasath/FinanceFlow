from backend.app.models.enums import AgentRole, Permission

ROLE_DEFAULT_PERMISSIONS: dict[str, list[str]] = {
    AgentRole.COLLECTION_AGENT.value: [
        Permission.DASHBOARD.value,
        Permission.COLLECTIONS.value,
        Permission.CUSTOMERS.value,
        Permission.LOANS.value,
        Permission.PAYMENTS.value,
        Permission.SETTLEMENTS.value,
    ],
    AgentRole.MANAGER.value: [
        Permission.DASHBOARD.value,
        Permission.COLLECTIONS.value,
        Permission.CUSTOMERS.value,
        Permission.LOANS.value,
        Permission.PAYMENTS.value,
        Permission.SETTLEMENTS.value,
        Permission.CAPITAL.value,
        Permission.PROFIT.value,
        Permission.AGENTS.value,
        Permission.LEDGER.value,
        Permission.EXPENSES.value,
        Permission.REPORTS.value,
    ],
    AgentRole.VIEWER.value: [
        Permission.DASHBOARD.value,
        Permission.COLLECTIONS.value,
        Permission.CUSTOMERS.value,
        Permission.LOANS.value,
    ],
}

ALL_PERMISSIONS = [p.value for p in Permission]


def resolve_permissions(role: str, custom: list[str] | None) -> list[str]:
    if custom:
        return [p for p in custom if p in ALL_PERMISSIONS]
    return ROLE_DEFAULT_PERMISSIONS.get(role, ROLE_DEFAULT_PERMISSIONS[AgentRole.VIEWER.value])

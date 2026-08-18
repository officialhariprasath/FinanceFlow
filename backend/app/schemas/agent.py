from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from datetime import datetime

from backend.app.models.enums import AgentRole, Permission


class AgentCreate(BaseModel):
    full_name: str
    phone: str
    email: EmailStr
    password: str
    role: str = AgentRole.COLLECTION_AGENT.value
    permissions: Optional[List[str]] = None
    is_active: bool = True
    assigned_area: Optional[str] = None

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value):
        return str(value).strip().upper()


class AgentUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None
    assigned_area: Optional[str] = None


class AgentResponse(BaseModel):
    id: int
    finance_owner_id: int
    full_name: str
    phone: str
    email: EmailStr
    role: str
    permissions: List[str]
    is_active: bool
    assigned_area: Optional[str] = None
    joined_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AgentLoginResponse(BaseModel):
    access_token: str
    token_type: str
    actor_type: str
    display_name: str
    permissions: List[str]


class SessionResponse(BaseModel):
    actor_type: str
    display_name: str
    finance_owner_id: int
    agent_id: Optional[int] = None
    permissions: List[str]
    is_owner: bool


class PermissionOption(BaseModel):
    key: str
    label: str


PERMISSION_OPTIONS = [
    PermissionOption(key=Permission.DASHBOARD.value, label="Dashboard"),
    PermissionOption(key=Permission.COLLECTIONS.value, label="Collections"),
    PermissionOption(key=Permission.CUSTOMERS.value, label="Customers"),
    PermissionOption(key=Permission.LOANS.value, label="Loans"),
    PermissionOption(key=Permission.PAYMENTS.value, label="Payments"),
    PermissionOption(key=Permission.CAPITAL.value, label="Capital"),
    PermissionOption(key=Permission.PROFIT.value, label="Profit"),
    PermissionOption(key=Permission.AGENTS.value, label="Agents"),
    PermissionOption(key=Permission.SETTLEMENTS.value, label="Settlements"),
    PermissionOption(key=Permission.SETTINGS.value, label="Settings"),
]

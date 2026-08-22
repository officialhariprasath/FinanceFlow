export interface Agent {
  id: number;
  finance_owner_id: number;
  full_name: string;
  phone: string;
  email: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  assigned_area?: string | null;
  joined_at?: string | null;
}

export interface AgentCreate {
  full_name: string;
  phone: string;
  email: string;
  password: string;
  role: string;
  permissions?: string[];
  is_active?: boolean;
  assigned_area?: string;
  otp_code?: string;
}

export interface AgentUpdate {
  full_name?: string;
  phone?: string;
  email?: string;
  password?: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
  assigned_area?: string;
}

export interface SessionInfo {
  actor_type: string;
  display_name: string;
  finance_owner_id: number;
  agent_id?: number | null;
  permissions: string[];
  is_owner: boolean;
}

export interface PermissionOption {
  key: string;
  label: string;
}

export const ROLE_LABELS: Record<string, string> = {
  COLLECTION_AGENT: "Collection Agent",
  MANAGER: "Manager",
  VIEWER: "Viewer",
};

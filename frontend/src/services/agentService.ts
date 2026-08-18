import api from "../api/axios";
import type {
  Agent,
  AgentCreate,
  AgentUpdate,
  PermissionOption,
  SessionInfo,
} from "../types/agent";

export async function agentLogin(email: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const response = await api.post("/agents/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
}

export async function getSession(): Promise<SessionInfo> {
  const response = await api.get<SessionInfo>("/agents/session");
  return response.data;
}

export async function getAgents(): Promise<Agent[]> {
  const response = await api.get<Agent[]>("/agents/");
  return response.data;
}

export async function createAgent(payload: AgentCreate): Promise<Agent> {
  const response = await api.post<Agent>("/agents/", payload);
  return response.data;
}

export async function updateAgent(
  id: number,
  payload: AgentUpdate
): Promise<Agent> {
  const response = await api.put<Agent>(`/agents/${id}`, payload);
  return response.data;
}

export async function deleteAgent(id: number): Promise<void> {
  await api.delete(`/agents/${id}`);
}

export async function getPermissionOptions(): Promise<PermissionOption[]> {
  const response = await api.get<PermissionOption[]>(
    "/agents/permissions/options"
  );
  return response.data;
}

export async function getRolePresets(): Promise<Record<string, string[]>> {
  const response = await api.get<Record<string, string[]>>(
    "/agents/roles/presets"
  );
  return response.data;
}

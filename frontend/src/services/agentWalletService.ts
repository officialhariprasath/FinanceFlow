import api from "../api/axios";
import type {
  AgentDashboard,
  AgentLedgerEntry,
  AgentSettlement,
  AgentSettlementCreate,
  AgentWalletBalance,
} from "../types/agentWallet";

export async function getMyWallet(): Promise<AgentWalletBalance> {
  const r = await api.get<AgentWalletBalance>("/agent-wallet/me");
  return r.data;
}

export async function getMyLedger(): Promise<AgentLedgerEntry[]> {
  const r = await api.get<AgentLedgerEntry[]>("/agent-wallet/me/ledger");
  return r.data;
}

export async function getAgentDashboard(): Promise<AgentDashboard> {
  const r = await api.get<AgentDashboard>("/agent-wallet/me/dashboard");
  return r.data;
}

export async function listAgentWallets(): Promise<AgentWalletBalance[]> {
  const r = await api.get<AgentWalletBalance[]>("/agent-wallet/agents");
  return r.data;
}

export async function submitSettlement(
  payload: AgentSettlementCreate
): Promise<AgentSettlement> {
  const r = await api.post<AgentSettlement>("/agent-settlements/", payload);
  return r.data;
}

export async function getMySettlements(): Promise<AgentSettlement[]> {
  const r = await api.get<AgentSettlement[]>("/agent-settlements/me");
  return r.data;
}

export async function getPendingSettlements(): Promise<AgentSettlement[]> {
  const r = await api.get<AgentSettlement[]>("/agent-settlements/pending");
  return r.data;
}

export async function getAllSettlements(status?: string): Promise<AgentSettlement[]> {
  const r = await api.get<AgentSettlement[]>("/agent-settlements/", {
    params: status ? { status } : undefined,
  });
  return r.data;
}

export async function approveSettlement(id: number): Promise<AgentSettlement> {
  const r = await api.post<AgentSettlement>(`/agent-settlements/${id}/approve`);
  return r.data;
}

export async function rejectSettlement(
  id: number,
  reason: string
): Promise<AgentSettlement> {
  const r = await api.post<AgentSettlement>(`/agent-settlements/${id}/reject`, {
    reason,
  });
  return r.data;
}

export async function assignCustomersToAgent(
  agentId: number,
  customerIds: number[]
): Promise<void> {
  await api.post(`/agents/${agentId}/assignments`, { customer_ids: customerIds });
}

export async function getAgentAssignments(agentId: number) {
  const r = await api.get(`/agents/${agentId}/assignments`);
  return r.data;
}

export async function removeAgentAssignment(
  agentId: number,
  customerId: number
): Promise<void> {
  await api.delete(`/agents/${agentId}/assignments/${customerId}`);
}

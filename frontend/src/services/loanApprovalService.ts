import api from "../api/axios";
import type {
  LoanApproval,
  LoanApprovalCreate,
  LoanApprovalFlags,
} from "../types/loanApproval";

export async function getLoanApprovalFlags(): Promise<LoanApprovalFlags> {
  const { data } = await api.get<LoanApprovalFlags>("/loan-approvals/require-flag");
  return data;
}

export async function getPendingApprovalCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>("/loan-approvals/pending-count");
  return data.count ?? 0;
}

export async function listLoanApprovals(
  status?: string
): Promise<LoanApproval[]> {
  const { data } = await api.get<LoanApproval[]>("/loan-approvals/", {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function getLoanApproval(id: number): Promise<LoanApproval> {
  const { data } = await api.get<LoanApproval>(`/loan-approvals/${id}`);
  return data;
}

export async function submitLoanApproval(
  payload: LoanApprovalCreate
): Promise<LoanApproval> {
  const { data } = await api.post<LoanApproval>("/loan-approvals/", payload);
  return data;
}

export async function approveLoanRequest(id: number): Promise<LoanApproval> {
  const { data } = await api.post<LoanApproval>(`/loan-approvals/${id}/approve`);
  return data;
}

export async function rejectLoanRequest(
  id: number,
  reason: string
): Promise<LoanApproval> {
  const { data } = await api.post<LoanApproval>(`/loan-approvals/${id}/reject`, {
    reason,
  });
  return data;
}

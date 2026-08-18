import api from "../api/axios";
import type {
  CapitalAddRequest,
  CapitalSummary,
  CapitalTransaction,
  CapitalTransactionList,
} from "../types/capital";

export async function getCapitalSummary(): Promise<CapitalSummary> {
  const response = await api.get<CapitalSummary>("/capital/summary");
  return response.data;
}

export async function getCapitalTransactions(): Promise<CapitalTransactionList> {
  const response = await api.get<CapitalTransactionList>("/capital/transactions");
  return response.data;
}

export async function addCapital(
  payload: CapitalAddRequest
): Promise<CapitalTransaction> {
  const response = await api.post<CapitalTransaction>("/capital/add", payload);
  return response.data;
}

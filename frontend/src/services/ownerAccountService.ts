import api from "../api/axios";
import type {
  OwnerAccountActionResult,
  OwnerAccountSummary,
  OwnerAccountTransaction,
} from "../types/ownerAccount";

export async function getOwnerAccountSummary(): Promise<OwnerAccountSummary> {
  const r = await api.get<OwnerAccountSummary>("/owner-account/summary");
  return r.data;
}

export async function getOwnerAccountTransactions(): Promise<
  OwnerAccountTransaction[]
> {
  const r = await api.get<OwnerAccountTransaction[]>("/owner-account/transactions");
  return r.data;
}

export async function moveOwnerPrincipalToCapital(
  amount: string,
  description?: string
): Promise<OwnerAccountActionResult> {
  const r = await api.post<OwnerAccountActionResult>(
    "/owner-account/move-to-capital",
    { amount, description }
  );
  return r.data;
}

export async function withdrawOwnerProfit(
  amount: string,
  description?: string
): Promise<OwnerAccountActionResult> {
  const r = await api.post<OwnerAccountActionResult>(
    "/owner-account/withdraw-profit",
    { amount, description }
  );
  return r.data;
}

export async function reinvestOwnerProfit(
  amount: string,
  description?: string
): Promise<OwnerAccountActionResult> {
  const r = await api.post<OwnerAccountActionResult>(
    "/owner-account/reinvest-profit",
    { amount, description }
  );
  return r.data;
}

export async function withdrawOwnerCash(
  amount: string,
  description?: string
): Promise<OwnerAccountActionResult> {
  const r = await api.post<OwnerAccountActionResult>(
    "/owner-account/withdraw-cash",
    { amount, description }
  );
  return r.data;
}

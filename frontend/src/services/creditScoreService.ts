import api from "../api/axios";
import type { CreditScore } from "../types/creditScore";

export async function getCustomerCreditScore(customerId: number): Promise<CreditScore> {
  const res = await api.get<CreditScore>(`/credit-score/customers/${customerId}`);
  return res.data;
}

export async function refreshCustomerCreditScore(customerId: number): Promise<CreditScore> {
  const res = await api.post<CreditScore>(`/credit-score/customers/${customerId}/refresh`);
  return res.data;
}

export async function recalibrateCreditScorecard(): Promise<{
  version: string;
  source: string;
  labeled_rows: number;
  good: number;
  bad: number;
}> {
  const res = await api.post("/credit-score/recalibrate");
  return res.data;
}

import api from "../api/axios";
import type { LoanRenewalResponse, LoanRenewalCreate } from "../types/renewal";

export async function renewLoan(
  loanId: number,
  data: LoanRenewalCreate
): Promise<LoanRenewalResponse> {
  const response = await api.post<LoanRenewalResponse>(
    `/loan/${loanId}/renew`,
    data
  );
  return response.data;
}

export async function getLoanRenewals(
  loanId: number
): Promise<LoanRenewalResponse[]> {
  const response = await api.get<LoanRenewalResponse[]>(
    `/loan/${loanId}/renewals`
  );
  return response.data;
}

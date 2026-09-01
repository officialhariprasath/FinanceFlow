import api from "../api/axios";
import type {
  LoanResponse,
  LoanCreate,
  LoanUpdate,
  LoanStatementResponse,
  InterestSummaryResponse,
  SettlementPreviewResponse,
  SettlementRequest,
  UnpaidSchedule,
} from "../types/loan";

export async function getLoans(): Promise<LoanResponse[]> {
  const response = await api.get<LoanResponse[]>("/loans/");
  return response.data;
}

export async function getLoanById(loanId: number): Promise<LoanResponse> {
  const response = await api.get<LoanResponse>(`/loans/${loanId}`);
  return response.data;
}

export async function createLoan(data: LoanCreate): Promise<LoanResponse> {
  const response = await api.post<LoanResponse>("/loans/", data);
  return response.data;
}

export async function updateLoan(
  loanId: number,
  data: LoanUpdate
): Promise<LoanResponse> {
  const response = await api.put<LoanResponse>(`/loans/${loanId}`, data);
  return response.data;
}

export async function getCustomerLoans(
  customerId: number
): Promise<LoanResponse[]> {
  const response = await api.get<LoanResponse[]>(
    `/loans/customer/${customerId}`
  );
  return response.data;
}

export async function searchLoans(params: {
  mobile_number?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}): Promise<LoanResponse[]> {
  const response = await api.get<LoanResponse[]>("/loans/search", { params });
  return response.data;
}

export async function getLoanStatement(
  loanId: number
): Promise<LoanStatementResponse> {
  const response = await api.get<LoanStatementResponse>(
    `/loans/${loanId}/statement`
  );
  return response.data;
}

export async function getUnpaidSchedules(loanId: number): Promise<UnpaidSchedule[]> {
  const response = await api.get<UnpaidSchedule[]>(
    `/loans/${loanId}/schedules/unpaid`
  );
  return response.data;
}

export async function getLoanSchedules(loanId: number): Promise<UnpaidSchedule[]> {
  const response = await api.get<UnpaidSchedule[]>(`/loans/${loanId}/schedules`);
  return response.data;
}

export async function getInterestSummary(
  loanId: number
): Promise<InterestSummaryResponse> {
  const response = await api.get<InterestSummaryResponse>(
    `/loans/${loanId}/interest-summary`
  );
  return response.data;
}

export async function getSettlementPreview(
  loanId: number,
  settlement_date: string
): Promise<SettlementPreviewResponse> {
  const response = await api.get<SettlementPreviewResponse>(
    `/loans/${loanId}/settlement-preview`,
    { params: { settlement_date } }
  );
  return response.data;
}

export async function settleLoan(
  loanId: number,
  data: SettlementRequest
): Promise<LoanResponse> {
  const response = await api.post<LoanResponse>(
    `/loans/${loanId}/settlement`,
    data
  );
  return response.data;
}

export async function getLoansDueThisMonth(): Promise<LoanResponse[]> {
  const response = await api.get<LoanResponse[]>("/loans/due-this-month");
  return response.data;
}

export async function getLoansDueByMonth(
  month: number,
  year: number
): Promise<LoanResponse[]> {
  const response = await api.get<LoanResponse[]>("/loans/due", {
    params: { month, year },
  });
  return response.data;
}

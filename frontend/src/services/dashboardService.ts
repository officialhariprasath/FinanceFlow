import api from "../api/axios";
import type {
  DashboardResponse,
  ProfitSummaryResponse,
  MaturityReportResponse,
  OverdueLoansResponse,
  ClosedLoansReportResponse,
} from "../types/dashboard";

export async function getDashboard(): Promise<DashboardResponse> {
  const response = await api.get<DashboardResponse>("/dashboard");
  return response.data;
}

export async function getProfitSummary(
  from_date: string,
  to_date: string
): Promise<ProfitSummaryResponse> {
  const response = await api.get<ProfitSummaryResponse>(
    "/dashboard/profit-summary",
    { params: { from_date, to_date } }
  );
  return response.data;
}

export async function getMaturityReport(
  month: number,
  year: number
): Promise<MaturityReportResponse> {
  const response = await api.get<MaturityReportResponse>(
    "/dashboard/maturity-report",
    { params: { month, year } }
  );
  return response.data;
}

export async function getOverdueLoans(): Promise<OverdueLoansResponse> {
  const response = await api.get<OverdueLoansResponse>(
    "/dashboard/overdue-loans"
  );
  return response.data;
}

export async function getClosedLoans(params?: {
  from_date?: string;
  to_date?: string;
  closure_type?: string;
}): Promise<ClosedLoansReportResponse> {
  const response = await api.get<ClosedLoansReportResponse>(
    "/dashboard/closed-loans",
    { params }
  );
  return response.data;
}

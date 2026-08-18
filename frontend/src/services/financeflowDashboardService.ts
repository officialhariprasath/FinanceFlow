import api from "../api/axios";
import type { FinanceFlowDashboard } from "../types/financeflowDashboard";

export async function getFinanceFlowDashboard(): Promise<FinanceFlowDashboard> {
  const response = await api.get<FinanceFlowDashboard>(
    "/dashboard/financeflow"
  );
  return response.data;
}

import api from "../api/axios";

export type LoanProductInput = {
  product_id: string;
  name: string;
  principal: number;
  installment_amount: number;
  installment_principal: number;
  installment_profit: number;
  installment_count: number;
  frequency: string;
  custom_interval_days?: number;
  profit_model?: string;
  same_day_collection?: boolean;
  weight?: number;
};

export type SimulationRunRequest = {
  simulation_mode: "CURRENT_BUSINESS" | "HYPOTHETICAL";
  capital_source: string;
  manual_starting_capital: number;
  additional_capital: number;
  products: LoanProductInput[];
  reinvestment: { percentage: number; mode: string };
  withdrawal: { percentage: number; start_day: number; frequency?: string };
  target: { target_type: string; target_value: number; monthly_method?: string };
  simulation_days: number;
  start_date?: string;
  risk: {
    preset: string;
    collection_efficiency: number;
    idle_cash_percent: number;
    operating_expense_per_day: number;
    agent_commission_percent: number;
  };
  deploy_on_start_day: boolean;
  scenario_name: string;
  include_daily: boolean;
  include_aggregates: boolean;
  max_daily_rows: number;
};

export type SimulationResult = {
  summary: {
    target_type: string;
    target_value: number;
    target_status: string;
    target_day: number | null;
    target_date: string | null;
    days_required: number | null;
    active_loans_at_target: number | null;
    daily_collection_at_target: number | null;
    daily_profit_at_target: number | null;
    monthly_profit_at_target: number | null;
    reinvestment_pct: number;
    owner_withdrawal_at_target: number | null;
    portfolio_at_target: number | null;
    available_cash_at_target: number | null;
    cumulative_profit_at_target: number | null;
    max_target_metric: number;
    max_target_day: number;
  };
  snapshot: {
    snapshot_date: string;
    available_cash: number;
    outstanding_principal: number;
    active_loan_count: number;
    products: Record<string, unknown>[];
  };
  days: Array<{
    date: string;
    day: number;
    starting_cash: number;
    active_loans: number;
    loans_completing: number;
    collection: number;
    principal_recovery: number;
    profit: number;
    reinvested_amount: number;
    withdrawn_profit: number;
    new_loans: number;
    capital_deployed: number;
    ending_cash: number;
    outstanding_principal: number;
    total_portfolio: number;
    cumulative_profit: number;
    daily_profit_x30: number;
    target_metric: number;
    target_progress_pct: number;
    target_reached: boolean;
    explain?: Record<string, unknown>;
  }>;
  weekly: Record<string, unknown>[];
  monthly: Record<string, unknown>[];
  message: string;
  read_only: boolean;
};

export async function fetchSimulationSnapshot() {
  const { data } = await api.get("/simulation/snapshot");
  return data;
}

export async function runSimulation(body: SimulationRunRequest): Promise<SimulationResult> {
  const { data } = await api.post<SimulationResult>("/simulation/run", body);
  return data;
}

export async function compareSimulations(scenarios: SimulationRunRequest[]) {
  const { data } = await api.post("/simulation/compare", { scenarios });
  return data;
}

export interface FinanceFlowDashboard {
  capital_added: string;
  available_capital: string;
  ledger_capital?: string;
  available_to_lend?: string;
  capital_with_agents?: string;
  profit_with_agents?: string;
  penalty_with_agents?: string;
  capital_currently_lent: string;
  principal_outstanding: string;
  profit_today: string;
  profit_this_month: string;
  total_profit: string;
  available_profit: string;
  active_loans: number;
  completed_loans: number;
  overdue_loans: number;
  total_borrowers: number;
  expected_today: string;
  collected_today: string;
  pending_today: string;
  collection_rate: string;
  unsettled_with_agents: string;
  pending_settlement_count: number;
  pending_settlement_total: string;
  over_lent_against_unsettled?: boolean;
}

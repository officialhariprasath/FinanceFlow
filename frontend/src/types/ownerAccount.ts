export interface OwnerAccountSummary {
  principal_balance: string;
  profit_balance: string;
  penalty_balance?: string;
  total_balance: string;
  currency: string;
  available_to_lend: string;
  capital_with_agents: string;
  profit_with_agents: string;
  penalty_with_agents?: string;
  unsettled_with_agents: string;
  ledger_capital: string;
  total_capital_added: string;
  capital_currently_lent: string;
  available_profit_ledger: string;
  total_penalty_earned?: string;
  over_lent_against_unsettled?: boolean;
  notes: string;
}

export interface OwnerAccountTransaction {
  id: number;
  type: string;
  direction: string;
  amount: string;
  principal_amount: string;
  profit_amount: string;
  penalty_amount?: string;
  principal_balance_after: string;
  profit_balance_after: string;
  penalty_balance_after?: string;
  reference_type?: string | null;
  reference_id?: number | null;
  description?: string | null;
  created_by: number;
  created_at: string;
}

export interface OwnerAccountActionResult {
  transaction: OwnerAccountTransaction;
  summary: OwnerAccountSummary;
}

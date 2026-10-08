export interface CapitalSummary {
  available_capital: string;
  ledger_capital?: string;
  available_to_lend?: string;
  capital_with_agents?: string;
  profit_with_agents?: string;
  penalty_with_agents?: string;
  unsettled_with_agents?: string;
  capital_with_owner?: string;
  total_capital_added: string;
  capital_currently_lent: string;
  currency: string;
  transaction_count: number;
  over_lent_against_unsettled?: boolean;
}

export interface CapitalTransaction {
  id: number;
  type: string;
  amount: string;
  direction: string;
  reference_type?: string | null;
  reference_id?: number | null;
  description?: string | null;
  balance_after: string;
  created_by: number;
  created_at: string;
}

export interface CapitalTransactionList {
  transactions: CapitalTransaction[];
  available_capital: string;
  available_to_lend?: string;
  capital_with_agents?: string;
}

export interface CapitalAddRequest {
  amount: string;
  description?: string;
  confirm_settlement_recycle?: boolean;
}

export interface CapitalRepairPreview {
  repair_needed: boolean;
  entries: Array<{
    capital_transaction_id: number;
    amount: string;
    description?: string | null;
    created_at: string;
  }>;
  total_to_reverse: string;
  message: string;
  applied?: boolean;
  before?: CapitalSummary;
  after?: CapitalSummary;
}

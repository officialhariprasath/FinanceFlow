export interface CapitalSummary {
  available_capital: string;
  total_capital_added: string;
  capital_currently_lent: string;
  currency: string;
  transaction_count: number;
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
}

export interface CapitalAddRequest {
  amount: string;
  description?: string;
}

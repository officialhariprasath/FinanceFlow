export interface AgentWalletBalance {
  agent_id?: number;
  agent_name?: string;
  assigned_area?: string | null;
  cash_balance: string;
  upi_balance: string;
  other_balance: string;
  total_balance: string;
  today_collected?: string;
  unsettled_balance?: string;
  pending_settlement_total?: string;
  has_pending_settlement?: boolean;
  status?: string;
}

export interface AgentLedgerEntry {
  id: number;
  entry_type: string;
  channel: string;
  credit_amount: string;
  debit_amount: string;
  balance_after: string;
  payment_id?: number | null;
  settlement_id?: number | null;
  payment_reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface AgentSettlement {
  id: number;
  agent_id: number;
  agent_name?: string | null;
  status: string;
  cash_amount: string;
  upi_amount: string;
  other_amount: string;
  total_amount: string;
  delivery_method: string;
  delivery_cash_amount: string;
  delivery_upi_amount: string;
  delivery_other_amount: string;
  transfer_reference?: string | null;
  transfer_date?: string | null;
  proof_notes?: string | null;
  rejection_reason?: string | null;
  reconciliation_note?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  principal_unlocked?: string | null;
  profit_amount?: string | null;
  penalty_amount?: string | null;
  profit_reinvested?: string | null;
  reinvest_profit?: boolean | null;
}

export interface AgentSettlementApprovalPreview {
  settlement_id: number;
  agent_id: number;
  total_amount: string;
  principal_amount: string;
  profit_amount: string;
  penalty_amount?: string;
  status: string;
  message: string;
}

export interface AgentSettlementCreate {
  cash_amount: string;
  upi_amount: string;
  other_amount: string;
  delivery_method: string;
  delivery_cash_amount: string;
  delivery_upi_amount: string;
  delivery_other_amount: string;
  transfer_reference?: string;
  transfer_date?: string;
  proof_notes?: string;
  reconciliation_note?: string;
}

export type SettlementDeliveryMethod = "CASH" | "UPI" | "BANK" | "MIXED";

export interface AgentDashboard {
  expected_today: string;
  collected_today: string;
  pending_today: string;
  wallet: AgentWalletBalance;
  reconciliation_difference: string;
  is_balanced: boolean;
}

export interface AgentAssignment {
  agent_id: number;
  customer_id: number;
  customer_name?: string;
}

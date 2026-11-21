export type LoanApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LoanApprovalCreate {
  customer_id: number;
  principal_amount: string | number;
  interest_rate?: string | number;
  collection_frequency: string;
  installment_count: number;
  issue_date: string;
  due_start_date: string;
  daily_payment?: string | number;
  daily_principal?: string | number;
  daily_profit?: string | number;
  collection_agent_id?: number;
  notes?: string;
}

export interface LoanApproval {
  id: number;
  finance_owner_id: number;
  customer_id: number;
  customer_name?: string | null;
  customer_display_code?: string | null;
  customer_phone?: string | null;
  status: LoanApprovalStatus | string;
  principal_amount: string | number;
  interest_rate: string | number;
  collection_frequency: string;
  installment_count: number;
  issue_date: string;
  due_start_date: string;
  daily_payment?: string | number | null;
  daily_principal?: string | number | null;
  daily_profit?: string | number | null;
  collection_agent_id?: number | null;
  collection_agent_name?: string | null;
  submitted_by_agent_id?: number | null;
  submitted_by_name?: string | null;
  reviewed_by_agent_id?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_loan_id?: number | null;
  notes?: string | null;
  created_at?: string | null;
  credit_score?: number | null;
  credit_band?: string | null;
}

export interface LoanApprovalFlags {
  require_approval: boolean;
  can_approve: boolean;
  can_create_live: boolean;
  can_submit: boolean;
}

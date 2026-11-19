export interface LedgerPayment {
  payment_date: string;
  amount_paid: string;
  principal_paid: string;
  interest_paid: string;
  payment_mode: string;
  remarks: string;
}

export interface LedgerLoan {
  loan_id: number;
  principal_amount: string;
  remaining_principal: string;
  total_principal_paid: string;
  total_interest_paid: string;
  accrued_interest: string;
  total_outstanding: string;
  issue_date: string;
  due_date: string;
  status: string;
  payments: LedgerPayment[];
}

export interface LedgerCustomer {
  id: number;
  full_name: string;
  phone: string;
  permanent_address?: string | null;
  temporary_address?: string | null;
}

export interface LedgerSummary {
  total_loans: number;
  active_loans: number;
  closed_loans: number;
  total_principal: string;
  remaining_principal: string;
  total_interest_paid: string;
  accrued_interest: string;
  total_outstanding: string;
}

export interface LedgerCreditScore {
  score: number;
  band: string;
  file_type: string;
  suggested_max_amount: string;
  reasons?: { code: string; label: string; points: number; feature?: string }[];
  scorecard_version?: string | null;
  computed_at?: string | null;
  advisory_only?: boolean;
}

export interface CustomerLedger {
  customer: LedgerCustomer;
  summary: LedgerSummary;
  loans: LedgerLoan[];
  credit_score?: LedgerCreditScore | null;
}
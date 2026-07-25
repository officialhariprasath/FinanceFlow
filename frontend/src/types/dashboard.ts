export interface RecentLoan {
  id: number;
  customer_id: number;
  principal_amount: string;
  remaining_principal: string;
  total_principal_paid: string;
  total_interest_paid: string;
  interest_method: string;
  interest_rate: string;
  issue_date: string;
  due_date: string;
  interest_start_date: string;
  last_interest_calculated_on: string;
  status: string;
  settlement_amount: string | null;
  waived_amount: string | null;
  settlement_date: string | null;
  settlement_reason: string | null;
  closure_type: string | null;
}

export interface RecentPayment {
  id: number;
  loan_id: number;
  finance_owner_id: number;
  payment_date: string;
  amount_paid: string;
  interest_paid: string;
  principal_paid: string;
  payment_mode: string;
  remarks: string | null;
  created_at: string;
}

export interface DashboardResponse {
  total_customers: number;
  active_loans: number;
  closed_loans: number;

  total_principal_disbursed: string;
  remaining_principal: string;
  total_principal_paid: string;
  total_interest_paid: string;
  today_collection: string;

  recent_loans: RecentLoan[];
  recent_payments: RecentPayment[];
}
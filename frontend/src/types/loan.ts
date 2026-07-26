export type InterestMethod = "PERCENTAGE" | "RUPEES_PER_100";
export type LoanStatus = "ACTIVE" | "CLOSED" | "RENEWED";

export interface LoanResponse {
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

export interface LoanCreate {
  customer_id: number;
  principal_amount: string;
  interest_method: string;
  interest_rate: string;
  issue_date: string;
  due_date: string;
}

export interface LoanUpdate {
  interest_method: string;
  interest_rate: string;
  due_date: string;
}

export interface LoanStatementPayment {
  payment_date: string;
  amount_paid: string;
  principal_paid: string;
  interest_paid: string;
  payment_mode: string;
  remarks: string | null;
}

export interface LoanStatementResponse {
  loan: LoanResponse;
  customer_name: string;
  customer_phone: string;
  accrued_interest: string;
  total_outstanding: string;
  payments: LoanStatementPayment[];
}

export interface InterestSummaryResponse {
  loan_id: number;
  principal_amount: string;
  remaining_principal: string;
  interest_method: string;
  interest_rate: string;
  accrued_interest: string;
  total_payable: string;
  calculated_to: string;
}

export interface SettlementPreviewResponse {
  loan_id: number;
  customer_name: string;
  principal_outstanding: string;
  interest_outstanding: string;
  total_outstanding: string;
}

export interface SettlementRequest {
  settlement_amount: string;
  settlement_date: string;
  payment_mode: string;
  settlement_reason?: string;
}

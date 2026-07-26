import type { LoanResponse } from "./loan";
import type { PaymentResponse } from "./payment";

export interface DashboardResponse {
  total_customers: number;
  active_loans: number;
  closed_loans: number;
  total_principal_disbursed: string;
  remaining_principal: string;
  total_principal_paid: string;
  total_interest_paid: string;
  today_collection: string;
  recent_loans: LoanResponse[];
  recent_payments: PaymentResponse[];
}

export interface ProfitSummaryResponse {
  total_principal: string;
  total_interest: string;
  total_amount: string;
  loan_count: number;
}

export interface MaturityLoanResponse {
  loan_id: number;
  customer_name: string;
  mobile_number: string;
  principal_amount: string;
  remaining_principal: string;
  issue_date: string;
  due_date: string;
  status: string;
}

export interface MaturityReportResponse {
  month: number;
  year: number;
  loan_count: number;
  loans: MaturityLoanResponse[];
}

export interface OverdueLoanResponse {
  loan_id: number;
  customer_name: string;
  mobile_number: string;
  due_date: string;
  days_overdue: number;
  remaining_principal: string;
  status: string;
}

export interface OverdueLoansResponse {
  overdue_count: number;
  total_overdue_principal: string;
  loans: OverdueLoanResponse[];
}

export interface ClosedLoanResponse {
  loan_id: number;
  customer_name: string;
  mobile_number: string;
  principal_amount: string;
  total_principal_paid: string;
  total_interest_paid: string;
  settlement_amount: string | null;
  waived_amount: string | null;
  closure_type: string;
  closed_date: string | null;
}

export interface ClosedLoansReportResponse {
  loan_count: number;
  loans: ClosedLoanResponse[];
}

// Keep backward-compat aliases used by existing components
export type RecentLoan = LoanResponse;
export type RecentPayment = PaymentResponse;

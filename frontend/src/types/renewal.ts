export interface LoanRenewalResponse {
  id: number;
  old_loan_id: number;
  new_loan_id: number | null;
  finance_owner_id: number;
  renewal_type: string;
  old_due_date: string;
  new_due_date: string;
  old_interest_method: string;
  new_interest_method: string;
  old_interest_rate: string;
  new_interest_rate: string;
  remaining_principal: string;
  outstanding_interest: string;
  new_principal: string;
  remarks: string | null;
  renewed_at: string;
}

export interface LoanRenewalCreate {
  renewal_type: "CONTINUE" | "CAPITALIZE";
  new_due_date: string;
  interest_method: "PERCENTAGE" | "RUPEES_PER_100";
  interest_rate: string;
  remarks?: string;
}

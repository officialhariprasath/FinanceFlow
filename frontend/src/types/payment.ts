export interface PaymentResponse {
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
  profit_amount?: string | null;
}

export interface PaymentCreate {
  loan_id: number;
  payment_date: string;
  amount_paid: string;
  payment_mode: string;
  remarks?: string;
  payment_reference?: string;
  schedule_dates?: string[];
}

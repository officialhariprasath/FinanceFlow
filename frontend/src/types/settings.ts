export interface FinanceSettings {
  id: number;
  finance_owner_id: number;
  business_name: string | null;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  default_interest_method: string | null;
  default_interest_rate: string | null;
  default_loan_duration: number | null;
  default_grace_period: number | null;
  currency: string | null;
  date_format: string | null;
  timezone: string | null;
  maturity_alert_days: number | null;
  daily_grace_installments?: number | null;
  daily_penalty_per_installment?: string | null;
  weekly_grace_installments?: number | null;
  weekly_penalty_per_installment?: string | null;
  bi_weekly_grace_installments?: number | null;
  bi_weekly_penalty_per_installment?: string | null;
  monthly_grace_installments?: number | null;
  monthly_penalty_per_installment?: string | null;
}

export type FinanceSettingsUpdate = Partial<Omit<FinanceSettings, "id" | "finance_owner_id">>;

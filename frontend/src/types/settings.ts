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
}

export type FinanceSettingsUpdate = Partial<Omit<FinanceSettings, "id" | "finance_owner_id">>;

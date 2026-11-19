export interface CreditScoreReason {
  code: string;
  label: string;
  points: number;
  feature?: string | null;
}

export interface CreditScore {
  customer_id?: number;
  score: number;
  band: string;
  file_type: string;
  suggested_max_amount: string;
  reasons: CreditScoreReason[];
  features?: Record<string, unknown>;
  scorecard_version?: string | null;
  computed_at?: string | null;
  advisory_only?: boolean;
}

export type CreditScoreBand =
  | "THIN_FILE"
  | "POOR"
  | "FAIR"
  | "GOOD"
  | "EXCELLENT";

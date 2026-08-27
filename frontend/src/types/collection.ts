export interface CollectionItem {
  loan_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  schedule_date: string;
  expected_amount: string;
  paid_amount: string;
  pending_amount: string;
  overdue_pending_amount?: string;
  expected_principal: string;
  expected_profit: string;
  status: string;
  is_assigned_to_agent?: boolean;
}

export interface CollectionSummary {
  date: string;
  expected_collection: string;
  collected: string;
  pending: string;
  overdue_pending?: string;
  collection_rate: string;
  overdue_count: number;
  unassigned_due_count?: number;
  unassigned_due_total?: string;
  unassigned_borrower_names?: string[];
  items: CollectionItem[];
}

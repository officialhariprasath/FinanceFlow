import api from "../api/axios";

export interface ProfitTransaction {
  id: number;
  type: string;
  amount: string;
  direction: string;
  reference_type?: string;
  reference_id?: number;
  description?: string;
  balance_after: string;
  created_by: number;
  created_at: string;
}

export interface NetProfitSummary {
  gross_profit: string;
  total_expenses: string;
  net_profit: string;
  available_profit: string;
}

export interface Expense {
  id: number;
  category: string;
  amount: string;
  description?: string;
  funding_source?: string;
  profit_transaction_id?: number;
  capital_transaction_id?: number;
  created_at: string;
}

export interface LedgerEntry {
  ledger: string;
  id: number;
  type: string;
  direction: string;
  amount: string;
  balance_after: string;
  description?: string;
  reference_type?: string;
  reference_id?: number;
  created_at: string;
}

export interface Reconciliation {
  capital_available: string;
  capital_lent: string;
  total_capital_added: string;
  profit_available: string;
  gross_profit: string;
  total_expenses: string;
  net_profit: string;
  unsettled_with_agents: string;
  pending_settlement_total: string;
  pending_settlement_count: number;
  is_balanced: boolean;
  notes: string;
}

export interface OverdueLoan {
  loan_id: number;
  customer_name: string;
  schedule_date: string;
  expected_amount: string;
  paid_amount: string;
  pending_amount: string;
}

export interface AuditLog {
  id: number;
  actor_type: string;
  actor_id?: number;
  action: string;
  entity_type?: string;
  entity_id?: number;
  details?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  level: string;
  is_read: boolean;
  action_url?: string | null;
  created_at: string;
}

export async function getProfitSummary(): Promise<{
  available_profit: string;
  total_profit_earned: string;
  currency: string;
  transaction_count: number;
}> {
  const res = await api.get("/profit/summary");
  return res.data;
}

export async function getProfitTransactions(): Promise<ProfitTransaction[]> {
  const res = await api.get<ProfitTransaction[]>("/profit/transactions");
  return res.data;
}

export async function withdrawProfit(amount: string, description?: string) {
  const res = await api.post("/profit/withdraw", { amount, description });
  return res.data;
}

export async function reinvestProfit(amount: string, description?: string) {
  const res = await api.post("/profit/reinvest", { amount, description });
  return res.data;
}

export async function getNetProfitSummary(): Promise<NetProfitSummary> {
  const res = await api.get<NetProfitSummary>("/profit/net-summary");
  return res.data;
}

export async function withdrawCapital(amount: string, description?: string) {
  const res = await api.post("/capital/withdraw", { amount, description });
  return res.data;
}

export async function getBusinessLedger(): Promise<LedgerEntry[]> {
  const res = await api.get<LedgerEntry[]>("/ledger/business");
  return res.data;
}

export async function getReconciliation(): Promise<Reconciliation> {
  const res = await api.get<Reconciliation>("/ledger/reconciliation");
  return res.data;
}

export async function getExpenseCategories(): Promise<string[]> {
  const res = await api.get<{ categories: string[] }>("/expenses/categories");
  return res.data.categories;
}

export async function listExpenses(): Promise<Expense[]> {
  const res = await api.get<Expense[]>("/expenses");
  return res.data;
}

export async function createExpense(payload: {
  category: string;
  amount: string;
  description?: string;
  funding_source?: string;
}) {
  const res = await api.post("/expenses", payload);
  return res.data;
}

export async function getOverdueLoans(): Promise<OverdueLoan[]> {
  const res = await api.get<OverdueLoan[]>("/defaults/overdue");
  return res.data;
}

export async function markLoanDefaulted(loanId: number, reason?: string) {
  const res = await api.post(`/defaults/${loanId}/mark-defaulted`, { reason });
  return res.data;
}

export async function writeOffLoan(
  loanId: number,
  amountRecovered: string,
  reason?: string
) {
  const res = await api.post(`/defaults/${loanId}/write-off`, {
    amount_recovered: amountRecovered,
    reason,
  });
  return res.data;
}

export async function getFinancialReport() {
  const res = await api.get("/reports/summary");
  return res.data;
}

export async function getCollectionsReport(days = 30) {
  const res = await api.get("/reports/collections", { params: { days } });
  return res.data;
}

export async function getPortfolioReport() {
  const res = await api.get("/reports/portfolio");
  return res.data;
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const res = await api.get<AuditLog[]>("/audit/logs");
  return res.data;
}

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  const res = await api.get<Notification[]>("/notifications", {
    params: { unread_only: unreadOnly },
  });
  return res.data;
}

export async function getNotificationCount(): Promise<{ unread_count: number }> {
  const res = await api.get<{ unread_count: number }>("/notifications/count");
  return res.data;
}

export async function markNotificationRead(id: number) {
  const res = await api.post(`/notifications/${id}/read`);
  return res.data;
}

export async function downloadTransactionsCsv(): Promise<Blob> {
  const res = await api.get("/reports/export/transactions", {
    responseType: "blob",
  });
  return res.data;
}

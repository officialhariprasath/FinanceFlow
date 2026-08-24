import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import DashboardCard from "../../components/dashboard/DashboardCard";
import RecentLoansTable from "../../components/dashboard/RecentLoansTable";
import RecentPaymentsTable from "../../components/dashboard/RecentPaymentsTable";
import { PageLoading, PageError } from "../../components/common/PageStates";
import {
  getDashboard,
  getProfitSummary,
  getOverdueLoans,
  getClosedLoans,
  getMaturityReport,
} from "../../services/dashboardService";
import { getProfile } from "../../services/authService";
import { getFinanceFlowDashboard } from "../../services/financeflowDashboardService";
import { useAuth } from "../../context/AuthContext";
import { fmt } from "../../utils/fmt";
import type { DashboardResponse } from "../../types/dashboard";
import type { FinanceFlowDashboard } from "../../types/financeflowDashboard";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { session, hasPermission } = useAuth();
  const isOwner = session?.is_owner ?? false;
  const canCreateLoan = hasPermission("loans.create");
  const canAddCapital = isOwner && hasPermission("capital");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ffDashboard, setFfDashboard] = useState<FinanceFlowDashboard | null>(null);
  const [ffLoading, setFfLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");

  // Profit summary
  const [profitFrom, setProfitFrom] = useState("");
  const [profitTo, setProfitTo] = useState("");
  const [profit, setProfit] = useState<any>(null);
  const [profitLoading, setProfitLoading] = useState(false);

  // Overdue
  const [overdue, setOverdue] = useState<any>(null);
  const [overdueLoading, setOverdueLoading] = useState(false);

  // Maturity
  const now = new Date();
  const [maturityMonth, setMaturityMonth] = useState(now.getMonth() + 1);
  const [maturityYear, setMaturityYear] = useState(now.getFullYear());
  const [maturity, setMaturity] = useState<any>(null);
  const [maturityLoading, setMaturityLoading] = useState(false);

  // Closed loans
  const [closed, setClosed] = useState<any>(null);
  const [closedLoading, setClosedLoading] = useState(false);
  const [closedError, setClosedError] = useState("");
  const [dashTab, setDashTab] = useState<"overview" | "reports" | "legacy">("overview");

  useEffect(() => {
    loadDashboard();
    loadOverdue();
    getFinanceFlowDashboard()
      .then(setFfDashboard)
      .catch(() => {})
      .finally(() => setFfLoading(false));
    getProfile()
      .then((p) => setOwnerName(p.owner_name ?? ""))
      .catch(() => {});
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");
      const data = await getDashboard();
      setDashboard(data);
    } catch {
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOverdue() {
    try {
      setOverdueLoading(true);
      const data = await getOverdueLoans();
      setOverdue(data);
    } catch {
      // non-critical
    } finally {
      setOverdueLoading(false);
    }
  }

  async function loadProfit() {
    if (!profitFrom || !profitTo) return;
    try {
      setProfitLoading(true);
      const data = await getProfitSummary(profitFrom, profitTo);
      setProfit(data);
    } catch {
      setProfit(null);
    } finally {
      setProfitLoading(false);
    }
  }

  async function loadMaturity() {
    try {
      setMaturityLoading(true);
      const data = await getMaturityReport(maturityMonth, maturityYear);
      setMaturity(data);
    } catch {
      setMaturity(null);
    } finally {
      setMaturityLoading(false);
    }
  }

  async function loadClosed() {
    try {
      setClosedLoading(true);
      setClosedError("");
      const data = await getClosedLoans();
      setClosed(data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setClosedError(typeof detail === "string" ? detail : "Failed to load closed loans.");
      setClosed(null);
    } finally {
      setClosedLoading(false);
    }
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="page-title">
            {ownerName ? `Hi, ${ownerName} 👋` : "Dashboard"}
          </h1>
          <p className="page-subtitle">Your lending business at a glance.</p>
          {isOwner && (
            <div className="mt-4 flex gap-2 border-b border-slate-200 dark:border-slate-700">
              {(["overview", "reports", "legacy"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDashTab(tab)}
                  className={`border-b-2 px-4 py-2 text-sm font-medium capitalize ${
                    dashTab === tab
                      ? "border-blue-600 text-blue-700 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        {dashTab === "overview" && (
          <>
            {ffLoading ? (
              <PageLoading message="Loading finance overview..." />
            ) : ffDashboard ? (
              <>
                <div className="flex flex-wrap gap-3">
              {canAddCapital && (
              <button
                type="button"
                onClick={() => navigate("/capital")}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                Add Capital
              </button>
              )}
              {canCreateLoan && (
              <button
                type="button"
                onClick={() => navigate("/loans")}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                New Loan
              </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/collections")}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                Collect Payment
              </button>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Capital</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <DashboardCard title="Capital Added" value={fmt(ffDashboard.capital_added)} onClick={() => navigate("/capital")} />
                <DashboardCard title="Available Capital" value={fmt(ffDashboard.available_capital)} onClick={() => navigate("/capital")} />
                <DashboardCard title="Capital Lent" value={fmt(ffDashboard.capital_currently_lent)} />
                <DashboardCard title="Principal Outstanding" value={fmt(ffDashboard.principal_outstanding)} />
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Profit</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <DashboardCard title="Profit Today" value={fmt(ffDashboard.profit_today)} />
                <DashboardCard title="Profit This Month" value={fmt(ffDashboard.profit_this_month)} />
                <DashboardCard title="Total Profit" value={fmt(ffDashboard.total_profit)} />
                <DashboardCard title="Available Profit" value={fmt(ffDashboard.available_profit)} />
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Agent settlements</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <DashboardCard
                  title="Unsettled with agents"
                  value={fmt(ffDashboard.unsettled_with_agents)}
                  onClick={() => navigate("/agent-settlements")}
                />
                <DashboardCard
                  title="Pending settlements"
                  value={String(ffDashboard.pending_settlement_count)}
                  onClick={() => navigate("/agent-settlements")}
                />
                <DashboardCard
                  title="Pending settlement amount"
                  value={fmt(ffDashboard.pending_settlement_total)}
                  onClick={() => navigate("/agent-settlements")}
                />
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Lending & Collections</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <DashboardCard title="Active Loans" value={ffDashboard.active_loans} onClick={() => navigate("/loans")} />
                <DashboardCard title="Overdue Loans" value={ffDashboard.overdue_loans} />
                <DashboardCard title="Expected Today" value={fmt(ffDashboard.expected_today)} onClick={() => navigate("/collections")} />
                <DashboardCard title="Collected Today" value={fmt(ffDashboard.collected_today)} onClick={() => navigate("/collections")} />
                <DashboardCard title="Pending Today" value={fmt(ffDashboard.pending_today)} />
                <DashboardCard title="Collection Rate" value={`${ffDashboard.collection_rate}%`} />
              </div>
            </div>
          </>
            ) : null}
          </>
        )}

        {dashTab === "legacy" && (
          <>
        {loading ? (
          <PageLoading message="Loading dashboard..." />
        ) : error ? (
          <PageError message={error} />
        ) : dashboard ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <DashboardCard title="Total Customers" value={dashboard.total_customers} />
              <DashboardCard title="Active Loans" value={dashboard.active_loans} />
              <DashboardCard title="Closed Loans" value={dashboard.closed_loans} />
              <DashboardCard title="Today's Collection" value={fmt(dashboard.today_collection)} />
              <DashboardCard title="Principal Disbursed" value={fmt(dashboard.total_principal_disbursed)} />
              <DashboardCard title="Remaining Principal" value={fmt(dashboard.remaining_principal)} />
              <DashboardCard title="Principal Paid" value={fmt(dashboard.total_principal_paid)} />
              <DashboardCard title="Interest Collected" value={fmt(dashboard.total_interest_paid)} />
            </div>

            <RecentLoansTable loans={dashboard.recent_loans} />
            <RecentPaymentsTable payments={dashboard.recent_payments} />
          </>
        ) : null}
          </>
        )}

        {dashTab === "reports" && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Reports</h2>

          {/* Profit Summary */}
          <div className="surface-card p-6">
            <h3 className="mb-4 font-semibold text-slate-700">Profit Summary</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-600">From</label>
                <input
                  type="date"
                  value={profitFrom}
                  onChange={(e) => setProfitFrom(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">To</label>
                <input
                  type="date"
                  value={profitTo}
                  onChange={(e) => setProfitTo(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={loadProfit}
                disabled={profitLoading || !profitFrom || !profitTo}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {profitLoading ? "Loading..." : "Generate"}
              </button>
            </div>
            {profit && (
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Loans</p>
                  <p className="text-xl font-bold">{profit.loan_count}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Total Principal</p>
                  <p className="text-xl font-bold">{fmt(profit.total_principal)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Total Interest</p>
                  <p className="text-xl font-bold text-green-600">{fmt(profit.total_interest)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">Total Amount</p>
                  <p className="text-xl font-bold">{fmt(profit.total_amount)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Maturity Report */}
          <div className="surface-card p-6">
            <h3 className="mb-4 font-semibold text-slate-700">Maturity Report</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Month</label>
                <select
                  value={maturityMonth}
                  onChange={(e) => setMaturityMonth(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString("en-IN", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Year</label>
                <input
                  type="number"
                  value={maturityYear}
                  onChange={(e) => setMaturityYear(Number(e.target.value))}
                  min={2020}
                  max={2040}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={loadMaturity}
                disabled={maturityLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {maturityLoading ? "Loading..." : "Generate"}
              </button>
            </div>
            {maturity && (
              <div className="mt-4">
                <p className="mb-3 text-sm text-slate-500">{maturity.loan_count} loan{maturity.loan_count !== 1 ? "s" : ""} maturing</p>
                {maturity.loans.length === 0 ? (
                  <p className="text-slate-500">No loans maturing this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="table-head">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-600">Customer</th>
                          <th className="px-3 py-2 text-left text-slate-600">Phone</th>
                          <th className="px-3 py-2 text-right text-slate-600">Principal</th>
                          <th className="px-3 py-2 text-right text-slate-600">Remaining</th>
                          <th className="px-3 py-2 text-center text-slate-600">Due Date</th>
                          <th className="px-3 py-2 text-center text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maturity.loans.map((l: any) => (
                          <tr key={l.loan_id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-3 py-2 font-medium">{l.customer_name}</td>
                            <td className="px-3 py-2 text-slate-600">{l.mobile_number}</td>
                            <td className="px-3 py-2 text-right">{fmt(l.principal_amount)}</td>
                            <td className="px-3 py-2 text-right">{fmt(l.remaining_principal)}</td>
                            <td className="px-3 py-2 text-center">{l.due_date}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${l.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                                {l.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Overdue Loans */}
          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Overdue Loans</h3>
              <button
                onClick={loadOverdue}
                disabled={overdueLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {overdueLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
            {overdue ? (
              overdue.loans.length === 0 ? (
                <p className="text-slate-500">No overdue loans.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="table-head">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-600">Customer</th>
                        <th className="px-3 py-2 text-left text-slate-600">Phone</th>
                        <th className="px-3 py-2 text-center text-slate-600">Due Date</th>
                        <th className="px-3 py-2 text-center text-slate-600">Days Overdue</th>
                        <th className="px-3 py-2 text-right text-slate-600">Outstanding</th>
                        <th className="px-3 py-2 text-center text-slate-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdue.loans.map((l: any) => (
                        <tr key={l.loan_id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-3 py-2 font-medium">{l.customer_name}</td>
                          <td className="px-3 py-2 text-slate-600">{l.mobile_number}</td>
                          <td className="px-3 py-2 text-center text-red-600">{l.due_date}</td>
                          <td className="px-3 py-2 text-center font-semibold text-red-600">{l.days_overdue}d</td>
                          <td className="px-3 py-2 text-right font-semibold">{fmt(l.remaining_principal)}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => navigate(`/loans/${l.loan_id}`)}
                              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}
          </div>

          {/* Closed Loans */}
          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Closed Loans</h3>
              <button
                onClick={loadClosed}
                disabled={closedLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {closedLoading ? "Loading..." : "Load"}
              </button>
            </div>
            {closedLoading ? (
              <p className="text-slate-500">Loading...</p>
            ) : closedError ? (
              <p className="text-red-600 text-sm">{closedError}</p>
            ) : closed === null ? null : closed.loans.length === 0 ? (
              <p className="text-slate-500">No closed loans found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="table-head">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-600">Customer</th>
                      <th className="px-3 py-2 text-left text-slate-600">Loan #</th>
                      <th className="px-3 py-2 text-right text-slate-600">Principal</th>
                      <th className="px-3 py-2 text-right text-slate-600">Interest Paid</th>
                      <th className="px-3 py-2 text-right text-slate-600">Total Collected</th>
                      <th className="px-3 py-2 text-center text-slate-600">Closed Date</th>
                      <th className="px-3 py-2 text-center text-slate-600">Closure Type</th>
                      <th className="px-3 py-2 text-center text-slate-600">Settlement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closed.loans.map((l: any) => {
                      const totalCollected =
                        (parseFloat(l.total_principal_paid) || 0) +
                        (parseFloat(l.total_interest_paid) || 0);
                      return (
                        <tr key={l.loan_id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-3 py-2 font-medium">{l.customer_name}</td>
                          <td className="px-3 py-2 text-slate-600">#{l.loan_id}</td>
                          <td className="px-3 py-2 text-right">{fmt(l.principal_amount)}</td>
                          <td className="px-3 py-2 text-right text-green-600">{fmt(l.total_interest_paid)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{fmt(totalCollected)}</td>
                          <td className="px-3 py-2 text-center">{l.closed_date || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              {l.closure_type || "NORMAL"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {l.closure_type === "SETTLEMENT" ? (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                                {l.settlement_amount ? fmt(l.settlement_amount) : "Settled"}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </MainLayout>
  );
}

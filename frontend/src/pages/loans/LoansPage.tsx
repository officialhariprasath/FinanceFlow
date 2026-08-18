import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError, EmptyState } from "../../components/common/PageStates";
import NewLoanModal from "../../components/loans/NewLoanModal";
import { getLoans, searchLoans } from "../../services/loanService";
import api from "../../api/axios";
import { fmt } from "../../utils/fmt";
import StatusChip from "../../components/common/StatusChip";
import type { LoanResponse } from "../../types/loan";

export default function LoansPage() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<LoanResponse[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewLoan, setShowNewLoan] = useState(false);

  const [mobile, setMobile] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searching, setSearching] = useState(false);

  async function loadCustomerMap() {
    try {
      const res = await api.get<{ id: number; full_name: string }[]>("/customers/names");
      const map: Record<number, string> = {};
      res.data.forEach((c) => { map[c.id] = c.full_name; });
      setCustomerMap(map);
    } catch {
      // non-critical — table falls back to customer_id
    }
  }

  async function loadLoans() {
    try {
      setLoading(true);
      setError("");
      const data = await getLoans();
      setLoans(data);
    } catch {
      setError("Failed to load loans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomerMap();
    loadLoans();
  }, []);

  async function handleSearch() {
    try {
      setSearching(true);
      setError("");
      const params: Record<string, string> = {};
      if (mobile) params.mobile_number = mobile;
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const data = await searchLoans(params);
      setLoans(data);
    } catch {
      setError("Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function handleReset() {
    setMobile("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    loadLoans();
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="page-title">Loans</h1>
            <p className="page-subtitle">
              {loans.length} loan{loans.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowNewLoan(true)}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
          >
            + New Loan
          </button>
        </div>

        {/* Filters */}
        <div className="surface-card p-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Mobile number..."
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </select>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Issue Date</span>
              <div className="flex flex-wrap gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleSearch}
                disabled={searching}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {searching ? "Searching..." : "Search"}
              </button>
              <button
                onClick={handleReset}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {error && <PageError message={error} />}

        {loading ? (
          <PageLoading message="Loading loans..." />
        ) : loans.length === 0 ? (
          <EmptyState message="No loans found." />
        ) : (
          <div className="surface-card overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th>Loan ID</th>
                  <th>Customer</th>
                  <th>Interest</th>
                  <th className="text-right">Principal</th>
                  <th className="text-right">Remaining</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Issue Date</th>
                  <th className="text-center">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr
                    key={loan.id}
                    onClick={() => navigate(`/loans/${loan.id}`)}
                    className="cursor-pointer border-t hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-4 py-3 font-medium">#{loan.id}</td>
                    <td className="px-4 py-3 table-cell-strong">
                      {customerMap[loan.customer_id] ?? `Customer #${loan.customer_id}`}
                    </td>
                    <td className="px-4 py-3 table-cell">
                      {loan.interest_method === "PERCENTAGE"
                        ? `${loan.interest_rate}% / mo`
                        : `₹${loan.interest_rate}/₹100`}
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(loan.principal_amount)}</td>
                    <td className="px-4 py-3 text-right">{fmt(loan.remaining_principal)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusChip status={loan.status} />
                    </td>
                    <td className="px-4 py-3 text-center">{loan.issue_date}</td>
                    <td className="px-4 py-3 text-center">{loan.due_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewLoan && (
        <NewLoanModal
          onClose={() => setShowNewLoan(false)}
          onSuccess={() => { setShowNewLoan(false); loadLoans(); }}
        />
      )}
    </MainLayout>
  );
}

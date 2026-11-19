import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ScrollableTable from "../../components/common/ScrollableTable";
import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError, EmptyState } from "../../components/common/PageStates";
import NewLoanModal from "../../components/loans/NewLoanModal";
import EditLoanModal from "../../components/loans/EditLoanModal";
import RecordPaymentModal from "../../components/loans/RecordPaymentModal";
import {
  getLoans,
  getLoansPortfolioSummary,
  searchLoans,
  type LoansPortfolioSummary,
} from "../../services/loanService";
import api from "../../api/axios";
import { fmt } from "../../utils/fmt";
import StatusChip from "../../components/common/StatusChip";
import type { LoanResponse } from "../../types/loan";
import { useAuth } from "../../context/AuthContext";
import { displayStatus, loanProductLabel } from "../../utils/loanDisplay";

type SortKey = "issue_date" | "remaining_principal" | "status" | "id";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

export default function LoansPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreateLoan = hasPermission("loans.create");
  const canEditLoan = hasPermission("loans.edit");
  const canRecordPayment = hasPermission("payments") || hasPermission("payments.create") || canEditLoan;

  const [loans, setLoans] = useState<LoanResponse[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState<LoansPortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanResponse | null>(null);
  const [paymentLoan, setPaymentLoan] = useState<LoanResponse | null>(null);
  const [menuLoanId, setMenuLoanId] = useState<number | null>(null);

  const [nameQuery, setNameQuery] = useState("");
  const [mobile, setMobile] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [debouncedMobile, setDebouncedMobile] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("issue_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedName(nameQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [nameQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedMobile(mobile.trim()), 300);
    return () => window.clearTimeout(t);
  }, [mobile]);

  async function loadCustomerMap() {
    try {
      const res = await api.get<{ id: number; full_name: string }[]>("/customers/names");
      const map: Record<number, string> = {};
      res.data.forEach((c) => {
        map[c.id] = c.full_name;
      });
      setCustomerMap(map);
    } catch {
      // non-critical
    }
  }

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await getLoansPortfolioSummary());
    } catch {
      // keep prior summary
    }
  }, []);

  const loadLoans = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const hasFilter =
        Boolean(debouncedName) ||
        Boolean(debouncedMobile) ||
        Boolean(statusFilter) ||
        Boolean(fromDate) ||
        Boolean(toDate);
      const data = hasFilter
        ? await searchLoans({
            customer_name: debouncedName || undefined,
            mobile_number: debouncedMobile || undefined,
            status: statusFilter || undefined,
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
          })
        : await getLoans();
      setLoans(data);
      setPage(1);
    } catch {
      setError("Failed to load loans.");
    } finally {
      setLoading(false);
    }
  }, [debouncedName, debouncedMobile, statusFilter, fromDate, toDate]);

  useEffect(() => {
    loadCustomerMap();
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  function handleReset() {
    setNameQuery("");
    setMobile("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setDebouncedName("");
    setDebouncedMobile("");
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "issue_date" ? "desc" : "asc");
    }
  }

  const sortedLoans = useMemo(() => {
    const rows = [...loans];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "issue_date") {
        cmp = a.issue_date.localeCompare(b.issue_date);
      } else if (sortKey === "remaining_principal") {
        cmp = Number(a.remaining_principal) - Number(b.remaining_principal);
      } else if (sortKey === "status") {
        cmp = displayStatus(a).localeCompare(displayStatus(b));
      } else {
        cmp = a.id - b.id;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [loans, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedLoans.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedLoans = sortedLoans.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function refreshAll() {
    loadLoans();
    loadSummary();
  }

  function LoanActions({ loan }: { loan: LoanResponse }) {
    const open = menuLoanId === loan.id;
    return (
      <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
          onClick={() => setMenuLoanId(open ? null : loan.id)}
        >
          Actions
        </button>
        {open && (
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={() => {
                setMenuLoanId(null);
                navigate(`/loans/${loan.id}`);
              }}
            >
              View
            </button>
            {canEditLoan && loan.status === "ACTIVE" && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => {
                  setMenuLoanId(null);
                  setEditingLoan(loan);
                }}
              >
                Edit
              </button>
            )}
            {canRecordPayment && loan.status === "ACTIVE" && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => {
                  setMenuLoanId(null);
                  setPaymentLoan(loan);
                }}
              >
                Record payment
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const kpi = [
    { label: "Active", value: summary?.active_count ?? "—" },
    { label: "Overdue", value: summary?.overdue_count ?? "—" },
    { label: "Due today", value: summary?.due_today_count ?? "—" },
    { label: "Defaulted", value: summary?.defaulted_count ?? "—" },
  ];

  const money = [
    { label: "Principal collected", value: summary ? fmt(summary.total_principal_collected) : "—" },
    { label: "Interest collected", value: summary ? fmt(summary.total_interest_collected) : "—" },
    {
      label: "Penalties scheduled",
      value: summary ? fmt(summary.total_penalties_scheduled) : "—",
    },
    {
      label: "Penalties collected",
      value: summary ? fmt(summary.total_penalties_collected) : "—",
    },
    {
      label: "Total collected",
      value: summary ? fmt(summary.total_collected) : "—",
      emphasis: true,
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6" onClick={() => setMenuLoanId(null)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="page-title">Loans</h1>
            <p className="page-subtitle">
              {sortedLoans.length} loan{sortedLoans.length !== 1 ? "s" : ""}
              {summary ? ` · ${summary.loan_count} in portfolio` : ""}
            </p>
          </div>
          {canCreateLoan && (
            <button
              type="button"
              onClick={() => setShowNewLoan(true)}
              className="cursor-pointer rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
            >
              + New Loan
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpi.map((item) => (
            <div key={item.label} className="surface-card p-4">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {money.map((item) => (
            <div key={item.label} className="surface-card p-4">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p
                className={`mt-1 font-semibold ${
                  item.emphasis
                    ? "text-lg text-emerald-700 dark:text-emerald-300"
                    : "text-slate-800 dark:text-slate-100"
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="surface-card p-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Customer name..."
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="text"
              placeholder="Mobile number..."
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="DEFAULTED">Defaulted</option>
              <option value="CLOSED">Closed</option>
              <option value="RENEWED">Renewed</option>
              <option value="WRITE_OFF">Write-off</option>
            </select>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Issue Date</span>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  aria-label="Issue date from"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  aria-label="Issue date to"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleReset}
                className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50"
              >
                Reset
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Name and mobile search apply automatically as you type.
          </p>
        </div>

        {error && <PageError message={error} onRetry={refreshAll} />}

        {loading ? (
          <PageLoading message="Loading loans..." />
        ) : sortedLoans.length === 0 ? (
          <div className="surface-card space-y-4 p-10 text-center">
            <EmptyState message="No loans found." />
            {canCreateLoan && (
              <button
                type="button"
                onClick={() => setShowNewLoan(true)}
                className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                + New Loan
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {pagedLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="surface-card cursor-pointer p-4"
                  onClick={() => navigate(`/loans/${loan.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {customerMap[loan.customer_id] ?? `Customer #${loan.customer_id}`}
                      </p>
                      <p className="text-xs text-slate-500">{loan.display_code || `Loan #${loan.id}`}</p>
                    </div>
                    <StatusChip status={displayStatus(loan)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Product</p>
                      <p>{loanProductLabel(loan)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Remaining</p>
                      <p className="font-medium">{fmt(loan.remaining_principal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Principal</p>
                      <p>{fmt(loan.principal_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Due</p>
                      <p>{loan.due_date}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <LoanActions loan={loan} />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="surface-card hidden md:block">
              <p className="table-scroll-hint">Swipe sideways to see all columns</p>
              <ScrollableTable>
                <table className="data-table table-wide text-sm">
                  <thead className="table-head">
                    <tr>
                      <th>
                        <button type="button" className="cursor-pointer font-semibold" onClick={() => toggleSort("id")}>
                          Loan ID{sortMark("id")}
                        </button>
                      </th>
                      <th>Customer</th>
                      <th>Product</th>
                      <th className="text-right">Principal</th>
                      <th className="text-right">
                        <button
                          type="button"
                          className="cursor-pointer font-semibold"
                          onClick={() => toggleSort("remaining_principal")}
                        >
                          Remaining{sortMark("remaining_principal")}
                        </button>
                      </th>
                      <th className="text-center">
                        <button
                          type="button"
                          className="cursor-pointer font-semibold"
                          onClick={() => toggleSort("status")}
                        >
                          Status{sortMark("status")}
                        </button>
                      </th>
                      <th className="text-center">Orig. score</th>
                      <th className="text-center">
                        <button
                          type="button"
                          className="cursor-pointer font-semibold"
                          onClick={() => toggleSort("issue_date")}
                        >
                          Issue Date{sortMark("issue_date")}
                        </button>
                      </th>
                      <th className="text-center">Due Date</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLoans.map((loan) => (
                      <tr
                        key={loan.id}
                        onClick={() => navigate(`/loans/${loan.id}`)}
                        className="cursor-pointer border-t hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <td className="px-4 py-3 font-medium">{loan.display_code || `#${loan.id}`}</td>
                        <td className="px-4 py-3 table-cell-strong">
                          {customerMap[loan.customer_id] ?? `Customer #${loan.customer_id}`}
                        </td>
                        <td className="px-4 py-3 table-cell">{loanProductLabel(loan)}</td>
                        <td className="px-4 py-3 text-right">{fmt(loan.principal_amount)}</td>
                        <td className="px-4 py-3 text-right">{fmt(loan.remaining_principal)}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusChip status={displayStatus(loan)} />
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {loan.origination_score != null ? (
                            <span className="inline-flex flex-col items-center gap-0.5">
                              <span className="font-semibold">{loan.origination_score}</span>
                              <span className="text-slate-500">
                                {(loan.origination_band || "").replace(/_/g, " ") || "—"}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">{loan.issue_date}</td>
                        <td className="px-4 py-3 text-center">{loan.due_date}</td>
                        <td className="px-4 py-3 text-right">
                          <LoanActions loan={loan} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Page {pageSafe} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-600"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pageSafe >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-600"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showNewLoan && (
        <NewLoanModal
          onClose={() => setShowNewLoan(false)}
          onSuccess={() => {
            setShowNewLoan(false);
            refreshAll();
          }}
        />
      )}

      {editingLoan && (
        <EditLoanModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSuccess={() => {
            setEditingLoan(null);
            refreshAll();
          }}
        />
      )}

      {paymentLoan && (
        <RecordPaymentModal
          loanId={paymentLoan.id}
          collectionModel={paymentLoan.collection_model ?? "STANDARD"}
          defaultAmount={
            paymentLoan.collection_model === "DAILY_COLLECTION"
              ? paymentLoan.daily_payment ?? ""
              : ""
          }
          onClose={() => setPaymentLoan(null)}
          onSuccess={() => {
            setPaymentLoan(null);
            refreshAll();
          }}
        />
      )}
    </MainLayout>
  );
}

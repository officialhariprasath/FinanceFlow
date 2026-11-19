import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Breadcrumbs from "../../components/common/Breadcrumbs";
import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError } from "../../components/common/PageStates";
import ConfirmModal from "../../components/common/ConfirmModal";
import RecordPaymentModal from "../../components/loans/RecordPaymentModal";
import RenewLoanModal from "../../components/loans/RenewLoanModal";
import SettleLoanModal from "../../components/loans/SettleLoanModal";
import EditLoanModal from "../../components/loans/EditLoanModal";
import CreditScoreCard from "../../components/credit/CreditScoreCard";
import {
  getLoanById,
  getLoanStatement,
  getInterestSummary,
  getLoanSchedules,
} from "../../services/loanService";
import { getLoanPayments, deletePayment } from "../../services/paymentService";
import { getLoanRenewals } from "../../services/renewalService";
import {
  markLoanDefaulted,
  reactivateLoan,
  writeOffLoan,
} from "../../services/extendedService";
import {
  getCustomerCreditScore,
  refreshCustomerCreditScore,
} from "../../services/creditScoreService";
import { fmt } from "../../utils/fmt";
import StatusChip from "../../components/common/StatusChip";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import type {
  LoanResponse,
  LoanStatementResponse,
  InterestSummaryResponse,
  LoanScheduleRow,
} from "../../types/loan";
import type { PaymentResponse } from "../../types/payment";
import type { LoanRenewalResponse } from "../../types/renewal";
import type { CreditScore } from "../../types/creditScore";
import { displayStatus, loanProductLabel } from "../../utils/loanDisplay";

type ConfirmAction = "reactivate" | "default" | "writeoff" | null;
type ScheduleFilter = "all" | "overdue" | "open";

export default function LoanDetailPage() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission, session } = useAuth();
  const canEditLoan = hasPermission("loans.edit");
  const canOwnerDefaults = !!session?.is_owner;
  const id = Number(loanId);

  const [loan, setLoan] = useState<LoanResponse | null>(null);
  const [statement, setStatement] = useState<LoanStatementResponse | null>(null);
  const [interest, setInterest] = useState<InterestSummaryResponse | null>(null);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [schedules, setSchedules] = useState<LoanScheduleRow[]>([]);
  const [renewals, setRenewals] = useState<LoanRenewalResponse[]>([]);
  const [creditScore, setCreditScore] = useState<CreditScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [scoreRefreshing, setScoreRefreshing] = useState(false);

  const [showPayment, setShowPayment] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [writeOffRecovered, setWriteOffRecovered] = useState("0");
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>("all");
  const todayRowRef = useRef<HTMLTableRowElement | null>(null);

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      const loanData = await getLoanById(id);
      const [stmtData, intData, pmtData, rnwData, schedData, scoreData] =
        await Promise.all([
          getLoanStatement(id),
          getInterestSummary(id),
          getLoanPayments(id),
          getLoanRenewals(id),
          loanData.collection_model === "DAILY_COLLECTION"
            ? getLoanSchedules(id)
            : Promise.resolve([] as LoanScheduleRow[]),
          getCustomerCreditScore(loanData.customer_id).catch(() => null),
        ]);
      setLoan(loanData);
      setStatement(stmtData);
      setInterest(intData);
      setPayments(pmtData);
      setRenewals(rnwData);
      setSchedules(schedData);
      setCreditScore(scoreData);
    } catch {
      setError("Failed to load loan details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  const scheduleTotals = useMemo(() => {
    let scheduledPenalty = 0;
    let paidPenalty = 0;
    for (const row of schedules) {
      scheduledPenalty += Number(row.penalty_amount ?? 0);
      paidPenalty += Number(row.paid_penalty ?? 0);
    }
    return { scheduledPenalty, paidPenalty };
  }, [schedules]);

  const collectedTotals = useMemo(() => {
    if (!loan) {
      return { principal: 0, interest: 0, penalties: 0, total: 0 };
    }
    const principal = Number(loan.total_principal_paid || 0);
    const interest = Number(loan.total_interest_paid || 0);
    const penalties = scheduleTotals.paidPenalty;
    return {
      principal,
      interest,
      penalties,
      total: principal + interest + penalties,
    };
  }, [loan, scheduleTotals.paidPenalty]);

  const filteredSchedules = useMemo(() => {
    if (scheduleFilter === "overdue") {
      return schedules.filter((s) => s.status === "OVERDUE");
    }
    if (scheduleFilter === "open") {
      return schedules.filter((s) => s.status !== "PAID");
    }
    return schedules;
  }, [schedules, scheduleFilter]);

  async function handleDeletePayment() {
    if (!paymentToDelete) return;
    try {
      setDeleting(true);
      setDeleteError("");
      await deletePayment(paymentToDelete.id);
      setPaymentToDelete(null);
      await loadAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      setDeleteError(typeof detail === "string" ? detail : "Failed to delete payment.");
    } finally {
      setDeleting(false);
    }
  }

  async function runConfirmAction() {
    if (!confirmAction) return;
    try {
      setActionBusy(true);
      if (confirmAction === "reactivate") {
        await reactivateLoan(id, "Reactivated from loan detail");
        toast.success("Loan reactivated to Active.");
      } else if (confirmAction === "default") {
        await markLoanDefaulted(id, "Marked defaulted from loan detail");
        toast.success("Loan marked as defaulted.");
      } else if (confirmAction === "writeoff") {
        await writeOffLoan(id, writeOffRecovered || "0", "Written off from loan detail");
        toast.success("Loan written off.");
      }
      setConfirmAction(null);
      await loadAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading loan details..." />
      </MainLayout>
    );
  }
  if (error) {
    return (
      <MainLayout>
        <PageError message={error} onRetry={loadAll} />
      </MainLayout>
    );
  }
  if (!loan) {
    return (
      <MainLayout>
        <PageError message="Loan not found." onRetry={loadAll} />
      </MainLayout>
    );
  }

  const isActive = loan.status === "ACTIVE";
  const isDefaulted = loan.status === "DEFAULTED";
  const latestPaymentId = payments.length > 0 ? payments[0].id : null;
  const statusShown = displayStatus(loan);

  return (
    <MainLayout>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Loans", to: "/loans" },
            { label: statement?.customer_name ?? `Loan #${loan.id}` },
          ]}
        />

        <div className="surface-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="page-title">Loan #{loan.id}</h1>
                <StatusChip status={statusShown} />
              </div>
              {statement && (
                <p className="mt-2 text-slate-600 dark:text-slate-300">
                  {statement.customer_name} · {statement.customer_phone}
                </p>
              )}
              <p className="mt-1 text-sm text-slate-500">{loanProductLabel(loan)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditLoan && isActive && (
                <button
                  type="button"
                  onClick={() => setShowEdit(true)}
                  className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Edit Loan
                </button>
              )}
              {isActive && canOwnerDefaults && (
                <button
                  type="button"
                  onClick={() => setConfirmAction("default")}
                  className="cursor-pointer rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200"
                >
                  Mark Defaulted
                </button>
              )}
              {(isActive || isDefaulted) && canOwnerDefaults && (
                <button
                  type="button"
                  onClick={() => {
                    setWriteOffRecovered("0");
                    setConfirmAction("writeoff");
                  }}
                  className="cursor-pointer rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                >
                  Write Off
                </button>
              )}
              {isDefaulted && canOwnerDefaults && (
                <button
                  type="button"
                  onClick={() => setConfirmAction("reactivate")}
                  className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Reactivate to Active
                </button>
              )}
              {isActive && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPayment(true)}
                    className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Record Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRenew(true)}
                    className="cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                  >
                    Renew Loan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSettle(true)}
                    className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Settle Loan
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <CreditScoreCard
          score={creditScore}
          compact
          refreshing={scoreRefreshing}
          onRefresh={async () => {
            try {
              setScoreRefreshing(true);
              setCreditScore(await refreshCustomerCreditScore(loan.customer_id));
            } catch (err: unknown) {
              const detail = (err as { response?: { data?: { detail?: string } } })
                ?.response?.data?.detail;
              toast.error(typeof detail === "string" ? detail : "Failed to refresh score.");
            } finally {
              setScoreRefreshing(false);
            }
          }}
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="surface-card p-4">
            <p className="text-xs text-slate-500">Principal collected</p>
            <p className="mt-1 font-semibold">{fmt(collectedTotals.principal)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-slate-500">Interest collected</p>
            <p className="mt-1 font-semibold">{fmt(collectedTotals.interest)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-slate-500">Penalties scheduled</p>
            <p className="mt-1 font-semibold">{fmt(scheduleTotals.scheduledPenalty)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-slate-500">Penalties collected</p>
            <p className="mt-1 font-semibold">{fmt(scheduleTotals.paidPenalty)}</p>
          </div>
          <div className="surface-card col-span-2 p-4 md:col-span-4">
            <p className="text-xs text-slate-500">
              Total collected (principal + interest + penalties)
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {fmt(collectedTotals.total)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="surface-card p-4">
            <p className="text-xs text-slate-500">Customer</p>
            <button
              type="button"
              onClick={() => navigate(`/customers/${loan.customer_id}/ledger`)}
              className="mt-1 text-left font-semibold text-blue-600 hover:underline"
            >
              {statement ? statement.customer_name : `#${loan.customer_id}`}
            </button>
            {statement && (
              <p className="mt-0.5 text-xs text-slate-400">{statement.customer_phone}</p>
            )}
          </div>

          {[
            ["Principal", fmt(loan.principal_amount)],
            ["Remaining Principal", fmt(loan.remaining_principal)],
            ["Principal Paid", fmt(loan.total_principal_paid)],
            ["Interest Paid", fmt(loan.total_interest_paid)],
            [
              "Interest Method",
              loan.collection_model === "DAILY_COLLECTION"
                ? loanProductLabel(loan)
                : loan.interest_method === "PERCENTAGE"
                  ? `${loan.interest_rate}% / month`
                  : `₹${loan.interest_rate} per ₹100`,
            ],
            ["Issue Date", loan.issue_date],
            ["Due Date", loan.due_date],
            ...(loan.collection_model === "DAILY_COLLECTION"
              ? [
                  [
                    "Collection",
                    (loan.collection_frequency ?? "DAILY").replace(/_/g, " "),
                  ],
                  ["First collection", loan.due_start_date ?? loan.issue_date],
                  ["Installment", fmt(loan.daily_payment ?? "0")],
                  [
                    "Installments",
                    String(loan.installment_count ?? loan.duration_days ?? "—"),
                  ],
                ]
              : []),
            ["Closure Type", loan.closure_type || "—"],
            [
              "Origination score",
              loan.origination_score != null
                ? `${loan.origination_score} (${(loan.origination_band || "—").replace(/_/g, " ")})`
                : "—",
            ],
            [
              "Suggested max at booking",
              loan.origination_suggested_max != null
                ? fmt(loan.origination_suggested_max)
                : "—",
            ],
          ].map(([label, value]) => (
            <div key={label} className="surface-card p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{value}</p>
            </div>
          ))}
        </div>

        {Array.isArray(loan.origination_reasons_json) &&
          loan.origination_reasons_json.length > 0 && (
            <div className="surface-card p-5">
              <h2 className="section-title">Score at loan creation (frozen)</h2>
              <p className="mt-1 text-sm text-slate-500">
                Advisory reasons captured when this loan was booked.
              </p>
              <ul className="mt-3 space-y-2">
                {loan.origination_reasons_json.map((r) => (
                  <li key={`${r.code}-${r.points}`} className="flex justify-between text-sm">
                    <span>{r.label}</span>
                    <span
                      className={
                        r.points > 0
                          ? "text-green-700"
                          : r.points < 0
                            ? "text-red-700"
                            : "text-slate-500"
                      }
                    >
                      {r.points > 0 ? `+${r.points}` : r.points}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {interest && (
          <div className="surface-card p-6">
            <h2 className="mb-4 font-semibold text-slate-800 dark:text-slate-100">
              Current Interest Summary
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-3 dark:border-slate-600">
                <p className="text-xs text-slate-500">Accrued Interest</p>
                <p className="mt-1 text-lg font-bold text-amber-600">
                  {fmt(interest.accrued_interest)}
                </p>
              </div>
              <div className="rounded-lg border p-3 dark:border-slate-600">
                <p className="text-xs text-slate-500">Total Payable</p>
                <p className="mt-1 text-lg font-bold text-red-600">
                  {fmt(interest.total_payable)}
                </p>
              </div>
              <div className="rounded-lg border p-3 dark:border-slate-600">
                <p className="text-xs text-slate-500">Remaining Principal</p>
                <p className="mt-1 text-lg font-bold">{fmt(interest.remaining_principal)}</p>
              </div>
              <div className="rounded-lg border p-3 dark:border-slate-600">
                <p className="text-xs text-slate-500">Calculated To</p>
                <p className="mt-1 text-lg font-bold">{interest.calculated_to}</p>
              </div>
            </div>
          </div>
        )}

        {loan.closure_type === "SETTLEMENT" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/30">
            <h2 className="mb-3 font-semibold text-blue-800 dark:text-blue-200">
              Settlement Details
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-blue-600">Settlement Amount</p>
                <p className="font-bold">{fmt(loan.settlement_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600">Waived Amount</p>
                <p className="font-bold">{fmt(loan.waived_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600">Settlement Date</p>
                <p className="font-bold">{loan.settlement_date || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600">Reason</p>
                <p className="font-bold">{loan.settlement_reason || "—"}</p>
              </div>
            </div>
          </div>
        )}

        {loan.collection_model === "DAILY_COLLECTION" && (
          <div className="surface-card">
            <div className="flex flex-col gap-3 border-b px-6 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">
                  Installment Schedule
                </h2>
                <p className="text-xs text-slate-500">
                  Sticky header · jump to today · filter open / overdue
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {schedules.filter((s) => s.status !== "PAID").length} open ·{" "}
                  {schedules.filter((s) => s.status === "PAID").length} paid
                </span>
                <select
                  value={scheduleFilter}
                  onChange={(e) => setScheduleFilter(e.target.value as ScheduleFilter)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                  aria-label="Filter schedule"
                >
                  <option value="all">All</option>
                  <option value="open">Open only</option>
                  <option value="overdue">Overdue only</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                  className="cursor-pointer rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600"
                >
                  Jump to today
                </button>
              </div>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 table-head bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-600">Due</th>
                    <th className="px-4 py-3 text-right text-slate-600">Original</th>
                    <th className="px-4 py-3 text-right text-slate-600">Penalty</th>
                    <th className="px-4 py-3 text-right text-slate-600">Paid</th>
                    <th className="px-4 py-3 text-right text-slate-600">Payable</th>
                    <th className="px-4 py-3 text-left text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-slate-600">Paid on</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No installments match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSchedules.map((row) => {
                      const assessedPenalty = Number(
                        row.penalty_amount ?? row.paid_penalty ?? row.penalty_outstanding ?? 0
                      );
                      const totalPaid = Number(
                        row.total_paid ??
                          Number(row.paid_amount || 0) + Number(row.paid_penalty || 0)
                      );
                      const payable = Number(row.total_payable ?? row.pending_amount);
                      return (
                        <tr
                          key={row.schedule_date}
                          ref={row.is_today ? todayRowRef : undefined}
                          className={`border-t hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                            row.is_today ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            {row.schedule_date}
                            {row.is_today && (
                              <span className="ml-2 text-xs font-medium text-blue-600">
                                Today
                              </span>
                            )}
                            {row.within_grace && (
                              <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                                Grace
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {fmt(row.original_amount ?? row.expected_amount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {assessedPenalty > 0.009 ? fmt(assessedPenalty) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {totalPaid > 0.009 ? fmt(totalPaid) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {payable > 0 ? fmt(payable) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusChip status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {row.paid_on || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="surface-card">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Payment History</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {payments.length} payment{payments.length !== 1 ? "s" : ""}
            </span>
          </div>
          {deleteError && (
            <div className="mx-6 mt-3 rounded-lg border alert-error p-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3 text-left text-slate-600">Date</th>
                  <th className="px-4 py-3 text-right text-slate-600">Amount</th>
                  <th className="px-4 py-3 text-right text-slate-600">Interest</th>
                  <th className="px-4 py-3 text-right text-slate-600">Principal</th>
                  <th className="px-4 py-3 text-left text-slate-600">Mode</th>
                  <th className="px-4 py-3 text-left text-slate-600">Remarks</th>
                  {isActive && (
                    <th className="px-4 py-3 text-center text-slate-600">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      No payments recorded.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <td className="px-4 py-3">{p.payment_date}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {fmt(p.amount_paid)}
                      </td>
                      <td className="px-4 py-3 text-right">{fmt(p.interest_paid)}</td>
                      <td className="px-4 py-3 text-right">{fmt(p.principal_paid)}</td>
                      <td className="px-4 py-3">{p.payment_mode}</td>
                      <td className="px-4 py-3 text-slate-500">{p.remarks || "—"}</td>
                      {isActive && (
                        <td className="px-4 py-3 text-center">
                          {p.id === latestPaymentId && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError("");
                                setPaymentToDelete(p);
                              }}
                              className="cursor-pointer rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {renewals.length > 0 && (
          <div className="surface-card">
            <div className="border-b px-6 py-4">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">
                Renewal History
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-600">Date</th>
                    <th className="px-4 py-3 text-left text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left text-slate-600">Old Due</th>
                    <th className="px-4 py-3 text-left text-slate-600">New Due</th>
                    <th className="px-4 py-3 text-right text-slate-600">Old Rate</th>
                    <th className="px-4 py-3 text-right text-slate-600">New Rate</th>
                    <th className="px-4 py-3 text-right text-slate-600">New Principal</th>
                    <th className="px-4 py-3 text-left text-slate-600">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {renewals.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <td className="px-4 py-3">{r.renewed_at.split("T")[0]}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                          {r.renewal_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.old_due_date}</td>
                      <td className="px-4 py-3">{r.new_due_date}</td>
                      <td className="px-4 py-3 text-right">
                        {r.old_interest_rate} ({r.old_interest_method})
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.new_interest_rate} ({r.new_interest_method})
                      </td>
                      <td className="px-4 py-3 text-right">{fmt(r.new_principal)}</td>
                      <td className="px-4 py-3 text-slate-500">{r.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showEdit && (
        <EditLoanModal
          loan={loan}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            loadAll();
          }}
        />
      )}

      {showPayment && (
        <RecordPaymentModal
          loanId={id}
          collectionModel={loan.collection_model ?? "STANDARD"}
          defaultAmount={
            loan.collection_model === "DAILY_COLLECTION"
              ? loan.daily_payment ?? "120"
              : ""
          }
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false);
            loadAll();
          }}
        />
      )}

      {showRenew && (
        <RenewLoanModal
          loan={loan}
          onClose={() => setShowRenew(false)}
          onSuccess={() => {
            setShowRenew(false);
            loadAll();
          }}
        />
      )}

      {showSettle && (
        <SettleLoanModal
          loan={loan}
          onClose={() => setShowSettle(false)}
          onSuccess={() => {
            setShowSettle(false);
            loadAll();
          }}
        />
      )}

      {paymentToDelete && (
        <ConfirmModal
          title="Delete Payment"
          message={`Delete payment of ${fmt(paymentToDelete.amount_paid)} on ${paymentToDelete.payment_date}? This will restore the loan balance.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDeletePayment}
          onCancel={() => setPaymentToDelete(null)}
        />
      )}

      {confirmAction === "reactivate" && (
        <ConfirmModal
          title="Reactivate loan"
          message="Restore this defaulted loan to Active so collections can continue?"
          confirmLabel="Reactivate"
          confirmClass="bg-green-600 hover:bg-green-700"
          loading={actionBusy}
          onConfirm={runConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction === "default" && (
        <ConfirmModal
          title="Mark as defaulted"
          message="Freeze collections on this loan and mark it defaulted? You can reactivate later."
          confirmLabel="Mark Defaulted"
          confirmClass="bg-amber-600 hover:bg-amber-700"
          loading={actionBusy}
          onConfirm={runConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction === "writeoff" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel max-w-md space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              Write off loan
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              Close this loan as a write-off. Optionally record any amount recovered.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
                Amount recovered (₹)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={writeOffRecovered}
                onChange={(e) => setWriteOffRecovered(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={runConfirmAction}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionBusy ? "Processing..." : "Write Off"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

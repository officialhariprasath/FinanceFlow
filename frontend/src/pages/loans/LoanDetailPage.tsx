import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError } from "../../components/common/PageStates";
import ConfirmModal from "../../components/common/ConfirmModal";
import RecordPaymentModal from "../../components/loans/RecordPaymentModal";
import RenewLoanModal from "../../components/loans/RenewLoanModal";
import SettleLoanModal from "../../components/loans/SettleLoanModal";
import {
  getLoanById,
  getLoanStatement,
  getInterestSummary,
} from "../../services/loanService";
import { getLoanPayments, deletePayment } from "../../services/paymentService";
import { getLoanRenewals } from "../../services/renewalService";
import { fmt, statusBadge } from "../../utils/fmt";
import type { LoanResponse, LoanStatementResponse, InterestSummaryResponse } from "../../types/loan";
import type { PaymentResponse } from "../../types/payment";
import type { LoanRenewalResponse } from "../../types/renewal";

export default function LoanDetailPage() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const id = Number(loanId);

  const [loan, setLoan] = useState<LoanResponse | null>(null);
  const [statement, setStatement] = useState<LoanStatementResponse | null>(null);
  const [interest, setInterest] = useState<InterestSummaryResponse | null>(null);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [renewals, setRenewals] = useState<LoanRenewalResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [showPayment, setShowPayment] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      const [loanData, stmtData, intData, pmtData, rnwData] = await Promise.all([
        getLoanById(id),
        getLoanStatement(id),
        getInterestSummary(id),
        getLoanPayments(id),
        getLoanRenewals(id),
      ]);
      setLoan(loanData);
      setStatement(stmtData);
      setInterest(intData);
      setPayments(pmtData);
      setRenewals(rnwData);
    } catch {
      setError("Failed to load loan details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [id]);

  async function handleDeletePayment() {
    if (!paymentToDelete) return;
    try {
      setDeleting(true);
      setDeleteError("");
      await deletePayment(paymentToDelete.id);
      setPaymentToDelete(null);
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setDeleteError(typeof detail === "string" ? detail : "Failed to delete payment.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <MainLayout><PageLoading message="Loading loan details..." /></MainLayout>;
  if (error) return <MainLayout><PageError message={error} /></MainLayout>;
  if (!loan) return <MainLayout><PageError message="Loan not found." /></MainLayout>;

  const isActive = loan.status === "ACTIVE";
  const latestPaymentId = payments.length > 0 ? payments[0].id : null;

  return (
    <MainLayout>
      <div className="space-y-6">
        <button onClick={() => navigate("/loans")} className="text-sm text-blue-600 hover:underline">
          ← Back to Loans
        </button>

        {/* Loan header */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-800">Loan #{loan.id}</h1>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge(loan.status)}`}>
                  {loan.status}
                </span>
              </div>
              {statement && (
                <p className="mt-2 text-slate-600">
                  {statement.customer_name} · {statement.customer_phone}
                </p>
              )}
            </div>
            {isActive && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowPayment(true)}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Record Payment
                </button>
                <button
                  onClick={() => setShowRenew(true)}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Renew Loan
                </button>
                <button
                  onClick={() => setShowSettle(true)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Settle Loan
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loan details grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Customer name card — links to ledger */}
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-xs text-slate-500">Customer</p>
            <button
              onClick={() => navigate(`/customers/${loan.customer_id}/ledger`)}
              className="mt-1 font-semibold text-blue-600 hover:underline text-left"
            >
              {statement ? statement.customer_name : `#${loan.customer_id}`}
            </button>
            {statement && (
              <p className="text-xs text-slate-400 mt-0.5">{statement.customer_phone}</p>
            )}
          </div>

          {[
            ["Principal", fmt(loan.principal_amount)],
            ["Remaining Principal", fmt(loan.remaining_principal)],
            ["Principal Paid", fmt(loan.total_principal_paid)],
            ["Interest Paid", fmt(loan.total_interest_paid)],
            ["Interest Method", loan.interest_method === "PERCENTAGE" ? `${loan.interest_rate}% / month` : `₹${loan.interest_rate} per ₹100`],
            ["Issue Date", loan.issue_date],
            ["Due Date", loan.due_date],
            ["Closure Type", loan.closure_type || "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white p-4 shadow">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Interest summary */}
        {interest && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 font-semibold text-slate-800">Current Interest Summary</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-slate-500">Accrued Interest</p>
                <p className="mt-1 text-lg font-bold text-amber-600">{fmt(interest.accrued_interest)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-slate-500">Total Payable</p>
                <p className="mt-1 text-lg font-bold text-red-600">{fmt(interest.total_payable)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-slate-500">Remaining Principal</p>
                <p className="mt-1 text-lg font-bold">{fmt(interest.remaining_principal)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-slate-500">Calculated To</p>
                <p className="mt-1 text-lg font-bold">{interest.calculated_to}</p>
              </div>
            </div>
          </div>
        )}

        {/* Settlement info */}
        {loan.closure_type === "SETTLEMENT" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
            <h2 className="mb-3 font-semibold text-blue-800">Settlement Details</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div><p className="text-xs text-blue-600">Settlement Amount</p><p className="font-bold">{fmt(loan.settlement_amount)}</p></div>
              <div><p className="text-xs text-blue-600">Waived Amount</p><p className="font-bold">{fmt(loan.waived_amount)}</p></div>
              <div><p className="text-xs text-blue-600">Settlement Date</p><p className="font-bold">{loan.settlement_date || "—"}</p></div>
              <div><p className="text-xs text-blue-600">Reason</p><p className="font-bold">{loan.settlement_reason || "—"}</p></div>
            </div>
          </div>
        )}

        {/* Payment history */}
        <div className="rounded-lg bg-white shadow">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-semibold text-slate-800">Payment History</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {payments.length} payment{payments.length !== 1 ? "s" : ""}
            </span>
          </div>
          {deleteError && (
            <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-slate-600">Date</th>
                  <th className="px-4 py-3 text-right text-slate-600">Amount</th>
                  <th className="px-4 py-3 text-right text-slate-600">Interest</th>
                  <th className="px-4 py-3 text-right text-slate-600">Principal</th>
                  <th className="px-4 py-3 text-left text-slate-600">Mode</th>
                  <th className="px-4 py-3 text-left text-slate-600">Remarks</th>
                  {isActive && <th className="px-4 py-3 text-center text-slate-600">Action</th>}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No payments recorded.</td></tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3">{p.payment_date}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(p.amount_paid)}</td>
                      <td className="px-4 py-3 text-right">{fmt(p.interest_paid)}</td>
                      <td className="px-4 py-3 text-right">{fmt(p.principal_paid)}</td>
                      <td className="px-4 py-3">{p.payment_mode}</td>
                      <td className="px-4 py-3 text-slate-500">{p.remarks || "—"}</td>
                      {isActive && (
                        <td className="px-4 py-3 text-center">
                          {p.id === latestPaymentId && (
                            <button
                              onClick={() => { setDeleteError(""); setPaymentToDelete(p); }}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
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

        {/* Renewal history */}
        {renewals.length > 0 && (
          <div className="rounded-lg bg-white shadow">
            <div className="border-b px-6 py-4">
              <h2 className="font-semibold text-slate-800">Renewal History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
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
                    <tr key={r.id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3">{r.renewed_at.split("T")[0]}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">{r.renewal_type}</span>
                      </td>
                      <td className="px-4 py-3">{r.old_due_date}</td>
                      <td className="px-4 py-3">{r.new_due_date}</td>
                      <td className="px-4 py-3 text-right">{r.old_interest_rate} ({r.old_interest_method})</td>
                      <td className="px-4 py-3 text-right">{r.new_interest_rate} ({r.new_interest_method})</td>
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

      {showPayment && (
        <RecordPaymentModal
          loanId={id}
          onClose={() => setShowPayment(false)}
          onSuccess={() => { setShowPayment(false); loadAll(); }}
        />
      )}

      {showRenew && (
        <RenewLoanModal
          loan={loan}
          onClose={() => setShowRenew(false)}
          onSuccess={() => { setShowRenew(false); loadAll(); }}
        />
      )}

      {showSettle && (
        <SettleLoanModal
          loan={loan}
          onClose={() => setShowSettle(false)}
          onSuccess={() => { setShowSettle(false); loadAll(); }}
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
    </MainLayout>
  );
}

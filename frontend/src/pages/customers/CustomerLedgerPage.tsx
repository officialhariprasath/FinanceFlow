import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import CustomerForm from "../../components/customers/CustomerForm";
import NewLoanModal from "../../components/loans/NewLoanModal";

import {
  getCustomerLedger,
  updateCustomer,
} from "../../services/customerService";

import type { CustomerLedger } from "../../types/ledger";
import type { CustomerCreate } from "../../types/customer";
import { fmt } from "../../utils/fmt";

function CustomerLedgerPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showEditForm, setShowEditForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [showNewLoan, setShowNewLoan] = useState(false);

  async function loadLedger() {
    if (!customerId) return;
    try {
      setLoading(true);
      setError("");
      const data = await getCustomerLedger(Number(customerId));
      setLedger(data);
    } catch {
      setError("Failed to load customer ledger.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLedger();
  }, [customerId]);

  async function handleEditSubmit(data: CustomerCreate) {
    if (!customerId) return;
    try {
      setSaving(true);
      setEditError("");
      await updateCustomer(Number(customerId), data);
      await loadLedger();
      setShowEditForm(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setEditError(typeof detail === "string" ? detail : "Failed to update customer.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-slate-500">Loading customer ledger...</div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="space-y-4 p-6">
          <div className="rounded-lg alert-error border p-4 text-red-700">{error}</div>
          <button
            onClick={() => navigate("/customers")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            ← Back to Customers
          </button>
        </div>
      </MainLayout>
    );
  }

  if (!ledger) {
    return (
      <MainLayout>
        <div className="p-6 text-slate-500">Customer not found.</div>
      </MainLayout>
    );
  }

  const { customer, summary, loans } = ledger;

  return (
    <MainLayout>
      <div className="space-y-6">
        <button
          onClick={() => navigate("/customers")}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Customers
        </button>

        {/* Customer profile card */}
        <div className="surface-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="page-title">{customer.full_name}</h1>
              <p className="mt-2 text-slate-600">📞 {customer.phone}</p>
              {customer.permanent_address && (
                <p className="text-slate-600">📍 {customer.permanent_address}</p>
              )}
              {customer.temporary_address && (
                <p className="text-sm text-slate-500">Temp: {customer.temporary_address}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowNewLoan(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                New Loan
              </button>
              <button
                onClick={() => { setEditError(""); setShowEditForm(true); }}
                className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50"
              >
                Edit Customer
              </button>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["Total Loans", summary.total_loans, "text-slate-800"],
            ["Active Loans", summary.active_loans, "text-green-600"],
            ["Closed Loans", summary.closed_loans, "text-blue-600"],
            ["Total Outstanding", fmt(summary.total_outstanding), "text-red-600"],
            ["Total Principal", fmt(summary.total_principal), "text-slate-800"],
            ["Remaining Principal", fmt(summary.remaining_principal), "text-slate-800"],
            ["Interest Paid", fmt(summary.total_interest_paid), "text-slate-800"],
            ["Accrued Interest", fmt(summary.accrued_interest), "text-amber-600"],
          ].map(([label, value, color]) => (
            <div key={label as string} className="surface-card p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className={`mt-2 text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Loans */}
        <div className="space-y-5">
          {loans.length === 0 ? (
            <div className="surface-card p-10 text-center text-muted">
              No loans found for this customer.
            </div>
          ) : (
            loans.map((loan) => (
              <div key={loan.loan_id} className="surface-card">
                {/* Loan header */}
                <div className="flex flex-col gap-4 border-b bg-slate-50 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 md:grid-cols-5">
                    <div>
                      <p className="text-xs text-slate-500">Loan ID</p>
                      <button
                        onClick={() => navigate(`/loans/${loan.loan_id}`)}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        #{loan.loan_id}
                      </button>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Principal</p>
                      <p className="font-semibold text-slate-800">{fmt(loan.principal_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Outstanding</p>
                      <p className="font-semibold text-red-600">{fmt(loan.total_outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Issue Date</p>
                      <p className="text-slate-800">{loan.issue_date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Due Date</p>
                      <p className="text-slate-800">{loan.due_date}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                      loan.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : loan.status === "RENEWED"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {loan.status}
                  </span>
                </div>

                {/* Loan financial details */}
                <div className="p-5">
                  <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                      ["Remaining Principal", fmt(loan.remaining_principal), "text-slate-800"],
                      ["Principal Paid", fmt(loan.total_principal_paid), "text-slate-800"],
                      ["Interest Paid", fmt(loan.total_interest_paid), "text-slate-800"],
                      ["Accrued Interest", fmt(loan.accrued_interest), "text-amber-600"],
                    ].map(([label, value, color]) => (
                      <div key={label as string}>
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className={`font-semibold ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800">Payment History</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {loan.payments.length} payment{loan.payments.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {loan.payments.length === 0 ? (
                    <p className="text-sm text-slate-500">No payments recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b bg-slate-50">
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Amount</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Principal</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Interest</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Mode</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loan.payments.map((payment, index) => (
                            <tr key={index} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="px-3 py-2 text-slate-700">{payment.payment_date}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-800">{fmt(payment.amount_paid)}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{fmt(payment.principal_paid)}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{fmt(payment.interest_paid)}</td>
                              <td className="px-3 py-2 text-slate-700">{payment.payment_mode}</td>
                              <td className="px-3 py-2 text-slate-500">{payment.remarks || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit customer modal */}
      {showEditForm && (
        <div className="modal-backdrop">
          <div className="w-full max-w-lg rounded-xl bg-white p-1 shadow-xl dark:bg-slate-800">
            {editError && (
              <div className="mb-3 rounded-lg alert-error border p-3 text-sm text-red-700">
                {editError}
              </div>
            )}
            <CustomerForm
              initialData={{
                id: customer.id,
                full_name: customer.full_name,
                phone: customer.phone,
                permanent_address: customer.permanent_address ?? "",
                temporary_address: customer.temporary_address ?? "",
              }}
              loading={saving}
              onSubmit={handleEditSubmit}
              onCancel={() => { setShowEditForm(false); setEditError(""); }}
            />
          </div>
        </div>
      )}

      {/* New loan modal */}
      {showNewLoan && (
        <NewLoanModal
          preselectedCustomerId={customer.id}
          onClose={() => setShowNewLoan(false)}
          onSuccess={() => { setShowNewLoan(false); loadLedger(); }}
        />
      )}
    </MainLayout>
  );
}

export default CustomerLedgerPage;

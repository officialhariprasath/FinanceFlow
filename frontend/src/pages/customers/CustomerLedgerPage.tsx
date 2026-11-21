import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";
import CustomerForm from "../../components/customers/CustomerForm";
import CustomerKycDetails from "../../components/customers/CustomerKycDetails";
import DeleteCustomerModal from "../../components/customers/DeleteCustomerModal";
import NewLoanModal from "../../components/loans/NewLoanModal";
import CreditScoreGauge from "../../components/credit/CreditScoreGauge";

import {
  deleteCustomer,
  getCustomerLedger,
  updateCustomer,
} from "../../services/customerService";
import type { CustomerLedger } from "../../types/ledger";
import type { Customer, CustomerCreate } from "../../types/customer";
import type { CreditScore } from "../../types/creditScore";
import { fmt } from "../../utils/fmt";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { kycStatusLabel } from "../../utils/customerKycDisplay";

type TabId = "overview" | "details" | "loans";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

function CustomerLedgerPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const isDesktop = useIsDesktop();
  const { hasPermission } = useAuth();
  const canCreateLoan =
    hasPermission("loans.create") || hasPermission("loans.request");
  const canEditCustomer = hasPermission("customers.edit");
  const canDeleteCustomer = hasPermission("customers.delete");

  const tab = (searchParams.get("tab") as TabId) || "overview";
  const activeTab: TabId = ["overview", "details", "loans"].includes(tab)
    ? tab
    : "overview";

  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadLedger() {
    if (!customerId) return;
    try {
      setLoading(true);
      setError("");
      setLedger(await getCustomerLedger(Number(customerId)));
    } catch {
      setError("Failed to load customer ledger.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLedger();
  }, [customerId]);

  function setTab(id: TabId) {
    setSearchParams({ tab: id }, { replace: true });
  }

  async function handleEditSubmit(data: CustomerCreate) {
    if (!customerId) return;
    try {
      setSaving(true);
      setEditError("");
      await updateCustomer(Number(customerId), data);
      await loadLedger();
      setShowEditForm(false);
      toast.success("Customer updated.");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setEditError(typeof detail === "string" ? detail : "Failed to update customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!customerId) return;
    try {
      setDeleting(true);
      await deleteCustomer(Number(customerId));
      toast.success("Customer deleted.");
      navigate("/customers");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to delete customer.");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  function openEdit() {
    if (isDesktop && customerId) {
      navigate(`/customers/${customerId}/edit`);
      return;
    }
    setEditError("");
    setShowEditForm(true);
  }

  const hasActiveLoan = useMemo(
    () => !!ledger?.loans.some((l) => l.status === "ACTIVE"),
    [ledger]
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-slate-500">Loading customer ledger...</div>
      </MainLayout>
    );
  }

  if (error || !ledger) {
    return (
      <MainLayout>
        <div className="space-y-4 p-6">
          <div className="rounded-lg alert-error border p-4 text-red-700">
            {error || "Customer not found."}
          </div>
          <button
            type="button"
            onClick={() => navigate("/customers")}
            className="rounded-lg border px-4 py-2"
          >
            ← Back to Customers
          </button>
        </div>
      </MainLayout>
    );
  }

  const { customer, summary, loans } = ledger;
  const customerProfile = customer as Customer;
  const kycChip = kycStatusLabel(customerProfile);
  const score = ledger.credit_score
    ? ({ ...ledger.credit_score, reasons: ledger.credit_score.reasons || [] } as CreditScore)
    : null;

  return (
    <MainLayout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate("/customers")}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Customers
        </button>

        <div className="surface-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="page-title">{customer.full_name}</h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    kycChip.tone === "ok"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {kycChip.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {customer.display_code || `#${customer.id}`} · {customer.phone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCreateLoan && (
                <button
                  type="button"
                  onClick={() => setShowNewLoan(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  New Loan
                </button>
              )}
              {canEditCustomer && (
                <button
                  type="button"
                  onClick={openEdit}
                  className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50"
                >
                  Edit
                </button>
              )}
              {canDeleteCustomer && (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2 border-b border-slate-200 dark:border-slate-700">
            {(
              [
                ["overview", "Overview"],
                ["details", "Details"],
                ["loans", "Loans"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`border-b-2 px-4 py-2 text-sm font-medium ${
                  activeTab === id
                    ? "border-blue-600 text-blue-700 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
            <Link
              to={`/customers/${customerId}/score`}
              className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Score
            </Link>
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <CreditScoreGauge score={score} />
              <Link
                to={`/customers/${customerId}/score`}
                className="inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                Score details →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Total Loans", summary.total_loans],
                ["Active Loans", summary.active_loans],
                ["Closed Loans", summary.closed_loans],
                ["Outstanding", fmt(summary.total_outstanding)],
                ["Principal", fmt(summary.total_principal)],
                ["Remaining", fmt(summary.remaining_principal)],
                ["Interest paid", fmt(summary.total_interest_paid)],
                ["Accrued interest", fmt(summary.accrued_interest)],
              ].map(([label, value]) => (
                <div key={label as string} className="surface-card p-4">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "details" && (
          <CustomerKycDetails customer={customerProfile} />
        )}

        {activeTab === "loans" && (
          <div className="space-y-5">
            {loans.length === 0 ? (
              <div className="surface-card p-10 text-center text-muted">
                No loans found for this customer.
              </div>
            ) : (
              loans.map((loan) => (
                <div key={loan.loan_id} className="surface-card">
                  <div className="flex flex-col gap-4 border-b bg-slate-50 p-5 md:flex-row md:items-center md:justify-between dark:bg-slate-800/50">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 md:grid-cols-5">
                      <div>
                        <p className="text-xs text-slate-500">Loan ID</p>
                        <button
                          type="button"
                          onClick={() => navigate(`/loans/${loan.loan_id}`)}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {loan.display_code || `#${loan.loan_id}`}
                        </button>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Principal</p>
                        <p className="font-semibold">{fmt(loan.principal_amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Outstanding</p>
                        <p className="font-semibold text-red-600">
                          {fmt(loan.total_outstanding)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Issue</p>
                        <p>{loan.issue_date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Due</p>
                        <p>{loan.due_date}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                        loan.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {loan.status}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">
                      Payment History
                    </h3>
                    {loan.payments.length === 0 ? (
                      <p className="text-sm text-slate-500">No payments recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b bg-slate-50">
                              <th className="px-3 py-2 text-left">Date</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                              <th className="px-3 py-2 text-right">Principal</th>
                              <th className="px-3 py-2 text-right">Interest</th>
                              <th className="px-3 py-2 text-left">Mode</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loan.payments.map((payment, index) => (
                              <tr key={index} className="border-b last:border-0">
                                <td className="px-3 py-2">{payment.payment_date}</td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {fmt(payment.amount_paid)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {fmt(payment.principal_paid)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {fmt(payment.interest_paid)}
                                </td>
                                <td className="px-3 py-2">{payment.payment_mode}</td>
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
        )}
      </div>

      {showEditForm && (
        <div className="modal-backdrop">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-800">
            {editError && (
              <div className="mx-4 mt-4 rounded-lg alert-error border p-3 text-sm text-red-700">
                {editError}
              </div>
            )}
            <CustomerForm
              initialData={customerProfile}
              loading={saving}
              onSubmit={handleEditSubmit}
              onCancel={() => {
                setShowEditForm(false);
                setEditError("");
              }}
            />
          </div>
        </div>
      )}

      <DeleteCustomerModal
        customer={deleteOpen ? customerProfile : null}
        hasActiveLoans={hasActiveLoan}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {showNewLoan && (
        <NewLoanModal
          preselectedCustomerId={customer.id}
          onClose={() => setShowNewLoan(false)}
          onSuccess={() => {
            setShowNewLoan(false);
            loadLedger();
            setTab("loans");
          }}
        />
      )}
    </MainLayout>
  );
}

export default CustomerLedgerPage;

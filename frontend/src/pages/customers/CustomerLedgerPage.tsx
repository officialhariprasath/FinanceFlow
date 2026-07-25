import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import MainLayout from "../../components/layout/MainLayout";

import { getCustomerLedger } from "../../services/customerService";

import type { CustomerLedger } from "../../types/ledger";

function CustomerLedgerPage() {
  const { customerId } = useParams();

  const [ledger, setLedger] = useState<CustomerLedger | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLedger() {
      if (!customerId) return;

      try {
        setLoading(true);
        setError("");

        const response = await getCustomerLedger(Number(customerId));

        setLedger(response);
      } catch {
        setError("Failed to load customer ledger.");
      } finally {
        setLoading(false);
      }
    }

    loadLedger();
  }, [customerId]);

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">Loading customer ledger...</div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="p-6 text-red-600">{error}</div>
      </MainLayout>
    );
  }

  if (!ledger) {
    return (
      <MainLayout>
        <div className="p-6">No customer found.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
            {ledger.customer.full_name}
            </h1>

            <p className="mt-2 text-slate-600">
            📞 {ledger.customer.phone}
            </p>

            <p className="text-slate-600">
                📍 {ledger.customer.address}
                </p>
            </div>

            <div className="flex flex-wrap gap-3">
            <button className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700">
                New Loan
            </button>

            <button className="rounded-lg bg-green-600 px-5 py-2 font-medium text-white hover:bg-green-700">
                Record Payment
            </button>

            <button className="rounded-lg bg-amber-500 px-5 py-2 font-medium text-white hover:bg-amber-600">
                Renew Loan
            </button>

            <button className="rounded-lg bg-slate-700 px-5 py-2 font-medium text-white hover:bg-slate-800">
                Print Statement
            </button>
            </div>
            </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
                <p className="text-sm text-slate-500">Total Loans</p>
                <p className="mt-2 text-2xl font-bold">
                {ledger.summary.total_loans}
                </p>
            </div>

            <div className="rounded-lg border p-4">
                <p className="text-sm text-slate-500">Active Loans</p>
                <p className="mt-2 text-2xl font-bold text-green-600">
                {ledger.summary.active_loans}
                </p>
            </div>

            <div className="rounded-lg border p-4">
                <p className="text-sm text-slate-500">Closed Loans</p>
                <p className="mt-2 text-2xl font-bold text-blue-600">
                {ledger.summary.closed_loans}
                </p>
            </div>

            <div className="rounded-lg border p-4">
                <p className="text-sm text-slate-500">Outstanding</p>
                <p className="mt-2 text-2xl font-bold text-red-600">
                ₹ {ledger.summary.total_outstanding}
                </p>
            </div>
            </div>

            <div className="space-y-5">
            {ledger.loans.map((loan) => (
                <div
                key={loan.loan_id}
                className="rounded-lg bg-white shadow"
                >
                <div className="grid grid-cols-6 gap-4 border-b p-5">
                    <div>
                    <p className="text-sm text-slate-500">Loan ID</p>
                    <p className="font-semibold">{loan.loan_id}</p>
                    </div>

                    <div>
                    <p className="text-sm text-slate-500">Principal</p>
                    <p className="font-semibold">
                        ₹ {loan.principal_amount}
                    </p>
                    </div>

                    <div>
                    <p className="text-sm text-slate-500">Outstanding</p>
                    <p className="font-semibold text-red-600">
                        ₹ {loan.total_outstanding}
                    </p>
                    </div>

                    <div>
                    <p className="text-sm text-slate-500">Issue Date</p>
                    <p>{loan.issue_date}</p>
                    </div>

                    <div>
                    <p className="text-sm text-slate-500">Due Date</p>
                    <p>{loan.due_date}</p>
                    </div>

                    <div>
                    <p className="text-sm text-slate-500">Status</p>

                    <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                        loan.status === "ACTIVE"
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                    >
                        {loan.status}
                    </span>
                    </div>
                </div>

                <div className="p-5">
                    <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-5">
                        <div>
                        <p className="text-sm text-slate-500">
                            Remaining Principal
                        </p>

                        <p className="font-semibold">
                            ₹ {loan.remaining_principal}
                        </p>
                        </div>

                        <div>
                        <p className="text-sm text-slate-500">
                            Principal Paid
                        </p>

                        <p className="font-semibold">
                            ₹ {loan.total_principal_paid}
                        </p>
                        </div>

                        <div>
                        <p className="text-sm text-slate-500">
                            Interest Paid
                        </p>

                        <p className="font-semibold">
                            ₹ {loan.total_interest_paid}
                        </p>
                        </div>

                        <div>
                        <p className="text-sm text-slate-500">
                            Accrued Interest
                        </p>

                        <p className="font-semibold">
                            ₹ {loan.accrued_interest}
                        </p>
                        </div>

                        <div className="flex items-end justify-end gap-2">
                        <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                            Payment
                        </button>

                        <button className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">
                            Renew
                        </button>
                        </div>
                    </div>

                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold">
                            Payment History
                        </h3>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                            {loan.payments.length} Payment
                            {loan.payments.length !== 1 ? "s" : ""}
                        </span>
                        </div>

                    {loan.payments.length === 0 ? (
                        <p className="text-slate-500">
                        No payments available.
                        </p>
                    ) : (
                        <table className="min-w-full">
                        <thead>
                            <tr className="border-b">
                            <th className="py-2 text-left">
                                Date
                            </th>
                            <th className="py-2 text-left">
                                Amount
                            </th>
                            <th className="py-2 text-left">
                                Principal
                            </th>
                            <th className="py-2 text-left">
                                Interest
                            </th>
                            <th className="py-2 text-left">
                                Mode
                            </th>
                            <th className="py-2 text-left">
                                Remarks
                            </th>
                            <th className="py-2 text-center">
                              Actions
                            </th>
                            </tr>
                        </thead>

                        <tbody>
                            {loan.payments.map((payment, index) => (
                            <tr
                                key={index}
                                className="border-b"
                            >
                                <td className="py-2">
                                {payment.payment_date}
                                </td>

                                <td className="py-2">
                                ₹ {payment.amount_paid}
                                </td>

                                <td className="py-2">
                                ₹ {payment.principal_paid}
                                </td>

                                <td className="py-2">
                                ₹ {payment.interest_paid}
                                </td>

                                <td className="py-2">
                                {payment.payment_mode}
                                </td>

                                <td className="py-2">
                                    {payment.remarks}
                                    </td>

                                    <td className="py-2 text-center">
                                    <button className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    )}
                    </div>
                </div>
            ))}
            </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default CustomerLedgerPage;
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError, EmptyState } from "../../components/common/PageStates";
import { getLoans } from "../../services/loanService";
import { getLoanPayments } from "../../services/paymentService";
import { fmt } from "../../utils/fmt";
import type { PaymentResponse } from "../../types/payment";

interface PaymentRow extends PaymentResponse {
  customer_id: number;
}

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const loans = await getLoans();

        // Fetch payments for all loans in parallel
        const results = await Promise.all(
          loans.map(async (loan) => {
            try {
              const pmts = await getLoanPayments(loan.id);
              return pmts.map((p) => ({
                ...p,
                customer_id: loan.customer_id,
              }));
            } catch {
              return [];
            }
          })
        );

        // Flatten and sort newest first
        const all: PaymentRow[] = results
          .flat()
          .sort(
            (a, b) =>
              new Date(b.payment_date).getTime() -
              new Date(a.payment_date).getTime() ||
              b.id - a.id
          );

        setPayments(all);
      } catch {
        setError("Failed to load payments.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Payments</h1>
          <p className="mt-1 text-slate-500">
            {!loading && !error
              ? `${payments.length} payment${payments.length !== 1 ? "s" : ""} recorded`
              : "Complete payment history across all loans"}
          </p>
        </div>

        {error && <PageError message={error} />}

        {loading ? (
          <PageLoading message="Loading payments..." />
        ) : payments.length === 0 ? (
          <EmptyState message="No payments recorded yet." />
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Loan ID
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Amount Paid
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Interest
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Principal
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">
                    Mode
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Remarks
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{p.payment_date}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/loans/${p.loan_id}`)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        #{p.loan_id}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {fmt(p.amount_paid)}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600">
                      {fmt(p.interest_paid)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {fmt(p.principal_paid)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.remarks || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => navigate(`/loans/${p.loan_id}`)}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        View Loan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

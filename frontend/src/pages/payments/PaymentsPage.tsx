import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError, EmptyState } from "../../components/common/PageStates";
import { getLoans } from "../../services/loanService";
import { getLoanPayments } from "../../services/paymentService";
import api from "../../api/axios";
import { fmt } from "../../utils/fmt";
import type { PaymentResponse } from "../../types/payment";

interface PaymentRow extends PaymentResponse {
  customer_id: number;
  customer_name: string;
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

        // Build customer name map
        let customerMap: Record<number, string> = {};
        try {
          const res = await api.get<{ id: number; full_name: string }[]>("/customers/names");
          res.data.forEach((c) => { customerMap[c.id] = c.full_name; });
        } catch {
          // non-critical — fall back to customer_id
        }

        // Fetch payments for all loans in parallel
        const results = await Promise.all(
          loans.map(async (loan) => {
            try {
              const pmts = await getLoanPayments(loan.id);
              return pmts.map((p) => ({
                ...p,
                customer_id: loan.customer_id,
                customer_name: customerMap[loan.customer_id] ?? "",
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
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">
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
          <div className="surface-card overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Loan ID</th>
                  <th className="text-right">Amount Paid</th>
                  <th className="text-right">Interest</th>
                  <th className="text-right">Principal</th>
                  <th className="text-center">Mode</th>
                  <th>Remarks</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 table-cell-strong">{p.payment_date}</td>
                    <td className="px-4 py-3 table-cell-strong">
                      {p.customer_name || `#${p.customer_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/loans/${p.loan_id}`)}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        #{p.loan_id}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right table-cell-strong">
                      {fmt(p.amount_paid)}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">
                      {fmt(p.interest_paid)}
                    </td>
                    <td className="px-4 py-3 text-right table-cell">
                      {fmt(p.principal_paid)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.remarks || "—"}</td>
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

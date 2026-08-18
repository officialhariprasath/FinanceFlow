import { useNavigate } from "react-router-dom";
import type { RecentPaymentItem } from "../../types/dashboard";
import { fmt } from "../../utils/fmt";

export default function RecentPaymentsTable({ payments }: { payments: RecentPaymentItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <h2 className="section-title">Recent Payments</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table text-sm">
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Customer</th>
              <th>Loan ID</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Interest</th>
              <th className="text-right">Principal</th>
              <th className="text-center">Mode</th>
              <th className="text-center">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted">
                  No recent payments.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/loans/${p.loan_id}`)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <td>#{p.id}</td>
                  <td className="font-medium">{p.customer_name || "—"}</td>
                  <td>#{p.loan_id}</td>
                  <td className="text-right font-medium">{fmt(p.amount_paid)}</td>
                  <td className="text-right">{fmt(p.interest_paid)}</td>
                  <td className="text-right">{fmt(p.principal_paid)}</td>
                  <td className="text-center">{p.payment_mode}</td>
                  <td className="text-center">{p.payment_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

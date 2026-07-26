import { useNavigate } from "react-router-dom";
import type { RecentPaymentItem } from "../../types/dashboard";
import { fmt } from "../../utils/fmt";

export default function RecentPaymentsTable({ payments }: { payments: RecentPaymentItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg bg-white shadow">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Recent Payments</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left">Payment ID</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Loan ID</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Interest</th>
              <th className="px-4 py-3 text-right">Principal</th>
              <th className="px-4 py-3 text-center">Mode</th>
              <th className="px-4 py-3 text-center">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  No recent payments.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/loans/${p.loan_id}`)}
                  className="cursor-pointer border-t hover:bg-slate-50"
                >
                  <td className="px-4 py-3">#{p.id}</td>
                  <td className="px-4 py-3 font-medium">{p.customer_name || "—"}</td>
                  <td className="px-4 py-3">#{p.loan_id}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(p.amount_paid)}</td>
                  <td className="px-4 py-3 text-right">{fmt(p.interest_paid)}</td>
                  <td className="px-4 py-3 text-right">{fmt(p.principal_paid)}</td>
                  <td className="px-4 py-3 text-center">{p.payment_mode}</td>
                  <td className="px-4 py-3 text-center">{p.payment_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import type { RecentLoanItem } from "../../types/dashboard";
import { fmt, statusBadge } from "../../utils/fmt";

export default function RecentLoansTable({ loans }: { loans: RecentLoanItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg bg-white shadow">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Recent Loans</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left">Loan ID</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-right">Principal</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Issue Date</th>
              <th className="px-4 py-3 text-center">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No recent loans.
                </td>
              </tr>
            ) : (
              loans.map((loan) => (
                <tr
                  key={loan.id}
                  onClick={() => navigate(`/loans/${loan.id}`)}
                  className="cursor-pointer border-t hover:bg-slate-50"
                >
                  <td className="px-4 py-3">#{loan.id}</td>
                  <td className="px-4 py-3 font-medium">{loan.customer_name || `#${loan.customer_id}`}</td>
                  <td className="px-4 py-3 text-right">{fmt(loan.principal_amount)}</td>
                  <td className="px-4 py-3 text-right">{fmt(loan.remaining_principal)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${statusBadge(loan.status)}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{loan.issue_date}</td>
                  <td className="px-4 py-3 text-center">{loan.due_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

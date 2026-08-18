import { useNavigate } from "react-router-dom";
import type { RecentLoanItem } from "../../types/dashboard";
import { fmt } from "../../utils/fmt";
import StatusChip from "../common/StatusChip";

export default function RecentLoansTable({ loans }: { loans: RecentLoanItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <h2 className="section-title">Recent Loans</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table text-sm">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Customer</th>
              <th className="text-right">Principal</th>
              <th className="text-right">Remaining</th>
              <th className="text-center">Status</th>
              <th className="text-center">Issue Date</th>
              <th className="text-center">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No recent loans.
                </td>
              </tr>
            ) : (
              loans.map((loan) => (
                <tr
                  key={loan.id}
                  onClick={() => navigate(`/loans/${loan.id}`)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <td>#{loan.id}</td>
                  <td className="font-medium">{loan.customer_name || `#${loan.customer_id}`}</td>
                  <td className="text-right">{fmt(loan.principal_amount)}</td>
                  <td className="text-right">{fmt(loan.remaining_principal)}</td>
                  <td className="text-center">
                    <StatusChip status={loan.status} />
                  </td>
                  <td className="text-center">{loan.issue_date}</td>
                  <td className="text-center">{loan.due_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

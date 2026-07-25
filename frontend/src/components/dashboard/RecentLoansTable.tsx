import type { RecentLoan } from "../../types/dashboard";

type RecentLoansTableProps = {
  loans: RecentLoan[];
};

export default function RecentLoansTable({
  loans,
}: RecentLoansTableProps) {
  return (
    <div className="rounded-lg bg-white shadow">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Recent Loans</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left">Loan ID</th>
              <th className="px-4 py-3 text-left">Customer ID</th>
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
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No recent loans found.
                </td>
              </tr>
            ) : (
              loans.map((loan) => (
                <tr
                  key={loan.id}
                  className="border-t hover:bg-slate-50"
                >
                  <td className="px-4 py-3">{loan.id}</td>

                  <td className="px-4 py-3">
                    {loan.customer_id}
                  </td>

                  <td className="px-4 py-3 text-right">
                    ₹
                    {Number(
                      loan.principal_amount
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-4 py-3 text-right">
                    ₹
                    {Number(
                      loan.remaining_principal
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        loan.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {loan.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    {loan.issue_date}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {loan.due_date}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
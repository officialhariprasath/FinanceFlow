import type { RecentPayment } from "../../types/dashboard";

type RecentPaymentsTableProps = {
  payments: RecentPayment[];
};

export default function RecentPaymentsTable({
  payments,
}: RecentPaymentsTableProps) {
  return (
    <div className="rounded-lg bg-white shadow">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Recent Payments</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left">Payment ID</th>
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
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No recent payments found.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-t hover:bg-slate-50"
                >
                  <td className="px-4 py-3">{payment.id}</td>

                  <td className="px-4 py-3">
                    {payment.loan_id}
                  </td>

                  <td className="px-4 py-3 text-right">
                    ₹
                    {Number(
                      payment.amount_paid
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-4 py-3 text-right">
                    ₹
                    {Number(
                      payment.interest_paid
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-4 py-3 text-right">
                    ₹
                    {Number(
                      payment.principal_paid
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {payment.payment_mode}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {payment.payment_date}
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
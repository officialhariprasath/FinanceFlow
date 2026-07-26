import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import { PageLoading, PageError, EmptyState } from "../../components/common/PageStates";
import { getLoans } from "../../services/loanService";
import { getLoanRenewals } from "../../services/renewalService";
import api from "../../api/axios";
import { fmt } from "../../utils/fmt";
import type { LoanRenewalResponse } from "../../types/renewal";

interface RenewalRow extends LoanRenewalResponse {
  customer_id: number;
}

export default function RenewalsPage() {
  const navigate = useNavigate();
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [loans, namesRes] = await Promise.all([
          getLoans(),
          api
            .get<{ id: number; full_name: string }[]>("/customers/names")
            .catch(() => ({ data: [] })),
        ]);

        const map: Record<number, string> = {};
        namesRes.data.forEach((c) => {
          map[c.id] = c.full_name;
        });
        setCustomerMap(map);

        const all: RenewalRow[] = [];
        await Promise.all(
          loans.map(async (loan) => {
            try {
              const rnws = await getLoanRenewals(loan.id);
              rnws.forEach((r) =>
                all.push({ ...r, customer_id: loan.customer_id })
              );
            } catch {
              // loan has no renewals — skip
            }
          })
        );

        all.sort(
          (a, b) =>
            new Date(b.renewed_at).getTime() - new Date(a.renewed_at).getTime()
        );
        setRenewals(all);
      } catch {
        setError("Failed to load renewals.");
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
          <h1 className="text-3xl font-bold text-slate-800">Loan Renewals</h1>
          <p className="mt-1 text-slate-500">
            {!loading && !error
              ? `${renewals.length} renewal${renewals.length !== 1 ? "s" : ""} recorded`
              : "Complete renewal history across all loans"}
          </p>
        </div>

        {error && <PageError message={error} />}

        {loading ? (
          <PageLoading message="Loading renewals..." />
        ) : renewals.length === 0 ? (
          <EmptyState message="No loan renewals found." />
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Renewed On
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Loan
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Old Due
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    New Due
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Old Rate
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    New Rate
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    New Principal
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {renewals.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/loans/${r.old_loan_id}`)}
                    className="cursor-pointer border-t hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      {r.renewed_at.split("T")[0]}
                    </td>
                    <td className="px-4 py-3 font-medium text-blue-600">
                      #{r.old_loan_id}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {customerMap[r.customer_id] ??
                        `Customer #${r.customer_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                        {r.renewal_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.old_due_date}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.new_due_date}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {r.old_interest_rate}
                      <span className="ml-1 text-xs text-slate-400">
                        ({r.old_interest_method === "PERCENTAGE" ? "%" : "₹/₹100"})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {r.new_interest_rate}
                      <span className="ml-1 text-xs text-slate-400">
                        ({r.new_interest_method === "PERCENTAGE" ? "%" : "₹/₹100"})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {fmt(r.new_principal)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.remarks || "—"}
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

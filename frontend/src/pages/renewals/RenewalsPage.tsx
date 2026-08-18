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
          <h1 className="page-title">Loan Renewals</h1>
          <p className="page-subtitle">
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
          <div className="surface-card overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th>Renewed On</th>
                  <th>Loan</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Old Due</th>
                  <th>New Due</th>
                  <th className="text-right">Old Rate</th>
                  <th className="text-right">New Rate</th>
                  <th className="text-right">New Principal</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {renewals.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/loans/${r.old_loan_id}`)}
                    className="cursor-pointer border-t hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-4 py-3">
                      {r.renewed_at.split("T")[0]}
                    </td>
                    <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                      #{r.old_loan_id}
                    </td>
                    <td className="px-4 py-3 table-cell-strong">
                      {customerMap[r.customer_id] ??
                        `Customer #${r.customer_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                        {r.renewal_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 table-cell">{r.old_due_date}</td>
                    <td className="px-4 py-3 table-cell">{r.new_due_date}</td>
                    <td className="px-4 py-3 text-right table-cell">
                      {r.old_interest_rate}
                      <span className="ml-1 text-xs text-muted">
                        ({r.old_interest_method === "PERCENTAGE" ? "%" : "₹/₹100"})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right table-cell">
                      {r.new_interest_rate}
                      <span className="ml-1 text-xs text-muted">
                        ({r.new_interest_method === "PERCENTAGE" ? "%" : "₹/₹100"})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right table-cell-strong">
                      {fmt(r.new_principal)}
                    </td>
                    <td className="px-4 py-3 text-muted">
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

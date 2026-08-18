import { useEffect, useState } from "react";

import MainLayout from "../../components/layout/MainLayout";
import { PageError, PageLoading } from "../../components/common/PageStates";
import { getBusinessLedger } from "../../services/extendedService";
import type { LedgerEntry } from "../../services/extendedService";
import { fmt } from "../../utils/fmt";

export default function LedgersPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "CAPITAL" | "PROFIT">("ALL");

  async function load() {
    try {
      setLoading(true);
      setError("");
      setEntries(await getBusinessLedger());
    } catch {
      setError("Failed to load ledger.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible =
    filter === "ALL" ? entries : entries.filter((e) => e.ledger === filter);

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading ledger..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <PageError message={error} onRetry={load} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Business Ledger</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Combined capital and profit transactions</p>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            <option value="CAPITAL">Capital only</option>
            <option value="PROFIT">Profit only</option>
          </select>
        </div>

        <div className="table-shell">
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Ledger</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Balance</th>
                <th className="px-4 py-3 text-left">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((e) => (
                <tr key={`${e.ledger}-${e.id}`}>
                  <td className="px-4 py-3">{new Date(e.created_at).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">{e.ledger}</td>
                  <td className="px-4 py-3">{e.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 font-medium">
                    {e.direction === "CREDIT" ? "+" : "-"}
                    {fmt(e.amount)}
                  </td>
                  <td className="px-4 py-3">{fmt(e.balance_after)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{e.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}

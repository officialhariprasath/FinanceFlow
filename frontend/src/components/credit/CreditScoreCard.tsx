import { useState } from "react";
import type { CreditScore } from "../../types/creditScore";
import { fmt } from "../../utils/fmt";

function bandClass(band: string): string {
  switch (band) {
    case "EXCELLENT":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "GOOD":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
    case "FAIR":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "POOR":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  }
}

function bandLabel(band: string): string {
  if (band === "THIN_FILE") return "Thin file";
  return band.charAt(0) + band.slice(1).toLowerCase();
}

export default function CreditScoreCard({
  score,
  onRefresh,
  refreshing,
  compact = false,
}: {
  score: CreditScore | null | undefined;
  onRefresh?: () => void;
  refreshing?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!score) {
    return (
      <div className="surface-card p-5">
        <h2 className="section-title">Credit score</h2>
        <p className="mt-2 text-sm text-slate-500">Score unavailable.</p>
      </div>
    );
  }

  return (
    <div className="surface-card p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="section-title">Credit score</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${bandClass(score.band)}`}>
              {bandLabel(score.band)}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {score.file_type === "THIN" ? "Thin file" : "Established"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Advisory only — does not block new loans
          </p>
          <p className={`mt-3 font-bold text-slate-900 dark:text-slate-100 ${compact ? "text-3xl" : "text-4xl"}`}>
            {score.score}
            <span className="ml-1 text-lg font-medium text-slate-500">/ 1000</span>
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Suggested next loan (advisory):{" "}
            <span className="font-semibold">{fmt(score.suggested_max_amount)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Suggested = avg of previous loans × score-band multiplier (CIBIL-style). Starter baseline ₹2,000.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {open ? "Hide reasons" : "Why this score"}
          </button>
          {onRefresh && (
            <button
              type="button"
              disabled={refreshing}
              onClick={onRefresh}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh score"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <ul className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          {(score.reasons || []).length === 0 ? (
            <li className="text-sm text-slate-500">No reason codes.</li>
          ) : (
            score.reasons.map((r) => (
              <li
                key={`${r.code}-${r.points}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-slate-700 dark:text-slate-200">{r.label}</span>
                <span
                  className={`font-medium ${
                    r.points > 0 ? "text-green-700" : r.points < 0 ? "text-red-700" : "text-slate-500"
                  }`}
                >
                  {r.points > 0 ? `+${r.points}` : r.points}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

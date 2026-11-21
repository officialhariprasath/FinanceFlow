import type { CreditScore } from "../../types/creditScore";
import { buildScoreFactors } from "../../utils/creditScoreGaugeGeometry";
import { fmt } from "../../utils/fmt";

const toneBar: Record<string, string> = {
  good: "bg-teal-500",
  warn: "bg-amber-400",
  neutral: "bg-slate-300",
};

export default function CreditFactorsGrid({
  score,
}: {
  score: CreditScore | null | undefined;
}) {
  if (!score) return null;
  const factors = buildScoreFactors(score);

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Credit factors
          </h2>
          <p className="text-sm text-slate-500">
            What drives this advisory score
          </p>
        </div>
        <p className="text-sm text-slate-600">
          Suggested next loan:{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {fmt(score.suggested_max_amount)}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {factors.map((f) => (
          <div
            key={f.id}
            className="flex overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800/60"
          >
            <div className={`w-1.5 shrink-0 ${toneBar[f.tone]}`} />
            <div className="px-4 py-3">
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {f.value}
              </p>
              <p className="text-sm text-slate-500">{f.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

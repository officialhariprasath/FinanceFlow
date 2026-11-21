import { useEffect, useId, useState } from "react";
import type { CreditScore } from "../../types/creditScore";
import {
  GAUGE_SEGMENTS,
  SCORE_MAX,
  arcPath,
  bandLabel,
  bandMessage,
  clampScore,
  formatScoreUpdatedAt,
  polar,
  scoreToAngle,
  segmentArcAngles,
} from "../../utils/creditScoreGaugeGeometry";

export default function CreditScoreGauge({
  score,
  size = 280,
  showHeader = true,
}: {
  score: CreditScore | null | undefined;
  size?: number;
  showHeader?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const [animated, setAnimated] = useState(0);
  const value = score?.score ?? 0;

  useEffect(() => {
    setAnimated(0);
    const t = window.setTimeout(() => setAnimated(clampScore(value)), 30);
    return () => window.clearTimeout(t);
  }, [value]);

  const width = size;
  const height = size * 0.72;
  const cx = width / 2;
  const cy = height * 0.78;
  const r = size * 0.36;
  const strokeW = size * 0.085;
  const needleAngle = scoreToAngle(animated);
  const tip = polar(cx, cy, r - strokeW * 0.55, needleAngle);
  const updated = formatScoreUpdatedAt(score?.computed_at);

  if (!score) {
    return (
      <div className="surface-card flex flex-col items-center p-5">
        {showHeader && <p className="section-title self-start">Credit score</p>}
        <p className="mt-4 text-sm text-slate-500">Score unavailable.</p>
      </div>
    );
  }

  return (
    <div className="surface-card flex flex-col items-center p-5">
      {showHeader && (
        <div className="flex w-full items-center justify-between gap-2">
          <h2 className="section-title">Credit score</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {bandLabel(score.band)}
          </span>
        </div>
      )}

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Credit score ${score.score} out of ${SCORE_MAX}`}
        className="mt-1"
      >
        <defs>
          <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* Track underlay */}
        <path
          d={arcPath(cx, cy, r, 0, 180)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeW}
          strokeLinecap="butt"
        />

        {GAUGE_SEGMENTS.map((s) => {
          const angles = segmentArcAngles(s.from, s.to);
          if (!angles) return null;
          return (
            <path
              key={s.from}
              d={arcPath(cx, cy, r, angles.start, angles.end)}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeW}
              strokeLinecap="butt"
              filter={`url(#${uid}-soft)`}
            />
          );
        })}

        {[0, 250, 500, 750, 1000].map((tick) => {
          const p = polar(cx, cy, r + strokeW * 0.95, scoreToAngle(tick));
          return (
            <text
              key={tick}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#64748b"
              style={{ fontSize: size * 0.042, fontWeight: 500 }}
            >
              {tick}
            </text>
          );
        })}

        <line
          x1={cx}
          y1={cy}
          x2={tip.x}
          y2={tip.y}
          stroke="#334155"
          strokeWidth={Math.max(2.5, size * 0.012)}
          strokeLinecap="round"
          style={{
            transition:
              "x2 0.85s cubic-bezier(0.22,1,0.36,1), y2 0.85s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
        <circle cx={cx} cy={cy} r={size * 0.038} fill="#1e293b" />
        <circle cx={cx} cy={cy} r={size * 0.016} fill="#f8fafc" />

        <text
          x={cx}
          y={cy - r * 0.42}
          textAnchor="middle"
          fill="currentColor"
          className="text-slate-900 dark:text-slate-100"
          style={{ fontSize: size * 0.175, fontWeight: 700 }}
        >
          {score.score}
        </text>
        <text
          x={cx}
          y={cy - r * 0.18}
          textAnchor="middle"
          fill="#64748b"
          style={{ fontSize: size * 0.048, fontWeight: 500 }}
        >
          / {SCORE_MAX}
        </text>
      </svg>

      <p
        className={`-mt-1 text-sm font-semibold ${
          score.band === "GOOD" || score.band === "EXCELLENT"
            ? "text-emerald-600"
            : score.band === "FAIR"
              ? "text-amber-600"
              : score.band === "POOR"
                ? "text-rose-600"
                : "text-slate-600"
        }`}
      >
        {bandMessage(score.band)}
      </p>
      {updated && (
        <p className="mt-1 text-xs text-slate-400">Last updated on {updated}</p>
      )}
    </div>
  );
}

import { useEffect, useId, useState } from "react";
import type { CreditScore } from "../../types/creditScore";
import {
  GAUGE_SEGMENTS,
  SCORE_MAX,
  annularSectorPath,
  bandLabel,
  bandMessage,
  bandMessageClass,
  clampScore,
  formatScoreUpdatedAt,
  polar,
  scoreToAngle,
  segmentArcAngles,
} from "../../utils/creditScoreGaugeGeometry";

export default function CreditScoreGauge({
  score,
  size = 300,
  showHeader = true,
  showUpdated = true,
}: {
  score: CreditScore | null | undefined;
  size?: number;
  showHeader?: boolean;
  showUpdated?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const [animated, setAnimated] = useState(0);
  const value = score?.score ?? 0;

  useEffect(() => {
    setAnimated(0);
    const t = window.setTimeout(() => setAnimated(clampScore(value)), 40);
    return () => window.clearTimeout(t);
  }, [value]);

  // Extra top pad so tick labels don't clip; pivot near bottom
  const padTop = size * 0.08;
  const width = size;
  const height = Math.round(size * 0.62 + padTop);
  const cx = width / 2;
  const cy = height - size * 0.04;
  const outerR = size * 0.38;
  const thickness = size * 0.1;
  const innerR = outerR - thickness;
  // Needle stops short of the arc so it never fights the number
  const needleLen = innerR * 0.72;
  const needleAngle = scoreToAngle(animated);
  const tip = polar(cx, cy, needleLen, needleAngle);
  const updated = formatScoreUpdatedAt(score?.computed_at);

  // Score sits in the open hollow — below the inner arc, above the hub
  const scoreY = cy - innerR * 0.42;
  const scoreFont = Math.min(innerR * 0.48, size * 0.13);

  if (!score) {
    return (
      <div className="surface-card flex flex-col items-center p-5">
        {showHeader && <p className="section-title self-start">Credit score</p>}
        <p className="mt-4 text-sm text-slate-500">Score unavailable.</p>
      </div>
    );
  }

  return (
    <div className="surface-card flex flex-col items-center p-5 sm:p-6">
      {showHeader && (
        <div className="mb-1 flex w-full items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Credit score
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {bandLabel(score.band)}
          </span>
        </div>
      )}

      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Credit score ${score.score} out of ${SCORE_MAX}`}
        className="max-w-full overflow-visible"
        style={{ maxWidth: size }}
      >
        <defs>
          <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
          </filter>
        </defs>

        <path
          d={annularSectorPath(cx, cy, innerR, outerR, 0, 180)}
          fill="#eef2f7"
        />

        {GAUGE_SEGMENTS.map((s) => {
          const angles = segmentArcAngles(s.from, s.to);
          if (!angles) return null;
          return (
            <path
              key={s.from}
              d={annularSectorPath(
                cx,
                cy,
                innerR,
                outerR,
                angles.start,
                angles.end
              )}
              fill={s.color}
              filter={`url(#${uid}-soft)`}
            />
          );
        })}

        {[0, 250, 500, 750, 1000].map((tick) => {
          const p = polar(cx, cy, outerR + size * 0.06, scoreToAngle(tick));
          return (
            <text
              key={tick}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#94a3b8"
              style={{ fontSize: Math.max(11, size * 0.038), fontWeight: 500 }}
            >
              {tick}
            </text>
          );
        })}

        {/* Score in hollow (drawn under needle so arc stays visible) */}
        <text
          x={cx}
          y={scoreY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0f172a"
          style={{ fontSize: scoreFont, fontWeight: 700 }}
        >
          {score.score}
        </text>
        <text
          x={cx}
          y={scoreY + scoreFont * 0.55}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#94a3b8"
          style={{ fontSize: Math.max(11, size * 0.042), fontWeight: 500 }}
        >
          / {SCORE_MAX}
        </text>

        <line
          x1={cx}
          y1={cy}
          x2={tip.x}
          y2={tip.y}
          stroke="#1e293b"
          strokeWidth={Math.max(2.5, size * 0.011)}
          strokeLinecap="round"
          style={{
            transition:
              "x2 0.9s cubic-bezier(0.22,1,0.36,1), y2 0.9s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
        <circle cx={cx} cy={cy} r={size * 0.038} fill="#0f172a" />
        <circle cx={cx} cy={cy} r={size * 0.016} fill="#f8fafc" />
      </svg>

      <p className={`mt-1 text-sm font-semibold sm:text-base ${bandMessageClass(score.band)}`}>
        {bandMessage(score.band)}
      </p>
      {showUpdated && updated && (
        <p className="mt-0.5 text-xs text-slate-400">Last updated on {updated}</p>
      )}
    </div>
  );
}

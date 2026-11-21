import { useEffect, useId, useState } from "react";
import type { CreditScore } from "../../types/creditScore";

const SEGMENTS = [
  { from: 0, to: 125, color: "#7c3aed" },
  { from: 125, to: 250, color: "#6366f1" },
  { from: 250, to: 375, color: "#3b82f6" },
  { from: 375, to: 500, color: "#0ea5e9" },
  { from: 500, to: 625, color: "#14b8a6" },
  { from: 625, to: 750, color: "#22c55e" },
  { from: 750, to: 875, color: "#16a34a" },
  { from: 875, to: 1000, color: "#15803d" },
];

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startScore: number,
  endScore: number
) {
  const start = (startScore / 1000) * 180;
  const end = (endScore / 1000) * 180;
  const a = polar(cx, cy, r, start);
  const b = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

function bandLabel(band: string): string {
  if (band === "THIN_FILE") return "Thin file";
  return band.charAt(0) + band.slice(1).toLowerCase();
}

export default function CreditScoreGauge({
  score,
  size = 220,
}: {
  score: CreditScore | null | undefined;
  size?: number;
}) {
  const uid = useId();
  const [animated, setAnimated] = useState(0);
  const value = score?.score ?? 0;

  useEffect(() => {
    setAnimated(0);
    const t = window.setTimeout(() => setAnimated(value), 40);
    return () => window.clearTimeout(t);
  }, [value]);

  const cx = size / 2;
  const cy = size * 0.62;
  const r = size * 0.38;
  const needleAngle = (Math.min(1000, Math.max(0, animated)) / 1000) * 180;
  const tip = polar(cx, cy, r - 8, needleAngle);

  if (!score) {
    return (
      <div className="surface-card flex flex-col items-center p-5">
        <p className="section-title self-start">Credit score</p>
        <p className="mt-4 text-sm text-slate-500">Score unavailable.</p>
      </div>
    );
  }

  return (
    <div className="surface-card flex flex-col items-center p-5">
      <div className="flex w-full items-center justify-between gap-2">
        <h2 className="section-title">Credit score</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {bandLabel(score.band)}
        </span>
      </div>

      <svg
        width={size}
        height={size * 0.72}
        viewBox={`0 0 ${size} ${size * 0.72}`}
        role="img"
        aria-label={`Credit score ${score.score} out of 1000`}
        className="mt-2"
      >
        <defs>
          <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.2" />
          </filter>
        </defs>
        {SEGMENTS.map((s) => (
          <path
            key={s.from}
            d={arcPath(cx, cy, r, s.from, s.to)}
            fill="none"
            stroke={s.color}
            strokeWidth={size * 0.09}
            strokeLinecap="butt"
            filter={`url(#${uid}-soft)`}
          />
        ))}
        {[0, 250, 500, 750, 1000].map((tick) => {
          const p = polar(cx, cy, r + size * 0.08, (tick / 1000) * 180);
          return (
            <text
              key={tick}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-500"
              style={{ fontSize: size * 0.045 }}
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
          stroke="#475569"
          strokeWidth={3}
          strokeLinecap="round"
          style={{
            transition: "x2 0.7s cubic-bezier(0.22,1,0.36,1), y2 0.7s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
        <circle cx={cx} cy={cy} r={size * 0.045} fill="#334155" />
        <text
          x={cx}
          y={cy - r * 0.35}
          textAnchor="middle"
          className="fill-slate-900 dark:fill-slate-100"
          style={{ fontSize: size * 0.16, fontWeight: 700 }}
        >
          {score.score}
        </text>
        <text
          x={cx}
          y={cy - r * 0.12}
          textAnchor="middle"
          className="fill-slate-500"
          style={{ fontSize: size * 0.05 }}
        >
          / 1000
        </text>
      </svg>
    </div>
  );
}

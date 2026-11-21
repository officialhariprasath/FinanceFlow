/** Pure geometry helpers for the credit score semicircle gauge (0–1000). */

export const SCORE_MIN = 0;
export const SCORE_MAX = 1000;

/** Eight thick color blocks — purple → green (reference). */
export const GAUGE_SEGMENTS = [
  { from: 0, to: 125, color: "#8b5cf6" },
  { from: 125, to: 250, color: "#6366f1" },
  { from: 250, to: 375, color: "#3b82f6" },
  { from: 375, to: 500, color: "#38bdf8" },
  { from: 500, to: 625, color: "#2dd4bf" },
  { from: 625, to: 750, color: "#4ade80" },
  { from: 750, to: 875, color: "#22c55e" },
  { from: 875, to: 1000, color: "#16a34a" },
] as const;

/** White gap between block segments (degrees). */
export const SEGMENT_GAP_DEG = 4.5;

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return SCORE_MIN;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
}

/** Map score → degrees on a left-to-right semicircle (0° = left, 180° = right). */
export function scoreToAngle(score: number): number {
  return (clampScore(score) / SCORE_MAX) * 180;
}

export function polar(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function segmentArcAngles(
  fromScore: number,
  toScore: number,
  gapDeg = SEGMENT_GAP_DEG
): { start: number; end: number } | null {
  const start = scoreToAngle(fromScore) + gapDeg / 2;
  const end = scoreToAngle(toScore) - gapDeg / 2;
  if (end <= start) return null;
  return { start, end };
}

export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const a = polar(cx, cy, r, startAngle);
  const b = polar(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

/**
 * Filled annular sector (thick block) between innerR and outerR.
 * Matches the reference “chunky segment” look better than stroked arcs.
 */
export function annularSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const o0 = polar(cx, cy, outerR, startAngle);
  const o1 = polar(cx, cy, outerR, endAngle);
  const i1 = polar(cx, cy, innerR, endAngle);
  const i0 = polar(cx, cy, innerR, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i0.x} ${i0.y}`,
    "Z",
  ].join(" ");
}

export function bandLabel(band: string): string {
  if (band === "THIN_FILE") return "Thin file";
  if (!band) return "—";
  return band.charAt(0) + band.slice(1).toLowerCase();
}

/** Short status line under the score number (reference-style). */
export function bandMessage(band: string): string {
  switch (band) {
    case "EXCELLENT":
      return "Excellent score";
    case "GOOD":
      return "Good score";
    case "FAIR":
      return "Fair score";
    case "POOR":
      return "Poor score";
    case "THIN_FILE":
      return "Thin file";
    default:
      return bandLabel(band);
  }
}

export function bandMessageClass(band: string): string {
  switch (band) {
    case "EXCELLENT":
    case "GOOD":
      return "text-emerald-600";
    case "FAIR":
      return "text-amber-600";
    case "POOR":
      return "text-rose-600";
    default:
      return "text-slate-600";
  }
}

export function formatScoreUpdatedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type ScoreFactor = {
  id: string;
  value: string;
  label: string;
  tone: "good" | "warn" | "neutral";
};

/** Map score features → Credit Factors cards (reference dashboard). */
export function buildScoreFactors(score: {
  features?: Record<string, unknown> | null;
  suggested_max_amount?: string | number | null;
  file_type?: string | null;
}): ScoreFactor[] {
  const f = score.features || {};
  const pillars = (f.pillars as Record<string, number> | undefined) || {};

  const asNum = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v)
      ? v
      : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
        ? Number(v)
        : null;

  const onTime = asNum(f.on_time_rate);
  const onTimePct =
    onTime != null ? `${Math.round(onTime * 100)}%` : "—";

  const months = asNum(f.months_as_customer) ?? 0;
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  const ageLabel =
    months > 0 ? (yrs > 0 ? `${yrs}yrs ${mos}mos` : `${mos}mos`) : "New";

  const outstanding = asNum(f.outstanding_ratio);
  const util =
    outstanding != null ? `${Math.round(outstanding * 100)}%` : "—";

  const overdue = asNum(f.current_overdue_count) ?? 0;
  const active = asNum(f.active_loan_count) ?? 0;
  const closed = asNum(f.closed_loan_count) ?? 0;
  const streak = asNum(f.on_time_streak) ?? 0;
  const totalLoans = active + closed;

  const ph = asNum(pillars.payment_history);
  const phTone: ScoreFactor["tone"] =
    ph != null ? (ph >= 70 ? "good" : "warn") : "neutral";

  // Always return 6 cards so the Score tab never looks empty.
  return [
    {
      id: "payment",
      value: onTimePct,
      label: "Payment history",
      tone: phTone,
    },
    {
      id: "util",
      value: util,
      label: "Outstanding ratio",
      tone:
        outstanding != null ? (outstanding <= 0.4 ? "good" : "warn") : "neutral",
    },
    {
      id: "overdue",
      value: String(overdue),
      label: "Overdue installments",
      tone: overdue > 0 ? "warn" : "good",
    },
    {
      id: "age",
      value: ageLabel,
      label: "Customer history",
      tone: months >= 12 ? "good" : "neutral",
    },
    {
      id: "loans",
      value: String(totalLoans),
      label: "Total loans",
      tone: totalLoans > 0 ? "good" : "neutral",
    },
    {
      id: "streak",
      value:
        streak > 0
          ? String(streak)
          : score.file_type === "THIN"
            ? "Thin"
            : "Established",
      label: streak > 0 ? "On-time streak" : "File type",
      tone: streak >= 5 ? "good" : "neutral",
    },
  ];
}

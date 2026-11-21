/** Pure geometry helpers for the credit score semicircle gauge (0–1000). */

export const SCORE_MIN = 0;
export const SCORE_MAX = 1000;

export const GAUGE_SEGMENTS = [
  { from: 0, to: 125, color: "#7c3aed" },
  { from: 125, to: 250, color: "#4f46e5" },
  { from: 250, to: 375, color: "#2563eb" },
  { from: 375, to: 500, color: "#0ea5e9" },
  { from: 500, to: 625, color: "#14b8a6" },
  { from: 625, to: 750, color: "#22c55e" },
  { from: 750, to: 875, color: "#16a34a" },
  { from: 875, to: 1000, color: "#15803d" },
] as const;

/** Degrees of blank gap between adjacent segment blocks. */
export const SEGMENT_GAP_DEG = 3.2;

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

export function bandLabel(band: string): string {
  if (band === "THIN_FILE") return "Thin file";
  if (!band) return "—";
  return band.charAt(0) + band.slice(1).toLowerCase();
}

/** Short status line under the score number (reference-style). */
export function bandMessage(band: string): string {
  switch (band) {
    case "EXCELLENT":
      return "Excellent score!";
    case "GOOD":
      return "Great score!";
    case "FAIR":
      return "Fair score";
    case "POOR":
      return "Needs attention";
    case "THIN_FILE":
      return "Thin file";
    default:
      return bandLabel(band);
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

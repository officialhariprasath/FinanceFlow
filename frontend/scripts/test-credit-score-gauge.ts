/**
 * Frontend unit checks for credit score gauge geometry.
 * Run: npx --yes tsx scripts/test-credit-score-gauge.ts
 */
import assert from "node:assert/strict";
import {
  GAUGE_SEGMENTS,
  SCORE_MAX,
  SCORE_MIN,
  annularSectorPath,
  bandLabel,
  bandMessage,
  buildScoreFactors,
  clampScore,
  formatScoreUpdatedAt,
  scoreToAngle,
  segmentArcAngles,
} from "../src/utils/creditScoreGaugeGeometry";

assert.equal(clampScore(-10), SCORE_MIN);
assert.equal(clampScore(1500), SCORE_MAX);
assert.equal(clampScore(384), 384);

assert.equal(scoreToAngle(0), 0);
assert.equal(scoreToAngle(500), 90);
assert.equal(scoreToAngle(1000), 180);
assert.ok(Math.abs(scoreToAngle(384) - (384 / 1000) * 180) < 1e-9);

assert.equal(GAUGE_SEGMENTS.length, 8);
for (const seg of GAUGE_SEGMENTS) {
  const angles = segmentArcAngles(seg.from, seg.to);
  assert.ok(angles, `segment ${seg.from}-${seg.to} should render`);
  assert.ok(angles!.end > angles!.start);
  assert.ok(angles!.start >= scoreToAngle(seg.from));
  assert.ok(angles!.end <= scoreToAngle(seg.to));
}

assert.equal(bandLabel("POOR"), "Poor");
assert.equal(bandLabel("THIN_FILE"), "Thin file");
assert.equal(bandMessage("GOOD"), "Good score");
assert.equal(bandMessage("POOR"), "Poor score");
assert.equal(bandMessage("FAIR"), "Fair score");

assert.equal(formatScoreUpdatedAt(null), null);
assert.ok(formatScoreUpdatedAt("2018-12-23T10:00:00Z"));

const sector = annularSectorPath(100, 100, 60, 80, 0, 45);
assert.ok(sector.startsWith("M "));
assert.ok(sector.includes(" A "));
assert.ok(sector.endsWith("Z"));

const factors = buildScoreFactors({
  features: {
    on_time_rate: 0.99,
    outstanding_ratio: 0.24,
    current_overdue_count: 1,
    months_as_customer: 79,
    active_loan_count: 2,
    closed_loan_count: 12,
    on_time_streak: 6,
    pillars: { payment_history: 90 },
  },
  suggested_max_amount: "10000",
});
assert.equal(factors.length, 6);
assert.equal(factors[0].value, "99%");
assert.equal(factors[2].value, "1");

console.log("PASS: credit score gauge geometry (", GAUGE_SEGMENTS.length, "segments)");

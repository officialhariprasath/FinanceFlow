/**
 * Frontend unit checks for credit score gauge geometry.
 * Run: npx --yes tsx scripts/test-credit-score-gauge.ts
 */
import assert from "node:assert/strict";
import {
  GAUGE_SEGMENTS,
  SCORE_MAX,
  SCORE_MIN,
  bandLabel,
  bandMessage,
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
assert.equal(bandMessage("GOOD"), "Great score!");
assert.equal(bandMessage("POOR"), "Needs attention");

assert.equal(formatScoreUpdatedAt(null), null);
assert.ok(formatScoreUpdatedAt("2018-12-23T10:00:00Z"));

console.log("PASS: credit score gauge geometry (", GAUGE_SEGMENTS.length, "segments)");

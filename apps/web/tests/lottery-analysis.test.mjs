import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeCycles,
  analyzeDraws,
  countRepeated,
  metricDistribution,
  recentMetrics,
} from "../src/lib/lottery-analysis.ts";

const draws = [
  { contest: 4, date: "2026-01-04", numbers: [1, 2] },
  { contest: 3, date: "2026-01-03", numbers: [1, 3] },
  { contest: 2, date: "2026-01-02", numbers: [2, 4] },
  { contest: 1, date: "2026-01-01", numbers: [3, 4] },
];

test("frequency uses the selected window; delay uses the whole available history", () => {
  const result = analyzeDraws(draws, 4, 2);
  assert.deepEqual(result.frequencies.slice(1), [2, 1, 1, 0]);
  assert.deepEqual(result.delays.slice(1), [0, 0, 1, 2]);
  assert.equal(result.repeatMean, 0.5);
  assert.equal(countRepeated(draws[0].numbers, draws[1].numbers), 1);
});

test("recent metric distributions count contests rather than numbers", () => {
  const metrics = recentMetrics(draws, 4, 3);
  assert.deepEqual(metrics.find((metric) => metric.label === "Repetidas do anterior")?.values, [1, 0, 1]);
  assert.deepEqual(metricDistribution([2, 1, 2, 3, 1, 2]), [[2, 3], [1, 2], [3, 1]]);
});

test("Lotofácil moldura contains the 16 border positions of a 5-by-5 ticket", () => {
  const allNumbers = [{ contest: 1, date: "2026-01-01", numbers: Array.from({ length: 25 }, (_, index) => index + 1) }];
  assert.deepEqual(recentMetrics(allNumbers, 25, 1).find((metric) => metric.label === "Moldura")?.values, [16]);
});

test("presence cycles close only when every number has appeared", () => {
  const result = analyzeCycles(draws, 4, "presence");
  assert.equal(result.completed, 1);
  assert.equal(result.byContest.get(2)?.closed, false);
  assert.equal(result.byContest.get(3)?.closed, true);
  assert.equal(result.openCoverage, 2);
  assert.equal(result.startContest, 4);
  assert.deepEqual(result.missing, [3, 4]);
});

test("absence cycles track numbers omitted in each draw", () => {
  const result = analyzeCycles(draws, 4, "absence");
  assert.equal(result.completed, 1);
  assert.equal(result.byContest.get(1)?.closed, false);
  assert.equal(result.byContest.get(3)?.closed, true);
  assert.deepEqual(result.missing, [1, 2]);
});

test("Lotomania analysis treats 00 as a real dezena", () => {
  const sample = [
    { contest: 2, date: "2026-01-02", numbers: [0, 1] },
    { contest: 1, date: "2026-01-01", numbers: [2, 3] },
  ];
  const summary = analyzeDraws(sample, 4, 2);
  assert.equal(summary.frequencies[0], 1);
  assert.equal(summary.delays[0], 0);
  assert.equal(analyzeCycles(sample, 4, "presence", 0).completed, 1);
  assert.equal(analyzeCycles(sample, 4, "absence", 0).completed, 1);
});

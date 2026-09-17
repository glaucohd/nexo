import assert from "node:assert/strict";
import test from "node:test";

import { numberInsights } from "../src/lib/number-insights.ts";

test("frequency, recent window and delay describe the same chronological history", () => {
  const draws = [
    { numbers: [1, 3] },
    { numbers: [2, 3] },
    { numbers: [1, 2] },
    { numbers: [2, 4] },
  ];
  const insights = numberInsights(draws, 5, 2);
  assert.deepEqual(insights.map(({ number, frequency, recent, delay }) => [number, frequency, recent, delay]), [
    [1, 2, 1, 0], [2, 3, 1, 1], [3, 2, 2, 0], [4, 1, 0, 3], [5, 0, 0, 4],
  ]);
});

test("Lotomania includes 00 in frequency and delay rankings", () => {
  const insights = numberInsights([{ numbers: [0, 99] }, { numbers: [1, 99] }], 100, 2, 0);
  assert.equal(insights.length, 100);
  assert.deepEqual(insights[0], { number: 0, frequency: 1, recent: 1, delay: 0 });
  assert.equal(insights[99].frequency, 2);
});

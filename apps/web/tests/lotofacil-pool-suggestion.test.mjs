import assert from "node:assert/strict";
import test from "node:test";

import { suggestLotofacilPool } from "../src/lib/lotofacil-pool-suggestion.ts";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
}

const history = Array.from({ length: 40 }, (_, index) => ({
  contest: 40 - index,
  numbers: Array.from({ length: 15 }, (__, offset) => ((offset + index * 3) % 25) + 1).sort((a, b) => a - b),
}));

for (const size of [18, 20]) test(`suggests a valid, balanced ${size}-number Lotofácil pool`, () => {
  const suggestion = suggestLotofacilPool({ history, size, random: seededRandom(size), attempts: 10_000 });
  assert.equal(suggestion.numbers.length, size);
  assert.equal(new Set(suggestion.numbers).size, size);
  assert.equal(suggestion.excluded.length, 25 - size);
  assert.deepEqual([...suggestion.numbers, ...suggestion.excluded].sort((a, b) => a - b), Array.from({ length: 25 }, (_, index) => index + 1));
  for (const key of ["hot", "neutral", "cold", "repeated", "pairs", "frame", "late", "cycleMissing"])
    assert.ok(Math.abs(suggestion.metrics[key] - suggestion.targets[key]) <= 1, `${key} ficou longe do alvo`);
});

test("falls back to a valid random pool when there is no history", () => {
  const suggestion = suggestLotofacilPool({ history: [], size: 18, random: seededRandom(3) });
  assert.equal(suggestion.numbers.length, 18);
  assert.equal(new Set(suggestion.numbers).size, 18);
  assert.equal(suggestion.contests, 0);
});

test("rejects unsupported pool sizes", () => {
  assert.throws(() => suggestLotofacilPool({ history, size: 19, random: seededRandom(1) }), RangeError);
});

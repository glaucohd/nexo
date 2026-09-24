import test from "node:test";
import assert from "node:assert/strict";

import { coordinatedSelections } from "../src/lib/coordinated-pools.ts";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test("three coordinated selections do not repeat numbers", () => {
  const universe = Array.from({ length: 31 }, (_, index) => index + 1);
  const selections = coordinatedSelections({
    universe, size: 8, count: 3,
    strata: [universe.slice(0, 10), universe.slice(10, 21), universe.slice(21)],
    random: seededRandom(31),
  });
  assert.deepEqual(selections.map((selection) => selection.length), [8, 8, 8]);
  assert.equal(new Set(selections.flat()).size, 24);
  selections.forEach((selection) => assert.ok(selection.every((number) => universe.includes(number))));
});

test("temperature strata stay distributed across coordinated selections", () => {
  const universe = Array.from({ length: 25 }, (_, index) => index + 1);
  const strata = [universe.slice(0, 8), universe.slice(8, 17), universe.slice(17)];
  const selections = coordinatedSelections({ universe, size: 7, count: 3, strata, random: seededRandom(25) });
  const category = new Map(strata.flatMap((stratum, index) => stratum.map((number) => [number, index])));
  selections.forEach((selection) => {
    const counts = [0, 0, 0];
    selection.forEach((number) => { counts[category.get(number)] += 1; });
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  });
});

test("rejects a portfolio larger than the available universe", () => {
  assert.throws(() => coordinatedSelections({ universe: [1, 2, 3], size: 2, count: 2 }), /dezenas suficientes/);
});

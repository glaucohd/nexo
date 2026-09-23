import assert from "node:assert/strict";
import test from "node:test";

import { balancedTrevoPairs } from "../src/lib/trevo-coverage.ts";

test("diversifies trevos without repeating a pair in the first 15 games", () => {
  const pairs = balancedTrevoPairs(15);
  assert.equal(new Set(pairs.map((pair) => pair.join("-"))).size, 15);
  assert.ok(pairs.every((pair) => pair.length === 2 && new Set(pair).size === 2));
});

test("the first three games cover all six trevos once", () => {
  const firstThree = balancedTrevoPairs(3).flat().sort((a, b) => a - b);
  assert.deepEqual(firstThree, [1, 2, 3, 4, 5, 6]);
});

test("rejects invalid quantities", () => {
  assert.throws(() => balancedTrevoPairs(0), RangeError);
  assert.throws(() => balancedTrevoPairs(1.5), RangeError);
});

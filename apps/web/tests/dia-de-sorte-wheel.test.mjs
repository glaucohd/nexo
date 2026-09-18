import assert from "node:assert/strict";
import test from "node:test";

import { diaDeSorteWheel } from "../src/lib/dia-de-sorte-wheel.ts";

function* combinations(pool, size) {
  function* walk(start, remaining, picked) {
    if (remaining === 0) { yield picked; return; }
    for (let index = start; index <= pool.length - remaining; index += 1) yield* walk(index + 1, remaining - 1, [...picked, pool[index]]);
  }
  yield* walk(0, size, []);
}

function worstBestHits(wheel, pool) {
  let worstBest = Infinity;
  for (const draw of combinations(pool, 7)) {
    const drawSet = new Set(draw);
    const bestHits = Math.max(...wheel.map((ticket) => ticket.numbers.filter((number) => drawSet.has(number)).length));
    worstBest = Math.min(worstBest, bestHits);
  }
  return worstBest;
}

test("rejects pools outside 8..14 distinct numbers from 1 to 31", () => {
  assert.throws(() => diaDeSorteWheel([1, 2, 3, 4, 5, 6, 7], 4), RangeError);
  assert.throws(() => diaDeSorteWheel(Array.from({ length: 15 }, (_, i) => i + 1), 4), RangeError);
  assert.throws(() => diaDeSorteWheel([1, 2, 3, 4, 5, 6, 7, 32], 4), RangeError);
  assert.throws(() => diaDeSorteWheel([1, 1, 2, 3, 4, 5, 6, 7], 4), RangeError);
});

test("every ticket has 7 distinct numbers drawn only from the pool", () => {
  const pool = [2, 5, 7, 9, 12, 18, 21, 25, 30];
  const wheel = diaDeSorteWheel(pool, 4);
  assert.ok(wheel.length > 0);
  for (const ticket of wheel) {
    assert.equal(ticket.numbers.length, 7);
    assert.equal(new Set(ticket.numbers).size, 7);
    assert.ok(ticket.numbers.every((number) => pool.includes(number)));
  }
});

// Com pool pequeno, um jogo de 7 já exclui só 2 ou 3 números do pool, então
// o "piso estrutural" de acertos pode já superar a meta pedida — a garantia
// nunca pode ser menor que o alvo, mas pode vir folgada. Por isso comparamos
// com >=, não com igualdade.
test("guarantees at least 4 points on a 9-number pool, using fewer tickets than the full C(9,7)=36 coverage", () => {
  const pool = [3, 6, 9, 11, 14, 19, 22, 26, 29];
  const wheel = diaDeSorteWheel(pool, 4);
  assert.ok(worstBestHits(wheel, pool) >= 4);
  assert.ok(wheel.length < 36, `expected fewer than the full 36 combinations, got ${wheel.length}`);
});

test("guarantees at least 5 points on a 10-number pool", () => {
  const pool = [1, 4, 8, 10, 13, 17, 20, 23, 27, 31];
  const wheel = diaDeSorteWheel(pool, 5);
  assert.ok(worstBestHits(wheel, pool) >= 5);
  assert.ok(wheel.length < 120, `expected fewer than the full 120 combinations, got ${wheel.length}`);
});

test("guarantees at least 4 points on a 12-number pool, well under full coverage", () => {
  const pool = [1, 2, 3, 5, 8, 13, 15, 18, 21, 24, 27, 30];
  const wheel = diaDeSorteWheel(pool, 4);
  assert.ok(worstBestHits(wheel, pool) >= 4);
  assert.ok(wheel.length < 792, `expected fewer than the full 792 combinations, got ${wheel.length}`);
});

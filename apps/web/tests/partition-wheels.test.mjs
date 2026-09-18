import assert from "node:assert/strict";
import test from "node:test";

import { diaDeSorteWheel14, diaDeSorteWheel20, lotomaniaWheel70 } from "../src/lib/partition-wheels.ts";
import { cyclicWheel } from "../src/lib/cyclic-wheel.ts";

function* combinations(pool, size, start = 0, picked = []) {
  if (picked.length === size) { yield picked; return; }
  for (let index = start; index <= pool.length - (size - picked.length); index += 1) yield* combinations(pool, size, index + 1, [...picked, pool[index]]);
}

function worstBestHits(tickets, pool, drawnInPool) {
  let worst = Infinity;
  for (const drawn of combinations(pool, drawnInPool)) {
    const set = new Set(drawn);
    const best = Math.max(...tickets.map((ticket) => ticket.numbers.filter((number) => set.has(number)).length));
    if (best < worst) worst = best;
  }
  return worst;
}

const range = (from, count, step = 1) => Array.from({ length: count }, (_, index) => from + index * step);

test("partition wheels reject pools of the wrong size, repeated numbers or out-of-range numbers", () => {
  assert.throws(() => lotomaniaWheel70(range(0, 69)), RangeError);
  assert.throws(() => lotomaniaWheel70([...range(0, 69), 100]), RangeError);
  assert.throws(() => diaDeSorteWheel14([...range(1, 13), 1]), RangeError);
  assert.throws(() => diaDeSorteWheel20([...range(1, 19), 32]), RangeError);
});

test("Dia de Sorte with 14 numbers: 2 games guarantee 4 points when the 7 drawn fall in the pool", () => {
  const pool = [1, 3, 4, 7, 9, 11, 12, 15, 18, 20, 22, 25, 28, 31];
  const tickets = diaDeSorteWheel14(pool);
  assert.equal(tickets.length, 2);
  for (const ticket of tickets) assert.equal(new Set(ticket.numbers).size, 7);
  assert.equal(worstBestHits(tickets, pool, 7), 4);
});

test("Dia de Sorte with 20 numbers: 20 games guarantee 4 points when the 7 drawn fall in the pool", () => {
  const pool = [1, 2, 4, 5, 6, 8, 9, 11, 13, 14, 16, 17, 19, 21, 23, 24, 26, 28, 29, 30];
  const tickets = diaDeSorteWheel20(pool);
  assert.equal(tickets.length, 20);
  assert.equal(new Set(tickets.map((ticket) => ticket.numbers.join())).size, 20);
  for (const ticket of tickets) {
    assert.equal(new Set(ticket.numbers).size, 7);
    assert.ok(ticket.numbers.every((number) => pool.includes(number)));
  }
  assert.equal(worstBestHits(tickets, pool, 7), 4);
});

test("Timemania with 20 numbers: the 10 × 2 cyclic wheel gives 4 points if all 7 fall in the pool, 3 if at least 5 do", () => {
  const pool = range(3, 20, 4);
  const tickets = cyclicWheel(pool, Array(10).fill(2));
  assert.equal(tickets.length, 2);
  for (const ticket of tickets) assert.equal(ticket.numbers.length, 10);
  assert.equal(worstBestHits(tickets, pool, 7), 4);
  assert.equal(worstBestHits(tickets, pool, 5), 3);
});

test("Lotomania with 70 numbers: 21 games of 50, each leaving out exactly 2 of the 7 groups", () => {
  const pool = range(0, 100).filter((number) => number % 10 !== 3 && number % 10 !== 7 && number % 10 !== 9);
  const tickets = lotomaniaWheel70(pool);
  assert.equal(tickets.length, 21);
  assert.equal(new Set(tickets.map((ticket) => ticket.numbers.join())).size, 21);
  for (const ticket of tickets) {
    assert.equal(ticket.numbers.length, 50);
    assert.equal(new Set(ticket.numbers).size, 50);
    assert.ok(ticket.numbers.every((number) => pool.includes(number)));
  }
});

test("Lotomania with 70 numbers guarantees 15 points whenever the 20 drawn fall in the pool", () => {
  const pool = range(0, 100).filter((number) => number % 10 !== 3 && number % 10 !== 7 && number % 10 !== 9);
  const tickets = lotomaniaWheel70(pool);
  // Enumerar C(70, 20) sorteios é inviável, mas o resultado de cada jogo só
  // depende de quantas sorteadas caem em cada grupo. Enumeramos então todas as
  // distribuições (c1..c7), 0 ≤ ci ≤ 10, somando 20, e montamos um sorteio
  // concreto para cada uma.
  const groups = Array.from({ length: 7 }, (_, group) => [...pool].sort((a, b) => a - b).filter((_, index) => index % 7 === group));
  let worst = Infinity;
  let checked = 0;
  function walk(group, left, counts) {
    if (group === 6) {
      if (left > 10) return;
      const drawn = new Set([...counts, left].flatMap((count, index) => groups[index].slice(0, count)));
      const best = Math.max(...tickets.map((ticket) => ticket.numbers.filter((number) => drawn.has(number)).length));
      worst = Math.min(worst, best);
      checked += 1;
      return;
    }
    for (let count = 0; count <= Math.min(10, left); count += 1) walk(group + 1, left - count, [...counts, count]);
  }
  walk(0, 20, []);
  assert.ok(checked > 10000);
  assert.equal(worst, 15);
});

import assert from "node:assert/strict";
import test from "node:test";

import { lotofacilWheel, lotofacilWheel14 } from "../src/lib/lotofacil-wheel.ts";

const available = [1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 24, 25];

function* combinations3(pool) {
  for (let a = 0; a < pool.length; a += 1)
    for (let b = a + 1; b < pool.length; b += 1)
      for (let c = b + 1; c < pool.length; c += 1)
        yield [pool[a], pool[b], pool[c]];
}

function worstBestHits(wheel, pool) {
  let worstBest = Infinity;
  for (const notDrawn of combinations3(pool)) {
    const winning = new Set(pool.filter((number) => !notDrawn.includes(number)));
    const bestHits = Math.max(...wheel.map((ticket) => ticket.numbers.filter((number) => winning.has(number)).length));
    worstBest = Math.min(worstBest, bestHits);
  }
  return worstBest;
}

test("Lotofácil wheel rejects anything other than 18 distinct numbers from 1 to 25", () => {
  assert.throws(() => lotofacilWheel(available.slice(0, 17)), RangeError);
  assert.throws(() => lotofacilWheel([...available.slice(0, 17), 26]), RangeError);
  assert.throws(() => lotofacilWheel([...available.slice(0, 17), available[0]]), RangeError);
});

test("Lotofácil wheel reproduces the reference reduction (06,07,08,15,16,17,23 excluded)", () => {
  const wheel = lotofacilWheel(available);
  assert.equal(wheel.length, 6);
  assert.deepEqual(wheel[0].numbers, [1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 18, 19, 21, 24]);
  assert.deepEqual(wheel[0].excluded, [20, 22, 25]);
  assert.deepEqual(wheel[1].numbers, [2, 4, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 24, 25]);
  assert.deepEqual(wheel[1].excluded, [1, 3, 5]);
});

test("every ticket has 15 distinct numbers from the pool, and every number is left out of exactly one ticket", () => {
  const wheel = lotofacilWheel(available);
  const missCount = new Map(available.map((number) => [number, 0]));
  for (const ticket of wheel) {
    assert.equal(ticket.numbers.length, 15);
    assert.equal(new Set(ticket.numbers).size, 15);
    assert.equal(ticket.excluded.length, 3);
    assert.deepEqual([...ticket.numbers, ...ticket.excluded].sort((a, b) => a - b), [...available].sort((a, b) => a - b));
    for (const number of ticket.excluded) missCount.set(number, missCount.get(number) + 1);
  }
  assert.deepEqual([...missCount.values()], available.map(() => 1));
});

test("guarantees at least 13 points on the best ticket whenever all 15 drawn numbers fall inside the 18 chosen", () => {
  assert.equal(worstBestHits(lotofacilWheel(available), available), 13);
});

test("Lotofácil wheel14 rejects anything other than 18 distinct numbers from 1 to 25", () => {
  assert.throws(() => lotofacilWheel14(available.slice(0, 17)), RangeError);
  assert.throws(() => lotofacilWheel14([...available.slice(0, 17), 26]), RangeError);
});

test("wheel14 produces 24 tickets of 15 distinct numbers each, drawn only from the pool", () => {
  const wheel = lotofacilWheel14(available);
  assert.equal(wheel.length, 24);
  for (const ticket of wheel) {
    assert.equal(ticket.numbers.length, 15);
    assert.equal(new Set(ticket.numbers).size, 15);
    assert.equal(ticket.excluded.length, 3);
    assert.deepEqual([...ticket.numbers, ...ticket.excluded].sort((a, b) => a - b), [...available].sort((a, b) => a - b));
  }
});

test("wheel14 guarantees at least 14 points, and the bound is tight (not 15)", () => {
  assert.equal(worstBestHits(lotofacilWheel14(available), available), 14);
});

function* combinations5(pool) {
  const n = pool.length;
  for (let a = 0; a < n; a += 1) for (let b = a + 1; b < n; b += 1) for (let c = b + 1; c < n; c += 1)
    for (let d = c + 1; d < n; d += 1) for (let e = d + 1; e < n; e += 1) yield [pool[a], pool[b], pool[c], pool[d], pool[e]];
}

function worstBestHits20(wheel, pool) {
  let worstBest = Infinity;
  for (const notDrawn of combinations5(pool)) {
    const winning = new Set(pool.filter((number) => !notDrawn.includes(number)));
    worstBest = Math.min(worstBest, Math.max(...wheel.map((ticket) => ticket.numbers.filter((number) => winning.has(number)).length)));
  }
  return worstBest;
}

const pool20 = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22, 23, 25];

test("20-number wheels reject anything other than 20 distinct numbers from 1 to 25", async () => {
  const { lotofacilWheel20, lotofacilWheel20x13 } = await import("../src/lib/lotofacil-wheel.ts");
  for (const wheel of [lotofacilWheel20, lotofacilWheel20x13]) {
    assert.throws(() => wheel(pool20.slice(0, 19)), RangeError);
    assert.throws(() => wheel([...pool20.slice(0, 19), 26]), RangeError);
    assert.throws(() => wheel([...pool20.slice(0, 19), pool20[0]]), RangeError);
  }
});

test("20-number wheel with 4 games guarantees 12 points when the 15 drawn fall inside the pool", async () => {
  const { lotofacilWheel20 } = await import("../src/lib/lotofacil-wheel.ts");
  const wheel = lotofacilWheel20(pool20);
  assert.equal(wheel.length, 4);
  for (const ticket of wheel) {
    assert.equal(new Set(ticket.numbers).size, 15);
    assert.ok(ticket.numbers.every((number) => pool20.includes(number)));
  }
  assert.equal(worstBestHits20(wheel, pool20), 12);
});

test("20-number wheel with 34 games guarantees 13 points when the 15 drawn fall inside the pool", async () => {
  const { lotofacilWheel20x13 } = await import("../src/lib/lotofacil-wheel.ts");
  const wheel = lotofacilWheel20x13(pool20);
  assert.equal(wheel.length, 34);
  assert.equal(new Set(wheel.map((ticket) => ticket.numbers.join())).size, 34);
  for (const ticket of wheel) {
    assert.equal(new Set(ticket.numbers).size, 15);
    assert.ok(ticket.numbers.every((number) => pool20.includes(number)));
  }
  assert.equal(worstBestHits20(wheel, pool20), 13);
});

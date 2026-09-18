import assert from "node:assert/strict";
import test from "node:test";

import { cyclicWheel } from "../src/lib/cyclic-wheel.ts";

function* combinations(pool, size) {
  function* walk(start, remaining, picked) {
    if (remaining === 0) { yield picked; return; }
    for (let index = start; index <= pool.length - remaining; index += 1) yield* walk(index + 1, remaining - 1, [...picked, pool[index]]);
  }
  yield* walk(0, size, []);
}

function worstBestHits(wheel, pool, drawSize) {
  let worstBest = Infinity;
  for (const draw of combinations(pool, drawSize)) {
    const drawSet = new Set(draw);
    const bestHits = Math.max(...wheel.map((ticket) => ticket.numbers.filter((number) => drawSet.has(number)).length));
    worstBest = Math.min(worstBest, bestHits);
  }
  return worstBest;
}

test("cyclicWheel rejects a pool that doesn't match the group sizes, or has duplicates", () => {
  assert.throws(() => cyclicWheel([1, 2, 3, 4, 5, 6, 7, 8], [3, 3, 3]), RangeError);
  assert.throws(() => cyclicWheel([1, 2, 3, 4, 5, 6, 7, 8, 8], [3, 3, 3]), RangeError);
  assert.throws(() => cyclicWheel([1, 2, 3, 4, 5, 6, 7, 8, 9], [3, 3, 0]), RangeError);
});

// Cada caso abaixo espelha um preset oferecido na UI (number-wheel-generator.tsx)
// e mantém o jogo do tamanho exato do sorteio — aposta simples, sem desdobrar.

test("Mega-Sena 'quina8': 8 dezenas em 2 grupos de 4 (4 jogos) garantem 5 pontos", () => {
  const pool = [2, 6, 11, 17, 23, 29, 37, 44];
  const wheel = cyclicWheel(pool, [4, 4]);
  assert.equal(wheel.length, 4);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 6));
  assert.equal(worstBestHits(wheel, pool, 6), 5);
});

test("Mega-Sena 'quadra9': 9 dezenas em 3 grupos de 3 (3 jogos) garantem 4 pontos", () => {
  const pool = [3, 7, 12, 18, 24, 31, 40, 48, 55];
  const wheel = cyclicWheel(pool, [3, 3, 3]);
  assert.equal(wheel.length, 3);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 6));
  assert.equal(worstBestHits(wheel, pool, 6), 4);
});

test("Mega-Sena 'sena7': 7 dezenas em 1 grupo de 7 (7 jogos) cobrem tudo e garantem a sena (6 pontos)", () => {
  const pool = [4, 9, 15, 21, 30, 42, 53];
  const wheel = cyclicWheel(pool, [7]);
  assert.equal(wheel.length, 7);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 6));
  assert.equal(worstBestHits(wheel, pool, 6), 6);
});

test("Quina 'quadra7': 7 dezenas em grupos de 4/3 (4 jogos) garantem 4 pontos", () => {
  const pool = [1, 9, 16, 23, 34, 45, 58];
  const wheel = cyclicWheel(pool, [4, 3]);
  assert.equal(wheel.length, 4);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 5));
  assert.equal(worstBestHits(wheel, pool, 5), 4);
});

test("Quina 'terno8': 8 dezenas em grupos de 3/3/2 (3 jogos) garantem 3 pontos", () => {
  const pool = [2, 8, 14, 22, 31, 40, 52, 66];
  const wheel = cyclicWheel(pool, [3, 3, 2]);
  assert.equal(wheel.length, 3);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 5));
  assert.equal(worstBestHits(wheel, pool, 5), 3);
});

test("Quina 'quina6': 6 dezenas em 1 grupo de 6 (6 jogos) cobrem tudo e garantem a quina (5 pontos)", () => {
  const pool = [5, 13, 27, 38, 49, 61];
  const wheel = cyclicWheel(pool, [6]);
  assert.equal(wheel.length, 6);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 5));
  assert.equal(worstBestHits(wheel, pool, 5), 5);
});

// A Dupla Sena sorteia 6 dezenas como a Mega-Sena, então usa os mesmos
// fechamentos — a diferença é que cada jogo vale nos dois sorteios.
test("Dupla Sena 'quina8': 8 dezenas em 2 grupos de 4 (4 jogos) garantem 5 pontos por sorteio", () => {
  const pool = [3, 8, 15, 19, 27, 33, 41, 50];
  const wheel = cyclicWheel(pool, [4, 4]);
  assert.equal(wheel.length, 4);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 6));
  assert.equal(worstBestHits(wheel, pool, 6), 5);
});

test("Dupla Sena 'quadra9': 9 dezenas em 3 grupos de 3 (3 jogos) garantem 4 pontos por sorteio", () => {
  const pool = [2, 5, 11, 16, 22, 29, 36, 44, 49];
  const wheel = cyclicWheel(pool, [3, 3, 3]);
  assert.equal(wheel.length, 3);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 6));
  assert.equal(worstBestHits(wheel, pool, 6), 4);
});

// Na Timemania a aposta tem 10 dezenas e o sorteio só 7, então cada jogo já
// cobre boa parte do pool — a garantia sai alta com poucos jogos.
test("Timemania 'cinco15': 15 dezenas em 5 grupos de 3 (3 jogos) garantem 5 acertos", () => {
  const pool = Array.from({ length: 15 }, (_, i) => i * 5 + 1);
  const wheel = cyclicWheel(pool, [3, 3, 3, 3, 3]);
  assert.equal(wheel.length, 3);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 10));
  assert.equal(worstBestHits(wheel, pool, 7), 5);
});

test("Timemania 'seis13': 13 dezenas em grupos de 5/4/4 (5 jogos) garantem 6 acertos", () => {
  const pool = Array.from({ length: 13 }, (_, i) => i * 6 + 2);
  const wheel = cyclicWheel(pool, [5, 4, 4]);
  assert.equal(wheel.length, 5);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 10));
  assert.equal(worstBestHits(wheel, pool, 7), 6);
});

test("Timemania 'sete11': 11 dezenas em 1 grupo de 11 (11 jogos) garantem os 7 acertos", () => {
  const pool = Array.from({ length: 11 }, (_, i) => i * 7 + 3);
  const wheel = cyclicWheel(pool, [11]);
  assert.equal(wheel.length, 11);
  wheel.forEach((ticket) => assert.equal(ticket.numbers.length, 10));
  assert.equal(worstBestHits(wheel, pool, 7), 7);
});

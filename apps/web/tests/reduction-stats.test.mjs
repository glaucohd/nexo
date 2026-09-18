import assert from "node:assert/strict";
import test from "node:test";

import { cyclicWheel } from "../src/lib/cyclic-wheel.ts";
import { lotofacilWheel, lotofacilWheel14, lotofacilWheel20, lotofacilWheel20x13 } from "../src/lib/lotofacil-wheel.ts";
import { concoursesPerOccurrence, reductionGuarantees } from "../src/lib/reduction-stats.ts";
import { diaDeSorteWheel } from "../src/lib/dia-de-sorte-wheel.ts";
import { diaDeSorteWheel14, diaDeSorteWheel20 } from "../src/lib/partition-wheels.ts";

function* combinations(pool, size, start = 0, picked = []) {
  if (picked.length === size) { yield picked; return; }
  for (let index = start; index <= pool.length - (size - picked.length); index += 1) yield* combinations(pool, size, index + 1, [...picked, pool[index]]);
}

function worstBestHits(tickets, pool, inPool) {
  let worst = Infinity;
  for (const drawn of combinations(pool, inPool)) {
    const set = new Set(drawn);
    let best = 0;
    for (const ticket of tickets) {
      let hits = 0;
      for (const number of ticket.numbers) if (set.has(number)) hits += 1;
      if (hits > best) best = hits;
    }
    if (best < worst) worst = best;
  }
  return worst;
}

const range = (count) => Array.from({ length: count }, (_, index) => index + 1);
const cyclicPresets = {
  quina8: [8, [4, 4]], quadra9: [9, [3, 3, 3]], sena7: [7, [7]],
  quadra7: [7, [4, 3]], terno8: [8, [3, 3, 2]], quina6: [6, [6]],
  quatro20: [20, Array(10).fill(2)], cinco15: [15, [3, 3, 3, 3, 3]], seis13: [13, [5, 4, 4]], sete11: [11, [11]],
};
const lotofacil = { "18x13": [lotofacilWheel, 18], "18x14": [lotofacilWheel14, 18], "20x12": [lotofacilWheel20, 20], "20x13": [lotofacilWheel20x13, 20] };

test("every partial guarantee in the table matches a brute-force check of the generated games", () => {
  for (const [key, rows] of Object.entries(reductionGuarantees)) {
    const [slug, id] = key.split(":");
    if (slug === "lotomania") continue; // coberto em partition-wheels.test.mjs
    let tickets;
    let pool;
    if (slug === "lotofacil") { const [build, size] = lotofacil[id]; pool = range(size); tickets = build(pool); }
    else if (slug === "dia-de-sorte") {
      const [kind, size] = id.split("-");
      pool = range(Number(size));
      tickets = kind === "all4" ? (pool.length === 20 ? diaDeSorteWheel20(pool) : diaDeSorteWheel14(pool)) : diaDeSorteWheel(pool, Number(kind.slice(3)));
    }
    else { const [size, groups] = cyclicPresets[id]; pool = range(size); tickets = cyclicWheel(pool, groups); }
    for (const row of rows) assert.equal(worstBestHits(tickets, pool, row.inPool), row.hits, `${key} com ${row.inPool} no grupo`);
  }
});

test("frequency of the pool condition follows the hypergeometric distribution", () => {
  assert.equal(Math.round(concoursesPerOccurrence({ total: 25, drawSize: 15, pool: 20, inPool: 15 })), 211);
  assert.equal(Math.round(concoursesPerOccurrence({ total: 25, drawSize: 15, pool: 18, inPool: 15 })), 4006);
  assert.equal(Math.round(concoursesPerOccurrence({ total: 60, drawSize: 6, pool: 8, inPool: 5 })), 17029);
  // Dupla Sena: dois sorteios por concurso deixam a condição mais frequente.
  assert.ok(concoursesPerOccurrence({ total: 50, drawSize: 6, pool: 8, inPool: 4, draws: 2 }) < concoursesPerOccurrence({ total: 50, drawSize: 6, pool: 8, inPool: 4 }));
});

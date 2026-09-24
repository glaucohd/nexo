import assert from "node:assert/strict";
import test from "node:test";

import { runStrategyLab, seededRandom } from "../src/lib/strategy-lab.ts";

// Histórico sintético da Lotofácil: 60 concursos com dezenas sorteadas por uma
// semente fixa e prêmios fixos de 11 a 13 pontos.
function syntheticDraws(count) {
  const random = seededRandom(7);
  const draws = [];
  for (let contest = 1; contest <= count; contest += 1) {
    const numbers = Array.from({ length: 25 }, (_, index) => index + 1).sort(() => random() - .5).slice(0, 15).sort((a, b) => a - b);
    draws.push({ contest, date: "2026-01-01", numbers, extras: null, prizes: [
      { label: "13 acertos", hits: 13, extraHits: null, winners: 1, prize: 35 },
      { label: "12 acertos", hits: 12, extraHits: null, winners: 1, prize: 14 },
      { label: "11 acertos", hits: 11, extraHits: null, winners: 1, prize: 7 },
    ] });
  }
  return draws.reverse();
}

test("the same seed reproduces the same comparison", () => {
  const draws = syntheticDraws(60);
  const first = runStrategyLab({ slug: "lotofacil", draws, contests: 20, ticketsPerContest: 2, seed: 99 });
  const second = runStrategyLab({ slug: "lotofacil", draws, contests: 20, ticketsPerContest: 2, seed: 99 });
  assert.deepEqual(first, second);
  assert.equal(first.contests, 20);
  assert.equal(first.firstContest, 41);
  assert.equal(first.lastContest, 60);
});

test("cost is games × price and every strategy plays every evaluated contest", () => {
  const report = runStrategyLab({ slug: "lotofacil", draws: syntheticDraws(60), contests: 20, ticketsPerContest: 2, seed: 3 });
  for (const result of report.results) {
    assert.equal(result.costCents, result.games * 350, result.label);
    assert.ok(result.contestsWithPrize <= 20);
  }
  const generator = report.results.filter((result) => result.kind === "gerador");
  for (const result of generator) assert.equal(result.games, 40, result.label);
  assert.equal(report.results.find((result) => result.id === "reducao:20x12").games, 80);
});

test("strategies only see draws before the contest being played", () => {
  const calls = [];
  const spy = {
    id: "spy", label: "Espiã", kind: "gerador", detail: "",
    build: (history) => {
      calls.push(history.length ? Math.max(...history.map((draw) => draw.contest)) : 0);
      return [{ numbers: Array.from({ length: 15 }, (_, index) => index + 1) }];
    },
  };
  runStrategyLab({ slug: "lotofacil", draws: syntheticDraws(30), contests: 5, ticketsPerContest: 1, seed: 1, strategies: [spy] });
  // Concursos 26 a 30: cada geração vê só até o concurso anterior.
  assert.deepEqual(calls, [25, 26, 27, 28, 29]);
});

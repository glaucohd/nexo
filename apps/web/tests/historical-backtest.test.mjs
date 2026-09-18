import assert from "node:assert/strict";
import test from "node:test";

import { backtestTickets, combinations, rankBacktestTickets } from "../src/lib/historical-backtest.ts";

const prize = (hits, value, extraHits = null, label = `${hits} acertos`) => ({
  label, hits, extraHits, winners: 1, prize: value,
});
const draw = (contest, numbers, prizes, extras = null) => ({
  contest, date: "2026-09-15", numbers, prizes, extras,
});

test("expanded Mega-Sena bets count each embedded simple-game prize", () => {
  assert.equal(combinations(6, 4), 15);
  const report = backtestTickets("mega-sena", [
    { numbers: [1, 2, 3, 4, 5, 6, 7] },
  ], [draw(10, [1, 2, 3, 4, 5, 8], [prize(5, 100), prize(4, 10)])]);
  assert.deepEqual(report.distribution, [{ hits: 5, contests: 1 }]);
  assert.equal(report.knownGrossCents, 25000); // 2 quinas + 5 quadras
  assert.equal(report.prizeDraws, 1);
});

test("Lotomania recognizes both zero and twenty hits", () => {
  const ticket = { numbers: Array.from({ length: 50 }, (_, index) => index) };
  const report = backtestTickets("lotomania", [ticket], [
    draw(11, Array.from({ length: 20 }, (_, index) => index + 50), [prize(0, 200)]),
    draw(10, Array.from({ length: 20 }, (_, index) => index), [prize(20, 1000)]),
  ]);
  assert.deepEqual(report.distribution, [{ hits: 20, contests: 1 }, { hits: 0, contests: 1 }]);
  assert.equal(report.knownGrossCents, 120000);
  assert.equal(report.contestsWithPrize, 2);
});

test("+Milionária checks both trevos and flags unpublished payouts", () => {
  const ticket = { numbers: [1, 2, 3, 4, 5, 6], trevos: [1, 2] };
  const report = backtestTickets("mais-milionaria", [ticket], [
    draw(12, [1, 2, 3, 4, 5, 6], [prize(6, 100, 2)], { trevos: [1, 2] }),
    draw(11, [1, 2, 3, 4, 5, 7], [prize(5, 10, null, "5 + 1 ou nenhum trevo")], { trevos: [1, 3] }),
    draw(10, [1, 2, 3, 4, 5, 6], [{ ...prize(6, 0, 2), winners: 0 }], { trevos: [1, 2] }),
    draw(9, [1, 2, 3, 4, 5, 6], [prize(6, 100, 2)]),
  ]);
  assert.equal(report.contests, 3);
  assert.equal(report.skippedContests, 1);
  assert.equal(report.knownGrossCents, 11000);
  assert.equal(report.unavailablePrizeUnits, 1);
});

test("Dia de Sorte awards the month separately, including expanded tickets", () => {
  const report = backtestTickets("dia-de-sorte", [
    { numbers: [1, 2, 3, 4, 5, 6, 7, 8], month: 9 },
  ], [draw(15, [1, 2, 3, 4, 5, 6, 9], [prize(6, 20), prize(0, 2, null, "Mês da Sorte")], { mesSorte: "Setembro" })]);
  assert.equal(report.knownGrossCents, 5600); // 2 six-hit games + 8 month matches
});

test("Dia de Sorte checks the early contests whose month is a numeric string", () => {
  const report = backtestTickets("dia-de-sorte", [
    { numbers: [1, 2, 3, 4, 5, 6, 7], month: 2 },
  ], [draw(1, [1, 2, 3, 4, 5, 6, 7], [prize(0, 2, null, "Mês da Sorte")], { mesSorte: "2" })]);
  assert.equal(report.contests, 1);
  assert.equal(report.skippedContests, 0);
  assert.equal(report.knownGrossCents, 200);
});

test("unpublished payout is not presented as a monetary estimate", () => {
  const report = backtestTickets("lotofacil", [
    { numbers: Array.from({ length: 15 }, (_, index) => index + 1) },
  ], [draw(1, Array.from({ length: 15 }, (_, index) => index + 1), [
    { ...prize(15, 0), winners: 0 },
  ])]);
  assert.equal(report.knownGrossCents, 0);
  assert.equal(report.unavailablePrizeUnits, 1);
  assert.equal(report.tickets[0].prizeDraws, 1);
});

test("Lotofácil separates contests with 14+ from winning simple bets inside expanded tickets", () => {
  const report = backtestTickets("lotofacil", [
    { numbers: Array.from({ length: 15 }, (_, index) => index + 1) },
    { numbers: Array.from({ length: 16 }, (_, index) => index + 1) },
  ], [
    draw(2, Array.from({ length: 15 }, (_, index) => index + 1), []),
    draw(1, [...Array.from({ length: 14 }, (_, index) => index + 1), 17], []),
  ]);
  assert.deepEqual(report.lotofacil, { contestsWith14Plus: 2, contestsWith15: 1, simple14Prizes: 18, simple15Prizes: 2 });
  assert.deepEqual(report.distribution.filter((entry) => entry.hits >= 14), [
    { hits: 15, contests: 2 }, { hits: 14, contests: 2 },
  ]);
});

test("historical results rank best points first, then average, preserving game numbers", () => {
  const tickets = [
    { position: 1, bestHits: 11, averageHits: 9.1, prizeDraws: 20, knownGrossCents: 1000 },
    { position: 2, bestHits: 13, averageHits: 8.9, prizeDraws: 10, knownGrossCents: 500 },
    { position: 3, bestHits: 13, averageHits: 9.2, prizeDraws: 5, knownGrossCents: 300 },
  ];
  assert.deepEqual(rankBacktestTickets(tickets).map((ticket) => ticket.position), [3, 2, 1]);
  assert.deepEqual(tickets.map((ticket) => ticket.position), [1, 2, 3]);
});

test("Timemania scores by hits on a 10-number bet and ignores the team prize", () => {
  const ticket = { numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
  const report = backtestTickets("timemania", [ticket], [
    draw(100, [1, 2, 3, 4, 5, 6, 7], [prize(7, 1000), prize(3, 5), { ...prize(0, 8.5), label: "Time do Coração" }], { timeCoracao: "FLAMENGO /RJ" }),
  ]);
  // 7 das 10 dezenas do bilhete estão no sorteio: acerto máximo é 7.
  assert.deepEqual(report.distribution, [{ hits: 7, contests: 1 }]);
  // Só a faixa de 7 acertos paga; "Time do Coração" fica de fora da conta.
  assert.equal(report.knownGrossCents, 100000);
});

test("Timemania counts partial hits without inflating with the team tier", () => {
  const ticket = { numbers: [1, 2, 3, 50, 51, 52, 53, 54, 55, 56] };
  const report = backtestTickets("timemania", [ticket], [
    draw(101, [1, 2, 3, 20, 21, 22, 23], [prize(3, 7), { ...prize(0, 8.5), label: "Time do Coração" }], { timeCoracao: "SANTOS /SP" }),
  ]);
  assert.deepEqual(report.distribution, [{ hits: 3, contests: 1 }]);
  assert.equal(report.knownGrossCents, 700);
});

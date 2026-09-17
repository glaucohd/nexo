import assert from "node:assert/strict";
import test from "node:test";

import { backtestTickets, combinations } from "../src/lib/historical-backtest.ts";

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

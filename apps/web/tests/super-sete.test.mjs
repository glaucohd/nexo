import assert from "node:assert/strict";
import test from "node:test";

import { backtestTickets } from "../src/lib/historical-backtest.ts";
import { generateSuperSeteTickets, superSeteColumnSizes, superSeteCombinations, superSeteHitDistribution, validSuperSeteDraw, validSuperSeteTicket } from "../src/lib/super-sete.ts";

const emptyRules = () => ({ fixed: Array.from({ length: 7 }, () => []), avoided: Array.from({ length: 7 }, () => []) });
const random = (() => { let seed = 139; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32); })();

test("Super Sete keeps seven positional digits, including repeated zeroes", () => {
  assert.equal(validSuperSeteDraw([5, 0, 0, 5, 1, 0, 2]), true);
  assert.equal(validSuperSeteDraw([5, 0, 0, 5, 1, 0, 10]), false);
  assert.deepEqual(superSeteColumnSizes(7), [1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(superSeteColumnSizes(15), [3, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual(superSeteColumnSizes(8, [[], [], [], [], [], [], [1, 2]]), [1, 1, 1, 1, 1, 1, 2]);
});

test("generator respects fixed and excluded digits in each independent column", () => {
  const rules = emptyRules();
  rules.fixed[6] = [0, 7];
  rules.avoided[0] = [0, 1, 2];
  const tickets = generateSuperSeteTickets({ quantity: 12, total: 8, mode: "pure", rules, random });
  assert.equal(tickets.length, 12);
  assert.equal(new Set(tickets.map((ticket) => JSON.stringify(ticket.columns))).size, 12);
  for (const ticket of tickets) {
    assert.equal(validSuperSeteTicket(ticket), true);
    assert.deepEqual(ticket.columns[6], [0, 7]);
    assert.ok(!ticket.columns[0].some((digit) => rules.avoided[0].includes(digit)));
    assert.equal(superSeteCombinations(ticket), 2);
  }
});

test("expanded bets count the simple games in every winning tier", () => {
  const ticket = { columns: [[1, 2], [0], [0], [5], [1], [0], [2]] };
  const outcome = [1, 0, 0, 5, 1, 0, 2];
  assert.deepEqual(superSeteHitDistribution(ticket, outcome), [0, 0, 0, 0, 0, 0, 1, 1]);
  assert.equal(superSeteHitDistribution(ticket, outcome).reduce((a, b) => a + b, 0), 2);
  const draw = { contest: 899, date: "2026-09-16", numbers: outcome, extras: null, prizes: [
    { label: "7 acertos", hits: 7, extraHits: null, winners: 1, prize: 100 },
    { label: "6 acertos", hits: 6, extraHits: null, winners: 1, prize: 10 },
  ] };
  const report = backtestTickets("super-sete", [{ numbers: [], columns: ticket.columns }], [draw]);
  assert.equal(report.knownGrossCents, 11000);
  assert.equal(report.prizeDraws, 1);
  assert.equal(report.tickets[0].bestHits, 7);
});

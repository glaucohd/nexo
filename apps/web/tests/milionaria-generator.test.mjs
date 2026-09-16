import assert from "node:assert/strict";
import test from "node:test";

import {
  availableNumbers,
  coveragePercent,
  generateMilionariaTickets,
  isExcluded,
  ticketCost,
} from "../src/lib/milionaria-generator.ts";

test("columns, rows and halves match the 10-by-5 ticket", () => {
  const general = new Set(["column:1"]);
  const personal = new Set(["row:3"]);
  assert.equal(isExcluded(1, general, personal), true);
  assert.equal(isExcluded(11, general, personal), true);
  assert.equal(isExcluded(12, general, personal), true);
  assert.equal(isExcluded(17, general, personal), false);
  assert.equal(availableNumbers(general, personal).length, 36);
  assert.deepEqual(availableNumbers(new Set(["half:1"]), new Set()).slice(0, 3), [26, 27, 28]);
});

test("coverage describes the allowed draw space, not ticket win chance", () => {
  assert.equal(coveragePercent(50), 100);
  assert.equal(coveragePercent(5), 0);
  assert.equal(ticketCost(6, 4), 24);
  assert.equal(ticketCost(7, 1), 42);
  assert.equal(ticketCost(12, 1), 5544);
});

test("general and per-game exclusions both apply to generated numbers", () => {
  let seed = 872123;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const tickets = generateMilionariaTickets({
    quantity: 4,
    size: 6,
    general: new Set(["column:1"]),
    personal: [new Set(["row:1"]), new Set(["row:2"]), new Set(["half:1"]), new Set()],
    random,
  });
  assert.equal(tickets.length, 4);
  assert.equal(new Set(tickets.map((ticket) => `${ticket.numbers.join(",")}|${ticket.trevos.join(",")}`)).size, 4);
  tickets.forEach((ticket, index) => {
    assert.equal(ticket.numbers.length, 6);
    assert.equal(new Set(ticket.numbers).size, 6);
    assert.equal(ticket.trevos.length, 2);
    assert.equal(new Set(ticket.trevos).size, 2);
    assert.ok(ticket.numbers.every((number) => !isExcluded(number, new Set(["column:1"]), [new Set(["row:1"]), new Set(["row:2"]), new Set(["half:1"]), new Set()][index])));
  });
});

test("impossible exclusions are rejected", () => {
  assert.throws(() => generateMilionariaTickets({
    quantity: 1,
    size: 6,
    general: new Set(["half:1", "half:2"]),
    personal: [],
  }), RangeError);
});

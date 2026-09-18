import assert from "node:assert/strict";
import test from "node:test";

import {
  availableLotteryNumbers,
  generateLotteryTickets,
  generateLotomaniaMirrorPairs,
  generateMirrorPairs,
  isNumberExcluded,
  lotteryBoardNumber,
  lotteryBoardPosition,
  lotteryGames,
  lotofacilPortfolioProfile,
  lotofacilSimpleBetCount,
  lotomaniaBlockCounts,
  lotomaniaBlockNumbers,
  randomLotomaniaBlockRules,
  repeatHistory,
  standardTicketCost,
} from "../src/lib/lottery-generator.ts";

function seededRandom(seed = 9271) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const history = [
  { contest: 102, numbers: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 24, 25, 2] },
  { contest: 101, numbers: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 23, 24, 25, 1] },
];

test("all standard modalities generate valid, distinct tickets", () => {
  for (const slug of ["lotofacil", "mega-sena", "quina", "dia-de-sorte", "lotomania"]) {
    const game = lotteryGames[slug];
    const tickets = generateLotteryTickets({ slug, quantity: 5, size: game.min, mode: "pure", random: seededRandom() });
    assert.equal(tickets.length, 5);
    assert.equal(new Set(tickets.map((ticket) => `${ticket.numbers.join(",")}|${ticket.month ?? ""}`)).size, 5);
    for (const ticket of tickets) {
      assert.equal(ticket.numbers.length, game.min);
      assert.equal(new Set(ticket.numbers).size, game.min);
      assert.ok(ticket.numbers.every((number) => number >= game.start && number < game.start + game.total));
      if (slug === "lotomania") assert.ok(lotomaniaBlockCounts(ticket.numbers).every((count) => count >= 1 && count <= 3));
      if (slug === "dia-de-sorte") assert.ok(ticket.month >= 1 && ticket.month <= 12);
      else assert.equal(ticket.month, undefined);
    }
  }
});

test("Lotofácil coverage spreads twenty simple games without repeating 13+ outcomes", () => {
  const tickets = generateLotteryTickets({ slug: "lotofacil", quantity: 20, size: 15, mode: "coverage", history, random: seededRandom(116) });
  const profile = lotofacilPortfolioProfile(tickets);
  assert.equal(profile.coveredNumbers, 25);
  assert.equal(profile.pairsSharing11, 0);
  assert.equal(profile.pairsSharing13, 0);
  assert.ok(profile.highestOverlap <= 10);
  assert.equal(profile.exact15Draws, 20);
  assert.equal(profile.simpleBets, 20);
  assert.equal(profile.drawsWith14Plus, 20 * 151);
  assert.equal(profile.raw14PlusDraws, 20 * 151);
  assert.equal(profile.possibleDraws, 3_268_760);
  assert.equal(new Set(tickets.map((ticket) => ticket.numbers.join(","))).size, 20);
});

test("Lotofácil profile counts overlapping 14-point outcomes exactly", () => {
  const profile = lotofacilPortfolioProfile([
    { numbers: Array.from({ length: 15 }, (_, index) => index + 1) },
    { numbers: Array.from({ length: 15 }, (_, index) => index + 2) },
  ]);
  assert.equal(profile.exact15Draws, 2);
  assert.equal(profile.pairsSharing13, 1);
  assert.equal(profile.drawsWith14Plus, 277);
  assert.equal(profile.raw14PlusDraws, 302);
});

test("Lotofácil coverage handles expanded tickets and counts embedded simple bets", () => {
  const examples = [
    { size: 16, simple: 16, fourteenPlus: 1096 },
    { size: 17, simple: 136, fourteenPlus: 5576 },
    { size: 18, simple: 816, fourteenPlus: 22236 },
    { size: 19, simple: 3876, fourteenPlus: 73644 },
    { size: 20, simple: 15504, fourteenPlus: 209304 },
  ];
  for (const { size, simple, fourteenPlus } of examples) {
    const single = lotofacilPortfolioProfile([{ numbers: Array.from({ length: size }, (_, index) => index + 1) }]);
    assert.equal(lotofacilSimpleBetCount(size), simple);
    assert.equal(single.exact15Draws, simple);
    assert.equal(single.simpleBets, simple);
    assert.equal(single.drawsWith14Plus, fourteenPlus);
    assert.equal(single.raw14PlusDraws, fourteenPlus);
    const tickets = generateLotteryTickets({ slug: "lotofacil", quantity: 20, size, mode: "coverage", history, random: seededRandom(size) });
    const profile = lotofacilPortfolioProfile(tickets);
    assert.equal(tickets.length, 20);
    assert.ok(tickets.every((ticket) => ticket.numbers.length === size));
    assert.ok(profile.exact15Draws <= profile.simpleBets);
    assert.ok(profile.drawsWith14Plus <= profile.raw14PlusDraws);
  }
});

test("Lotofácil coverage respects intuition and rejects impossible separation", () => {
  const fixed = new Set([1, 3, 5, 7, 9]);
  const avoided = new Set([23, 24]);
  const tickets = generateLotteryTickets({ slug: "lotofacil", quantity: 20, size: 15, mode: "coverage", repeatCount: 9, fixed, avoided, history, random: seededRandom(7) });
  assert.equal(lotofacilPortfolioProfile(tickets).pairsSharing13, 0);
  tickets.forEach((ticket) => {
    assert.ok([...fixed].every((number) => ticket.numbers.includes(number)));
    assert.ok([...avoided].every((number) => !ticket.numbers.includes(number)));
    assert.equal(ticket.numbers.filter((number) => history[0].numbers.includes(number)).length, 9);
  });
  assert.throws(() => generateLotteryTickets({ slug: "lotofacil", quantity: 2, size: 15, mode: "coverage", fixed: new Set(Array.from({ length: 13 }, (_, index) => index + 1)), random: seededRandom(8) }), /Reduza as dezenas fixas/);
  assert.throws(() => generateLotteryTickets({ slug: "mega-sena", quantity: 2, size: 6, mode: "coverage" }), /exclusiva da Lotofácil/);
});

test("Mega-Sena, Quina and Lotomania respect quadrant and per-game exclusions", () => {
  for (const slug of ["mega-sena", "quina", "lotomania"]) {
    const general = new Set(["column:1", "quadrant:2"]);
    const personal = [new Set(["row:1"]), new Set(["row:3"]), new Set()];
    const tickets = generateLotteryTickets({ slug, quantity: 3, size: lotteryGames[slug].min, mode: "pure", general, personal, random: seededRandom(3441) });
    assert.equal(tickets.length, 3);
    tickets.forEach((ticket, index) => {
      assert.ok(ticket.numbers.every((number) => !isNumberExcluded(slug, number, general, personal[index])));
      if (slug === "lotomania") assert.ok(lotomaniaBlockCounts(ticket.numbers).every((count) => count <= 3));
    });
    assert.ok(!availableLotteryNumbers(slug, general, personal[0]).includes(1));
  }
  assert.equal(isNumberExcluded("mega-sena", 6, new Set(["quadrant:2"]), new Set()), true);
  assert.equal(isNumberExcluded("mega-sena", 36, new Set(["quadrant:2"]), new Set()), false);
  assert.equal(isNumberExcluded("quina", 45, new Set(["quadrant:3"]), new Set()), true);
  assert.equal(isNumberExcluded("lotomania", 1, new Set(["row:1"]), new Set()), true);
  assert.equal(isNumberExcluded("lotomania", 0, new Set(["row:10"]), new Set()), true);
  assert.equal(isNumberExcluded("lotomania", 99, new Set(["quadrant:4"]), new Set()), true);
});

test("Lotomania board follows 01–10 through 91–00 and forms 2-by-2 blocks", () => {
  assert.deepEqual([0, 1, 10, 11].map((position) => lotteryBoardNumber("lotomania", position)), [1, 2, 11, 12]);
  assert.deepEqual([98, 99].map((position) => lotteryBoardNumber("lotomania", position)), [99, 0]);
  assert.equal(lotteryBoardPosition("lotomania", 0), 99);
  assert.equal(lotteryBoardPosition("lotomania", 12), 11);
  assert.equal(isNumberExcluded("lotomania", 0, new Set(["column:10"]), new Set()), true);
  assert.deepEqual(lotomaniaBlockNumbers(1), [1, 2, 11, 12]);
  assert.deepEqual(lotomaniaBlockNumbers(25), [89, 90, 99, 0]);
});

test("Lotomania can exclude a 2-by-2 block generally or for just one game", () => {
  const firstBlock = lotomaniaBlockNumbers(1);
  const lastBlock = lotomaniaBlockNumbers(25);
  assert.ok(firstBlock.every((number) => isNumberExcluded("lotomania", number, new Set(["block:1"]), new Set())));
  assert.ok(lastBlock.every((number) => isNumberExcluded("lotomania", number, new Set(), new Set(["block:25"]))));
  assert.equal(isNumberExcluded("lotomania", 3, new Set(["block:1"]), new Set()), false);
  assert.ok(firstBlock.every((number) => !availableLotteryNumbers("lotomania", new Set(["block:1"]), new Set()).includes(number)));
  const personal = [new Set(["block:1"]), new Set(["block:25"]), new Set()];
  const tickets = generateLotteryTickets({ slug: "lotomania", quantity: 3, size: 50, mode: "mixed", history: [{ contest: 1, numbers: Array.from({ length: 20 }, (_, number) => number) }], personal, random: seededRandom(281) });
  assert.ok(firstBlock.every((number) => !tickets[0].numbers.includes(number)));
  assert.ok(lastBlock.every((number) => !tickets[1].numbers.includes(number)));
  assert.ok(tickets[2].numbers.every((number) => !isNumberExcluded("lotomania", number, new Set(), personal[2])));
  tickets.forEach((ticket, index) => {
    const counts = lotomaniaBlockCounts(ticket.numbers);
    assert.ok(counts.every((count) => count <= 3));
    assert.equal(counts.filter((count) => count === 0).length, index === 2 ? 0 : 1);
    if (index < 2) assert.equal(counts[index === 1 ? 24 : 0], 0);
  });
});

test("Lotomania accepts 00, exact repetition and complementary mirror pairs", () => {
  const latest = [{ contest: 1, numbers: Array.from({ length: 20 }, (_, number) => number) }];
  const options = { quantity: 3, mode: "pure", history: latest, repeatCount: 10, fixed: new Set([0]), avoided: new Set([55]), general: new Set(["row:9"]), random: seededRandom(123) };
  const pairs = generateLotomaniaMirrorPairs(options);
  assert.equal(pairs.length, 6);
  pairs.forEach((ticket) => {
    assert.equal(ticket.numbers.length, 50);
    assert.ok(lotomaniaBlockCounts(ticket.numbers).every((count) => count >= 1 && count <= 3));
  });
  for (let index = 0; index < 3; index += 1) {
    const base = pairs[index * 2].numbers;
    const mirror = pairs[index * 2 + 1].numbers;
    assert.ok(base.includes(0));
    assert.ok(!base.includes(55));
    assert.ok(base.every((number) => !isNumberExcluded("lotomania", number, options.general, new Set())));
    assert.equal(base.filter((number) => latest[0].numbers.includes(number)).length, 10);
    assert.equal(base.filter((number) => mirror.includes(number)).length, 0);
    assert.equal(new Set([...base, ...mirror]).size, 100);
    assert.ok(mirror.includes(55));
  }
});

test("Lotomania historical modes preserve the 50-number rule", () => {
  const draws = [
    { contest: 2, numbers: Array.from({ length: 20 }, (_, number) => number) },
    { contest: 1, numbers: Array.from({ length: 20 }, (_, number) => number + 20) },
  ];
  for (const mode of ["balanced", "hot", "delayed", "mixed"]) {
    const [ticket] = generateLotteryTickets({ slug: "lotomania", quantity: 1, size: 50, mode, history: draws, random: seededRandom(992) });
    assert.equal(ticket.numbers.length, 50);
    assert.equal(new Set(ticket.numbers).size, 50);
    assert.ok(ticket.numbers.every((number) => number >= 0 && number <= 99));
    assert.ok(lotomaniaBlockCounts(ticket.numbers).every((count) => count >= 1 && count <= 3));
  }
});

test("Lotomania completes only the minimum number of blocks forced by exclusions", () => {
  const excluded = new Set(Array.from({ length: 9 }, (_, index) => `block:${index + 1}`));
  const [ticket] = generateLotteryTickets({ slug: "lotomania", quantity: 1, size: 50, mode: "pure", general: excluded, random: seededRandom(77) });
  const counts = lotomaniaBlockCounts(ticket.numbers);
  assert.equal(ticket.numbers.length, 50);
  assert.deepEqual(counts.slice(0, 9), Array(9).fill(0));
  assert.equal(counts.filter((count) => count === 0).length, 9);
  assert.equal(counts.filter((count) => count === 4).length, 2);

  const [withFixed] = generateLotteryTickets({ slug: "lotomania", quantity: 1, size: 50, mode: "pure", fixed: new Set([1, 2, 11, 12]), random: seededRandom(78) });
  assert.equal(lotomaniaBlockCounts(withFixed.numbers).filter((count) => count === 4).length, 1);
  assert.throws(() => generateLotteryTickets({ slug: "lotomania", quantity: 1, size: 50, mode: "pure", general: new Set(Array.from({ length: 13 }, (_, index) => `block:${index + 1}`)) }), /menos de 50 dezenas/);
});

test("Lotomania mirror keeps the exact complement when a block is excluded or completed", () => {
  const pairs = generateLotomaniaMirrorPairs({ quantity: 1, mode: "pure", general: new Set(["block:1"]), random: seededRandom(79) });
  const [base, mirror] = pairs;
  assert.equal(lotomaniaBlockCounts(base.numbers)[0], 0);
  assert.equal(lotomaniaBlockCounts(mirror.numbers)[0], 4);
  assert.equal(lotomaniaBlockCounts(base.numbers).filter((count) => count === 4).length, 0);
  assert.equal(lotomaniaBlockCounts(mirror.numbers).filter((count) => count === 4).length, 1);
  assert.equal(new Set([...base.numbers, ...mirror.numbers]).size, 100);

  const nineExcluded = new Set(Array.from({ length: 9 }, (_, index) => `block:${index + 1}`));
  const [forcedBase, forcedMirror] = generateLotomaniaMirrorPairs({ quantity: 1, mode: "pure", general: nineExcluded, random: seededRandom(80) });
  assert.equal(lotomaniaBlockCounts(forcedBase.numbers).filter((count) => count === 4).length, 2);
  assert.equal(lotomaniaBlockCounts(forcedMirror.numbers).filter((count) => count === 4).length, 9);
  assert.equal(new Set([...forcedBase.numbers, ...forcedMirror.numbers]).size, 100);
});

test("Lotomania draws feasible automatic block exclusions independently for each game", () => {
  const general = new Set(["block:1"]);
  const manual = [new Set(["block:2"]), new Set(["block:3"]), new Set()];
  const fixed = new Set([7, 8, 17, 18]);
  const generated = randomLotomaniaBlockRules({ quantity: 3, count: 3, general, personal: manual, fixed, random: seededRandom(81) });
  assert.equal(generated.length, 3);
  generated.forEach((blocks, index) => {
    assert.equal(blocks.length, 3);
    assert.equal(new Set(blocks).size, 3);
    assert.ok(blocks.every((block) => !general.has(block) && !manual[index].has(block)));
    const personal = new Set([...manual[index], ...blocks]);
    const [ticket] = generateLotteryTickets({ slug: "lotomania", quantity: 1, size: 50, mode: "pure", general, personal: [personal], fixed, random: seededRandom(index + 82) });
    assert.ok(blocks.every((block) => lotomaniaBlockNumbers(Number(block.slice(6))).every((number) => !ticket.numbers.includes(number))));
  });
  assert.throws(() => randomLotomaniaBlockRules({ quantity: 1, count: 4, general: new Set(Array.from({ length: 9 }, (_, index) => `block:${index + 1}`)), random: seededRandom(85) }), /não comporta 4 blocos/);
});

test("exact repetition and all historical modes keep valid game sizes", () => {
  for (const mode of ["pure", "balanced", "hot", "delayed", "mixed"]) {
    const tickets = generateLotteryTickets({ slug: "lotofacil", quantity: 3, size: 15, mode, repeatCount: 9, history, random: seededRandom(245) });
    assert.equal(tickets.length, 3);
    tickets.forEach((ticket) => assert.equal(ticket.numbers.filter((number) => history[0].numbers.includes(number)).length, 9));
  }
  assert.throws(() => generateLotteryTickets({ slug: "mega-sena", quantity: 1, size: 6, mode: "pure", repeatCount: 6, history: [{ contest: 1, numbers: [1, 2, 3, 4, 5, 6] }], general: new Set(["row:1"]) }), /Não é possível repetir/);
});

test("fixed and avoided choices are honored together with exact repetition and area rules", () => {
  const last = [{ contest: 9, numbers: [1, 2, 3, 4, 5, 6] }];
  const tickets = generateLotteryTickets({
    slug: "mega-sena", quantity: 3, size: 6, mode: "mixed", repeatCount: 2,
    fixed: new Set([1, 31]), avoided: new Set([2, 3, 45]),
    general: new Set(["column:10"]), personal: [new Set(["row:2"]), new Set(["row:3"]), new Set()],
    history: last, random: seededRandom(2431),
  });
  assert.equal(tickets.length, 3);
  tickets.forEach((ticket) => {
    assert.ok(ticket.numbers.includes(1) && ticket.numbers.includes(31));
    assert.ok(ticket.numbers.every((number) => ![2, 3, 45].includes(number)));
    assert.equal(ticket.numbers.filter((number) => last[0].numbers.includes(number)).length, 2);
  });
  assert.throws(() => generateLotteryTickets({ slug: "lotofacil", quantity: 1, size: 15, mode: "pure", fixed: new Set([1]), avoided: new Set([1]) }), /conflito/);
  assert.throws(() => generateLotteryTickets({ slug: "mega-sena", quantity: 1, size: 6, mode: "pure", fixed: new Set([1]), general: new Set(["row:1"]) }), /fixa/);
});

test("each mirror pair has its own five fixed numbers and covers all 25", () => {
  const pairs = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15]];
  const tickets = generateMirrorPairs(pairs, seededRandom(593));
  assert.equal(tickets.length, 6);
  assert.equal(new Set(tickets.map((ticket) => ticket.numbers.join(","))).size, 6);
  pairs.forEach((fixed, index) => {
    const a = tickets[index * 2].numbers;
    const b = tickets[index * 2 + 1].numbers;
    assert.equal(a.length, 15);
    assert.equal(b.length, 15);
    assert.ok(fixed.every((number) => a.includes(number) && b.includes(number)));
    assert.equal(new Set([...a, ...b]).size, 25);
    assert.equal(a.filter((number) => b.includes(number)).length, 5);
  });
  assert.throws(() => generateMirrorPairs([[1, 2, 3, 4, 5], [5, 4, 3, 2, 1]]), /repetem/);
});

test("standardTicketCost scales with embedded simple bets, and Lotomania stays flat", () => {
  assert.equal(standardTicketCost("lotofacil", 15, 1), 300);
  assert.equal(standardTicketCost("lotofacil", 16, 1), 300 * lotofacilSimpleBetCount(16));
  assert.equal(standardTicketCost("lotofacil", 15, 4), 300 * 4);
  assert.equal(standardTicketCost("mega-sena", 6, 3), 600 * 3);
  assert.equal(standardTicketCost("mega-sena", 7, 1), 600 * 7);
  assert.equal(standardTicketCost("quina", 5, 2), 250 * 2);
  assert.equal(standardTicketCost("dia-de-sorte", 7, 5), 250 * 5);
  assert.equal(standardTicketCost("lotomania", 50, 4), 300 * 4);
});

test("repeatHistory counts repeats only between neighbouring contests", () => {
  // Histórico do mais recente para o mais antigo, com um buraco entre 12 e 10.
  const draws = [
    { contest: 14, numbers: [1, 2, 3, 4, 5, 6, 7] },   // vs 13: repete 1,2 -> 2
    { contest: 13, numbers: [1, 2, 20, 21, 22, 23, 24] }, // vs 12: repete 20 -> 1
    { contest: 12, numbers: [20, 30, 31, 32, 33, 34, 35] }, // 11 não existe: ignora
    { contest: 10, numbers: [40, 41, 42, 43, 44, 45, 46] },
  ];
  const stats = repeatHistory(draws);
  assert.equal(stats.pairs, 2);
  assert.equal(stats.count(2), 1);
  assert.equal(stats.count(1), 1);
  assert.equal(stats.count(0), 0);
  assert.equal(stats.share(2), 0.5);
  assert.equal(stats.share(5), 0);
});

test("repeatHistory handles an empty or single-draw history", () => {
  assert.equal(repeatHistory([]).pairs, 0);
  assert.equal(repeatHistory([{ contest: 1, numbers: [1, 2, 3] }]).pairs, 0);
  assert.equal(repeatHistory([]).share(0), 0);
});

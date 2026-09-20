import assert from "node:assert/strict";
import test from "node:test";

import { buildProfile, frameNumbers, generateProfileTickets, preferredComposition } from "../src/lib/hot-cold-profile.ts";

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const lotofacil = { total: 25, start: 1, columns: 5, drawSize: 15 };

function fakeHistory(count, game, random) {
  return Array.from({ length: count }, (_, index) => {
    const pool = Array.from({ length: game.total }, (_, n) => n + game.start);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { contest: count - index, numbers: pool.slice(0, game.drawSize).sort((a, b) => a - b) };
  });
}

test("a moldura da Lotofácil tem 16 dezenas e o miolo 9", () => {
  const frame = frameNumbers(lotofacil);
  assert.equal(frame.size, 16);
  assert.deepEqual([7, 8, 9, 12, 13, 14, 17, 18, 19].filter((number) => frame.has(number)), []);
  assert.ok(frame.has(1) && frame.has(5) && frame.has(21) && frame.has(25) && frame.has(11) && frame.has(15));
});

test("a moldura usa as colunas do volante de cada modalidade", () => {
  // Mega-Sena: 10 colunas × 6 linhas → 10 + 10 + 4 + 4 dezenas na borda.
  assert.equal(frameNumbers({ total: 60, start: 1, columns: 10 }).size, 28);
  // Dia de Sorte: 7 colunas, última linha incompleta (29, 30, 31).
  const dia = frameNumbers({ total: 31, start: 1, columns: 7 });
  assert.ok([29, 30, 31, 1, 7, 14].every((number) => dia.has(number)));
  assert.ok(!dia.has(9));
});

test("a composição preferencial é 7·5·3 na Lotofácil e mantém a proporção nas demais", () => {
  assert.deepEqual(preferredComposition(15), { hot: 7, neutral: 5, cold: 3 });
  for (const size of [5, 6, 7, 15]) {
    const { hot, neutral, cold } = preferredComposition(size);
    assert.equal(hot + neutral + cold, size);
    assert.ok(hot > cold && neutral > 0);
  }
});

test("as dezenas se dividem em terços pela frequência na janela", () => {
  const history = fakeHistory(60, lotofacil, seeded(7));
  const profile = buildProfile(history, lotofacil, 30);
  assert.equal(profile.hot.length + profile.neutral.length + profile.cold.length, 25);
  assert.equal(profile.hot.length, 8);
  assert.equal(profile.cold.length, 8);
  const lowestHot = Math.min(...profile.hot.map((number) => profile.frequencies.get(number)));
  const highestNeutral = Math.max(...profile.neutral.map((number) => profile.frequencies.get(number)));
  const lowestNeutral = Math.min(...profile.neutral.map((number) => profile.frequencies.get(number)));
  const highestCold = Math.max(...profile.cold.map((number) => profile.frequencies.get(number)));
  assert.ok(lowestHot >= highestNeutral);
  assert.ok(lowestNeutral >= highestCold);
  const frequencySum = [...profile.frequencies.values()].reduce((sum, value) => sum + value, 0);
  assert.equal(frequencySum, 30 * 15);
  assert.equal(profile.averageComposition.hot + profile.averageComposition.neutral + profile.averageComposition.cold, 15);
});

test("o atraso conta concursos desde a última aparição no histórico inteiro", () => {
  const game = { total: 4, start: 1, columns: 2, drawSize: 2 };
  const history = [
    { contest: 4, numbers: [1, 2] },
    { contest: 3, numbers: [1, 3] },
    { contest: 2, numbers: [2, 4] },
    { contest: 1, numbers: [3, 4] },
  ];
  const profile = buildProfile(history, game, 2);
  assert.deepEqual([1, 2, 3, 4].map((number) => profile.delays.get(number)), [0, 0, 1, 2]);
  assert.deepEqual([1, 2, 3, 4].map((number) => profile.frequencies.get(number)), [2, 1, 1, 0]);
});

test("na Dupla Sena a janela conta concursos e inclui os dois sorteios", () => {
  const game = { total: 50, start: 1, columns: 10, drawSize: 6 };
  const history = [
    { contest: 3, numbers: [1, 2, 3, 4, 5, 6] },
    { contest: 2, numbers: [1, 2, 3, 4, 5, 6] },
    { contest: 1, numbers: [7, 8, 9, 10, 11, 12] },
    // Segundo sorteio do concurso 3, vindo depois dos demais na lista.
    { contest: 3, numbers: [20, 21, 22, 23, 24, 25] },
  ];
  const profile = buildProfile(history, game, 1);
  assert.equal(profile.draws, 2);
  assert.equal(profile.totalContests, 3);
  assert.equal(profile.frequencies.get(20), 1);
  assert.equal(profile.frequencies.get(7), 0);
  assert.equal(profile.delays.get(20), 0);
  assert.equal(profile.delays.get(7), 2);
});

test("gera 10 jogos distintos em 4 + 4 + 2: preferenciais, perfil médio e fora da curva", () => {
  const history = fakeHistory(80, lotofacil, seeded(11));
  const profile = buildProfile(history, lotofacil, 30);
  const tickets = generateProfileTickets({ profile, game: lotofacil, random: seeded(3) });
  assert.equal(tickets.length, 10);
  assert.deepEqual(tickets.map((ticket) => ticket.kind), [...Array(4).fill("preferred"), ...Array(4).fill("average"), ...Array(2).fill("outlier")]);
  assert.equal(new Set(tickets.map((ticket) => ticket.numbers.join(","))).size, 10);
  for (const ticket of tickets) {
    assert.equal(ticket.numbers.length, 15);
    assert.equal(new Set(ticket.numbers).size, 15);
    const count = (list) => ticket.numbers.filter((number) => list.includes(number)).length;
    assert.deepEqual({ hot: count(profile.hot), neutral: count(profile.neutral), cold: count(profile.cold) }, ticket.composition);
    assert.equal(ticket.pairs, ticket.numbers.filter((number) => number % 2 === 0).length);
  }
  for (const ticket of tickets.filter((entry) => entry.kind === "preferred")) assert.deepEqual(ticket.composition, { hot: 7, neutral: 5, cold: 3 });
  for (const ticket of tickets.filter((entry) => entry.kind === "average")) assert.deepEqual(ticket.composition, profile.averageComposition);
  assert.deepEqual(tickets.filter((entry) => entry.kind === "outlier").map((ticket) => ticket.composition), [profile.compositionExtremes.coldHeavy, profile.compositionExtremes.hotHeavy]);
});

test("os jogos fora da curva fogem mesmo do padrão e os demais ficam nele", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const history = fakeHistory(80, lotofacil, seeded(seed));
    const profile = buildProfile(history, lotofacil, 30);
    const tickets = generateProfileTickets({ profile, game: lotofacil, random: seeded(seed + 10) });
    for (const ticket of tickets) {
      const outside = !profile.parityCurve.includes(ticket.pairs) || !profile.frameCurve.includes(ticket.frame);
      assert.equal(ticket.outsideParity, !profile.parityCurve.includes(ticket.pairs));
      assert.equal(ticket.outsideFrame, !profile.frameCurve.includes(ticket.frame));
      if (ticket.kind === "outlier") assert.ok(outside, `seed ${seed}: jogo fora da curva ficou na curva`);
      else assert.ok(!outside, `seed ${seed}: jogo ${ticket.kind} saiu da curva`);
    }
  }
});

test("a análise da curva conta os sorteios fora dela e mantém a ordem do mais antigo ao mais recente", () => {
  const history = fakeHistory(80, lotofacil, seeded(21));
  const profile = buildProfile(history, lotofacil, 30);
  const { curve, timeline } = profile;
  assert.equal(curve.total, 30);
  assert.equal(timeline.length, 30);
  assert.deepEqual(timeline.map((entry) => entry.contest), [...timeline.map((entry) => entry.contest)].sort((a, b) => a - b));
  assert.equal(curve.outsideParity, timeline.filter((entry) => entry.outsideParity).length);
  assert.equal(curve.outsideAny, timeline.filter((entry) => entry.outsideParity || entry.outsideFrame).length);
  assert.ok(curve.outsideBoth <= Math.min(curve.outsideParity, curve.outsideFrame));
  assert.ok(profile.outlierParity.every((value) => !profile.parityCurve.includes(value)));
  assert.ok(profile.outlierFrame.every((value) => !profile.frameCurve.includes(value)));
  // Sem repetir a curva: quem está na curva é exatamente o complemento do que está fora.
  const inside = timeline.filter((entry) => !entry.outsideParity && !entry.outsideFrame).length;
  assert.equal(inside + curve.outsideAny, 30);
});

test("os jogos ficam nos padrões mais comuns de pares e moldura", () => {
  const history = fakeHistory(80, lotofacil, seeded(5));
  const profile = buildProfile(history, lotofacil, 30);
  const parityOk = new Set(profile.parity.slice(0, 2).map((entry) => entry.value));
  const frameOk = new Set(profile.frameCounts.slice(0, 2).map((entry) => entry.value));
  const tickets = generateProfileTickets({ profile, game: lotofacil, random: seeded(9) });
  for (const ticket of tickets.filter((entry) => entry.kind !== "outlier")) {
    assert.ok(parityOk.has(ticket.pairs), `pares ${ticket.pairs}`);
    assert.ok(frameOk.has(ticket.frame), `moldura ${ticket.frame}`);
  }
});

test("as demais modalidades geram jogos do tamanho do sorteio, com mês e trevos quando há", () => {
  const specs = [
    ["mega-sena", { total: 60, start: 1, columns: 10, drawSize: 6, extra: null }],
    ["quina", { total: 80, start: 1, columns: 10, drawSize: 5, extra: null }],
    ["dupla-sena", { total: 50, start: 1, columns: 10, drawSize: 6, extra: null }],
    ["dia-de-sorte", { total: 31, start: 1, columns: 7, drawSize: 7, extra: "mes" }],
    ["mais-milionaria", { total: 50, start: 1, columns: 5, drawSize: 6, extra: "trevos" }],
  ];
  for (const [name, game] of specs) {
    const history = fakeHistory(60, game, seeded(name.length));
    const profile = buildProfile(history, game, 30);
    const tickets = generateProfileTickets({ profile, game, random: seeded(1) });
    assert.equal(tickets.length, 10, name);
    for (const ticket of tickets) {
      assert.equal(ticket.numbers.length, game.drawSize, name);
      assert.ok(ticket.numbers.every((number) => number >= game.start && number < game.start + game.total), name);
      if (game.extra === "mes") assert.ok(ticket.month >= 1 && ticket.month <= 12);
      if (game.extra === "trevos") assert.equal(new Set(ticket.trevos).size, 2);
    }
  }
});

test("sem concursos não há perfil para gerar", () => {
  const profile = buildProfile([], lotofacil, 30);
  assert.throws(() => generateProfileTickets({ profile, game: lotofacil }), RangeError);
});

test("a dezena atrasada está há mais de 2 vezes o intervalo normal sem sair", () => {
  // Lotofácil: chance de 60% por concurso → intervalo 1,67 → atrasada com 4 ou mais.
  // As dezenas 1 a 15 saem em todos os concursos; as 16 a 25 nunca saem.
  const history = Array.from({ length: 20 }, (_, index) => ({ contest: 20 - index, numbers: Array.from({ length: 15 }, (_, n) => n + 1) }));
  // A 24 saiu uma vez, no concurso mais antigo (atraso 19; as que nunca saíram têm 20).
  history[19].numbers = [...history[19].numbers.slice(0, 14), 24];
  const profile = buildProfile(history, lotofacil, 10);
  assert.equal(profile.lateThreshold, 4);
  assert.ok(Math.abs(profile.expectedGap - 5 / 3) < 1e-9);
  assert.equal(profile.late.length, 10);
  assert.equal(profile.late.at(-1), 24);
  assert.ok(profile.late.every((number) => number >= 16 && profile.delays.get(number) >= 4));
  assert.ok(![1, 2, 3, 15].some((number) => profile.late.includes(number)));
});

test("só é atrasada a dezena que chega ao limite", () => {
  // Concurso mais recente sem a dezena 25, e ela saiu no 5º mais recente: atraso 4 = limite.
  const history = Array.from({ length: 12 }, (_, index) => ({ contest: 12 - index, numbers: index === 4 ? [...Array.from({ length: 14 }, (_, n) => n + 1), 25] : Array.from({ length: 15 }, (_, n) => n + 1) }));
  const profile = buildProfile(history, lotofacil, 10);
  assert.equal(profile.delays.get(25), 4);
  assert.ok(profile.late.includes(25));
  history[3].numbers = [...Array.from({ length: 14 }, (_, n) => n + 1), 25];
  assert.equal(buildProfile(history, lotofacil, 10).delays.get(25), 3);
  assert.ok(!buildProfile(history, lotofacil, 10).late.includes(25));
});

test("o intervalo normal muda com a modalidade e com os dois sorteios da Dupla Sena", () => {
  const mega = { total: 60, start: 1, columns: 10, drawSize: 6 };
  assert.equal(buildProfile(fakeHistory(10, mega, seeded(1)), mega, 5).lateThreshold, 20);
  const dupla = { total: 50, start: 1, columns: 10, drawSize: 6 };
  const single = fakeHistory(10, dupla, seeded(2));
  const twice = single.flatMap((draw) => [draw, { ...draw, numbers: fakeHistory(1, dupla, seeded(draw.contest))[0].numbers }]);
  // Sorteio simples: chance 12% → intervalo 8,3 → 17. Dois por concurso: 22,6% → 4,4 → 9.
  assert.equal(buildProfile(single, dupla, 5).lateThreshold, 17);
  assert.equal(buildProfile(twice, dupla, 5).lateThreshold, 9);
});

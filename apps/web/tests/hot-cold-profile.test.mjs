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

test("gera 10 jogos distintos: 5 na composição preferencial e 5 na média da janela", () => {
  const history = fakeHistory(80, lotofacil, seeded(11));
  const profile = buildProfile(history, lotofacil, 30);
  const tickets = generateProfileTickets({ profile, game: lotofacil, random: seeded(3) });
  assert.equal(tickets.length, 10);
  assert.equal(new Set(tickets.map((ticket) => ticket.numbers.join(","))).size, 10);
  for (const ticket of tickets) {
    assert.equal(ticket.numbers.length, 15);
    assert.equal(new Set(ticket.numbers).size, 15);
    const count = (list) => ticket.numbers.filter((number) => list.includes(number)).length;
    assert.deepEqual({ hot: count(profile.hot), neutral: count(profile.neutral), cold: count(profile.cold) }, ticket.composition);
    assert.equal(ticket.pairs, ticket.numbers.filter((number) => number % 2 === 0).length);
  }
  assert.equal(tickets.filter((ticket) => ticket.preferred).length, 5);
  for (const ticket of tickets.filter((entry) => entry.preferred)) assert.deepEqual(ticket.composition, { hot: 7, neutral: 5, cold: 3 });
  for (const ticket of tickets.filter((entry) => !entry.preferred)) assert.deepEqual(ticket.composition, profile.averageComposition);
});

test("os jogos ficam nos padrões mais comuns de pares e moldura", () => {
  const history = fakeHistory(80, lotofacil, seeded(5));
  const profile = buildProfile(history, lotofacil, 30);
  const parityOk = new Set(profile.parity.slice(0, 2).map((entry) => entry.value));
  const frameOk = new Set(profile.frameCounts.slice(0, 2).map((entry) => entry.value));
  const tickets = generateProfileTickets({ profile, game: lotofacil, random: seeded(9) });
  for (const ticket of tickets) {
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

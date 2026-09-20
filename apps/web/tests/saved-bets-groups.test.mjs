import assert from "node:assert/strict";
import test from "node:test";

import { groupByContest, portfolioBestHits } from "../src/lib/saved-bets-groups.ts";

const draw = { date: "2026-09-18", numbers: [1, 2, 3], extras: null };
function portfolio(id, slug, target, overrides = {}) {
  return {
    id, name: id, mode: "gerador", slug, gameName: slug, color: "#000", target, createdAt: `2026-09-1${id.length}T10:00:00Z`,
    costCents: 300, tickets: [{ numbers: [1, 2], extras: null }], draws: [], latest: 3783, result: null, ...overrides,
  };
}
const won = (hits, prize) => ({ draws: [draw], result: { totalCents: prize, unavailablePrizeUnits: 0, tickets: [{ position: 1, hits, prizeCents: prize, prizeDraws: prize ? 1 : 0 }] } });

test("agrupa por modalidade e concurso e soma custo, prêmio e jogos", () => {
  const groups = groupByContest([
    portfolio("a", "lotofacil", 3783, won(12, 0)),
    portfolio("bb", "lotofacil", 3783, won(14, 2000)),
    portfolio("ccc", "quina", 7121, won(3, 0)),
  ]);
  assert.equal(groups.length, 2);
  const lotofacil = groups.find((group) => group.slug === "lotofacil");
  assert.equal(lotofacil.portfolios.length, 2);
  assert.equal(lotofacil.ticketCount, 2);
  assert.equal(lotofacil.costCents, 600);
  assert.equal(lotofacil.prizeCents, 2000);
  assert.equal(lotofacil.bestHits, 14);
  assert.equal(lotofacil.drawn, true);
});

test("ordena: aguardando primeiro (mais próximo antes), depois sorteados do mais recente ao mais antigo", () => {
  const groups = groupByContest([
    portfolio("a", "lotofacil", 3780, won(1, 0)),
    portfolio("b", "lotofacil", 3783, won(1, 0)),
    portfolio("c", "lotofacil", 3786),
    portfolio("d", "lotofacil", 3784),
  ]);
  assert.deepEqual(groups.map((group) => group.target), [3784, 3786, 3783, 3780]);
  assert.deepEqual(groups.map((group) => group.drawn), [false, false, true, true]);
});

test("melhor acerto é zero quando a carteira ainda não foi conferida", () => {
  assert.equal(portfolioBestHits(portfolio("a", "quina", 1)), 0);
});

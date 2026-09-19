// Comparador de estratégias: joga cada estratégia em concursos passados sem
// olhar o futuro. Para cada concurso, os jogos são gerados só com o histórico
// anterior a ele e conferidos com o resultado e os prêmios reais daquele dia.

import { cyclicWheel } from "./cyclic-wheel.ts";
import { diaDeSorteWheel } from "./dia-de-sorte-wheel.ts";
import { backtestTickets, type BacktestDraw, type BacktestTicket } from "./historical-backtest.ts";
import { lotofacilWheel, lotofacilWheel20 } from "./lotofacil-wheel.ts";
import { generateLotteryTickets, lotteryGames, standardTicketCost, standardTicketPriceCents, type DrawNumbers, type GeneratorMode, type LotterySlug } from "./lottery-generator.ts";
import { generateMilionariaTickets } from "./milionaria-generator.ts";
import { lotomaniaWheel70 } from "./partition-wheels.ts";
import { generateSuperSeteTickets, superSeteCombinations } from "./super-sete.ts";

export type LabStrategy = {
  id: string;
  label: string;
  kind: "gerador" | "reducao";
  detail: string;
  build: (history: readonly DrawNumbers[], random: () => number) => BacktestTicket[];
};

export type LabResult = {
  id: string;
  label: string;
  kind: LabStrategy["kind"];
  detail: string;
  games: number;
  costCents: number;
  prizeCents: number;
  unavailablePrizeUnits: number;
  contestsWithPrize: number;
  bestHits: number;
};

export type LabReport = { slug: LotterySlug; contests: number; firstContest: number; lastContest: number; seed: number; results: LabResult[] };

// Gerador determinístico (mulberry32): a mesma semente repete a rodada.
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPool(size: number, total: number, start: number, random: () => number) {
  const numbers = Array.from({ length: total }, (_, index) => index + start);
  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [numbers[index], numbers[swap]] = [numbers[swap], numbers[index]];
  }
  return numbers.slice(0, size).sort((a, b) => a - b);
}

const modeLabels: Partial<Record<GeneratorMode, string>> = {
  pure: "Sorteio puro", balanced: "Perfil comum", hot: "Mais frequentes", delayed: "Mais atrasadas", mixed: "Misto histórico",
};

function generatorStrategies(slug: LotterySlug, quantity: number): LabStrategy[] {
  const game = lotteryGames[slug];
  const modes: GeneratorMode[] = slug === "mais-milionaria" || slug === "super-sete" ? ["pure", "hot", "delayed", "mixed"] : ["pure", "balanced", "hot", "delayed", "mixed"];
  return modes.map((mode) => ({
    id: `gerador:${mode}`,
    label: modeLabels[mode] ?? mode,
    kind: "gerador" as const,
    detail: `${quantity} ${quantity === 1 ? "jogo" : "jogos"} por concurso`,
    build: (history, random) => {
      if (slug === "mais-milionaria") {
        return generateMilionariaTickets({ quantity, size: 6, general: new Set(), personal: Array.from({ length: quantity }, () => new Set<string>()), history, mode, random });
      }
      if (slug === "super-sete") {
        return generateSuperSeteTickets({ quantity, total: 7, mode, history, rules: { fixed: Array.from({ length: 7 }, () => []), avoided: Array.from({ length: 7 }, () => []) }, random })
          .map((ticket) => ({ numbers: [], columns: ticket.columns }));
      }
      return generateLotteryTickets({ slug, quantity, size: game.min, mode, history, random });
    },
  }));
}

// Reduções com grupo de dezenas sorteado a cada concurso.
function reductionStrategies(slug: LotterySlug): LabStrategy[] {
  const game = lotteryGames[slug];
  const pool = (size: number, random: () => number) => randomPool(size, game.total, game.start, random);
  const cyclic = (id: string, label: string, size: number, groups: number[]): LabStrategy => ({
    id: `reducao:${id}`, label, kind: "reducao", detail: `${size} dezenas sorteadas por concurso`,
    build: (_history, random) => cyclicWheel(pool(size, random), groups),
  });
  switch (slug) {
    case "lotofacil":
      return [
        { id: "reducao:20x12", label: "Redução 20 dezenas · 4 jogos", kind: "reducao", detail: "garante 12 se as 15 caírem no grupo", build: (_h, random) => lotofacilWheel20(pool(20, random)) },
        { id: "reducao:18x13", label: "Redução 18 dezenas · 6 jogos", kind: "reducao", detail: "garante 13 se as 15 caírem no grupo", build: (_h, random) => lotofacilWheel(pool(18, random)) },
      ];
    case "mega-sena":
    case "dupla-sena":
      return [cyclic("quina8", "Redução 8 dezenas · 4 jogos", 8, [4, 4]), cyclic("quadra9", "Redução 9 dezenas · 3 jogos", 9, [3, 3, 3])];
    case "quina":
      return [cyclic("quadra7", "Redução 7 dezenas · 4 jogos", 7, [4, 3]), cyclic("terno8", "Redução 8 dezenas · 3 jogos", 8, [3, 3, 2])];
    case "timemania":
      return [cyclic("quatro20", "Redução 20 dezenas · 2 jogos", 20, Array(10).fill(2))];
    case "dia-de-sorte":
      return [{ id: "reducao:any4-10", label: "Redução 10 dezenas · 12 jogos", kind: "reducao", detail: "garante 4 se 4 caírem no grupo", build: (_h, random) => diaDeSorteWheel(pool(10, random), 4) }];
    case "lotomania":
      return [{ id: "reducao:70", label: "Redução 70 dezenas · 21 jogos", kind: "reducao", detail: "garante 15 se as 20 caírem no grupo", build: (_h, random) => lotomaniaWheel70(pool(70, random)) }];
    case "mais-milionaria":
      return [{
        id: "reducao:quina8", label: "Redução 8 dezenas · 4 jogos", kind: "reducao", detail: "8 dezenas e 2 trevos sorteados por concurso",
        build: (_h, random) => {
          const trevos = randomPool(2, 6, 1, random);
          return cyclicWheel(pool(8, random), [4, 4]).map((ticket) => ({ numbers: ticket.numbers, trevos }));
        },
      }];
    default:
      return [];
  }
}

export function labStrategies(slug: LotterySlug, ticketsPerContest: number) {
  return [...generatorStrategies(slug, ticketsPerContest), ...reductionStrategies(slug)];
}

export function ticketCostCents(slug: LotterySlug, ticket: BacktestTicket) {
  if (slug === "super-sete") return ticket.columns ? superSeteCombinations({ columns: ticket.columns }) * standardTicketPriceCents["super-sete"] : 0;
  return standardTicketCost(slug, ticket.numbers.length, 1);
}

// `draws` do mais novo para o mais antigo; na Dupla Sena há dois sorteios por
// concurso (ambos com o mesmo número).
export function runStrategyLab({ slug, draws, contests, ticketsPerContest, seed, strategies = labStrategies(slug, ticketsPerContest) }: {
  slug: LotterySlug; draws: readonly BacktestDraw[]; contests: number; ticketsPerContest: number; seed: number; strategies?: LabStrategy[];
}): LabReport {
  const contestNumbers = [...new Set(draws.map((draw) => draw.contest))].sort((a, b) => a - b);
  const evaluated = contestNumbers.slice(-contests);
  const byContest = new Map<number, BacktestDraw[]>();
  for (const draw of draws) byContest.set(draw.contest, [...(byContest.get(draw.contest) ?? []), draw]);
  const history: DrawNumbers[] = draws.map((draw) => ({ contest: draw.contest, numbers: draw.numbers }));

  const results = strategies.map((strategy, strategyIndex): LabResult => {
    const result: LabResult = { id: strategy.id, label: strategy.label, kind: strategy.kind, detail: strategy.detail, games: 0, costCents: 0, prizeCents: 0, unavailablePrizeUnits: 0, contestsWithPrize: 0, bestHits: 0 };
    evaluated.forEach((contest, contestIndex) => {
      const random = seededRandom(seed + strategyIndex * 1_000_003 + contestIndex * 7_919);
      // Só o que já tinha saído antes deste concurso.
      const before = history.filter((draw) => draw.contest < contest);
      const tickets = strategy.build(before, random);
      const report = backtestTickets(slug, tickets, byContest.get(contest) ?? []);
      result.games += tickets.length;
      result.costCents += tickets.reduce((sum, ticket) => sum + ticketCostCents(slug, ticket), 0);
      result.prizeCents += report.knownGrossCents;
      result.unavailablePrizeUnits += report.unavailablePrizeUnits;
      if (report.contestsWithPrize > 0) result.contestsWithPrize += 1;
      result.bestHits = Math.max(result.bestHits, ...report.tickets.map((ticket) => ticket.bestHits));
    });
    return result;
  });

  return { slug, contests: evaluated.length, firstContest: evaluated[0] ?? 0, lastContest: evaluated[evaluated.length - 1] ?? 0, seed, results };
}

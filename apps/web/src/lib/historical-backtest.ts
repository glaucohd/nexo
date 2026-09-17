import { lotteryGames, type LotterySlug } from "./lottery-generator.ts";

export type BacktestTicket = { numbers: number[]; month?: number; trevos?: number[] };
export type BacktestPrize = { label: string; hits: number; extraHits: number | null; winners: number; prize: number | null };
export type BacktestDraw = { contest: number; date: string; numbers: number[]; extras: Record<string, unknown> | null; prizes: BacktestPrize[] };
export type BacktestTicketResult = {
  position: number;
  bestHits: number;
  averageHits: number;
  distribution: { hits: number; contests: number }[];
  prizeDraws: number;
  knownGrossCents: number;
  unavailablePrizeUnits: number;
  bestContests: { contest: number; date: string; hits: number; knownGrossCents: number; unavailablePrizeUnits: number }[];
};
export type BacktestReport = {
  slug: LotterySlug;
  contests: number;
  skippedContests: number;
  firstContest: number | null;
  lastContest: number | null;
  ticketCount: number;
  ticketDrawComparisons: number;
  prizeDraws: number;
  contestsWithPrize: number;
  knownGrossCents: number;
  unavailablePrizeUnits: number;
  distribution: { hits: number; contests: number }[];
  tickets: BacktestTicketResult[];
};

const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function combinations(total: number, picked: number) {
  if (!Number.isInteger(total) || !Number.isInteger(picked) || picked < 0 || picked > total) return 0;
  let result = 1;
  for (let index = 1; index <= picked; index += 1) result = result * (total - picked + index) / index;
  return Math.round(result);
}

function drawnMonth(extras: Record<string, unknown> | null) {
  if (typeof extras?.mes === "number") return extras.mes;
  if (typeof extras?.mesSorte === "string") return monthNames.indexOf(extras.mesSorte.trim().toLocaleLowerCase("pt-BR")) + 1;
  return null;
}

function drawnTrevos(extras: Record<string, unknown> | null) {
  return Array.isArray(extras?.trevos) && extras.trevos.length === 2 && extras.trevos.every((value) => Number.isInteger(value))
    ? extras.trevos as number[] : null;
}

function isVerifiable(slug: LotterySlug, draw: BacktestDraw) {
  return slug === "dia-de-sorte" ? (drawnMonth(draw.extras) ?? 0) > 0
    : slug === "mais-milionaria" ? drawnTrevos(draw.extras) !== null
      : true;
}

function prizeApplies(slug: LotterySlug, prize: BacktestPrize, trevoHits: number) {
  if (slug !== "mais-milionaria") return true;
  if (prize.extraHits === 2) return trevoHits === 2;
  if (prize.extraHits === 1) return trevoHits === 1;
  return prize.hits >= 4 && trevoHits < 2 && prize.label.toLocaleLowerCase("pt-BR").includes("nenhum trevo");
}

function awardForDraw(slug: LotterySlug, ticket: BacktestTicket, draw: BacktestDraw, hits: number) {
  const baseSize = slug === "lotomania" ? 50 : lotteryGames[slug].drawSize;
  const trevos = drawnTrevos(draw.extras);
  const trevoHits = slug === "mais-milionaria" ? (ticket.trevos ?? []).filter((number) => trevos?.includes(number)).length : 0;
  let knownGrossCents = 0;
  let unavailablePrizeUnits = 0;
  let prizeUnits = 0;
  for (const prize of draw.prizes) {
    const monthTier = slug === "dia-de-sorte" && prize.label.toLocaleLowerCase("pt-BR").includes("mês da sorte");
    const units = monthTier
      ? (ticket.month === drawnMonth(draw.extras) ? combinations(ticket.numbers.length, baseSize) : 0)
      : prizeApplies(slug, prize, trevoHits)
        ? combinations(hits, prize.hits) * combinations(ticket.numbers.length - hits, baseSize - prize.hits)
        : 0;
    if (!units) continue;
    prizeUnits += units;
    if (prize.prize === null || !Number.isFinite(prize.prize) || prize.prize === 0 && prize.winners === 0) unavailablePrizeUnits += units;
    else knownGrossCents += Math.round(prize.prize * 100) * units;
  }
  return { prizeUnits, knownGrossCents, unavailablePrizeUnits };
}

export function backtestTickets(slug: LotterySlug, tickets: readonly BacktestTicket[], draws: readonly BacktestDraw[]): BacktestReport {
  const sample = draws.filter((draw) => isVerifiable(slug, draw));
  const skippedContests = draws.length - sample.length;
  const distribution = new Map<number, number>();
  const contestsWithPrize = new Set<number>();
  let prizeDraws = 0;
  let knownGrossCents = 0;
  let unavailablePrizeUnits = 0;

  const results = tickets.map((ticket, index): BacktestTicketResult => {
    const selected = new Set(ticket.numbers);
    const ticketDistribution = new Map<number, number>();
    const bestContests: BacktestTicketResult["bestContests"] = [];
    let hitSum = 0;
    let bestHits = 0;
    let ticketPrizeDraws = 0;
    let ticketGross = 0;
    let ticketUnavailable = 0;
    for (const draw of sample) {
      const hits = draw.numbers.filter((number) => selected.has(number)).length;
      hitSum += hits;
      bestHits = Math.max(bestHits, hits);
      ticketDistribution.set(hits, (ticketDistribution.get(hits) ?? 0) + 1);
      distribution.set(hits, (distribution.get(hits) ?? 0) + 1);
      const award = awardForDraw(slug, ticket, draw, hits);
      if (award.prizeUnits) { ticketPrizeDraws += 1; prizeDraws += 1; contestsWithPrize.add(draw.contest); }
      ticketGross += award.knownGrossCents;
      ticketUnavailable += award.unavailablePrizeUnits;
      bestContests.push({ contest: draw.contest, date: draw.date, hits, knownGrossCents: award.knownGrossCents, unavailablePrizeUnits: award.unavailablePrizeUnits });
    }
    knownGrossCents += ticketGross;
    unavailablePrizeUnits += ticketUnavailable;
    bestContests.sort((a, b) => b.hits - a.hits || b.knownGrossCents - a.knownGrossCents || b.contest - a.contest);
    return {
      position: index + 1,
      bestHits,
      averageHits: sample.length ? hitSum / sample.length : 0,
      distribution: [...ticketDistribution].sort((a, b) => b[0] - a[0]).map(([hits, contests]) => ({ hits, contests })),
      prizeDraws: ticketPrizeDraws,
      knownGrossCents: ticketGross,
      unavailablePrizeUnits: ticketUnavailable,
      bestContests: bestContests.slice(0, 3),
    };
  });

  return {
    slug, contests: sample.length, skippedContests,
    firstContest: sample.at(-1)?.contest ?? null,
    lastContest: sample[0]?.contest ?? null,
    ticketCount: tickets.length,
    ticketDrawComparisons: tickets.length * sample.length,
    prizeDraws, contestsWithPrize: contestsWithPrize.size,
    knownGrossCents, unavailablePrizeUnits,
    distribution: [...distribution].sort((a, b) => b[0] - a[0]).map(([hits, contests]) => ({ hits, contests })),
    tickets: results,
  };
}

import { standardTicketCost, standardTicketPriceCents, type LotterySlug } from "./lottery-generator.ts";
import { superSeteCombinations } from "./super-sete.ts";

export type SavedTicket = { numbers: number[]; extras: Record<string, unknown> | null };

/** Conferência de uma carteira contra o concurso para o qual foi salva. */
export type PortfolioResult = {
  totalCents: number;
  unavailablePrizeUnits: number;
  tickets: { position: number; hits: number; prizeCents: number; prizeDraws: number }[];
};

export type ContestDraw = { date: string; numbers: number[]; extras: Record<string, unknown> | null };

export type SavedPortfolio = {
  id: string;
  name: string;
  mode: string;
  slug: LotterySlug;
  gameName: string;
  color: string;
  target: number;
  createdAt: string;
  costCents: number;
  tickets: SavedTicket[];
  /** Sorteio(s) do concurso-alvo já na base; vazio enquanto não saiu. */
  draws: ContestDraw[];
  /** Último concurso da modalidade na base (para avisar "ainda não saiu"). */
  latest: number;
  result: PortfolioResult | null;
};

export type ContestGroup = {
  key: string;
  slug: LotterySlug;
  gameName: string;
  color: string;
  target: number;
  drawn: boolean;
  latest: number;
  draws: ContestDraw[];
  portfolios: SavedPortfolio[];
  ticketCount: number;
  costCents: number;
  prizeCents: number;
  /** Algum jogo do concurso ganhou prêmio (mesmo que o valor ainda não esteja na base). */
  prized: boolean;
  bestHits: number;
};

export function ticketCostCents(slug: LotterySlug, ticket: SavedTicket) {
  if (slug === "super-sete") {
    const columns = Array.isArray(ticket.extras?.columns) ? ticket.extras.columns as number[][] : [];
    return columns.length === 7 ? superSeteCombinations({ columns }) * standardTicketPriceCents["super-sete"] : 0;
  }
  return standardTicketCost(slug, ticket.numbers.length, 1);
}

export const portfolioCostCents = (slug: LotterySlug, tickets: SavedTicket[]) => tickets.reduce((sum, ticket) => sum + ticketCostCents(slug, ticket), 0);

export const portfolioBestHits = (portfolio: SavedPortfolio) => Math.max(0, ...(portfolio.result?.tickets.map((ticket) => ticket.hits) ?? []));

/**
 * Agrupa as carteiras por concurso (modalidade + concurso-alvo). Sorteados: do mais recente para o mais antigo;
 * aguardando: do mais próximo para o mais distante. Dentro do grupo, a carteira mais nova primeiro.
 */
export function groupByContest(portfolios: SavedPortfolio[]): ContestGroup[] {
  const groups = new Map<string, ContestGroup>();
  for (const portfolio of portfolios) {
    const key = `${portfolio.slug}:${portfolio.target}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key, slug: portfolio.slug, gameName: portfolio.gameName, color: portfolio.color, target: portfolio.target,
        drawn: portfolio.draws.length > 0, latest: portfolio.latest, draws: portfolio.draws,
        portfolios: [], ticketCount: 0, costCents: 0, prizeCents: 0, prized: false, bestHits: 0,
      };
      groups.set(key, group);
    }
    group.portfolios.push(portfolio);
    group.ticketCount += portfolio.tickets.length;
    group.costCents += portfolio.costCents;
    group.prizeCents += portfolio.result?.totalCents ?? 0;
    group.prized ||= (portfolio.result?.totalCents ?? 0) > 0 || (portfolio.result?.unavailablePrizeUnits ?? 0) > 0;
    group.bestHits = Math.max(group.bestHits, portfolioBestHits(portfolio));
  }
  for (const group of groups.values()) group.portfolios.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...groups.values()].sort((a, b) => (a.drawn === b.drawn ? (a.drawn ? b.target - a.target : a.target - b.target) : a.drawn ? 1 : -1));
}

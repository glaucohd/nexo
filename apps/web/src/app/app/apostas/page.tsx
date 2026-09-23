import { asc, desc, eq, inArray, max } from "drizzle-orm";

import { BetsBoard } from "@/components/bets-board";
import { db } from "@/db";
import { draws, lotteries, portfolios, tickets } from "@/db/schema";
import { getAppSession } from "@/lib/app-session";
import { lotteryGames, uiSlugFor, type LotterySlug } from "@/lib/lottery-generator";
import { conferPortfolio, drawsForContest } from "@/lib/saved-bets";
import { portfolioCostCents, type SavedPortfolio } from "@/lib/saved-bets-groups";

export const dynamic = "force-dynamic";

export default async function BetsPage() {
  const authResult = await getAppSession();
  if (authResult.status !== "authenticated") return null;
  const { session } = authResult;

  const rows = await db.select({
    id: portfolios.id, name: portfolios.name, mode: portfolios.mode, target: portfolios.targetContest,
    createdAt: portfolios.createdAt, source: lotteries.slug,
  }).from(portfolios).innerJoin(lotteries, eq(portfolios.lotteryId, lotteries.id))
    .where(eq(portfolios.userId, session.user.id))
    .orderBy(desc(portfolios.createdAt));

  const ticketRows = rows.length
    ? await db.select({ portfolioId: tickets.portfolioId, numbers: tickets.numbers, extras: tickets.extras })
      .from(tickets).where(inArray(tickets.portfolioId, rows.map((row) => row.id))).orderBy(asc(tickets.position))
    : [];

  // Último concurso de cada modalidade na base.
  const latestRows = await db.select({ source: lotteries.slug, latest: max(draws.contestNumber) })
    .from(draws).innerJoin(lotteries, eq(draws.lotteryId, lotteries.id)).groupBy(lotteries.slug);
  const latestBySlug = new Map<string, number>();
  for (const row of latestRows) {
    const slug = uiSlugFor(row.source);
    latestBySlug.set(slug, Math.max(latestBySlug.get(slug) ?? 0, row.latest ?? 0));
  }

  // Sorteio de cada concurso-alvo, buscado uma vez só mesmo com várias carteiras no mesmo concurso.
  const contests = new Map<string, { slug: LotterySlug; target: number }>();
  for (const row of rows) {
    const slug = uiSlugFor(row.source) as LotterySlug;
    const target = row.target ?? 0;
    if (target > 0 && target <= (latestBySlug.get(slug) ?? 0)) contests.set(`${slug}:${target}`, { slug, target });
  }
  const drawsByContest = new Map(await Promise.all([...contests].map(async ([key, { slug, target }]) => [key, await drawsForContest(slug, target)] as const)));

  const saved: SavedPortfolio[] = rows.map((row) => {
    const slug = uiSlugFor(row.source) as LotterySlug;
    const target = row.target ?? 0;
    const portfolioTickets = ticketRows.filter((ticket) => ticket.portfolioId === row.id).map((ticket) => ({ numbers: ticket.numbers, extras: ticket.extras }));
    const contestDraws = drawsByContest.get(`${slug}:${target}`) ?? [];
    return {
      id: row.id,
      name: row.name,
      mode: row.mode,
      slug,
      gameName: lotteryGames[slug].name,
      color: lotteryGames[slug].color,
      target,
      createdAt: row.createdAt.toISOString(),
      costCents: portfolioCostCents(slug, portfolioTickets),
      tickets: portfolioTickets,
      draws: contestDraws.map((draw) => ({ date: draw.date, numbers: draw.numbers, extras: draw.extras })),
      latest: latestBySlug.get(slug) ?? 0,
      result: contestDraws.length ? conferPortfolio(slug, contestDraws, portfolioTickets) : null,
    };
  });

  return <BetsBoard portfolios={saved} />;
}

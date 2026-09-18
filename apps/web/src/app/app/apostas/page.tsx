import { asc, desc, eq, inArray, max } from "drizzle-orm";
import { headers } from "next/headers";

import { BetsBoard, type SavedPortfolio } from "@/components/bets-board";
import { db } from "@/db";
import { draws, lotteries, portfolios, tickets } from "@/db/schema";
import { auth } from "@/lib/auth";
import { lotteryGames, uiSlugFor, type LotterySlug } from "@/lib/lottery-generator";

export const dynamic = "force-dynamic";

export default async function BetsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

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

  // Último concurso de cada modalidade, para saber se o sorteio já aconteceu.
  const latestRows = await db.select({ source: lotteries.slug, latest: max(draws.contestNumber) })
    .from(draws).innerJoin(lotteries, eq(draws.lotteryId, lotteries.id)).groupBy(lotteries.slug);
  const latestBySlug = new Map<string, number>();
  for (const row of latestRows) {
    const slug = uiSlugFor(row.source);
    latestBySlug.set(slug, Math.max(latestBySlug.get(slug) ?? 0, row.latest ?? 0));
  }

  const saved: SavedPortfolio[] = rows.map((row) => {
    const slug = uiSlugFor(row.source) as LotterySlug;
    const target = row.target ?? 0;
    return {
      id: row.id,
      name: row.name,
      mode: row.mode,
      slug,
      gameName: lotteryGames[slug].name,
      color: lotteryGames[slug].color,
      target,
      drawn: target <= (latestBySlug.get(slug) ?? 0),
      createdAt: row.createdAt.toISOString(),
      tickets: ticketRows.filter((ticket) => ticket.portfolioId === row.id).map((ticket) => ({ numbers: ticket.numbers, extras: ticket.extras })),
    };
  });

  return <BetsBoard portfolios={saved} />;
}

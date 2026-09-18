import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { lotteries, portfolios, tickets } from "@/db/schema";
import { auth } from "@/lib/auth";
import { backtestTickets } from "@/lib/historical-backtest";
import { uiSlugFor, type LotterySlug } from "@/lib/lottery-generator";
import { drawsForContest, latestContest, ticketFromRow } from "@/lib/saved-bets";

// Confere a carteira só contra o concurso para o qual ela foi salva — o
// sorteio "da semana", não o histórico.
export async function POST(_request: Request, ctx: RouteContext<"/api/apostas/[id]/conferir">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Aposta não encontrada." }, { status: 404 });

  try {
    const [portfolio] = await db.select({ id: portfolios.id, target: portfolios.targetContest, source: lotteries.slug })
      .from(portfolios).innerJoin(lotteries, eq(portfolios.lotteryId, lotteries.id))
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, session.user.id)));
    if (!portfolio || portfolio.target === null) return Response.json({ error: "Aposta não encontrada." }, { status: 404 });
    const slug = uiSlugFor(portfolio.source) as LotterySlug;

    const contestDraws = await drawsForContest(slug, portfolio.target);
    if (!contestDraws.length) {
      return Response.json({ status: "pending", target: portfolio.target, latest: await latestContest(slug) }, { headers: { "Cache-Control": "no-store" } });
    }

    const rows = await db.select({ numbers: tickets.numbers, extras: tickets.extras }).from(tickets)
      .where(eq(tickets.portfolioId, portfolio.id)).orderBy(asc(tickets.position));
    const report = backtestTickets(slug, rows.map((row) => ticketFromRow(row.numbers, row.extras)), contestDraws);
    return Response.json({
      status: "done",
      target: portfolio.target,
      draws: contestDraws.map((draw) => ({ date: draw.date, numbers: draw.numbers, extras: draw.extras })),
      totalCents: report.knownGrossCents,
      unavailablePrizeUnits: report.unavailablePrizeUnits,
      tickets: [...report.tickets].sort((a, b) => a.position - b.position).map((ticket) => ({ position: ticket.position, hits: ticket.bestHits, prizeCents: ticket.knownGrossCents, prizeDraws: ticket.prizeDraws })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Checking saved bets failed", { type: error instanceof Error ? error.name : typeof error });
    return Response.json({ error: "Não foi possível conferir agora. Tente novamente." }, { status: 503 });
  }
}

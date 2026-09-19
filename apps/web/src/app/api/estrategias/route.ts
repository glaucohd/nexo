import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { draws, lotteries, prizeTiers } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { BacktestDraw } from "@/lib/historical-backtest";
import { drawSourceSlugs } from "@/lib/lottery-generator";
import { runStrategyLab } from "@/lib/strategy-lab";
import { lotterySlugSchema } from "@/lib/ticket-validation";

const bodySchema = z.object({
  slug: lotterySlugSchema,
  contests: z.union([z.literal(50), z.literal(100), z.literal(200)]).default(100),
  tickets: z.number().int().min(1).max(10).default(4),
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
}).strict();

// Joga cada estratégia nos últimos concursos, sem olhar o futuro, e devolve
// quanto teria custado e voltado.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Entre na sua conta para comparar estratégias." }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  const { slug, contests, tickets } = parsed.data;
  const seed = parsed.data.seed ?? Math.floor(Math.random() * 2 ** 31);

  try {
    const sources = drawSourceSlugs(slug);
    const rows = await db.select({ id: draws.id, contest: draws.contestNumber, date: draws.drawnAt, numbers: draws.numbers, extras: draws.extras })
      .from(draws).innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
      .where(and(inArray(lotteries.slug, sources), ne(draws.status, "provisional")))
      .orderBy(desc(draws.contestNumber));
    if (!rows.length) return Response.json({ error: "Ainda não há concursos na base para esta loteria." }, { status: 400 });

    // Prêmios só dos concursos avaliados (os mais recentes).
    const contestNumbers = [...new Set(rows.map((row) => row.contest))];
    const oldestEvaluated = contestNumbers[Math.min(contests, contestNumbers.length) - 1];
    const prizes = await db.select({ drawId: prizeTiers.drawId, label: prizeTiers.label, hits: prizeTiers.hits, extraHits: prizeTiers.extraHits, winners: prizeTiers.winners, prize: prizeTiers.prize })
      .from(prizeTiers).innerJoin(draws, eq(prizeTiers.drawId, draws.id)).innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
      .where(and(inArray(lotteries.slug, sources), gte(draws.contestNumber, oldestEvaluated)));
    const prizesByDraw = new Map<string, BacktestDraw["prizes"]>();
    for (const prize of prizes) {
      const list = prizesByDraw.get(prize.drawId) ?? [];
      list.push({ label: prize.label, hits: prize.hits, extraHits: prize.extraHits, winners: prize.winners, prize: prize.prize === null ? null : Number(prize.prize) });
      prizesByDraw.set(prize.drawId, list);
    }
    const history: BacktestDraw[] = rows.map((row) => ({ contest: row.contest, date: row.date.toISOString().slice(0, 10), numbers: row.numbers, extras: row.extras, prizes: prizesByDraw.get(row.id) ?? [] }));

    return Response.json(runStrategyLab({ slug, draws: history, contests, ticketsPerContest: tickets, seed }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Strategy lab failed", { type: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : "" });
    return Response.json({ error: "Não foi possível comparar agora. Tente novamente." }, { status: 503 });
  }
}

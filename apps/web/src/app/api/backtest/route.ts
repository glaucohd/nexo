import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { draws, lotteries, prizeTiers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { backtestTickets, type BacktestDraw } from "@/lib/historical-backtest";
import { lotteryGames, type LotterySlug } from "@/lib/lottery-generator";

const ticketSchema = z.object({
  numbers: z.array(z.number().int()).min(1).max(50),
  month: z.number().int().min(1).max(12).optional(),
  trevos: z.array(z.number().int().min(1).max(6)).optional(),
}).strict();
const bodySchema = z.object({
  slug: z.enum(Object.keys(lotteryGames) as [LotterySlug, ...LotterySlug[]]),
  sample: z.union([z.literal(200), z.literal("all")]),
  tickets: z.array(ticketSchema).min(1).max(20),
}).strict();

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Entre na sua conta para conferir os jogos." }, { status: 401 });

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Dados da conferência inválidos." }, { status: 400 });
    const { slug, sample, tickets } = parsed.data;
    const game = lotteryGames[slug];
    const valid = tickets.every((ticket) => ticket.numbers.length >= game.min && ticket.numbers.length <= game.max
      && new Set(ticket.numbers).size === ticket.numbers.length
      && ticket.numbers.every((number) => number >= game.start && number < game.start + game.total)
      && (slug !== "dia-de-sorte" || ticket.month !== undefined)
      && (slug !== "mais-milionaria" || ticket.trevos?.length === 2 && new Set(ticket.trevos).size === 2));
    if (!valid) return Response.json({ error: "Há uma cartela inválida para esta modalidade." }, { status: 400 });

    const drawQuery = db.select({
      id: draws.id, contest: draws.contestNumber, date: draws.drawnAt, numbers: draws.numbers, extras: draws.extras,
    }).from(draws).innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
      .where(and(eq(lotteries.slug, slug), ne(draws.status, "provisional")))
      .orderBy(desc(draws.contestNumber));
    const rows = sample === "all" ? await drawQuery : await drawQuery.limit(sample);
    const prizesByDraw = new Map<string, BacktestDraw["prizes"]>();
    for (let start = 0; start < rows.length; start += 500) {
      const ids = rows.slice(start, start + 500).map((row) => row.id);
      const prizes = await db.select({ drawId: prizeTiers.drawId, label: prizeTiers.label, hits: prizeTiers.hits,
        extraHits: prizeTiers.extraHits, winners: prizeTiers.winners, prize: prizeTiers.prize })
        .from(prizeTiers).where(inArray(prizeTiers.drawId, ids));
      for (const prize of prizes) {
        const tiers = prizesByDraw.get(prize.drawId) ?? [];
        tiers.push({ label: prize.label, hits: prize.hits, extraHits: prize.extraHits, winners: prize.winners,
          prize: prize.prize === null ? null : Number(prize.prize) });
        prizesByDraw.set(prize.drawId, tiers);
      }
    }
    const history: BacktestDraw[] = rows.map((row) => ({
      contest: row.contest, date: row.date.toISOString().slice(0, 10), numbers: row.numbers,
      extras: row.extras, prizes: prizesByDraw.get(row.id) ?? [],
    }));
    return Response.json(backtestTickets(slug, tickets, history), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Não foi possível consultar o histórico agora. Tente novamente." }, { status: 503 });
  }
}

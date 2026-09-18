import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { draws, lotteries, prizeTiers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { backtestTickets, type BacktestDraw } from "@/lib/historical-backtest";
import { drawSourceSlugs, lotteryGames, type LotterySlug } from "@/lib/lottery-generator";
import { validSuperSeteTicket } from "@/lib/super-sete";

const ticketSchema = z.object({
  numbers: z.array(z.number().int()).max(50),
  columns: z.array(z.array(z.number().int().min(0).max(9)).max(3)).length(7).optional(),
  month: z.number().int().min(1).max(12).optional(),
  trevos: z.array(z.number().int().min(1).max(6)).optional(),
}).strict();
const bodySchema = z.object({
  slug: z.enum(Object.keys(lotteryGames) as [LotterySlug, ...LotterySlug[]]),
  sample: z.union([z.literal(200), z.literal("all")]).default("all"),
  tickets: z.array(ticketSchema).min(1).max(120),
}).strict();

export async function POST(request: Request) {
  let stage = "session";
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Entre na sua conta para conferir os jogos." }, { status: 401 });

    stage = "validation";
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Dados da conferência inválidos." }, { status: 400 });
    const { slug, sample, tickets } = parsed.data;
    const game = lotteryGames[slug];
    const valid = tickets.every((ticket) => slug === "super-sete" ? ticket.numbers.length === 0 && !!ticket.columns && validSuperSeteTicket({ columns: ticket.columns }) : ticket.columns === undefined && ticket.numbers.length >= game.min && ticket.numbers.length <= game.max
      && new Set(ticket.numbers).size === ticket.numbers.length
      && ticket.numbers.every((number) => number >= game.start && number < game.start + game.total)
      && (slug !== "mais-milionaria" || ticket.trevos?.length === 2 && new Set(ticket.trevos).size === 2));
    if (!valid) return Response.json({ error: "Há uma cartela inválida para esta modalidade." }, { status: 400 });

    stage = "draws";
    // Na Dupla Sena a mesma aposta concorre nos dois sorteios do concurso, então
    // a conferência roda contra as duas modalidades gravadas no banco.
    const sourceSlugs = drawSourceSlugs(slug);
    const drawQuery = db.select({
      id: draws.id, contest: draws.contestNumber, date: draws.drawnAt, numbers: draws.numbers, extras: draws.extras,
    }).from(draws).innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
      .where(and(inArray(lotteries.slug, sourceSlugs), ne(draws.status, "provisional")))
      .orderBy(desc(draws.contestNumber));
    const rows = sample === "all" ? await drawQuery : await drawQuery.limit(sample);
    const prizesByDraw = new Map<string, BacktestDraw["prizes"]>();
    if (rows.length > 0) {
      stage = "prizes";
      const oldestContest = rows[rows.length - 1].contest;
      const prizes = await db.select({ drawId: prizeTiers.drawId, label: prizeTiers.label, hits: prizeTiers.hits,
        extraHits: prizeTiers.extraHits, winners: prizeTiers.winners, prize: prizeTiers.prize })
        .from(prizeTiers)
        .innerJoin(draws, eq(prizeTiers.drawId, draws.id))
        .innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
        .where(and(inArray(lotteries.slug, sourceSlugs), ne(draws.status, "provisional"), gte(draws.contestNumber, oldestContest)));
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
    stage = "calculation";
    return Response.json(backtestTickets(slug, tickets, history), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const cause = error instanceof Error && "cause" in error ? error.cause : error;
    const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "unknown";
    console.error("Historical backtest failed", { stage, type: error instanceof Error ? error.name : typeof error, code });
    return Response.json({ error: "Não foi possível consultar o histórico agora. Tente novamente." }, { status: 503 });
  }
}

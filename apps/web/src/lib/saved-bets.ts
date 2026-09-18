import { and, eq, inArray, max, ne } from "drizzle-orm";

import { db } from "@/db";
import { draws, lotteries, prizeTiers } from "@/db/schema";
import type { BacktestDraw, BacktestTicket } from "@/lib/historical-backtest";
import { drawSourceSlugs, type LotterySlug } from "@/lib/lottery-generator";

// Último concurso já registrado da modalidade (na Dupla Sena, o maior entre os
// dois sorteios). A aposta salva agora concorre no concurso seguinte.
export async function latestContest(slug: LotterySlug) {
  const [row] = await db.select({ latest: max(draws.contestNumber) }).from(draws)
    .innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
    .where(inArray(lotteries.slug, drawSourceSlugs(slug)));
  return row?.latest ?? 0;
}

// Sorteio(s) de um concurso específico, no formato da conferência. Na Dupla
// Sena volta um sorteio por modalidade de origem (1º e 2º sorteio).
export async function drawsForContest(slug: LotterySlug, contest: number): Promise<BacktestDraw[]> {
  const rows = await db.select({ id: draws.id, contest: draws.contestNumber, date: draws.drawnAt, numbers: draws.numbers, extras: draws.extras, source: lotteries.slug })
    .from(draws).innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
    .where(and(inArray(lotteries.slug, drawSourceSlugs(slug)), eq(draws.contestNumber, contest), ne(draws.status, "provisional")))
    .orderBy(lotteries.slug);
  if (!rows.length) return [];
  const prizes = await db.select({ drawId: prizeTiers.drawId, label: prizeTiers.label, hits: prizeTiers.hits, extraHits: prizeTiers.extraHits, winners: prizeTiers.winners, prize: prizeTiers.prize })
    .from(prizeTiers).where(inArray(prizeTiers.drawId, rows.map((row) => row.id)));
  return rows.map((row) => ({
    contest: row.contest,
    date: row.date.toISOString().slice(0, 10),
    numbers: row.numbers,
    extras: row.extras,
    prizes: prizes.filter((prize) => prize.drawId === row.id).map((prize) => ({ label: prize.label, hits: prize.hits, extraHits: prize.extraHits, winners: prize.winners, prize: prize.prize === null ? null : Number(prize.prize) })),
  }));
}

// Os extras (mês, trevos, colunas) vão para a coluna jsonb `extras`.
export function ticketExtras(ticket: BacktestTicket) {
  const extras: Record<string, unknown> = {};
  if (ticket.month !== undefined) extras.month = ticket.month;
  if (ticket.trevos !== undefined) extras.trevos = ticket.trevos;
  if (ticket.columns !== undefined) extras.columns = ticket.columns;
  return Object.keys(extras).length ? extras : null;
}

export function ticketFromRow(numbers: number[], extras: Record<string, unknown> | null): BacktestTicket {
  const ticket: BacktestTicket = { numbers };
  if (typeof extras?.month === "number") ticket.month = extras.month;
  if (Array.isArray(extras?.trevos)) ticket.trevos = extras.trevos as number[];
  if (Array.isArray(extras?.columns)) ticket.columns = extras.columns as number[][];
  return ticket;
}

import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { ResultsExplorer, type LotteryHistory } from "@/components/results-explorer";
import { db } from "@/db";
import { draws, lotteries } from "@/db/schema";
import { LOTTERY_COOKIE, pickLottery } from "@/lib/selected-lottery";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ modalidade?: string }> }) {
  const { modalidade } = await searchParams;
  const rows = await db
    .select({
      slug: lotteries.slug,
      contest: draws.contestNumber,
      date: draws.drawnAt,
      numbers: draws.numbers,
      extras: draws.extras,
      status: draws.status,
      source: draws.source,
    })
    .from(draws)
    .innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
    .orderBy(lotteries.slug, desc(draws.contestNumber));

  const histories: Record<string, LotteryHistory[]> = {};
  for (const row of rows) {
    (histories[row.slug] ??= []).push({
      contest: row.contest,
      date: row.date.toISOString().slice(0, 10),
      numbers: row.numbers,
      extras: row.extras,
      status: row.status,
      source: row.source,
    });
  }

  return <ResultsExplorer histories={histories} initialSlug={pickLottery(modalidade, (await cookies()).get(LOTTERY_COOKIE)?.value)} />;
}

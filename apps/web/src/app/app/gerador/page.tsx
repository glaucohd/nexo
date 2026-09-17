import { desc, eq } from "drizzle-orm";

import { LotteryGenerator } from "@/components/lottery-generator";
import { db } from "@/db";
import { draws, lotteries } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function GeneratorPage({ searchParams }: { searchParams: Promise<{ modalidade?: string }> }) {
  const { modalidade } = await searchParams;
  const rows = await db
    .select({ slug: lotteries.slug, contest: draws.contestNumber, numbers: draws.numbers })
    .from(draws)
    .innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
    .orderBy(lotteries.slug, desc(draws.contestNumber));

  const histories: Record<string, { contest: number; numbers: number[] }[]> = {};
  for (const row of rows) (histories[row.slug] ??= []).push({ contest: row.contest, numbers: row.numbers });

  return <LotteryGenerator histories={histories} initialSlug={modalidade} />;
}

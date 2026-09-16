import { desc, eq } from "drizzle-orm";

import { AnalysisExplorer } from "@/components/analysis-explorer";
import { db } from "@/db";
import { draws, lotteries } from "@/db/schema";
import type { AnalysisDraw } from "@/lib/lottery-analysis";

export const dynamic = "force-dynamic";

export default async function AnalysesPage({ searchParams }: { searchParams: Promise<{ modalidade?: string }> }) {
  const { modalidade } = await searchParams;
  const rows = await db
    .select({ slug: lotteries.slug, contest: draws.contestNumber, date: draws.drawnAt, numbers: draws.numbers })
    .from(draws)
    .innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
    .orderBy(lotteries.slug, desc(draws.contestNumber));

  const histories: Record<string, AnalysisDraw[]> = {};
  for (const row of rows) {
    (histories[row.slug] ??= []).push({
      contest: row.contest,
      date: row.date.toISOString().slice(0, 10),
      numbers: row.numbers,
    });
  }

  return <AnalysisExplorer histories={histories} initialSlug={modalidade} />;
}

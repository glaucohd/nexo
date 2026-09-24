import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { LotteryGenerator } from "@/components/lottery-generator";
import { db } from "@/db";
import { draws, lotteries } from "@/db/schema";
import { uiSlugFor } from "@/lib/lottery-generator";
import { LOTTERY_COOKIE, pickLottery } from "@/lib/selected-lottery";

export const dynamic = "force-dynamic";

export default async function GeneratorPage({ searchParams }: { searchParams: Promise<{ modalidade?: string }> }) {
  const { modalidade } = await searchParams;
  let historyUnavailable = false;
  let rows: { slug: string; contest: number; numbers: number[] }[] = [];
  try {
    rows = await db
      .select({ slug: lotteries.slug, contest: draws.contestNumber, numbers: draws.numbers })
      .from(draws)
      .innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
      .orderBy(lotteries.slug, desc(draws.contestNumber));
  } catch {
    historyUnavailable = true;
    console.warn("Histórico do gerador indisponível; abrindo em modo local sem base.");
  }

  // Os dois sorteios da Dupla Sena alimentam o mesmo histórico: a aposta é uma só.
  const histories: Record<string, { contest: number; numbers: number[] }[]> = {};
  for (const row of rows) (histories[uiSlugFor(row.slug)] ??= []).push({ contest: row.contest, numbers: row.numbers });

  return <>
    {historyUnavailable && <p className="offline-notice" role="status"><strong>Modo local sem banco:</strong> o gerador está disponível, mas sugestões históricas e salvamento voltam quando a conexão com o Supabase for restabelecida.</p>}
    <LotteryGenerator histories={histories} initialSlug={pickLottery(modalidade, (await cookies()).get(LOTTERY_COOKIE)?.value)} />
  </>;
}

import { desc, eq } from "drizzle-orm";

import { MilionariaGenerator } from "@/components/milionaria-generator";
import { db } from "@/db";
import { draws, lotteries } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function GeneratorPage() {
  const history = await db
    .select({ contest: draws.contestNumber, numbers: draws.numbers })
    .from(draws)
    .innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
    .where(eq(lotteries.slug, "mais-milionaria"))
    .orderBy(desc(draws.contestNumber));

  return <MilionariaGenerator history={history} />;
}

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { lotteries, portfolios, tickets as ticketRows } from "@/db/schema";
import { auth } from "@/lib/auth";
import { drawSourceSlugs } from "@/lib/lottery-generator";
import { latestContest, ticketExtras } from "@/lib/saved-bets";
import { lotterySlugSchema, ticketSchema, ticketsFitLottery } from "@/lib/ticket-validation";

const bodySchema = z.object({
  slug: lotterySlugSchema,
  name: z.string().trim().min(1).max(120),
  // Estratégia usada para gerar os jogos, em texto legível.
  mode: z.string().trim().min(1).max(160).default("Gerador"),
  tickets: z.array(ticketSchema).min(1).max(120),
}).strict();

// Salva uma carteira de jogos para o próximo concurso da modalidade.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Entre na sua conta para salvar jogos." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados da aposta inválidos." }, { status: 400 });
  const { slug, name, mode, tickets } = parsed.data;
  if (!ticketsFitLottery(slug, tickets)) return Response.json({ error: "Há uma cartela inválida para esta modalidade." }, { status: 400 });

  try {
    // Na Dupla Sena a carteira fica associada ao 1º sorteio; a conferência
    // olha os dois sorteios do concurso.
    const [lottery] = await db.select({ id: lotteries.id }).from(lotteries).where(eq(lotteries.slug, drawSourceSlugs(slug)[0]));
    if (!lottery) return Response.json({ error: "Modalidade não cadastrada na base." }, { status: 400 });
    const targetContest = (await latestContest(slug)) + 1;
    const id = await db.transaction(async (tx) => {
      const [portfolio] = await tx.insert(portfolios).values({ userId: session.user.id, lotteryId: lottery.id, name, mode, targetContest }).returning({ id: portfolios.id });
      await tx.insert(ticketRows).values(tickets.map((ticket, index) => ({ portfolioId: portfolio.id, position: index + 1, numbers: ticket.numbers, extras: ticketExtras(ticket) })));
      return portfolio.id;
    });
    return Response.json({ id, targetContest }, { status: 201 });
  } catch (error) {
    console.error("Saving bets failed", { type: error instanceof Error ? error.name : typeof error });
    return Response.json({ error: "Não foi possível salvar agora. Tente novamente." }, { status: 503 });
  }
}

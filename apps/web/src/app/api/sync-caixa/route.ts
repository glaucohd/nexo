import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { syncCaixa } from "@/lib/sync-caixa";
import { lotterySlugSchema } from "@/lib/ticket-validation";

// `slugs` opcional: a tela de apostas pede só as modalidades com jogo pendente.
const bodySchema = z.object({ slugs: z.array(lotterySlugSchema).max(9).optional() }).strict();

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Entre na sua conta para atualizar a base." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Pedido de atualização inválido." }, { status: 400 });

  try {
    const result = await syncCaixa({ slugs: parsed.data.slugs });
    return Response.json(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha desconhecida.";
    console.error("Atualização da base falhou:", message);
    return Response.json({ error: "Não foi possível atualizar a base agora. Tente novamente em instantes." }, { status: 503 });
  }
}

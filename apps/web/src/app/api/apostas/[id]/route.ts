import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { portfolios } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/apostas/[id]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Aposta não encontrada." }, { status: 404 });
  const deleted = await db.delete(portfolios).where(and(eq(portfolios.id, id), eq(portfolios.userId, session.user.id))).returning({ id: portfolios.id });
  if (!deleted.length) return Response.json({ error: "Aposta não encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}

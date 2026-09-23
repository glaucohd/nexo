import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export type AppSessionResult =
  | { status: "authenticated"; session: NonNullable<Session> }
  | { status: "anonymous" }
  | { status: "unavailable"; code: string };

function errorCode(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth += 1) {
    const record = current as { code?: unknown; cause?: unknown; body?: { code?: unknown } };
    if (typeof record.code === "string") return record.code;
    if (typeof record.body?.code === "string") return record.body.code;
    current = record.cause;
  }
  return "SESSION_LOOKUP_FAILED";
}

// Layout e páginas podem precisar da sessão no mesmo render. O cache do React
// compartilha uma única consulta por requisição, e o retry absorve falhas curtas
// de DNS/conexão do pool sem transformar a navegação em erro não tratado.
export const getAppSession = cache(async (): Promise<AppSessionResult> => {
  const requestHeaders = await headers();
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const session = await auth.api.getSession({ headers: requestHeaders });
      return session ? { status: "authenticated", session } : { status: "anonymous" };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  const code = errorCode(lastError);
  console.warn("Consulta de sessão indisponível após novas tentativas:", code);
  return { status: "unavailable", code };
});

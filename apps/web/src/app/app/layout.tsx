import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { SyncCaixaButton } from "@/components/sync-caixa-button";
import { auth } from "@/lib/auth";

import styles from "./layout.module.css";

export const dynamic = "force-dynamic";

function errorCode(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === "string") return record.code;
    current = record.cause;
  }
  return "SESSION_LOOKUP_FAILED";
}

const retryableCodes = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "57P01", "53300"]);

function SessionUnavailable() {
  return <main className={styles.unavailable}>
    <div className={styles.card}>
      <Brand />
      <span className="eyebrow">Conexão com a base</span>
      <h1>Não conseguimos abrir sua sessão agora.</h1>
      <p>Seu login não foi apagado. A conexão com a base de dados falhou nesta tentativa; tente carregar a página novamente.</p>
      <a className="button button-primary" href="/app">Tentar novamente</a>
    </div>
  </main>;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  let session;
  try {
    session = await auth.api.getSession({ headers: requestHeaders });
  } catch (firstError) {
    try {
      if (!retryableCodes.has(errorCode(firstError))) throw firstError;
      await new Promise((resolve) => setTimeout(resolve, 300));
      session = await auth.api.getSession({ headers: requestHeaders });
    } catch (finalError) {
      // Do not log the Drizzle error: its message includes the session token.
      console.error("Não foi possível consultar a sessão no banco:", errorCode(finalError));
      return <SessionUnavailable />;
    }
  }

  if (!session) redirect("/entrar");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">Meu Nexo</p>
        <AppNav />
        <div className="sidebar-games" aria-label="Modalidades disponíveis">
          <span className="game-dot lotofacil" title="Lotofácil" />
          <span className="game-dot mega" title="Mega-Sena" />
          <span className="game-dot quina" title="Quina" />
          <span className="game-dot milionaria" title="+Milionária" />
          <span className="game-dot dia" title="Dia de Sorte" />
          <span className="game-dot lotomania" title="Lotomania" />
          <span className="game-dot super-sete" title="Super Sete" />
          <span className="game-dot dupla-sena" title="Dupla Sena" />
          <span className="game-dot timemania" title="Timemania" />
        </div>
        <div className="sidebar-user">
          <strong>{session.user.name}</strong>
          <span>{session.user.email}</span>
          <SyncCaixaButton />
          <SignOutButton />
        </div>
      </aside>
      <main className="app-content">{children}</main>
    </div>
  );
}

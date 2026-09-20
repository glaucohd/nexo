import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountSheet } from "@/components/account-sheet";
import { AppNav, TabBar } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { SyncCaixaButton } from "@/components/sync-caixa-button";
import { ThemeToggle } from "@/components/theme-toggle";
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

  const initials = session.user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  const games = [
    ["lotofacil", "Lotofácil"], ["mega", "Mega-Sena"], ["quina", "Quina"], ["milionaria", "+Milionária"], ["dia", "Dia de Sorte"],
    ["lotomania", "Lotomania"], ["super-sete", "Super Sete"], ["dupla-sena", "Dupla Sena"], ["timemania", "Timemania"],
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-actions">
          <SyncCaixaButton iconOnly />
          <AccountSheet initials={initials} name={session.user.name} email={session.user.email}>
            <ThemeToggle labels />
            <div className="sheet-actions">
              <SyncCaixaButton />
              <SignOutButton />
            </div>
          </AccountSheet>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-top">
          <Brand />
        </div>
        <p className="sidebar-label">Meu Nexo</p>
        <AppNav />
        <p className="sidebar-label games-label">Modalidades</p>
        <ul className="sidebar-games" aria-label="Modalidades disponíveis">
          {games.map(([key, label]) => (
            <li key={key}><span className={`game-dot ${key}`} />{label}</li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-avatar" aria-hidden="true">{initials || "?"}</span>
            <div>
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
            </div>
          </div>
          <ThemeToggle labels />
          <div className="sidebar-actions">
            <SyncCaixaButton />
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="app-content">{children}</main>
      <TabBar />
    </div>
  );
}

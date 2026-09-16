import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

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
        </div>
        <div className="sidebar-user">
          <strong>{session.user.name}</strong>
          <span>{session.user.email}</span>
          <SignOutButton />
        </div>
      </aside>
      <main className="app-content">{children}</main>
    </div>
  );
}

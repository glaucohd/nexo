import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

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
        <nav aria-label="Navegação da plataforma">
          <Link href="/app">Visão geral</Link>
          <Link href="/app/analises">Análises</Link>
          <Link href="/app/apostas">Minhas apostas</Link>
          <Link href="/app/resultados">Resultados</Link>
        </nav>
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

import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  const { modo } = await searchParams;

  return (
    <main className="auth-shell">
      <aside className="auth-aside">
        <Brand />
        <p className="auth-quote">Do primeiro número à conferência, seus jogos ficam no Nexo.</p>
        <p className="auth-note">Lotofácil · Mega-Sena · Quina · +Milionária · Dia de Sorte</p>
      </aside>
      <section className="auth-panel">
        <div>
          <AuthForm initialMode={modo === "cadastro" ? "cadastro" : "entrar"} />
          <Link className="back-link" href="/">← Voltar para a apresentação</Link>
        </div>
      </section>
    </main>
  );
}

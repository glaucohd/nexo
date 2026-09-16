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
        <p className="auth-quote">Organização transforma dados soltos em decisões claras.</p>
        <p className="auth-note">Nexo · análise responsável e sem promessa de resultado</p>
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

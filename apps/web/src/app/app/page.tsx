import Link from "next/link";
import Image from "next/image";
import { count } from "drizzle-orm";

import { db } from "@/db";
import { draws } from "@/db/schema";

const games = [
  { slug: "lotofacil", initials: "LF", icon: "lotofacil", name: "Lotofácil", subtitle: "15 a 20 números", color: "purple" },
  { slug: "mega-sena", initials: "MS", icon: "mega-sena", name: "Mega-Sena", subtitle: "6 a 20 números", color: "green" },
  { slug: "quina", initials: "QN", icon: "quina", name: "Quina", subtitle: "5 a 15 números", color: "violet" },
  { slug: "mais-milionaria", initials: "+M", icon: "mais-milionaria", name: "+Milionária", subtitle: "Números + trevos", color: "blue" },
  { slug: "dia-de-sorte", initials: "DS", icon: "dia-de-sorte", name: "Dia de Sorte", subtitle: "Números + mês", color: "amber" },
  { slug: "lotomania", initials: "LM", icon: "lotomania", name: "Lotomania", subtitle: "50 números · espelho", color: "orange" },
];

export default async function DashboardPage() {
  const [{ total: drawCount }] = await db.select({ total: count() }).from(draws);
  return (
    <>
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Seu painel de jogos</span>
          <h1>Qual jogo vamos analisar hoje?</h1>
          <p>Escolha uma modalidade para consultar dados ou montar uma nova carteira.</p>
        </div>
        <span className="status-pill"><i /> Base conectada</span>
      </header>

      <section className="dashboard-games" aria-label="Modalidades">
        {games.map((game) => (
          <Link className={`dashboard-game ${game.color}`} href={`/app/analises?modalidade=${game.slug}`} key={game.slug}>
            <span className="dashboard-game-icon"><Image src={`/trevos-loterias/${game.icon}.svg`} alt="" width={27} height={27} /></span>
            <div><strong>{game.name}</strong><small>{game.subtitle}</small></div>
            <span className="dashboard-game-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </section>

      <section className="dashboard-section-heading">
        <div><span className="eyebrow">Resumo</span><h2>Seu Nexo em um relance</h2></div>
        <Link href="/app/apostas">Ver minhas apostas →</Link>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card stat-card">
          <div className="dashboard-card-icon purple">✓</div>
          <span>Apostas salvas</span>
          <strong className="metric">0</strong>
          <small>Suas primeiras apostas aparecerão aqui</small>
        </article>
        <article className="dashboard-card stat-card">
          <div className="dashboard-card-icon green">#</div>
          <span>Modalidades</span>
          <strong className="metric">6</strong>
          <small>Com análises e geradores dedicados</small>
        </article>
        <article className="dashboard-card stat-card">
          <div className="dashboard-card-icon blue">∿</div>
          <span>Concursos na base</span>
          <strong className="metric">{drawCount.toLocaleString("pt-BR")}</strong>
          <small>Históricos reunidos para análise</small>
        </article>
        <article className="dashboard-card action-card wide">
          <div>
            <span className="eyebrow">Comece pela Lotofácil</span>
            <h2>Monte sua primeira carteira no novo Nexo</h2>
            <p>Use frequências, repetições e filtros para gerar jogos diversificados.</p>
            <Link className="button button-primary" href="/app/analises?modalidade=lotofacil">Explorar análises <span>→</span></Link>
          </div>
          <div className="action-balls" aria-hidden="true">
            {[3, 7, 10, 15, 21].map((number) => <span key={number}>{String(number).padStart(2,"0")}</span>)}
          </div>
        </article>
        <article className="dashboard-card responsible-card">
          <span className="responsible-icon">!</span>
          <h2>Aposte com consciência</h2>
          <p>Dados históricos ajudam na organização, mas não preveem o próximo sorteio.</p>
        </article>
      </section>
    </>
  );
}

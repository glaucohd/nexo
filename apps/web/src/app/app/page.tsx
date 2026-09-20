import Link from "next/link";
import Image from "next/image";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { draws, lotteries, portfolios } from "@/db/schema";
import { auth } from "@/lib/auth";
import { uiSlugFor } from "@/lib/lottery-generator";

const formatDate = (date: Date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

const games = [
  { slug: "lotofacil", initials: "LF", icon: "lotofacil", name: "Lotofácil", subtitle: "15 a 20 números", color: "purple" },
  { slug: "mega-sena", initials: "MS", icon: "mega-sena", name: "Mega-Sena", subtitle: "6 a 20 números", color: "green" },
  { slug: "quina", initials: "QN", icon: "quina", name: "Quina", subtitle: "5 a 15 números", color: "violet" },
  { slug: "mais-milionaria", initials: "+M", icon: "mais-milionaria", name: "+Milionária", subtitle: "Números + trevos", color: "blue" },
  { slug: "dia-de-sorte", initials: "DS", icon: "dia-de-sorte", name: "Dia de Sorte", subtitle: "Números + mês", color: "amber" },
  { slug: "lotomania", initials: "LM", icon: "lotomania", name: "Lotomania", subtitle: "50 números · espelho", color: "orange" },
  { slug: "super-sete", initials: "S7", icon: "super-sete", name: "Super Sete", subtitle: "7 colunas · dígitos 0 a 9", color: "lime" },
  { slug: "dupla-sena", initials: "DP", icon: "dupla-sena", name: "Dupla Sena", subtitle: "6 números · 2 sorteios", color: "crimson" },
  { slug: "timemania", initials: "TM", icon: "timemania", name: "Timemania", subtitle: "10 números · time do coração", color: "forest" },
];

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  // Último concurso de cada loteria (na Dupla Sena, o maior entre os dois sorteios).
  const latestRows = await db.selectDistinctOn([lotteries.slug], { source: lotteries.slug, contest: draws.contestNumber, date: draws.drawnAt })
    .from(draws).innerJoin(lotteries, eq(draws.lotteryId, lotteries.id))
    .orderBy(lotteries.slug, desc(draws.contestNumber));
  const latest = new Map<string, { contest: number; date: Date }>();
  for (const row of latestRows) {
    const slug = uiSlugFor(row.source);
    if ((latest.get(slug)?.contest ?? 0) < row.contest) latest.set(slug, { contest: row.contest, date: row.date });
  }
  const newestDate = [...latest.values()].reduce<Date | null>((newest, entry) => !newest || entry.date > newest ? entry.date : newest, null);

  // Carteiras do usuário: quantas já têm o sorteio na base.
  const saved = session
    ? await db.select({ target: portfolios.targetContest, source: lotteries.slug }).from(portfolios)
      .innerJoin(lotteries, eq(portfolios.lotteryId, lotteries.id)).where(eq(portfolios.userId, session.user.id))
    : [];
  const drawn = saved.filter((entry) => (entry.target ?? Infinity) <= (latest.get(uiSlugFor(entry.source))?.contest ?? 0)).length;
  const waiting = saved.length - drawn;
  return (
    <>
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Seu painel de jogos</span>
          <h1>Qual jogo vamos <em>analisar</em> hoje?</h1>
          <p>Escolha uma modalidade para consultar dados ou montar uma nova carteira.</p>
        </div>
        <span className="status-pill"><i /> {newestDate ? `Base atualizada até ${formatDate(newestDate)}` : "Base conectada"}</span>
      </header>

      <section className="dashboard-games" aria-label="Modalidades">
        {games.map((game) => (
          <Link className={`dashboard-game ${game.color}`} href={`/app/analises?modalidade=${game.slug}`} key={game.slug}>
            <span className="dashboard-game-icon"><Image src={`/trevos-loterias/${game.icon}.svg`} alt="" width={27} height={27} /></span>
            <div><strong>{game.name}</strong><small>{latest.get(game.slug) ? `Concurso ${latest.get(game.slug)!.contest} · ${formatDate(latest.get(game.slug)!.date)}` : game.subtitle}</small></div>
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
          <span>Carteiras salvas</span>
          <strong className="metric">{saved.length.toLocaleString("pt-BR")}</strong>
          <small>{saved.length ? "Em Minhas apostas" : "Suas primeiras carteiras aparecerão aqui"}</small>
        </article>
        <article className="dashboard-card stat-card">
          <div className="dashboard-card-icon blue">…</div>
          <span>Aguardando sorteio</span>
          <strong className="metric">{waiting.toLocaleString("pt-BR")}</strong>
          <small>{waiting ? "O resultado entra sozinho quando sair" : "Nenhuma carteira esperando"}</small>
        </article>
        <article className="dashboard-card stat-card">
          <div className="dashboard-card-icon green">↻</div>
          <span>Já sorteadas</span>
          <strong className="metric">{drawn.toLocaleString("pt-BR")}</strong>
          <small>{drawn ? "Com acertos e prêmios já calculados" : "Nenhuma carteira sorteada ainda"}</small>
        </article>
        <article className="dashboard-card action-card wide">
          {drawn > 0 ? <div>
            <span className="eyebrow">Resultados</span>
            <h2>Veja como foram seus <em>jogos</em></h2>
            <p>Os resultados já estão na base e cada carteira foi conferida. Confira acertos, prêmios e o saldo de cada uma.</p>
            <Link className="button button-primary" href="/app/apostas">Ver resultados <span>→</span></Link>
          </div> : <div>
            <span className="eyebrow">Próximo passo</span>
            <h2>Monte uma carteira e acompanhe o <em>sorteio</em></h2>
            <p>Gere jogos ou uma redução e salve em Minhas apostas. Quando o concurso sair, o resultado aparece lá sozinho.</p>
            <Link className="button button-primary" href="/app/gerador">Gerar jogos <span>→</span></Link>
          </div>}
        </article>
      </section>

      <p className="dashboard-note"><b>Aposte com consciência.</b> Dados históricos ajudam na organização, mas não preveem o próximo sorteio.</p>
    </>
  );
}

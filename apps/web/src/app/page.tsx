import Link from "next/link";
import Image from "next/image";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const lotteries = [
  { slug: "lotofacil", short: "LF", icon: "lotofacil", name: "Lotofácil", detail: "15 a 20 números", color: "#91278f" },
  { slug: "mega", short: "MS", icon: "mega-sena", name: "Mega-Sena", detail: "6 a 20 números", color: "#00a651" },
  { slug: "quina", short: "QN", icon: "quina", name: "Quina", detail: "5 a 15 números", color: "#2e3192" },
  { slug: "milionaria", short: "+M", icon: "mais-milionaria", name: "+Milionária", detail: "Números + trevos", color: "#2a3580" },
  { slug: "dia", short: "DS", icon: "dia-de-sorte", name: "Dia de Sorte", detail: "Números + mês", color: "#7e6906" },
  { slug: "lotomania", short: "LM", icon: "lotomania", name: "Lotomania", detail: "50 números · espelho", color: "#b55727" },
  { slug: "super-sete", short: "S7", icon: "super-sete", name: "Super Sete", detail: "7 colunas · 0 a 9", color: "#718c23" },
  { slug: "dupla-sena", short: "DP", icon: "dupla-sena", name: "Dupla Sena", detail: "6 números · 2 sorteios", color: "#b5195a" },
  { slug: "timemania", short: "TM", icon: "timemania", name: "Timemania", detail: "10 números · time do coração", color: "#00854a" },
];

const features = [
  { number: "01", title: "Entenda o histórico", text: "Veja frequências, atrasos, repetições e distribuições sem se perder em planilhas." },
  { number: "02", title: "Monte seus jogos", text: "Use recomendações, filtros gerais, ajustes por cartela e modos especiais de geração." },
  { number: "03", title: "Salve e confira", text: "Organize apostas por concurso e descubra automaticamente quantos pontos cada jogo fez." },
];

export default function Home() {
  return (
    <main className="landing">
      <header className="site-header container">
        <Brand />
        <nav aria-label="Navegação principal">
          <a href="#loterias">Loterias</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <ThemeToggle />
          <Link className="button button-ghost" href="/entrar">Entrar</Link>
        </nav>
      </header>

      <section className="hero container">
        <div className="hero-copy">
          <div className="hero-badge"><span /> Dados para apostar com mais organização</div>
          <h1>Seus jogos.<br /><em>Suas estratégias.</em><br />Tudo no Nexo.</h1>
          <p>
            Analise concursos, gere combinações, salve suas apostas e confira
            resultados das principais loterias em um só lugar.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/entrar?modo=cadastro">
              Começar agora <span aria-hidden="true">→</span>
            </Link>
            <a className="text-link" href="#loterias">Ver modalidades <span aria-hidden="true">↓</span></a>
          </div>
          <div className="trust-row" aria-label="Recursos principais">
            <span><b>✓</b> Análises históricas</span>
            <span><b>✓</b> Jogos salvos</span>
            <span><b>✓</b> Conferência automática</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Prévia do painel Nexo">
          <div className="preview-window">
            <div className="preview-topbar">
              <span className="preview-brand"><i /> nexo</span>
              <span className="live-dot">Base atualizada</span>
            </div>
            <div className="preview-heading">
              <div><small>Análise da vez</small><strong>Lotofácil</strong></div>
              <span className="contest-chip">Base histórica</span>
            </div>
            <div className="preview-content">
              <article className="preview-card number-panel">
                <div className="card-title"><span>Jogo recomendado</span><b>15 números</b></div>
                <div className="number-cloud">
                  {[1, 3, 4, 6, 7, 9, 10, 12, 13, 15, 17, 19, 21, 23, 25].map((number) => (
                    <span key={number}>{String(number).padStart(2, "0")}</span>
                  ))}
                </div>
                <div className="ticket-summary"><span>8 pares</span><span>7 ímpares</span><span>Soma 185</span></div>
              </article>
              <div className="preview-side">
                <article className="preview-card mini-metric"><span>Repetições</span><strong>9</strong><small>faixa mais comum</small></article>
                <article className="preview-card mini-chart"><span>Equilíbrio</span><div>{[45,70,58,85,64,77].map((height,i)=><i key={i} style={{height:`${height}%`}} />)}</div></article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lotteries-section" id="loterias">
        <div className="container">
          <div className="section-intro centered">
            <span className="eyebrow">Suas modalidades favoritas</span>
            <h2>Escolha a loteria. O Nexo <em>organiza o resto</em>.</h2>
            <p>Cada modalidade tem seus próprios filtros, análises e formas de montar jogos.</p>
          </div>
          <div className="lottery-grid">
            {lotteries.map((lottery) => (
              <Link className={`lottery-card ${lottery.slug}`} href="/entrar?modo=cadastro" key={lottery.slug} style={{ "--lottery-color": lottery.color } as React.CSSProperties}>
                <span className="lottery-icon"><Image src={`/trevos-loterias/${lottery.icon}.svg`} alt="" width={27} height={27} /></span>
                <div><strong>{lottery.name}</strong><small>{lottery.detail}</small></div>
                <span className="lottery-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="process-section" id="como-funciona">
        <div className="container">
          <div className="section-intro">
            <span className="eyebrow">Do resultado à conferência</span>
            <h2>Menos improviso.<br /><em>Mais clareza</em> em cada jogo.</h2>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature" key={feature.number}>
                <span>{feature.number}</span>
                <div className="feature-icon" aria-hidden="true">{feature.number === "01" ? "∿" : feature.number === "02" ? "#" : "✓"}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="resource-section container" id="recursos">
        <div className="resource-copy">
          <span className="eyebrow">Tudo conectado</span>
          <h2>Da primeira combinação ao <em>resultado final</em>.</h2>
          <p>Seu histórico fica organizado por modalidade e concurso para você voltar quando quiser.</p>
          <Link className="button button-dark" href="/entrar?modo=cadastro">Criar conta gratuita <span>→</span></Link>
        </div>
        <div className="resource-board">
          <div className="resource-ticket ticket-purple"><span>LF</span><b>17 jogos salvos</b><small>Lotofácil · concurso 0000</small></div>
          <div className="resource-ticket ticket-green"><span>MS</span><b>Carteira equilibrada</b><small>Mega-Sena · 8 jogos</small></div>
          <div className="resource-result"><span>✓</span><div><b>Conferência automática</b><small>Veja pontos e melhores cartelas</small></div></div>
        </div>
      </section>

      <section className="responsible-note container">
        <b>Aposte com consciência.</b>
        <p>Análises históricas ajudam a organizar escolhas, mas não alteram a probabilidade matemática dos sorteios.</p>
      </section>

      <footer className="site-footer container">
        <Brand />
        <p>Organize seus jogos. Acompanhe seus resultados.</p>
        <Link href="/entrar">Acessar minha conta →</Link>
      </footer>
    </main>
  );
}

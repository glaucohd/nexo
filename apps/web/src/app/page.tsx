import Link from "next/link";

import { Brand } from "@/components/brand";

const features = [
  {
    number: "01",
    title: "Leia o histórico",
    text: "Frequência, atrasos, repetições e distribuição reunidos em uma leitura direta.",
  },
  {
    number: "02",
    title: "Monte com critério",
    text: "Gere combinações com filtros gerais, ajustes por jogo e estratégias salvas.",
  },
  {
    number: "03",
    title: "Acompanhe depois",
    text: "Agrupe apostas, confira pontos automaticamente e compare o desempenho histórico.",
  },
];

export default function Home() {
  return (
    <main className="landing">
      <header className="site-header container">
        <Brand />
        <nav aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <Link className="button button-ghost" href="/entrar">Entrar</Link>
        </nav>
      </header>

      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow">Análise, organização e acompanhamento</span>
          <h1>Seus jogos fazem mais sentido quando os dados têm contexto.</h1>
          <p>
            O Nexo transforma resultados anteriores em uma visão simples para
            você analisar, montar, salvar e conferir seus jogos em um só lugar.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/entrar?modo=cadastro">
              Criar minha conta <span aria-hidden="true">↗</span>
            </Link>
            <a className="text-link" href="#como-funciona">
              Conhecer a plataforma <span aria-hidden="true">↓</span>
            </a>
          </div>
          <small>
            Análises históricas não alteram a probabilidade matemática de um
            sorteio. Use a plataforma como apoio de organização.
          </small>
        </div>

        <div className="hero-visual" aria-label="Exemplo do painel Nexo">
          <div className="preview-bar">
            <span>Painel de análise</span>
            <span className="live-dot">Base atualizada</span>
          </div>
          <div className="preview-grid">
            <article className="preview-card preview-card-main">
              <span className="preview-label">Distribuição recente</span>
              <strong>Equilíbrio do conjunto</strong>
              <div className="bars" aria-hidden="true">
                {[54, 76, 42, 88, 63, 71, 48, 82, 57, 67].map((height, i) => (
                  <span key={i} style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className="preview-legend">
                <span>200 concursos</span><span>Leitura consolidada</span>
              </div>
            </article>
            <article className="preview-card metric-card">
              <span className="preview-label">Repetições</span>
              <strong>9</strong><span>faixa mais comum</span>
            </article>
            <article className="preview-card ticket-card">
              <span className="preview-label">Aposta salva</span>
              <div className="number-cloud">
                {[1, 3, 4, 6, 7, 9, 10, 12, 13, 15, 17, 19, 21, 23, 25].map(
                  (number) => <span key={number}>{number}</span>,
                )}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="process-section" id="como-funciona">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Do dado à conferência</span>
            <h2>Um fluxo simples para não perder o fio da análise.</h2>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature" key={feature.number}>
                <span>{feature.number}</span><h3>{feature.title}</h3><p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="resource-section container" id="recursos">
        <div>
          <span className="eyebrow">Tudo conectado</span>
          <h2>Da primeira combinação ao resultado final.</h2>
        </div>
        <ul className="resource-list">
          <li><span>01</span>Análises estatísticas por modalidade</li>
          <li><span>02</span>Filtros globais e personalizados por cartela</li>
          <li><span>03</span>Geradores guiados e jogos espelho</li>
          <li><span>04</span>Carteiras salvas e conferência automática</li>
        </ul>
      </section>

      <footer className="site-footer container">
        <Brand /><p>Dados para organizar. Critério para decidir.</p>
      </footer>
    </main>
  );
}

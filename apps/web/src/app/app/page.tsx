export default function DashboardPage() {
  return (
    <>
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Seu espaço no Nexo</h1>
          <p>A base para reunir suas análises e acompanhar seus jogos.</p>
        </div>
        <span className="status-pill">Estrutura inicial ativa</span>
      </header>
      <section className="dashboard-grid">
        <article className="dashboard-card">
          <h2>Apostas salvas</h2>
          <p>Suas carteiras passarão a ficar vinculadas à conta.</p>
          <strong className="metric">0</strong>
        </article>
        <article className="dashboard-card">
          <h2>Modalidades</h2>
          <p>As cinco modalidades atuais serão migradas por etapas.</p>
          <strong className="metric">5</strong>
        </article>
        <article className="dashboard-card">
          <h2>Base própria</h2>
          <p>Resultados com origem, integridade e status de confirmação.</p>
          <strong className="metric">SQL</strong>
        </article>
        <article className="dashboard-card wide">
          <h2>Próxima etapa</h2>
          <p>Importar as apostas salvas no navegador e migrar o primeiro fluxo completo da Lotofácil para esta nova área.</p>
        </article>
        <article className="dashboard-card">
          <h2>Princípio do Nexo</h2>
          <p>Estatística histórica ajuda a organizar escolhas; não prevê resultados futuros.</p>
        </article>
      </section>
    </>
  );
}

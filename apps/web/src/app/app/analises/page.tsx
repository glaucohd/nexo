"use client";

import { useMemo, useState } from "react";

const modalities = {
  lotofacil: { name: "Lotofácil", color: "purple", hot: [10, 11, 20, 24, 25], cold: [2, 7, 13, 18, 22], repeat: "9,4", delay: "2" },
  mega: { name: "Mega-Sena", color: "green", hot: [5, 10, 23, 33, 42], cold: [7, 26, 39, 54, 60], repeat: "0,6", delay: "4" },
  quina: { name: "Quina", color: "violet", hot: [4, 31, 39, 49, 52], cold: [8, 17, 28, 63, 76], repeat: "0,3", delay: "6" },
  milionaria: { name: "+Milionária", color: "blue", hot: [3, 14, 18, 27, 41], cold: [1, 9, 32, 44, 50], repeat: "0,7", delay: "3" },
  dia: { name: "Dia de Sorte", color: "amber", hot: [2, 7, 12, 19, 24], cold: [4, 11, 16, 27, 30], repeat: "1,6", delay: "5" },
} as const;
type Modality = keyof typeof modalities;

export default function AnalysesPage() {
  const [selected, setSelected] = useState<Modality>("lotofacil");
  const game = modalities[selected];
  const bars = useMemo(() => game.hot.map((number, index) => ({ number, height: 48 + ((index * 13) % 42) })), [game]);
  return <div className="analysis-page">
    <header className="page-heading analysis-heading"><div><span className="eyebrow">Leitura histórica</span><h1>Análises</h1><p>Compare padrões do histórico e monte jogos com mais organização.</p></div><label className="analysis-select"><span>Modalidade</span><select value={selected} onChange={(event) => setSelected(event.target.value as Modality)}>{Object.entries(modalities).map(([slug, item]) => <option key={slug} value={slug}>{item.name}</option>)}</select></label></header>
    <section className="analysis-summary-grid"><article className={`analysis-summary-card ${game.color}`}><span>Concursos analisados</span><strong>200</strong><small>Base histórica disponível</small></article><article className={`analysis-summary-card ${game.color}`}><span>Repetição mais comum</span><strong>{game.repeat}</strong><small>dezenas do concurso anterior</small></article><article className={`analysis-summary-card ${game.color}`}><span>Maior atraso atual</span><strong>{game.delay}</strong><small>concursos sem aparecer</small></article></section>
    <section className="analysis-grid"><article className="analysis-card frequency-card"><div className="analysis-card-heading"><div><span className="eyebrow">Frequência recente</span><h2>Dezenas mais presentes</h2></div><span className="analysis-period">Últimos 50</span></div><div className="frequency-bars">{bars.map((bar) => <div className="frequency-bar" key={bar.number}><span style={{ height: `${bar.height}%` }} /><b>{String(bar.number).padStart(2, "0")}</b></div>)}</div><p className="analysis-note">Frequência descreve o passado e não altera a probabilidade do próximo sorteio.</p></article><article className="analysis-card numbers-card"><div className="analysis-card-heading"><div><span className="eyebrow">Sinais do histórico</span><h2>Quentes e atrasadas</h2></div></div><div className="number-group"><span className="group-label hot-label">Mais frequentes</span><div>{game.hot.map((number) => <i className="analysis-number hot" key={number}>{String(number).padStart(2, "0")}</i>)}</div></div><div className="number-group"><span className="group-label cold-label">Mais atrasadas</span><div>{game.cold.map((number) => <i className="analysis-number cold" key={number}>{String(number).padStart(2, "0")}</i>)}</div></div><button className="button button-primary analysis-button" type="button">Gerar recomendação <span>→</span></button></article></section>
    <section className="analysis-recommendation"><div className="recommendation-mark">✦</div><div><span className="eyebrow">Recomendação do Nexo</span><h2>Equilibre frequência, atraso e distribuição</h2><p>Para a {game.name}, experimente combinar 2 ou 3 dezenas frequentes com números medianos e manter a quantidade de pares próxima da metade do jogo.</p></div><button className="button button-dark" type="button">Montar jogo <span>→</span></button></section>
  </div>;
}

"use client";

import { useState } from "react";

import {
  analyzeCycles,
  analyzeDraws,
  countRepeated,
  metricDistribution,
  recentMetrics,
  type AnalysisDraw,
} from "@/lib/lottery-analysis";

import styles from "./analysis-explorer.module.css";

const games = [
  { slug: "lotofacil", name: "Lotofácil", total: 25, start: 1, color: "#91278f" },
  { slug: "mega-sena", name: "Mega-Sena", total: 60, start: 1, color: "#00a651" },
  { slug: "quina", name: "Quina", total: 80, start: 1, color: "#2e3192" },
  { slug: "mais-milionaria", name: "+Milionária", total: 50, start: 1, color: "#2a3580" },
  { slug: "dia-de-sorte", name: "Dia de Sorte", total: 31, start: 1, color: "#7e6906" },
  { slug: "lotomania", name: "Lotomania", total: 100, start: 0, color: "#b55727" },
] as const;

type View = "matrix" | "parameters" | "cycles";
type WindowSize = 15 | 30 | 50 | 100 | "all";

const numberLabel = (number: number) => String(number).padStart(2, "0");

function Matrix({ draws, allDraws, total, start, frequencies }: { draws: AnalysisDraw[]; allDraws: AnalysisDraw[]; total: number; start: number; frequencies: number[] }) {
  const sample = [...draws].reverse();
  const previous = new Map(allDraws.map((draw, index) => [draw.contest, allDraws[index + 1]]));
  const numbers = Array.from({ length: total }, (_, index) => index + start);

  return <div className={styles.tableScroll} tabIndex={0} aria-label="Matriz de concursos e dezenas; role horizontalmente para ver todas as colunas">
    <table className={styles.matrix}>
      <thead>
        <tr><th className={styles.stickyColumn}>Concurso</th>{numbers.map((number) => <th key={number}>{numberLabel(number)}</th>)}<th>Σ</th><th>P</th><th>R</th></tr>
        <tr className={styles.frequencyRow}><th className={styles.stickyColumn}>Vezes</th>{numbers.map((number) => <th key={number} style={{ "--heat": `${8 + Math.round(frequencies[number] / draws.length * 23)}%` } as React.CSSProperties}>{frequencies[number]}</th>)}<th colSpan={3}>na amostra</th></tr>
        <tr className={styles.percentageRow}><th className={styles.stickyColumn}>%</th>{numbers.map((number) => <th key={number}>{Math.round(frequencies[number] / draws.length * 100)}%</th>)}<th colSpan={3}>frequência</th></tr>
      </thead>
      <tbody>{sample.map((draw) => {
        const selected = new Set(draw.numbers);
        const prior = previous.get(draw.contest);
        return <tr key={draw.contest} className={draw === allDraws[0] ? styles.latestRow : ""}>
          <th className={styles.stickyColumn} scope="row">{draw.contest}</th>
          {numbers.map((number) => <td key={number} className={selected.has(number) ? styles.matrixHit : styles.matrixMiss}>{selected.has(number) ? numberLabel(number) : ""}</td>)}
          <td className={styles.statCell}>{draw.numbers.reduce((sum, number) => sum + number, 0)}</td>
          <td className={styles.statCell}>{draw.numbers.filter((number) => number % 2 === 0).length}</td>
          <td className={styles.statCell}>{prior ? countRepeated(draw.numbers, prior.numbers) : "—"}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function ParameterPanel({ draws, total }: { draws: AnalysisDraw[]; total: number }) {
  const sample = draws.slice(0, 15);
  const metrics = recentMetrics(draws, total, 15);
  const sums = sample.map((draw) => draw.numbers.reduce((sum, number) => sum + number, 0));
  const mean = sums.length ? sums.reduce((sum, value) => sum + value, 0) / sums.length : 0;

  return <div className={styles.sectionStack}>
    <div className={styles.sectionLead}><div><span className="eyebrow">Perfil dos sorteios</span><h2>Parâmetros dos últimos {sample.length} concursos</h2><p>As barras contam quantos concursos tiveram cada quantidade. Os números são observações da amostra.</p></div></div>
    <div className={styles.parameterGrid}>{metrics.map((metric) => {
      const distribution = metricDistribution(metric.values);
      const max = Math.max(...distribution.map(([, count]) => count), 1);
      return <article className={styles.parameterCard} key={metric.label}>
        <h3>{metric.label}</h3><small>{metric.values.length} concursos comparáveis</small>
        <div className={styles.distribution}>{distribution.map(([value, count]) => <div className={styles.distributionRow} key={value}><span>{value}</span><div><i style={{ width: `${count / max * 100}%` }} /></div><strong>{count}</strong></div>)}</div>
      </article>;
    })}
      <article className={`${styles.parameterCard} ${styles.sumCard}`}><h3>Soma das dezenas</h3><small>Últimos {sums.length} concursos</small><div><span>Menor<strong>{Math.min(...sums)}</strong></span><span>Média<strong>{mean.toFixed(1).replace(".", ",")}</strong></span><span>Maior<strong>{Math.max(...sums)}</strong></span></div></article>
    </div>
    <p className={styles.methodNote}>Primos são as dezenas divisíveis apenas por 1 e por elas mesmas. Fibonacci considera 1, 2, 3, 5, 8…; na Lotofácil, “moldura” são as 16 posições da borda do volante 5 × 5. “Repetidas” compara com o concurso imediatamente anterior.</p>
  </div>;
}

function CyclePanel({ draws, total, start, mode }: { draws: AnalysisDraw[]; total: number; start: number; mode: "presence" | "absence" }) {
  const cycle = analyzeCycles(draws, total, mode, start);
  const visible = [...draws.slice(0, 25)].reverse();
  const numbers = Array.from({ length: total }, (_, index) => index + start);
  const isPresence = mode === "presence";
  const description = isPresence
    ? `Um ciclo termina quando as ${total} dezenas apareceram ao menos uma vez desde o início dele.`
    : `Um ciclo termina quando cada uma das ${total} dezenas ficou ausente ao menos uma vez desde o início dele.`;

  return <article className={styles.cycleCard}>
    <div className={styles.cycleHeading}><div><span className="eyebrow">{isPresence ? "Ciclo de presença" : "Ciclo de ausência"}</span><h3>{isPresence ? "Quando todas aparecem" : "Quando todas ficam de fora"}</h3><p>{description}</p></div><div className={styles.cycleCounters}><span><strong>{cycle.completed}</strong> completos na base</span><span><strong>{cycle.openCoverage}/{total}</strong> no ciclo aberto</span></div></div>
    <p className={styles.missingLine}>{cycle.startContest ? `Ciclo aberto desde o concurso ${cycle.startContest}. ` : "O último concurso encerrou um ciclo. "}{cycle.startContest && cycle.missing.length < total ? `${isPresence ? "Ainda não saíram" : "Ainda não faltaram"}: ${cycle.missing.map(numberLabel).join(" · ")}.` : "O próximo concurso inicia um novo ciclo."}</p>
    <div className={styles.tableScroll} tabIndex={0} aria-label={`Matriz do ciclo de ${isPresence ? "presença" : "ausência"}; role horizontalmente para ver todas as dezenas`}>
      <table className={styles.matrix}>
        <thead><tr><th className={styles.stickyColumn}>Concurso</th>{numbers.map((number) => <th key={number}>{numberLabel(number)}</th>)}<th>Ciclo</th></tr></thead>
        <tbody>{visible.map((draw) => {
          const selected = new Set(draw.numbers);
          const state = cycle.byContest.get(draw.contest);
          return <tr key={draw.contest} className={state?.closed ? styles.cycleClosed : ""}><th className={styles.stickyColumn} scope="row">{draw.contest}</th>{numbers.map((number) => {
            const marked = isPresence ? selected.has(number) : !selected.has(number);
            return <td key={number} className={marked ? (isPresence ? styles.matrixHit : styles.absentHit) : styles.matrixMiss}>{marked ? numberLabel(number) : ""}</td>;
          })}<td className={styles.statCell}>{state?.cycle}{state?.closed ? " ✓" : ""}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <small className={styles.matrixCaption}>Últimos {visible.length} concursos exibidos · o cálculo dos ciclos usa todos os {draws.length} concursos disponíveis.</small>
  </article>;
}

export function AnalysisExplorer({ histories, initialSlug }: { histories: Record<string, AnalysisDraw[]>; initialSlug?: string }) {
  const [slug, setSlug] = useState(games.some((game) => game.slug === initialSlug) ? initialSlug! : "lotofacil");
  const [view, setView] = useState<View>("matrix");
  const [windowSize, setWindowSize] = useState<WindowSize>(15);
  const game = games.find((entry) => entry.slug === slug) ?? games[0];
  const draws = histories[game.slug] ?? [];
  const limit = windowSize === "all" ? draws.length : windowSize;
  const analysis = analyzeDraws(draws, game.total, limit);
  const frequencyRank = Array.from({ length: game.total }, (_, index) => index + game.start).sort((a, b) => analysis.frequencies[b] - analysis.frequencies[a] || a - b);
  const delayRank = Array.from({ length: game.total }, (_, index) => index + game.start).sort((a, b) => analysis.delays[b] - analysis.delays[a] || a - b);

  return <div className={styles.page} style={{ "--analysis-accent": game.color } as React.CSSProperties}>
    <header className={styles.header}><div><span className="eyebrow">Análises históricas</span><h1>Enxergue os concursos de outro jeito.</h1><p>Matrizes, distribuições e ciclos calculados a partir dos resultados que estão na base do Nexo.</p></div><label className={styles.selector}><span>Modalidade</span><select value={slug} onChange={(event) => { setSlug(event.target.value); setWindowSize(15); }}>{games.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.name}</option>)}</select></label></header>

    {draws.length ? <>
      <div className={styles.summary}><div><span>Concursos na base</span><strong>{draws.length}</strong><small>Até o concurso {draws[0].contest}</small></div><div><span>Repetição média</span><strong>{analysis.repeatMean?.toFixed(1).replace(".", ",") ?? "—"}</strong><small>com o concurso anterior</small></div><div><span>Mais frequente</span><strong>{numberLabel(frequencyRank[0])}</strong><small>{analysis.frequencies[frequencyRank[0]]} vezes em {analysis.sample.length}</small></div><div><span>Maior atraso atual</span><strong>{numberLabel(delayRank[0])}</strong><small>{analysis.delays[delayRank[0]]} concursos sem sair</small></div></div>

      <div className={styles.tabBar} role="tablist" aria-label="Tipos de análise">{([ ["matrix", "Matriz dos concursos"], ["parameters", "Parâmetros"], ["cycles", "Ciclos"] ] as const).map(([id, label]) => <button role="tab" aria-selected={view === id} className={view === id ? styles.activeTab : ""} key={id} type="button" onClick={() => setView(id)}>{label}</button>)}</div>

      {view === "matrix" && <section className={styles.panel}><div className={styles.sectionLead}><div><span className="eyebrow">Concurso × dezena</span><h2>Matriz de resultados</h2><p>Coluna = dezena. Linha = concurso. Uma célula preenchida indica que a dezena saiu naquele sorteio.</p></div><span className={styles.latestChip}>Último: {draws[0].contest}</span></div><div className={styles.rangeBar}><span>Janela:</span>{([15, 30, 50, 100, "all"] as const).map((size) => <button key={size} className={windowSize === size ? styles.rangeActive : ""} type="button" onClick={() => setWindowSize(size)}>{size === "all" ? `Todos (${draws.length})` : size}</button>)}</div><Matrix draws={analysis.sample} allDraws={draws} total={game.total} start={game.start} frequencies={analysis.frequencies} /><div className={styles.matrixFooter}><span><i className={styles.legendHit} /> Dezena sorteada</span><span>Σ soma</span><span>P pares</span><span>R repetidas do anterior</span></div><p className={styles.methodNote}>As linhas “Vezes” e “%” consideram apenas os {analysis.sample.length} concursos selecionados. Frequência e atraso descrevem o passado; não mudam a chance de cada dezena no próximo sorteio.</p></section>}

      {view === "parameters" && <ParameterPanel draws={draws} total={game.total} />}

      {view === "cycles" && <div className={styles.sectionStack}><div className={styles.sectionLead}><div><span className="eyebrow">Sequências observadas</span><h2>Ciclos de dezenas</h2><p>Veja quando cada dezena apareceu ou ficou ausente ao longo dos concursos.</p></div></div><CyclePanel draws={draws} total={game.total} start={game.start} mode="presence" /><CyclePanel draws={draws} total={game.total} start={game.start} mode="absence" /><p className={styles.methodNote}>O fechamento de um ciclo é uma descrição dos sorteios passados. A quantidade que falta no ciclo atual não é uma probabilidade de fechamento no próximo concurso.</p></div>}
    </> : <div className={styles.empty}><h2>Ainda não há concursos de {game.name} na base.</h2><p>Depois da importação, as matrizes e os parâmetros aparecerão aqui.</p></div>}
  </div>;
}

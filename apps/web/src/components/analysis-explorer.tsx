"use client";

import { useEffect, useState } from "react";

import {
  analyzeCycles,
  analyzeDraws,
  countRepeated,
  type AnalysisDraw,
} from "@/lib/lottery-analysis";

import { LotteryPicker } from "@/components/lottery-picker";
import { HotColdProfile, profileSlugs } from "@/components/hot-cold-profile";
import { buildProfile, type Profile, type Temperature } from "@/lib/hot-cold-profile";
import { StrategyLab } from "@/components/strategy-lab";

import styles from "./analysis-explorer.module.css";
import { validSuperSeteDraw } from "@/lib/super-sete";
import { rememberLottery } from "@/lib/selected-lottery";
import { lotteryGames, type LotterySlug } from "@/lib/lottery-generator";

const games = [
  { slug: "lotofacil", name: "Lotofácil", total: 25, start: 1, color: "#91278f" },
  { slug: "mega-sena", name: "Mega-Sena", total: 60, start: 1, color: "#00a651" },
  { slug: "quina", name: "Quina", total: 80, start: 1, color: "#2e3192" },
  { slug: "mais-milionaria", name: "+Milionária", total: 50, start: 1, color: "#2a3580" },
  { slug: "dia-de-sorte", name: "Dia de Sorte", total: 31, start: 1, color: "#7e6906" },
  { slug: "lotomania", name: "Lotomania", total: 100, start: 0, color: "#b55727" },
  { slug: "super-sete", name: "Super Sete", total: 70, start: 0, color: "#718c23" },
  { slug: "dupla-sena", name: "Dupla Sena", total: 50, start: 1, color: "#b5195a" },
  { slug: "timemania", name: "Timemania", total: 80, start: 1, color: "#00854a" },
] as const;

type View = "matrix" | "profile" | "cycles" | "strategies";
type WindowSize = 15 | 30 | 50 | 100 | "all";

const numberLabel = (number: number) => String(number).padStart(2, "0");

function SuperSeteAnalysis({ draws, windowSize, setWindowSize }: { draws: AnalysisDraw[]; windowSize: WindowSize; setWindowSize: (size: WindowSize) => void }) {
  const valid = draws.filter((draw) => validSuperSeteDraw(draw.numbers));
  const sample = valid.slice(0, windowSize === "all" ? valid.length : windowSize);
  const frequencies = Array.from({ length: 7 }, (_, column) => Array.from({ length: 10 }, (_, digit) => sample.filter((draw) => draw.numbers[column] === digit).length));
  const delays = Array.from({ length: 7 }, (_, column) => Array.from({ length: 10 }, (_, digit) => { const index = valid.findIndex((draw) => draw.numbers[column] === digit); return index < 0 ? valid.length : index; }));
  const repeated = valid.slice(0, -1).map((draw, index) => draw.numbers.filter((digit, column) => digit === valid[index + 1].numbers[column]).length);
  return valid.length ? <>
    <div className={styles.summary}><div><span>Concursos na base</span><strong>{valid.length}</strong><small>Até o concurso {valid[0].contest}</small></div><div><span>Repetição média</span><strong>{repeated.length ? (repeated.reduce((sum, count) => sum + count, 0) / repeated.length).toFixed(1).replace(".", ",") : "—"}</strong><small>colunas iguais ao anterior</small></div><div><span>Janela atual</span><strong>{sample.length}</strong><small>concursos analisados</small></div><div><span>Posições</span><strong>7</strong><small>dígitos de 0 a 9 por coluna</small></div></div>
    <section className={styles.panel}><div className={styles.sectionLead}><div><span className="eyebrow">Frequência por posição</span><h2>Cada coluna tem seu próprio histórico</h2><p>O dígito 5 na coluna 1 é uma ocorrência diferente do dígito 5 na coluna 2.</p></div></div><div className={styles.rangeBar}><span>Janela:</span>{([15, 30, 50, 100, "all"] as const).map((size) => <button key={size} className={windowSize === size ? styles.rangeActive : ""} type="button" onClick={() => setWindowSize(size)}>{size === "all" ? `Todos (${valid.length})` : size}</button>)}</div><div className={styles.tableScroll} tabIndex={0}><table className={styles.matrix}><thead><tr><th className={styles.stickyColumn}>Dígito</th>{Array.from({ length: 7 }, (_, column) => <th key={column}>C{column + 1}</th>)}</tr></thead><tbody>{Array.from({ length: 10 }, (_, digit) => <tr key={digit}><th className={styles.stickyColumn}>{digit}</th>{frequencies.map((column, index) => <td className={styles.statCell} key={index} title={`Coluna ${index + 1}: ${column[digit]} vezes em ${sample.length} concursos`}>{column[digit]}</td>)}</tr>)}</tbody></table></div><p className={styles.methodNote}>Contagem em {sample.length} concursos. Atrasos e frequências descrevem o histórico, sem transformar uma coluna em previsão.</p></section>
    <section className={styles.panel}><div className={styles.sectionLead}><div><span className="eyebrow">Atrasos atuais</span><h2>Concursos desde a última aparição</h2><p>O atraso é contado por combinação de coluna e dígito.</p></div></div><div className={styles.tableScroll} tabIndex={0}><table className={styles.matrix}><thead><tr><th className={styles.stickyColumn}>Dígito</th>{Array.from({ length: 7 }, (_, column) => <th key={column}>C{column + 1}</th>)}</tr></thead><tbody>{Array.from({ length: 10 }, (_, digit) => <tr key={digit}><th className={styles.stickyColumn}>{digit}</th>{delays.map((column, index) => <td className={styles.statCell} key={index}>{column[digit]}</td>)}</tr>)}</tbody></table></div></section>
    <section className={styles.panel}><div className={styles.sectionLead}><div><span className="eyebrow">Sorteio a sorteio</span><h2>Matriz das sete colunas</h2><p>Os dígitos são mantidos na ordem original do sorteio.</p></div></div><div className={styles.tableScroll} tabIndex={0}><table className={styles.matrix}><thead><tr><th className={styles.stickyColumn}>Concurso</th>{Array.from({ length: 7 }, (_, column) => <th key={column}>C{column + 1}</th>)}<th>R</th></tr></thead><tbody>{sample.map((draw) => { const previous = valid[valid.indexOf(draw) + 1]; return <tr key={draw.contest}><th className={styles.stickyColumn}>{draw.contest}</th>{draw.numbers.map((digit, column) => <td className={styles.matrixHit} key={column}>{digit}</td>)}<td className={styles.statCell}>{previous ? draw.numbers.filter((digit, column) => digit === previous.numbers[column]).length : "—"}</td></tr>; })}</tbody></table></div><p className={styles.methodNote}>R = quantidade de colunas que repetiram o mesmo dígito do concurso anterior.</p></section>
  </> : <div className={styles.empty}><h2>Ainda não há concursos válidos da Super Sete na base.</h2><p>Importe os resultados da CAIXA para habilitar as análises.</p></div>;
}

const tempClass: Record<Temperature, string> = { hot: styles.tHot, neutral: styles.tNeutral, cold: styles.tCold };
const tempName: Record<Temperature, string> = { hot: "quente", neutral: "neutra", cold: "fria" };

function Matrix({ draws, allDraws, total, start, frequencies, delays, lateThreshold, profile, byTemperature }: { draws: AnalysisDraw[]; allDraws: AnalysisDraw[]; total: number; start: number; frequencies: number[]; delays: ReadonlyMap<number, number>; lateThreshold: number; profile: Profile; byTemperature: boolean }) {
  const sample = [...draws].reverse();
  const previous = new Map(allDraws.map((draw, index) => [draw.contest, allDraws[index + 1]]));
  const numbers = Array.from({ length: total }, (_, index) => index + start);
  const group = (number: number) => profile.temperature.get(number)!;

  return <div className={styles.tableScroll} tabIndex={0} aria-label="Matriz de concursos e dezenas; role horizontalmente para ver todas as colunas">
    <table className={`${styles.matrix} ${total > 60 ? styles.denseMatrix : ""}`}>
      <thead>
        <tr><th className={styles.stickyColumn}>Concurso</th>{numbers.map((number) => <th key={number} className={tempClass[group(number)]} title={`Dezena ${numberLabel(number)}: ${tempName[group(number)]}`}>{numberLabel(number)}</th>)}<th>Σ</th><th>P</th><th>R</th><th>Q·N·F</th><th>M</th></tr>
        <tr className={styles.frequencyRow}><th className={styles.stickyColumn}>Vezes</th>{numbers.map((number) => <th key={number} style={{ "--heat": `${8 + Math.round(frequencies[number] / draws.length * 23)}%` } as React.CSSProperties}>{frequencies[number]}</th>)}<th colSpan={5}>na amostra</th></tr>
        <tr className={styles.percentageRow}><th className={styles.stickyColumn}>%</th>{numbers.map((number) => <th key={number}>{Math.round(frequencies[number] / draws.length * 100)}%</th>)}<th colSpan={5}>frequência</th></tr>
        <tr className={styles.delayRow}><th className={styles.stickyColumn}>Atraso</th>{numbers.map((number) => { const delay = delays.get(number) ?? 0; return <th key={number} className={delay >= lateThreshold ? styles.lateCell : ""} title={`${delay} ${delay === 1 ? "concurso" : "concursos"} sem sair${delay >= lateThreshold ? " · atrasada" : ""}`}>{delay}</th>; })}<th colSpan={5}>concursos sem sair</th></tr>
      </thead>
      <tbody>{sample.map((draw) => {
        const selected = new Set(draw.numbers);
        const prior = previous.get(draw.contest);
        const counts = { hot: 0, neutral: 0, cold: 0 };
        for (const number of draw.numbers) counts[group(number)] += 1;
        return <tr key={draw.contest} className={draw === allDraws[0] ? styles.latestRow : ""}>
          <th className={styles.stickyColumn} scope="row">{draw.contest}</th>
          {numbers.map((number) => <td key={number} title={`Concurso ${draw.contest} · dezena ${numberLabel(number)}${selected.has(number) ? ` · ${tempName[group(number)]}` : ""}`} className={selected.has(number) ? (byTemperature ? `${styles.matrixHit} ${tempClass[group(number)]}` : styles.matrixHit) : styles.matrixMiss}>{selected.has(number) ? numberLabel(number) : ""}</td>)}
          <td className={styles.statCell}>{draw.numbers.reduce((sum, number) => sum + number, 0)}</td>
          <td className={styles.statCell}>{draw.numbers.filter((number) => number % 2 === 0).length}</td>
          <td className={styles.statCell}>{prior ? countRepeated(draw.numbers, prior.numbers) : "—"}</td>
          <td className={styles.statCell} title={`${counts.hot} ${counts.hot === 1 ? "quente" : "quentes"}, ${counts.neutral} ${counts.neutral === 1 ? "neutra" : "neutras"}, ${counts.cold} ${counts.cold === 1 ? "fria" : "frias"}`}>{counts.hot}·{counts.neutral}·{counts.cold}</td>
          <td className={styles.statCell}>{draw.numbers.filter((number) => profile.frame.has(number)).length}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function CyclePanel({ draws, total, start }: { draws: AnalysisDraw[]; total: number; start: number }) {
  const cycle = analyzeCycles(draws, total, "presence", start);

  return <article className={styles.cycleCard}>
    <div className={styles.cycleHeading}><div><span className="eyebrow">Ciclo de presença</span><h3>Quando todas aparecem</h3><p>Um ciclo termina quando as {total} dezenas apareceram ao menos uma vez desde o início dele.</p></div><div className={styles.cycleCounters}><span><strong>{cycle.completed}</strong> completos na base</span><span><strong>{cycle.openCoverage}/{total}</strong> no ciclo aberto</span></div></div>
    <p className={styles.missingLine}>{cycle.startContest ? `Ciclo aberto desde o concurso ${cycle.startContest}. ` : "O último concurso encerrou um ciclo. "}{cycle.startContest && cycle.missing.length < total ? `Ainda não saíram: ${cycle.missing.map(numberLabel).join(" · ")}.` : "O próximo concurso inicia um novo ciclo."}</p>
  </article>;
}

export function AnalysisExplorer({ histories, initialSlug }: { histories: Record<string, AnalysisDraw[]>; initialSlug?: string }) {
  const [slug, setSlug] = useState(games.some((game) => game.slug === initialSlug) ? initialSlug! : "lotofacil");
  const [view, setView] = useState<View>("matrix");
  const [windowSize, setWindowSize] = useState<WindowSize>(15);
  const [matrixExpanded, setMatrixExpanded] = useState(false);
  const [byTemperature, setByTemperature] = useState(true);
  const game = games.find((entry) => entry.slug === slug) ?? games[0];
  const draws = histories[game.slug] ?? [];
  // Com 100 dezenas e 20 sorteadas, a matriz da Lotomania vira um borrão sem
  // leitura útil; ela abre direto nos parâmetros.
  const hasMatrix = game.slug !== "lotomania";
  const hasProfile = profileSlugs.has(game.slug);
  useEffect(() => { rememberLottery(slug); }, [slug]);
  const activeView: View = !hasMatrix ? "cycles" : view === "profile" && !hasProfile ? "matrix" : view;

  // Em tela cheia, Esc fecha a matriz expandida.
  useEffect(() => {
    if (!matrixExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMatrixExpanded(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [matrixExpanded]);
  const limit = windowSize === "all" ? draws.length : windowSize;
  const analysis = analyzeDraws(draws, game.total, limit);
  // Quente, neutra e fria dentro da própria janela da matriz.
  // O atraso conta todo o histórico (e concursos, não sorteios, na Dupla Sena).
  const delayProfile = activeView === "matrix" && game.slug !== "super-sete" && draws.length ? buildProfile(draws, lotteryGames[game.slug as LotterySlug], 1) : null;
  const profile = activeView === "matrix" && game.slug !== "super-sete" && analysis.sample.length ? buildProfile(analysis.sample, lotteryGames[game.slug as LotterySlug], Infinity) : null;
  const frequencyRank = Array.from({ length: game.total }, (_, index) => index + game.start).sort((a, b) => analysis.frequencies[b] - analysis.frequencies[a] || a - b);
  const delayRank = Array.from({ length: game.total }, (_, index) => index + game.start).sort((a, b) => analysis.delays[b] - analysis.delays[a] || a - b);

  return <div className={styles.page} style={{ "--analysis-accent": game.color } as React.CSSProperties}>
    <LotteryPicker games={games} value={slug} onChange={(next) => { setSlug(next as typeof slug); setWindowSize(15); }} />
    <header className={styles.header}><div><span className="eyebrow">Análises históricas</span><h1>Enxergue os concursos de <em>outro jeito</em>.</h1><p>Matriz e ciclos calculados a partir dos resultados que estão na base do Nexo.</p></div></header>

    {game.slug === "super-sete" ? <><SuperSeteAnalysis draws={draws} windowSize={windowSize} setWindowSize={setWindowSize} /><StrategyLab key={game.slug} slug={game.slug} gameName={game.name} /></> : draws.length ? <>
      <div className={styles.summary}><div><span>Concursos na base</span><strong>{draws.length}</strong><small>Até o concurso {draws[0].contest}</small></div><div><span>Repetição média</span><strong>{analysis.repeatMean?.toFixed(1).replace(".", ",") ?? "—"}</strong><small>com o concurso anterior</small></div><div><span>Mais frequente</span><strong>{numberLabel(frequencyRank[0])}</strong><small>{analysis.frequencies[frequencyRank[0]]} vezes em {analysis.sample.length}</small></div><div><span>Maior atraso atual</span><strong>{numberLabel(delayRank[0])}</strong><small>{analysis.delays[delayRank[0]]} concursos sem sair</small></div></div>

      <div className={styles.tabBar} role="tablist" aria-label="Tipos de análise">{([ ["matrix", "Matriz dos concursos"], ["profile", "Quentes e frias"], ["cycles", "Ciclos"], ["strategies", "Estratégias"] ] as const).filter(([id]) => (hasMatrix || id !== "matrix") && (hasProfile || id !== "profile")).map(([id, label]) => <button role="tab" aria-selected={activeView === id} className={activeView === id ? styles.activeTab : ""} key={id} type="button" onClick={() => setView(id)}>{label}</button>)}</div>

      {activeView === "matrix" && profile && delayProfile && <section className={`${styles.panel} ${matrixExpanded ? styles.panelExpanded : ""}`}><div className={styles.sectionLead}><div><span className="eyebrow">Concurso × dezena</span><h2>Matriz de resultados</h2><p>Coluna = dezena. Linha = concurso. Uma célula preenchida indica que a dezena saiu naquele sorteio.</p></div><span className={styles.latestChip}>Último: {draws[0].contest}</span></div><div className={styles.rangeBar}><span>Janela:</span>{([15, 30, 50, 100, "all"] as const).map((size) => <button key={size} className={windowSize === size ? styles.rangeActive : ""} type="button" onClick={() => setWindowSize(size)}>{size === "all" ? `Todos (${draws.length})` : size}</button>)}<button type="button" className={styles.colorToggle} aria-pressed={byTemperature} onClick={() => setByTemperature((current) => !current)}>{byTemperature ? "Cores: quentes e frias" : "Cor da loteria"}</button><button type="button" className={styles.expandButton} aria-pressed={matrixExpanded} onClick={() => setMatrixExpanded((current) => !current)}>{matrixExpanded ? "Fechar tela cheia ✕" : "Expandir matriz ⤢"}</button></div><Matrix draws={analysis.sample} allDraws={draws} total={game.total} start={game.start} frequencies={analysis.frequencies} delays={delayProfile.delays} lateThreshold={delayProfile.lateThreshold} profile={profile} byTemperature={byTemperature} /><div className={styles.matrixFooter}>{byTemperature ? <><span><i className={`${styles.legendHit} ${styles.tHot}`} /> Quente</span><span><i className={`${styles.legendHit} ${styles.tNeutral}`} /> Neutra</span><span><i className={`${styles.legendHit} ${styles.tCold}`} /> Fria</span></> : <span><i className={styles.legendHit} /> Dezena sorteada</span>}<span>Σ soma</span><span>P pares</span><span>R repetidas do anterior</span><span><i className={`${styles.legendHit} ${styles.legendLate}`} /> Atrasada ({delayProfile.lateThreshold}+ concursos sem sair)</span><span>Q·N·F quentes·neutras·frias</span><span>M na moldura</span></div><p className={styles.methodNote}>Quente, neutra e fria dividem as {game.total} dezenas em terços pela frequência nos {analysis.sample.length} concursos selecionados. “Vezes” e “%” usam essa mesma janela; “Atraso” conta todo o histórico. Frequência e atraso descrevem o passado; não mudam a chance de cada dezena no próximo sorteio.</p></section>}


      {activeView === "profile" && <HotColdProfile key={game.slug} slug={game.slug as LotterySlug} history={draws} />}

      {activeView === "strategies" && <StrategyLab key={game.slug} slug={game.slug} gameName={game.name} />}

      {activeView === "cycles" && <div className={styles.sectionStack}><div className={styles.sectionLead}><div><span className="eyebrow">Sequências observadas</span><h2>Ciclo de dezenas</h2><p>Quantos concursos a base levou para ver todas as dezenas saírem ao menos uma vez.</p></div></div><CyclePanel draws={draws} total={game.total} start={game.start} /><p className={styles.methodNote}>O fechamento de um ciclo é uma descrição dos sorteios passados. A quantidade que falta no ciclo atual não é uma probabilidade de fechamento no próximo concurso.</p></div>}
    </> : <div className={styles.empty}><h2>Ainda não há concursos de {game.name} na base.</h2><p>Depois da importação, as matrizes e os parâmetros aparecerão aqui.</p></div>}
  </div>;
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { lotteryBoardNumber, lotteryBoardPosition } from "@/lib/lottery-generator";

import styles from "./results-explorer.module.css";

export type LotteryHistory = {
  contest: number;
  date: string;
  numbers: number[];
  extras: Record<string, unknown> | null;
  status: "provisional" | "confirmed" | "corrected";
  source: string;
};

const games = [
  { slug: "lotofacil", name: "Lotofácil", total: 25, start: 1, columns: 5, color: "#91278f", layout: "5 × 5", division: "none" },
  { slug: "mega-sena", name: "Mega-Sena", total: 60, start: 1, columns: 10, color: "#00a651", layout: "6 × 10", division: "quadrants" },
  { slug: "quina", name: "Quina", total: 80, start: 1, columns: 10, color: "#2e3192", layout: "8 × 10", division: "quadrants" },
  { slug: "mais-milionaria", name: "+Milionária", total: 50, start: 1, columns: 5, color: "#2a3580", layout: "10 × 5", division: "halves" },
  { slug: "dia-de-sorte", name: "Dia de Sorte", total: 31, start: 1, columns: 7, color: "#7e6906", layout: "5 linhas", division: "none" },
  { slug: "lotomania", name: "Lotomania", total: 100, start: 0, columns: 10, color: "#b55727", layout: "10 × 10", division: "quadrants" },
] as const;

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function ResultsExplorer({ histories }: { histories: Record<string, LotteryHistory[]> }) {
  const [slug, setSlug] = useState<string>("lotofacil");
  const [index, setIndex] = useState(0);
  const [lotomaniaView, setLotomaniaView] = useState<"cross" | "blocks">("cross");
  const game = games.find((entry) => entry.slug === slug) ?? games[0];
  const history = useMemo(() => [...(histories[game.slug] ?? [])].sort((a, b) => b.contest - a.contest), [histories, game.slug]);
  const draw = history[index];
  const selected = useMemo(() => new Set(draw?.numbers ?? []), [draw]);
  const rows = Math.ceil(game.total / game.columns);
  const partitionCounts = game.division === "quadrants" ? [0, 0, 0, 0] : game.division === "halves" ? [0, 0] : [];
  for (const number of draw?.numbers ?? []) {
    const position = lotteryBoardPosition(game.slug, number);
    const row = Math.floor(position / game.columns);
    if (game.division === "quadrants") {
      const column = position % game.columns;
      partitionCounts[(row < rows / 2 ? 0 : 2) + (column < game.columns / 2 ? 0 : 1)] += 1;
    } else if (game.division === "halves") {
      partitionCounts[row < rows / 2 ? 0 : 1] += 1;
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;
      if (event.key === "ArrowLeft" && history.length) setIndex((current) => Math.min(current + 1, history.length - 1));
      if (event.key === "ArrowRight") setIndex((current) => Math.max(current - 1, 0));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [history.length]);

  const extras = draw?.extras;
  const trevos = Array.isArray(extras?.trevos) ? extras.trevos.filter((value): value is number => typeof value === "number") : [];
  const month = typeof extras?.mes === "number" ? months[extras.mes - 1] : typeof extras?.mesSorte === "string" ? extras.mesSorte : null;

  return (
    <section className={styles.page} style={{ "--result-accent": game.color, "--result-columns": game.columns } as React.CSSProperties}>
      <header className={styles.header}>
        <div>
          <span className="eyebrow">Histórico de sorteios</span>
          <h1>Veja o sorteio na cartela.</h1>
          <p>Escolha a modalidade e percorra os concursos para ver a posição de cada dezena sorteada.</p>
        </div>
        <label className={styles.selector}>
          <span>Modalidade</span>
          <select value={slug} onChange={(event) => { setSlug(event.target.value); setIndex(0); }}>
            {games.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.name}</option>)}
          </select>
        </label>
      </header>

      {draw ? (
        <div className={styles.content}>
          <nav className={styles.navigator} aria-label="Navegação entre concursos">
            <button type="button" onClick={() => setIndex((current) => current + 1)} disabled={index >= history.length - 1} aria-label="Concurso mais antigo"><span aria-hidden="true">‹</span><small>Mais antigo</small></button>
            <div className={styles.contest} aria-live="polite">
              <span className={styles.counter}>{index === 0 ? "Mais recente" : `${index + 1} de ${history.length} concursos`}</span>
              <strong>Concurso {draw.contest}</strong>
              <span>{formatDate(draw.date)} <i aria-hidden="true">·</i> {draw.status === "provisional" ? "Resultado provisório" : "Resultado registrado"}</span>
              {index > 0 && <button type="button" className={styles.latestButton} onClick={() => setIndex(0)}>Voltar ao mais recente ↗</button>}
            </div>
            <button type="button" onClick={() => setIndex((current) => current - 1)} disabled={index === 0} aria-label="Concurso mais recente"><small>Mais recente</small><span aria-hidden="true">›</span></button>
          </nav>

          <div className={styles.mainGrid}>
            <article className={styles.boardCard}>
              <div className={styles.cardHeading}><div><span className="eyebrow">{game.name}</span><h2>Volante do concurso</h2></div><span className={styles.layoutTag}>{game.layout}</span></div>
              {game.slug === "lotomania" && <div className={styles.viewSwitch} role="group" aria-label="Divisão do volante"><button type="button" aria-pressed={lotomaniaView === "cross"} onClick={() => setLotomaniaView("cross")}>Quadrantes</button><button type="button" aria-pressed={lotomaniaView === "blocks"} onClick={() => setLotomaniaView("blocks")}>Blocos de 4</button></div>}
              <div className={`${styles.board} ${game.division === "quadrants" && !(game.slug === "lotomania" && lotomaniaView === "blocks") ? styles.quadrantBoard : ""} ${game.division === "halves" ? `${styles.halvesBoard} ${styles.narrowBoard}` : ""} ${game.slug === "lotofacil" ? styles.lotofacilBoard : ""} ${game.slug === "lotomania" && lotomaniaView === "blocks" ? styles.blockBoard : ""}`} role="img" aria-label={`Volante do concurso ${draw.contest}: dezenas ${draw.numbers.join(", ")}`}>
                {game.division === "quadrants" && !(game.slug === "lotomania" && lotomaniaView === "blocks") && <div className={styles.boardMarkers} aria-hidden="true">
                  <span className={styles.markerTopLeft}>Q1</span><span className={styles.markerTopRight}>Q2</span>
                  <span className={styles.markerBottomLeft}>Q3</span><span className={styles.markerBottomRight}>Q4</span>
                </div>}
                {game.division === "halves" && <div className={styles.boardMarkers} aria-hidden="true">
                  <span className={styles.markerTopLeft}>SUPERIOR</span><span className={styles.markerBottomLeft}>INFERIOR</span>
                </div>}
                {game.slug === "lotomania" && lotomaniaView === "blocks"
                  ? Array.from({ length: 25 }, (_, block) => {
                    const row = Math.floor(block / 5) * 2;
                    const column = block % 5 * 2;
                    return <div className={styles.blockGroup} key={block} aria-hidden="true">{[row * 10 + column, row * 10 + column + 1, (row + 1) * 10 + column, (row + 1) * 10 + column + 1].map((position) => {
                      const number = lotteryBoardNumber(game.slug, position);
                      return <span className={`${styles.cell} ${selected.has(number) ? styles.marked : ""}`} key={number}>{String(number).padStart(2, "0")}</span>;
                    })}</div>;
                  })
                  : Array.from({ length: game.total }, (_, position) => {
                    const number = lotteryBoardNumber(game.slug, position);
                    return <span className={`${styles.cell} ${selected.has(number) ? styles.marked : ""}`} key={number} aria-hidden="true">{String(number).padStart(2, "0")}</span>;
                  })}
              </div>
              {partitionCounts.length > 0 && <div className={`${styles.partitionSummary} ${game.division === "halves" ? styles.narrowSummary : ""}`} aria-label={game.division === "quadrants" ? "Dezenas sorteadas por quadrante" : "Dezenas sorteadas por metade"}>
                {partitionCounts.map((count, position) => <div key={position}><span>{game.division === "quadrants" ? `Q${position + 1}` : position === 0 ? "Superior" : "Inferior"}</span><strong>{count}</strong></div>)}
              </div>}
              <div className={styles.boardLegend}><span className={styles.legendMark} /> Dezena sorteada <span className={styles.legendEmpty} /> Não sorteada</div>
            </article>

            <aside className={styles.details}>
              <div className={styles.detailCard}>
                <span className="eyebrow">Resultado</span>
                <h2>{draw.numbers.length} dezenas sorteadas</h2>
                <div className={styles.numberList}>{[...draw.numbers].sort((a, b) => a - b).map((number) => <span key={number}>{String(number).padStart(2, "0")}</span>)}</div>
                <p className={styles.source}>{draw.source.startsWith("caixa:") ? "Fonte: resultados da CAIXA" : "Fonte: histórico importado do projeto"}</p>
                {trevos.length > 0 && <p className={styles.extra}>Trevos: <strong>{trevos.map((value) => String(value).padStart(2, "0")).join(" · ")}</strong></p>}
                {month && <p className={styles.extra}>Mês da Sorte: <strong>{month}</strong></p>}
                <div className={styles.metrics}><div><span>Pares</span><strong>{draw.numbers.filter((number) => number % 2 === 0).length}</strong></div><div><span>Ímpares</span><strong>{draw.numbers.filter((number) => number % 2 !== 0).length}</strong></div><div><span>Soma</span><strong>{draw.numbers.reduce((sum, number) => sum + number, 0)}</strong></div></div>
              </div>
              <div className={styles.detailCard}>
                <span className="eyebrow">Distribuição</span>
                <h2>Como caiu por linha</h2>
                <div className={styles.rowList}>{Array.from({ length: rows }, (_, row) => {
                  const rowSize = Math.min(game.columns, game.total - row * game.columns);
                  const count = Array.from({ length: rowSize }, (_, column) => lotteryBoardNumber(game.slug, row * game.columns + column)).filter((number) => selected.has(number)).length;
                  return <div className={styles.row} key={row}><span>{row + 1}ª</span><div className={styles.rowTrack}><i style={{ width: `${count / rowSize * 100}%` }} /></div><strong>{count}</strong></div>;
                })}</div>
              </div>
            </aside>
          </div>
        </div>
      ) : <div className={styles.empty}><h2>Nenhum concurso importado para {game.name}</h2><p>Os resultados aparecerão aqui quando forem adicionados à base.</p></div>}
    </section>
  );
}

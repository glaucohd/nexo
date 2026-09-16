"use client";

import { useEffect, useMemo, useState } from "react";

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
  { slug: "lotofacil", name: "Lotofácil", total: 25, columns: 5, color: "#91278f", layout: "5 × 5" },
  { slug: "mega-sena", name: "Mega-Sena", total: 60, columns: 10, color: "#00a651", layout: "6 × 10" },
  { slug: "quina", name: "Quina", total: 80, columns: 10, color: "#2e3192", layout: "8 × 10" },
  { slug: "mais-milionaria", name: "+Milionária", total: 50, columns: 5, color: "#2a3580", layout: "10 × 5" },
  { slug: "dia-de-sorte", name: "Dia de Sorte", total: 31, columns: 7, color: "#7e6906", layout: "5 linhas" },
] as const;

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function ResultsExplorer({ histories }: { histories: Record<string, LotteryHistory[]> }) {
  const [slug, setSlug] = useState<string>("lotofacil");
  const [index, setIndex] = useState(0);
  const game = games.find((entry) => entry.slug === slug) ?? games[0];
  const history = histories[game.slug] ?? [];
  const draw = history[index];
  const selected = useMemo(() => new Set(draw?.numbers ?? []), [draw]);
  const rows = Math.ceil(game.total / game.columns);

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
            <button type="button" onClick={() => setIndex((current) => current + 1)} disabled={index >= history.length - 1} aria-label="Concurso anterior"><span aria-hidden="true">‹</span><small>Anterior</small></button>
            <div className={styles.contest} aria-live="polite">
              <span className={styles.counter}>{index + 1} de {history.length} concursos</span>
              <strong>Concurso {draw.contest}</strong>
              <span>{formatDate(draw.date)} <i aria-hidden="true">·</i> {draw.status === "provisional" ? "Resultado provisório" : "Resultado registrado"}</span>
            </div>
            <button type="button" onClick={() => setIndex((current) => current - 1)} disabled={index === 0} aria-label="Próximo concurso"><small>Próximo</small><span aria-hidden="true">›</span></button>
          </nav>

          <div className={styles.mainGrid}>
            <article className={styles.boardCard}>
              <div className={styles.cardHeading}><div><span className="eyebrow">{game.name}</span><h2>Volante do concurso</h2></div><span className={styles.layoutTag}>{game.layout}</span></div>
              <div className={styles.board} role="img" aria-label={`Volante do concurso ${draw.contest}: dezenas ${draw.numbers.join(", ")}`}>
                {Array.from({ length: game.total }, (_, position) => {
                  const number = position + 1;
                  return <span className={`${styles.cell} ${selected.has(number) ? styles.marked : ""}`} key={number} aria-hidden="true">{String(number).padStart(2, "0")}</span>;
                })}
              </div>
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
                  const count = Array.from({ length: rowSize }, (_, column) => row * game.columns + column + 1).filter((number) => selected.has(number)).length;
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

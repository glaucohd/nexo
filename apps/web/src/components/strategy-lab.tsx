"use client";

import { useState } from "react";

import type { LabReport, LabResult } from "@/lib/strategy-lab";

import styles from "./strategy-lab.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const percent = (value: number) => `${Math.round(value * 100)}%`;
const returnOf = (result: LabResult) => result.costCents ? result.prizeCents / result.costCents : 0;

// Joga cada estratégia nos últimos concursos (sem olhar o futuro) e mostra
// quanto de cada real apostado teria voltado.
export function StrategyLab({ slug, gameName }: { slug: string; gameName: string }) {
  const [contests, setContests] = useState<50 | 100 | 200>(100);
  const [tickets, setTickets] = useState(4);
  const [report, setReport] = useState<LabReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/estrategias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, contests, tickets }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível comparar.");
      setReport(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível comparar.");
    } finally { setLoading(false); }
  }

  const ranked = report ? [...report.results].sort((a, b) => returnOf(b) - returnOf(a)) : [];
  const best = ranked[0];
  const winners = ranked.filter((result) => returnOf(result) >= 1);
  // Folga à direita para o rótulo de valor caber depois da maior barra.
  const scaleMax = Math.max(1, ...ranked.map(returnOf)) * 1.15;

  return <section className={styles.lab}>
    <div className={styles.lead}>
      <div>
        <span className="eyebrow">Laboratório</span>
        <h2>Compare estratégias no passado</h2>
        <p>Cada estratégia &ldquo;joga&rdquo; nos últimos concursos da {gameName} como se fosse naquele dia: os jogos são gerados só com o histórico anterior e conferidos com o resultado e os prêmios reais.</p>
      </div>
    </div>

    <div className={styles.controls}>
      <div role="group" aria-label="Concursos" className={styles.segment}>
        <span>Concursos</span>
        {([50, 100, 200] as const).map((value) => <button type="button" key={value} aria-pressed={contests === value} onClick={() => setContests(value)}>{value}</button>)}
      </div>
      <div role="group" aria-label="Jogos por concurso" className={styles.segment}>
        <span>Jogos por concurso</span>
        {[2, 4, 6].map((value) => <button type="button" key={value} aria-pressed={tickets === value} onClick={() => setTickets(value)}>{value}</button>)}
      </div>
      <button type="button" className={styles.run} disabled={loading} onClick={run}>{loading ? "Calculando…" : report ? "Rodar de novo com outros jogos" : "Comparar estratégias"}</button>
    </div>
    {loading && <p className={styles.hint}>Gerando e conferindo os jogos de cada concurso; pode levar alguns segundos (a Lotomania é a mais demorada).</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}

    {report && best && <>
      <div className={styles.verdict}>
        <strong>{winners.length === 0
          ? `Nenhuma estratégia devolveu o que custou nos concursos ${report.firstContest} a ${report.lastContest}.`
          : `${winners.length === 1 ? "Uma estratégia passou" : `${winners.length} estratégias passaram`} de 100% nos concursos ${report.firstContest} a ${report.lastContest}.`}</strong>
        <p>{winners.length === 0
          ? `A que chegou mais perto, ${best.label.toLowerCase()}, devolveu ${percent(returnOf(best))} do que gastou.`
          : `Quase sempre isso vem de um prêmio isolado: repare em quantos concursos houve prêmio e rode de novo para ver se se repete.`} Cada rodada sorteia jogos novos, então o ranking muda; o que se mantém é a ordem de grandeza.</p>
      </div>

      <figure className={styles.chart} aria-label="Retorno de cada estratégia: prêmios divididos pelo custo">
        <figcaption>Quanto voltou de cada R$ 100 apostados</figcaption>
        <div className={styles.rows}>
          {ranked.map((result) => {
            const value = returnOf(result);
            return <div className={styles.row} key={result.id} tabIndex={0}>
              <span className={styles.name}>{result.label}<small>{result.kind === "reducao" ? "Redução" : "Gerador"}</small></span>
              <span className={styles.track}>
                <i className={styles.bar} style={{ width: `${value / scaleMax * 100}%` }} />
                <b className={styles.value} style={{ left: `${value / scaleMax * 100}%` }}>{percent(value)}</b>
                <span className={styles.tip} role="tooltip">
                  <strong>{result.label}</strong>
                  <span>Custo {money.format(result.costCents / 100)} · prêmios {money.format(result.prizeCents / 100)}</span>
                  <span>Prêmio em {result.contestsWithPrize} de {report.contests} concursos · melhor jogo: {result.bestHits} acertos</span>
                </span>
              </span>
            </div>;
          })}
          <span className={styles.breakEven} style={{ left: `calc(var(--name-width) + (100% - var(--name-width)) * ${1 / scaleMax})` }} aria-hidden="true"><em>100% = empate</em></span>
        </div>
      </figure>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead><tr><th>Estratégia</th><th>Custo</th><th>Prêmios</th><th>Saldo</th><th>Retorno</th><th>Concursos com prêmio</th><th>Melhor jogo</th></tr></thead>
          <tbody>{ranked.map((result) => <tr key={result.id}>
            <th scope="row">{result.label}<small>{result.detail}</small></th>
            <td>{money.format(result.costCents / 100)}</td>
            <td>{money.format(result.prizeCents / 100)}</td>
            <td className={result.prizeCents >= result.costCents ? styles.positive : styles.negative}>{money.format((result.prizeCents - result.costCents) / 100)}</td>
            <td>{percent(returnOf(result))}</td>
            <td>{result.contestsWithPrize} de {report.contests}</td>
            <td>{result.bestHits} acertos</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className={styles.hint}>Prêmios pelos valores que a CAIXA pagou em cada concurso{ranked.some((result) => result.unavailablePrizeUnits > 0) ? "; alguns prêmios sem valor publicado ficaram de fora" : ""}. Nas reduções, o grupo de dezenas é sorteado a cada concurso.</p>
    </>}
  </section>;
}

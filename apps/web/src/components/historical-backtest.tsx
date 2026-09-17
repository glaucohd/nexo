"use client";

import { useEffect, useRef, useState } from "react";

import type { BacktestReport, BacktestTicket } from "@/lib/historical-backtest";
import type { LotterySlug } from "@/lib/lottery-generator";

import styles from "./historical-backtest.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR");
const formatMoney = (cents: number) => money.format(cents / 100);
const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

export function HistoricalBacktest({ slug, tickets }: { slug: LotterySlug; tickets: BacktestTicket[] }) {
  const [sample, setSample] = useState<200 | "all">(200);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!report) return;
    reportRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [report]);

  async function checkHistory() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/backtest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sample, tickets }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível conferir os jogos.");
      setReport(payload as BacktestReport);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "Não foi possível conferir os jogos.");
    } finally { setLoading(false); }
  }

  return <div className={styles.wrap}>
    <div className={styles.controls}>
      <div><strong>Como estes jogos teriam pontuado?</strong><small>Compare as mesmas cartelas com os resultados anteriores.</small></div>
      <label>Concursos<select value={sample} disabled={loading} onChange={(event) => { setSample(event.target.value === "all" ? "all" : 200); setReport(null); setError(null); }}><option value={200}>Últimos 200</option><option value="all">Toda a base</option></select></label>
      <button type="button" disabled={loading} onClick={checkHistory}>{loading ? "Conferindo…" : "Conferir jogos no histórico ↗"}</button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {report && <section ref={reportRef} className={styles.report} aria-live="polite">
      <div className={styles.heading}><span className="eyebrow">Conferência histórica</span><h3>{integer.format(report.ticketCount)} cartelas × {integer.format(report.contests)} concursos</h3><p>Concursos {report.firstContest} a {report.lastContest}. É uma conferência retrospectiva das cartelas atuais, não um teste de previsão fora da amostra.</p></div>
      <div className={styles.summary}>
        <div><span>Comparações</span><strong>{integer.format(report.ticketDrawComparisons)}</strong><small>cartela × concurso</small></div>
        <div><span>Concursos com prêmio</span><strong>{integer.format(report.contestsWithPrize)}</strong><small>ao menos uma cartela premiada</small></div>
        <div><span>Cartelas premiadas</span><strong>{integer.format(report.prizeDraws)}</strong><small>somadas nos concursos</small></div>
        <div><span>Prêmios publicados</span><strong>{formatMoney(report.knownGrossCents)}</strong><small>valor bruto, sem descontar apostas</small></div>
      </div>
      {report.unavailablePrizeUnits > 0 && <p className={styles.notice}>Há {integer.format(report.unavailablePrizeUnits)} premiação{report.unavailablePrizeUnits === 1 ? "" : "ões"} sem valor publicado no histórico. O total em dinheiro acima inclui apenas os valores conhecidos.</p>}
      {report.skippedContests > 0 && <p className={styles.notice}>{integer.format(report.skippedContests)} concurso{report.skippedContests === 1 ? "" : "s"} sem dados complementares foi ignorado.</p>}
      <div className={styles.distribution}><h4>Distribuição de acertos de todas as cartelas</h4><div>{report.distribution.map((entry) => <span key={entry.hits}><b>{entry.hits} {entry.hits === 1 ? "acerto" : "acertos"}</b><strong>{integer.format(entry.contests)}</strong></span>)}</div></div>
      <div className={styles.ticketGrid}>{report.tickets.map((ticket) => <article key={ticket.position} className={styles.ticket}>
        <div className={styles.ticketHeading}><h4>Jogo {ticket.position}</h4><strong>Melhor: {ticket.bestHits} {ticket.bestHits === 1 ? "acerto" : "acertos"}</strong></div>
        <div className={styles.ticketMetrics}><span>Média <b>{ticket.averageHits.toFixed(1).replace(".", ",")}</b></span><span>Premiou <b>{integer.format(ticket.prizeDraws)}×</b></span><span>Prêmios publicados <b>{formatMoney(ticket.knownGrossCents)}</b></span></div>
        {ticket.unavailablePrizeUnits > 0 && <small>{integer.format(ticket.unavailablePrizeUnits)} prêmio(s) sem valor publicado.</small>}
        <div className={styles.ticketDistribution}>{ticket.distribution.map((entry) => <span key={entry.hits}>{entry.hits} pts <b>{integer.format(entry.contests)}×</b></span>)}</div>
        <p>Melhores concursos: {ticket.bestContests.map((draw) => `#${draw.contest} (${formatDate(draw.date)}, ${draw.hits} pts)`).join(" · ") || "—"}</p>
      </article>)}</div>
      <p className={styles.method}>A simulação repete cada cartela em todos os concursos da amostra e usa os valores por faixa registrados na base. Em apostas com dezenas extras, considera as combinações simples contidas na cartela. Não desconta o custo das apostas; quando uma faixa ficou sem ganhadores, o valor hipotético não é estimado.</p>
    </section>}
  </div>;
}

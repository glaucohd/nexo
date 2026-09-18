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

export function HistoricalBacktest({ slug, tickets, availableContests, pricePerTicketCents }: { slug: LotterySlug; tickets: BacktestTicket[]; availableContests?: number; pricePerTicketCents?: number }) {
  const [sample, setSample] = useState<200 | "all">("all");
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
    {pricePerTicketCents !== undefined && <p className={styles.buyNow}>Custo de comprar {integer.format(tickets.length)} {tickets.length === 1 ? "jogo" : "jogos"} agora: <strong>{formatMoney(pricePerTicketCents * tickets.length)}</strong></p>}
    <div className={styles.controls}>
      <div><strong>Como estes jogos teriam pontuado?</strong><small>Por padrão, compare com todos os concursos importados desta modalidade.</small></div>
      <label>Concursos<select value={sample} disabled={loading} onChange={(event) => { setSample(event.target.value === "all" ? "all" : 200); setReport(null); setError(null); }}><option value="all">Todo o histórico{availableContests ? ` (${integer.format(availableContests)})` : ""}</option><option value={200}>Últimos 200</option></select></label>
      <button type="button" disabled={loading} onClick={checkHistory}>{loading ? "Conferindo…" : "Conferir jogos no histórico ↗"}</button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {report && <section ref={reportRef} className={styles.report} aria-live="polite">
      <div className={styles.heading}><span className="eyebrow">Conferência histórica</span><h3>{integer.format(report.ticketCount)} cartelas × {integer.format(report.contests)} concursos</h3><p>Concursos {report.firstContest} a {report.lastContest}. É uma conferência retrospectiva das cartelas atuais, não um teste de previsão fora da amostra.</p></div>
      {report.lotofacil && <div className={styles.lotofacilHits}><div><span>Concursos com 14+</span><strong>{integer.format(report.lotofacil.contestsWith14Plus)}</strong><small>ao menos uma cartela</small></div><div><span>Apostas simples de 14</span><strong>{integer.format(report.lotofacil.simple14Prizes)}</strong><small>inclui desdobramentos</small></div><div><span>Apostas simples de 15</span><strong>{integer.format(report.lotofacil.simple15Prizes)}</strong><small>em {integer.format(report.lotofacil.contestsWith15)} concursos</small></div></div>}
      <div className={styles.summary}>
        <div><span>Comparações</span><strong>{integer.format(report.ticketDrawComparisons)}</strong><small>cartela × concurso</small></div>
        <div><span>Concursos com prêmio</span><strong>{integer.format(report.contestsWithPrize)}</strong><small>ao menos uma cartela premiada</small></div>
        <div><span>Cartelas premiadas</span><strong>{integer.format(report.prizeDraws)}</strong><small>somadas nos concursos</small></div>
        <div><span>Prêmios publicados</span><strong>{formatMoney(report.knownGrossCents)}</strong><small>valor bruto, sem descontar apostas</small></div>
      </div>
      {pricePerTicketCents !== undefined && <div className={styles.simulation}>
        <strong>Simulação: e se você tivesse comprado esses mesmos jogos em todos os {integer.format(report.contests)} concursos?</strong>
        <div>
          <span>Gasto se repetisse sempre<b>{formatMoney(pricePerTicketCents * report.ticketCount * report.contests)}</b><small>{integer.format(report.ticketCount)} cartelas × {integer.format(report.contests)} concursos × {formatMoney(pricePerTicketCents)}</small></span>
          <span>Saldo se repetisse sempre<b>{formatMoney(report.knownGrossCents - pricePerTicketCents * report.ticketCount * report.contests)}</b><small>prêmios publicados − gasto acima</small></span>
        </div>
        <p>Não é uma previsão nem o custo de jogar hoje — é só um &ldquo;e se&rdquo; retrospectivo. Prêmios sem valor publicado no histórico não entram na conta.</p>
      </div>}
      {report.unavailablePrizeUnits > 0 && <p className={styles.notice}>Há {integer.format(report.unavailablePrizeUnits)} premiação{report.unavailablePrizeUnits === 1 ? "" : "ões"} sem valor publicado no histórico. O total em dinheiro acima inclui apenas os valores conhecidos.</p>}
      {report.skippedContests > 0 && <p className={styles.notice}>{integer.format(report.skippedContests)} concurso{report.skippedContests === 1 ? "" : "s"} sem dados complementares foi ignorado.</p>}
      <div className={styles.distribution}><h4>{report.lotofacil ? "Acertos por cartela × concurso" : "Distribuição de acertos de todas as cartelas"}</h4><div>{report.distribution.map((entry) => <span key={entry.hits}><b>{entry.hits} {entry.hits === 1 ? "acerto" : "acertos"}</b><strong>{integer.format(entry.contests)}</strong></span>)}</div></div>
      <div className={styles.rankingIntro}><h4>Ranking das cartelas</h4><small>Clique numa cartela para ver os detalhes.</small></div>
      <div className={styles.ranking}>
        <div className={styles.rankingHead} aria-hidden="true"><span>#</span><span>Cartela</span><span>Melhor</span><span>Média</span><span>Premiada</span><span>Prêmios</span><span /></div>
        {report.tickets.map((ticket, rank) => <details key={ticket.position} className={`${styles.rankRow} ${rank === 0 ? styles.rankLeader : ""}`}>
          <summary>
            <span className={styles.rankBadge}>{rank + 1}</span>
            <strong className={styles.rankName}>Jogo {ticket.position}</strong>
            <span className={styles.rankBest} data-label="Melhor"><b>{ticket.bestHits}</b> pts</span>
            <span data-label="Média">{ticket.averageHits.toFixed(1).replace(".", ",")}</span>
            <span data-label="Premiada">{integer.format(ticket.prizeDraws)}×</span>
            <span className={styles.rankMoney} data-label="Prêmios">{formatMoney(ticket.knownGrossCents)}</span>
            <i className={styles.chevron} aria-hidden="true" />
          </summary>
          <div className={styles.rankDetails}>
            <div><strong>{report.lotofacil ? "Concursos por acerto" : "Distribuição de pontos"}</strong><div className={styles.ticketDistribution}>{ticket.distribution.map((entry) => <span key={entry.hits}>{entry.hits} pts <b>{integer.format(entry.contests)}×</b></span>)}</div></div>
            <div><strong>Melhores concursos</strong><ul className={styles.bestList}>{ticket.bestContests.length ? ticket.bestContests.map((draw) => <li key={draw.contest}><span>#{draw.contest}</span><span>{formatDate(draw.date)}</span><b>{draw.hits} pts</b></li>) : <li>—</li>}</ul></div>
            {ticket.unavailablePrizeUnits > 0 && <small className={styles.unavailable}>{integer.format(ticket.unavailablePrizeUnits)} prêmio(s) sem valor publicado.</small>}
          </div>
        </details>)}
      </div>
      <p className={styles.method}>A simulação repete cada cartela em todos os concursos da amostra e usa os valores por faixa registrados na base. {slug === "super-sete" ? "Na Super Sete, cada marcação múltipla é desdobrada nas apostas simples de suas sete colunas; a distribuição mostra o melhor acerto possível por cartela em cada concurso." : "Em apostas com dezenas extras, considera as combinações simples contidas na cartela."} Não desconta o custo das apostas; quando uma faixa ficou sem ganhadores, o valor hipotético não é estimado.</p>
    </section>}
  </div>;
}

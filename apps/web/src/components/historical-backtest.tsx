"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { BacktestReport, BacktestTicket } from "@/lib/historical-backtest";
import type { LotterySlug } from "@/lib/lottery-generator";

import styles from "./historical-backtest.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR");
const formatMoney = (cents: number) => money.format(cents / 100);
const share = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
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
  const [allHits, setAllHits] = useState(false);

  // Pontuações que aconteceram, das maiores para as menores; por padrão só as 5 maiores.
  const hitRows = useMemo(() => report ? report.distribution.filter((entry) => entry.contests > 0).sort((left, right) => right.hits - left.hits) : [], [report]);
  const shownHits = allHits ? hitRows : hitRows.slice(0, 5);
  const maxHits = Math.max(1, ...shownHits.map((entry) => entry.contests));
  const best = useMemo(() => report ? [...report.tickets].sort((left, right) => right.bestHits - left.bestHits || left.position - right.position)[0] : null, [report]);
  const bestDraw = best?.bestContests[0];

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
      <div><strong>Como estes jogos teriam ido no passado?</strong><small>Compara cada jogo com os concursos que já foram sorteados.</small></div>
      <label>Concursos<select value={sample} disabled={loading} onChange={(event) => { setSample(event.target.value === "all" ? "all" : 200); setReport(null); setError(null); }}><option value="all">Todo o histórico{availableContests ? ` (${integer.format(availableContests)})` : ""}</option><option value={200}>Últimos 200</option></select></label>
      <button type="button" disabled={loading} onClick={checkHistory}>{loading ? "Conferindo…" : "Conferir no histórico ↗"}</button>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {report && <section ref={reportRef} className={styles.report} aria-live="polite">
      <div className={styles.heading}>
        <span className="eyebrow">Resultado da conferência</span>
        <h3>{report.contestsWithPrize > 0
          ? <>Algum jogo teria ganhado prêmio em <em>{integer.format(report.contestsWithPrize)} de {integer.format(report.contests)}</em> concursos ({share.format(report.contestsWithPrize / Math.max(1, report.contests))})</>
          : <>Nenhum jogo teria ganhado prêmio nesses {integer.format(report.contests)} concursos</>}</h3>
        <p>{integer.format(report.ticketCount)} {report.ticketCount === 1 ? "jogo comparado" : "jogos comparados"} com os concursos {report.firstContest} a {report.lastContest}. Olha só para o passado: não prevê o próximo sorteio.</p>
      </div>

      <div className={styles.summary}>
        <div><span>Melhor pontuação</span><strong>{best ? `${best.bestHits} pts` : "—"}</strong><small>{best && bestDraw ? `Jogo ${best.position}, no concurso #${bestDraw.contest} (${formatDate(bestDraw.date)})` : "nenhum acerto"}</small></div>
        <div><span>Concursos com prêmio</span><strong>{integer.format(report.contestsWithPrize)}</strong><small>de {integer.format(report.contests)} conferidos</small></div>
        {report.lotofacil && <div><span>Com 14 ou mais pontos</span><strong>{integer.format(report.lotofacil.contestsWith14Plus)}</strong><small>{report.lotofacil.contestsWith15 > 0 ? `${integer.format(report.lotofacil.contestsWith15)} com 15 pontos` : "concursos, em qualquer jogo"}</small></div>}
        <div><span>Prêmios somados</span><strong>{formatMoney(report.knownGrossCents)}</strong><small>valor bruto, sem descontar o que custou apostar</small></div>
      </div>
      {report.unavailablePrizeUnits > 0 && <p className={styles.notice}>Há {integer.format(report.unavailablePrizeUnits)} premiação{report.unavailablePrizeUnits === 1 ? "" : "ões"} sem valor publicado. O total em dinheiro inclui só os valores conhecidos.</p>}
      {report.skippedContests > 0 && <p className={styles.notice}>{integer.format(report.skippedContests)} concurso{report.skippedContests === 1 ? "" : "s"} sem dados completos {report.skippedContests === 1 ? "foi ignorado" : "foram ignorados"}.</p>}

      <div className={styles.distribution}>
        <div className={styles.blockHead}><h4>Quantas vezes cada pontuação apareceu</h4><small>Cada jogo em cada concurso conta uma vez.</small></div>
        <div className={styles.bars} role="list">{shownHits.map((entry) => <div role="listitem" key={entry.hits} className={styles.barRow}>
          <span className={styles.barName}>{entry.hits} {entry.hits === 1 ? "ponto" : "pontos"}</span>
          <span className={styles.barTrack}><i style={{ width: `${(entry.contests / maxHits) * 100}%` }} /></span>
          <span className={styles.barValue}>{integer.format(entry.contests)}×</span>
        </div>)}</div>
        {hitRows.length > 5 && <button type="button" className={styles.link} onClick={() => setAllHits((current) => !current)}>{allHits ? "Mostrar só as maiores" : `Mostrar todas (${hitRows.length})`}</button>}
      </div>

      <div className={styles.rankingIntro}><h4>Ranking dos jogos</h4><small>Toque num jogo para ver os detalhes.</small></div>
      <div className={styles.ranking}>
        <div className={styles.rankingHead} aria-hidden="true"><span>#</span><span>Jogo</span><span>Melhor</span><span>Premiado em</span><span>Prêmios</span><span /></div>
        {report.tickets.map((ticket, rank) => <details key={ticket.position} className={`${styles.rankRow} ${rank === 0 ? styles.rankLeader : ""}`}>
          <summary>
            <span className={styles.rankBadge}>{rank + 1}</span>
            <strong className={styles.rankName}>Jogo {ticket.position}</strong>
            <span className={styles.rankBest} data-label="Melhor"><b>{ticket.bestHits}</b> pts</span>
            <span data-label="Premiado em">{integer.format(ticket.prizeDraws)} {ticket.prizeDraws === 1 ? "concurso" : "concursos"}</span>
            <span className={styles.rankMoney} data-label="Prêmios">{formatMoney(ticket.knownGrossCents)}</span>
            <i className={styles.chevron} aria-hidden="true" />
          </summary>
          <div className={styles.rankDetails}>
            <div><strong>Pontuações deste jogo (média {ticket.averageHits.toFixed(1).replace(".", ",")} pts)</strong><div className={styles.ticketDistribution}>{ticket.distribution.filter((entry) => entry.contests > 0).map((entry) => <span key={entry.hits}>{entry.hits} pts <b>{integer.format(entry.contests)}×</b></span>)}</div></div>
            <div><strong>Melhores concursos</strong><ul className={styles.bestList}>{ticket.bestContests.length ? ticket.bestContests.map((draw) => <li key={draw.contest}><span>#{draw.contest}</span><span>{formatDate(draw.date)}</span><b>{draw.hits} pts</b></li>) : <li>—</li>}</ul></div>
            {ticket.unavailablePrizeUnits > 0 && <small className={styles.unavailable}>{integer.format(ticket.unavailablePrizeUnits)} prêmio(s) sem valor publicado.</small>}
          </div>
        </details>)}
      </div>

      {pricePerTicketCents !== undefined && <details className={styles.fold}>
        <summary>E se eu tivesse jogado sempre esses jogos?</summary>
        <div className={styles.simulation}>
          <div>
            <span>Gasto se repetisse em todos os concursos<b>{formatMoney(pricePerTicketCents * report.ticketCount * report.contests)}</b><small>{integer.format(report.ticketCount)} jogos × {integer.format(report.contests)} concursos × {formatMoney(pricePerTicketCents)}</small></span>
            <span>Saldo (prêmios − gasto)<b>{formatMoney(report.knownGrossCents - pricePerTicketCents * report.ticketCount * report.contests)}</b><small>só com prêmios de valor conhecido</small></span>
          </div>
          <p>É um &ldquo;e se&rdquo; sobre o passado. Não é previsão nem o custo de jogar hoje.</p>
        </div>
      </details>}

      <details className={styles.fold}>
        <summary>Como a conferência é calculada</summary>
        <p className={styles.method}>Cada jogo é comparado com cada concurso da amostra, e os prêmios usam os valores por faixa registrados na base. {slug === "super-sete" ? "Na Super Sete, cada marcação múltipla é desdobrada nas apostas simples das suas sete colunas, e a pontuação mostra o melhor acerto possível de cada jogo em cada concurso." : "Em apostas com dezenas extras, considera as combinações simples contidas no jogo."} Faixas que ficaram sem ganhadores não têm valor estimado. É uma conferência retrospectiva dos jogos atuais, e não um teste de previsão.{report.lotofacil ? ` Na Lotofácil, os desdobramentos rendem ${integer.format(report.lotofacil.simple14Prizes)} apostas simples de 14 pontos e ${integer.format(report.lotofacil.simple15Prizes)} de 15.` : ""}</p>
      </details>
    </section>}
  </div>;
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatDate, formatMoney, padNumber, pluralize } from "@/lib/format";
import { portfolioBestHits, reductionPoolPerformance, type SavedPortfolio } from "@/lib/saved-bets-groups";

import styles from "./bets-board.module.css";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Carteiras salvas antes da estratégia existir guardavam só "gerador" ou
// "reducao": nas reduções o detalhe está no nome ("Loteria · redução …").
function strategyLabel(portfolio: SavedPortfolio) {
  if (portfolio.mode === "reducao") {
    const detail = portfolio.name.split(" · ").slice(1).join(" · ");
    return detail ? detail.charAt(0).toUpperCase() + detail.slice(1) : "Redução";
  }
  if (portfolio.mode === "gerador") return "Gerador (critério não registrado)";
  return portfolio.mode;
}

function Chevron({ open }: { open: boolean }) {
  return <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>;
}

/** Uma carteira dentro do grupo do concurso: resumo em uma linha; toque para ver os jogos. */
export function PortfolioRow({ portfolio }: { portfolio: SavedPortfolio }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const { result } = portfolio;
  const drawnNumbers = new Set(portfolio.draws.flatMap((draw) => draw.numbers));
  const bestHits = portfolioBestHits(portfolio);
  const poolPerformance = reductionPoolPerformance(portfolio);
  const poolDrawnNumbers = new Set(poolPerformance ? portfolio.draws[poolPerformance.drawIndex]?.numbers ?? [] : []);
  const won = (result?.totalCents ?? 0) > 0;

  async function remove() {
    setDeleting(true);
    setFailed(false);
    const response = await fetch(`/api/apostas/${portfolio.id}`, { method: "DELETE" });
    if (response.ok) router.refresh();
    else { setDeleting(false); setConfirming(false); setFailed(true); }
  }

  return <div className={styles.row}>
    <button type="button" className={styles.rowHead} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className={styles.rowTitle}>
        <b>{portfolio.name}</b>
        <small>{pluralize(portfolio.tickets.length, "jogo", "jogos")} · {formatMoney(portfolio.costCents)} · salvo em {formatDate(portfolio.createdAt)}</small>
      </span>
      {result && <span className={`${styles.rowResult} ${won ? styles.rowWon : ""}`}>
        <b>{pluralize(bestHits, "acerto", "acertos")}</b>
        <small>{won ? formatMoney(result.totalCents) : "sem prêmio"}</small>
      </span>}
      <Chevron open={open} />
    </button>

    {open && <div className={styles.rowBody}>
      <p className={styles.strategy}><span>Estratégia</span>{strategyLabel(portfolio)}</p>
      {poolPerformance && <section className={styles.poolLine}>
        <div className={styles.poolLineHead}>
          <div><strong>Grupo escolhido</strong><span>{poolPerformance.numbers.length} dezenas</span></div>
          <p><b>{poolPerformance.hits}</b> de {poolPerformance.drawSize} sorteadas no grupo</p>
        </div>
        <div className={`${styles.balls} ${styles.poolBalls}`} aria-label={`Grupo escolhido: ${poolPerformance.numbers.join(", ")}. ${poolPerformance.hits} dezenas sorteadas destacadas.`}>
          {poolPerformance.numbers.map((number) => <b key={number} className={poolDrawnNumbers.has(number) ? styles.hit : ""}>{padNumber(number)}</b>)}
        </div>
        <div className={styles.poolLegend}>
          <span><i aria-hidden="true" />Dezenas sorteadas</span>
          {poolPerformance.missedDrawNumbers.length > 0
            ? <span>Fora do grupo: <b>{poolPerformance.missedDrawNumbers.map(padNumber).join(" · ")}</b></span>
            : <strong>Todas as sorteadas estavam no grupo</strong>}
          {portfolio.draws.length > 1 && <small>{poolPerformance.drawIndex + 1}º sorteio</small>}
        </div>
      </section>}
      <div className={styles.ticketHeading}>
        <div><span>Minhas apostas</span><strong>{pluralize(portfolio.tickets.length, "jogo", "jogos")}</strong></div>
        {result && <p>Melhor resultado: <b>{pluralize(bestHits, "acerto", "acertos")}</b></p>}
      </div>
      <ol className={styles.tickets}>
        {portfolio.tickets.map((ticket, index) => {
          const outcome = result?.tickets.find((entry) => entry.position === index + 1);
          const columns = Array.isArray(ticket.extras?.columns) ? ticket.extras.columns as number[][] : null;
          const trevos = Array.isArray(ticket.extras?.trevos) ? ticket.extras.trevos as number[] : null;
          const month = typeof ticket.extras?.month === "number" ? ticket.extras.month : null;
          const team = typeof ticket.extras?.team === "string" ? ticket.extras.team : null;
          return <li key={index} className={outcome && outcome.prizeDraws > 0 ? styles.winner : ""}>
            <span className={styles.ticketLabel}>Jogo {index + 1}</span>
            <div className={styles.balls}>
              {columns
                ? columns.map((column, position) => <span key={position} className={styles.column}>C{position + 1} {column.join("·")}</span>)
                : ticket.numbers.map((number) => <b key={number} className={drawnNumbers.has(number) ? styles.hit : ""}>{padNumber(number)}</b>)}
              {trevos && <span className={styles.extra}>trevos {trevos.join(" · ")}</span>}
              {month && <span className={styles.extra}>{months[month - 1]}</span>}
              {team && <span className={styles.extra}>Time: {team}</span>}
            </div>
            {outcome && <span className={styles.score}><b>{outcome.hits}</b> {outcome.hits === 1 ? "acerto" : "acertos"}{outcome.prizeCents > 0 ? <em>{formatMoney(outcome.prizeCents)}</em> : null}</span>}
          </li>;
        })}
      </ol>
      {result && result.unavailablePrizeUnits > 0 && <p className={styles.note}>{result.unavailablePrizeUnits} prêmio(s) sem valor publicado não entram na soma.</p>}
      {failed && <p className={styles.error} role="alert">Não foi possível excluir. Tente novamente.</p>}
      <div className={styles.rowActions}>
        {confirming
          ? <><button type="button" className={styles.danger} disabled={deleting} onClick={remove}>{deleting ? "Excluindo…" : "Confirmar exclusão"}</button><button type="button" onClick={() => setConfirming(false)}>Cancelar</button></>
          : <button type="button" className={styles.ghostDanger} onClick={() => setConfirming(true)}>Excluir carteira</button>}
      </div>
    </div>}
  </div>;
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

import { PortfolioRow } from "@/components/bets-portfolio-row";
import { formatDate, formatMoney, padNumber, pluralize } from "@/lib/format";
import type { ContestGroup } from "@/lib/saved-bets-groups";

import styles from "./bets-board.module.css";

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function DrawResult({ draws, total }: { draws: ContestGroup["draws"]; total: number }) {
  return <div className={styles.drawResult}>
    {draws.map((draw, index) => {
      const trevos = Array.isArray(draw.extras?.trevos) ? draw.extras.trevos.filter((value): value is number => typeof value === "number") : [];
      const month = typeof draw.extras?.mes === "number" ? monthNames[draw.extras.mes - 1] : null;
      return <div key={index} className={styles.drawLine}>
        <span className={styles.drawLabel}>{total > 1 ? `${index + 1}º sorteio` : "Resultado"} · {formatDate(draw.date)}</span>
        <div className={styles.balls}>
          {draw.numbers.map((number, position) => <b key={position} className={styles.drawBall}>{padNumber(number)}</b>)}
          {trevos.length > 0 && <span className={styles.extra}>trevos {trevos.join(" · ")}</span>}
          {month && <span className={styles.extra}>{month}</span>}
        </div>
      </div>;
    })}
  </div>;
}

/** Todas as carteiras de um concurso: o resultado aparece uma vez só e o balanço soma as carteiras. */
export function ContestGroupCard({ group, defaultOpen }: { group: ContestGroup; defaultOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [syncing, setSyncing] = useState(false);
  const [notYet, setNotYet] = useState<number | null>(null);
  const balance = group.prizeCents - group.costCents;

  // Concurso fora da base: busca na CAIXA e recarrega; se já saiu, a página volta com o resultado.
  async function fetchResult() {
    setSyncing(true);
    try {
      await fetch("/api/sync-caixa", { method: "POST" });
      setNotYet(group.latest);
      router.refresh();
    } finally { setSyncing(false); }
  }

  return <article className={styles.group} style={{ "--game": group.color } as CSSProperties}>
    <button type="button" className={styles.groupHead} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className={styles.groupTitle}>
        <span className={styles.gameTag}><i aria-hidden="true" />{group.gameName}</span>
        <strong>Concurso #{group.target}</strong>
      </span>
      <span className={`${styles.status} ${group.drawn ? styles.statusDrawn : ""}`}>{group.drawn ? `Sorteado · ${formatDate(group.draws[0].date)}` : "Aguardando sorteio"}</span>
      <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
    </button>

    {group.drawn && <DrawResult draws={group.draws} total={group.draws.length} />}

    <dl className={styles.stats}>
      <div><dt>Carteiras</dt><dd>{group.portfolios.length}</dd></div>
      <div><dt>Jogos</dt><dd>{group.ticketCount}</dd></div>
      <div><dt>Custaria</dt><dd>{formatMoney(group.costCents)}</dd></div>
      {group.drawn && <>
        <div><dt>Melhor jogo</dt><dd>{pluralize(group.bestHits, "acerto", "acertos")}</dd></div>
        <div><dt>Prêmio</dt><dd>{group.prizeCents > 0 ? formatMoney(group.prizeCents) : "—"}</dd></div>
        <div><dt>Saldo</dt><dd className={balance >= 0 ? styles.positive : styles.negative}>{formatMoney(balance)}</dd></div>
      </>}
    </dl>

    {!group.drawn && <div className={styles.waitBar}>
      <p>{notYet !== null && !syncing ? `Ainda não saiu: o último resultado disponível é o #${notYet}.` : "O resultado aparece aqui sozinho assim que o concurso entrar na base."}</p>
      <button type="button" disabled={syncing} onClick={fetchResult}>{syncing ? "Buscando…" : "Buscar resultado"}</button>
    </div>}

    {open && <div className={styles.portfolios}>
      {group.portfolios.map((portfolio) => <PortfolioRow key={portfolio.id} portfolio={portfolio} />)}
    </div>}
  </article>;
}

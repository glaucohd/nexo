"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

import { standardTicketCost, standardTicketPriceCents, type LotterySlug } from "@/lib/lottery-generator";
import { superSeteCombinations } from "@/lib/super-sete";

import styles from "./bets-board.module.css";

export type SavedPortfolio = {
  id: string;
  name: string;
  mode: string;
  slug: LotterySlug;
  gameName: string;
  color: string;
  target: number;
  drawn: boolean;
  createdAt: string;
  tickets: { numbers: number[]; extras: Record<string, unknown> | null }[];
};

type CheckResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "pending"; target: number; latest: number }
  | { status: "done"; target: number; draws: { date: string; numbers: number[] }[]; totalCents: number; unavailablePrizeUnits: number; tickets: { position: number; hits: number; prizeCents: number; prizeDraws: number }[] };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pad = (number: number) => String(number).padStart(2, "0");
const formatDate = (iso: string) => { const [year, month, day] = iso.slice(0, 10).split("-"); return `${day}/${month}/${year}`; };
const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function ticketCostCents(slug: LotterySlug, ticket: SavedPortfolio["tickets"][number]) {
  if (slug === "super-sete") {
    const columns = Array.isArray(ticket.extras?.columns) ? ticket.extras.columns as number[][] : [];
    return columns.length === 7 ? superSeteCombinations({ columns }) * standardTicketPriceCents["super-sete"] : 0;
  }
  return standardTicketCost(slug, ticket.numbers.length, 1);
}

const portfolioCost = (portfolio: SavedPortfolio) => portfolio.tickets.reduce((sum, ticket) => sum + ticketCostCents(portfolio.slug, ticket), 0);

type Filter = "all" | "waiting" | "drawn";

export function BetsBoard({ portfolios }: { portfolios: SavedPortfolio[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [game, setGame] = useState<LotterySlug | "all">("all");
  const games = [...new Map(portfolios.map((portfolio) => [portfolio.slug, portfolio])).values()];
  const visible = portfolios.filter((portfolio) => (game === "all" || portfolio.slug === game)
    && (filter === "all" || (filter === "drawn") === portfolio.drawn));
  const waiting = visible.filter((portfolio) => !portfolio.drawn);
  const drawn = visible.filter((portfolio) => portfolio.drawn);
  const totalCost = portfolios.reduce((sum, portfolio) => sum + portfolioCost(portfolio), 0);

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <span className="eyebrow">Minhas apostas</span>
        <h1>Seus jogos <em>salvos</em>.</h1>
        <p>Cada carteira fica guardada para o concurso seguinte ao dia em que foi salva. Depois do sorteio, use &ldquo;Conferir&rdquo; para ver os acertos daquele concurso.</p>
      </div>
      <Link className="button button-primary" href="/app/gerador">Gerar novos jogos <span aria-hidden="true">→</span></Link>
    </header>

    {portfolios.length === 0 ? <section className={styles.empty}>
      <h2>Nenhum jogo salvo ainda.</h2>
      <p>Gere jogos ou uma redução e toque em &ldquo;Salvar jogos&rdquo;. Eles aparecem aqui, prontos para conferir depois do sorteio.</p>
      <Link className="button button-primary" href="/app/gerador">Ir para o gerador <span aria-hidden="true">→</span></Link>
    </section> : <>
      <div className={styles.summary}>
        <div><span>Carteiras</span><strong>{portfolios.length}</strong></div>
        <div><span>Aguardando sorteio</span><strong>{portfolios.filter((portfolio) => !portfolio.drawn).length}</strong></div>
        <div><span>Prontas para conferir</span><strong>{portfolios.filter((portfolio) => portfolio.drawn).length}</strong></div>
        <div><span>Custo das apostas</span><strong>{money.format(totalCost / 100)}</strong></div>
      </div>

      <div className={styles.filters}>
        <div className={styles.statusTabs} role="group" aria-label="Situação">
          {([["all", "Todas"], ["waiting", "Aguardando sorteio"], ["drawn", "Já sorteadas"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        {games.length > 1 && <div className={styles.gameChips} role="group" aria-label="Modalidade">
          <button type="button" aria-pressed={game === "all"} onClick={() => setGame("all")}>Todas as loterias</button>
          {games.map((entry) => <button type="button" key={entry.slug} aria-pressed={game === entry.slug} style={{ "--chip": entry.color } as CSSProperties} onClick={() => setGame(entry.slug)}><i aria-hidden="true" />{entry.gameName}</button>)}
        </div>}
      </div>

      {drawn.length > 0 && <section className={styles.group}>
        <h2>Já sorteadas <small>{drawn.length}</small></h2>
        {drawn.map((portfolio) => <PortfolioCard key={portfolio.id} portfolio={portfolio} />)}
      </section>}
      {waiting.length > 0 && <section className={styles.group}>
        <h2>Aguardando sorteio <small>{waiting.length}</small></h2>
        {waiting.map((portfolio) => <PortfolioCard key={portfolio.id} portfolio={portfolio} />)}
      </section>}
      {visible.length === 0 && <p className={styles.nothing}>Nenhuma carteira com esses filtros.</p>}
    </>}
  </main>;
}

function PortfolioCard({ portfolio }: { portfolio: SavedPortfolio }) {
  const router = useRouter();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [open, setOpen] = useState(portfolio.tickets.length <= 4);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const done = result?.status === "done" ? result : null;
  const drawnNumbers = new Set(done?.draws.flatMap((draw) => draw.numbers) ?? []);

  async function check() {
    setResult({ status: "loading" });
    setOpen(true);
    try {
      const response = await fetch(`/api/apostas/${portfolio.id}/conferir`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível conferir.");
      setResult(payload);
    } catch (cause) {
      setResult({ status: "error", message: cause instanceof Error ? cause.message : "Não foi possível conferir." });
    }
  }

  async function syncAndCheck() {
    setSyncing(true);
    try {
      await fetch("/api/sync-caixa", { method: "POST" });
      router.refresh();
      await check();
    } finally { setSyncing(false); }
  }

  async function remove() {
    setDeleting(true);
    const response = await fetch(`/api/apostas/${portfolio.id}`, { method: "DELETE" });
    if (response.ok) router.refresh();
    else { setDeleting(false); setConfirming(false); }
  }

  return <article className={styles.card} style={{ "--game": portfolio.color } as CSSProperties}>
    <div className={styles.cardTop}>
      <div className={styles.cardTitle}>
        <span className={styles.gameTag}><i aria-hidden="true" />{portfolio.gameName}</span>
        <h3>{portfolio.name}</h3>
        <small>Concurso <b>#{portfolio.target}</b> · salvo em {formatDate(portfolio.createdAt)} · {portfolio.tickets.length} {portfolio.tickets.length === 1 ? "jogo" : "jogos"} · {money.format(portfolioCost(portfolio) / 100)}</small>
      </div>
      <span className={`${styles.status} ${portfolio.drawn ? styles.statusDrawn : ""}`}>{portfolio.drawn ? "Sorteado" : "Aguardando sorteio"}</span>
    </div>

    <div className={styles.actions}>
      <button type="button" className={styles.primary} disabled={result?.status === "loading"} onClick={check}>{result?.status === "loading" ? "Conferindo…" : "Conferir jogos"}</button>
      <button type="button" onClick={() => setOpen((current) => !current)}>{open ? "Esconder jogos" : "Ver jogos"}</button>
      {confirming
        ? <><button type="button" className={styles.danger} disabled={deleting} onClick={remove}>{deleting ? "Excluindo…" : "Confirmar exclusão"}</button><button type="button" onClick={() => setConfirming(false)}>Cancelar</button></>
        : <button type="button" className={styles.ghostDanger} onClick={() => setConfirming(true)}>Excluir</button>}
    </div>

    {result?.status === "error" && <p className={styles.error} role="alert">{result.message}</p>}
    {result?.status === "pending" && <div className={styles.pending}>
      <p>O resultado do concurso <b>#{result.target}</b> ainda não está na base (último registrado: #{result.latest}). Se o sorteio já aconteceu, atualize a base.</p>
      <button type="button" disabled={syncing} onClick={syncAndCheck}>{syncing ? "Atualizando…" : "Atualizar base e conferir"}</button>
    </div>}
    {done && <div className={styles.outcome}>
      <div className={styles.outcomeDraws}>
        {done.draws.map((draw, index) => <div key={index}>
          <span>{done.draws.length > 1 ? `${index + 1}º sorteio · ` : ""}Concurso #{done.target} · {formatDate(draw.date)}</span>
          <div className={styles.balls}>{draw.numbers.map((number, position) => <b key={position} className={styles.drawBall}>{pad(number)}</b>)}</div>
        </div>)}
      </div>
      <div className={styles.outcomeTotal}>
        <span>Prêmio nesta carteira</span>
        <strong>{done.totalCents > 0 ? money.format(done.totalCents / 100) : "Sem prêmio"}</strong>
        <small>Melhor jogo: {Math.max(...done.tickets.map((ticket) => ticket.hits))} acertos{done.unavailablePrizeUnits > 0 ? ` · ${done.unavailablePrizeUnits} prêmio(s) sem valor publicado` : ""}</small>
      </div>
    </div>}

    {open && <ol className={styles.tickets}>
      {portfolio.tickets.map((ticket, index) => {
        const outcome = done?.tickets.find((entry) => entry.position === index + 1);
        const columns = Array.isArray(ticket.extras?.columns) ? ticket.extras.columns as number[][] : null;
        const trevos = Array.isArray(ticket.extras?.trevos) ? ticket.extras.trevos as number[] : null;
        const month = typeof ticket.extras?.month === "number" ? ticket.extras.month : null;
        return <li key={index} className={outcome && outcome.prizeDraws > 0 ? styles.winner : ""}>
          <span className={styles.ticketLabel}>Jogo {index + 1}</span>
          <div className={styles.balls}>
            {columns
              ? columns.map((column, position) => <span key={position} className={styles.column}>C{position + 1} {column.join("·")}</span>)
              : ticket.numbers.map((number) => <b key={number} className={drawnNumbers.has(number) ? styles.hit : ""}>{pad(number)}</b>)}
            {trevos && <span className={styles.extra}>trevos {trevos.join(" · ")}</span>}
            {month && <span className={styles.extra}>{months[month - 1]}</span>}
          </div>
          {outcome && <span className={styles.score}><b>{outcome.hits}</b> {outcome.hits === 1 ? "acerto" : "acertos"}{outcome.prizeCents > 0 ? <em>{money.format(outcome.prizeCents / 100)}</em> : null}</span>}
        </li>;
      })}
    </ol>}
  </article>;
}

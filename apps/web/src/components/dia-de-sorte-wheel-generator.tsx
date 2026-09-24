"use client";

import { useEffect, useRef, useState } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { GuaranteeSummary } from "@/components/reduction-guide";
import { SaveBetsButton } from "@/components/save-bets-button";
import { coordinatedSelections } from "@/lib/coordinated-pools";
import { buildProfile } from "@/lib/hot-cold-profile";
import { lotteryGames, type DrawNumbers } from "@/lib/lottery-generator";
import { diaDeSorteWheel, type DiaDeSorteWheelTicket } from "@/lib/dia-de-sorte-wheel";

import { reductionGuarantees } from "@/lib/reduction-stats";

import styles from "./dia-de-sorte-wheel-generator.module.css";

const pad = (number: number) => String(number).padStart(2, "0");
const board = Array.from({ length: 31 }, (_, index) => index + 1);
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
// Aposta simples de 7 dezenas; confira o valor atualizado na CAIXA.
const TICKET_PRICE_CENTS = 250;

function MiniVolante({ numbers }: { numbers: readonly number[] }) {
  const marked = new Set(numbers);
  return <div className={styles.miniVolante} role="img" aria-label={`Volante: ${numbers.map(pad).join(", ")}`}>
    {board.map((number) => <span key={number} className={marked.has(number) ? styles.miniMarked : ""}>{marked.has(number) ? pad(number) : ""}</span>)}
  </div>;
}

function shuffled<T>(values: readonly T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

type Mode = { id: "any5"; guarantee: 5; title: string };
type Round = { id: number; pool: number[]; month: number; mode: Mode; tickets: DiaDeSorteWheelTicket[]; copied: boolean; coordinated?: boolean };

const mode: Mode = { id: "any5", guarantee: 5, title: "Garantir 5 pontos" };
const option = { pool: 8, games: 6 } as const;

const guaranteeRows = (mode: Mode, pool: number) => reductionGuarantees[`dia-de-sorte:${mode.id}-${pool}`] ?? [{ inPool: 7, hits: mode.guarantee }];

export function DiaDeSorteWheelGenerator({ history }: { history: DrawNumbers[] }) {
  const poolSize = option.pool;
  const [pool, setPool] = useState<number[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const poolSet = new Set(pool);

  useEffect(() => {
    if (rounds.length) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [rounds.length]);

  function toggle(number: number) {
    if (poolSet.has(number)) { setPool((current) => current.filter((entry) => entry !== number)); setError(null); return; }
    if (pool.length >= poolSize) { setError(`Você já escolheu ${poolSize} dezenas. Remova uma antes de trocar.`); return; }
    setPool((current) => [...current, number]);
    setError(null);
  }

  function fillFromLastDraw() {
    const latest = history[0];
    if (!latest) { setError("Ainda não há concursos no histórico para usar esta opção."); return; }
    const rest = shuffled(board.filter((number) => !latest.numbers.includes(number)));
    setPool([...latest.numbers, ...rest.slice(0, poolSize - latest.numbers.length)].sort((a, b) => a - b));
    setError(null);
  }

  function fillRandom() {
    setPool(shuffled(board).slice(0, poolSize).sort((a, b) => a - b));
    setError(null);
  }

  async function generate() {
    setBusy(true);
    try {
      const tickets = diaDeSorteWheel(pool, mode.guarantee);
      setRounds((current) => [{ id: Date.now(), pool: [...pool].sort((a, b) => a - b), month, mode, tickets, copied: false }, ...current]);
      setPool([]);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível montar a redução.");
    } finally { setBusy(false); }
  }

  function generateCoordinated() {
    const profile = buildProfile(history, lotteryGames["dia-de-sorte"], 30);
    const pools = coordinatedSelections({ universe: board, size: poolSize, count: 3, strata: [profile.hot, profile.neutral, profile.cold] });
    const now = Date.now();
    setRounds(pools.map((roundPool, index) => {
      const roundMonth = (month + index - 1) % 12 + 1;
      return { id: now + index, pool: roundPool, month: roundMonth, mode, tickets: diaDeSorteWheel(roundPool, mode.guarantee), copied: false, coordinated: true };
    }));
    setPool([]);
    setError(null);
  }

  function removeRound(id: number) {
    setRounds((current) => current.filter((round) => round.id !== id));
  }

  async function copyRound(id: number) {
    const round = rounds.find((entry) => entry.id === id);
    if (!round) return;
    const content = round.tickets.map((ticket, index) => `Jogo ${index + 1}: ${ticket.numbers.map(pad).join(" ")} | Mês da Sorte: ${months[round.month - 1]}`).join("\n");
    try {
      await navigator.clipboard.writeText(content);
      setRounds((current) => current.map((entry) => entry.id === id ? { ...entry, copied: true } : entry));
    } catch { setError("Não foi possível copiar automaticamente."); }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span className="eyebrow">Fechamento</span><h1>Redução da <em>Dia de Sorte</em>.</h1><p>Escolha um pool de dezenas maior que os 7 sorteados. O Nexo monta jogos de 7 dezenas que garantem uma pontuação mínima quando o sorteio cai dentro do seu pool.</p></div>
      <span>{history.length} concursos na base</span>
    </header>
    <div className={styles.layout}>
      <div className={styles.controls}>
        <section className={styles.card}>
          <h2>01 · Fechamento recomendado</h2>
          <GuaranteeSummary pool={option.pool} games={option.games} costCents={option.games * TICKET_PRICE_CENTS} ticketSize={7} drawSize={7} total={31}
            rows={guaranteeRows(mode, option.pool)} hitName={(hits) => `${hits} pontos`} />
          <button className={styles.generate} type="button" onClick={generateCoordinated}>Preparar 3 reduções coordenadas · 18 jogos ↗</button>
          <p>Os três grupos cobrem 24 dezenas diferentes, equilibradas entre quentes, neutras e frias. Os meses também são alternados a partir do mês escolhido. Custo total estimado: <strong>{currency.format(3 * option.games * TICKET_PRICE_CENTS / 100)}</strong>.</p>
        </section>
        <section className={styles.card}>
          <h2>{rounds.length ? `Nova redução manual · escolha ${poolSize} dezenas` : `02 · Escolha as ${poolSize} dezenas do grupo`}</h2>
          <p>{pool.length}/{poolSize} escolhidas. Clique nas dezenas pra montar manualmente, ou use o preenchimento automático.</p>
          <div className={styles.autoFill}>
            <button type="button" disabled={!history.length} onClick={fillFromLastDraw}>Sortear com base no último concurso{history[0] ? ` (#${history[0].contest})` : ""}</button>
            <button type="button" onClick={fillRandom}>Sortear {poolSize} dezenas aleatórias</button>
            {pool.length > 0 && <button type="button" className={styles.clear} onClick={() => { setPool([]); setError(null); }}>Limpar seleção</button>}
          </div>
          <div className={styles.board}>{board.map((number) => <button type="button" key={number} aria-pressed={poolSet.has(number)} className={poolSet.has(number) ? styles.selected : ""} onClick={() => toggle(number)}>{pad(number)}</button>)}</div>
        </section>
        <section className={styles.card}>
          <h2>03 · Escolha o Mês da Sorte</h2>
          <p>O mês faz parte de cada aposta e também será conferido no histórico.</p>
          <label className={styles.field}>Mês da Sorte
            <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
          </label>
        </section>
        <button className={styles.generate} type="button" disabled={pool.length !== poolSize || busy} onClick={generate}>{busy ? "Montando…" : `Gerar os ${option.games} jogos ↗`}</button>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <aside className={styles.preview}>
        <span className="eyebrow">Pool atual</span>
        <h2>{pool.length} de {poolSize}</h2>
        <p>{pool.length === poolSize ? "Pronto para gerar." : `Faltam ${poolSize - pool.length} dezenas.`}</p>
        {rounds.length > 0 && <p>{rounds.length} {rounds.length === 1 ? "redução gerada" : "reduções geradas"} nesta sessão.</p>}
      </aside>
    </div>
    {rounds.length > 0 && <section ref={resultsRef} className={styles.roundList}>
      {rounds.map((round, position) => <section className={styles.results} key={round.id}>
        <div className={styles.resultHeading}>
          <div><span className="eyebrow">{round.coordinated ? `Carteira coordenada · grupo ${position + 1}` : `Redução ${rounds.length - position}`}</span><h2>{round.tickets.length} jogos · garante {round.mode.guarantee} pontos se {round.mode.guarantee} caírem no grupo · {months[round.month - 1]}</h2></div>
          <div className={styles.roundActions}>
            <SaveBetsButton slug="dia-de-sorte" strategy={`Redução ${round.pool.length} dezenas · ${round.mode.title}${round.coordinated ? " · carteira coordenada" : ""} · ${months[round.month - 1]}`} tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers, month: round.month }))} name={`Dia de Sorte · redução ${round.pool.length} dezenas · garante ${round.mode.guarantee}`} /><button type="button" onClick={() => copyRound(round.id)}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
            <button type="button" className={styles.remove} onClick={() => removeRound(round.id)}>Remover</button>
          </div>
        </div>
        <p className={styles.priceNote}>Aposta simples de 7 dezenas a {currency.format(TICKET_PRICE_CENTS / 100)} — confira o valor atualizado na <a href="https://loterias.caixa.gov.br/Paginas/Dia-de-Sorte.aspx" target="_blank" rel="noreferrer">CAIXA ↗</a>.</p>
        <p className={styles.priceNote}>Grupo: {round.pool.map(pad).join(" · ")} · Mês da Sorte: <strong>{months[round.month - 1]}</strong></p>
        <HistoricalBacktest key={`${JSON.stringify(round.tickets)}-${round.month}`} slug="dia-de-sorte" tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers, month: round.month }))} availableContests={history.length} pricePerTicketCents={TICKET_PRICE_CENTS} />
        <div className={styles.ticketGrid}>{round.tickets.map((ticket, index) => <article className={styles.ticket} key={index}>
          <div><strong>Jogo {index + 1}</strong></div>
          <MiniVolante numbers={ticket.numbers} />
          <p>{ticket.numbers.map(pad).join(" · ")}<br />Mês: {months[round.month - 1]}</p>
        </article>)}</div>
      </section>)}
    </section>}
  </main>;
}

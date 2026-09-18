"use client";

import { useEffect, useRef, useState } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { SaveBetsButton } from "@/components/save-bets-button";
import type { DrawNumbers } from "@/lib/lottery-generator";
import { diaDeSorteWheel, type DiaDeSorteWheelTicket } from "@/lib/dia-de-sorte-wheel";
import { diaDeSorteWheel14, diaDeSorteWheel20 } from "@/lib/partition-wheels";

import styles from "./dia-de-sorte-wheel-generator.module.css";

const pad = (number: number) => String(number).padStart(2, "0");
const board = Array.from({ length: 31 }, (_, index) => index + 1);
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
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

// Dois tipos de garantia:
// - "all": vale quando as 7 sorteadas caem todas no pool. Condição rara, mas
//   pede poucos jogos (fechamento por partição).
// - "any": vale quando ao menos `guarantee` das sorteadas caem no pool — bem
//   mais frequente, e por isso pede muito mais jogos (cobertura gulosa).
type Mode = { id: "all4" | "any4" | "any5"; guarantee: 4 | 5; condition: "all" | "any"; label: string; poolSizes: number[] };
type Round = { id: number; pool: number[]; mode: Mode; tickets: DiaDeSorteWheelTicket[]; copied: boolean };

const modes: Mode[] = [
  { id: "all4", guarantee: 4, condition: "all", label: "Garante 4 se as 7 caírem no pool · poucos jogos", poolSizes: [14, 20] },
  { id: "any4", guarantee: 4, condition: "any", label: "Garante 4 se 4 caírem no pool", poolSizes: [8, 9, 10, 11, 12, 13, 14] },
  { id: "any5", guarantee: 5, condition: "any", label: "Garante 5 se 5 caírem no pool", poolSizes: [8, 9, 10, 11, 12, 13] },
];

export function DiaDeSorteWheelGenerator({ history }: { history: DrawNumbers[] }) {
  const [mode, setMode] = useState<Mode>(modes[0]);
  const [poolSize, setPoolSize] = useState(modes[0].poolSizes[0]);
  const [pool, setPool] = useState<number[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const poolSet = new Set(pool);
  const poolSizes = mode.poolSizes;

  useEffect(() => {
    if (rounds.length) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [rounds.length]);

  function chooseMode(next: Mode) {
    setMode(next);
    if (!next.poolSizes.includes(poolSize)) setPoolSize(next.poolSizes[0]);
    setPool([]);
    setError(null);
  }

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
      const tickets = mode.condition === "all" ? (pool.length === 20 ? diaDeSorteWheel20(pool) : diaDeSorteWheel14(pool)) : diaDeSorteWheel(pool, mode.guarantee);
      setRounds((current) => [{ id: Date.now(), pool: [...pool].sort((a, b) => a - b), mode, tickets, copied: false }, ...current]);
      setPool([]);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível montar a redução.");
    } finally { setBusy(false); }
  }

  function removeRound(id: number) {
    setRounds((current) => current.filter((round) => round.id !== id));
  }

  async function copyRound(id: number) {
    const round = rounds.find((entry) => entry.id === id);
    if (!round) return;
    const content = round.tickets.map((ticket, index) => `Jogo ${index + 1}: ${ticket.numbers.map(pad).join(" ")}`).join("\n");
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
          <h2>01 · Nível de garantia e tamanho do pool</h2>
          <div className={styles.segment}>{modes.map((entry) => <button type="button" key={entry.id} aria-pressed={mode.id === entry.id} className={mode.id === entry.id ? styles.active : ""} onClick={() => chooseMode(entry)}>{entry.label}</button>)}</div>
          <label className={styles.field}>Dezenas no pool<select value={poolSize} onChange={(event) => { setPoolSize(Number(event.target.value)); setPool([]); setError(null); }}>{poolSizes.map((size) => <option key={size} value={size}>{size} dezenas{mode.condition === "all" ? ` · ${size === 20 ? 20 : 2} jogos · ${currency.format((size === 20 ? 20 : 2) * TICKET_PRICE_CENTS / 100)}` : ""}</option>)}</select></label>
        </section>
        <section className={styles.card}>
          <h2>{rounds.length ? `Redução ${rounds.length + 1} · escolha ${poolSize} dezenas` : `02 · Escolha ${poolSize} dezenas para o pool`}</h2>
          <p>{pool.length}/{poolSize} escolhidas. Clique nas dezenas pra montar manualmente, ou use o preenchimento automático.</p>
          <div className={styles.autoFill}>
            <button type="button" disabled={!history.length} onClick={fillFromLastDraw}>Sortear com base no último concurso{history[0] ? ` (#${history[0].contest})` : ""}</button>
            <button type="button" onClick={fillRandom}>Sortear {poolSize} dezenas aleatórias</button>
            {pool.length > 0 && <button type="button" className={styles.clear} onClick={() => { setPool([]); setError(null); }}>Limpar seleção</button>}
          </div>
          <div className={styles.board}>{board.map((number) => <button type="button" key={number} aria-pressed={poolSet.has(number)} className={poolSet.has(number) ? styles.selected : ""} onClick={() => toggle(number)}>{pad(number)}</button>)}</div>
        </section>
        <section className={styles.card}>
          <h2>Garantia matemática</h2>
          {mode.condition === "all"
            ? <p>Se as 7 dezenas sorteadas caírem todas dentro do seu pool de {poolSize}, ao menos 1 dos {poolSize === 20 ? "20 jogos" : "2 jogos"} vai bater no mínimo <strong>4 pontos</strong> — provado por força bruta, não estimativa. Isso acontece em cerca de 1 a cada {poolSize === 20 ? "34" : "766"} concursos; fora disso não há garantia, mas os jogos concorrem normalmente.</p>
            : <p>Se ao menos {mode.guarantee} das 7 dezenas sorteadas caírem no seu pool de {poolSize}, algum jogo contém essas {mode.guarantee} e bate no mínimo <strong>{mode.guarantee} pontos</strong>. A condição é bem mais frequente que &ldquo;as 7 no pool&rdquo;, por isso pede mais jogos. O algoritmo usa busca gulosa: reduz bastante frente à cobertura total, mas não é garantido ser o menor fechamento possível.</p>}
        </section>
        <button className={styles.generate} type="button" disabled={pool.length !== poolSize || busy} onClick={generate}>{busy ? "Montando…" : "Gerar jogos ↗"}</button>
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
          <div><span className="eyebrow">Redução {rounds.length - position}</span><h2>{round.tickets.length} jogos · garante {round.mode.guarantee} pontos {round.mode.condition === "all" ? "se as 7 caírem" : `se ${round.mode.guarantee} caírem`} · pool {round.pool.map(pad).join(", ")}</h2></div>
          <div className={styles.roundActions}>
            <SaveBetsButton slug="dia-de-sorte" mode="reducao" tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers }))} name={`Dia de Sorte · redução ${round.pool.length} dezenas · garante ${round.mode.guarantee}`} /><button type="button" onClick={() => copyRound(round.id)}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
            <button type="button" className={styles.remove} onClick={() => removeRound(round.id)}>Remover</button>
          </div>
        </div>
        <p className={styles.priceNote}>Aposta simples de 7 dezenas a {currency.format(TICKET_PRICE_CENTS / 100)} — confira o valor atualizado na <a href="https://loterias.caixa.gov.br/Paginas/Dia-de-Sorte.aspx" target="_blank" rel="noreferrer">CAIXA ↗</a>.</p>
        <HistoricalBacktest key={JSON.stringify(round.tickets)} slug="dia-de-sorte" tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers }))} availableContests={history.length} pricePerTicketCents={TICKET_PRICE_CENTS} />
        <div className={styles.ticketGrid}>{round.tickets.map((ticket, index) => <article className={styles.ticket} key={index}>
          <div><strong>Jogo {index + 1}</strong></div>
          <MiniVolante numbers={ticket.numbers} />
          <p>{ticket.numbers.map(pad).join(" · ")}</p>
        </article>)}</div>
      </section>)}
    </section>}
  </main>;
}

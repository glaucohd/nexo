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

// Três tipos de fechamento, cada um com as opções de tamanho de grupo.
// - "any": garante `guarantee` pontos quando ao menos `guarantee` das 7
//   sorteadas estão no grupo (cobertura gulosa; a condição é frequente).
// - "all": garante 4 pontos só quando as 7 caem no grupo (partição; poucos
//   jogos, condição rara).
// `games` é o tamanho que o algoritmo gera para cada grupo e `every` é, em
// média, de quantos em quantos concursos a condição acontece (hipergeométrica).
type PoolOption = { pool: number; games: number; every: number };
type Mode = { id: "any4" | "any5" | "all4"; guarantee: 4 | 5; condition: "all" | "any"; title: string; hint: string; options: PoolOption[] };
type Round = { id: number; pool: number[]; mode: Mode; tickets: DiaDeSorteWheelTicket[]; copied: boolean };

const modes: Mode[] = [
  { id: "any4", guarantee: 4, condition: "any", title: "Garantir 4 pontos", hint: "Vale quando 4 das 7 sorteadas estão no seu grupo.", options: [
    { pool: 8, games: 5, every: 18.9 }, { pool: 9, games: 6, every: 11.7 }, { pool: 10, games: 12, every: 7.8 }, { pool: 11, games: 18, every: 5.6 },
    { pool: 12, games: 27, every: 4.2 }, { pool: 13, games: 37, every: 3.2 }, { pool: 14, games: 51, every: 2.6 },
  ] },
  { id: "any5", guarantee: 5, condition: "any", title: "Garantir 5 pontos", hint: "Vale quando 5 das 7 sorteadas estão no seu grupo.", options: [
    { pool: 8, games: 6, every: 177.4 }, { pool: 9, games: 10, every: 84.9 }, { pool: 10, games: 23, every: 45.8 },
    { pool: 11, games: 38, every: 27 }, { pool: 12, games: 69, every: 17.1 }, { pool: 13, games: 110, every: 11.5 },
  ] },
  { id: "all4", guarantee: 4, condition: "all", title: "4 pontos · econômica", hint: "Poucos jogos, mas só vale quando as 7 sorteadas estão no seu grupo.", options: [
    { pool: 14, games: 2, every: 766.2 }, { pool: 20, games: 20, every: 33.9 },
  ] },
];

const integer = new Intl.NumberFormat("pt-BR");
const everyLabel = (every: number) => `1 a cada ${integer.format(Math.max(2, Math.round(every)))} concursos`;

export function DiaDeSorteWheelGenerator({ history }: { history: DrawNumbers[] }) {
  const [mode, setMode] = useState<Mode>(modes[0]);
  const [poolSize, setPoolSize] = useState(10);
  const [pool, setPool] = useState<number[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const poolSet = new Set(pool);
  const option = mode.options.find((entry) => entry.pool === poolSize) ?? mode.options[0];

  useEffect(() => {
    if (rounds.length) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [rounds.length]);

  function chooseMode(next: Mode) {
    setMode(next);
    if (!next.options.some((entry) => entry.pool === poolSize)) setPoolSize(next.options[Math.min(2, next.options.length - 1)].pool);
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
          <h2>01 · O que você quer garantir?</h2>
          <div className={styles.segment}>{modes.map((entry) => <button type="button" key={entry.id} aria-pressed={mode.id === entry.id} className={mode.id === entry.id ? styles.active : ""} onClick={() => chooseMode(entry)}><strong>{entry.title}</strong><small>{entry.hint}</small></button>)}</div>
          <h2 className={styles.stepTitle}>02 · Quantas dezenas no seu grupo?</h2>
          <div className={styles.poolOptions}>{mode.options.map((entry) => <button type="button" key={entry.pool} aria-pressed={option.pool === entry.pool} onClick={() => { setPoolSize(entry.pool); setPool([]); setError(null); }}>
            <strong>{entry.pool} dezenas</strong>
            <span>{entry.games} jogos · {currency.format(entry.games * TICKET_PRICE_CENTS / 100)}</span>
            <small>garantia vale ~{everyLabel(entry.every)}</small>
          </button>)}</div>
          <div className={styles.plainSummary}>
            <p>Você escolhe <b>{option.pool} dezenas</b>. O Nexo monta <b>{option.games} jogos de 7 dezenas</b> ({currency.format(option.games * TICKET_PRICE_CENTS / 100)}).</p>
            <p>{mode.condition === "all" ? <>Se <b>as 7 sorteadas</b> estiverem entre as suas {option.pool}</> : <>Se <b>pelo menos {mode.guarantee} das 7 sorteadas</b> estiverem entre as suas {option.pool}</>} — em média {everyLabel(option.every)} — <b>pelo menos um jogo faz {mode.guarantee} pontos</b>. Nos outros concursos não há garantia, mas os jogos concorrem normalmente.</p>
          </div>
        </section>
        <section className={styles.card}>
          <h2>{rounds.length ? `Redução ${rounds.length + 1} · escolha ${poolSize} dezenas` : `03 · Escolha as ${poolSize} dezenas do grupo`}</h2>
          <p>{pool.length}/{poolSize} escolhidas. Clique nas dezenas pra montar manualmente, ou use o preenchimento automático.</p>
          <div className={styles.autoFill}>
            <button type="button" disabled={!history.length} onClick={fillFromLastDraw}>Sortear com base no último concurso{history[0] ? ` (#${history[0].contest})` : ""}</button>
            <button type="button" onClick={fillRandom}>Sortear {poolSize} dezenas aleatórias</button>
            {pool.length > 0 && <button type="button" className={styles.clear} onClick={() => { setPool([]); setError(null); }}>Limpar seleção</button>}
          </div>
          <div className={styles.board}>{board.map((number) => <button type="button" key={number} aria-pressed={poolSet.has(number)} className={poolSet.has(number) ? styles.selected : ""} onClick={() => toggle(number)}>{pad(number)}</button>)}</div>
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

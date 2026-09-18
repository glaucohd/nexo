"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { GuaranteeSummary } from "@/components/reduction-guide";
import { SaveBetsButton } from "@/components/save-bets-button";
import type { DrawNumbers } from "@/lib/lottery-generator";
import { lotomaniaWheel70, type PartitionWheelTicket } from "@/lib/partition-wheels";

import { reductionGuarantees } from "@/lib/reduction-stats";

import styles from "./number-wheel-generator.module.css";

const pad = (number: number) => String(number).padStart(2, "0");
const board = Array.from({ length: 100 }, (_, index) => index);
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
// Aposta de 50 dezenas; confira o valor atualizado na CAIXA.
const TICKET_PRICE_CENTS = 300;
const EXCLUDE = 30;
const GAMES = 21;

function MiniVolante({ numbers }: { numbers: readonly number[] }) {
  const marked = new Set(numbers);
  return <div className={styles.miniVolante} style={{ "--mini-columns": 10 } as CSSProperties} role="img" aria-label={`Volante com ${numbers.length} dezenas`}>
    {board.map((number) => <span key={number} className={marked.has(number) ? styles.miniMarked : ""} />)}
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

type Round = { id: number; excluded: number[]; tickets: PartitionWheelTicket[]; copied: boolean };

export function LotomaniaWheelGenerator({ history }: { history: DrawNumbers[] }) {
  const [excluded, setExcluded] = useState<number[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const excludedSet = new Set(excluded);

  useEffect(() => {
    if (rounds.length) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [rounds.length]);

  function toggle(number: number) {
    if (excludedSet.has(number)) { setExcluded((current) => current.filter((entry) => entry !== number)); setError(null); return; }
    if (excluded.length >= EXCLUDE) { setError(`Você já escolheu ${EXCLUDE} dezenas para excluir. Remova uma antes de trocar.`); return; }
    setExcluded((current) => [...current, number]);
    setError(null);
  }

  // As 20 do último concurso ficam de fora, mais 10 aleatórias.
  function fillFromLastDraw() {
    const latest = history[0];
    if (!latest) { setError("Ainda não há concursos no histórico para usar esta opção."); return; }
    const rest = shuffled(board.filter((number) => !latest.numbers.includes(number)));
    setExcluded([...latest.numbers, ...rest].slice(0, EXCLUDE).sort((a, b) => a - b));
    setError(null);
  }

  function fillRandom() {
    setExcluded(shuffled(board).slice(0, EXCLUDE).sort((a, b) => a - b));
    setError(null);
  }

  function generate() {
    try {
      const tickets = lotomaniaWheel70(board.filter((number) => !excludedSet.has(number)));
      setRounds((current) => [{ id: Date.now(), excluded: [...excluded].sort((a, b) => a - b), tickets, copied: false }, ...current]);
      setExcluded([]);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível montar a redução.");
    }
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
      <div><span className="eyebrow">Fechamento</span><h1>Redução de <em>70 dezenas</em>.</h1><p>Escolha 30 dezenas para deixar de fora. As 70 restantes viram 7 grupos de 10, e cada um dos 21 jogos de 50 dezenas deixa 2 grupos de fora.</p></div>
      <span>{history.length} concursos na base</span>
    </header>
    <div className={styles.layout}>
      <div className={styles.controls}>
        <section className={styles.card}>
          <h2>{rounds.length ? `Redução ${rounds.length + 1} · escolha ${EXCLUDE} dezenas` : `01 · Escolha ${EXCLUDE} dezenas para excluir`}</h2>
          <p>{excluded.length}/{EXCLUDE} escolhidas. As demais {100 - excluded.length} entram na redução. Clique nas dezenas pra montar manualmente, ou use o preenchimento automático.</p>
          <div className={styles.autoFill}>
            <button type="button" disabled={!history.length} onClick={fillFromLastDraw}>Excluir as 20 do último concurso{history[0] ? ` (#${history[0].contest})` : ""} + 10 aleatórias</button>
            <button type="button" onClick={fillRandom}>Excluir {EXCLUDE} aleatórias</button>
            {excluded.length > 0 && <button type="button" className={styles.clear} onClick={() => { setExcluded([]); setError(null); }}>Limpar seleção</button>}
          </div>
          <div className={styles.board} style={{ "--columns": 10 } as CSSProperties}>{board.map((number) => <button type="button" key={number} aria-pressed={excludedSet.has(number)} className={excludedSet.has(number) ? styles.excluded : ""} onClick={() => toggle(number)}>{pad(number)}</button>)}</div>
        </section>
        <section className={styles.card}>
          <h2>O que fica garantido</h2>
          <GuaranteeSummary pool={70} games={GAMES} costCents={GAMES * TICKET_PRICE_CENTS} ticketSize={50} drawSize={20} total={100}
            rows={reductionGuarantees["lotomania:70"]} hitName={(hits) => `${hits} pontos`}
            note="As 70 viram 7 grupos de 10 e cada jogo deixa 2 grupos de fora: os 2 grupos com menos sorteadas somam no máximo 5 delas, então algum jogo faz 15 ou mais. Garantia provada por força bruta; fora da condição os jogos concorrem normalmente." />
        </section>
        <button className={styles.generate} type="button" disabled={excluded.length !== EXCLUDE} onClick={generate}>Gerar os {GAMES} jogos ↗</button>
        <p className={styles.priceNote}>Custo estimado: <strong>{currency.format(GAMES * TICKET_PRICE_CENTS / 100)}</strong> ({GAMES} × {currency.format(TICKET_PRICE_CENTS / 100)} a aposta de 50 dezenas). Confira o valor atualizado na <a href="https://loterias.caixa.gov.br/Paginas/Lotomania.aspx" target="_blank" rel="noreferrer">CAIXA ↗</a>.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <aside className={styles.preview}>
        <span className="eyebrow">Dezenas no pool</span>
        <h2>{100 - excluded.length} de 100</h2>
        <p>{excluded.length === EXCLUDE ? "Pronto para gerar." : `Faltam ${EXCLUDE - excluded.length} exclusões para fechar em 70.`}</p>
        {rounds.length > 0 && <p>{rounds.length} {rounds.length === 1 ? "redução gerada" : "reduções geradas"} nesta sessão.</p>}
      </aside>
    </div>
    {rounds.length > 0 && <section ref={resultsRef} className={styles.roundList}>
      {rounds.map((round, position) => <section className={styles.results} key={round.id}>
        <div className={styles.resultHeading}>
          <div><span className="eyebrow">Redução {rounds.length - position}</span><h2>{round.tickets.length} jogos · garante 15 pontos se as 20 caírem nas suas 70</h2></div>
          <div className={styles.roundActions}>
            <SaveBetsButton slug="lotomania" strategy="Redução 70 dezenas · 21 jogos · garante 15 pontos" tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers }))} name="Lotomania · redução 70 dezenas · garante 15" /><button type="button" onClick={() => copyRound(round.id)}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
            <button type="button" className={styles.remove} onClick={() => setRounds((current) => current.filter((entry) => entry.id !== round.id))}>Remover</button>
          </div>
        </div>
        <p className={styles.priceNote}>Excluídas: {round.excluded.map(pad).join(" · ")}</p>
        <HistoricalBacktest key={JSON.stringify(round.tickets)} slug="lotomania" tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers }))} availableContests={history.length} pricePerTicketCents={TICKET_PRICE_CENTS} />
        <div className={styles.ticketGrid}>{round.tickets.map((ticket, index) => <article className={styles.ticket} key={index}>
          <div><strong>Jogo {index + 1}</strong><small>50 dezenas</small></div>
          <MiniVolante numbers={ticket.numbers} />
          <p>{ticket.numbers.map(pad).join(" ")}</p>
        </article>)}</div>
      </section>)}
    </section>}
  </main>;
}

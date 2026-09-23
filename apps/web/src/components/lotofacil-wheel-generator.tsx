"use client";

import { useEffect, useRef, useState } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { GuaranteeSummary } from "@/components/reduction-guide";
import { SaveBetsButton } from "@/components/save-bets-button";
import type { DrawNumbers } from "@/lib/lottery-generator";
import { lotofacilWheel, type LotofacilWheelTicket } from "@/lib/lotofacil-wheel";

import { reductionGuarantees } from "@/lib/reduction-stats";

import styles from "./lotofacil-wheel-generator.module.css";

const pad = (number: number) => String(number).padStart(2, "0");
const board = Array.from({ length: 25 }, (_, index) => index + 1);
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function MiniVolante({ numbers }: { numbers: readonly number[] }) {
  const marked = new Set(numbers);
  return <div className={styles.miniVolante} role="img" aria-label={`Volante: ${numbers.map(pad).join(", ")}`}>
    {board.map((number) => <span key={number} className={marked.has(number) ? styles.miniMarked : ""}>{marked.has(number) ? pad(number) : ""}</span>)}
  </div>;
}
// Aposta simples de 15 dezenas; confira o valor atualizado na CAIXA.
const TICKET_PRICE_CENTS = 300;

function shuffled<T>(values: readonly T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

type Tier = { id: "18x13"; pool: 18; guarantee: number; games: number; build: (available: readonly number[]) => LotofacilWheelTicket[] };
type Round = { id: number; excluded: number[]; tickets: LotofacilWheelTicket[]; copied: boolean; tier: Tier };

const tier: Tier = { id: "18x13", pool: 18, guarantee: 13, games: 6, build: lotofacilWheel };

export function LotofacilWheelGenerator({ history }: { history: DrawNumbers[] }) {
  const [excluded, setExcluded] = useState<number[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const excludedSet = new Set(excluded);
  const available = board.filter((number) => !excludedSet.has(number));
  const excludeCount = 25 - tier.pool;

  useEffect(() => {
    if (rounds.length) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [rounds.length]);

  function toggle(number: number) {
    if (excludedSet.has(number)) { setExcluded((current) => current.filter((entry) => entry !== number)); setError(null); return; }
    if (excluded.length >= excludeCount) { setError(`Você já escolheu ${excludeCount} dezenas para excluir. Remova uma antes de trocar.`); return; }
    setExcluded((current) => [...current, number]);
    setError(null);
  }

  function fillFromLastDraw() {
    const latest = history[0];
    if (!latest) { setError("Ainda não há concursos no histórico para usar esta opção."); return; }
    setExcluded(shuffled(latest.numbers).slice(0, excludeCount).sort((a, b) => a - b));
    setError(null);
  }

  function fillRandom() {
    setExcluded(shuffled(board).slice(0, excludeCount).sort((a, b) => a - b));
    setError(null);
  }

  function generate() {
    try {
      const tickets = tier.build(available);
      setRounds((current) => [{ id: Date.now(), excluded: [...excluded].sort((a, b) => a - b), tickets, copied: false, tier }, ...current]);
      setExcluded([]);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível montar a redução.");
    }
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
      <div><span className="eyebrow">Fechamento</span><h1>Redução de <em>{tier.pool} dezenas</em>.</h1><p>Exclua {excludeCount} dezenas e as {tier.pool} restantes viram jogos de 15. A tabela abaixo mostra exatamente o que fica garantido e com que frequência. Gere quantas reduções quiser, cada uma com suas próprias exclusões.</p></div>
      <span>{history.length} concursos na base</span>
    </header>
    <div className={styles.layout}>
      <div className={styles.controls}>
        <section className={styles.card}>
          <h2>01 · Fechamento recomendado</h2>
          <GuaranteeSummary pool={tier.pool} games={tier.games} costCents={tier.games * TICKET_PRICE_CENTS} ticketSize={15} drawSize={15} total={25}
            rows={reductionGuarantees[`lotofacil:${tier.id}`] ?? [{ inPool: 15, hits: tier.guarantee }]} hitName={(hits) => `${hits} pontos`}
            note={`Você escolhe o grupo excluindo ${excludeCount} dezenas. Garantir 15 pontos exigiria todos os 816 jogos possíveis dentro do grupo (${currency.format(816 * TICKET_PRICE_CENTS / 100)}). Garantias provadas por força bruta; fora da condição os jogos concorrem normalmente.`} />
        </section>
        <section className={styles.card}>
          <h2>{rounds.length ? `Redução ${rounds.length + 1} · escolha ${excludeCount} dezenas` : `02 · Escolha ${excludeCount} dezenas para excluir`}</h2>
          <p>{excluded.length}/{excludeCount} escolhidas. As demais {available.length} entram na redução. Clique nas dezenas pra montar manualmente, ou use o preenchimento automático.</p>
          <div className={styles.autoFill}>
            <button type="button" disabled={!history.length} onClick={fillFromLastDraw}>Sortear {excludeCount} dezenas do último concurso{history[0] ? ` (#${history[0].contest})` : ""}</button>
            <button type="button" onClick={fillRandom}>Sortear {excludeCount} dezenas aleatórias</button>
            {excluded.length > 0 && <button type="button" className={styles.clear} onClick={() => { setExcluded([]); setError(null); }}>Limpar seleção</button>}
          </div>
          <div className={styles.board}>{board.map((number) => <button type="button" key={number} aria-pressed={excludedSet.has(number)} className={excludedSet.has(number) ? styles.excluded : ""} onClick={() => toggle(number)}>{pad(number)}</button>)}</div>
        </section>
        <button className={styles.generate} type="button" disabled={excluded.length !== excludeCount} onClick={generate}>Gerar os {tier.games} jogos ↗</button>
        <p className={styles.priceNote}>Custo estimado: {currency.format(tier.games * TICKET_PRICE_CENTS / 100)} ({tier.games} × {currency.format(TICKET_PRICE_CENTS / 100)} a aposta simples de 15 dezenas). Confira o valor atualizado na <a href="https://loterias.caixa.gov.br/Paginas/lotofacil.aspx" target="_blank" rel="noreferrer">CAIXA ↗</a>.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <aside className={styles.preview}>
        <span className="eyebrow">Dezenas disponíveis</span>
        <h2>{available.length} de 25</h2>
        <p>{available.length === tier.pool ? "Pronto para gerar." : `Faltam ${Math.max(0, excludeCount - excluded.length)} exclusões para fechar em ${tier.pool}.`}</p>
        {rounds.length > 0 && <p>{rounds.length} {rounds.length === 1 ? "redução gerada" : "reduções geradas"} nesta sessão.</p>}
      </aside>
    </div>
    {rounds.length > 0 && <section ref={resultsRef} className={styles.roundList}>
      {rounds.map((round, position) => <section className={styles.results} key={round.id}>
        <div className={styles.resultHeading}>
          <div><span className="eyebrow">Redução {rounds.length - position}</span><h2>{round.tickets.length} jogos · garante {round.tier.guarantee} pontos · excluiu {round.excluded.map(pad).join(", ")}</h2></div>
          <div className={styles.roundActions}>
            <SaveBetsButton slug="lotofacil" strategy={`Redução ${round.tier.pool} dezenas · ${round.tier.games} jogos · garante ${round.tier.guarantee} pontos · excluiu ${round.excluded.map(pad).join(", ")}`} tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers }))} name={`Lotofácil · redução ${round.tier.pool} dezenas · garante ${round.tier.guarantee}`} /><button type="button" onClick={() => copyRound(round.id)}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
            <button type="button" className={styles.remove} onClick={() => removeRound(round.id)}>Remover</button>
          </div>
        </div>
        <p className={styles.priceNote}>Aposta simples de 15 dezenas a {currency.format(TICKET_PRICE_CENTS / 100)} — confira o valor atualizado na <a href="https://loterias.caixa.gov.br/Paginas/lotofacil.aspx" target="_blank" rel="noreferrer">CAIXA ↗</a>.</p>
        <HistoricalBacktest key={JSON.stringify(round.tickets)} slug="lotofacil" tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers }))} availableContests={history.length} pricePerTicketCents={TICKET_PRICE_CENTS} />
        <div className={styles.ticketGrid}>{round.tickets.map((ticket, index) => <article className={styles.ticket} key={index}>
          <div><strong>Jogo {index + 1}</strong><small>exclui {ticket.excluded.map(pad).join(", ")}</small></div>
          <MiniVolante numbers={ticket.numbers} />
          <p>{ticket.numbers.map(pad).join(" · ")}</p>
        </article>)}</div>
      </section>)}
    </section>}
  </main>;
}

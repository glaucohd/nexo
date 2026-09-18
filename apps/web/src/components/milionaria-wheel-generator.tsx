"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { SaveBetsButton } from "@/components/save-bets-button";
import { standardTicketPriceCents, type DrawNumbers } from "@/lib/lottery-generator";
import { cyclicWheel, type CyclicWheelTicket } from "@/lib/cyclic-wheel";

import styles from "./number-wheel-generator.module.css";

const pad = (number: number) => String(number).padStart(2, "0");
const board = Array.from({ length: 50 }, (_, index) => index + 1);
const trevoBoard = Array.from({ length: 6 }, (_, index) => index + 1);
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const ticketPrice = standardTicketPriceCents["mais-milionaria"];

// A garantia é só sobre as 6 dezenas — verificada por força bruta nos
// testes de cyclic-wheel.ts. Os trevos não entram na conta: acertar 4+
// dezenas já paga o prêmio base (rótulo "4/5 + 1 ou nenhum trevo") mesmo
// com 0 ou 1 trevo certo; acertar os 2 trevos só destrava um prêmio melhor.
type Preset = { id: string; label: string; poolSize: number; groups: number[]; games: number; guarantee: number };

const presets: Preset[] = [
  { id: "quina8", label: "8 dezenas · 4 jogos · garante 5 acertos", poolSize: 8, groups: [4, 4], games: 4, guarantee: 5 },
  { id: "quadra9", label: "9 dezenas · 3 jogos · garante 4 acertos", poolSize: 9, groups: [3, 3, 3], games: 3, guarantee: 4 },
];

function shuffled<T>(values: readonly T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

type Round = { id: number; pool: number[]; trevos: number[]; preset: Preset; tickets: CyclicWheelTicket[]; copied: boolean };

export function MilionariaWheelGenerator({ history }: { history: DrawNumbers[] }) {
  const [presetId, setPresetId] = useState(presets[0].id);
  const preset = presets.find((entry) => entry.id === presetId) ?? presets[0];
  const [pool, setPool] = useState<number[]>([]);
  const [trevos, setTrevos] = useState<number[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const poolSet = new Set(pool);
  const trevoSet = new Set(trevos);

  useEffect(() => {
    if (rounds.length) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [rounds.length]);

  function choosePreset(next: Preset) {
    setPresetId(next.id);
    setPool([]);
    setError(null);
  }

  function toggle(number: number) {
    if (poolSet.has(number)) { setPool((current) => current.filter((entry) => entry !== number)); setError(null); return; }
    if (pool.length >= preset.poolSize) { setError(`Você já escolheu ${preset.poolSize} dezenas. Remova uma antes de trocar.`); return; }
    setPool((current) => [...current, number]);
    setError(null);
  }

  function toggleTrevo(number: number) {
    if (trevoSet.has(number)) { setTrevos((current) => current.filter((entry) => entry !== number)); return; }
    if (trevos.length >= 2) { setError("Você já escolheu 2 trevos. Remova um antes de trocar."); return; }
    setTrevos((current) => [...current, number]);
    setError(null);
  }

  function fillFromLastDraw() {
    const latest = history[0];
    if (!latest) { setError("Ainda não há concursos no histórico para usar esta opção."); return; }
    const rest = shuffled(board.filter((number) => !latest.numbers.includes(number)));
    setPool([...latest.numbers, ...rest.slice(0, preset.poolSize - latest.numbers.length)].sort((a, b) => a - b));
    setError(null);
  }

  function fillRandom() {
    setPool(shuffled(board).slice(0, preset.poolSize).sort((a, b) => a - b));
    setError(null);
  }

  function generate() {
    if (trevos.length !== 2) { setError("Escolha 2 trevos antes de gerar."); return; }
    try {
      const tickets = cyclicWheel(pool, preset.groups);
      setRounds((current) => [{ id: Date.now(), pool: [...pool].sort((a, b) => a - b), trevos: [...trevos].sort((a, b) => a - b), preset, tickets, copied: false }, ...current]);
      setPool([]);
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
    const content = round.tickets.map((ticket, index) => `Jogo ${index + 1}: ${ticket.numbers.map(pad).join(" ")} | trevos: ${round.trevos.map(pad).join(" ")}`).join("\n");
    try {
      await navigator.clipboard.writeText(content);
      setRounds((current) => current.map((entry) => entry.id === id ? { ...entry, copied: true } : entry));
    } catch { setError("Não foi possível copiar automaticamente."); }
  }

  return <main className={styles.page} style={{ "--generator-accent": "#3445a5" } as CSSProperties}>
    <header className={styles.header}>
      <div><span className="eyebrow">Fechamento</span><h1>Redução da <em>+Milionária</em>.</h1><p>Escolha um pool de dezenas maior que a aposta simples. A garantia é só sobre as 6 dezenas: acertar 4 ou 5 já paga o prêmio base, com qualquer trevo. Os trevos certos destravam um prêmio ainda melhor, mas não são exigidos pela garantia.</p></div>
      <span>{history.length} concursos na base</span>
    </header>
    <div className={styles.layout}>
      <div className={styles.controls}>
        <section className={styles.card}>
          <h2>01 · Nível de garantia</h2>
          <div className={styles.segment}>{presets.map((entry) => <button type="button" key={entry.id} aria-pressed={preset.id === entry.id} className={preset.id === entry.id ? styles.active : ""} onClick={() => choosePreset(entry)}>{entry.label}</button>)}</div>
        </section>
        <section className={styles.card}>
          <h2>{rounds.length ? `Redução ${rounds.length + 1} · escolha ${preset.poolSize} dezenas` : `02 · Escolha ${preset.poolSize} dezenas para o pool`}</h2>
          <p>{pool.length}/{preset.poolSize} escolhidas. Clique nas dezenas pra montar manualmente, ou use o preenchimento automático.</p>
          <div className={styles.autoFill}>
            <button type="button" disabled={!history.length} onClick={fillFromLastDraw}>Sortear com base no último concurso{history[0] ? ` (#${history[0].contest})` : ""}</button>
            <button type="button" onClick={fillRandom}>Sortear {preset.poolSize} dezenas aleatórias</button>
            {pool.length > 0 && <button type="button" className={styles.clear} onClick={() => { setPool([]); setError(null); }}>Limpar seleção</button>}
          </div>
          <div className={styles.board} style={{ "--columns": 5 } as CSSProperties}>{board.map((number) => <button type="button" key={number} aria-pressed={poolSet.has(number)} className={poolSet.has(number) ? styles.selected : ""} onClick={() => toggle(number)}>{pad(number)}</button>)}</div>
        </section>
        <section className={styles.card}>
          <h2>03 · Escolha 2 trevos (não afetam a garantia)</h2>
          <p>{trevos.length}/2 escolhidos. Valem para todos os jogos desta redução.</p>
          <div className={styles.board} style={{ "--columns": 6 } as CSSProperties}>{trevoBoard.map((number) => <button type="button" key={number} aria-pressed={trevoSet.has(number)} className={trevoSet.has(number) ? styles.selected : ""} onClick={() => toggleTrevo(number)}>{pad(number)}</button>)}</div>
        </section>
        <section className={styles.card}>
          <h2>Garantia matemática</h2>
          <p>Se as 6 dezenas sorteadas caírem todas dentro do seu pool de {preset.poolSize}, ao menos 1 dos {preset.games} jogos vai bater no mínimo <strong>{preset.guarantee} acertos nas dezenas</strong> — o suficiente para o prêmio base, com qualquer resultado de trevo. Cobertura combinatória provada por força bruta.</p>
        </section>
        <button className={styles.generate} type="button" disabled={pool.length !== preset.poolSize || trevos.length !== 2} onClick={generate}>Gerar os {preset.games} jogos ↗</button>
        <p className={styles.priceNote}>Custo estimado: <strong>{currency.format(preset.games * ticketPrice / 100)}</strong> ({preset.games} × aposta simples de {currency.format(ticketPrice / 100)}). Confira o valor atualizado na CAIXA.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <aside className={styles.preview}>
        <span className="eyebrow">Pool atual</span>
        <h2>{pool.length} de {preset.poolSize}</h2>
        <p>{pool.length === preset.poolSize ? "Dezenas prontas." : `Faltam ${preset.poolSize - pool.length} dezenas.`} {trevos.length === 2 ? "Trevos prontos." : `Faltam ${2 - trevos.length} trevos.`}</p>
        {rounds.length > 0 && <p>{rounds.length} {rounds.length === 1 ? "redução gerada" : "reduções geradas"} nesta sessão.</p>}
      </aside>
    </div>
    {rounds.length > 0 && <section ref={resultsRef} className={styles.roundList}>
      {rounds.map((round, position) => <section className={styles.results} key={round.id}>
        <div className={styles.resultHeading}>
          <div><span className="eyebrow">Redução {rounds.length - position}</span><h2>{round.tickets.length} jogos · garante {round.preset.guarantee} acertos · trevos {round.trevos.map(pad).join(", ")}</h2></div>
          <div className={styles.roundActions}>
            <SaveBetsButton slug="mais-milionaria" mode="reducao" tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers, trevos: round.trevos }))} name={`+Milionária · redução ${round.preset.poolSize} dezenas · garante ${round.preset.guarantee}`} /><button type="button" onClick={() => copyRound(round.id)}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
            <button type="button" className={styles.remove} onClick={() => removeRound(round.id)}>Remover</button>
          </div>
        </div>
        <HistoricalBacktest key={JSON.stringify(round.tickets)} slug="mais-milionaria" tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers, trevos: round.trevos }))} availableContests={history.length} pricePerTicketCents={ticketPrice} />
        <div className={styles.ticketGrid}>{round.tickets.map((ticket, index) => <article className={styles.ticket} key={index}>
          <div><strong>Jogo {index + 1}</strong></div>
          <p>{ticket.numbers.map(pad).join(" · ")}<br />Trevos: {round.trevos.map(pad).join(" · ")}</p>
        </article>)}</div>
      </section>)}
    </section>}
  </main>;
}

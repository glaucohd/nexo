"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { SaveBetsButton } from "@/components/save-bets-button";
import { lotteryGames, standardTicketPriceCents, type DrawNumbers, type LotterySlug } from "@/lib/lottery-generator";
import { cyclicWheel, type CyclicWheelTicket } from "@/lib/cyclic-wheel";

import styles from "./number-wheel-generator.module.css";

const pad = (number: number) => String(number).padStart(2, "0");

// Todos os presets abaixo mantêm o jogo do tamanho exato do sorteio (aposta
// simples, sem desdobramento) — verificados por força bruta nos testes.
type Preset = { id: string; label: string; poolSize: number; groups: number[]; games: number; guarantee: number; note?: string };

const presetsBySlug: Partial<Record<LotterySlug, Preset[]>> = {
  "mega-sena": [
    { id: "quina8", label: "8 dezenas · 4 jogos · garante quina", poolSize: 8, groups: [4, 4], games: 4, guarantee: 5 },
    { id: "quadra9", label: "9 dezenas · 3 jogos · garante quadra", poolSize: 9, groups: [3, 3, 3], games: 3, guarantee: 4 },
    { id: "sena7", label: "7 dezenas · 7 jogos · garante a sena", poolSize: 7, groups: [7], games: 7, guarantee: 6 },
  ],
  quina: [
    { id: "quadra7", label: "7 dezenas · 4 jogos · garante quadra", poolSize: 7, groups: [4, 3], games: 4, guarantee: 4 },
    { id: "terno8", label: "8 dezenas · 3 jogos · garante terno", poolSize: 8, groups: [3, 3, 2], games: 3, guarantee: 3 },
    { id: "quina6", label: "6 dezenas · 6 jogos · garante a quina", poolSize: 6, groups: [6], games: 6, guarantee: 5 },
  ],
  // A Dupla Sena sorteia 6 dezenas como a Mega-Sena, então o mesmo fechamento
  // vale — e cada jogo concorre nos dois sorteios do concurso.
  "dupla-sena": [
    { id: "quina8", label: "8 dezenas · 4 jogos · garante 5 acertos", poolSize: 8, groups: [4, 4], games: 4, guarantee: 5 },
    { id: "quadra9", label: "9 dezenas · 3 jogos · garante quadra", poolSize: 9, groups: [3, 3, 3], games: 3, guarantee: 4 },
    { id: "sena7", label: "7 dezenas · 7 jogos · garante a sena", poolSize: 7, groups: [7], games: 7, guarantee: 6 },
  ],
  // A aposta da Timemania tem 10 dezenas e o sorteio só 7, então o jogo já
  // cobre boa parte do pool — dá para garantir muito ponto com poucos jogos.
  timemania: [
    // 10 pares: cada jogo leva uma dezena de cada par, então as sorteadas que
    // caem no pool se dividem entre os 2 jogos e um deles fica com a metade.
    { id: "quatro20", label: "20 dezenas · 2 jogos · garante 4 acertos", poolSize: 20, groups: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], games: 2, guarantee: 4, note: "Mesmo que só 5 ou 6 das 7 sorteadas caiam nas suas 20, um dos jogos faz ao menos 3 acertos." },
    { id: "cinco15", label: "15 dezenas · 3 jogos · garante 5 acertos", poolSize: 15, groups: [3, 3, 3, 3, 3], games: 3, guarantee: 5 },
    { id: "seis13", label: "13 dezenas · 5 jogos · garante 6 acertos", poolSize: 13, groups: [5, 4, 4], games: 5, guarantee: 6 },
    { id: "sete11", label: "11 dezenas · 11 jogos · garante os 7 acertos", poolSize: 11, groups: [11], games: 11, guarantee: 7 },
  ],
};

function shuffled<T>(values: readonly T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

type Round = { id: number; pool: number[]; preset: Preset; tickets: CyclicWheelTicket[]; copied: boolean };

export function NumberWheelGenerator({ slug, history }: { slug: "mega-sena" | "quina" | "dupla-sena" | "timemania"; history: DrawNumbers[] }) {
  const game = lotteryGames[slug];
  const presets = presetsBySlug[slug] ?? [];
  const board = Array.from({ length: game.total }, (_, index) => index + game.start);
  const [presetId, setPresetId] = useState(presets[0].id);
  const preset = presets.find((entry) => entry.id === presetId) ?? presets[0];
  const [pool, setPool] = useState<number[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const poolSet = new Set(pool);
  const ticketPrice = standardTicketPriceCents[slug];

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
    try {
      const tickets = cyclicWheel(pool, preset.groups);
      setRounds((current) => [{ id: Date.now(), pool: [...pool].sort((a, b) => a - b), preset, tickets, copied: false }, ...current]);
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
    const content = round.tickets.map((ticket, index) => `Jogo ${index + 1}: ${ticket.numbers.map(pad).join(" ")}`).join("\n");
    try {
      await navigator.clipboard.writeText(content);
      setRounds((current) => current.map((entry) => entry.id === id ? { ...entry, copied: true } : entry));
    } catch { setError("Não foi possível copiar automaticamente."); }
  }

  return <main className={styles.page} style={{ "--generator-accent": game.color } as CSSProperties}>
    <header className={styles.header}>
      <div><span className="eyebrow">Fechamento</span><h1>Redução da <em>{game.name}</em>.</h1><p>Escolha um pool de dezenas maior que a aposta simples. O fechamento cíclico garante uma pontuação mínima sempre que as {game.drawSize} dezenas sorteadas caírem dentro do seu pool.{slug === "dupla-sena" ? " Na Dupla Sena cada jogo concorre nos dois sorteios do concurso pelo mesmo preço, então a garantia vale para cada um deles." : ""}</p></div>
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
          <div className={styles.board} style={{ "--columns": game.columns } as CSSProperties}>{board.map((number) => <button type="button" key={number} aria-pressed={poolSet.has(number)} className={poolSet.has(number) ? styles.selected : ""} onClick={() => toggle(number)}>{pad(number)}</button>)}</div>
        </section>
        <section className={styles.card}>
          <h2>Garantia matemática</h2>
          <p>Se as {game.drawSize} dezenas sorteadas caírem todas dentro do seu pool de {preset.poolSize}, ao menos 1 dos {preset.games} jogos vai bater no mínimo <strong>{preset.guarantee} pontos</strong> — cobertura combinatória provada por força bruta, não estimativa.{preset.note ? ` ${preset.note}` : ""}{slug === "dupla-sena" ? " Como são dois sorteios por concurso, a garantia é avaliada separadamente em cada um: basta o sorteio cair dentro do pool." : ""}</p>
        </section>
        <button className={styles.generate} type="button" disabled={pool.length !== preset.poolSize} onClick={generate}>Gerar os {preset.games} jogos ↗</button>
        <p className={styles.priceNote}>Custo estimado: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(preset.games * ticketPrice / 100)}</strong> ({preset.games} × aposta simples de {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ticketPrice / 100)}). Confira o valor atualizado na CAIXA.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <aside className={styles.preview}>
        <span className="eyebrow">Pool atual</span>
        <h2>{pool.length} de {preset.poolSize}</h2>
        <p>{pool.length === preset.poolSize ? "Pronto para gerar." : `Faltam ${preset.poolSize - pool.length} dezenas.`}</p>
        {rounds.length > 0 && <p>{rounds.length} {rounds.length === 1 ? "redução gerada" : "reduções geradas"} nesta sessão.</p>}
      </aside>
    </div>
    {rounds.length > 0 && <section ref={resultsRef} className={styles.roundList}>
      {rounds.map((round, position) => <section className={styles.results} key={round.id}>
        <div className={styles.resultHeading}>
          <div><span className="eyebrow">Redução {rounds.length - position}</span><h2>{round.tickets.length} jogos · garante {round.preset.guarantee} pontos · pool {round.pool.map(pad).join(", ")}</h2></div>
          <div className={styles.roundActions}>
            <SaveBetsButton slug={slug} mode="reducao" tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers }))} name={`${game.name} · redução ${round.preset.poolSize} dezenas · garante ${round.preset.guarantee}`} /><button type="button" onClick={() => copyRound(round.id)}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
            <button type="button" className={styles.remove} onClick={() => removeRound(round.id)}>Remover</button>
          </div>
        </div>
        <HistoricalBacktest key={JSON.stringify(round.tickets)} slug={slug} tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers }))} availableContests={history.length} pricePerTicketCents={ticketPrice} />
        <div className={styles.ticketGrid}>{round.tickets.map((ticket, index) => <article className={styles.ticket} key={index}>
          <div><strong>Jogo {index + 1}</strong></div>
          <p>{ticket.numbers.map(pad).join(" · ")}</p>
        </article>)}</div>
      </section>)}
    </section>}
  </main>;
}

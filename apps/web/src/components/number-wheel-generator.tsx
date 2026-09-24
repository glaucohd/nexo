"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { GuaranteeSummary } from "@/components/reduction-guide";
import { SaveBetsButton } from "@/components/save-bets-button";
import { coordinatedSelections } from "@/lib/coordinated-pools";
import { buildProfile } from "@/lib/hot-cold-profile";
import { lotteryGames, standardTicketPriceCents, type DrawNumbers, type LotterySlug } from "@/lib/lottery-generator";
import { cyclicWheel, type CyclicWheelTicket } from "@/lib/cyclic-wheel";

import { reductionGuarantees } from "@/lib/reduction-stats";

import styles from "./number-wheel-generator.module.css";

const pad = (number: number) => String(number).padStart(2, "0");

// Todos os presets abaixo mantêm o jogo do tamanho exato do sorteio (aposta
// simples, sem desdobramento) — verificados por força bruta nos testes.
type Preset = { id: string; label: string; poolSize: number; groups: number[]; games: number; guarantee: number };

const presetsBySlug: Partial<Record<LotterySlug, Preset[]>> = {
  "mega-sena": [
    { id: "quina8", label: "8 dezenas · 4 jogos · garante quina", poolSize: 8, groups: [4, 4], games: 4, guarantee: 5 },
  ],
  quina: [
    { id: "quadra7", label: "7 dezenas · 4 jogos · garante quadra", poolSize: 7, groups: [4, 3], games: 4, guarantee: 4 },
  ],
  // A Dupla Sena sorteia 6 dezenas como a Mega-Sena, então o mesmo fechamento
  // vale — e cada jogo concorre nos dois sorteios do concurso.
  "dupla-sena": [
    { id: "quina8", label: "8 dezenas · 4 jogos · garante 5 acertos", poolSize: 8, groups: [4, 4], games: 4, guarantee: 5 },
  ],
  // A aposta da Timemania tem 10 dezenas e o sorteio só 7, então o jogo já
  // cobre boa parte do pool — dá para garantir muito ponto com poucos jogos.
  timemania: [
    // 10 pares: cada jogo leva uma dezena de cada par, então as sorteadas que
    // caem no pool se dividem entre os 2 jogos e um deles fica com a metade.
    { id: "cinco15", label: "15 dezenas · 3 jogos · garante 5 acertos", poolSize: 15, groups: [3, 3, 3, 3, 3], games: 3, guarantee: 5 },
  ],
};

// Nome da faixa de prêmio para o texto ("pelo menos um jogo faz a quadra").
const sixNames: Record<number, string> = { 6: "a sena", 5: "a quina", 4: "a quadra", 3: "o terno" };
const quinaNames: Record<number, string> = { 5: "a quina", 4: "a quadra", 3: "o terno", 2: "o duque" };
function hitNameFor(slug: LotterySlug) {
  return (hits: number) => (slug === "quina" ? quinaNames : slug === "timemania" ? {} as Record<number, string> : sixNames)[hits] ?? `${hits} acertos`;
}

function shuffled<T>(values: readonly T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

type Round = { id: number; pool: number[]; team?: string; preset: Preset; tickets: CyclicWheelTicket[]; copied: boolean; coordinated?: boolean };

export function NumberWheelGenerator({ slug, history }: { slug: "mega-sena" | "quina" | "dupla-sena" | "timemania"; history: DrawNumbers[] }) {
  const game = lotteryGames[slug];
  const hitName = hitNameFor(slug);
  const draws = slug === "dupla-sena" ? 2 : 1;
  const presets = presetsBySlug[slug] ?? [];
  const board = Array.from({ length: game.total }, (_, index) => index + game.start);
  const preset = presets[0];
  const [pool, setPool] = useState<number[]>([]);
  const [team, setTeam] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const poolSet = new Set(pool);
  const ticketPrice = standardTicketPriceCents[slug];

  useEffect(() => {
    if (rounds.length) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [rounds.length]);

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
      if (slug === "timemania" && !team.trim()) { setError("Informe o Time do Coração antes de gerar."); return; }
      const tickets = cyclicWheel(pool, preset.groups);
      setRounds((current) => [{ id: Date.now(), pool: [...pool].sort((a, b) => a - b), ...(slug === "timemania" ? { team: team.trim() } : {}), preset, tickets, copied: false }, ...current]);
      setPool([]);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível montar a redução.");
    }
  }

  function generateCoordinated() {
    const profile = buildProfile(history, game, 30);
    const pools = coordinatedSelections({ universe: board, size: preset.poolSize, count: 3, strata: [profile.hot, profile.neutral, profile.cold] });
    const now = Date.now();
    setRounds(pools.map((roundPool, index) => ({
      id: now + index, pool: roundPool, preset, tickets: cyclicWheel(roundPool, preset.groups), copied: false, coordinated: true,
    })));
    setPool([]);
    setError(null);
  }

  function removeRound(id: number) {
    setRounds((current) => current.filter((round) => round.id !== id));
  }

  async function copyRound(id: number) {
    const round = rounds.find((entry) => entry.id === id);
    if (!round) return;
    const content = round.tickets.map((ticket, index) => `Jogo ${index + 1}: ${ticket.numbers.map(pad).join(" ")}${round.team ? ` | Time do Coração: ${round.team}` : ""}`).join("\n");
    try {
      await navigator.clipboard.writeText(content);
      setRounds((current) => current.map((entry) => entry.id === id ? { ...entry, copied: true } : entry));
    } catch { setError("Não foi possível copiar automaticamente."); }
  }

  return <main className={styles.page} style={{ "--generator-accent": game.color } as CSSProperties}>
    <header className={styles.header}>
      <div><span className="eyebrow">Fechamento</span><h1>Redução da <em>{game.name}</em>.</h1><p>Escolha um grupo de dezenas. O Nexo monta jogos que garantem prêmio quando boa parte das sorteadas cai dentro desse grupo — a tabela abaixo mostra exatamente o que fica garantido e com que frequência.</p></div>
      <span>{history.length} concursos na base</span>
    </header>
    <div className={styles.layout}>
      <div className={styles.controls}>
        <section className={styles.card}>
          <h2>01 · Fechamento recomendado</h2>
          <GuaranteeSummary pool={preset.poolSize} games={preset.games} costCents={preset.games * ticketPrice} ticketSize={game.min} drawSize={game.drawSize} total={game.total} draws={draws}
            rows={reductionGuarantees[`${slug}:${preset.id}`] ?? [{ inPool: game.drawSize, hits: preset.guarantee }]} hitName={hitName}
            note={slug === "dupla-sena" ? "Cada jogo concorre nos dois sorteios do concurso pelo mesmo preço; basta um deles cumprir a condição. Garantia provada por força bruta; fora da condição os jogos concorrem normalmente." : undefined} />
          {slug === "quina" && <><button className={styles.generate} type="button" onClick={generateCoordinated}>Preparar 3 reduções coordenadas · 12 jogos ↗</button><p>Os três grupos usam 21 dezenas diferentes, equilibradas entre quentes, neutras e frias. Isso amplia a cobertura conjunta sem prometer prêmio. Custo total: 12 apostas simples.</p></>}
        </section>
        <section className={styles.card}>
          <h2>{rounds.length ? `Nova redução manual · escolha ${preset.poolSize} dezenas` : `02 · Escolha as ${preset.poolSize} dezenas do grupo`}</h2>
          <p>{pool.length}/{preset.poolSize} escolhidas. Clique nas dezenas pra montar manualmente, ou use o preenchimento automático.</p>
          <div className={styles.autoFill}>
            <button type="button" disabled={!history.length} onClick={fillFromLastDraw}>Sortear com base no último concurso{history[0] ? ` (#${history[0].contest})` : ""}</button>
            <button type="button" onClick={fillRandom}>Sortear {preset.poolSize} dezenas aleatórias</button>
            {pool.length > 0 && <button type="button" className={styles.clear} onClick={() => { setPool([]); setError(null); }}>Limpar seleção</button>}
          </div>
          <div className={styles.board} style={{ "--columns": game.columns } as CSSProperties}>{board.map((number) => <button type="button" key={number} aria-pressed={poolSet.has(number)} className={poolSet.has(number) ? styles.selected : ""} onClick={() => toggle(number)}>{pad(number)}</button>)}</div>
        </section>
        {slug === "timemania" && <section className={styles.card}>
          <h2>03 · Escolha o Time do Coração</h2>
          <p>Digite o nome como aparece no volante oficial. Ele será salvo e conferido separadamente das dezenas.</p>
          <label className={styles.field}>Time do Coração
            <input value={team} maxLength={100} placeholder="Ex.: SANTOS /SP" onChange={(event) => { setTeam(event.target.value); setError(null); }} />
          </label>
        </section>}
        <button className={styles.generate} type="button" disabled={pool.length !== preset.poolSize || slug === "timemania" && !team.trim()} onClick={generate}>Gerar os {preset.games} jogos ↗</button>
        <p className={styles.priceNote}>Custo estimado: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(preset.games * ticketPrice / 100)}</strong> ({preset.games} × aposta simples de {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ticketPrice / 100)}). Confira o valor atualizado na CAIXA.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <aside className={styles.preview}>
        <span className="eyebrow">Pool atual</span>
        <h2>{pool.length} de {preset.poolSize}</h2>
        <p>{pool.length === preset.poolSize ? "Dezenas prontas." : `Faltam ${preset.poolSize - pool.length} dezenas.`} {slug === "timemania" ? team.trim() ? "Time do Coração pronto." : "Falta o Time do Coração." : ""}</p>
        {rounds.length > 0 && <p>{rounds.length} {rounds.length === 1 ? "redução gerada" : "reduções geradas"} nesta sessão.</p>}
      </aside>
    </div>
    {rounds.length > 0 && <section ref={resultsRef} className={styles.roundList}>
      {rounds.map((round, position) => <section className={styles.results} key={round.id}>
        <div className={styles.resultHeading}>
          <div><span className="eyebrow">{round.coordinated ? `Carteira coordenada · grupo ${position + 1}` : `Redução ${rounds.length - position}`}</span><h2>{round.tickets.length} jogos · garante {round.preset.guarantee} pontos{round.team ? ` · ${round.team}` : ""} · pool {round.pool.map(pad).join(", ")}</h2></div>
          <div className={styles.roundActions}>
            <SaveBetsButton slug={slug} strategy={`Redução ${round.preset.poolSize} dezenas · ${round.preset.games} jogos · garante ${hitName(round.preset.guarantee)}${round.coordinated ? " · carteira coordenada" : ""}${round.team ? ` · ${round.team}` : ""}`} tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers, ...(round.team ? { team: round.team } : {}) }))} name={`${game.name} · redução ${round.preset.poolSize} dezenas · garante ${round.preset.guarantee}`} /><button type="button" onClick={() => copyRound(round.id)}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
            <button type="button" className={styles.remove} onClick={() => removeRound(round.id)}>Remover</button>
          </div>
        </div>
        <HistoricalBacktest key={`${JSON.stringify(round.tickets)}-${round.team ?? ""}`} slug={slug} tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers, ...(round.team ? { team: round.team } : {}) }))} availableContests={history.length} pricePerTicketCents={ticketPrice} />
        <div className={styles.ticketGrid}>{round.tickets.map((ticket, index) => <article className={styles.ticket} key={index}>
          <div><strong>Jogo {index + 1}</strong></div>
          <p>{ticket.numbers.map(pad).join(" · ")}{round.team && <><br />Time: {round.team}</>}</p>
        </article>)}</div>
      </section>)}
    </section>}
  </main>;
}

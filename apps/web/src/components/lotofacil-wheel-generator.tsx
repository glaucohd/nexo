"use client";

import { useEffect, useRef, useState } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { GuaranteeSummary } from "@/components/reduction-guide";
import { SaveBetsButton } from "@/components/save-bets-button";
import { coordinatedSelections } from "@/lib/coordinated-pools";
import { buildProfile } from "@/lib/hot-cold-profile";
import { lotteryGames, type DrawNumbers } from "@/lib/lottery-generator";
import { lotofacilWheel, lotofacilWheel20, lotofacilWheel20x13, type LotofacilWheelTicket } from "@/lib/lotofacil-wheel";
import { suggestLotofacilPool, type LotofacilPoolSuggestion } from "@/lib/lotofacil-pool-suggestion";

import { reductionGuarantees } from "@/lib/reduction-stats";

import styles from "./lotofacil-wheel-generator.module.css";

const pad = (number: number) => String(number).padStart(2, "0");
const board = Array.from({ length: 25 }, (_, index) => index + 1);
const integer = new Intl.NumberFormat("pt-BR");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function MiniVolante({ numbers }: { numbers: readonly number[] }) {
  const marked = new Set(numbers);
  return <div className={styles.miniVolante} role="img" aria-label={`Volante: ${numbers.map(pad).join(", ")}`}>
    {board.map((number) => <span key={number} className={marked.has(number) ? styles.miniMarked : ""}>{marked.has(number) ? pad(number) : ""}</span>)}
  </div>;
}
// Aposta simples de 15 dezenas; confira o valor atualizado na CAIXA.
const TICKET_PRICE_CENTS = 350;

type Tier = { id: "18x13" | "20x12" | "20x13"; label: string; detail: string; pool: 18 | 20; guarantee: number; games: number; build: (available: readonly number[]) => LotofacilWheelTicket[] };
type Round = { id: number; excluded: number[]; tickets: LotofacilWheelTicket[]; copied: boolean; tier: Tier; coordinated?: boolean };

const tiers: Tier[] = [
  { id: "18x13", label: "18 dezenas · Equilibrado", detail: "6 jogos · garante 13 pontos", pool: 18, guarantee: 13, games: 6, build: lotofacilWheel },
  { id: "20x12", label: "20 dezenas · Econômico", detail: "4 jogos · garante 12 pontos", pool: 20, guarantee: 12, games: 4, build: lotofacilWheel20 },
  { id: "20x13", label: "20 dezenas · Reforçado", detail: "34 jogos · garante 13 pontos", pool: 20, guarantee: 13, games: 34, build: lotofacilWheel20x13 },
];

export function LotofacilWheelGenerator({ history }: { history: DrawNumbers[] }) {
  const [tierId, setTierId] = useState<Tier["id"]>("18x13");
  const [excluded, setExcluded] = useState<number[]>([]);
  const [suggestion, setSuggestion] = useState<LotofacilPoolSuggestion | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const tier = tiers.find((entry) => entry.id === tierId) ?? tiers[0];
  const excludedSet = new Set(excluded);
  const available = board.filter((number) => !excludedSet.has(number));
  const excludeCount = 25 - tier.pool;
  const fullCombinationCount = tier.pool === 18 ? 816 : 15_504;

  useEffect(() => {
    if (rounds.length) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [rounds.length]);

  function toggle(number: number) {
    setSuggestion(null);
    if (excludedSet.has(number)) { setExcluded((current) => current.filter((entry) => entry !== number)); setError(null); return; }
    if (excluded.length >= excludeCount) { setError(`Você já escolheu ${excludeCount} dezenas para excluir. Remova uma antes de trocar.`); return; }
    setExcluded((current) => [...current, number]);
    setError(null);
  }

  function fillFromAnalysis() {
    try {
      const next = suggestLotofacilPool({ history, size: tier.pool });
      setExcluded(next.excluded);
      setSuggestion(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sugerir um grupo equilibrado.");
    }
  }

  function generate() {
    try {
      const tickets = tier.build(available);
      setRounds((current) => [{ id: Date.now(), excluded: [...excluded].sort((a, b) => a - b), tickets, copied: false, tier }, ...current]);
      setExcluded([]);
      setSuggestion(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível montar a redução.");
    }
  }

  function generateCoordinated() {
    const profile = buildProfile(history, lotteryGames.lotofacil, 30);
    const groupCount = tier.pool === 20 ? 5 : 3;
    const exclusions = coordinatedSelections({ universe: board, size: 25 - tier.pool, count: groupCount, strata: [profile.hot, profile.neutral, profile.cold] });
    const now = Date.now();
    setRounds(exclusions.map((roundExcluded, index) => {
      const excludedNumbers = [...roundExcluded].sort((a, b) => a - b);
      return { id: now + index, excluded: excludedNumbers, tickets: tier.build(board.filter((number) => !excludedNumbers.includes(number))), copied: false, tier, coordinated: true };
    }));
    setExcluded([]);
    setSuggestion(null);
    setError(null);
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
          <h2>01 · Escolha o fechamento</h2>
          <div className={styles.segment} role="group" aria-label="Tipo de fechamento da Lotofácil">
            {tiers.map((entry) => <button type="button" key={entry.id} aria-pressed={tier.id === entry.id} className={tier.id === entry.id ? styles.active : ""} onClick={() => { setTierId(entry.id); setExcluded([]); setSuggestion(null); setError(null); }}><strong>{entry.label}</strong><small>{entry.detail}</small></button>)}
          </div>
          <GuaranteeSummary pool={tier.pool} games={tier.games} costCents={tier.games * TICKET_PRICE_CENTS} ticketSize={15} drawSize={15} total={25}
            rows={reductionGuarantees[`lotofacil:${tier.id}`] ?? [{ inPool: 15, hits: tier.guarantee }]} hitName={(hits) => `${hits} pontos`}
            note={`Você escolhe o grupo excluindo ${excludeCount} dezenas. Garantir 15 pontos exigiria todos os ${integer.format(fullCombinationCount)} jogos possíveis dentro do grupo (${currency.format(fullCombinationCount * TICKET_PRICE_CENTS / 100)}). Garantias provadas por força bruta; fora da condição os jogos concorrem normalmente.`} />
          {tier.pool === 18
            ? <><button className={styles.generate} type="button" onClick={generateCoordinated}>Preparar 3 reduções coordenadas · 18 jogos ↗</button>
              <p>As 21 exclusões não se repetem, e quentes, neutras e frias são distribuídas entre os grupos. Nenhuma dezena fica fora de todas as reduções. Custo total estimado: <strong>{currency.format(3 * tier.games * TICKET_PRICE_CENTS / 100)}</strong>.</p></>
            : <><button className={styles.generate} type="button" onClick={generateCoordinated}>Preparar 5 fechamentos coordenados · {5 * tier.games} jogos ↗</button>
              <p>As 25 dezenas são divididas em cinco blocos de exclusão sem repetição: cada dezena fica fora de um grupo e participa dos outros quatro. Custo total estimado: <strong>{currency.format(5 * tier.games * TICKET_PRICE_CENTS / 100)}</strong>. Isso amplia a cobertura, mas não garante 15 pontos.</p></>}
        </section>
        <section className={styles.card}>
          <h2>{rounds.length ? `Nova redução manual · escolha ${excludeCount} dezenas` : `02 · Ou escolha ${excludeCount} dezenas manualmente`}</h2>
          <p>{excluded.length}/{excludeCount} escolhidas. As demais {available.length} entram na redução. Clique nas dezenas pra montar manualmente, ou use o preenchimento automático.</p>
          <div className={styles.autoFill}>
            <button type="button" onClick={fillFromAnalysis}>{history.length ? "Sugerir grupo pela análise" : "Sortear grupo aleatório"}</button>
            {suggestion && <button type="button" onClick={fillFromAnalysis}>Variar sugestão</button>}
            {excluded.length > 0 && <button type="button" className={styles.clear} onClick={() => { setExcluded([]); setSuggestion(null); setError(null); }}>Limpar seleção</button>}
          </div>
          {suggestion && suggestion.contests > 0 && <p className={styles.suggestionNote}><strong>Sugestão equilibrada em {suggestion.contests} concursos:</strong> {suggestion.metrics.hot} quentes · {suggestion.metrics.neutral} neutras · {suggestion.metrics.cold} frias · {suggestion.metrics.late} atrasadas · {suggestion.metrics.repeated} do último concurso · {suggestion.metrics.pairs} pares · {suggestion.metrics.frame} na moldura. O histórico organiza o palpite, mas não prevê o sorteio.</p>}
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
          <div><span className="eyebrow">{round.coordinated ? `Carteira coordenada · grupo ${position + 1}` : `Redução ${rounds.length - position}`}</span><h2>{round.tickets.length} jogos · garante {round.tier.guarantee} pontos · excluiu {round.excluded.map(pad).join(", ")}</h2></div>
          <div className={styles.roundActions}>
            <SaveBetsButton slug="lotofacil" strategy={`Redução ${round.tier.pool} dezenas · ${round.tier.games} jogos · garante ${round.tier.guarantee} pontos${round.coordinated ? " · carteira coordenada" : ""} · excluiu ${round.excluded.map(pad).join(", ")}`} tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers }))} name={`Lotofácil · redução ${round.tier.pool} dezenas · garante ${round.tier.guarantee}`} /><button type="button" onClick={() => copyRound(round.id)}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
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

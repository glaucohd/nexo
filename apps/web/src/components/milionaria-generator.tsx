"use client";

import { useEffect, useRef, useState } from "react";

import { NumberInsightPicker } from "@/components/number-insight-picker";
import { HistoricalBacktest } from "@/components/historical-backtest";
import type { GeneratorMode } from "@/lib/lottery-generator";

import {
  availableNumbers,
  coveragePercent,
  generateMilionariaTickets,
  isExcluded,
  ticketCost,
  type MilionariaTicket,
} from "@/lib/milionaria-generator";

import styles from "./milionaria-generator.module.css";

type HistoryDraw = { contest: number; numbers: number[] };
type Scope = "general" | "personal";

const numberLabel = (number: number) => String(number).padStart(2, "0");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentageLabel = (value: number) => value > 0 && value < 0.01 ? "< 0,01%" : `${value.toFixed(2).replace(".", ",")}%`;
const ruleLabel = (key: string) => {
  if (key === "half:1") return "Metade superior";
  if (key === "half:2") return "Metade inferior";
  if (key.startsWith("row:")) return `Linha ${key.slice(4)}`;
  if (key.startsWith("column:")) return `Coluna ${key.slice(7)}`;
  return key;
};

const groups = [
  { title: "Metades", description: "25 dezenas em cada metade", options: [
    { key: "half:1", label: "Superior", detail: "01–25" },
    { key: "half:2", label: "Inferior", detail: "26–50" },
  ] },
  { title: "Linhas", description: "5 dezenas por linha", options: Array.from({ length: 10 }, (_, index) => ({
    key: `row:${index + 1}`, label: `Linha ${index + 1}`, detail: `${numberLabel(index * 5 + 1)}–${numberLabel(index * 5 + 5)}`,
  })) },
  { title: "Colunas", description: "10 dezenas por coluna", options: Array.from({ length: 5 }, (_, index) => ({
    key: `column:${index + 1}`, label: `Coluna ${index + 1}`, detail: `${numberLabel(index + 1)}, ${numberLabel(index + 6)}…${numberLabel(index + 46)}`,
  })) },
];

function TicketBoard({ ticket, general, personal, fixed, avoided }: { ticket: MilionariaTicket; general: ReadonlySet<string>; personal: ReadonlySet<string>; fixed: ReadonlySet<number>; avoided: ReadonlySet<number> }) {
  const selected = new Set(ticket.numbers);
  return <div className={styles.ticketBoard} role="img" aria-label={`Dezenas ${ticket.numbers.map(numberLabel).join(", ")}; trevos ${ticket.trevos.join(" e ")}`}>
    {Array.from({ length: 50 }, (_, index) => <span key={index} className={selected.has(index + 1) ? `${styles.ticketHit} ${fixed.has(index + 1) ? styles.ticketFixed : ""}` : avoided.has(index + 1) || isExcluded(index + 1, general, personal) ? styles.ticketExcluded : ""} aria-hidden="true">{numberLabel(index + 1)}</span>)}
  </div>;
}

export function MilionariaGenerator({ history }: { history: HistoryDraw[] }) {
  const [quantity, setQuantity] = useState(4);
  const [size, setSize] = useState(6);
  const [scope, setScope] = useState<Scope>("general");
  const [selectedGame, setSelectedGame] = useState(0);
  const [rules, setRules] = useState<{ general: string[]; personal: Record<number, string[]> }>({ general: [], personal: {} });
  const [fixedNumbers, setFixedNumbers] = useState<number[]>([]);
  const [avoidedNumbers, setAvoidedNumbers] = useState<number[]>([]);
  const [mode, setMode] = useState<GeneratorMode>("pure");
  const [tickets, setTickets] = useState<MilionariaTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!tickets.length) return;
    resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [tickets]);

  const { general, personal } = rules;
  const generalSet = new Set(general);
  const personalSet = new Set(personal[selectedGame] ?? []);
  const fixed = new Set(fixedNumbers);
  const avoided = new Set(avoidedNumbers);
  const activePersonal = scope === "personal" ? personalSet : new Set<string>();
  const available = availableNumbers(generalSet, activePersonal).filter((number) => !avoided.has(number));
  const availableSet = new Set(available);
  const matchingHistory = history.filter((draw) => draw.numbers.every((number) => availableSet.has(number))).length;
  const minAvailable = Math.min(...Array.from({ length: quantity }, (_, index) => availableNumbers(generalSet, new Set(personal[index] ?? [])).filter((number) => !avoided.has(number)).length));

  function toggle(key: string) {
    const nextGeneral = new Set(general);
    const nextPersonal = Object.fromEntries(Object.entries(personal).map(([index, keys]) => [Number(index), [...keys]])) as Record<number, string[]>;
    if (scope === "general") {
      if (nextGeneral.has(key)) nextGeneral.delete(key);
      else nextGeneral.add(key);
    } else {
      const keys = new Set(nextPersonal[selectedGame] ?? []);
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      nextPersonal[selectedGame] = [...keys];
    }
    const tooFew = Array.from({ length: quantity }, (_, index) => {
      const pool = availableNumbers(nextGeneral, new Set(nextPersonal[index] ?? [])).filter((number) => !avoided.has(number));
      return pool.length < size || fixedNumbers.some((number) => !pool.includes(number));
    }).findIndex(Boolean);
    if (tooFew >= 0) {
      setError(`Essa exclusão deixaria menos de ${size} dezenas disponíveis ou bloquearia uma fixa no jogo ${tooFew + 1}.`);
      return;
    }
    setRules({ general: [...nextGeneral], personal: nextPersonal });
    setTickets([]);
    setError(null);
    setCopied(false);
  }

  function changeSize(nextSize: number) {
    if (fixed.size > nextSize) { setError(`Você fixou ${fixed.size} dezenas. Desfixe algumas antes de escolher ${nextSize}.`); return; }
    if (minAvailable < nextSize) {
      setError(`O jogo com mais exclusões tem só ${minAvailable} dezenas livres. Reduza os filtros antes de escolher ${nextSize}.`);
      return;
    }
    setSize(nextSize);
    setTickets([]);
    setError(null);
  }

  function generate(chosenMode: GeneratorMode = mode) {
    try {
      const perGameRules = Array.from({ length: quantity }, (_, index) => new Set(personal[index] ?? []));
      const generated = generateMilionariaTickets({ quantity, size, general: generalSet, personal: perGameRules, fixed, avoided, history, mode: chosenMode });
      if (generated.some((ticket, index) => ticket.numbers.some((number) => avoided.has(number) || isExcluded(number, generalSet, perGameRules[index])))) {
        throw new Error("Uma cartela não respeitou as exclusões. Nenhum jogo foi exibido; tente gerar novamente.");
      }
      setTickets(generated);
      setError(null);
      setCopied(false);
    } catch (cause) {
      setTickets([]);
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar os jogos.");
    }
  }

  function toggleFixedNumber(number: number) {
    if (fixed.has(number)) { setFixedNumbers((current) => current.filter((entry) => entry !== number)); setTickets([]); setError(null); return; }
    if (fixed.size >= size) { setError(`O jogo tem ${size} vagas. Desfixe uma dezena antes de incluir outra.`); return; }
    const blocked = Array.from({ length: quantity }, (_, index) => !availableNumbers(generalSet, new Set(personal[index] ?? [])).includes(number)).findIndex(Boolean);
    if (blocked >= 0) { setError(`A dezena ${numberLabel(number)} está excluída no jogo ${blocked + 1}.`); return; }
    setFixedNumbers((current) => [...current, number]);
    setAvoidedNumbers((current) => current.filter((entry) => entry !== number));
    setTickets([]); setError(null);
  }

  function toggleAvoidedNumber(number: number) {
    if (avoided.has(number)) { setAvoidedNumbers((current) => current.filter((entry) => entry !== number)); setTickets([]); setError(null); return; }
    const next = new Set([...avoided, number]);
    const blocked = Array.from({ length: quantity }, (_, index) => availableNumbers(generalSet, new Set(personal[index] ?? [])).filter((entry) => !next.has(entry)).length < size).findIndex(Boolean);
    if (blocked >= 0) { setError(`Evitar a dezena ${numberLabel(number)} deixaria menos de ${size} dezenas no jogo ${blocked + 1}.`); return; }
    setAvoidedNumbers([...next]);
    setFixedNumbers((current) => current.filter((entry) => entry !== number));
    setTickets([]); setError(null);
  }

  async function copyAll() {
    const text = tickets.map((ticket, index) => `Jogo ${index + 1}: ${ticket.numbers.map(numberLabel).join(" ")} | Trevos ${ticket.trevos.map(numberLabel).join(" ")}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(null);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione os jogos exibidos e copie manualmente.");
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span className="eyebrow">Gerador de jogos</span><h1>Monte sua +Milionária.</h1><p>Leia o histórico, fixe suas dezenas e combine as escolhas com as exclusões do volante.</p></div>
      <span className={styles.gameBadge}>50 dezenas + 6 trevos</span>
    </header>

    <div className={styles.layout}>
      <div className={styles.controls}>
        <section className={styles.card}>
          <div className={styles.stepHeading}><span>01</span><div><h2>Defina os jogos</h2><p>Uma aposta simples usa 6 dezenas e 2 trevos.</p></div></div>
          <div className={styles.fieldGrid}>
            <label><span>Quantidade de jogos</span><select value={quantity} onChange={(event) => { const next = Number(event.target.value); setQuantity(next); setSelectedGame((current) => Math.min(current, next - 1)); setTickets([]); setError(null); }}>{Array.from({ length: 10 }, (_, index) => <option key={index} value={index + 1}>{index + 1} {index === 0 ? "jogo" : "jogos"}</option>)}</select></label>
            <label><span>Dezenas por jogo</span><select value={size} onChange={(event) => changeSize(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => <option key={index} value={index + 6}>{index + 6} dezenas</option>)}</select></label>
          </div>
          <div className={styles.price}><span>Custo estimado dos {quantity} jogos</span><strong>{currency.format(ticketCost(size, quantity))}</strong><small>2 trevos por jogo · preço da aposta simples: R$ 6,00</small></div>
        </section>

        <section className={styles.card}>
          <div className={styles.stepHeading}><span>02</span><div><h2>Critério para completar</h2><p>Suas dezenas fixas continuam presentes em qualquer modo.</p></div></div>
          <div className={styles.scopeSwitch} role="group" aria-label="Critério histórico">
            {([['pure', 'Sorteio puro'], ['hot', 'Frequentes'], ['delayed', 'Atrasadas'], ['mixed', 'Misto']] as const).map(([value, label]) => <button key={value} type="button" disabled={!history.length && value !== 'pure'} className={mode === value ? styles.active : ''} onClick={() => { setMode(value); setTickets([]); setError(null); }}>{label}</button>)}
          </div>
          <p className={styles.scopeNote}>O critério seleciona as dezenas; os dois trevos são gerados à parte.</p>
        </section>

        <section className={styles.card}>
          <div className={styles.stepHeading}><span>03</span><div><h2>Exclua partes do volante</h2><p>Regras gerais e individuais são somadas.</p></div></div>
          <div className={styles.scopeSwitch} role="group" aria-label="Aplicação das exclusões">
            <button type="button" className={scope === "general" ? styles.active : ""} onClick={() => { setScope("general"); setError(null); }}>Todos os jogos</button>
            <button type="button" className={scope === "personal" ? styles.active : ""} onClick={() => { setScope("personal"); setError(null); }}>Personalizar por jogo</button>
          </div>
          {scope === "personal" && <div className={styles.gameTabs} role="group" aria-label="Selecione o jogo a personalizar">{Array.from({ length: quantity }, (_, index) => <button type="button" key={index} className={selectedGame === index ? styles.currentGame : ""} onClick={() => { setSelectedGame(index); setError(null); }}>Jogo {index + 1}{(personal[index]?.length ?? 0) > 0 ? " ·" : ""}</button>)}</div>}
          <p className={styles.scopeNote}>{scope === "general" ? "Estas marcações valem para todas as cartelas." : `Editando só o jogo ${selectedGame + 1}. As exclusões gerais continuam valendo.`}</p>

          <div className={styles.groups}>{groups.map((group) => <div className={styles.group} key={group.title}>
            <div className={styles.groupTitle}><strong>{group.title}</strong><small>{group.description}</small></div>
            <div className={styles.options}>{group.options.map((option) => {
              const inherited = scope === "personal" && generalSet.has(option.key);
              const active = scope === "general" ? generalSet.has(option.key) : personalSet.has(option.key);
              return <button key={option.key} type="button" className={`${styles.option} ${active || inherited ? styles.excludedOption : ""}`} disabled={inherited} aria-pressed={active || inherited} onClick={() => toggle(option.key)}><strong>{option.label}</strong><small>{inherited ? "Excluída para todos" : option.detail}</small></button>;
            })}</div>
          </div>)}</div>
          <button className={styles.clearButton} type="button" onClick={() => { setRules((current) => scope === "general" ? { ...current, general: [] } : { ...current, personal: { ...current.personal, [selectedGame]: [] } }); setTickets([]); setError(null); }}>Limpar {scope === "general" ? "regras gerais" : `jogo ${selectedGame + 1}`}</button>
        </section>
        <section className={styles.card}>
          <NumberInsightPicker history={history} total={50} fixed={fixed} avoided={avoided} onFixed={toggleFixedNumber} onAvoided={toggleAvoidedNumber} />
          {(fixedNumbers.length > 0 || avoidedNumbers.length > 0) && <p className={styles.scopeNote}>{fixedNumbers.length} fixas · {avoidedNumbers.length} evitadas em todos os jogos.</p>}
        </section>
      </div>

      <aside className={styles.preview}>
        <section className={styles.card}>
          <div className={styles.stepHeading}><span>04</span><div><h2>Confira o espaço restante</h2><p>{scope === "general" ? "Aplicando as regras gerais" : `Regras do jogo ${selectedGame + 1}`}</p></div></div>
          <div className={styles.board} role="img" aria-label={`${available.length} dezenas disponíveis de 50`}>
            <span className={styles.topMarker}>SUPERIOR</span><span className={styles.bottomMarker}>INFERIOR</span>
            {Array.from({ length: 50 }, (_, index) => <span key={index} className={avoided.has(index + 1) || isExcluded(index + 1, generalSet, activePersonal) ? styles.blocked : fixed.has(index + 1) ? styles.boardFixed : styles.free} aria-hidden="true">{numberLabel(index + 1)}</span>)}
          </div>
          <div className={styles.boardLegend}><span><i className={styles.freeLegend} /> Disponível</span><span><i className={styles.blockedLegend} /> Excluída</span></div>
          <div className={styles.coverageGrid}>
            <div><span>Dezenas livres</span><strong>{available.length}/50</strong></div>
            <div><span>Resultados possíveis dentro da área</span><strong>{percentageLabel(coveragePercent(available.length))}</strong></div>
            <div><span>Concursos da base inteiros nessa área</span><strong>{history.length ? `${matchingHistory}/${history.length}` : "—"}</strong></div>
          </div>
          <p className={styles.disclaimer}>A porcentagem é combinatória: todas as 6 dezenas sorteadas teriam de estar entre as disponíveis. Não é a chance de ganhar com uma cartela e não inclui os trevos. O histórico é apenas uma comparação passada.</p>
        </section>
        <div className={styles.actionBox}>
          <strong className={styles.rulesTitle}>Regras que serão aplicadas</strong>
          <div className={styles.rulesList}>{Array.from({ length: quantity }, (_, index) => {
            const keys = [...new Set([...general, ...(personal[index] ?? [])])];
            const count = availableNumbers(generalSet, new Set(personal[index] ?? [])).filter((number) => !avoided.has(number)).length;
            return <div key={index}><b>Jogo {index + 1}</b><span>{keys.length ? keys.map(ruleLabel).join(" · ") : "Sem áreas excluídas"}</span><small>{count} dezenas livres</small></div>;
          })}</div>
          {(fixedNumbers.length > 0 || avoidedNumbers.length > 0) && <p>Fixas: {fixedNumbers.length ? fixedNumbers.map(numberLabel).join(" · ") : "nenhuma"} · Evitadas: {avoidedNumbers.length ? avoidedNumbers.map(numberLabel).join(" · ") : "nenhuma"}</p>}
          <button type="button" className={styles.generateButton} onClick={() => generate()}>Gerar {quantity} {quantity === 1 ? "jogo" : "jogos"} ↗</button>
          {history.length > 0 && <button type="button" className={styles.suggestionButton} onClick={() => { setMode("mixed"); generate("mixed"); }}>Sugestão Nexo com histórico</button>}
          <p>Suas dezenas fixas, evitadas e áreas marcadas entram na geração.</p>
        </div>
      </aside>
    </div>

    {error && <p className={styles.error} role="alert">{error}</p>}
    {tickets.length > 0 && <section ref={resultsRef} className={styles.results} aria-live="polite"><div className={styles.resultsHeading}><div><span className="eyebrow">Jogos gerados</span><h2>{tickets.length} cartelas prontas para conferir</h2><p>Copie ou anote antes de sair: estes jogos ainda não são salvos automaticamente no Nexo.</p></div><button type="button" onClick={copyAll}>{copied ? "Copiados ✓" : "Copiar todos"}</button></div><HistoricalBacktest key={JSON.stringify(tickets)} slug="mais-milionaria" tickets={tickets} availableContests={history.length} /><div className={styles.ticketGrid}>{tickets.map((ticket, index) => {
      const gameRules = new Set(personal[index] ?? []);
      const appliedRules = [...new Set([...general, ...gameRules])];
      return <article className={styles.ticket} key={`${ticket.numbers.join("-")}-${ticket.trevos.join("-")}`}><div><strong>Jogo {index + 1}</strong><small>{ticket.numbers.length} dezenas · 2 trevos</small></div><p className={styles.ticketRules}>{appliedRules.length ? `Excluídas: ${appliedRules.map(ruleLabel).join(" · ")}` : "Sem exclusões"}{fixedNumbers.length ? ` · Fixas: ${fixedNumbers.map(numberLabel).join(" · ")}` : ""}</p><TicketBoard ticket={ticket} general={generalSet} personal={gameRules} fixed={fixed} avoided={avoided} /><p>Trevos <b>{ticket.trevos.map(numberLabel).join(" · ")}</b></p></article>;
    })}</div></section>}
    <p className={styles.source}>Regras e preço da aposta simples: <a href="https://loterias.caixa.gov.br/Paginas/mais-milionaria.aspx" target="_blank" rel="noreferrer">CAIXA · +Milionária ↗</a>. Confira o valor no canal de aposta antes de registrar seus jogos.</p>
  </main>;
}

"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { MilionariaGenerator } from "@/components/milionaria-generator";
import { SuperSeteGenerator } from "@/components/super-sete-generator";
import { LotofacilWheelGenerator } from "@/components/lotofacil-wheel-generator";
import { DiaDeSorteWheelGenerator } from "@/components/dia-de-sorte-wheel-generator";
import { NumberWheelGenerator } from "@/components/number-wheel-generator";
import { MilionariaWheelGenerator } from "@/components/milionaria-wheel-generator";
import { HistoricalBacktest } from "@/components/historical-backtest";
import { NumberInsightPicker } from "@/components/number-insight-picker";
import {
  availableLotteryNumbers,
  canExclude,
  generateLotteryTickets,
  generateLotomaniaMirrorPairs,
  generateMirrorPairs,
  hasQuadrants,
  isNumberExcluded,
  lotteryBoardNumber,
  lotofacilPortfolioProfile,
  lotofacilSimpleBetCount,
  lotomaniaBlockNumbers,
  lotomaniaBlockCounts,
  randomLotomaniaBlockRules,
  repeatHistory,
  standardTicketCost,
  lotteryGames,
  type DrawNumbers,
  type GeneratedTicket,
  type GeneratorMode,
  type LotterySlug,
} from "@/lib/lottery-generator";

import styles from "./lottery-generator.module.css";

const slugs = Object.keys(lotteryGames) as LotterySlug[];
const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = (number: number) => String(number).padStart(2, "0");
const integer = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const ruleLabel = (key: string) => key.startsWith("block:")
  ? `bloco ${lotomaniaBlockNumbers(Number(key.slice(6))).map(pad).join("/")}`
  : key.replace("quadrant:", "Q").replace("row:", "linha ").replace("column:", "coluna ");
const modes: { value: GeneratorMode; label: string; detail: string }[] = [
  { value: "pure", label: "Sorteio puro", detail: "Combinações uniformes dentro dos filtros" },
  { value: "balanced", label: "Perfil comum", detail: "Pares, baixas e soma próximos da média histórica" },
  { value: "hot", label: "Mais frequentes", detail: "Dá mais peso às dezenas frequentes" },
  { value: "delayed", label: "Mais atrasadas", detail: "Dá mais peso às dezenas há mais tempo ausentes" },
  { value: "mixed", label: "Misto histórico", detail: "Combina frequência, atraso e perfil" },
  { value: "coverage", label: "Carteira 14+", detail: "Distribui cartelas de 15 a 20 dezenas e usa o histórico como critério" },
];

function exclusionGroups(slug: LotterySlug) {
  const game = lotteryGames[slug];
  const rows = game.total / game.columns;
  const groups: { title: string; items: { key: string; label: string }[]; block?: boolean }[] = [
    ...(hasQuadrants(slug) ? [{ title: "Quadrantes", items: Array.from({ length: 4 }, (_, index) => ({ key: `quadrant:${index + 1}`, label: `Q${index + 1}` })) }] : []),
    { title: "Linhas", items: Array.from({ length: rows }, (_, index) => ({ key: `row:${index + 1}`, label: `Linha ${index + 1}` })) },
    { title: "Colunas", items: Array.from({ length: game.columns }, (_, index) => ({ key: `column:${index + 1}`, label: `Coluna ${index + 1}` })) },
  ];
  if (slug === "lotomania") groups.push({ title: "Blocos 2 × 2", block: true, items: Array.from({ length: 25 }, (_, index) => ({ key: `block:${index + 1}`, label: lotomaniaBlockNumbers(index + 1).map(pad).join(" · ") })) });
  return groups;
}

function Board({ slug, numbers, general = new Set<string>(), personal = new Set<string>(), fixed = [], avoided = new Set<number>(), lotomaniaView = "cross" }: {
  slug: LotterySlug; numbers: readonly number[]; general?: ReadonlySet<string>; personal?: ReadonlySet<string>; fixed?: readonly number[]; avoided?: ReadonlySet<number>; lotomaniaView?: "cross" | "blocks";
}) {
  const game = lotteryGames[slug];
  const selected = new Set(numbers);
  const fixedSet = new Set(fixed);
  const cell = (number: number) => <span key={number} className={`${styles.cell} ${selected.has(number) ? styles.selected : ""} ${fixedSet.has(number) && selected.has(number) ? styles.fixed : ""} ${avoided.has(number) || isNumberExcluded(slug, number, general, personal) ? styles.excluded : ""}`} aria-hidden="true">{pad(number)}</span>;
  const blocks = slug === "lotomania" && lotomaniaView === "blocks";
  return <div className={`${styles.board} ${slug === "lotofacil" ? styles.lotofacilBoard : ""} ${hasQuadrants(slug) && !blocks ? styles.quadrants : ""} ${blocks ? styles.blockBoard : ""}`} style={{ "--columns": game.columns } as CSSProperties} role="img" aria-label={`Volante: ${numbers.map(pad).join(", ")}`}>
    {blocks
      ? Array.from({ length: 25 }, (_, index) => {
        const members = lotomaniaBlockNumbers(index + 1);
        const excluded = members.every((number) => avoided.has(number) || isNumberExcluded(slug, number, general, personal));
        return <div className={`${styles.boardBlock} ${excluded ? styles.boardBlockExcluded : ""}`} key={index}>{members.map(cell)}</div>;
      })
      : Array.from({ length: game.total }, (_, index) => cell(lotteryBoardNumber(slug, index)))}
  </div>;
}

const wheelSlugs = new Set<LotterySlug>(["lotofacil", "dia-de-sorte", "mega-sena", "quina", "mais-milionaria", "dupla-sena", "timemania"]);
const wheelLabels: Partial<Record<LotterySlug, string>> = {
  lotofacil: "Redução 18 → 6",
  "dia-de-sorte": "Redução por pool",
  "mega-sena": "Redução por pool",
  quina: "Redução por pool",
  "mais-milionaria": "Redução por pool",
  "dupla-sena": "Redução por pool",
  timemania: "Redução por pool",
};

export function LotteryGenerator({ histories, initialSlug }: { histories: Record<string, DrawNumbers[]>; initialSlug?: string }) {
  const [slug, setSlug] = useState<LotterySlug>(slugs.includes(initialSlug as LotterySlug) ? initialSlug as LotterySlug : "lotofacil");
  const [tool, setTool] = useState<"generator" | "wheel">("generator");
  return <div className={styles.hub} style={{ "--generator-accent": lotteryGames[slug].color } as CSSProperties}>
    <div className={styles.selectorBar}><label htmlFor="generator-lottery">Modalidade</label><select id="generator-lottery" value={slug} onChange={(event) => { setSlug(event.target.value as LotterySlug); setTool("generator"); }}>{slugs.map((entry) => <option value={entry} key={entry}>{lotteryGames[entry].name}</option>)}</select><span>Um gerador para cada volante</span></div>
    {wheelSlugs.has(slug) && <div className={styles.segment}><button type="button" className={tool === "generator" ? styles.active : ""} onClick={() => setTool("generator")}>Gerador</button><button type="button" className={tool === "wheel" ? styles.active : ""} onClick={() => setTool("wheel")}>{wheelLabels[slug]}</button></div>}
    {slug === "mais-milionaria" && tool === "wheel" ? <MilionariaWheelGenerator history={histories[slug] ?? []} />
      : slug === "mais-milionaria" ? <MilionariaGenerator history={histories[slug] ?? []} />
        : slug === "super-sete" ? <SuperSeteGenerator history={histories[slug] ?? []} />
          : slug === "lotofacil" && tool === "wheel" ? <LotofacilWheelGenerator history={histories[slug] ?? []} />
            : slug === "dia-de-sorte" && tool === "wheel" ? <DiaDeSorteWheelGenerator history={histories[slug] ?? []} />
            : (slug === "mega-sena" || slug === "quina" || slug === "dupla-sena" || slug === "timemania") && tool === "wheel" ? <NumberWheelGenerator slug={slug} history={histories[slug] ?? []} />
              : <StandardGenerator key={slug} slug={slug} history={histories[slug] ?? []} />}
  </div>;
}

function StandardGenerator({ slug, history }: { slug: LotterySlug; history: DrawNumbers[] }) {
  const game = lotteryGames[slug];
  const [quantity, setQuantity] = useState(4);
  const [size, setSize] = useState<number>(game.min);
  const [mode, setMode] = useState<GeneratorMode>("pure");
  const [repeatCount, setRepeatCount] = useState<number | null>(null);
  const [scope, setScope] = useState<"general" | "personal">("general");
  const [selectedGame, setSelectedGame] = useState(0);
  const [rules, setRules] = useState<{ general: string[]; personal: Record<number, string[]> }>({ general: [], personal: {} });
  const [randomBlockCount, setRandomBlockCount] = useState(0);
  const [randomBlocks, setRandomBlocks] = useState<Record<number, string[]>>({});
  const [fixedNumbers, setFixedNumbers] = useState<number[]>([]);
  const [avoidedNumbers, setAvoidedNumbers] = useState<number[]>([]);
  const [mirror, setMirror] = useState(false);
  const [lotomaniaMirrorMode, setLotomaniaMirrorMode] = useState(false);
  const [lotomaniaBoardView, setLotomaniaBoardView] = useState<"cross" | "blocks">("cross");
  const [pairCount, setPairCount] = useState(1);
  const [activePair, setActivePair] = useState(0);
  const [fixedByPair, setFixedByPair] = useState<number[][]>(() => Array.from({ length: 10 }, () => []));
  const [tickets, setTickets] = useState<GeneratedTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!tickets.length) return;
    resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [tickets]);

  const general = new Set(rules.general);
  const personalRules = (index: number, manual = rules.personal) => new Set([...(manual[index] ?? []), ...(randomBlocks[index] ?? [])]);
  const personal = personalRules(selectedGame);
  const fixed = new Set(fixedNumbers);
  const avoided = new Set(avoidedNumbers);
  const effectivePersonal = scope === "personal" ? personal : new Set<string>();
  const available = availableLotteryNumbers(slug, general, effectivePersonal).filter((number) => !avoided.has(number));
  const currentlyFixed = fixedByPair[activePair] ?? [];
  const latest = history[0];
  const repeats = useMemo(() => repeatHistory(history), [history]);
  const repeatBars = useMemo(
    () => Array.from({ length: Math.min(size, game.drawSize) + 1 }, (_, value) => ({ value, share: repeats.share(value), count: repeats.count(value) })),
    [repeats, size, game.drawSize],
  );
  const repeatPeak = Math.max(...repeatBars.map((entry) => entry.share), 0.0001);
  const ticketCount = mirror ? pairCount * 2 : lotomaniaMirrorMode ? quantity * 2 : quantity;
  const portfolio = useMemo(() => slug === "lotofacil" && !mirror && tickets.length ? lotofacilPortfolioProfile(tickets) : null, [slug, mirror, tickets]);

  function invalidate() { setTickets([]); setError(null); setCopied(false); }

  function toggleRule(key: string) {
    const next = { general: [...rules.general], personal: { ...rules.personal } };
    const target = scope === "general" ? next.general : [...(next.personal[selectedGame] ?? [])];
    const position = target.indexOf(key);
    if (position < 0) target.push(key); else target.splice(position, 1);
    if (scope === "personal") next.personal[selectedGame] = target;
    const invalid = Array.from({ length: quantity }, (_, index) => {
      const pool = availableLotteryNumbers(slug, new Set(next.general), new Set(next.personal[index] ?? [])).filter((number) => !avoided.has(number));
      if (pool.length < size || fixedNumbers.some((number) => !pool.includes(number))) return `Essa exclusão deixaria menos de ${size} dezenas ou bloquearia uma fixa no jogo ${index + 1}.`;
      return null;
    }).find((message) => message !== null);
    if (invalid) { setError(invalid); return; }
    setRules(next); setRandomBlockCount(0); setRandomBlocks({}); invalidate();
  }

  function drawRandomBlocks() {
    if (randomBlockCount === 0) { setRandomBlocks({}); invalidate(); return; }
    try {
      const generated = randomLotomaniaBlockRules({ quantity, count: randomBlockCount, general, personal: Array.from({ length: quantity }, (_, index) => new Set(rules.personal[index] ?? [])), fixed, avoided });
      setRandomBlocks(Object.fromEntries(generated.map((blocks, index) => [index, blocks])));
      setScope("personal"); setSelectedGame(0);
      invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sortear os blocos.");
    }
  }

  function generate(chosenMode: GeneratorMode = mode) {
    try {
      const generated = mirror
        ? generateMirrorPairs(fixedByPair.slice(0, pairCount))
        : lotomaniaMirrorMode
          ? generateLotomaniaMirrorPairs({ quantity, mode: chosenMode, repeatCount, general, personal: Array.from({ length: quantity }, (_, index) => personalRules(index)), fixed, avoided, history })
          : generateLotteryTickets({ slug, quantity, size, mode: chosenMode, repeatCount, general, personal: Array.from({ length: quantity }, (_, index) => personalRules(index)), fixed, avoided, history });
      if (!mirror && generated.some((ticket, index) => lotomaniaMirrorMode && index % 2 === 1 ? false : ticket.numbers.some((number) => avoided.has(number) || isNumberExcluded(slug, number, general, personalRules(lotomaniaMirrorMode ? Math.floor(index / 2) : index))))) {
        throw new Error("Uma cartela não respeitou as exclusões. Nenhum jogo foi exibido.");
      }
      setTickets(generated); setError(null); setCopied(false);
    } catch (cause) {
      setTickets([]); setError(cause instanceof Error ? cause.message : "Não foi possível gerar os jogos.");
    }
  }

  async function copyAll() {
    const content = tickets.map((ticket, index) => `${mirror ? `Par ${Math.floor(index / 2) + 1} · Cartela ${index % 2 ? "B" : "A"}` : lotomaniaMirrorMode ? `Par ${Math.floor(index / 2) + 1} · ${index % 2 ? "Espelho" : "Base"}` : `Jogo ${index + 1}`}: ${ticket.numbers.map(pad).join(" ")}${ticket.month ? ` | Mês: ${months[ticket.month - 1]}` : ""}`).join("\n");
    try { await navigator.clipboard.writeText(content); setCopied(true); setError(null); }
    catch { setError("Não foi possível copiar automaticamente. Selecione as cartelas e copie manualmente."); }
  }

  function toggleFixed(number: number) {
    const next = fixedByPair.map((numbers) => [...numbers]);
    const selected = next[activePair];
    if (selected.includes(number)) next[activePair] = selected.filter((entry) => entry !== number);
    else if (selected.length < 5) next[activePair] = [...selected, number];
    else { setError("Cada par usa exatamente 5 dezenas fixas. Remova uma antes de escolher outra."); return; }
    setFixedByPair(next); invalidate();
  }

  function toggleIntuitionFixed(number: number) {
    if (fixed.has(number)) { setFixedNumbers((current) => current.filter((entry) => entry !== number)); invalidate(); return; }
    if (fixed.size >= size) { setError(`O jogo tem ${size} vagas. Desfixe uma dezena antes de incluir outra.`); return; }
    const blocked = Array.from({ length: quantity }, (_, index) => !availableLotteryNumbers(slug, general, personalRules(index)).includes(number)).findIndex(Boolean);
    if (blocked >= 0) { setError(`A dezena ${pad(number)} está excluída no jogo ${blocked + 1}. Revise as áreas do volante.`); return; }
    setFixedNumbers((current) => [...current, number]);
    setAvoidedNumbers((current) => current.filter((entry) => entry !== number));
    invalidate();
  }

  function toggleIntuitionAvoided(number: number) {
    if (avoided.has(number)) { setAvoidedNumbers((current) => current.filter((entry) => entry !== number)); invalidate(); return; }
    const next = new Set([...avoided, number]);
    const blocked = Array.from({ length: quantity }, (_, index) => availableLotteryNumbers(slug, general, personalRules(index)).filter((entry) => !next.has(entry)).length < size).findIndex(Boolean);
    if (blocked >= 0) { setError(`Evitar a dezena ${pad(number)} deixaria o jogo ${blocked + 1} com menos de ${size} dezenas.`); return; }
    setAvoidedNumbers([...next]);
    setFixedNumbers((current) => current.filter((entry) => entry !== number));
    invalidate();
  }

  function changeSize(next: number) {
    if (fixed.size > next) { setError(`Você fixou ${fixed.size} dezenas. Desfixe algumas antes de escolher ${next}.`); return; }
    const blocked = Array.from({ length: quantity }, (_, index) => availableLotteryNumbers(slug, general, personalRules(index)).filter((number) => !avoided.has(number)).length < next).findIndex(Boolean);
    if (blocked >= 0) { setError(`O jogo ${blocked + 1} não tem ${next} dezenas livres.`); return; }
    setSize(next); setRepeatCount(null); invalidate();
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span className="eyebrow">Gerador de jogos</span><h1>Monte sua {game.name}.</h1><p>{slug === "dupla-sena" ? "Cada cartela concorre nos dois sorteios do concurso pelo mesmo preço — uma aposta, duas chances. A conferência histórica avalia os dois sorteios." : "Leia as dezenas, marque seus palpites e confira cada cartela no formato do volante."}</p></div><span className={styles.badge}>{game.total} números · {game.min} a {game.max} por jogo · {history.length} concursos na base</span></header>

    <div className={styles.layout}>
      <div className={styles.controls}>
        {slug === "lotofacil" && <section className={styles.card}><h2>Tipo de jogada</h2><div className={styles.segment}><button type="button" className={!mirror ? styles.active : ""} onClick={() => { setMirror(false); invalidate(); }}>Jogos normais</button><button type="button" className={mirror ? styles.active : ""} onClick={() => { setMirror(true); invalidate(); }}>Jogada espelho</button></div>{mirror && <p className={styles.helper}>No espelho, cada par compartilha 5 fixas. As outras 20 dezenas são divididas entre A e B: juntas, as duas cartelas cobrem as 25 dezenas.</p>}</section>}
        {slug === "lotomania" && <section className={styles.card}>
          <h2>Tipo de jogada</h2>
          <div className={styles.segment}>
            <button type="button" className={!lotomaniaMirrorMode ? styles.active : ""} onClick={() => { setLotomaniaMirrorMode(false); invalidate(); }}>Jogos normais</button>
            <button type="button" className={lotomaniaMirrorMode ? styles.active : ""} onClick={() => { setLotomaniaMirrorMode(true); setQuantity((current) => Math.min(current, 10)); setSelectedGame((current) => Math.min(current, 9)); setRandomBlockCount(0); setRandomBlocks({}); invalidate(); }}>Com espelho</button>
          </div>
          <p className={styles.helper}>O gerador tenta ocupar os 25 blocos 2 × 2, com 1 a 3 dezenas em cada. Só deixa um vazio ou completo quando as restrições exigem. No espelho, a outra cartela é o complemento exato.</p>
        </section>}

        {mirror ? <section className={styles.card}><div className={styles.sectionTitle}><span>01</span><div><h2>Monte os pares espelho</h2><p>As 5 fixas são próprias de cada par.</p></div></div><label className={styles.field}>Quantidade de pares<select value={pairCount} onChange={(event) => { const next = Number(event.target.value); setPairCount(next); setActivePair((current) => Math.min(current, next - 1)); invalidate(); }}>{Array.from({ length: 10 }, (_, index) => <option value={index + 1} key={index}>{index + 1} {index ? "pares" : "par"} · {(index + 1) * 2} cartelas</option>)}</select></label><div className={styles.tabs}>{Array.from({ length: pairCount }, (_, index) => <button type="button" key={index} className={activePair === index ? styles.tabActive : ""} onClick={() => setActivePair(index)}>Par {index + 1} · {fixedByPair[index].length}/5</button>)}</div><p className={styles.helper}>Escolha as 5 fixas do par {activePair + 1}:</p><div className={styles.fixedGrid}>{Array.from({ length: 25 }, (_, index) => <button type="button" key={index} className={currentlyFixed.includes(index + 1) ? styles.fixedActive : ""} aria-pressed={currentlyFixed.includes(index + 1)} onClick={() => toggleFixed(index + 1)}>{pad(index + 1)}</button>)}</div><button type="button" className={styles.clear} onClick={() => { setFixedByPair((current) => current.map((entry, index) => index === activePair ? [] : entry)); invalidate(); }}>Limpar fixas deste par</button></section>
        : <><section className={styles.card}>
          <div className={styles.sectionTitle}><span>01</span><div><h2>Defina os jogos</h2><p>Escolha a quantidade e as dezenas de cada cartela.</p></div></div>
          <div className={styles.fields}>
            <label className={styles.field}>{lotomaniaMirrorMode ? "Quantidade de pares" : "Quantidade"}<select value={quantity} onChange={(event) => { const next = Number(event.target.value); setQuantity(next); setSelectedGame((current) => Math.min(current, next - 1)); setRandomBlockCount(0); setRandomBlocks({}); invalidate(); }}>{Array.from({ length: lotomaniaMirrorMode ? 10 : 20 }, (_, index) => <option key={index} value={index + 1}>{index + 1} {lotomaniaMirrorMode ? (index ? "pares" : "par") : (index ? "jogos" : "jogo")}</option>)}</select></label>
            <label className={styles.field}>Dezenas por jogo<select value={size} onChange={(event) => changeSize(Number(event.target.value))}>{Array.from({ length: game.max - game.min + 1 }, (_, index) => <option key={index} value={game.min + index}>{game.min + index} dezenas</option>)}</select></label>
          </div>
          {size > game.min && <p className={styles.helper}>{slug === "lotofacil" ? `Uma cartela com ${size} dezenas embute ${integer.format(lotofacilSimpleBetCount(size))} apostas simples — veja o custo total ao lado.` : `Uma cartela com ${size} dezenas custa mais do que a aposta simples — veja o custo total ao lado.`}</p>}
        </section>
        <section className={styles.card}><div className={styles.sectionTitle}><span>02</span><div><h2>Escolha o critério</h2><p>Você pode comparar escolhas baseadas no histórico.</p></div></div><div className={styles.modeGrid}>{modes.filter((entry) => entry.value !== "coverage" || slug === "lotofacil").map((entry) => <button type="button" key={entry.value} disabled={!history.length && entry.value !== "pure"} className={mode === entry.value ? styles.modeActive : ""} aria-pressed={mode === entry.value} onClick={() => { setMode(entry.value); invalidate(); }}><strong>{entry.label}</strong><small>{entry.detail}</small></button>)}</div>{history.length ? <><label className={styles.field}>Repetidas do último concurso #{latest.contest}{lotomaniaMirrorMode ? " na base" : ""}<select value={repeatCount ?? "any"} onChange={(event) => { setRepeatCount(event.target.value === "any" ? null : Number(event.target.value)); invalidate(); }}><option value="any">Sem quantidade fixa</option>{Array.from({ length: Math.min(size, game.drawSize) + 1 }, (_, index) => <option value={index} key={index}>{index} repetidas{repeats.pairs ? ` · ${percent.format(repeats.share(index))} dos concursos` : ""}</option>)}</select></label>
          {repeats.pairs > 0 && <div className={styles.repeatChart} aria-label="Frequência histórica de dezenas repetidas entre concursos seguidos">
            <strong>Com que frequência isso acontece</strong>
            <div>{repeatBars.map((entry) => <button type="button" key={entry.value} aria-pressed={repeatCount === entry.value} className={repeatCount === entry.value ? styles.repeatBarActive : ""} onClick={() => { setRepeatCount(entry.value); invalidate(); }} title={`${entry.value} repetidas em ${integer.format(entry.count)} de ${integer.format(repeats.pairs)} concursos`}>
              <span style={{ height: `${Math.max(4, Math.round(entry.share / repeatPeak * 64))}px` }} />
              <b>{entry.value}</b>
            </button>)}</div>
            <small>{repeatCount === null ? `Base de ${integer.format(repeats.pairs)} concursos seguidos. Clique numa barra para fixar a quantidade.` : repeats.count(repeatCount) === 0 ? `Repetir ${repeatCount} dezenas nunca aconteceu nos ${integer.format(repeats.pairs)} concursos da base.` : `Repetir ${repeatCount} ${repeatCount === 1 ? "dezena aconteceu" : "dezenas aconteceu"} em ${integer.format(repeats.count(repeatCount))} de ${integer.format(repeats.pairs)} concursos (${percent.format(repeats.share(repeatCount))}).`}</small>
          </div>}</> : <p className={styles.helper}>Ainda não há resultados na base para aplicar critérios históricos ou repetições.</p>}</section>
        {canExclude(slug) && <section className={styles.card}>
          <div className={styles.sectionTitle}><span>03</span><div><h2>Exclua áreas do volante</h2><p>Regras gerais e individuais são somadas.</p></div></div>
          <div className={styles.segment}>
            <button type="button" className={scope === "general" ? styles.active : ""} onClick={() => setScope("general")}>Todos os jogos</button>
            <button type="button" className={scope === "personal" ? styles.active : ""} onClick={() => setScope("personal")}>Por jogo</button>
          </div>
          {scope === "personal" && <div className={styles.tabs}>{Array.from({ length: quantity }, (_, index) => <button type="button" key={index} className={selectedGame === index ? styles.tabActive : ""} onClick={() => setSelectedGame(index)}>{lotomaniaMirrorMode ? "Par" : "Jogo"} {index + 1}{personalRules(index).size ? " •" : ""}</button>)}</div>}
          <p className={styles.helper}>{scope === "general" ? lotomaniaMirrorMode ? "Estas exclusões valem para todas as cartelas-base." : "Estas exclusões valem para todos os jogos." : `Editando só ${lotomaniaMirrorMode ? "o par" : "o jogo"} ${selectedGame + 1}; as exclusões gerais continuam valendo.`}</p>
          {slug === "lotomania" && <div className={styles.randomBlocks}>
            <strong>Sortear blocos 2 × 2 por {lotomaniaMirrorMode ? "par" : "jogo"}</strong>
            <p className={styles.helper}>Opcional. Escolha quantos blocos adicionais excluir em cada cartela-base. Os blocos manuais continuam valendo; repetir o sorteio troca apenas os automáticos.</p>
            <div><label className={styles.field}>Blocos por {lotomaniaMirrorMode ? "par" : "jogo"}<select value={randomBlockCount} onChange={(event) => { setRandomBlockCount(Number(event.target.value)); setRandomBlocks({}); invalidate(); }}><option value={0}>Nenhum bloco automático</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index ? "blocos" : "bloco"}</option>)}</select></label><button type="button" disabled={randomBlockCount === 0} onClick={drawRandomBlocks}>Sortear para {quantity} {lotomaniaMirrorMode ? quantity === 1 ? "par" : "pares" : quantity === 1 ? "jogo" : "jogos"}</button></div>
            {Object.keys(randomBlocks).length > 0 && <><p className={styles.helper}>Sorteados: {Array.from({ length: quantity }, (_, index) => `${lotomaniaMirrorMode ? "par" : "jogo"} ${index + 1}: ${(randomBlocks[index] ?? []).map((key) => key.replace("block:", "B")).join(", ") || "nenhum"}`).join(" · ")}</p><button className={styles.clear} type="button" onClick={() => { setRandomBlockCount(0); setRandomBlocks({}); invalidate(); }}>Limpar blocos sorteados</button></>}
          </div>}
          {exclusionGroups(slug).map((group) => <div className={styles.ruleGroup} key={group.title}>
            <strong>{group.title}</strong>
            {group.block && <p className={styles.helper}>Cada quadradinho representa quatro dezenas. Marque para retirar as quatro {lotomaniaMirrorMode ? "da cartela-base; elas aparecerão no espelho." : "do jogo."}</p>}
            <div className={group.block ? styles.blockRuleGrid : ""}>{group.items.map((item) => {
              const inherited = scope === "personal" && general.has(item.key);
              const automatic = scope === "personal" && (randomBlocks[selectedGame] ?? []).includes(item.key);
              const selected = scope === "general" ? general.has(item.key) : personal.has(item.key);
              const blockNumbers = group.block ? item.label.split(" · ") : [];
              return <button type="button" key={item.key} disabled={inherited || automatic} aria-pressed={selected || inherited || automatic} aria-label={group.block ? `Excluir bloco ${item.label.replaceAll(" · ", ", ")}${automatic ? " (sorteado)" : ""}` : undefined} className={selected || inherited || automatic ? styles.ruleSelected : ""} onClick={() => toggleRule(item.key)}>{group.block ? <span className={styles.blockNumbers}><span>{blockNumbers[0]} {blockNumbers[1]}</span><span>{blockNumbers[2]} {blockNumbers[3]}</span></span> : item.label}</button>;
            })}</div>
          </div>)}
          <button type="button" className={styles.clear} onClick={() => { setRules((current) => scope === "general" ? { ...current, general: [] } : { ...current, personal: { ...current.personal, [selectedGame]: [] } }); setRandomBlockCount(0); setRandomBlocks({}); invalidate(); }}>Limpar {scope === "general" ? "regras gerais" : `${lotomaniaMirrorMode ? "par" : "jogo"} ${selectedGame + 1}`}</button>
        </section>}</>}
        {!mirror && <section className={styles.card}>
          <NumberInsightPicker history={history} total={game.total} start={game.start} baseOnly={lotomaniaMirrorMode} fixed={fixed} avoided={avoided} onFixed={toggleIntuitionFixed} onAvoided={toggleIntuitionAvoided} />
          {(fixedNumbers.length > 0 || avoidedNumbers.length > 0) && <p className={styles.helper}>{fixedNumbers.length} fixas · {avoidedNumbers.length} evitadas em todos os jogos.</p>}
        </section>}
      </div>

      <aside className={styles.preview}>
        <section className={styles.card}>
          <div className={styles.sectionTitle}><span>{mirror ? "02" : canExclude(slug) ? "04" : "03"}</span><div><h2>{mirror ? `Fixas do par ${activePair + 1}` : "Prévia do volante"}</h2><p>{mirror ? `${currentlyFixed.length} de 5 escolhidas` : `${available.length} de ${game.total} dezenas disponíveis`}</p></div></div>
          {slug === "lotomania" && <div className={styles.previewSwitch} role="group" aria-label="Visualização do volante"><button type="button" aria-pressed={lotomaniaBoardView === "cross"} onClick={() => setLotomaniaBoardView("cross")}>Cruz</button><button type="button" aria-pressed={lotomaniaBoardView === "blocks"} onClick={() => setLotomaniaBoardView("blocks")}>Blocos de 4</button></div>}
          <Board slug={slug} numbers={mirror ? currentlyFixed : fixedNumbers} general={mirror ? new Set() : general} personal={mirror ? new Set() : effectivePersonal} fixed={mirror ? currentlyFixed : fixedNumbers} avoided={mirror ? new Set() : avoided} lotomaniaView={lotomaniaBoardView} />
          <p className={styles.helper}>{slug === "lotomania" ? lotomaniaMirrorMode ? "Dezenas riscadas ficam fora da base e entram no espelho. Um bloco inteiro excluído na base fica completo no espelho." : lotomaniaBoardView === "blocks" ? "Cada quadradinho reúne quatro dezenas. As riscadas não entram nos jogos." : "A cruz separa os quadrantes. Dezenas riscadas não entram nos jogos." : canExclude(slug) ? "A cruz separa os quadrantes do volante. Dezenas riscadas não serão usadas." : slug === "dia-de-sorte" ? "Os números representam os dias; o Mês da Sorte é escolhido separadamente." : "Cada posição representa uma dezena do volante 5 × 5."}</p>
        </section>
        <section className={styles.actionBox}>
          <strong>{mirror ? `${pairCount} ${pairCount === 1 ? "par" : "pares"} · ${ticketCount} cartelas` : lotomaniaMirrorMode ? `${quantity} ${quantity === 1 ? "par" : "pares"} · ${ticketCount} cartelas de 50 dezenas` : `${quantity} ${quantity === 1 ? "jogo" : "jogos"} · ${size} dezenas`}</strong>
          <p className={styles.priceNote}>Custo estimado: <strong>{currency.format(standardTicketCost(slug, mirror ? game.drawSize : size, ticketCount) / 100)}</strong>. Confira o valor atualizado na <a href={`https://loterias.caixa.gov.br/Paginas/${slug === "lotofacil" ? "lotofacil" : slug === "mega-sena" ? "mega-sena" : slug === "quina" ? "quina" : slug === "lotomania" ? "lotomania" : "Dia-de-Sorte"}.aspx`} target="_blank" rel="noreferrer">CAIXA ↗</a>.</p>
          {!mirror && (fixedNumbers.length > 0 || avoidedNumbers.length > 0) && <p>Fixas: {fixedNumbers.length ? fixedNumbers.map(pad).join(" · ") : "nenhuma"} · Evitadas: {avoidedNumbers.length ? avoidedNumbers.map(pad).join(" · ") : "nenhuma"}</p>}
          {canExclude(slug) && !mirror && <p>{Array.from({ length: quantity }, (_, index) => `${lotomaniaMirrorMode ? "Par" : "Jogo"} ${index + 1}: ${availableLotteryNumbers(slug, general, personalRules(index)).filter((number) => !avoided.has(number)).length} livres`).join(" · ")}</p>}
          <button type="button" onClick={() => generate()}>Gerar {ticketCount} {ticketCount === 1 ? "jogo" : "cartelas"} ↗</button>
          {!mirror && history.length > 0 && <button type="button" className={styles.suggestion} onClick={() => { setMode("mixed"); generate("mixed"); }}>Sugestão Nexo: misto histórico</button>}
          <small>{lotomaniaMirrorMode ? "O gerador minimiza blocos vazios ou completos no par. Fixas, evitadas e exclusões se aplicam à base; o espelho usa o complemento exato." : slug === "lotomania" ? "O gerador prioriza presença nos 25 blocos e evita completá-los; relaxa a preferência somente quando necessário para montar 50 dezenas." : "Suas dezenas fixas e evitadas são respeitadas em todos os jogos normais."}</small>
        </section>
      </aside>
    </div>

    {error && <p className={styles.error} role="alert">{error}</p>}
    {tickets.length > 0 && <section ref={resultsRef} className={styles.results} aria-live="polite">
      <div className={styles.resultsHeader}><div><span className="eyebrow">Jogos gerados</span><h2>{tickets.length} cartelas prontas</h2><p>Copie ou anote: nesta versão, os jogos ainda não são salvos automaticamente.</p></div><button type="button" onClick={copyAll}>{copied ? "Copiados ✓" : "Copiar todos"}</button></div>
      {portfolio && <div className={styles.coverageSummary}><strong>Cobertura possível desta carteira</strong><div><span><b>{integer.format(portfolio.exact15Draws)}</b> combinações distintas para 15 pontos</span><span><b>{integer.format(portfolio.drawsWith14Plus)}</b> cenários distintos de 14 ou 15 pontos</span><span><b>{integer.format(portfolio.simpleBets)}</b> apostas simples embutidas</span><span><b>{portfolio.coveredNumbers}/25</b> dezenas presentes</span></div><p>{portfolio.raw14PlusDraws === portfolio.drawsWith14Plus ? "As cartelas não repetem cenários de 14+." : `${integer.format(portfolio.raw14PlusDraws - portfolio.drawsWith14Plus)} cenários de 14+ se repetem entre cartelas.`} Para 15 pontos, a carteira cobre {integer.format(portfolio.exact15Draws)} de {integer.format(portfolio.possibleDraws)} sorteios possíveis. Isto mostra possibilidades, não prêmios já obtidos.</p></div>}
      <HistoricalBacktest key={JSON.stringify(tickets)} slug={slug} tickets={tickets} availableContests={history.length} />
      <div className={styles.ticketGrid}>{tickets.map((ticket, index) => <article className={styles.ticket} key={`${index}-${ticket.numbers.join("-")}`}>
        <div><strong>{mirror ? `Par ${Math.floor(index / 2) + 1} · Cartela ${index % 2 ? "B" : "A"}` : lotomaniaMirrorMode ? `Par ${Math.floor(index / 2) + 1} · ${index % 2 ? "Espelho" : "Base"}` : `Jogo ${index + 1}`}</strong><small>{ticket.numbers.length} dezenas{slug === "lotomania" ? ` · blocos ocupados ${lotomaniaBlockCounts(ticket.numbers).filter((count) => count > 0).length}/25 · ${lotomaniaBlockCounts(ticket.numbers).filter((count) => count === 4).length} completos` : ""}</small></div>
        {canExclude(slug) && !(lotomaniaMirrorMode && index % 2 === 1) && <p className={styles.ticketRules}>{[...new Set([...rules.general, ...personalRules(lotomaniaMirrorMode ? Math.floor(index / 2) : index)])].length ? `${lotomaniaMirrorMode ? "Excluídas da base" : "Excluídas"}: ${[...new Set([...rules.general, ...personalRules(lotomaniaMirrorMode ? Math.floor(index / 2) : index)])].map(ruleLabel).join(" · ")}` : "Sem exclusões"}</p>}
        {lotomaniaMirrorMode && index % 2 === 1 && <p className={styles.ticketRules}>Complemento da cartela-base</p>}
        <Board slug={slug} numbers={ticket.numbers} general={lotomaniaMirrorMode && index % 2 === 1 ? new Set() : general} personal={lotomaniaMirrorMode && index % 2 === 1 ? new Set() : personalRules(lotomaniaMirrorMode ? Math.floor(index / 2) : index)} fixed={mirror ? fixedByPair[Math.floor(index / 2)] : lotomaniaMirrorMode && index % 2 === 1 ? [] : fixedNumbers} avoided={mirror || lotomaniaMirrorMode && index % 2 === 1 ? new Set() : avoided} lotomaniaView={lotomaniaBoardView} />
        <p>{ticket.numbers.map(pad).join(" · ")}</p>{ticket.month && <p className={styles.month}>Mês da Sorte: <strong>{months[ticket.month - 1]}</strong></p>}
      </article>)}</div>
    </section>}
    <p className={styles.source}>Confira regras e valores no <a href={`https://loterias.caixa.gov.br/Paginas/${slug === "lotofacil" ? "lotofacil" : slug === "mega-sena" ? "mega-sena" : slug === "quina" ? "quina" : slug === "lotomania" ? "lotomania" : "dia-de-sorte"}.aspx`} target="_blank" rel="noreferrer">site oficial da CAIXA ↗</a> antes de registrar a aposta.</p>
  </main>;
}

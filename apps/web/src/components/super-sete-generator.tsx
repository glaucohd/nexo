"use client";

import { useEffect, useRef, useState } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { SaveBetsButton } from "@/components/save-bets-button";
import { standardTicketPriceCents, type DrawNumbers, type GeneratorMode } from "@/lib/lottery-generator";
import { generateSuperSeteTickets, superSeteColumnSizes, superSeteCombinations, type SuperSeteRules, type SuperSeteTicket } from "@/lib/super-sete";

import styles from "./super-sete-generator.module.css";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const emptyRules: SuperSeteRules = { fixed: Array.from({ length: 7 }, () => []), avoided: Array.from({ length: 7 }, () => []) };
const modes: { value: GeneratorMode; label: string }[] = [
  { value: "pure", label: "Aleatório" }, { value: "hot", label: "Frequentes" },
  { value: "delayed", label: "Atrasados" }, { value: "mixed", label: "Misto histórico" },
];

function ColumnBoard({ columns }: { columns: readonly (readonly number[])[] }) {
  return <div className={styles.board} role="img" aria-label={columns.map((digits, index) => `Coluna ${index + 1}: ${digits.join(", ")}`).join("; ")}>
    {columns.map((digits, column) => <div className={styles.boardColumn} key={column}><strong>{column + 1}</strong>{Array.from({ length: 10 }, (_, digit) => <span key={digit} className={digits.includes(digit) ? styles.marked : ""}>{digit}</span>)}</div>)}
  </div>;
}

export function SuperSeteGenerator({ history }: { history: DrawNumbers[] }) {
  const [quantity, setQuantity] = useState(4);
  const [total, setTotal] = useState(7);
  const [mode, setMode] = useState<GeneratorMode>("pure");
  const [tickets, setTickets] = useState<SuperSeteTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const sizes = superSeteColumnSizes(total);

  useEffect(() => {
    if (tickets.length) resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [tickets]);

  function invalidate() { setTickets([]); setError(null); setCopied(false); }
  function generate(chosenMode = mode) {
    try { setTickets(generateSuperSeteTickets({ quantity, total, mode: chosenMode, history, rules: emptyRules })); setError(null); setCopied(false); }
    catch (cause) { setTickets([]); setError(cause instanceof Error ? cause.message : "Não foi possível gerar os jogos."); }
  }
  async function copyAll() {
    const content = tickets.map((ticket, index) => `Jogo ${index + 1}: ${ticket.columns.map((digits, column) => `C${column + 1} ${digits.join("/")}`).join(" · ")}`).join("\n");
    try { await navigator.clipboard.writeText(content); setCopied(true); }
    catch { setError("Não foi possível copiar automaticamente."); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span className="eyebrow">Gerador de jogos</span><h1>Monte sua <em>Super Sete</em>.</h1><p>São sete colunas independentes, de 0 a 9. Cada coluna precisa ter ao menos uma marcação.</p></div><span>{history.length} concursos na base</span></header>
    <div className={styles.layout}><div className={styles.controls}>
      <section className={styles.card}><h2>01 · Defina os jogos</h2><div className={styles.fields}><label>Quantidade de jogos<select value={quantity} onChange={(event) => { setQuantity(Number(event.target.value)); invalidate(); }}>{Array.from({ length: 20 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label><label>Dígitos por volante<select value={total} onChange={(event) => { setTotal(Number(event.target.value)); invalidate(); }}>{Array.from({ length: 15 }, (_, index) => <option key={index} value={index + 7}>{index + 7}</option>)}</select></label></div><p>{total <= 14 ? "De 1 a 2 dígitos por coluna." : "De 2 a 3 dígitos por coluna."} A distribuição prevista é {sizes.join(" + ")} dígitos nas colunas 1 a 7. Uma aposta múltipla contém várias combinações simples.</p></section>
      <section className={styles.card}><h2>02 · Critério de geração</h2><div className={styles.modes}>{modes.map((item) => <button key={item.value} type="button" disabled={item.value !== "pure" && !history.length} aria-pressed={mode === item.value} onClick={() => { setMode(item.value); invalidate(); }}>{item.label}</button>)}</div><p>Frequência e atraso são calculados separadamente em cada coluna, nunca misturando as posições.</p></section>
      <button className={styles.generate} type="button" onClick={() => generate()}>Gerar {quantity} {quantity === 1 ? "jogo" : "jogos"} ↗</button>
      <p className={styles.priceNote}>Custo estimado: <strong>{currency.format(quantity * sizes.reduce((product, size) => product * size, 1) * standardTicketPriceCents["super-sete"] / 100)}</strong> ({quantity} × {sizes.reduce((product, size) => product * size, 1)} apostas simples de {currency.format(standardTicketPriceCents["super-sete"] / 100)}). Confira o valor atualizado na <a href="https://loterias.caixa.gov.br/Paginas/super-sete.aspx" target="_blank" rel="noreferrer">CAIXA ↗</a>.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div><aside className={styles.preview}><span className="eyebrow">Estrutura do volante</span><h2>Sete colunas, sete posições</h2><ColumnBoard columns={emptyRules.fixed} /><p>O gerador escolhe os dígitos em cada coluna. O mesmo dígito pode aparecer em colunas diferentes.</p></aside></div>
    {tickets.length > 0 && <section ref={resultsRef} className={styles.results}><div className={styles.resultHeading}><div><span className="eyebrow">Jogos gerados</span><h2>{tickets.length} {tickets.length === 1 ? "cartela pronta" : "cartelas prontas"}</h2></div><div className={styles.roundActions}><SaveBetsButton key={JSON.stringify(tickets)} slug="super-sete" tickets={tickets.map((ticket) => ({ numbers: [], columns: ticket.columns }))} name={`Super Sete · ${tickets.length} ${tickets.length === 1 ? "jogo" : "jogos"}`} /><button type="button" onClick={copyAll}>{copied ? "Copiado ✓" : "Copiar jogos"}</button></div></div><HistoricalBacktest key={JSON.stringify(tickets)} slug="super-sete" tickets={tickets.map((ticket) => ({ numbers: [], columns: ticket.columns }))} availableContests={history.length} /><div className={styles.ticketGrid}>{tickets.map((ticket, index) => <article className={styles.ticket} key={index}><div><strong>Jogo {index + 1}</strong><small>{superSeteCombinations(ticket)} {superSeteCombinations(ticket) === 1 ? "aposta simples" : "apostas simples"} · {currency.format(superSeteCombinations(ticket) * standardTicketPriceCents["super-sete"] / 100)}</small></div><ColumnBoard columns={ticket.columns} /><p>{ticket.columns.map((digits, column) => `C${column + 1}: ${digits.join("/")}`).join(" · ")}</p></article>)}</div></section>}
  </main>;
}

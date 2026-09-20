"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { HistoricalBacktest } from "@/components/historical-backtest";
import { SaveBetsButton } from "@/components/save-bets-button";
import { buildProfile, generateProfileTickets, preferredComposition, type Composition, type ProfileDraw, type ProfileTicket, type Temperature } from "@/lib/hot-cold-profile";
import { lotteryGames, type LotterySlug } from "@/lib/lottery-generator";

import styles from "./hot-cold-profile.module.css";

// Modalidades com perfil de quentes, neutras e frias (dezenas em sequência e volante em colunas).
export const profileSlugs: ReadonlySet<string> = new Set(["lotofacil", "mega-sena", "quina", "mais-milionaria", "dia-de-sorte", "dupla-sena"]);

const windows = [15, 30, 50, 100] as const;
const pad = (number: number) => String(number).padStart(2, "0");
const temperatureLabel: Record<Temperature, string> = { hot: "Quentes", neutral: "Neutras", cold: "Frias" };
const temperatureSingular: Record<Temperature, string> = { hot: "quente", neutral: "neutra", cold: "fria" };
const temperatureClass: Record<Temperature, string> = { hot: styles.hot, neutral: styles.neutral, cold: styles.cold };
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const compositionText = ({ hot, neutral, cold }: Composition) => `${plural(hot, "quente", "quentes")} · ${plural(neutral, "neutra", "neutras")} · ${plural(cold, "fria", "frias")}`;

function Distribution({ rows, label, format, curve }: { rows: { value: number; count: number }[]; label: string; format: (value: number) => string; curve: number[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <div className={styles.distribution} role="list" aria-label={label}>{rows.map((row) => <div role="listitem" key={row.value} className={`${styles.distRow} ${curve.includes(row.value) ? styles.distTop : styles.distOut}`}>
    <span className={styles.distName}>{format(row.value)}{!curve.includes(row.value) && <em>fora da curva</em>}</span>
    <span className={styles.distTrack}><i style={{ width: `${(row.count / max) * 100}%` }} /></span>
    <span className={styles.distValue}>{row.count}× <small>{Math.round((row.count / total) * 100)}%</small></span>
  </div>)}</div>;
}

// `compact`: só a janela e os jogos (com o teste nos concursos anteriores), para a tela do gerador.
export function HotColdProfile({ slug, history, compact = false }: { slug: LotterySlug; history: ProfileDraw[]; compact?: boolean }) {
  const game = lotteryGames[slug];
  const [contests, setContests] = useState<(typeof windows)[number]>(30);
  const [round, setRound] = useState<{ id: number; tickets: ProfileTicket[]; copied: boolean } | null>(null);
  const profile = useMemo(() => buildProfile(history, game, contests), [history, game, contests]);
  const wanted = preferredComposition(game.drawSize);
  const delayed = [...profile.delays].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 10);
  const frameSize = profile.frame.size;
  const lateSet = new Set(profile.late);
  const isLate = (number: number) => lateSet.has(number);
  const isDupla = slug === "dupla-sena";
  const { curve, timeline } = profile;
  const percentOf = (part: number) => (curve.total ? Math.round((part / curve.total) * 100) : 0);
  const onlyParity = curve.outsideParity - curve.outsideBoth;
  const onlyFrame = curve.outsideFrame - curve.outsideBoth;
  const insideBoth = curve.total - curve.outsideAny;
  const sinceOutside = [...timeline].reverse().findIndex((entry) => entry.outsideParity || entry.outsideFrame);
  const segments = [
    { key: "in", label: "Na curva", count: insideBoth, className: styles.segIn },
    { key: "parity", label: "Fora só em pares/ímpares", count: onlyParity, className: styles.segParity },
    { key: "frame", label: "Fora só na moldura", count: onlyFrame, className: styles.segFrame },
    { key: "both", label: "Fora nos dois", count: curve.outsideBoth, className: styles.segBoth },
  ];

  function generate() {
    setRound((current) => ({ id: (current?.id ?? 0) + 1, tickets: generateProfileTickets({ profile, game }), copied: false }));
  }

  async function copy() {
    if (!round) return;
    const text = round.tickets.map((ticket, index) => `Jogo ${index + 1}: ${ticket.numbers.map(pad).join(" ")}${ticket.month ? ` · mês ${ticket.month}` : ""}${ticket.trevos ? ` · trevos ${ticket.trevos.join(" e ")}` : ""}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setRound({ ...round, copied: true });
    } catch { /* sem permissão para a área de transferência */ }
  }

  if (!profile.draws) return <div className={styles.empty}>Ainda não há concursos suficientes para montar o perfil.</div>;

  return <div className={styles.profile}>
    {compact && <section className={styles.panel}>
      <div className={styles.lead}>
        <div><span className="eyebrow">Gerador</span><h2>Jogos por quentes, neutras e frias</h2><p>Escolha quantos concursos recentes definem o que é quente, neutro e frio. Os jogos saem já com o teste nos concursos anteriores logo abaixo.</p></div>
        <Link className={styles.ghost} href={`/app/analises?modalidade=${slug}`}>Ver a análise completa →</Link>
      </div>
      <div className={styles.rangeBar}><span>Últimos:</span>{windows.map((size) => <button key={size} type="button" aria-pressed={contests === size} onClick={() => { setContests(size); setRound(null); }}>{size}</button>)}<span className={styles.rangeNote}>concursos</span></div>
    </section>}

    {!compact && <>
    <section className={styles.panel}>
      <div className={styles.lead}>
        <div><span className="eyebrow">Perfil dos últimos concursos</span><h2>Quentes, neutras e frias</h2><p>As {game.total} dezenas são divididas em três grupos pela frequência nos últimos {profile.contests} concursos{isDupla ? " (contando os dois sorteios de cada um)" : ""}: o terço que mais saiu é quente, o que menos saiu é frio e o meio é neutro.</p></div>
      </div>
      <div className={styles.rangeBar}><span>Últimos:</span>{windows.map((size) => <button key={size} type="button" aria-pressed={contests === size} onClick={() => { setContests(size); setRound(null); }}>{size}</button>)}<span className={styles.rangeNote}>concursos</span></div>
      <div className={styles.groups}>{(["hot", "neutral", "cold"] as const).map((kind) => <article key={kind} className={`${styles.group} ${temperatureClass[kind]}`}>
        <header><h3>{temperatureLabel[kind]}</h3><span>{profile[kind].length} dezenas</span></header>
        <div className={styles.balls}>{profile[kind].map((number) => <span key={number} className={`${styles.ball} ${isLate(number) ? styles.late : ""}`} title={`Dezena ${pad(number)} · ${profile.frequencies.get(number)}× nos últimos ${profile.contests} · atraso ${profile.delays.get(number)}${isLate(number) ? " · atrasada" : ""}`}>{pad(number)}<small>{profile.frequencies.get(number)}×</small></span>)}</div>
      </article>)}</div>
      <p className={styles.note}>O número pequeno é quantas vezes a dezena saiu na janela. Empates são resolvidos a favor de quem saiu mais recentemente. O ponto laranja marca as dezenas <b>atrasadas</b>.</p>
    </section>

    <div className={styles.twoColumns}>
      <section className={styles.panel}>
        <span className="eyebrow">Atrasadas</span><h2>{profile.late.length ? `${profile.late.length} ${profile.late.length === 1 ? "dezena atrasada" : "dezenas atrasadas"} agora` : "Nenhuma dezena atrasada agora"}</h2>
        <p className={styles.sub}>Atrasada é a que está há {profile.lateThreshold} ou mais concursos sem sair, o dobro do intervalo normal ({profile.expectedGap.toFixed(1).replace(".", ",")}). Abaixo, as 10 há mais tempo sem sair, contando todo o histórico.</p>
        <ol className={styles.delays}>{delayed.map(([number, delay]) => <li key={number} className={`${temperatureClass[profile.temperature.get(number)!]} ${isLate(number) ? styles.lateRow : ""}`}>
          <span className={styles.ball}>{pad(number)}</span>
          <span>{delay === 0 ? "saiu no último" : `${delay} ${delay === 1 ? "concurso" : "concursos"} sem sair`}</span>
          <em>{isLate(number) ? "atrasada · " : ""}{temperatureSingular[profile.temperature.get(number)!]}</em>
        </li>)}</ol>
        <p className={styles.note}>Atraso descreve o passado; não torna a dezena mais provável no próximo sorteio.</p>
      </section>

      <div className={styles.stack}>
        <section className={styles.panel}>
          <span className="eyebrow">Pares e ímpares</span><h2>Padrão dos {profile.draws} sorteios</h2>
          <p className={styles.sub}>Os dois mais frequentes formam a curva: os jogos preferenciais e de perfil médio tentam ficar neles.</p>
          <Distribution rows={profile.parity} label="Distribuição de pares e ímpares" format={(pairs) => `${plural(pairs, "par", "pares")} · ${plural(game.drawSize - pairs, "ímpar", "ímpares")}`} curve={profile.parityCurve} />
        </section>
        <section className={styles.panel}>
          <span className="eyebrow">Moldura e miolo</span><h2>Onde as dezenas caem no volante</h2>
          <p className={styles.sub}>Moldura: as {frameSize} dezenas da borda do volante. Miolo: as {game.total - frameSize} de dentro.</p>
          <Distribution rows={profile.frameCounts} label="Distribuição de moldura e miolo" format={(frame) => `${frame} moldura · ${game.drawSize - frame} miolo`} curve={profile.frameCurve} />
        </section>
      </div>
    </div>

    <section className={styles.panel}>
      <span className="eyebrow">Fora da curva</span><h2>Quando o sorteio foge do padrão</h2>
      <p className={styles.sub}>Chamamos de curva os dois padrões mais comuns de pares/ímpares e de moldura/miolo. O sorteio que fica fora de um deles (ou dos dois) é &ldquo;fora da curva&rdquo;. Acontece com frequência, e é por isso que parte dos jogos abaixo foge do padrão de propósito.</p>
      <div className={styles.curveStats}>
        <div><strong>{percentOf(curve.outsideAny)}%</strong><span>{curve.outsideAny} de {curve.total} sorteios ficaram fora da curva</span></div>
        <div><strong>{percentOf(curve.outsideParity)}%</strong><span>fora nos pares e ímpares ({curve.outsideParity})</span></div>
        <div><strong>{percentOf(curve.outsideFrame)}%</strong><span>fora na moldura e miolo ({curve.outsideFrame})</span></div>
        <div><strong>{sinceOutside < 0 ? "—" : sinceOutside === 0 ? "último" : sinceOutside}</strong><span>{sinceOutside < 0 ? "nenhum fora da curva na janela" : sinceOutside === 0 ? "sorteio foi fora da curva" : `sorteios desde o último fora da curva`}</span></div>
      </div>
      <div className={styles.stacked} role="img" aria-label={segments.map((segment) => `${segment.label}: ${segment.count}`).join("; ")}>{segments.filter((segment) => segment.count > 0).map((segment) => <span key={segment.key} className={segment.className} style={{ flexGrow: segment.count }} title={`${segment.label}: ${segment.count}`}>{percentOf(segment.count) >= 8 ? `${segment.count}` : ""}</span>)}</div>
      <ul className={styles.stackedLegend}>{segments.map((segment) => <li key={segment.key}><i className={segment.className} />{segment.label} <b>{segment.count}</b></li>)}</ul>
      <div className={styles.timeline} role="list" aria-label="Sorteios da janela, do mais antigo ao mais recente">{timeline.map((entry, index) => <span role="listitem" key={`${entry.contest}-${index}`} className={entry.outsideParity && entry.outsideFrame ? styles.segBoth : entry.outsideParity ? styles.segParity : entry.outsideFrame ? styles.segFrame : styles.segIn} title={`Concurso ${entry.contest} · ${plural(entry.pairs, "par", "pares")}, ${entry.frame} na moldura${entry.outsideParity || entry.outsideFrame ? " · fora da curva" : ""}`} />)}</div>
      <p className={styles.note}>Cada quadrado é um sorteio, do mais antigo (esquerda) ao mais recente (direita). Passe o mouse ou toque para ver o concurso. Estar fora da curva descreve o passado; não torna esse tipo de sorteio mais provável no próximo.</p>
    </section>

    </>}

    <section className={styles.panel}>
      <div className={styles.lead}>
        <div><span className="eyebrow">Jogos do perfil</span><h2>10 jogos com base nesses dados</h2><p><strong>4 preferenciais</strong> na composição de {compositionText(wanted)}. <strong>4 de perfil médio</strong>, na composição média dos últimos {profile.contests} concursos ({compositionText(profile.averageComposition)}). Esses 8 tentam ficar na curva. <strong>2 fora da curva</strong>: pares/ímpares ou moldura fora do padrão, com composição extrema que já saiu na janela ({compositionText(profile.compositionExtremes.coldHeavy)} e {compositionText(profile.compositionExtremes.hotHeavy)}).</p></div>
        <button type="button" className={styles.run} onClick={generate}>{round ? "Gerar outros 10 jogos" : "Gerar 10 jogos"}</button>
      </div>
      {round && <>
        <ol className={styles.tickets}>{round.tickets.map((ticket, index) => <li key={`${round.id}-${index}`} className={ticket.kind === "preferred" ? styles.preferred : ticket.kind === "outlier" ? styles.outlier : ""}>
          <div className={styles.ticketHead}><strong>Jogo {index + 1}</strong>{ticket.kind === "preferred" ? <span className={styles.badge}>Preferencial</span> : ticket.kind === "outlier" ? <span className={styles.badgeOut}>Fora da curva</span> : <span className={styles.badgeQuiet}>Perfil médio</span>}</div>
          <div className={styles.balls}>{ticket.numbers.map((number) => <span key={number} className={`${styles.ball} ${temperatureClass[profile.temperature.get(number)!]} ${isLate(number) ? styles.late : ""}`} title={`${temperatureLabel[profile.temperature.get(number)!]}${isLate(number) ? " · atrasada" : ""}`}>{pad(number)}</span>)}</div>
          <p className={styles.meta}>{compositionText(ticket.composition)} · {ticket.pairs} pares · {ticket.frame} moldura{ticket.numbers.filter(isLate).length ? ` · ${plural(ticket.numbers.filter(isLate).length, "atrasada", "atrasadas")}` : ""}{ticket.outsideParity || ticket.outsideFrame ? ` · fora da curva em ${[ticket.outsideParity && "pares/ímpares", ticket.outsideFrame && "moldura"].filter(Boolean).join(" e ")}` : ""}{ticket.month ? ` · mês ${ticket.month}` : ""}{ticket.trevos ? ` · trevos ${ticket.trevos.join(" e ")}` : ""}</p>
        </li>)}</ol>
        <HistoricalBacktest key={JSON.stringify(round.tickets)} slug={slug} tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers, ...(ticket.month ? { month: ticket.month } : {}), ...(ticket.trevos ? { trevos: ticket.trevos } : {}) }))} availableContests={history.length} />
        <div className={styles.actions}>
          <SaveBetsButton slug={slug} strategy={`Quentes/neutras/frias · últimos ${profile.contests} concursos · 4 preferenciais, 4 perfil médio, 2 fora da curva`} tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers, ...(ticket.month ? { month: ticket.month } : {}), ...(ticket.trevos ? { trevos: ticket.trevos } : {}) }))} name={`${game.name} · quentes, neutras e frias`} />
          <button type="button" className={styles.ghost} onClick={copy}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
        </div>
        <p className={styles.legend}><span className={`${styles.ball} ${styles.hot}`}>Q</span> quente <span className={`${styles.ball} ${styles.neutral}`}>N</span> neutra <span className={`${styles.ball} ${styles.cold}`}>F</span> fria</p>
      </>}
      <p className={styles.note}>É um palpite guiado pelo histórico: os sorteios são aleatórios e nenhum perfil aumenta a chance de acertar.</p>
    </section>
  </div>;
}

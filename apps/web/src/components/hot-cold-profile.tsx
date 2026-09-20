"use client";

import { useMemo, useState } from "react";

import { SaveBetsButton } from "@/components/save-bets-button";
import { buildProfile, generateProfileTickets, preferredComposition, type Composition, type ProfileDraw, type ProfileTicket, type Temperature } from "@/lib/hot-cold-profile";
import { lotteryGames, type LotterySlug } from "@/lib/lottery-generator";

import styles from "./hot-cold-profile.module.css";

const windows = [15, 30, 50, 100] as const;
const pad = (number: number) => String(number).padStart(2, "0");
const temperatureLabel: Record<Temperature, string> = { hot: "Quentes", neutral: "Neutras", cold: "Frias" };
const temperatureSingular: Record<Temperature, string> = { hot: "quente", neutral: "neutra", cold: "fria" };
const temperatureClass: Record<Temperature, string> = { hot: styles.hot, neutral: styles.neutral, cold: styles.cold };
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const compositionText = ({ hot, neutral, cold }: Composition) => `${hot} quentes · ${neutral} neutras · ${cold} frias`;

function Distribution({ rows, label, format, highlight = 2 }: { rows: { value: number; count: number }[]; label: string; format: (value: number) => string; highlight?: number }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <div className={styles.distribution} role="list" aria-label={label}>{rows.map((row, index) => <div role="listitem" key={row.value} className={`${styles.distRow} ${index < highlight ? styles.distTop : ""}`}>
    <span className={styles.distName}>{format(row.value)}</span>
    <span className={styles.distTrack}><i style={{ width: `${(row.count / max) * 100}%` }} /></span>
    <span className={styles.distValue}>{row.count}× <small>{Math.round((row.count / total) * 100)}%</small></span>
  </div>)}</div>;
}

export function HotColdProfile({ slug, history }: { slug: LotterySlug; history: ProfileDraw[] }) {
  const game = lotteryGames[slug];
  const [contests, setContests] = useState<(typeof windows)[number]>(30);
  const [round, setRound] = useState<{ id: number; tickets: ProfileTicket[]; copied: boolean } | null>(null);
  const profile = useMemo(() => buildProfile(history, game, contests), [history, game, contests]);
  const wanted = preferredComposition(game.drawSize);
  const delayed = [...profile.delays].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 10);
  const frameSize = profile.frame.size;
  const isDupla = slug === "dupla-sena";

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
    <section className={styles.panel}>
      <div className={styles.lead}>
        <div><span className="eyebrow">Perfil dos últimos concursos</span><h2>Quentes, neutras e frias</h2><p>As {game.total} dezenas são divididas em três grupos pela frequência nos últimos {profile.contests} concursos{isDupla ? " (contando os dois sorteios de cada um)" : ""}: o terço que mais saiu é quente, o que menos saiu é frio e o meio é neutro.</p></div>
      </div>
      <div className={styles.rangeBar}><span>Últimos:</span>{windows.map((size) => <button key={size} type="button" aria-pressed={contests === size} onClick={() => { setContests(size); setRound(null); }}>{size}</button>)}<span className={styles.rangeNote}>concursos</span></div>
      <div className={styles.groups}>{(["hot", "neutral", "cold"] as const).map((kind) => <article key={kind} className={`${styles.group} ${temperatureClass[kind]}`}>
        <header><h3>{temperatureLabel[kind]}</h3><span>{profile[kind].length} dezenas</span></header>
        <div className={styles.balls}>{profile[kind].map((number) => <span key={number} className={styles.ball} title={`Dezena ${pad(number)} · ${profile.frequencies.get(number)}× nos últimos ${profile.contests} · atraso ${profile.delays.get(number)}`}>{pad(number)}<small>{profile.frequencies.get(number)}×</small></span>)}</div>
      </article>)}</div>
      <p className={styles.note}>O número pequeno é quantas vezes a dezena saiu na janela. Empates são resolvidos a favor de quem saiu mais recentemente.</p>
    </section>

    <div className={styles.twoColumns}>
      <section className={styles.panel}>
        <span className="eyebrow">Atrasos</span><h2>Dezenas há mais tempo sem sair</h2>
        <p className={styles.sub}>Concursos desde a última aparição, contando todo o histórico da base.</p>
        <ol className={styles.delays}>{delayed.map(([number, delay]) => <li key={number} className={temperatureClass[profile.temperature.get(number)!]}>
          <span className={styles.ball}>{pad(number)}</span>
          <span>{delay === 0 ? "saiu no último" : `${delay} ${delay === 1 ? "concurso" : "concursos"} sem sair`}</span>
          <em>{temperatureSingular[profile.temperature.get(number)!]}</em>
        </li>)}</ol>
        <p className={styles.note}>Atraso descreve o passado; não torna a dezena mais provável no próximo sorteio.</p>
      </section>

      <div className={styles.stack}>
        <section className={styles.panel}>
          <span className="eyebrow">Pares e ímpares</span><h2>Padrão dos {profile.draws} sorteios</h2>
          <p className={styles.sub}>Os dois mais frequentes (destacados) são os que os jogos abaixo tentam seguir.</p>
          <Distribution rows={profile.parity} label="Distribuição de pares e ímpares" format={(pairs) => `${plural(pairs, "par", "pares")} · ${plural(game.drawSize - pairs, "ímpar", "ímpares")}`} />
        </section>
        <section className={styles.panel}>
          <span className="eyebrow">Moldura e miolo</span><h2>Onde as dezenas caem no volante</h2>
          <p className={styles.sub}>Moldura: as {frameSize} dezenas da borda do volante. Miolo: as {game.total - frameSize} de dentro.</p>
          <Distribution rows={profile.frameCounts} label="Distribuição de moldura e miolo" format={(frame) => `${frame} moldura · ${game.drawSize - frame} miolo`} />
        </section>
      </div>
    </div>

    <section className={styles.panel}>
      <div className={styles.lead}>
        <div><span className="eyebrow">Jogos do perfil</span><h2>10 jogos com base nesses dados</h2><p>Os 5 primeiros seguem a composição preferencial de <strong>{compositionText(wanted)}</strong>. Os outros 5 seguem a composição média dos últimos {profile.contests} concursos ({compositionText(profile.averageComposition)}). Todos tentam ficar nos padrões mais comuns de pares/ímpares e moldura/miolo.</p></div>
        <button type="button" className={styles.run} onClick={generate}>{round ? "Gerar outros 10 jogos" : "Gerar 10 jogos"}</button>
      </div>
      {round && <>
        <ol className={styles.tickets}>{round.tickets.map((ticket, index) => <li key={`${round.id}-${index}`} className={ticket.preferred ? styles.preferred : ""}>
          <div className={styles.ticketHead}><strong>Jogo {index + 1}</strong>{ticket.preferred ? <span className={styles.badge}>Preferencial</span> : <span className={styles.badgeQuiet}>Perfil médio</span>}</div>
          <div className={styles.balls}>{ticket.numbers.map((number) => <span key={number} className={`${styles.ball} ${temperatureClass[profile.temperature.get(number)!]}`} title={temperatureLabel[profile.temperature.get(number)!]}>{pad(number)}</span>)}</div>
          <p className={styles.meta}>{compositionText(ticket.composition)} · {ticket.pairs} pares · {ticket.frame} moldura{ticket.month ? ` · mês ${ticket.month}` : ""}{ticket.trevos ? ` · trevos ${ticket.trevos.join(" e ")}` : ""}</p>
        </li>)}</ol>
        <div className={styles.actions}>
          <SaveBetsButton slug={slug} strategy={`Quentes/neutras/frias · últimos ${profile.contests} concursos · preferencial ${compositionText(wanted)}`} tickets={round.tickets.map((ticket) => ({ numbers: ticket.numbers, ...(ticket.month ? { month: ticket.month } : {}), ...(ticket.trevos ? { trevos: ticket.trevos } : {}) }))} name={`${game.name} · quentes, neutras e frias`} />
          <button type="button" className={styles.ghost} onClick={copy}>{round.copied ? "Copiado ✓" : "Copiar jogos"}</button>
        </div>
        <p className={styles.legend}><span className={`${styles.ball} ${styles.hot}`}>Q</span> quente <span className={`${styles.ball} ${styles.neutral}`}>N</span> neutra <span className={`${styles.ball} ${styles.cold}`}>F</span> fria</p>
      </>}
      <p className={styles.note}>É um palpite guiado pelo histórico: os sorteios são aleatórios e nenhum perfil aumenta a chance de acertar.</p>
    </section>
  </div>;
}

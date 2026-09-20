"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { ContestGroupCard } from "@/components/bets-contest-group";
import { formatMoney, pluralize } from "@/lib/format";
import type { LotterySlug } from "@/lib/lottery-generator";
import { groupByContest, type ContestGroup, type SavedPortfolio } from "@/lib/saved-bets-groups";

import styles from "./bets-board.module.css";

type Filter = "all" | "waiting" | "drawn";

const PAGE_SIZE = 5;

/** Uma seção (aguardando / sorteados) com os concursos mais recentes e "mostrar mais" para o resto. */
function GroupSection({ title, groups, openFirst }: { title: string; groups: ContestGroup[]; openFirst: boolean }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  if (groups.length === 0) return null;
  const remaining = groups.length - shown;
  return <section className={styles.section}>
    <h2>{title} <small>{pluralize(groups.length, "concurso", "concursos")}</small></h2>
    {groups.slice(0, shown).map((group, index) => <ContestGroupCard key={group.key} group={group} defaultOpen={openFirst && index === 0} />)}
    {remaining > 0 && <button type="button" className={styles.more} onClick={() => setShown((current) => current + PAGE_SIZE)}>Mostrar mais concursos <span>({remaining} {remaining === 1 ? "restante" : "restantes"})</span></button>}
  </section>;
}

export function BetsBoard({ portfolios }: { portfolios: SavedPortfolio[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [game, setGame] = useState<LotterySlug | "all">("all");
  const games = [...new Map(portfolios.map((portfolio) => [portfolio.slug, portfolio])).values()];

  const allGroups = useMemo(() => groupByContest(portfolios), [portfolios]);
  const groups = useMemo(
    () => groupByContest(portfolios.filter((portfolio) => game === "all" || portfolio.slug === game)),
    [portfolios, game],
  );
  const waiting = groups.filter((group) => !group.drawn);
  const drawn = groups.filter((group) => group.drawn);

  // Balanço de tudo que já foi sorteado: o resultado vem do banco, sem precisar conferir à mão.
  const settled = allGroups.filter((group) => group.drawn);
  const prize = settled.reduce((sum, group) => sum + group.prizeCents, 0);
  const cost = settled.reduce((sum, group) => sum + group.costCents, 0);
  const balance = prize - cost;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <span className="eyebrow">Minhas apostas</span>
        <h1>Seus jogos <em>salvos</em>.</h1>
        <p>Salvar não registra aposta na CAIXA: é só para acompanhar. Cada carteira fica guardada para o concurso seguinte ao dia em que foi salva e, quando o sorteio entra na base, o resultado aparece aqui sozinho.</p>
      </div>
      <Link className="button button-primary" href="/app/gerador">Gerar novos jogos <span aria-hidden="true">→</span></Link>
    </header>

    {portfolios.length === 0 ? <section className={styles.empty}>
      <h2>Nenhum jogo salvo ainda.</h2>
      <p>Gere jogos ou uma redução e toque em &ldquo;Salvar jogos&rdquo;. Eles aparecem aqui, agrupados por concurso, com o resultado assim que sair.</p>
      <Link className="button button-primary" href="/app/gerador">Ir para o gerador <span aria-hidden="true">→</span></Link>
    </section> : <>
      <div className={styles.summary}>
        <div><span>Carteiras</span><strong>{portfolios.length}</strong><small>{pluralize(portfolios.reduce((sum, portfolio) => sum + portfolio.tickets.length, 0), "jogo", "jogos")}</small></div>
        <div><span>Aguardando sorteio</span><strong>{allGroups.filter((group) => !group.drawn).length}</strong><small>concursos</small></div>
        <div><span>Prêmios já sorteados</span><strong>{prize > 0 ? formatMoney(prize) : "—"}</strong><small>de {formatMoney(cost)} em apostas</small></div>
        <div><span>Saldo</span><strong className={settled.length === 0 ? "" : balance >= 0 ? styles.positive : styles.negative}>{settled.length === 0 ? "—" : formatMoney(balance)}</strong><small>prêmios − apostas</small></div>
      </div>

      <div className={styles.filters}>
        <div className={styles.statusTabs} role="group" aria-label="Situação">
          {([["all", "Todos"], ["waiting", "Aguardando"], ["drawn", "Sorteados"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        {games.length > 1 && <div className={styles.gameChips} role="group" aria-label="Modalidade">
          <button type="button" aria-pressed={game === "all"} onClick={() => setGame("all")}>Todas</button>
          {games.map((entry) => <button type="button" key={entry.slug} aria-pressed={game === entry.slug} style={{ "--chip": entry.color } as CSSProperties} onClick={() => setGame(entry.slug)}><i aria-hidden="true" />{entry.gameName}</button>)}
        </div>}
      </div>

      {filter !== "drawn" && <GroupSection key={`w-${game}`} title="Aguardando sorteio" groups={waiting} openFirst />}
      {filter !== "waiting" && <GroupSection key={`d-${game}`} title="Já sorteados" groups={drawn} openFirst />}
      {(filter === "waiting" ? waiting : filter === "drawn" ? drawn : groups).length === 0 && <p className={styles.nothing}>Nenhuma carteira com esses filtros.</p>}
    </>}
  </main>;
}

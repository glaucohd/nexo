"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ContestGroupCard } from "@/components/bets-contest-group";
import { formatMoney, pluralize } from "@/lib/format";
import type { LotterySlug } from "@/lib/lottery-generator";
import { groupByContest, type ContestGroup, type SavedPortfolio } from "@/lib/saved-bets-groups";

import styles from "./bets-board.module.css";

type Filter = "all" | "waiting" | "drawn" | "prized";

const PAGE_SIZE = 5;
// Não pergunta à CAIXA a cada visita: no máximo uma vez a cada 5 minutos por aba.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CHECK_KEY = "nexo:apostas:verificado-em";

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
  const router = useRouter();
  const [check, setCheck] = useState<"idle" | "checking" | "found" | "none" | "error">("idle");
  const pendingSlugs = useMemo(() => [...new Set(portfolios.filter((portfolio) => portfolio.draws.length === 0).map((portfolio) => portfolio.slug))], [portfolios]);
  const pendingKey = pendingSlugs.join(",");
  const checking = useRef(false);

  // Concurso que já aconteceu mas ainda não está na base: busca na CAIXA e recarrega.
  const runCheck = useCallback(async () => {
    if (!pendingKey || checking.current) return;
    checking.current = true;
    setCheck("checking");
    try { sessionStorage.setItem(CHECK_KEY, String(Date.now())); } catch { /* sem sessionStorage */ }
    try {
      const response = await fetch("/api/sync-caixa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs: pendingKey.split(",") }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setCheck(payload.imported > 0 ? "found" : "none");
      if (payload.imported > 0) router.refresh();
    } catch {
      setCheck("error");
    } finally {
      checking.current = false;
    }
  }, [pendingKey, router]);

  // Ao abrir a tela, verifica sozinho (no máximo a cada 5 minutos por aba).
  useEffect(() => {
    const timer = setTimeout(() => {
      let last = 0;
      try { last = Number(sessionStorage.getItem(CHECK_KEY) ?? 0); } catch { /* verifica mesmo assim */ }
      if (Date.now() - last >= CHECK_INTERVAL_MS) void runCheck();
    }, 0);
    return () => clearTimeout(timer);
  }, [runCheck]);

  const allGroups = useMemo(() => groupByContest(portfolios), [portfolios]);
  const groups = useMemo(
    () => groupByContest(portfolios.filter((portfolio) => game === "all" || portfolio.slug === game)),
    [portfolios, game],
  );
  const waiting = groups.filter((group) => !group.drawn);
  const drawn = groups.filter((group) => group.drawn);
  const prized = drawn.filter((group) => group.prized);

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

      {pendingSlugs.length > 0 && <p className={styles.checkLine} role="status">
        {check === "checking" ? "Buscando resultados na CAIXA…" : check === "found" ? "Resultados novos encontrados e conferidos." : check === "error" ? "Não consegui falar com a CAIXA agora." : check === "none" ? "Nenhum resultado novo na CAIXA." : "Os resultados são buscados na CAIXA ao abrir esta tela."}
        <button type="button" disabled={check === "checking"} onClick={() => void runCheck()}>Verificar agora</button>
      </p>}

      <div className={styles.filters}>
        <div className={styles.statusTabs} role="group" aria-label="Situação">
          {([["all", "Todos"], ["waiting", "Aguardando"], ["drawn", "Sorteados"], ["prized", "Premiadas"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        {games.length > 1 && <div className={styles.gameChips} role="group" aria-label="Modalidade">
          <button type="button" aria-pressed={game === "all"} onClick={() => setGame("all")}>Todas</button>
          {games.map((entry) => <button type="button" key={entry.slug} aria-pressed={game === entry.slug} style={{ "--chip": entry.color } as CSSProperties} onClick={() => setGame(entry.slug)}><i aria-hidden="true" />{entry.gameName}</button>)}
        </div>}
      </div>

      {(filter === "all" || filter === "waiting") && <GroupSection key={`w-${game}`} title="Aguardando sorteio" groups={waiting} openFirst />}
      {filter === "prized"
        ? <GroupSection key={`p-${game}`} title="Premiadas" groups={prized} openFirst />
        : filter !== "waiting" && <GroupSection key={`d-${game}`} title="Já sorteados" groups={drawn} openFirst />}
      {(filter === "waiting" ? waiting : filter === "drawn" ? drawn : filter === "prized" ? prized : groups).length === 0 && <p className={styles.nothing}>{filter === "prized" ? "Nenhum concurso premiado com esses filtros." : "Nenhuma carteira com esses filtros."}</p>}
    </>}
  </main>;
}

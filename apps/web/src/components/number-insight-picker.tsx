"use client";

import { useState } from "react";

import { numberInsights, type InsightDraw } from "@/lib/number-insights";

import styles from "./number-insight-picker.module.css";

type SortOrder = "number" | "frequent" | "delayed";

export function NumberInsightPicker({ history, total, start = 1, baseOnly = false, fixed, avoided, onFixed, onAvoided }: {
  history: readonly InsightDraw[];
  total: number;
  start?: number;
  baseOnly?: boolean;
  fixed: ReadonlySet<number>;
  avoided: ReadonlySet<number>;
  onFixed: (number: number) => void;
  onAvoided: (number: number) => void;
}) {
  const [sort, setSort] = useState<SortOrder>("number");
  const insights = numberInsights(history, total, 30, start);
  if (sort === "frequent") insights.sort((a, b) => b.frequency - a.frequency || a.number - b.number);
  if (sort === "delayed") insights.sort((a, b) => b.delay - a.delay || a.number - b.number);

  return <div className={styles.picker}>
    <div className={styles.heading}>
      <div><h3>Leia as dezenas e marque seu palpite</h3><p>{baseOnly ? "Fixar inclui a dezena em todas as cartelas-base; evitar a retira delas. Os espelhos recebem o complemento de cada base." : "Fixar inclui a dezena em todas as cartelas; evitar a retira. As demais são completadas pelo critério escolhido."}</p></div>
      <label>Ordenar<select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}><option value="number">Número</option><option value="frequent">Mais sorteadas</option><option value="delayed">Mais atrasadas</option></select></label>
    </div>
    <p className={styles.legend}>Base: {history.length} concursos · “30 recentes” usa {Math.min(history.length, 30)} · atraso = concursos desde a última aparição.</p>
    <div className={styles.grid}>{insights.map((item) => <div className={styles.item} key={item.number}>
      <strong>{String(item.number).padStart(2, "0")}</strong>
      <span>{history.length ? `${item.frequency}× na base` : "Sem histórico"} <small>{history.length ? `${item.recent}× nos ${Math.min(history.length, 30)} recentes · atraso ${item.delay}` : "Marque pela sua leitura"}</small></span>
      <div className={styles.actions}><button type="button" className={fixed.has(item.number) ? styles.fixed : ""} aria-pressed={fixed.has(item.number)} aria-label={`${fixed.has(item.number) ? "Desfixar" : "Fixar"} dezena ${item.number}`} onClick={() => onFixed(item.number)}>Fixar</button><button type="button" className={avoided.has(item.number) ? styles.avoided : ""} aria-pressed={avoided.has(item.number)} aria-label={`${avoided.has(item.number) ? "Permitir" : "Evitar"} dezena ${item.number}`} onClick={() => onAvoided(item.number)}>Evitar</button></div>
    </div>)}</div>
  </div>;
}

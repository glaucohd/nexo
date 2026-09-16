"use client";

import { useMemo, useState } from "react";

const draws = {
  lotofacil: { name: "Lotofácil", contest: 3779, date: "15/09/2026", numbers: [1,3,4,6,7,9,10,12,13,15,17,19,21,23,25], total: 25, color: "purple", columns: 5 },
  mega: { name: "Mega-Sena", contest: 3058, date: "15/09/2026", numbers: [14,23,53,56,57,60], total: 60, color: "green", columns: 10 },
  quina: { name: "Quina", contest: 6584, date: "15/09/2026", numbers: [5,13,39,58,80], total: 80, color: "violet", columns: 10 },
  milionaria: { name: "+Milionária", contest: 375, date: "15/09/2026", numbers: [4,6,10,21,31,38], total: 50, color: "blue", columns: 5 },
  dia: { name: "Dia de Sorte", contest: 1255, date: "15/09/2026", numbers: [2,7,12,19,24,27,31], total: 31, color: "amber", columns: 7 },
} as const;
type Modality = keyof typeof draws;

export default function ResultsPage() {
  const [selected, setSelected] = useState<Modality>("lotofacil");
  const [offset, setOffset] = useState(0);
  const draw = draws[selected] as { name: string; contest: number; date: string; numbers: readonly number[]; total: number; color: string; columns: number };
  const numbers = useMemo(() => Array.from({ length: draw.total }, (_, index) => index + 1), [draw.total]);
  const rows = Math.ceil(draw.total / draw.columns);
  return <div className={`results-page results-stage ${draw.color}`}>
    <header className="results-top"><div><div className="results-title-line"><h1>Sorteio a sorteio</h1><span className="results-count">{offset + 1} de 201</span></div><p>Uma cartela preenchida a cada concurso. Navegue e veja como as dezenas se espalham pelo volante.</p></div><label className="analysis-select"><span>Modalidade</span><select value={selected} onChange={(event) => { setSelected(event.target.value as Modality); setOffset(0); }}>{Object.entries(draws).map(([slug, item]) => <option key={slug} value={slug}>{item.name}</option>)}</select></label></header>
    <section className="draw-toolbar"><button className="draw-nav" type="button" aria-label="Concurso anterior" disabled={offset >= 200} onClick={() => setOffset((value) => Math.min(value + 1, 200))}>‹</button><div className="draw-center"><strong>Concurso {draw.contest - offset}</strong><span>{draw.date} · resultado confirmado</span></div><button className="draw-nav" type="button" aria-label="Próximo concurso" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(value - 1, 0))}>›</button></section>
    <section className="result-board"><div className="board-heading"><div><span className="eyebrow">{draw.name}</span><h2>Volante oficial</h2></div><span className="analysis-period">{draw.numbers.length} dezenas</span></div><div className="result-volante" style={{ "--result-cols": draw.columns } as React.CSSProperties}>{numbers.map((number) => <span className={draw.numbers.includes(number) ? "hit" : ""} key={number}>{String(number).padStart(2, "0")}</span>)}</div><div className="draw-line-stats">{Array.from({ length: rows }, (_, row) => <div key={row}><span>{row + 1}ª linha</span><b>{numbers.slice(row * draw.columns, (row + 1) * draw.columns).filter((number) => draw.numbers.includes(number)).length}</b></div>)}</div><div className="board-footer"><span>Dezenas sorteadas:</span><strong>{draw.numbers.map((number) => String(number).padStart(2, "0")).join(" · ")}</strong></div></section>
  </div>;
}

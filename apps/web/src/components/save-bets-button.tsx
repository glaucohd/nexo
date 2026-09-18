"use client";

import Link from "next/link";
import { useState } from "react";

import type { BacktestTicket } from "@/lib/historical-backtest";
import type { LotterySlug } from "@/lib/lottery-generator";

// Salva os jogos gerados em "Minhas apostas", para o próximo concurso.
export function SaveBetsButton({ slug, tickets, name, mode = "gerador", className = "" }: { slug: LotterySlug; tickets: BacktestTicket[]; name: string; mode?: string; className?: string }) {
  const [state, setState] = useState<{ kind: "idle" | "saving" } | { kind: "saved"; target: number } | { kind: "error"; message: string }>({ kind: "idle" });

  async function save() {
    setState({ kind: "saving" });
    try {
      const response = await fetch("/api/apostas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, name, mode, tickets }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar.");
      setState({ kind: "saved", target: payload.targetContest });
    } catch (cause) {
      setState({ kind: "error", message: cause instanceof Error ? cause.message : "Não foi possível salvar." });
    }
  }

  if (state.kind === "saved") {
    return <span className={`save-bets save-bets-done ${className}`} role="status">Salvo para o concurso #{state.target} · <Link href="/app/apostas">ver em Minhas apostas →</Link></span>;
  }
  return <span className={`save-bets ${className}`}>
    <button type="button" className="save-bets-button" disabled={state.kind === "saving"} onClick={save}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3.5h8.5L16.5 6.5v10h-11.5zM7.5 3.5v4h5v-4M7.5 16.5v-5h5v5" /></svg>
      {state.kind === "saving" ? "Salvando…" : `Salvar ${tickets.length} ${tickets.length === 1 ? "jogo" : "jogos"}`}
    </button>
    {state.kind === "error" && <small role="alert">{state.message}</small>}
  </span>;
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncCaixaButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/sync-caixa", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha ao atualizar.");
      const lastLine = (payload.output as string).split("\n").filter(Boolean).pop() ?? "Base em dia.";
      setMessage(lastLine);
      setState("done");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Falha ao atualizar.");
      setState("error");
    }
  }

  return <div className={`sync-caixa ${iconOnly ? "icon-only" : ""}`}>
    <button type="button" className="sidebar-action" aria-label={iconOnly ? "Atualizar base de resultados" : undefined} disabled={state === "loading"} onClick={sync}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={state === "loading" ? "spin" : ""}><path d="M16 10a6 6 0 0 1-10.2 4.3M4 10a6 6 0 0 1 10.2-4.3M14.5 2.8v3.1h-3.1M5.5 17.2v-3.1h3.1" /></svg>
      <span>{state === "loading" ? "Atualizando…" : "Atualizar base"}</span>
    </button>
    {message && <small className={state === "error" ? "sync-caixa-error" : "sync-caixa-message"}>{message}</small>}
  </div>;
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncCaixaButton() {
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

  return <div className="sync-caixa">
    <button type="button" className="signout-button" disabled={state === "loading"} onClick={sync}>
      {state === "loading" ? "Atualizando…" : "Atualizar base ↻"}
    </button>
    {message && <small className={state === "error" ? "sync-caixa-error" : "sync-caixa-message"}>{message}</small>}
  </div>;
}

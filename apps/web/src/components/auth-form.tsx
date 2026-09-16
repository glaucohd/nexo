"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

type Mode = "entrar" | "cadastro";

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();

    try {
      const result =
        mode === "cadastro"
          ? await authClient.signUp.email({ name, email, password })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(
          result.error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "E-mail ou senha incorretos."
            : result.error.message || "Não foi possível continuar agora.",
        );
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Verifique o servidor e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
  }

  return (
    <div className="auth-card">
      <h1>{mode === "cadastro" ? "Comece por aqui." : "Bem-vindo de volta."}</h1>
      <p>
        {mode === "cadastro"
          ? "Crie sua conta para manter análises e apostas organizadas."
          : "Entre para acessar suas apostas, análises e resultados."}
      </p>

      <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
        <button className={mode === "entrar" ? "active" : ""} type="button" onClick={() => changeMode("entrar")}>
          Entrar
        </button>
        <button className={mode === "cadastro" ? "active" : ""} type="button" onClick={() => changeMode("cadastro")}>
          Criar conta
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === "cadastro" && (
          <div className="field">
            <label htmlFor="name">Seu nome</label>
            <input id="name" name="name" autoComplete="name" minLength={2} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete={mode === "cadastro" ? "new-password" : "current-password"} minLength={8} required />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? "Aguarde…" : mode === "cadastro" ? "Criar minha conta" : "Entrar no Nexo"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { Brand } from "@/components/brand";

import styles from "./layout.module.css";

export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className={styles.unavailable}>
    <div className={styles.card}>
      <Brand />
      <span className="eyebrow">Conexão temporariamente indisponível</span>
      <h1>Não conseguimos carregar os dados agora.</h1>
      <p>Nada foi perdido. Tente novamente para refazer a consulta à base.</p>
      <button className="button button-primary" type="button" onClick={retry}>Tentar novamente</button>
    </div>
  </main>;
}

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { LotterySlug } from "./lottery-generator.ts";

const run = promisify(execFile);

// Nome de cada modalidade na API da CAIXA (o que o import-caixa.mjs espera em --game).
export const caixaApiSlugs: Record<LotterySlug, string> = {
  lotofacil: "lotofacil",
  "mega-sena": "megasena",
  quina: "quina",
  "mais-milionaria": "maismilionaria",
  "dia-de-sorte": "diadesorte",
  lotomania: "lotomania",
  "dupla-sena": "duplasena",
  timemania: "timemania",
  "super-sete": "supersete",
};

// Traz da CAIXA os concursos que faltam na base. Sem `slugs`, olha todas as
// modalidades nos últimos 30 concursos; com `slugs`, só essas e só os 5 mais
// recentes (rápido o bastante para rodar ao abrir uma tela).
export async function syncCaixa({ slugs, timeoutMs = 120_000 }: { slugs?: readonly LotterySlug[]; timeoutMs?: number } = {}) {
  const scope = slugs?.length ? [`--game=${[...new Set(slugs)].map((slug) => caixaApiSlugs[slug]).join(",")}`, "--recent=5"] : ["--recent=30"];
  const { stdout, stderr } = await run("node", [path.join(process.cwd(), "scripts", "import-caixa.mjs"), "--missing", ...scope], {
    cwd: process.cwd(),
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  });
  const imported = Number(/Importação concluída: (\d+) concursos/.exec(stdout)?.[1] ?? 0);
  return { output: stdout.trim(), warnings: stderr.trim() || null, imported };
}

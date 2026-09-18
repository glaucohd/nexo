import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

const run = promisify(execFile);

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Entre na sua conta para atualizar a base." }, { status: 401 });

  const scriptPath = path.join(process.cwd(), "scripts", "import-caixa.mjs");
  try {
    const { stdout, stderr } = await run("node", [scriptPath, "--missing", "--recent=30"], {
      cwd: process.cwd(),
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return Response.json({ output: stdout.trim(), warnings: stderr.trim() || null });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha desconhecida.";
    console.error("Atualização da base falhou:", message);
    return Response.json({ error: "Não foi possível atualizar a base agora. Tente novamente em instantes." }, { status: 503 });
  }
}

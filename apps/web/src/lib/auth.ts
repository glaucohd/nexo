import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  appName: "Nexo",
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  session: {
    // Reduz consultas ao Supabase em cada navegação. O conteúdo é criptografado
    // e assinado; ao expirar, a sessão volta a ser validada no banco.
    cookieCache: { enabled: true, maxAge: 5 * 60, strategy: "jwe" },
  },
  logger: {
    // O logger padrão imprime o erro Drizzle completo, incluindo o parâmetro da
    // consulta de sessão. Mantemos o evento sem expor o token no terminal.
    log(level, message) {
      if (level === "error" || level === "warn") console.warn(`[Better Auth] ${message}`);
      else if (level === "debug") console.debug(`[Better Auth] ${message}`);
      else console.info(`[Better Auth] ${message}`);
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
    },
  },
});

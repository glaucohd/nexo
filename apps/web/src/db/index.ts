import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://nexo:nexo@127.0.0.1:5432/nexo";

const globalForDatabase = globalThis as unknown as { nexoPool?: Pool };

export const pool =
  globalForDatabase.nexoPool ??
  new Pool({
    connectionString: databaseUrl,
    max: process.env.NODE_ENV === "production" ? 10 : 3,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.nexoPool = pool;
}

export const db = drizzle(pool, { schema });

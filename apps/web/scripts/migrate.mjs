import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnvFile } from "node:process";
import pg from "pg";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

try {
  loadEnvFile(path.resolve(currentDir, "../.env"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Defina DATABASE_URL antes de executar as migrações.");
}

const migrationsDir = path.resolve(currentDir, "../migrations");
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();

try {
  await client.query(`
    create table if not exists _nexo_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await client.query(
      "select 1 from _nexo_migrations where name = $1",
      [file],
    );

    if (applied.rowCount) continue;

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await client.query("begin");

    try {
      await client.query(sql);
      await client.query("insert into _nexo_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`Aplicada: ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}

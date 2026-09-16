import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const directory = path.dirname(fileURLToPath(import.meta.url));
try {
  loadEnvFile(path.resolve(directory, "../.env"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

const sources = [
  { slug: "lotofacil", file: "historico.json", total: 25, size: 15 },
  { slug: "mega-sena", file: "megasena.json", total: 60, size: 6 },
  { slug: "quina", file: "quina.json", total: 80, size: 5 },
  { slug: "mais-milionaria", file: "maismilionaria.json", total: 50, size: 6 },
  { slug: "dia-de-sorte", file: "diadesorte.json", total: 31, size: 7 },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  for (const source of sources) {
    const file = path.resolve(directory, "../../../dados", source.file);
    const { concursos } = JSON.parse(await readFile(file, "utf8"));
    const seen = new Set();
    const records = concursos.map((item) => {
      const numbers = [...item.dezenas].sort((a, b) => a - b);
      const [day, month, year] = item.data.split("/").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day, 12));
      if (!Number.isInteger(item.concurso) || item.concurso < 1 || seen.has(item.concurso)) throw new Error(`Concurso inválido em ${source.file}`);
      if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1 || date.getUTCFullYear() !== year) throw new Error(`Data inválida no concurso ${item.concurso}`);
      if (numbers.length !== source.size || new Set(numbers).size !== source.size || numbers.some((number) => !Number.isInteger(number) || number < 1 || number > source.total)) throw new Error(`Dezenas inválidas no concurso ${item.concurso}`);
      seen.add(item.concurso);
      const extras = source.slug === "mais-milionaria" ? { trevos: item.trevos } : source.slug === "dia-de-sorte" ? { mes: item.trevos?.[0] } : null;
      const checksum = createHash("sha256").update(JSON.stringify({ contest: item.concurso, date: item.data, numbers, extras })).digest("hex");
      return { contest: item.concurso, date: date.toISOString(), numbers, extras, status: item.provisorio ? "provisional" : "confirmed", checksum };
    });

    await client.query("begin");
    try {
      const result = await client.query(
        `insert into draws (lottery_id, contest_number, drawn_at, numbers, extras, source, status, checksum)
         select l.id, r.contest, r.date::timestamptz, r.numbers, r.extras,
                'legacy-history', r.status::draw_status, r.checksum
         from lotteries l,
              jsonb_to_recordset($2::jsonb) as r(contest integer, date text, numbers jsonb, extras jsonb, status text, checksum text)
         where l.slug = $1
         on conflict (lottery_id, contest_number) do nothing`,
        [source.slug, JSON.stringify(records)],
      );
      await client.query("commit");
      console.log(`${source.slug}: ${result.rowCount} concursos inseridos, ${records.length - result.rowCount} já existentes.`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}

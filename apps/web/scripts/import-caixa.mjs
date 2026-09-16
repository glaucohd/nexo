import crypto from "node:crypto";
import { loadEnvFile } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
try { loadEnvFile(path.resolve(here, "../.env")); } catch (error) { if (error?.code !== "ENOENT") throw error; }

const API = "https://servicebus2.caixa.gov.br/portaldeloterias/api";
const games = {
  lotofacil: ["lotofacil", "Lotofácil", 25, 15],
  megasena: ["mega-sena", "Mega-Sena", 60, 6],
  quina: ["quina", "Quina", 80, 5],
  maismilionaria: ["mais-milionaria", "+Milionária", 50, 6],
  diadesorte: ["dia-de-sorte", "Dia de Sorte", 31, 7],
  lotomania: ["lotomania", "Lotomania", 100, 20],
  duplasena: ["dupla-sena", "Dupla Sena", 50, 6],
  timemania: ["timemania", "Timemania", 80, 7],
  supersete: ["super-sete", "Super Sete", 10, 7],
};

const args = process.argv.slice(2);
const requested = args.find((arg) => arg.startsWith("--game="))?.split("=")[1] ?? "all";
const fromArg = Number(args.find((arg) => arg.startsWith("--from="))?.split("=")[1] ?? 0);
const toArg = Number(args.find((arg) => arg.startsWith("--to="))?.split("=")[1] ?? 0);
const all = args.includes("--all");
const selected = requested === "all" ? Object.keys(games) : [requested];

if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL no apps/web/.env");
for (const game of selected) if (!games[game]) throw new Error(`Modalidade desconhecida: ${game}`);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const date = (value) => { const [day, month, year] = value.split("/"); return `${year}-${month}-${day}T12:00:00Z`; };
const hash = (payload) => crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
const json = (value) => JSON.stringify(value).replaceAll("\\u0000", "");

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Nexo/1.0" } });
  if (!response.ok) throw new Error(`${response.status} em ${url}`);
  return response.json();
}

async function importDraw(apiSlug, contest) {
  const payload = await fetchJson(`${API}/${apiSlug}/${contest}`);
  if (!payload?.numero || !payload?.listaDezenas?.length) return false;
  const [slug, name, total, drawSize] = games[apiSlug];
  const extras = {};
  if (Array.isArray(payload.trevos)) extras.trevos = payload.trevos.map(Number);
  if (payload.nomeTimeCoracaoMesSorte && apiSlug === "diadesorte") extras.mesSorte = payload.nomeTimeCoracaoMesSorte.trim();
  if (payload.nomeTimeCoracaoMesSorte && apiSlug === "timemania") extras.timeCoracao = payload.nomeTimeCoracaoMesSorte.trim();
  const cleanExtras = Object.keys(extras).length ? extras : null;
  const source = `caixa:${apiSlug}`;
  const checksum = hash(payload);
  await client.query("begin");
  try {
    const lottery = await client.query(`insert into lotteries (slug,name,total_numbers,draw_size) values ($1,$2,$3,$4) on conflict (slug) do update set name=excluded.name,total_numbers=excluded.total_numbers,draw_size=excluded.draw_size,updated_at=now() returning id`, [slug, name, total, drawSize]);
    const draw = await client.query(`insert into draws (lottery_id,contest_number,drawn_at,numbers,extras,source,status,checksum) values ($1,$2,$3,$4,$5,$6,'confirmed',$7) on conflict (lottery_id,contest_number) do update set numbers=excluded.numbers,extras=excluded.extras,drawn_at=excluded.drawn_at,source=excluded.source,checksum=excluded.checksum,status='confirmed',updated_at=now() returning id`, [lottery.rows[0].id, payload.numero, date(payload.dataApuracao), json(payload.listaDezenas.map(Number).sort((a,b)=>a-b)), cleanExtras ? json(cleanExtras) : null, source, checksum]);
    const drawId = draw.rows[0].id;
    await client.query("insert into source_payloads (draw_id,source,external_id,payload,hash) values ($1,$2,$3,$4,$5) on conflict (source,hash) do nothing", [drawId, source, String(payload.numero), json(payload), checksum]);
    await client.query("delete from prize_tiers where draw_id=$1", [drawId]);
    for (const prize of payload.listaRateioPremio ?? []) await client.query("insert into prize_tiers (draw_id,label,hits,winners,prize) values ($1,$2,$3,$4,$5)", [drawId, prize.descricaoFaixa, prize.faixa ?? 0, prize.numeroDeGanhadores ?? 0, prize.valorPremio ?? null]);
    await client.query("commit");
    return true;
  } catch (error) { await client.query("rollback"); throw error; }
}

let totalImported = 0;
try {
  for (const apiSlug of selected) {
    const latest = await fetchJson(`${API}/${apiSlug}`);
    const first = all ? 1 : (fromArg || latest.numero);
    const last = toArg || latest.numero;
    console.log(`${games[apiSlug][1]}: concursos ${first}–${last}`);
    for (let contest = first; contest <= last; contest += 1) {
      try { if (await importDraw(apiSlug, contest)) totalImported += 1; }
      catch (error) { console.warn(`  ${contest}: ${error.message}`); }
      if (all) await sleep(80);
      if (contest % 100 === 0) console.log(`  até ${contest}`);
    }
  }
} finally { await client.end(); }
console.log(`Importação concluída: ${totalImported} concursos processados.`);

import crypto from "node:crypto";
import https from "node:https";
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
  duplasena: ["dupla-sena-1", "Dupla Sena (1º sorteio)", 50, 6],
  timemania: ["timemania", "Timemania", 80, 7],
  supersete: ["super-sete", "Super Sete", 70, 7],
};
// A Dupla Sena sorteia duas vezes por concurso, cada sorteio com sua própria
// faixa de prêmios (listaRateioPremio traz as 4 faixas do 1º sorteio seguidas
// das 4 do 2º). O banco só guarda 1 array de dezenas por concurso, então o
// 2º sorteio vira uma "loteria" própria (dupla-sena-2), com seu próprio
// histórico e conferência independentes.
const DUPLA_SENA_SECOND_DRAW = ["dupla-sena-2", "Dupla Sena (2º sorteio)", 50, 6];

const args = process.argv.slice(2);
const requested = args.find((arg) => arg.startsWith("--game="))?.split("=")[1] ?? "all";
const fromArg = Number(args.find((arg) => arg.startsWith("--from="))?.split("=")[1] ?? 0);
const toArg = Number(args.find((arg) => arg.startsWith("--to="))?.split("=")[1] ?? 0);
const recentArg = Number(args.find((arg) => arg.startsWith("--recent="))?.split("=")[1] ?? 0);
// A API da CAIXA passa a responder 403 sob rajada; estes controles permitem
// baixar devagar (menos paralelismo, mais pausa) quando o bloqueio aparece.
const workersArg = Math.max(1, Number(args.find((arg) => arg.startsWith("--workers="))?.split("=")[1] ?? 4));
const delayArg = Math.max(0, Number(args.find((arg) => arg.startsWith("--delay="))?.split("=")[1] ?? 100));
const all = args.includes("--all");
const missingOnly = args.includes("--missing");
const selected = requested === "all" ? Object.keys(games) : requested.split(",");

if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL no apps/web/.env");
for (const game of selected) if (!games[game]) throw new Error(`Modalidade desconhecida: ${game}`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const date = (value) => { const [day, month, year] = value.split("/"); return `${year}-${month}-${day}T12:00:00Z`; };
const hash = (payload) => crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
const json = (value) => JSON.stringify(value).replaceAll("\\u0000", "");

let caixaIpsPromise;
let caixaIpIndex = 0;
async function caixaIps() {
  caixaIpsPromise ??= fetch("https://dns.google/resolve?name=servicebus2.caixa.gov.br&type=A", { signal: AbortSignal.timeout(10000) })
    .then((response) => { if (!response.ok) throw new Error(`DNS público: ${response.status}`); return response.json(); })
    .then((payload) => {
      const ips = (payload.Answer ?? []).filter((answer) => answer.type === 1).map((answer) => answer.data);
      if (!ips.length) throw new Error("DNS público não retornou endereços da CAIXA");
      return ips;
    }).catch((error) => { caixaIpsPromise = undefined; throw error; });
  return caixaIpsPromise;
}

async function fetchCaixaWithDnsFallback(url) {
  const ips = await caixaIps();
  const ip = ips[caixaIpIndex++ % ips.length];
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { Accept: "application/json", "User-Agent": "Nexo/1.0" },
      lookup: (_hostname, _options, callback) => callback(null, ip, 4),
      timeout: 15000,
    }, (response) => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`${response.statusCode} em ${url}`)); return; }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error(`Tempo esgotado em ${url}`)));
    request.on("error", reject);
  });
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Nexo/1.0" }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`${response.status} em ${url}`);
      return await response.json();
    } catch (error) {
      if (error?.cause?.code === "ENOTFOUND" && new URL(url).hostname === "servicebus2.caixa.gov.br") {
        try { return await fetchCaixaWithDnsFallback(url); }
        catch (fallbackError) { error = fallbackError; }
      }
      if (attempt === 2) throw error;
      await sleep(500 * (attempt + 1));
    }
  }
}

function parseNumbers(rawDezenas, apiSlug, total, drawSize) {
  const positional = apiSlug === "supersete";
  const numbers = rawDezenas.map(Number);
  if (!positional) numbers.sort((a, b) => a - b);
  const firstNumber = apiSlug === "lotomania" || positional ? 0 : 1;
  const largest = positional ? 9 : firstNumber + total - 1;
  if (numbers.length !== drawSize || (!positional && new Set(numbers).size !== drawSize) || numbers.some((number) => !Number.isInteger(number) || number < firstNumber || number > largest)) {
    throw new Error("Dezenas inválidas");
  }
  return numbers;
}

async function writeDraw({ slug, name, total, drawSize, contest, drawnAt, numbers, extras, prizes, source, payload }) {
  const cleanExtras = extras && Object.keys(extras).length ? extras : null;
  const checksum = hash({ payload, slug });
  const client = await pool.connect();
  await client.query("begin");
  try {
    const lottery = await client.query(`insert into lotteries (slug,name,total_numbers,draw_size) values ($1,$2,$3,$4) on conflict (slug) do update set name=excluded.name,total_numbers=excluded.total_numbers,draw_size=excluded.draw_size,updated_at=now() returning id`, [slug, name, total, drawSize]);
    const draw = await client.query(`insert into draws (lottery_id,contest_number,drawn_at,numbers,extras,source,status,checksum) values ($1,$2,$3,$4,$5,$6,'confirmed',$7) on conflict (lottery_id,contest_number) do update set numbers=excluded.numbers,extras=excluded.extras,drawn_at=excluded.drawn_at,source=excluded.source,checksum=excluded.checksum,status='confirmed',updated_at=now() returning id`, [lottery.rows[0].id, contest, drawnAt, json(numbers), cleanExtras ? json(cleanExtras) : null, source, checksum]);
    const drawId = draw.rows[0].id;
    await client.query("insert into source_payloads (draw_id,source,external_id,payload,hash) values ($1,$2,$3,$4,$5) on conflict (source,hash) do nothing", [drawId, source, String(contest), json(payload), checksum]);
    await client.query("delete from prize_tiers where draw_id=$1", [drawId]);
    for (const prize of prizes) {
      const hits = Number(prize.descricaoFaixa?.match(/^(\d+)/)?.[1] ?? 0);
      const extraHits = prize.descricaoFaixa?.match(/\+ (\d+) trevo/)?.[1];
      await client.query("insert into prize_tiers (draw_id,label,hits,extra_hits,winners,prize) values ($1,$2,$3,$4,$5,$6)", [drawId, prize.descricaoFaixa, hits, extraHits ? Number(extraHits) : null, prize.numeroDeGanhadores ?? 0, prize.valorPremio ?? null]);
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

async function importDraw(apiSlug, contest) {
  const payload = await fetchJson(`${API}/${apiSlug}/${contest}`);
  if (!payload?.numero || !payload?.listaDezenas?.length) return false;
  const [slug, name, total, drawSize] = games[apiSlug];
  if (payload.numero !== contest) throw new Error(`Concurso ${contest}: API retornou ${payload.numero}`);
  const numbers = parseNumbers(payload.listaDezenas, apiSlug, total, drawSize);
  const extras = {};
  if (Array.isArray(payload.trevosSorteados)) extras.trevos = payload.trevosSorteados.map(Number);
  if (payload.nomeTimeCoracaoMesSorte && apiSlug === "diadesorte") extras.mesSorte = payload.nomeTimeCoracaoMesSorte.trim();
  if (payload.nomeTimeCoracaoMesSorte && apiSlug === "timemania") extras.timeCoracao = payload.nomeTimeCoracaoMesSorte.trim();
  const drawnAt = date(payload.dataApuracao);
  const source = `caixa:${apiSlug}`;
  const prizes = payload.listaRateioPremio ?? [];

  if (apiSlug === "duplasena") {
    if (!Array.isArray(payload.listaDezenasSegundoSorteio) || payload.listaDezenasSegundoSorteio.length !== drawSize) {
      throw new Error("Formato inesperado da Dupla Sena: 2º sorteio ausente");
    }
    const secondNumbers = parseNumbers(payload.listaDezenasSegundoSorteio, apiSlug, total, drawSize);
    // O campo "faixa" separa os sorteios: 1 a 4 são do 1º, 5 a 8 do 2º. Os
    // concursos antigos publicam só parte das faixas, então não dá para
    // dividir a lista pela metade.
    const firstPrizes = prizes.filter((prize) => Number(prize.faixa) <= 4);
    const secondPrizes = prizes.filter((prize) => Number(prize.faixa) >= 5);
    await writeDraw({ slug, name, total, drawSize, contest, drawnAt, numbers, extras: null, prizes: firstPrizes, source, payload });
    const [slug2, name2, total2, drawSize2] = DUPLA_SENA_SECOND_DRAW;
    await writeDraw({ slug: slug2, name: name2, total: total2, drawSize: drawSize2, contest, drawnAt, numbers: secondNumbers, extras: null, prizes: secondPrizes, source, payload });
    return true;
  }

  await writeDraw({ slug, name, total, drawSize, contest, drawnAt, numbers, extras, prizes, source, payload });
  return true;
}

let totalImported = 0;
let failures = 0;
try {
  for (const apiSlug of selected) {
    const latest = await fetchJson(`${API}/${apiSlug}`);
    const first = all ? 1 : (fromArg || (recentArg ? Math.max(1, latest.numero - recentArg + 1) : latest.numero));
    const last = toArg || latest.numero;
    const existing = missingOnly
      ? new Set((await pool.query("select draws.contest_number from draws join lotteries on lotteries.id=draws.lottery_id where lotteries.slug=$1 and draws.contest_number between $2 and $3", [games[apiSlug][0], first, last])).rows.map((row) => row.contest_number))
      : new Set();
    console.log(`${games[apiSlug][1]}: concursos ${first}–${last}${missingOnly ? ` (${last - first + 1 - existing.size} faltantes)` : ""}`);
    let cursor = first;
    const workers = Array.from({ length: Math.min(workersArg, last - first + 1) }, async () => {
      while (cursor <= last) {
        const contest = cursor++;
        if (existing.has(contest)) continue;
        try { if (await importDraw(apiSlug, contest)) totalImported += 1; }
        catch (error) { failures += 1; console.warn(`  ${contest}: ${error.message}`); }
        await sleep(delayArg);
      }
    });
    await Promise.all(workers);
    console.log(`  concluída: ${games[apiSlug][1]}`);
  }
} finally { await pool.end(); }
console.log(`Importação concluída: ${totalImported} concursos processados; ${failures} falhas.`);
if (failures) process.exitCode = 1;

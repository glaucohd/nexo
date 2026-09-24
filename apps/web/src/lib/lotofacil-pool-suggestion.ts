import { buildProfile, type ProfileDraw, type Temperature } from "./hot-cold-profile.ts";
import { analyzeCycles, countRepeated } from "./lottery-analysis.ts";

const game = { total: 25, start: 1, columns: 5, drawSize: 15, extra: null };
const universe = Array.from({ length: 25 }, (_, index) => index + 1);

type Counts = Record<Temperature, number>;
export type LotofacilPoolSuggestion = {
  numbers: number[];
  excluded: number[];
  metrics: Counts & { repeated: number; pairs: number; frame: number; late: number; cycleMissing: number };
  targets: Counts & { repeated: number; pairs: number; frame: number; late: number; cycleMissing: number };
  contests: number;
};

function shuffled<T>(values: readonly T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function scaleCounts(base: Counts, size: number, limits: Counts): Counts {
  const entries = (["hot", "neutral", "cold"] as const).map((key) => {
    const exact = base[key] * size / 15;
    return { key, value: Math.min(limits[key], Math.floor(exact)), rest: exact - Math.floor(exact) };
  });
  let missing = size - entries.reduce((sum, entry) => sum + entry.value, 0);
  while (missing > 0) {
    const available = entries.filter((entry) => entry.value < limits[entry.key]).sort((a, b) => b.rest - a.rest || a.key.localeCompare(b.key));
    if (!available.length) break;
    available[0].value += 1;
    available[0].rest = 0;
    missing -= 1;
  }
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.value])) as Counts;
}

function nearestScaledTarget(values: readonly number[], size: number, fallback: number) {
  if (!values.length) return Math.round(fallback * size / 15);
  return Math.round(values[0] * size / 15);
}

/**
 * Sugere um grupo, não um resultado. O histórico só organiza o palpite:
 * frequência, atraso, ciclo, repetição, pares e moldura não alteram a
 * probabilidade matemática das dezenas.
 */
export function suggestLotofacilPool({ history, size, random = Math.random, attempts = 6_000 }: {
  history: readonly ProfileDraw[];
  size: 18 | 20;
  random?: () => number;
  attempts?: number;
}): LotofacilPoolSuggestion {
  if (size !== 18 && size !== 20) throw new RangeError("A sugestão aceita grupos de 18 ou 20 dezenas.");
  if (!history.length) {
    const numbers = shuffled(universe, random).slice(0, size).sort((a, b) => a - b);
    return {
      numbers,
      excluded: universe.filter((number) => !numbers.includes(number)),
      metrics: { hot: 0, neutral: 0, cold: 0, repeated: 0, pairs: numbers.filter((number) => number % 2 === 0).length, frame: 0, late: 0, cycleMissing: 0 },
      targets: { hot: 0, neutral: 0, cold: 0, repeated: 0, pairs: Math.round(size / 2), frame: Math.round(size * 16 / 25), late: 0, cycleMissing: 0 },
      contests: 0,
    };
  }

  const ordered = [...history].sort((a, b) => b.contest - a.contest);
  const profile = buildProfile(ordered, game, 30);
  const latest = new Set(ordered[0].numbers);
  const sample = ordered.slice(0, 31);
  const repeats = sample.slice(0, -1).map((draw, index) => countRepeated(draw.numbers, sample[index + 1].numbers));
  const repeatMean = repeats.length ? repeats.reduce((sum, value) => sum + value, 0) / repeats.length : 9;
  // O grupo é maior que o sorteio: acrescenta uma margem proporcional às vagas extras.
  const repeatedTarget = Math.round(repeatMean + (size - 15) * 15 / 25);
  const cycle = analyzeCycles(ordered.map((draw) => ({ ...draw, date: "" })), 25, "presence");
  const cycleMissing = new Set(cycle.missing);
  const late = new Set(profile.late);
  const limits = { hot: profile.hot.length, neutral: profile.neutral.length, cold: profile.cold.length };
  const temperatureTargets = scaleCounts(profile.averageComposition, size, limits);
  const targets = {
    ...temperatureTargets,
    repeated: Math.min(15, Math.max(0, repeatedTarget)),
    pairs: nearestScaledTarget(profile.parityCurve, size, 7),
    frame: nearestScaledTarget(profile.frameCurve, size, 10),
    late: Math.round(late.size * size / 25),
    cycleMissing: Math.round(cycleMissing.size * size / 25),
  };

  let best: LotofacilPoolSuggestion | null = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    const numbers = shuffled(universe, random).slice(0, size).sort((a, b) => a - b);
    const metrics = {
      hot: numbers.filter((number) => profile.temperature.get(number) === "hot").length,
      neutral: numbers.filter((number) => profile.temperature.get(number) === "neutral").length,
      cold: numbers.filter((number) => profile.temperature.get(number) === "cold").length,
      repeated: numbers.filter((number) => latest.has(number)).length,
      pairs: numbers.filter((number) => number % 2 === 0).length,
      frame: numbers.filter((number) => profile.frame.has(number)).length,
      late: numbers.filter((number) => late.has(number)).length,
      cycleMissing: numbers.filter((number) => cycleMissing.has(number)).length,
    };
    const score =
      5 * (Math.abs(metrics.hot - targets.hot) + Math.abs(metrics.neutral - targets.neutral) + Math.abs(metrics.cold - targets.cold)) +
      3 * Math.abs(metrics.repeated - targets.repeated) +
      2 * Math.abs(metrics.pairs - targets.pairs) +
      2 * Math.abs(metrics.frame - targets.frame) +
      1.5 * Math.abs(metrics.late - targets.late) +
      Math.abs(metrics.cycleMissing - targets.cycleMissing) + random() * .05;
    if (score >= bestScore) continue;
    bestScore = score;
    best = { numbers, excluded: universe.filter((number) => !numbers.includes(number)), metrics, targets, contests: profile.contests };
    if (score < .05) break;
  }
  if (!best) throw new RangeError("Não foi possível sugerir um grupo equilibrado.");
  return best;
}

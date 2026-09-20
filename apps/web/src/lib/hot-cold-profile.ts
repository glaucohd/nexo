// Perfil "quentes, neutras e frias" de uma modalidade: classifica as dezenas
// pela frequência nos últimos concursos, resume o padrão de pares/ímpares e de
// moldura/miolo e monta jogos que seguem esse perfil. É leitura do passado para
// dar direção ao palpite; não altera a chance de nenhuma dezena.

import { metricDistribution } from "./lottery-analysis.ts";

export type Temperature = "hot" | "neutral" | "cold";
export type Composition = Record<Temperature, number>;
export type ProfileDraw = { contest: number; numbers: number[] };
export type ProfileGame = { total: number; start: number; columns: number; drawSize: number; extra?: string | null };

export type Profile = {
  contests: number;
  draws: number;
  totalContests: number;
  frequencies: Map<number, number>;
  delays: Map<number, number>;
  // Atrasada: sem sair há mais de 2 vezes o intervalo normal da dezena. Só descreve
  // o passado; não torna a dezena mais provável.
  expectedGap: number;
  lateThreshold: number;
  late: number[];
  temperature: Map<number, Temperature>;
  hot: number[];
  neutral: number[];
  cold: number[];
  frame: Set<number>;
  parity: { value: number; count: number }[];
  frameCounts: { value: number; count: number }[];
  averageComposition: Composition;
  // "Na curva": os dois padrões mais comuns de pares e de moldura. Sorteio
  // fora de um deles é "fora da curva".
  parityCurve: number[];
  frameCurve: number[];
  // Padrões possíveis fora da curva, dos que já saíram na janela para os que não saíram.
  outlierParity: number[];
  outlierFrame: number[];
  curve: { total: number; outsideParity: number; outsideFrame: number; outsideBoth: number; outsideAny: number };
  // Sorteios da janela do mais antigo para o mais recente.
  timeline: { contest: number; pairs: number; frame: number; outsideParity: boolean; outsideFrame: boolean }[];
  compositionExtremes: { hotHeavy: Composition; coldHeavy: Composition };
};

export type TicketKind = "preferred" | "average" | "outlier";

export type ProfileTicket = {
  numbers: number[];
  kind: TicketKind;
  composition: Composition;
  pairs: number;
  frame: number;
  outsideParity: boolean;
  outsideFrame: boolean;
  month?: number;
  trevos?: number[];
};

// A moldura é a borda do volante (primeira e última linha, primeira e última
// coluna); o miolo é o que sobra por dentro. Na Lotofácil (5×5) são 16 e 9.
export function frameNumbers({ total, start, columns }: Pick<ProfileGame, "total" | "start" | "columns">) {
  const lastRow = Math.floor((total - 1) / columns);
  const frame = new Set<number>();
  for (let index = 0; index < total; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    if (row === 0 || row === lastRow || column === 0 || column === columns - 1) frame.add(index + start);
  }
  return frame;
}

// Arredonda mantendo a soma exata (maior resto).
function roundToTotal(values: number[], total: number) {
  const floors = values.map(Math.floor);
  let missing = total - floors.reduce((sum, value) => sum + value, 0);
  const order = values.map((value, index) => ({ index, rest: value - floors[index] })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (missing <= 0) break;
    floors[index] += 1;
    missing -= 1;
  }
  return floors;
}

// 7 quentes, 5 neutras e 3 frias em 15 dezenas, na mesma proporção nas demais.
export function preferredComposition(drawSize: number): Composition {
  const hot = Math.round((drawSize * 7) / 15);
  const cold = Math.round((drawSize * 3) / 15);
  return { hot, neutral: drawSize - hot - cold, cold };
}

// Passa até `amount` dezenas de um grupo para outro, sem passar dos limites.
function shiftComposition(base: Composition, from: Temperature, to: Temperature, amount: number): Composition {
  const moved = Math.min(amount, base[from]);
  return { ...base, [from]: base[from] - moved, [to]: base[to] + moved };
}

// Valores fora da curva, os que já saíram na janela primeiro (mais frequentes
// antes) e depois os que nunca saíram, do mais perto da curva para o mais longe.
function outsideValues(counts: { value: number; count: number }[], curve: number[], feasible: (value: number) => boolean, max: number) {
  const seen = new Map(counts.map((entry) => [entry.value, entry.count]));
  const distance = (value: number) => Math.min(...curve.map((entry) => Math.abs(entry - value)));
  return Array.from({ length: max + 1 }, (_, value) => value)
    .filter((value) => !curve.includes(value) && feasible(value))
    .sort((a, b) => (seen.get(b) ?? 0) - (seen.get(a) ?? 0) || distance(a) - distance(b) || a - b);
}

// `contests` conta concursos, não sorteios: a Dupla Sena tem dois sorteios por
// concurso e os dois entram na janela. O histórico pode vir em qualquer ordem.
export function buildProfile(history: readonly ProfileDraw[], game: ProfileGame, contests = 30): Profile {
  const ordered = [...history].sort((a, b) => b.contest - a.contest);
  const rank = new Map<number, number>();
  for (const draw of ordered) if (!rank.has(draw.contest)) rank.set(draw.contest, rank.size);
  const sample = ordered.filter((draw) => (rank.get(draw.contest) ?? Infinity) < contests);
  const universe = Array.from({ length: game.total }, (_, index) => index + game.start);

  const frequencies = new Map(universe.map((number) => [number, 0]));
  for (const draw of sample) for (const number of draw.numbers) frequencies.set(number, (frequencies.get(number) ?? 0) + 1);
  // Atraso: concursos desde a última aparição, olhando todo o histórico.
  const delays = new Map(universe.map((number) => [number, rank.size]));
  for (const draw of ordered) {
    const age = rank.get(draw.contest)!;
    for (const number of draw.numbers) if (delays.get(number)! > age) delays.set(number, age);
  }

  // Intervalo normal: 1 ÷ chance de a dezena sair em um concurso (a Dupla Sena sorteia duas vezes).
  const perContest = Math.max(1, Math.round(ordered.length / Math.max(1, rank.size)));
  const chancePerContest = 1 - (1 - game.drawSize / game.total) ** perContest;
  const expectedGap = 1 / chancePerContest;
  // A tolerância evita que erro de arredondamento (10,000000000000002) empurre o limite para cima.
  const lateThreshold = Math.ceil(2 * expectedGap - 1e-9);
  const late = universe.filter((number) => delays.get(number)! >= lateThreshold).sort((a, b) => delays.get(b)! - delays.get(a)! || a - b);

  // Terços: as mais frequentes são quentes, as menos frequentes são frias.
  // Empates saem na frente as que apareceram mais recentemente.
  const ranked = [...universe].sort((a, b) => frequencies.get(b)! - frequencies.get(a)! || delays.get(a)! - delays.get(b)! || a - b);
  const edge = Math.round(game.total / 3);
  const byNumber = (a: number, b: number) => a - b;
  const hot = ranked.slice(0, edge).sort(byNumber);
  const cold = ranked.slice(game.total - edge).sort(byNumber);
  const neutral = ranked.slice(edge, game.total - edge).sort(byNumber);
  const temperature = new Map<number, Temperature>();
  for (const number of hot) temperature.set(number, "hot");
  for (const number of neutral) temperature.set(number, "neutral");
  for (const number of cold) temperature.set(number, "cold");

  const frame = frameNumbers(game);
  const sums = { hot: 0, neutral: 0, cold: 0 };
  for (const draw of sample) for (const number of draw.numbers) if (temperature.has(number)) sums[temperature.get(number)!] += 1;
  const compositionOf = (numbers: number[]): Composition => {
    const counts = { hot: 0, neutral: 0, cold: 0 };
    for (const number of numbers) if (temperature.has(number)) counts[temperature.get(number)!] += 1;
    return counts;
  };
  const mean = [sums.hot, sums.neutral, sums.cold].map((sum) => (sample.length ? (sum / sample.length) : 0));
  const [meanHot, meanNeutral, meanCold] = sample.length ? roundToTotal(mean, game.drawSize) : [0, 0, 0];

  const parity = metricDistribution(sample.map((draw) => draw.numbers.filter((number) => number % 2 === 0).length)).map(([value, count]) => ({ value, count }));
  const frameCounts = metricDistribution(sample.map((draw) => draw.numbers.filter((number) => frame.has(number)).length)).map(([value, count]) => ({ value, count }));
  const parityCurve = parity.slice(0, 2).map((entry) => entry.value);
  const frameCurve = frameCounts.slice(0, 2).map((entry) => entry.value);
  const evens = universe.filter((number) => number % 2 === 0).length;
  const odds = game.total - evens;
  const middle = game.total - frame.size;
  const timeline = [...sample].reverse().map((draw) => {
    const pairs = draw.numbers.filter((number) => number % 2 === 0).length;
    const inFrame = draw.numbers.filter((number) => frame.has(number)).length;
    return { contest: draw.contest, pairs, frame: inFrame, outsideParity: !parityCurve.includes(pairs), outsideFrame: !frameCurve.includes(inFrame) };
  });
  const average: Composition = sample.length ? { hot: meanHot, neutral: meanNeutral, cold: meanCold } : preferredComposition(game.drawSize);
  // Extremos que já aconteceram na janela; se não houver diferença, empurra 2 dezenas.
  const observed = sample.map((draw) => compositionOf(draw.numbers));
  const byHot = [...observed].sort((a, b) => a.hot - b.hot || b.cold - a.cold);
  const same = (a: Composition, b: Composition) => a.hot === b.hot && a.neutral === b.neutral && a.cold === b.cold;
  const coldHeavy = byHot[0] && !same(byHot[0], average) ? byHot[0] : shiftComposition(average, "hot", "cold", 2);
  const hotHeavy = byHot.at(-1) && !same(byHot.at(-1)!, average) ? byHot.at(-1)! : shiftComposition(average, "cold", "hot", 2);

  return {
    contests: Math.min(contests, rank.size),
    draws: sample.length,
    totalContests: rank.size,
    frequencies,
    delays,
    expectedGap,
    lateThreshold,
    late,
    temperature,
    hot,
    neutral,
    cold,
    frame,
    parity,
    frameCounts,
    averageComposition: average,
    parityCurve,
    frameCurve,
    outlierParity: outsideValues(parity, parityCurve, (value) => value <= evens && game.drawSize - value <= odds, game.drawSize),
    outlierFrame: outsideValues(frameCounts, frameCurve, (value) => value <= frame.size && game.drawSize - value <= middle, game.drawSize),
    curve: {
      total: timeline.length,
      outsideParity: timeline.filter((entry) => entry.outsideParity).length,
      outsideFrame: timeline.filter((entry) => entry.outsideFrame).length,
      outsideBoth: timeline.filter((entry) => entry.outsideParity && entry.outsideFrame).length,
      outsideAny: timeline.filter((entry) => entry.outsideParity || entry.outsideFrame).length,
    },
    timeline,
    compositionExtremes: { hotHeavy, coldHeavy },
  };
}

function shuffled<T>(values: readonly T[], random: () => number) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

// Monta jogos distintos em três grupos: `preferred` na composição preferencial
// (7Q·5N·3F na Lotofácil), `average` na composição média da janela e
// `outliers` fora da curva (pares ou moldura fora dos dois padrões mais
// comuns, com composição extrema que já saiu na janela). Os dois primeiros
// grupos tentam ficar na curva.
export function generateProfileTickets({ profile, game, preferred = 4, average = 4, outliers = 2, random = Math.random }: {
  profile: Profile;
  game: ProfileGame;
  preferred?: number;
  average?: number;
  outliers?: number;
  random?: () => number;
}): ProfileTicket[] {
  if (!profile.draws) throw new RangeError("Não há concursos suficientes para montar o perfil.");
  const groups: Record<Temperature, number[]> = { hot: profile.hot, neutral: profile.neutral, cold: profile.cold };
  const plan = [
    ...Array.from({ length: preferred }, (_, slot) => ({ kind: "preferred" as const, slot })),
    ...Array.from({ length: average }, (_, slot) => ({ kind: "average" as const, slot })),
    ...Array.from({ length: outliers }, (_, slot) => ({ kind: "outlier" as const, slot })),
  ];
  const tickets: ProfileTicket[] = [];
  const used = new Set<string>();

  for (const { kind, slot } of plan) {
    const outlier = kind === "outlier";
    const composition = kind === "preferred" ? preferredComposition(game.drawSize)
      : kind === "average" ? profile.averageComposition
        : slot % 2 === 0 ? profile.compositionExtremes.coldHeavy : profile.compositionExtremes.hotHeavy;
    const parityList = outlier ? profile.outlierParity : profile.parityCurve;
    const frameList = outlier ? profile.outlierFrame : profile.frameCurve;
    const parityTarget = parityList.length ? parityList[slot % parityList.length] : NaN;
    const frameTarget = frameList.length ? frameList[(outlier ? slot : Math.floor(slot / Math.max(1, parityList.length))) % frameList.length] : NaN;
    let ticket: ProfileTicket | null = null;

    // Fora da curva nunca cai no "aceita qualquer": o jogo precisa mesmo fugir do padrão.
    for (const strictness of outlier ? ["both", "parity", "frame", "outside"] as const : ["both", "parity", "none"] as const) {
      for (let attempt = 0; attempt < 400 && !ticket; attempt += 1) {
        const numbers = (["hot", "neutral", "cold"] as const)
          .flatMap((temperatureKind) => shuffled(groups[temperatureKind], random).slice(0, composition[temperatureKind]))
          .sort((a, b) => a - b);
        const key = numbers.join(",");
        if (numbers.length !== game.drawSize || used.has(key)) continue;
        const pairs = numbers.filter((number) => number % 2 === 0).length;
        const frame = numbers.filter((number) => profile.frame.has(number)).length;
        const outsideParity = !profile.parityCurve.includes(pairs);
        const outsideFrame = !profile.frameCurve.includes(frame);
        if (strictness === "both" && (pairs !== parityTarget || frame !== frameTarget)) continue;
        if (strictness === "parity" && pairs !== parityTarget) continue;
        if (strictness === "frame" && frame !== frameTarget) continue;
        if (strictness === "outside" && !outsideParity && !outsideFrame) continue;
        ticket = { numbers, kind, composition, pairs, frame, outsideParity, outsideFrame };
      }
      if (ticket) break;
    }
    if (!ticket) throw new RangeError("Não foi possível montar jogos diferentes com esse perfil.");
    used.add(ticket.numbers.join(","));
    if (game.extra === "mes") ticket.month = Math.floor(random() * 12) + 1;
    if (game.extra === "trevos") ticket.trevos = shuffled([1, 2, 3, 4, 5, 6], random).slice(0, 2).sort((a, b) => a - b);
    tickets.push(ticket);
  }
  return tickets;
}

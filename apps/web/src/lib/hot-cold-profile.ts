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
  temperature: Map<number, Temperature>;
  hot: number[];
  neutral: number[];
  cold: number[];
  frame: Set<number>;
  parity: { value: number; count: number }[];
  frameCounts: { value: number; count: number }[];
  averageComposition: Composition;
};

export type ProfileTicket = {
  numbers: number[];
  preferred: boolean;
  composition: Composition;
  pairs: number;
  frame: number;
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
  const mean = [sums.hot, sums.neutral, sums.cold].map((sum) => (sample.length ? (sum / sample.length) : 0));
  const [meanHot, meanNeutral, meanCold] = sample.length ? roundToTotal(mean, game.drawSize) : Object.values(preferredComposition(game.drawSize));

  return {
    contests: Math.min(contests, rank.size),
    draws: sample.length,
    totalContests: rank.size,
    frequencies,
    delays,
    temperature,
    hot,
    neutral,
    cold,
    frame,
    parity: metricDistribution(sample.map((draw) => draw.numbers.filter((number) => number % 2 === 0).length)).map(([value, count]) => ({ value, count })),
    frameCounts: metricDistribution(sample.map((draw) => draw.numbers.filter((number) => frame.has(number)).length)).map(([value, count]) => ({ value, count })),
    averageComposition: { hot: meanHot, neutral: meanNeutral, cold: meanCold },
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

// Monta `quantity` jogos distintos. Os primeiros `preferred` seguem a
// composição preferencial (7Q·5N·3F na Lotofácil); os demais seguem a
// composição média observada na janela. Todos tentam ficar num dos dois
// padrões mais comuns de pares/ímpares e de moldura/miolo.
export function generateProfileTickets({ profile, game, quantity = 10, preferred = 5, random = Math.random }: {
  profile: Profile;
  game: ProfileGame;
  quantity?: number;
  preferred?: number;
  random?: () => number;
}): ProfileTicket[] {
  if (!profile.draws) throw new RangeError("Não há concursos suficientes para montar o perfil.");
  const wanted = preferredComposition(game.drawSize);
  const groups: Record<Temperature, number[]> = { hot: profile.hot, neutral: profile.neutral, cold: profile.cold };
  const parityTargets = profile.parity.slice(0, 2).map((entry) => entry.value);
  const frameTargets = profile.frameCounts.slice(0, 2).map((entry) => entry.value);
  const tickets: ProfileTicket[] = [];
  const used = new Set<string>();

  for (let index = 0; index < quantity; index += 1) {
    const isPreferred = index < preferred;
    const composition = isPreferred ? wanted : profile.averageComposition;
    const parityTarget = parityTargets[index % parityTargets.length];
    const frameTarget = frameTargets[Math.floor(index / parityTargets.length) % frameTargets.length];
    let ticket: ProfileTicket | null = null;

    // Primeiro exige pares e moldura; depois só pares; por fim aceita qualquer.
    for (const strictness of ["both", "parity", "none"] as const) {
      for (let attempt = 0; attempt < 400 && !ticket; attempt += 1) {
        const numbers = (["hot", "neutral", "cold"] as const)
          .flatMap((kind) => shuffled(groups[kind], random).slice(0, composition[kind]))
          .sort((a, b) => a - b);
        const key = numbers.join(",");
        if (numbers.length !== game.drawSize || used.has(key)) continue;
        const pairs = numbers.filter((number) => number % 2 === 0).length;
        const frame = numbers.filter((number) => profile.frame.has(number)).length;
        if (strictness !== "none" && pairs !== parityTarget) continue;
        if (strictness === "both" && frame !== frameTarget) continue;
        ticket = { numbers, preferred: isPreferred, composition, pairs, frame };
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

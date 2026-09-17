export const lotteryGames = {
  lotofacil: { name: "Lotofácil", total: 25, start: 1, columns: 5, drawSize: 15, min: 15, max: 20, color: "#91278f", extra: null },
  "mega-sena": { name: "Mega-Sena", total: 60, start: 1, columns: 10, drawSize: 6, min: 6, max: 20, color: "#008b64", extra: null },
  quina: { name: "Quina", total: 80, start: 1, columns: 10, drawSize: 5, min: 5, max: 15, color: "#5551ae", extra: null },
  "mais-milionaria": { name: "+Milionária", total: 50, start: 1, columns: 5, drawSize: 6, min: 6, max: 12, color: "#3445a5", extra: "trevos" },
  "dia-de-sorte": { name: "Dia de Sorte", total: 31, start: 1, columns: 7, drawSize: 7, min: 7, max: 15, color: "#9a6508", extra: "mes" },
  lotomania: { name: "Lotomania", total: 100, start: 0, columns: 10, drawSize: 20, min: 50, max: 50, color: "#d16b2d", extra: null },
} as const;

export type LotterySlug = keyof typeof lotteryGames;
export type GeneratorMode = "pure" | "balanced" | "hot" | "delayed" | "mixed";
export type GeneratedTicket = { numbers: number[]; month?: number };
export type DrawNumbers = { contest: number; numbers: number[] };

export function canExclude(slug: LotterySlug) {
  return slug === "mega-sena" || slug === "quina" || slug === "lotomania";
}

// No volante da Lotomania, 00 ocupa a última casa: 01–10, ..., 91–00.
export function lotteryBoardNumber(slug: LotterySlug, position: number) {
  return slug === "lotomania" ? (position + 1) % 100 : position + lotteryGames[slug].start;
}

export function lotteryBoardPosition(slug: LotterySlug, number: number) {
  return slug === "lotomania" ? (number + 99) % 100 : number - lotteryGames[slug].start;
}

export function lotomaniaBlockNumbers(block: number) {
  if (!Number.isInteger(block) || block < 1 || block > 25) throw new RangeError("Bloco da Lotomania inválido.");
  const row = Math.floor((block - 1) / 5) * 2;
  const column = (block - 1) % 5 * 2;
  return [row * 10 + column, row * 10 + column + 1, (row + 1) * 10 + column, (row + 1) * 10 + column + 1]
    .map((position) => lotteryBoardNumber("lotomania", position));
}

export function isNumberExcluded(slug: LotterySlug, number: number, general: ReadonlySet<string>, personal: ReadonlySet<string>) {
  if (!canExclude(slug)) return false;
  const columns = lotteryGames[slug].columns;
  const position = lotteryBoardPosition(slug, number);
  const row = Math.floor(position / columns) + 1;
  const column = position % columns + 1;
  const halfRows = Math.ceil(lotteryGames[slug].total / columns / 2);
  const quadrant = (row <= halfRows ? 1 : 3) + (column <= columns / 2 ? 0 : 1);
  const block = Math.floor((row - 1) / 2) * 5 + Math.floor((column - 1) / 2) + 1;
  return [`quadrant:${quadrant}`, `row:${row}`, `column:${column}`, ...(slug === "lotomania" ? [`block:${block}`] : [])]
    .some((key) => general.has(key) || personal.has(key));
}

export function availableLotteryNumbers(slug: LotterySlug, general: ReadonlySet<string>, personal: ReadonlySet<string>) {
  return Array.from({ length: lotteryGames[slug].total }, (_, index) => index + lotteryGames[slug].start)
    .filter((number) => !isNumberExcluded(slug, number, general, personal));
}

function shuffled<T>(values: readonly T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function weightedSample(pool: readonly number[], amount: number, weights: ReadonlyMap<number, number>, random: () => number) {
  const remaining = [...pool];
  const result: number[] = [];
  for (let index = 0; index < amount; index += 1) {
    const sum = remaining.reduce((total, number) => total + (weights.get(number) ?? 1), 0);
    let choice = random() * sum;
    let picked = remaining.length - 1;
    for (let candidate = 0; candidate < remaining.length; candidate += 1) {
      choice -= weights.get(remaining[candidate]) ?? 1;
      if (choice < 0) { picked = candidate; break; }
    }
    result.push(remaining.splice(picked, 1)[0]);
  }
  return result;
}

export function historyWeights(slug: LotterySlug, history: readonly DrawNumbers[], mode: GeneratorMode) {
  const { total, start } = lotteryGames[slug];
  const frequency = Array.from({ length: total + 1 }, () => 0);
  const delay = Array.from({ length: total + 1 }, () => history.length);
  history.forEach((draw, index) => draw.numbers.forEach((number) => {
    if (number >= start && number < start + total) {
      frequency[number] += 1;
      if (delay[number] === history.length) delay[number] = index;
    }
  }));
  const freqRank = Array.from({ length: total }, (_, index) => index + start).sort((a, b) => frequency[b] - frequency[a] || a - b);
  const delayRank = [...freqRank].sort((a, b) => delay[b] - delay[a] || a - b);
  const freqPosition = new Map(freqRank.map((number, index) => [number, index]));
  const delayPosition = new Map(delayRank.map((number, index) => [number, index]));
  const weights = new Map<number, number>();
  for (let number = start; number < start + total; number += 1) {
    const hot = 1 - (freqPosition.get(number) ?? 0) / Math.max(1, total - 1);
    const late = 1 - (delayPosition.get(number) ?? 0) / Math.max(1, total - 1);
    weights.set(number, mode === "hot" ? 0.5 + 2 * hot : mode === "delayed" ? 0.5 + 2 * late : mode === "mixed" ? 0.5 + hot + late : 1);
  }
  return weights;
}

function balanceScore(numbers: readonly number[], history: readonly DrawNumbers[], baseSize: number, total: number, start: number) {
  if (!history.length) return 0;
  const samples = history.slice(0, 200);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const expectedOdd = mean(samples.map((draw) => draw.numbers.filter((number) => number % 2 === 1).length)) * numbers.length / baseSize;
  const expectedLow = mean(samples.map((draw) => draw.numbers.filter((number) => number < start + total / 2).length)) * numbers.length / baseSize;
  const expectedSum = mean(samples.map((draw) => draw.numbers.reduce((sum, number) => sum + number, 0))) * numbers.length / baseSize;
  const odd = numbers.filter((number) => number % 2 === 1).length;
  const low = numbers.filter((number) => number < start + total / 2).length;
  const sum = numbers.reduce((value, number) => value + number, 0);
  return Math.abs(odd - expectedOdd) + Math.abs(low - expectedLow) + Math.abs(sum - expectedSum) / Math.max(1, total);
}

function similarityScore(numbers: readonly number[], previous: readonly GeneratedTicket[]) {
  if (!previous.length) return 0;
  const selected = new Set(numbers);
  return Math.max(...previous.map((ticket) => ticket.numbers.filter((number) => selected.has(number)).length)) * 10
    + previous.reduce((sum, ticket) => sum + ticket.numbers.filter((number) => selected.has(number)).length, 0);
}

export function lotomaniaBlockCounts(numbers: readonly number[]) {
  const counts = Array.from({ length: 25 }, () => 0);
  for (const number of numbers) {
    if (!Number.isInteger(number) || number < 0 || number > 99) throw new RangeError("A Lotomania usa dezenas de 00 a 99.");
    const position = lotteryBoardPosition("lotomania", number);
    const row = Math.floor(position / 10);
    const column = position % 10;
    counts[Math.floor(row / 2) * 5 + Math.floor(column / 2)] += 1;
  }
  return counts;
}

export function randomLotomaniaBlockRules({ quantity, count, general = new Set<string>(), personal = [], fixed = new Set<number>(), avoided = new Set<number>(), random = Math.random }: {
  quantity: number;
  count: number;
  general?: ReadonlySet<string>;
  personal?: readonly ReadonlySet<string>[];
  fixed?: ReadonlySet<number>;
  avoided?: ReadonlySet<number>;
  random?: () => number;
}) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !Number.isInteger(count) || count < 1 || count > 12) {
    throw new RangeError("Escolha de 1 a 12 blocos aleatórios por jogo.");
  }
  return Array.from({ length: quantity }, (_, index) => {
    const manual = personal[index] ?? new Set<string>();
    const pool = availableLotteryNumbers("lotomania", general, manual).filter((number) => !avoided.has(number));
    if (pool.length < 50 || [...fixed].some((number) => !pool.includes(number))) {
      throw new RangeError(`O jogo ${index + 1} já não comporta 50 dezenas com as exclusões e fixas atuais.`);
    }
    const available = new Set(pool);
    const candidates = Array.from({ length: 25 }, (_, block) => {
      const key = `block:${block + 1}`;
      const members = lotomaniaBlockNumbers(block + 1);
      return { key, cost: members.filter((number) => available.has(number)).length, fixed: members.some((number) => fixed.has(number)) };
    }).filter((candidate) => !general.has(candidate.key) && !manual.has(candidate.key) && !candidate.fixed && candidate.cost > 0);
    if (candidates.length < count) throw new RangeError(`O jogo ${index + 1} não tem ${count} blocos livres para sortear.`);
    const selected: string[] = [];
    let remaining = pool.length - 50;
    for (let pick = 0; pick < count; pick += 1) {
      const neededAfter = count - pick - 1;
      const viable = candidates.filter((candidate) => candidate.cost + candidates
        .filter((other) => other !== candidate)
        .map((other) => other.cost)
        .sort((a, b) => a - b)
        .slice(0, neededAfter)
        .reduce((sum, cost) => sum + cost, 0) <= remaining);
      if (!viable.length) throw new RangeError(`O jogo ${index + 1} não comporta ${count} blocos aleatórios sem ficar abaixo de 50 dezenas.`);
      const candidate = viable[Math.min(viable.length - 1, Math.floor(random() * viable.length))];
      selected.push(candidate.key);
      remaining -= candidate.cost;
      candidates.splice(candidates.indexOf(candidate), 1);
    }
    return selected;
  });
}

function createLotomaniaSampler(pool: readonly number[], fixed: ReadonlySet<number>, latest: ReadonlySet<number>, repeatCount: number | null, weights: ReadonlyMap<number, number>, mode: GeneratorMode, mirrorSafe: boolean, random: () => number) {
  type Option = { numbers: number[]; size: number; repeated: number; weight: number; exception: number };
  const available = new Set(pool);
  const weighted = mode === "hot" || mode === "delayed" || mode === "mixed";
  const options: Option[][] = Array.from({ length: 25 }, (_, block) => {
    const members = lotomaniaBlockNumbers(block + 1);
    const choices: Option[] = [];
    for (let mask = 0; mask < 16; mask += 1) {
      const numbers = members.filter((_, index) => mask & (1 << index));
      if (numbers.some((number) => !available.has(number)) || members.some((number) => fixed.has(number) && !numbers.includes(number))) continue;
      choices.push({ numbers, size: numbers.length, repeated: repeatCount === null ? 0 : numbers.filter((number) => latest.has(number)).length, weight: weighted ? numbers.reduce((product, number) => product * (weights.get(number) ?? 1), 1) : 1, exception: numbers.length === 4 || mirrorSafe && numbers.length === 0 ? 1 : 0 });
    }
    return choices;
  });
  const targetSize = 50;
  const targetRepeated = repeatCount ?? 0;
  const table = Array.from({ length: 26 }, () => Array.from({ length: targetSize + 1 }, () => new Float64Array(targetRepeated + 1)));
  const minimumExceptions = Array.from({ length: 26 }, () => Array.from({ length: targetSize + 1 }, () => new Uint8Array(targetRepeated + 1).fill(255)));
  table[25][0][0] = 1;
  minimumExceptions[25][0][0] = 0;
  for (let block = 24; block >= 0; block -= 1) {
    for (let size = 0; size <= targetSize; size += 1) {
      for (let repeated = 0; repeated <= targetRepeated; repeated += 1) {
        for (const option of options[block]) {
          if (option.size > size || option.repeated > repeated) continue;
          const nextSize = size - option.size;
          const nextRepeated = repeated - option.repeated;
          const nextExceptions = minimumExceptions[block + 1][nextSize][nextRepeated];
          if (nextExceptions === 255) continue;
          const exceptions = option.exception + nextExceptions;
          if (exceptions < minimumExceptions[block][size][repeated]) {
            minimumExceptions[block][size][repeated] = exceptions;
            table[block][size][repeated] = 0;
          }
          if (exceptions === minimumExceptions[block][size][repeated]) table[block][size][repeated] += option.weight * table[block + 1][nextSize][nextRepeated];
        }
      }
    }
  }
  if (minimumExceptions[0][targetSize][targetRepeated] === 255) throw new RangeError("Não é possível montar 50 dezenas com esses filtros, fixas ou repetidas.");
  return () => {
    const numbers: number[] = [];
    let remainingSize = targetSize;
    let remainingRepeated = targetRepeated;
    for (let block = 0; block < 25; block += 1) {
      let choice = random() * table[block][remainingSize][remainingRepeated];
      let selected: Option | undefined;
      for (const option of options[block]) {
        if (option.size > remainingSize || option.repeated > remainingRepeated) continue;
        const nextSize = remainingSize - option.size;
        const nextRepeated = remainingRepeated - option.repeated;
        if (option.exception + minimumExceptions[block + 1][nextSize][nextRepeated] !== minimumExceptions[block][remainingSize][remainingRepeated]) continue;
        const mass = option.weight * table[block + 1][nextSize][nextRepeated];
        if (!mass) continue;
        choice -= mass;
        if (choice < 0) { selected = option; break; }
      }
      if (!selected) throw new Error("Falha ao selecionar um bloco válido da Lotomania.");
      numbers.push(...selected.numbers);
      remainingSize -= selected.size;
      remainingRepeated -= selected.repeated;
    }
    return numbers.sort((a, b) => a - b);
  };
}

export function generateLotteryTickets({ slug, quantity, size, mode, repeatCount = null, general = new Set<string>(), personal = [], fixed = new Set<number>(), avoided = new Set<number>(), history = [], random = Math.random, lotomaniaMirrorSafe = false }: {
  slug: LotterySlug;
  quantity: number;
  size: number;
  mode: GeneratorMode;
  repeatCount?: number | null;
  general?: ReadonlySet<string>;
  personal?: readonly ReadonlySet<string>[];
  fixed?: ReadonlySet<number>;
  avoided?: ReadonlySet<number>;
  history?: readonly DrawNumbers[];
  random?: () => number;
  lotomaniaMirrorSafe?: boolean;
}): GeneratedTicket[] {
  const game = lotteryGames[slug];
  if (slug === "mais-milionaria") throw new RangeError("Use o gerador próprio da +Milionária para incluir os trevos.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !Number.isInteger(size) || size < game.min || size > game.max) {
    throw new RangeError(`Escolha de 1 a 20 jogos, com ${game.min} a ${game.max} dezenas por jogo.`);
  }
  if (repeatCount !== null && (!history.length || !Number.isInteger(repeatCount) || repeatCount < 0 || repeatCount > Math.min(size, game.drawSize))) {
    throw new RangeError("A quantidade de repetidas do último concurso é inválida.");
  }
  if (fixed.size > size || [...fixed].some((number) => !Number.isInteger(number) || number < game.start || number >= game.start + game.total || avoided.has(number))) {
    throw new RangeError("Revise as dezenas fixadas: há conflito, número inválido ou mais fixas do que vagas na cartela.");
  }
  if ([...avoided].some((number) => !Number.isInteger(number) || number < game.start || number >= game.start + game.total)) {
    throw new RangeError("Há uma dezena inválida entre as evitadas.");
  }
  const weights = historyWeights(slug, history, mode);
  const latest = new Set(history[0]?.numbers ?? []);
  const result: GeneratedTicket[] = [];
  const used = new Set<string>();
  for (let index = 0; index < quantity; index += 1) {
    const pool = availableLotteryNumbers(slug, general, personal[index] ?? new Set()).filter((number) => !avoided.has(number));
    if (pool.length < size) throw new RangeError(`O jogo ${index + 1} ficou com menos de ${size} dezenas disponíveis.`);
    if ([...fixed].some((number) => !pool.includes(number))) throw new RangeError(`Uma dezena fixa está excluída no jogo ${index + 1}.`);
    const free = pool.filter((number) => !fixed.has(number));
    const inside = free.filter((number) => latest.has(number));
    const outside = free.filter((number) => !latest.has(number));
    const fixedRepeated = [...fixed].filter((number) => latest.has(number)).length;
    const needInside = repeatCount === null ? 0 : repeatCount - fixedRepeated;
    const needOutside = repeatCount === null ? 0 : size - repeatCount - (fixed.size - fixedRepeated);
    if (repeatCount !== null && (needInside < 0 || needOutside < 0 || inside.length < needInside || outside.length < needOutside)) {
      throw new RangeError(`Não é possível repetir ${repeatCount} dezenas no jogo ${index + 1} com essas exclusões.`);
    }
    const lotomaniaSample = slug === "lotomania" ? createLotomaniaSampler(pool, fixed, latest, repeatCount, weights, mode, lotomaniaMirrorSafe, random) : null;
    let best: GeneratedTicket | null = null;
    let bestScore = Infinity;
    for (let attempt = 0; attempt < 250; attempt += 1) {
      const pick = (values: number[], amount: number) => mode === "pure" || mode === "balanced"
        ? shuffled(values, random).slice(0, amount) : weightedSample(values, amount, weights, random);
      const numbers = lotomaniaSample ? lotomaniaSample() : [...fixed, ...(repeatCount === null ? pick(free, size - fixed.size) : [...pick(inside, needInside), ...pick(outside, needOutside)])]
        .sort((a, b) => a - b);
      const month = slug === "dia-de-sorte" ? Math.floor(random() * 12) + 1 : undefined;
      const key = `${numbers.join(",")}|${month ?? ""}`;
      if (used.has(key)) continue;
      const candidate = { numbers, ...(month === undefined ? {} : { month }) };
      const score = similarityScore(numbers, result) + (mode === "balanced" || mode === "mixed" ? balanceScore(numbers, history, game.drawSize, game.total, game.start) : 0);
      if (score < bestScore) { best = candidate; bestScore = score; }
      // Sorteio puro não seleciona o "melhor" de várias amostras: a primeira
      // combinação ainda não usada preserva a distribuição uniforme.
      if (mode === "pure" || !score) break;
    }
    if (!best) throw new RangeError("Não foi possível montar jogos distintos com esses filtros. Reduza as restrições.");
    used.add(`${best.numbers.join(",")}|${best.month ?? ""}`);
    result.push(best);
  }
  return result;
}

export function lotomaniaMirror(numbers: readonly number[]) {
  if (numbers.length !== 50 || new Set(numbers).size !== 50 || numbers.some((number) => !Number.isInteger(number) || number < 0 || number > 99)) {
    throw new RangeError("O espelho exige uma cartela-base com 50 dezenas entre 00 e 99.");
  }
  const base = new Set(numbers);
  return Array.from({ length: 100 }, (_, number) => number).filter((number) => !base.has(number));
}

export function generateLotomaniaMirrorPairs(options: Omit<Parameters<typeof generateLotteryTickets>[0], "slug" | "size">) {
  if (options.quantity < 1 || options.quantity > 10) throw new RangeError("Escolha de 1 a 10 pares espelho.");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const bases = generateLotteryTickets({ ...options, slug: "lotomania", size: 50, lotomaniaMirrorSafe: true });
    const pairs = bases.flatMap((base) => [base, { numbers: lotomaniaMirror(base.numbers) }]);
    if (new Set(pairs.map((ticket) => ticket.numbers.join(","))).size === pairs.length) return pairs;
  }
  throw new RangeError("Não foi possível criar pares espelho diferentes com esses filtros.");
}

export function generateMirrorPairs(fixedByPair: readonly (readonly number[])[], random: () => number = Math.random): GeneratedTicket[] {
  if (fixedByPair.length < 1 || fixedByPair.length > 10) throw new RangeError("Escolha de 1 a 10 pares espelho.");
  const signatures = new Set<string>();
  const tickets: GeneratedTicket[] = [];
  const usedTickets = new Set<string>();
  for (const [index, fixed] of fixedByPair.entries()) {
    if (fixed.length !== 5 || new Set(fixed).size !== 5 || fixed.some((number) => !Number.isInteger(number) || number < 1 || number > 25)) {
      throw new RangeError(`Defina exatamente 5 dezenas fixas para o par ${index + 1}.`);
    }
    const signature = [...fixed].sort((a, b) => a - b).join(",");
    if (signatures.has(signature)) throw new RangeError(`As fixas do par ${index + 1} repetem as de outro par.`);
    signatures.add(signature);
    const free = Array.from({ length: 25 }, (_, number) => number + 1).filter((number) => !fixed.includes(number));
    let pair: GeneratedTicket[] | null = null;
    for (let attempt = 0; attempt < 250; attempt += 1) {
      const randomized = shuffled(free, random);
      const candidate = [randomized.slice(0, 10), randomized.slice(10)].map((part) => ({ numbers: [...fixed, ...part].sort((a, b) => a - b) }));
      if (candidate.every((ticket) => !usedTickets.has(ticket.numbers.join(",")))) { pair = candidate; break; }
    }
    if (!pair) throw new RangeError("Não foi possível criar pares distintos. Tente outras dezenas fixas.");
    pair.forEach((ticket) => { usedTickets.add(ticket.numbers.join(",")); tickets.push(ticket); });
  }
  return tickets;
}

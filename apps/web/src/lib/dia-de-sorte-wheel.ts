export type DiaDeSorteWheelTicket = { numbers: number[] };

const TICKET_SIZE = 7;
const MIN_POOL = 8;
const MAX_POOL = 14;

function combinationMasks(size: number, picked: number) {
  const masks: number[] = [];
  function walk(start: number, remaining: number, mask: number) {
    if (remaining === 0) { masks.push(mask); return; }
    for (let index = start; index <= size - remaining; index += 1) walk(index + 1, remaining - 1, mask | (1 << index));
  }
  walk(0, picked, 0);
  return masks;
}

function maskToIndices(mask: number) {
  const indices: number[] = [];
  for (let index = 0; mask !== 0; index += 1, mask >>= 1) if (mask & 1) indices.push(index);
  return indices;
}

// Busca gulosa: em cada passo escolhe o jogo de 7 dezenas que cobre mais
// combinações de "garantia" (subconjuntos de tamanho `guarantee`) ainda
// descobertas, até cobrir todas. Cobrir todo subconjunto de tamanho
// `guarantee` garante matematicamente que, se as 7 sorteadas caírem dentro
// do pool, algum jogo bate ao menos `guarantee` pontos — não é uma
// aproximação, é a definição de "cobertura" (prova no teste, por força
// bruta, para cada caso coberto pela suíte).
function greedyCoveringDesign(poolSize: number, guarantee: number) {
  const targets = combinationMasks(poolSize, guarantee);
  const candidates = combinationMasks(poolSize, TICKET_SIZE);
  const covered = new Uint8Array(targets.length);
  const used = new Uint8Array(candidates.length);
  let remaining = targets.length;
  const chosen: number[] = [];
  while (remaining > 0) {
    let bestIndex = -1;
    let bestGain = -1;
    for (let candidate = 0; candidate < candidates.length; candidate += 1) {
      if (used[candidate]) continue;
      const candidateMask = candidates[candidate];
      let gain = 0;
      for (let target = 0; target < targets.length; target += 1) {
        if (!covered[target] && (candidateMask & targets[target]) === targets[target]) gain += 1;
      }
      if (gain > bestGain) { bestGain = gain; bestIndex = candidate; }
    }
    used[bestIndex] = 1;
    const candidateMask = candidates[bestIndex];
    for (let target = 0; target < targets.length; target += 1) {
      if (!covered[target] && (candidateMask & targets[target]) === targets[target]) { covered[target] = 1; remaining -= 1; }
    }
    chosen.push(candidateMask);
  }
  return chosen;
}

export function diaDeSorteWheel(available: readonly number[], guarantee: 4 | 5): DiaDeSorteWheelTicket[] {
  if (
    available.length < MIN_POOL ||
    available.length > MAX_POOL ||
    new Set(available).size !== available.length ||
    available.some((number) => !Number.isInteger(number) || number < 1 || number > 31)
  ) {
    throw new RangeError(`A redução exige de ${MIN_POOL} a ${MAX_POOL} dezenas distintas, de 1 a 31.`);
  }
  const sorted = [...available].sort((a, b) => a - b);
  return greedyCoveringDesign(sorted.length, guarantee).map((mask) => ({
    numbers: maskToIndices(mask).map((index) => sorted[index]),
  }));
}

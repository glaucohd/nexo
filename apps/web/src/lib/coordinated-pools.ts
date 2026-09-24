function shuffled<T>(values: readonly T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/**
 * Monta seleções sem repetição entre si e intercala os estratos informados.
 * Nos geradores, os estratos são quentes, neutras e frias. Isso amplia a
 * cobertura conjunta sem tratar o histórico como previsão.
 */
export function coordinatedSelections({ universe, size, count, strata = [universe], random = Math.random }: {
  universe: readonly number[];
  size: number;
  count: number;
  strata?: readonly (readonly number[])[];
  random?: () => number;
}) {
  const unique = new Set(universe);
  if (
    unique.size !== universe.length || !Number.isInteger(size) || size < 1 ||
    !Number.isInteger(count) || count < 1 || size * count > universe.length
  ) throw new RangeError("Não há dezenas suficientes para montar seleções coordenadas sem repetição.");

  const seen = new Set<number>();
  const queues = strata.map((stratum) => shuffled(stratum.filter((number) => unique.has(number) && !seen.has(number)).map((number) => {
    seen.add(number);
    return number;
  }), random));
  const leftovers = shuffled(universe.filter((number) => !seen.has(number)), random);
  if (leftovers.length) queues.push(leftovers);

  const deck: number[] = [];
  let turn = 0;
  while (deck.length < size * count) {
    let selected = false;
    for (let offset = 0; offset < queues.length; offset += 1) {
      const queue = queues[(turn + offset) % queues.length];
      const number = queue.shift();
      if (number === undefined) continue;
      deck.push(number);
      turn = (turn + offset + 1) % queues.length;
      selected = true;
      break;
    }
    if (!selected) throw new RangeError("Os estratos não cobrem dezenas suficientes para montar a carteira.");
  }

  return Array.from({ length: count }, (_, index) => deck.slice(index * size, (index + 1) * size).sort((a, b) => a - b));
}

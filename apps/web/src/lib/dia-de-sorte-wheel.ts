export type DiaDeSorteWheelTicket = { numbers: number[] };

import { diaDeSorteCovering } from "./dia-de-sorte-coverings.ts";

const MIN_POOL = 8;
const MAX_POOL = 14;

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
  return diaDeSorteCovering(sorted.length, guarantee).map((indices) => ({
    numbers: indices.map((index) => sorted[index]),
  }));
}

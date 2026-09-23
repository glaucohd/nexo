// Ordem balanceada das 15 duplas possiveis de trevos. Os tres primeiros
// jogos ja usam todos os seis trevos; depois, a frequencia continua o mais
// uniforme possivel ate cobrir cada dupla exatamente uma vez.
const TREVO_PAIRS = [
  [1, 2], [3, 4], [5, 6],
  [1, 3], [2, 5], [4, 6],
  [1, 4], [2, 6], [3, 5],
  [1, 5], [2, 4], [3, 6],
  [1, 6], [2, 3], [4, 5],
] as const;

export function balancedTrevoPairs(count: number): number[][] {
  if (!Number.isInteger(count) || count < 1) throw new RangeError("A quantidade de jogos deve ser um inteiro positivo.");
  return Array.from({ length: count }, (_, index) => [...TREVO_PAIRS[index % TREVO_PAIRS.length]]);
}

// Fechamentos por partição: o pool é dividido em grupos e cada jogo é o pool
// menos alguns grupos inteiros. A garantia vem da casa dos pombos — as
// sorteadas que caem no pool se espalham pelos grupos, e algum jogo deixa de
// fora justamente os grupos com menos sorteadas. As provas por força bruta
// estão em tests/partition-wheels.test.mjs.

export type PartitionWheelTicket = { numbers: number[]; excluded: number[] };

function validated(available: readonly number[], size: number, min: number, max: number) {
  if (
    available.length !== size ||
    new Set(available).size !== size ||
    available.some((number) => !Number.isInteger(number) || number < min || number > max)
  ) {
    throw new RangeError(`A redução exige exatamente ${size} dezenas distintas, de ${String(min).padStart(2, "0")} a ${max}.`);
  }
  return [...available].sort((a, b) => a - b);
}

// Grupos intercalados (1º, 8º, 15º…): cada grupo mistura dezenas baixas e altas.
function interleavedGroups(sorted: readonly number[], count: number) {
  return Array.from({ length: count }, (_, group) => sorted.filter((_, index) => index % count === group));
}

function ticketWithout(sorted: readonly number[], excluded: readonly number[]): PartitionWheelTicket {
  const excludedSet = new Set(excluded);
  return { numbers: sorted.filter((number) => !excludedSet.has(number)), excluded: [...excluded].sort((a, b) => a - b) };
}

// Lotomania, 70 dezenas → 21 jogos de 50. Os 70 viram 7 grupos de 10 e cada
// jogo deixa 2 grupos de fora (as 21 duplas possíveis). Se as 20 sorteadas
// caírem nas 70, os 2 grupos com menos sorteadas somam no máximo 5 delas
// (2/7 de 20, arredondado para baixo), então o jogo que exclui esses dois
// grupos faz ao menos 15 pontos — já faixa premiada.
export function lotomaniaWheel70(available: readonly number[]): PartitionWheelTicket[] {
  const sorted = validated(available, 70, 0, 99);
  const groups = interleavedGroups(sorted, 7);
  const tickets: PartitionWheelTicket[] = [];
  for (let first = 0; first < 7; first += 1) {
    for (let second = first + 1; second < 7; second += 1) tickets.push(ticketWithout(sorted, [...groups[first], ...groups[second]]));
  }
  return tickets;
}

// Dia de Sorte, 14 dezenas → 2 jogos de 7 (as duas metades intercaladas).
// Se as 7 sorteadas caírem nas 14, uma das metades tem ao menos 4 delas.
export function diaDeSorteWheel14(available: readonly number[]): PartitionWheelTicket[] {
  const sorted = validated(available, 14, 1, 31);
  const [first, second] = interleavedGroups(sorted, 2);
  return [ticketWithout(sorted, second), ticketWithout(sorted, first)];
}

// Trios de {0..9} tais que todo conjunto de 6 pontos contém algum trio
// (achados por busca). Tirar um trio de uma metade de 10 deixa um jogo de 7;
// como toda escolha de 4 pontos deixa 6 de fora, algum trio está entre esses
// 6 — ou seja, algum jogo contém quaisquer 4 dezenas da metade.
const TRIPLES_HITTING_EVERY_SIX_OF_10 = [
  [0, 6, 9], [3, 7, 9], [4, 5, 8], [0, 1, 4], [1, 6, 9],
  [2, 4, 5], [2, 3, 8], [3, 6, 7], [2, 7, 8], [0, 1, 5],
];

// Dia de Sorte, 20 dezenas → 20 jogos de 7. As 20 viram 2 metades de 10; das
// 7 sorteadas no pool, ao menos 4 caem na mesma metade, e algum dos 10 jogos
// daquela metade contém essas 4.
export function diaDeSorteWheel20(available: readonly number[]): PartitionWheelTicket[] {
  const sorted = validated(available, 20, 1, 31);
  const halves = interleavedGroups(sorted, 2);
  return halves.flatMap((half) => TRIPLES_HITTING_EVERY_SIX_OF_10.map((triple) => {
    const out = new Set(triple.map((index) => half[index]));
    return { numbers: half.filter((number) => !out.has(number)), excluded: [...out].sort((a, b) => a - b) };
  }));
}

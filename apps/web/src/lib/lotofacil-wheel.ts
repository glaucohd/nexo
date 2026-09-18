export type LotofacilWheelTicket = { numbers: number[]; excluded: number[] };

function validated18(available: readonly number[]) {
  if (
    available.length !== 18 ||
    new Set(available).size !== 18 ||
    available.some((number) => !Number.isInteger(number) || number < 1 || number > 25)
  ) {
    throw new RangeError("A redução exige exatamente 18 dezenas distintas, de 1 a 25.");
  }
  return [...available].sort((a, b) => a - b);
}

// Fechamento cíclico clássico: 18 dezenas viram 3 grupos de 6, cada grupo é
// intercalado em 3 "seções" de 6 (ímpar/par), e cada seção gira uma posição
// por jogo. Cada um dos 6 jogos exclui 1 dezena de cada seção — nunca a
// mesma — então toda dezena fica de fora de exatamente 1 dos 6 jogos.
// Garantia: se as 15 sorteadas caírem todas dentro das 18, ao menos 1 dos 6
// jogos bate 13 pontos (prova exaustiva no teste).
export function lotofacilWheel(available: readonly number[]): LotofacilWheelTicket[] {
  const sorted = validated18(available);
  const groups = [sorted.slice(0, 6), sorted.slice(6, 12), sorted.slice(12, 18)];
  const sections = [0, 1, 2].map((pair) => [0, 1].flatMap((offset) => groups.map((group) => group[2 * pair + offset])));
  return Array.from({ length: 6 }, (_, ticket) => {
    const skip = (ticket + 5) % 6;
    return {
      numbers: sections.flatMap((section) => section.filter((_, index) => index !== skip)).sort((a, b) => a - b),
      excluded: sections.map((section) => section[skip]).sort((a, b) => a - b),
    };
  });
}

// Sistema de Steiner STS(9): 12 trios sobre 9 pontos (grade 3x3) cobrindo
// cada par exatamente uma vez — linhas, colunas e as duas famílias de
// diagonais mod 3 (a construção clássica do plano afim AG(2,3)).
function steinerTripleSystem9(): number[][] {
  const point = (row: number, col: number) => row * 3 + (((col % 3) + 3) % 3);
  const blocks: number[][] = [];
  for (let row = 0; row < 3; row += 1) blocks.push([0, 1, 2].map((col) => point(row, col)));
  for (let col = 0; col < 3; col += 1) blocks.push([0, 1, 2].map((row) => point(row, col)));
  for (let shift = 0; shift < 3; shift += 1) blocks.push([0, 1, 2].map((row) => point(row, row + shift)));
  for (let shift = 0; shift < 3; shift += 1) blocks.push([0, 1, 2].map((row) => point(row, 2 * row + shift)));
  return blocks;
}

const STS9 = steinerTripleSystem9();

// Fechamento de garantia mais alta: separa as 18 dezenas em 2 metades de 9 e
// aplica um sistema de Steiner em cada metade, cobrindo todo par de dezenas
// da mesma metade em algum dos 24 jogos. Qualquer trio de 3 dezenas tem, por
// princípio da casa dos pombos, ao menos 2 na mesma metade — logo esse par
// sempre está coberto por um dos jogos.
// Garantia: se as 15 sorteadas caírem todas dentro das 18, ao menos 1 dos 24
// jogos bate 14 pontos — o mínimo matematicamente possível com 24 jogos
// (prova exaustiva no teste).
export function lotofacilWheel14(available: readonly number[]): LotofacilWheelTicket[] {
  const sorted = validated18(available);
  const halves = [sorted.slice(0, 9), sorted.slice(9, 18)];
  return halves.flatMap((half) =>
    STS9.map((block) => {
      const excluded = block.map((index) => half[index]).sort((a, b) => a - b);
      const excludedSet = new Set(excluded);
      return { numbers: sorted.filter((number) => !excludedSet.has(number)), excluded };
    }),
  );
}

function validated20(available: readonly number[]) {
  if (
    available.length !== 20 ||
    new Set(available).size !== 20 ||
    available.some((number) => !Number.isInteger(number) || number < 1 || number > 25)
  ) {
    throw new RangeError("A redução exige exatamente 20 dezenas distintas, de 1 a 25.");
  }
  return [...available].sort((a, b) => a - b);
}

function ticketExcluding(sorted: readonly number[], excluded: readonly number[]): LotofacilWheelTicket {
  const excludedSet = new Set(excluded);
  return { numbers: sorted.filter((number) => !excludedSet.has(number)), excluded: [...excluded].sort((a, b) => a - b) };
}

// Com 20 dezenas, cada jogo de 15 é definido pelas 5 que deixa de fora, e um
// sorteio que cai dentro das 20 também "deixa de fora" 5 delas. Os acertos
// de um jogo são 10 + quantas das suas 5 excluídas também não saíram.
//
// Garantia 12 com 4 jogos: as 20 dezenas viram 4 grupos de 5 e cada jogo
// exclui um grupo. As 5 que não saem se espalham por só 4 grupos, então
// algum grupo recebe ao menos 2 delas — o jogo que exclui esse grupo faz 12+.
export function lotofacilWheel20(available: readonly number[]): LotofacilWheelTicket[] {
  const sorted = validated20(available);
  // Grupos intercalados (1º, 5º, 9º…) para cada jogo misturar baixas e altas.
  return Array.from({ length: 4 }, (_, group) => ticketExcluding(sorted, sorted.filter((_, index) => index % 4 === group)));
}

// Cobertura de todos os trios de 10 pontos por 17 blocos de 5 (achada por
// busca; cada trio de {0..9} está contido em ao menos um bloco).
const TRIPLE_COVER_10 = [
  [0, 1, 2, 6, 8], [0, 1, 3, 4, 7], [0, 1, 5, 8, 9], [0, 2, 3, 6, 8], [0, 2, 4, 8, 9], [0, 2, 5, 7, 8],
  [0, 3, 4, 5, 6], [0, 3, 6, 7, 9], [1, 2, 3, 5, 9], [1, 2, 4, 5, 6], [1, 2, 6, 7, 9], [1, 3, 4, 8, 9],
  [1, 3, 5, 6, 7], [1, 6, 7, 8, 9], [2, 3, 4, 7, 8], [3, 4, 5, 6, 8], [4, 5, 6, 7, 9],
];

// Garantia 13 com 34 jogos: as 20 dezenas viram 2 metades de 10. Das 5 que
// não saem, ao menos 3 caem na mesma metade (casa dos pombos), e esse trio
// está dentro de algum bloco excluído daquela metade — o jogo correspondente
// tem ao menos 3 excluídas que também não saíram, ou seja, 13+ pontos.
export function lotofacilWheel20x13(available: readonly number[]): LotofacilWheelTicket[] {
  const sorted = validated20(available);
  const halves = [sorted.filter((_, index) => index % 2 === 0), sorted.filter((_, index) => index % 2 === 1)];
  return halves.flatMap((half) => TRIPLE_COVER_10.map((block) => ticketExcluding(sorted, block.map((index) => half[index]))));
}

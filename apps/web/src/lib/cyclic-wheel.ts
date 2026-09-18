export type CyclicWheelTicket = { numbers: number[] };

// Fechamento cíclico genérico: útil sempre que a aposta simples tem o mesmo
// tamanho do sorteio (Mega-Sena 6=6, Quina 5=5, dezenas da +Milionária 6=6).
// As dezenas do pool viram grupos sequenciais; cada jogo exclui 1 dezena de
// cada grupo, girando a posição excluída a cada jogo (o número de jogos é o
// tamanho do maior grupo, garantindo que todo membro de todo grupo fique de
// fora de pelo menos 1 jogo). Isso garante matematicamente uma pontuação
// mínima sempre que o sorteio real cair inteiro dentro do pool escolhido
// (prova por força bruta nos testes, para cada combinação de pool/grupos).
export function cyclicWheel(available: readonly number[], groupSizes: readonly number[]): CyclicWheelTicket[] {
  const total = groupSizes.reduce((sum, size) => sum + size, 0);
  if (
    groupSizes.some((size) => !Number.isInteger(size) || size < 1) ||
    available.length !== total ||
    new Set(available).size !== total ||
    available.some((number) => !Number.isInteger(number))
  ) {
    throw new RangeError(`Esta redução exige exatamente ${total} dezenas distintas.`);
  }
  const sorted = [...available].sort((a, b) => a - b);
  const groups: number[][] = [];
  let cursor = 0;
  for (const size of groupSizes) { groups.push(sorted.slice(cursor, cursor + size)); cursor += size; }
  const cycles = Math.max(...groupSizes);
  return Array.from({ length: cycles }, (_, ticket) => {
    const excluded = new Set(groups.map((group) => group[ticket % group.length]));
    return { numbers: sorted.filter((number) => !excluded.has(number)) };
  });
}

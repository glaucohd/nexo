export type MilionariaTicket = { numbers: number[]; trevos: number[] };

export function isExcluded(number: number, general: ReadonlySet<string>, personal: ReadonlySet<string>) {
  const row = Math.floor((number - 1) / 5) + 1;
  const column = (number - 1) % 5 + 1;
  return [`half:${row <= 5 ? 1 : 2}`, `row:${row}`, `column:${column}`]
    .some((key) => general.has(key) || personal.has(key));
}

export function availableNumbers(general: ReadonlySet<string>, personal: ReadonlySet<string>) {
  return Array.from({ length: 50 }, (_, index) => index + 1)
    .filter((number) => !isExcluded(number, general, personal));
}

export function combinations(total: number, picked: number) {
  if (picked < 0 || picked > total) return 0;
  let count = 1;
  for (let step = 1; step <= picked; step += 1) count = count * (total - picked + step) / step;
  return Math.round(count);
}

export function coveragePercent(available: number) {
  return combinations(available, 6) / combinations(50, 6) * 100;
}

export function ticketCost(size: number, quantity: number) {
  return 6 * combinations(size, 6) * quantity;
}

function shuffled<T>(values: readonly T[], random: () => number) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export function generateMilionariaTickets({
  quantity,
  size,
  general,
  personal,
  random = Math.random,
}: {
  quantity: number;
  size: number;
  general: ReadonlySet<string>;
  personal: readonly ReadonlySet<string>[];
  random?: () => number;
}): MilionariaTicket[] {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10 || !Number.isInteger(size) || size < 6 || size > 12) {
    throw new RangeError("Escolha de 1 a 10 jogos, com 6 a 12 dezenas por jogo.");
  }
  const pools = Array.from({ length: quantity }, (_, index) => availableNumbers(general, personal[index] ?? new Set<string>()));
  if (pools.some((pool) => pool.length < size)) throw new RangeError("As exclusões deixam menos dezenas livres do que o jogo exige.");

  const tickets: MilionariaTicket[] = [];
  const used = new Set<string>();
  for (let index = 0; index < quantity; index += 1) {
    let ticket: MilionariaTicket | null = null;
    for (let attempt = 0; attempt < 2000; attempt += 1) {
      const numbers = shuffled(pools[index], random).slice(0, size).sort((a, b) => a - b);
      const trevos = shuffled([1, 2, 3, 4, 5, 6], random).slice(0, 2).sort((a, b) => a - b);
      const key = `${numbers.join(",")}|${trevos.join(",")}`;
      if (!used.has(key)) {
        used.add(key);
        ticket = { numbers, trevos };
        break;
      }
    }
    if (!ticket) throw new RangeError("Não foi possível montar jogos diferentes com essas exclusões. Reduza os filtros.");
    tickets.push(ticket);
  }
  return tickets;
}

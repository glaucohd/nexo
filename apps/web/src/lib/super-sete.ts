import type { DrawNumbers, GeneratorMode } from "./lottery-generator.ts";

export type SuperSeteTicket = { columns: number[][] };
export type SuperSeteRules = { fixed: number[][]; avoided: number[][] };

export function superSeteColumnSizes(total: number, fixed: readonly (readonly number[])[] = Array.from({ length: 7 }, () => [])) {
  if (!Number.isInteger(total) || total < 7 || total > 21) throw new RangeError("Escolha de 7 a 21 dígitos.");
  const base = total <= 14 ? 1 : 2;
  if (fixed.length !== 7 || fixed.some((column) => column.length > base + 1)) throw new RangeError(`Para ${total} dígitos, cada coluna aceita no máximo ${base + 1} fixos.`);
  const sizes = Array(7).fill(base) as number[];
  let extras = total - base * 7;
  for (let column = 0; column < 7; column += 1) if (fixed[column].length > base) { sizes[column] += 1; extras -= 1; }
  if (extras < 0) throw new RangeError("Há mais colunas com fixas extras do que o total de dígitos permite.");
  for (let column = 0; column < 7 && extras > 0; column += 1) if (sizes[column] === base) { sizes[column] += 1; extras -= 1; }
  return sizes;
}

export function validSuperSeteDraw(numbers: readonly number[]) {
  return numbers.length === 7 && numbers.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9);
}

export function validSuperSeteTicket(ticket: SuperSeteTicket) {
  if (ticket.columns.length !== 7) return false;
  const sizes = ticket.columns.map((column) => column.length);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total < 7 || total > 21 || sizes.some((size) => size < (total <= 14 ? 1 : 2) || size > (total <= 14 ? 2 : 3))) return false;
  return ticket.columns.every((column) => new Set(column).size === column.length && column.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9));
}

export function superSeteCombinations(ticket: SuperSeteTicket) {
  return ticket.columns.reduce((product, column) => product * column.length, 1);
}

// Quantas apostas simples embutidas acertam exatamente 0…7 colunas.
export function superSeteHitDistribution(ticket: SuperSeteTicket, result: readonly number[]) {
  if (!validSuperSeteTicket(ticket) || !validSuperSeteDraw(result)) throw new RangeError("Cartela ou resultado da Super Sete inválido.");
  let distribution = [1, 0, 0, 0, 0, 0, 0, 0];
  for (let column = 0; column < 7; column += 1) {
    const selected = ticket.columns[column];
    const hits = selected.includes(result[column]) ? 1 : 0;
    const misses = selected.length - hits;
    const next = Array(8).fill(0) as number[];
    for (let count = 0; count <= column; count += 1) {
      next[count] += distribution[count] * misses;
      next[count + 1] += distribution[count] * hits;
    }
    distribution = next;
  }
  return distribution;
}

export function generateSuperSeteTickets({ quantity, total, mode, history, rules, random = Math.random }: {
  quantity: number; total: number; mode: GeneratorMode; history?: readonly DrawNumbers[];
  rules: SuperSeteRules; random?: () => number;
}): SuperSeteTicket[] {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new RangeError("Escolha de 1 a 20 jogos.");
  const sizes = superSeteColumnSizes(total, rules.fixed);
  if (rules.fixed.length !== 7 || rules.avoided.length !== 7) throw new RangeError("As regras precisam conter as sete colunas.");
  const draws = (history ?? []).filter((draw) => validSuperSeteDraw(draw.numbers));
  if (mode !== "pure" && !draws.length) throw new RangeError("Importe resultados antes de usar critérios históricos.");
  const frequency = Array.from({ length: 7 }, () => Array(10).fill(0) as number[]);
  const delay = Array.from({ length: 7 }, () => Array(10).fill(draws.length) as number[]);
  for (const [index, draw] of draws.entries()) for (let column = 0; column < 7; column += 1) {
    frequency[column][draw.numbers[column]] += 1;
    delay[column][draw.numbers[column]] = Math.min(delay[column][draw.numbers[column]], index);
  }
  const tickets: SuperSeteTicket[] = [];
  const seen = new Set<string>();
  for (let game = 0; game < quantity; game += 1) {
    let ticket: SuperSeteTicket | null = null;
    for (let attempt = 0; attempt < 300 && !ticket; attempt += 1) {
      const columns = sizes.map((size, column) => {
        const fixed = rules.fixed[column];
        const avoided = new Set(rules.avoided[column]);
        if (new Set(fixed).size !== fixed.length || fixed.some((digit) => avoided.has(digit) || !Number.isInteger(digit) || digit < 0 || digit > 9)) throw new RangeError(`Fixas inválidas na coluna ${column + 1}.`);
        const pool = Array.from({ length: 10 }, (_, digit) => digit).filter((digit) => !avoided.has(digit) && !fixed.includes(digit));
        if (fixed.length > size || fixed.length + pool.length < size) throw new RangeError(`A coluna ${column + 1} não tem dígitos livres suficientes para ${size} marcações.`);
        const picked = [...fixed];
        while (picked.length < size) {
          const weights = pool.map((digit) => {
            const frequent = 1 + frequency[column][digit];
            const delayed = 1 + delay[column][digit];
            if (mode === "hot") return frequent;
            if (mode === "delayed") return delayed;
            if (mode === "mixed" || mode === "balanced") return Math.sqrt(frequent * delayed);
            return 1;
          });
          let point = random() * weights.reduce((sum, weight) => sum + weight, 0);
          let chosen = pool.length - 1;
          for (let index = 0; index < pool.length; index += 1) if ((point -= weights[index]) < 0) { chosen = index; break; }
          picked.push(pool[chosen]);
          pool.splice(chosen, 1);
        }
        return picked.sort((a, b) => a - b);
      });
      const candidate = { columns };
      const key = JSON.stringify(columns);
      if (!seen.has(key)) { seen.add(key); ticket = candidate; }
    }
    if (!ticket) throw new RangeError("Não foi possível montar jogos diferentes com essas regras. Reduza a quantidade ou as fixas.");
    tickets.push(ticket);
  }
  return tickets;
}

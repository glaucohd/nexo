import { z } from "zod";

import { lotteryGames, type LotterySlug } from "@/lib/lottery-generator";
import { validSuperSeteTicket } from "@/lib/super-sete";

export const ticketSchema = z.object({
  numbers: z.array(z.number().int()).max(50),
  columns: z.array(z.array(z.number().int().min(0).max(9)).max(3)).length(7).optional(),
  month: z.number().int().min(1).max(12).optional(),
  trevos: z.array(z.number().int().min(1).max(6)).optional(),
}).strict();

export type ValidatedTicket = z.infer<typeof ticketSchema>;

export const lotterySlugSchema = z.enum(Object.keys(lotteryGames) as [LotterySlug, ...LotterySlug[]]);

// Confere se cada cartela respeita o volante da modalidade: quantidade de
// dezenas, faixa, repetição, trevos da +Milionária e colunas da Super Sete.
export function ticketsFitLottery(slug: LotterySlug, tickets: readonly ValidatedTicket[]) {
  const game = lotteryGames[slug];
  return tickets.every((ticket) => slug === "super-sete"
    ? ticket.numbers.length === 0 && !!ticket.columns && validSuperSeteTicket({ columns: ticket.columns })
    : ticket.columns === undefined && ticket.numbers.length >= game.min && ticket.numbers.length <= game.max
      && new Set(ticket.numbers).size === ticket.numbers.length
      && ticket.numbers.every((number) => number >= game.start && number < game.start + game.total)
      && (slug !== "mais-milionaria" || ticket.trevos?.length === 2 && new Set(ticket.trevos).size === 2));
}

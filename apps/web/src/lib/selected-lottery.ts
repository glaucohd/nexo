// Loteria escolhida pelo usuário, lembrada entre as telas. Fica num cookie (e
// não só no navegador) para o servidor já entregar a tela e o tema certos, sem
// piscar a Lotofácil antes de trocar.

import { lotteryGames, type LotterySlug } from "./lottery-generator.ts";

export const LOTTERY_COOKIE = "nexo-modalidade";

export function validLottery(value: string | null | undefined): LotterySlug | undefined {
  return value && Object.hasOwn(lotteryGames, value) ? value as LotterySlug : undefined;
}

// A URL (?modalidade=) manda; sem ela vale a última escolha.
export function pickLottery(fromUrl: string | undefined, fromCookie: string | undefined): LotterySlug | undefined {
  return validLottery(fromUrl) ?? validLottery(fromCookie);
}

// Só no navegador: guarda a escolha e já pinta o sistema com a loteria.
export function rememberLottery(slug: string) {
  if (typeof document === "undefined" || !validLottery(slug)) return;
  document.cookie = `${LOTTERY_COOKIE}=${slug}; path=/; max-age=31536000; samesite=lax`;
  document.querySelector(".app-shell")?.setAttribute("data-lottery", slug);
}

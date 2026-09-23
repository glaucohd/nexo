// O que cada redução garante quando só parte das sorteadas cai no grupo.
// Cada linha diz: "se pelo menos `inPool` das sorteadas estiverem no seu
// grupo, algum jogo faz pelo menos `hits` acertos". Só entram linhas que já
// valem prêmio. Os valores são conferidos por força bruta em
// tests/reduction-stats.test.mjs, com as mesmas funções que geram os jogos.

export type GuaranteeRow = { inPool: number; hits: number };

export const reductionGuarantees: Record<string, GuaranteeRow[]> = {
  "lotofacil:18x13": [{ inPool: 15, hits: 13 }, { inPool: 14, hits: 12 }, { inPool: 13, hits: 11 }],
  "lotofacil:18x14": [{ inPool: 15, hits: 14 }, { inPool: 14, hits: 13 }, { inPool: 13, hits: 12 }, { inPool: 12, hits: 11 }],
  "lotofacil:20x12": [{ inPool: 15, hits: 12 }, { inPool: 14, hits: 11 }],
  "lotofacil:20x13": [{ inPool: 15, hits: 13 }, { inPool: 14, hits: 12 }, { inPool: 13, hits: 11 }],
  "mega-sena:quina8": [{ inPool: 6, hits: 5 }, { inPool: 5, hits: 4 }],
  "mega-sena:quadra9": [{ inPool: 6, hits: 4 }, { inPool: 5, hits: 4 }],
  "mega-sena:sena7": [{ inPool: 6, hits: 6 }, { inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }],
  "dupla-sena:quina8": [{ inPool: 6, hits: 5 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 3 }, { inPool: 3, hits: 3 }],
  "dupla-sena:quadra9": [{ inPool: 6, hits: 4 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 3 }],
  "dupla-sena:sena7": [{ inPool: 6, hits: 6 }, { inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }, { inPool: 3, hits: 3 }],
  "quina:quadra7": [{ inPool: 5, hits: 4 }, { inPool: 4, hits: 3 }, { inPool: 3, hits: 2 }, { inPool: 2, hits: 2 }],
  "quina:terno8": [{ inPool: 5, hits: 3 }, { inPool: 4, hits: 3 }, { inPool: 3, hits: 2 }],
  "quina:quina6": [{ inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }, { inPool: 3, hits: 3 }, { inPool: 2, hits: 2 }],
  "timemania:quatro20": [{ inPool: 7, hits: 4 }, { inPool: 6, hits: 3 }, { inPool: 5, hits: 3 }],
  "timemania:cinco15": [{ inPool: 7, hits: 5 }, { inPool: 6, hits: 4 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 3 }],
  "timemania:seis13": [{ inPool: 7, hits: 6 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 3 }, { inPool: 3, hits: 3 }],
  "timemania:sete11": [{ inPool: 7, hits: 7 }, { inPool: 6, hits: 6 }, { inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }, { inPool: 3, hits: 3 }],
  // Na +Milionária, 3 acertos só pagam com trevo certo; ficam só as linhas de
  // 4+ dezenas, que pagam com qualquer trevo.
  "mais-milionaria:quina8": [{ inPool: 6, hits: 5 }, { inPool: 5, hits: 4 }],
  "mais-milionaria:quadra9": [{ inPool: 6, hits: 4 }, { inPool: 5, hits: 4 }],
  "lotomania:70": [{ inPool: 20, hits: 15 }],
  "dia-de-sorte:any4-8": [{ inPool: 7, hits: 6 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any4-9": [{ inPool: 7, hits: 6 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any4-10": [{ inPool: 7, hits: 6 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any4-11": [{ inPool: 7, hits: 5 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any4-12": [{ inPool: 7, hits: 5 }, { inPool: 6, hits: 4 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any4-13": [{ inPool: 7, hits: 5 }, { inPool: 6, hits: 4 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any4-14": [{ inPool: 7, hits: 5 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 4 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any5-8": [{ inPool: 7, hits: 6 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any5-9": [{ inPool: 7, hits: 6 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any5-10": [{ inPool: 7, hits: 6 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any5-11": [{ inPool: 7, hits: 6 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any5-12": [{ inPool: 7, hits: 6 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:any5-13": [{ inPool: 7, hits: 5 }, { inPool: 6, hits: 5 }, { inPool: 5, hits: 5 }, { inPool: 4, hits: 4 }],
  "dia-de-sorte:all4-14": [{ inPool: 7, hits: 4 }],
  "dia-de-sorte:all4-20": [{ inPool: 7, hits: 4 }],
};

function choose(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let index = 1; index <= k; index += 1) result = result * (n - k + index) / index;
  return result;
}

// Em média, de quantos em quantos concursos pelo menos `inPool` das
// `drawSize` sorteadas caem num grupo de `pool` dezenas (hipergeométrica).
// Na Dupla Sena são dois sorteios por concurso: basta um deles cumprir.
export function concoursesPerOccurrence({ total, drawSize, pool, inPool, draws = 1 }: { total: number; drawSize: number; pool: number; inPool: number; draws?: number }) {
  let chance = 0;
  for (let hits = inPool; hits <= drawSize; hits += 1) chance += choose(pool, hits) * choose(total - pool, drawSize - hits) / choose(total, drawSize);
  const perContest = 1 - (1 - chance) ** draws;
  return perContest > 0 ? 1 / perContest : Infinity;
}

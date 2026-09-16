"use strict";

const assert = require("assert");

const ordens = [
  Array.from({length: 25}, (_, i) => i + 1),
  [6,17,3,24,10, 1,14,22,8,19, 5,12,25,9,16, 2,15,21,7,18, 4,11,23,13,20],
];
const fixasPorPar = Array.from({length: 10}, (_, par) => {
  const ordem = ordens[Math.floor(par / 5)];
  return ordem.slice((par % 5) * 5, (par % 5 + 1) * 5).sort((a, b) => a - b);
});

function parEspelho(fixas, deslocamento) {
  const livres = Array.from({length: 25}, (_, i) => i + 1).filter((n) => !fixas.includes(n));
  const giro = livres.map((_, i) => livres[(i + deslocamento) % livres.length]);
  return [
    [...fixas, ...giro.slice(0, 10)].sort((a, b) => a - b),
    [...fixas, ...giro.slice(10)].sort((a, b) => a - b),
  ];
}

const vistos = new Set();
const assinaturasFixas = new Set();
for (let p = 0; p < 10; p++) {
  const fixas = fixasPorPar[p];
  const [a, b] = parEspelho(fixas, p);
  const intersecao = a.filter((n) => b.includes(n));
  const uniao = new Set([...a, ...b]);

  assert.strictEqual(fixas.length, 5, "cada par precisa ter cinco fixas próprias");
  assert.ok(!assinaturasFixas.has(fixas.join(",")), "pares não devem repetir o mesmo grupo de fixas");
  assinaturasFixas.add(fixas.join(","));
  assert.strictEqual(a.length, 15, "cartela A precisa ter 15 dezenas");
  assert.strictEqual(b.length, 15, "cartela B precisa ter 15 dezenas");
  assert.deepStrictEqual(intersecao, fixas, "cada par deve compartilhar somente suas próprias cinco fixas");
  assert.strictEqual(uniao.size, 25, "cada par deve cobrir todo o volante");
  assert.ok(!vistos.has(a.join(",")) && !vistos.has(b.join(",")), "cartelas duplicadas");
  vistos.add(a.join(","));
  vistos.add(b.join(","));
}

assert.strictEqual(assinaturasFixas.size, 10, "dez pares precisam ter dez grupos de fixas");
assert.strictEqual(vistos.size, 20, "dez pares devem produzir vinte cartelas distintas");
assert.strictEqual(10 * 2 * 3.5, 70, "dez pares devem custar R$ 70,00");
assert.strictEqual(8 * 2 * 3.5, 56, "o maior plano dentro de R$ 60 são oito pares");

console.log("Jogada espelho OK: 10 pares independentes, 20 cartelas e cobertura 25/25 por par.");

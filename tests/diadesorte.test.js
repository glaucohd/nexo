"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const concursos = JSON.parse(
  fs.readFileSync(path.join(raiz, "dados", "diadesorte.json"), "utf8")
).concursos;

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return Math.round(r);
}

function premiosDesdobrados(nDez, acertos, acertouMes) {
  const out = {};
  for (let k = 4; k <= acertos; k++) {
    const qtd = comb(acertos, k) * comb(nDez - acertos, 7 - k);
    if (qtd) out[k] = qtd;
  }
  if (acertouMes) out.mes = comb(nDez, 7);
  return out;
}

assert.ok(concursos.length >= 10, "o histórico precisa ter amostra suficiente");

const ids = new Set();
for (let i = 0; i < concursos.length; i++) {
  const concurso = concursos[i];
  assert.equal(ids.has(concurso.concurso), false, `concurso ${concurso.concurso} duplicado`);
  ids.add(concurso.concurso);
  assert.equal(concurso.dezenas.length, 7, `concurso ${concurso.concurso} sem 7 dezenas`);
  assert.equal(new Set(concurso.dezenas).size, 7, `concurso ${concurso.concurso} repete dezena`);
  assert.ok(concurso.dezenas.every(n => Number.isInteger(n) && n >= 1 && n <= 31));
  assert.equal(concurso.trevos.length, 1, `concurso ${concurso.concurso} sem Mês da Sorte`);
  assert.ok(concurso.trevos[0] >= 1 && concurso.trevos[0] <= 12);
  if (i) assert.ok(concursos[i - 1].concurso > concurso.concurso, "histórico fora de ordem");
}

const precosOficiais = {
  7: 2.5, 8: 20, 9: 90, 10: 300, 11: 825,
  12: 1980, 13: 4290, 14: 8580, 15: 16087.5
};
for (let n = 7; n <= 15; n++) {
  assert.equal(comb(n, 7) * 2.5, precosOficiais[n], `preço incorreto para ${n} dezenas`);
  assert.equal(premiosDesdobrados(n, 0, true).mes, comb(n, 7));
}

assert.deepEqual(premiosDesdobrados(8, 7, false), {6: 7, 7: 1});
assert.deepEqual(premiosDesdobrados(8, 6, false), {5: 6, 6: 2});
assert.deepEqual(premiosDesdobrados(8, 5, false), {4: 5, 5: 3});
assert.deepEqual(premiosDesdobrados(8, 4, false), {4: 4});

const repeticaoEsperada = 7 * 7 / 31;
assert.ok(Math.abs(repeticaoEsperada - 1.580645) < 0.000001);

console.log(`Dia de Sorte OK: ${concursos.length} concursos validados.`);

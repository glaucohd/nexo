"use strict";

const assert = require("assert");
const historico = require("../dados/historico.json").concursos;

// Carteira determinística com 17 jogos distintos, suficiente para validar os
// totais exibidos pelo painel sem depender do gerador aleatório do navegador.
const jogos = Array.from({length: 17}, (_, inicio) =>
  Array.from({length: 15}, (_, i) => ((inicio + i) % 25) + 1).sort((a, b) => a - b)
);

const todos = {};
const melhores = {};
const porJogo = jogos.map(() => ({soma: 0, dist: {}}));

historico.forEach((concurso) => {
  let melhor = -1;
  const sorteadas = new Set(concurso.dezenas);
  jogos.forEach((jogo, indice) => {
    const acertos = jogo.filter((n) => sorteadas.has(n)).length;
    todos[acertos] = (todos[acertos] || 0) + 1;
    porJogo[indice].dist[acertos] = (porJogo[indice].dist[acertos] || 0) + 1;
    porJogo[indice].soma += acertos;
    melhor = Math.max(melhor, acertos);
  });
  melhores[melhor] = (melhores[melhor] || 0) + 1;
});

const soma = (obj) => Object.values(obj).reduce((total, n) => total + n, 0);
assert.strictEqual(soma(todos), 17 * historico.length, "cada cartela deve ser comparada com cada concurso");
assert.strictEqual(soma(melhores), historico.length, "deve existir um melhor resultado por concurso");
porJogo.forEach((jogo) => assert.strictEqual(soma(jogo.dist), historico.length));
assert.ok(Object.keys(todos).every((p) => +p >= 5 && +p <= 15), "acertos fora dos limites da Lotofácil");

const media = Object.entries(todos).reduce((total, [pontos, quantidade]) =>
  total + (+pontos * quantidade), 0) / soma(todos);
assert.ok(media > 8.5 && media < 9.5, "a média da amostra deve permanecer próxima dos 9 acertos matemáticos");

console.log(`Carteira histórica OK: ${soma(todos)} comparações e ${soma(melhores)} melhores resultados.`);

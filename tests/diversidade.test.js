"use strict";

const assert = require("node:assert/strict");

function pontuacao(candidato, anteriores, modo){
  if(!anteriores.length)return 0;
  const usados=new Set(anteriores.flat());
  const novos=candidato.filter(n=>!usados.has(n)).length;
  let maxRep=0,somaRep=0;
  for(const jogo of anteriores){
    const rep=candidato.filter(n=>jogo.includes(n)).length;
    maxRep=Math.max(maxRep,rep);somaRep+=rep;
  }
  return modo==="maxima"?-novos*1000+maxRep*40+somaRep:maxRep*100+somaRep*5-novos*12;
}

function metricas(jogos){
  const unicas=new Set(jogos.flat());let soma=0,pares=0,max=0;
  for(let i=0;i<jogos.length;i++)for(let j=i+1;j<jogos.length;j++){
    const rep=jogos[i].filter(n=>jogos[j].includes(n)).length;
    soma+=rep;pares++;max=Math.max(max,rep);
  }
  return{unicas:unicas.size,media:pares?soma/pares:0,max};
}

const anterior=[[1,2,3,4,5,6]];
const parecido=[1,2,3,4,7,8];
const diverso=[7,8,9,10,11,12];
assert.ok(pontuacao(diverso,anterior,"diversificada")<pontuacao(parecido,anterior,"diversificada"));
assert.ok(pontuacao(diverso,anterior,"maxima")<pontuacao(parecido,anterior,"maxima"));

const carteira=metricas([[1,2,3,4,5,6],[7,8,9,10,11,12],[1,13,14,15,16,17]]);
assert.equal(carteira.unicas,17);
assert.equal(carteira.max,1);
assert.equal(carteira.media,1/3);

console.log("Diversidade OK: cobertura e sobreposição validadas.");

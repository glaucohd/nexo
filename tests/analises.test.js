"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const jogos = {
  lotofacil: {arquivo:"historico.json", total:25, dezenas:15, max:20, repeticoes:[6,7,8,9,10,11,12], extras:0, extraEscolher:0},
  megasena: {arquivo:"megasena.json", total:60, dezenas:6, max:20, repeticoes:[0,1,2,3], extras:0, extraEscolher:0},
  maismilionaria: {arquivo:"maismilionaria.json", total:50, dezenas:6, max:12, repeticoes:[0,1,2,3], extras:6, extraEscolher:2},
  quina: {arquivo:"quina.json", total:80, dezenas:5, max:15, repeticoes:[0,1,2], extras:0, extraEscolher:0}
};

function comb(n,k){
  if(k<0||k>n)return 0;
  let r=1;
  for(let i=1;i<=k;i++)r=r*(n-k+i)/i;
  return Math.round(r);
}

for(const [nome,cfg] of Object.entries(jogos)){
  const hist=JSON.parse(fs.readFileSync(path.join(raiz,"dados",cfg.arquivo),"utf8")).concursos;
  assert.ok(hist.length>=100,`${nome}: histórico curto`);
  const ids=new Set();
  for(let i=0;i<hist.length;i++){
    const c=hist[i];
    assert.equal(ids.has(c.concurso),false,`${nome}: concurso duplicado`);ids.add(c.concurso);
    assert.equal(c.dezenas.length,cfg.dezenas,`${nome}: quantidade de dezenas inválida`);
    assert.equal(new Set(c.dezenas).size,cfg.dezenas,`${nome}: dezena repetida no concurso`);
    assert.ok(c.dezenas.every(n=>Number.isInteger(n)&&n>=1&&n<=cfg.total),`${nome}: dezena fora do universo`);
    if(cfg.extras){
      assert.equal((c.trevos||[]).length,cfg.extraEscolher,`${nome}: quantidade de extras inválida`);
      assert.equal(new Set(c.trevos).size,cfg.extraEscolher,`${nome}: extra repetido`);
      assert.ok(c.trevos.every(n=>n>=1&&n<=cfg.extras),`${nome}: extra fora do universo`);
    }
    if(i)assert.ok(hist[i-1].concurso>c.concurso,`${nome}: histórico fora de ordem`);
  }

  let somaProb=0;
  for(let r=0;r<=cfg.dezenas;r++)
    somaProb+=comb(cfg.dezenas,r)*comb(cfg.total-cfg.dezenas,cfg.dezenas-r)/comb(cfg.total,cfg.dezenas);
  assert.ok(Math.abs(somaProb-1)<1e-10,`${nome}: distribuição de repetição não soma 100%`);
  const mediaPorSoma=Array.from({length:cfg.dezenas},()=>cfg.dezenas/cfg.total).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(cfg.dezenas*cfg.dezenas/cfg.total-mediaPorSoma)<1e-12,
    `${nome}: média teórica de repetição inconsistente`);
  for(let n=cfg.dezenas;n<=cfg.max;n++){
    const minimo=Math.max(0,n+cfg.dezenas-cfg.total),maximo=Math.min(n,cfg.dezenas);
    for(const repetidas of cfg.repeticoes.filter(r=>r>=minimo&&r<=maximo)){
      assert.ok(comb(cfg.dezenas,repetidas)*comb(cfg.total-cfg.dezenas,n-repetidas)>0,
        `${nome}: filtro impossível de ${repetidas} repetidas em ${n} dezenas`);
    }
  }
  console.log(`${nome}: ${hist.length} concursos OK`);
}

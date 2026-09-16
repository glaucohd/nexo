(function(){
  "use strict";

  var TOTAL = 25, GAME_SIZE = 15;
  var PREMIA_A_PARTIR_DE = 11;   // faixas de prêmio da Lotofácil: 11, 12, 13, 14 e 15

  var STORE_PREMIOS = "lotofacil:premios";
  // 11, 12 e 13 acertos são prêmios FIXOS da Lotofácil, definidos como múltiplos
  // do preço da aposta de 15 dezenas (2x, 4x e 10x) — com a aposta a R$ 3,50 dão
  // R$ 7,00, R$ 14,00 e R$ 35,00. Só 14 e 15 são rateio e variam a cada concurso.
  var PREMIO_FIXO = {11:2, 12:4, 13:10};
  var PREMIO_RATEIO_PADRAO = {14:889.00, 15:532221.00};   // referência do concurso 3779
  var premios = {};

  var STORE_DRAW = "lotofacil:sorteio";

  var toastEl     = document.getElementById("toast");
  var subtitulo   = document.getElementById("subtitulo");
  var balanceCard = document.getElementById("balanceCard");
  var balanceBox  = document.getElementById("balanceBox");
  var heatCard    = document.getElementById("heatCard");
  var heatGrid    = document.getElementById("heatGrid");
  var heatRange   = document.getElementById("heatRange");
  var heatTag     = document.getElementById("heatTag");
  var heatNote    = document.getElementById("heatNote");
  var heatWarn    = document.getElementById("heatWarn");
  var drawPick    = document.getElementById("drawPick");
  var drawStatus  = document.getElementById("drawStatus");

  var drawn = [];         // dezenas sorteadas, marcadas no clique

  /* ---------- utilidades ---------- */
  function pad(n){ return n < 10 ? "0" + n : String(n); }

  // Usa a fonte aleatória do navegador quando disponível. Ela é mais adequada
  // para simular um sorteio do que Math.random(); o fallback mantém o app
  // funcionando em navegadores antigos e quando o arquivo é aberto localmente.
  function randomUint32(){
    if (window.crypto && window.crypto.getRandomValues){
      var valor = new Uint32Array(1);
      window.crypto.getRandomValues(valor);
      return valor[0];
    }
    return null;
  }

  function randomUnit(){
    var valor = randomUint32();
    return valor === null ? Math.random() : valor / 4294967296;
  }

  function randomInt(limite){
    var valor = randomUint32();
    if (valor === null) return Math.floor(Math.random() * limite);

    // Rejeita a sobra da divisão para que cada índice tenha exatamente a
    // mesma chance, mesmo quando "limite" não divide 2^32 por inteiro.
    var teto = 4294967296 - (4294967296 % limite);
    while (valor >= teto) valor = randomUint32();
    return valor % limite;
  }

  function shuffled(arr){
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--){
      var j = randomInt(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function asc(a,b){ return a - b; }

  var toastTimer = null;
  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove("show"); }, 1600);
  }

  function copyText(text, okMsg){
    function fallback(){
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly","");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast(okMsg); }
      catch(e){ toast("Não foi possível copiar"); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){ toast(okMsg); }, fallback);
    } else {
      fallback();
    }
  }

  function store(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function load(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }

  /* ---------- custo ---------- */
  function brl(v){
    try { return v.toLocaleString("pt-BR", {style:"currency", currency:"BRL"}); }
    catch(e){ return "R$ " + v.toFixed(2).replace(".", ","); }
  }

  // Preço da aposta simples — o mesmo usado em "Minhas apostas".
  function priceValue(){ return PRECOS.lotofacil; }

  /* ---------- último resultado (marcado no clique) ---------- */
  // A conferência só vale com as 15 dezenas marcadas; antes disso nada é comparado.
  function drawReady(){ return drawn.length === GAME_SIZE; }

  function inDraw(n){
    return drawReady() && drawn.indexOf(n) >= 0;
  }

  function hitsIn(list){
    var h = 0;
    for (var i = 0; i < list.length; i++) if (inDraw(list[i])) h++;
    return h;
  }

  // Quantos dos 4 jogos caíram em faixa de prêmio neste concurso.
  function resumoPremiados(){
    var jogos = jogosAtuais(), n = 0;
    for (var k = 0; k < jogos.length; k++) if (hitsIn(jogos[k]) >= PREMIA_A_PARTIR_DE) n++;
    var tot = jogos.length;
    if (!n) return "nenhum dos " + tot + " jogos chegou a " + PREMIA_A_PARTIR_DE + " acertos.";
    if (n === 1) return "<b>1</b> dos " + tot + " jogos ficou em faixa premiada (" + PREMIA_A_PARTIR_DE + " acertos ou mais).";
    return "<b>" + n + "</b> dos " + tot + " jogos ficaram em faixa premiada (" + PREMIA_A_PARTIR_DE + " acertos ou mais).";
  }

  function buildDrawPick(){
    if (!drawPick) return;
    var frag = document.createDocumentFragment();
    for (var n = 1; n <= TOTAL; n++){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "dpick";
      b.textContent = pad(n);
      b.dataset.n = n;
      b.setAttribute("aria-pressed", "false");
      frag.appendChild(b);
    }
    drawPick.appendChild(frag);
    drawPick.addEventListener("click", function(ev){
      var el = ev.target.closest(".dpick");
      if (el) toggleDrawn(parseInt(el.dataset.n, 10));
    });
  }

  function toggleDrawn(n){
    var i = drawn.indexOf(n);
    if (i >= 0){
      drawn.splice(i, 1);
    } else {
      if (drawn.length >= GAME_SIZE){ toast("O sorteio tem 15 dezenas"); return; }
      drawn.push(n);
    }
    drawn.sort(asc);
    store(STORE_DRAW, JSON.stringify(drawn));
    atualizarSorteio();
  }

  function limparSorteio(){
    if (!drawn.length) return;
    drawn = [];
    try { localStorage.removeItem(STORE_DRAW); } catch(e){}
    atualizarSorteio();
    toast("Resultado apagado");
  }

  // Sorteia um resultado FAKE (uniforme, sem nenhum critério) pra testar a
  // aderência dos jogos gerados sem esperar um concurso real sair.
  function sortearResultadoFake(){
    var pool = [];
    for (var n = 1; n <= TOTAL; n++) pool.push(n);
    drawn = shuffled(pool).slice(0, GAME_SIZE).sort(asc);
    store(STORE_DRAW, JSON.stringify(drawn));
    atualizarSorteio();
    toast("Resultado sorteado (fake) — não é um concurso real");
  }

  // Repinta tudo que depende do sorteio.
  function atualizarSorteio(){
    paintDrawPick();               // já atualiza o status
    renderBalanco();
    if (GERADORES.lotofacil.jogos.length) renderMegaJogos("lotofacil");   // acertos nos jogos
  }

  function paintDrawPick(){
    if (!drawPick) return;
    var cheio = drawReady();
    var bt = drawPick.children;
    for (var i = 0; i < bt.length; i++){
      var el = bt[i];
      var n = parseInt(el.dataset.n, 10);
      var on = drawn.indexOf(n) >= 0;
      el.classList.toggle("on", on);
      el.classList.toggle("locked", cheio && !on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }
    renderDrawStatus();
  }

  function renderDrawStatus(){
    if (!drawStatus) return;
    if (!drawn.length){
      drawStatus.innerHTML = '<span class="muted">Nenhuma dezena marcada — clique nas 15 sorteadas</span>';
      return;
    }
    if (!drawReady()){
      var falta = GAME_SIZE - drawn.length;
      drawStatus.innerHTML = 'Marcadas: <b>' + drawn.length + '/' + GAME_SIZE + '</b>' +
        '<span class="muted"> · ' + (falta === 1 ? 'falta 1 dezena' : 'faltam ' + falta + ' dezenas') + '</span>';
      return;
    }
    var txt = 'Marcadas: <b>' + GAME_SIZE + '/' + GAME_SIZE + '</b>';
    var meus = jogosAtuais();
    if (meus.length){
      txt += '<span class="muted"> · ' + resumoPremiados() + '</span>';
    } else {
      txt += '<span class="muted"> · gere jogos para conferir</span>';
    }
    drawStatus.innerHTML = txt;
  }

  /* ---------- mapa de calor ---------- */
  var janela = 10;

  // Para cada dezena: quantas vezes saiu na janela, e há quantos concursos
  // ela está saindo ou faltando seguidamente.
  function estatisticaHist(){
    var usados = HISTORICOS.lotofacil.hist.slice(0, janela);
    var info = {};
    for (var n = 1; n <= TOTAL; n++){
      var freq = 0, seq = 0, tipo = "";
      for (var i = 0; i < usados.length; i++) if (usados[i].dezenas.indexOf(n) >= 0) freq++;
      if (usados.length){
        var saiuNoUltimo = usados[0].dezenas.indexOf(n) >= 0;
        tipo = saiuNoUltimo ? "seguidas" : "ausente";
        for (var k = 0; k < usados.length; k++){
          var presente = usados[k].dezenas.indexOf(n) >= 0;
          if (presente !== saiuNoUltimo) break;
          seq++;
        }
      }
      info[n] = {freq: freq, seq: seq, tipo: tipo};
    }
    return info;
  }

  function renderHeat(){
    if (!heatCard || !heatGrid) return;
    if (!HISTORICOS.lotofacil.hist.length){ heatCard.hidden = true; return; }

    if (!heatRange.children.length){
      [10, 20, 30].forEach(function(j){
        if (j > HISTORICOS.lotofacil.hist.length) return;
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn sizebtn"; b.dataset.j = j;
        b.innerHTML = '<b>' + j + ' concursos</b>';
        heatRange.appendChild(b);
      });
      heatRange.addEventListener("click", function(ev){
        var el = ev.target.closest(".sizebtn");
        if (!el) return;
        janela = parseInt(el.dataset.j, 10);
        renderHeat();
      });
    }
    for (var b2 = 0; b2 < heatRange.children.length; b2++)
      heatRange.children[b2].classList.toggle("on", +heatRange.children[b2].dataset.j === janela);

    var info = estatisticaHist();
    var freqs = [];
    for (var n2 = 1; n2 <= TOTAL; n2++) freqs.push(info[n2].freq);
    var min = Math.min.apply(null, freqs), max = Math.max.apply(null, freqs);

    // do mais antigo para o mais recente, para o tempo correr de cima para baixo
    var linhas = HISTORICOS.lotofacil.hist.slice(0, janela).reverse();

    heatTag.textContent = "últimos " + janela;
    heatNote.innerHTML = "Cada linha é um concurso, cada coluna uma dezena. " +
      "Célula marcada = a dezena saiu naquele concurso. O rodapé conta quantas vezes cada uma saiu " +
      "na janela — quanto mais forte a cor, mais vezes.";

    var cab = '<tr><th class="rot">concurso</th>';
    for (var c = 1; c <= TOTAL; c++) cab += '<th>' + pad(c) + '</th>';
    cab += '</tr>';

    var corpo = "";
    for (var L = 0; L < linhas.length; L++){
      var conc = linhas[L];
      corpo += '<tr><th class="rot" title="' + conc.data + '">' + conc.concurso + '</th>';
      for (var n3 = 1; n3 <= TOTAL; n3++){
        var saiu = conc.dezenas.indexOf(n3) >= 0;
        corpo += saiu ? '<td class="on">' + pad(n3) + '</td>' : '<td></td>';
      }
      corpo += '</tr>';
    }

    var rodape = '<tr class="freq"><th class="rot">saiu</th>';
    for (var n4 = 1; n4 <= TOTAL; n4++){
      var it = info[n4];
      var t = max === min ? 0.5 : (it.freq - min) / (max - min);
      var estado = it.tipo === "seguidas"
        ? (it.seq > 1 ? it.seq + " concursos seguidos" : "saiu no último")
        : (it.seq > 1 ? "ausente há " + it.seq : "faltou no último");
      rodape += '<td style="--t:' + t.toFixed(3) + '" title="dezena ' + pad(n4) + ': ' +
                it.freq + ' de ' + janela + ' · ' + estado + '"><b>' + it.freq + '</b></td>';
    }
    rodape += '</tr>';

    heatGrid.innerHTML = '<div class="tablewrap"><table class="heatmatrix">' +
      '<thead>' + cab + '</thead><tbody>' + corpo + '</tbody>' +
      '<tfoot>' + rodape + '</tfoot></table></div>';

    heatWarn.innerHTML = "<b>O que isso não significa:</b> testei nos 200 concursos anteriores e " +
      "nem a frequência nem a sequência mudam a chance do próximo sorteio. Uma dezena que saiu 4 vezes " +
      "seguidas voltou a sair em <b>61,5%</b> das vezes; uma que faltou 3 concursos saiu em <b>57,1%</b>. " +
      "A chance de qualquer dezena é sempre <b>60%</b> (15 de 25). Os botões acima são só um jeito de " +
      "escolher as dezenas — nenhum deles acerta mais que o outro.";
    heatCard.hidden = false;
  }

  // Critérios do mapa de calor. Nenhum deles acerta mais que o outro
  // (testado nos 200 concursos) — são formas de escolher as dezenas.
  var CRITERIOS = {
    quentes:   {rot:"Mais frequentes", dica:"favorece as que mais saíram"},
    frias:     {rot:"Mais atrasadas",  dica:"favorece as que estão há mais tempo sem sair"},
    sequencia: {rot:"Em sequência",    dica:"favorece as que vêm saindo seguidas"},
    misto:     {rot:"Misto",           dica:"alterna frequentes e atrasadas"}
  };

  var criterioAtivo = null;    // qual critério gerou os jogos que estão na tela

  function rotuloCriterio(k){ return CRITERIOS[k].rot; }
  function dicaCriterio(k){ return CRITERIOS[k].dica; }


  function amostraDist(dist){
    var chaves = Object.keys(dist), soma = 0, i;
    for (i = 0; i < chaves.length; i++) soma += dist[chaves[i]];
    var r = randomUnit() * soma, acc = 0;
    for (i = 0; i < chaves.length; i++){
      acc += dist[chaves[i]];
      if (r <= acc) return parseInt(chaves[i], 10);
    }
    return parseInt(chaves[chaves.length - 1], 10);
  }

  // Botões do mapa: acendem o critério equivalente no gerador e geram os jogos lá.
  function gerarPeloMapa(criterio){
    criterioAtivo = criterio;
    // o gerador da Lotofácil agora é o mesmo motor das outras loterias
    var equivale = {quentes:"quentes", frias:"frias", sequencia:"quentes", misto:"misto"};
    var g = GERADORES.lotofacil;
    g.modalidade="normal";
    g.criterio = equivale[criterio] || "neutro";
    var cx = document.getElementById(g.ids.crits);   // acende o critério equivalente no gerador
    if (cx) for (var i = 0; i < cx.children.length; i++)
      cx.children[i].classList.toggle("on", cx.children[i].dataset.crit === g.criterio);
    megaGerarJogos("lotofacil");
    atualizaDicaCriterios();
    toast(CRITERIOS[criterio].rot + ": " + g.jogos.length + " jogos gerados");
    irPara("lf-gerador");
  }

  function atualizaDicaCriterios(){
    var p = document.getElementById("heatHint");
    if (p){
      p.innerHTML = 'Sorteia as dezenas de cada jogo com peso pelo critério: <b>nenhuma dezena fica ' +
        'excluída</b> — as favorecidas só aparecem mais vezes. Os jogos saem na página do Gerador. ' +
        '<br>O critério em si sempre usa todo o histórico guardado, não a janela escolhida acima — ' +
        'ela é só para a tabela, uma janela curta deixaria "mais frequente" mudar demais de um dia ' +
        'para o outro.';
    }
    var box = document.getElementById("heatActions");
    if (!box) return;
    for (var i = 0; i < box.children.length; i++){
      var b = box.children[i], k = b.dataset.crit;
      if (!k) continue;
      b.classList.toggle("on", k === criterioAtivo);
      var rb = b.querySelector("b"), s2 = b.querySelector("small");
      if (rb) rb.textContent = rotuloCriterio(k);
      if (s2) s2.textContent = dicaCriterio(k);
    }
  }

  function buildHeatActions(){
    var box = document.getElementById("heatActions");
    if (!box || box.children.length) return;
    Object.keys(CRITERIOS).forEach(function(k){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn critbtn";
      b.dataset.crit = k;
      b.innerHTML = '<b></b><small></small>';
      box.appendChild(b);
    });
    box.addEventListener("click", function(ev){
      var el = ev.target.closest(".critbtn");
      if (el) gerarPeloMapa(el.dataset.crit);
    });
    atualizaDicaCriterios();
  }

  // Os jogos da Lotofácil são os do gerador — motor único desde que o
  // fechamento foi aposentado.
  function jogosAtuais(){ return GERADORES.lotofacil.jogos; }

  function premioFixo(faixa){ return !!PREMIO_FIXO[faixa]; }

  function premioDe(faixa){
    if (premioFixo(faixa)) return PREMIO_FIXO[faixa] * priceValue();
    var v = premios[faixa];
    return (typeof v === "number" && isFinite(v) && v >= 0) ? v : PREMIO_RATEIO_PADRAO[faixa];
  }

  function renderBalanco(){
    if (!balanceCard || !balanceBox) return;
    if (!jogosAtuais().length || !drawReady()){
      balanceCard.hidden = true;
      balanceBox.innerHTML = "";        // não guarda balanço velho escondido
      return;
    }

    var jogos = jogosAtuais();
    var porFaixa = {}, premiados = 0, investido = 0;
    for (var k = 0; k < jogos.length; k++){
      var h = hitsIn(jogos[k]);
      investido += custoJogo("lotofacil", jogos[k].length);
      // aposta múltipla: cada faixa recebe os jogos simples do desdobramento
      var mapa = premiosDesdobrados("lotofacil", jogos[k].length, h, 0), pegou = false;
      for (var fx in mapa){ porFaixa[fx] = (porFaixa[fx] || 0) + mapa[fx]; pegou = true; }
      if (pegou) premiados++;
    }

    var recebido = 0;
    var linhas = "";

    for (var faixa = GAME_SIZE; faixa >= PREMIA_A_PARTIR_DE; faixa--){
      var qtd = porFaixa[faixa] || 0;
      if (!qtd) continue;
      var unit = premioDe(faixa);
      recebido += qtd * unit;
      linhas +=
        '<tr>' +
          '<td>' + faixa + ' acertos</td>' +
          '<td>' + qtd + (qtd > 1 ? ' jogos' : ' jogo') + '</td>' +
          '<td>' + (premioFixo(faixa)
            ? '<span class="fixo">' + brl(unit) + '<small>prêmio fixo · ' + PREMIO_FIXO[faixa] + '× a aposta</small></span>'
            : '<span class="moneyIn small"><span>R$</span>' +
              '<input type="number" min="0" step="0.01" data-faixa="' + faixa + '" value="' + unit.toFixed(2) + '">' +
              '</span><small class="rateio">rateio — varia</small>') + '</td>' +
          '<td class="right"><b>' + brl(qtd * unit) + '</b></td>' +
        '</tr>';
    }

    if (!premiados){
      linhas = '<tr><td colspan="4" class="muted">Nenhum jogo chegou a ' + PREMIA_A_PARTIR_DE +
               ' acertos neste concurso.</td></tr>';
    }

    var saldo = recebido - investido;
    balanceBox.innerHTML =
      '<div class="tablewrap"><table class="balance"><tbody>' + linhas + '</tbody></table></div>' +
      '<div class="totais">' +
        '<div><span>Recebido</span><b class="' + (recebido > 0 ? "pos" : "") + '">' + brl(recebido) + '</b></div>' +
        '<div><span>Investido (' + jogos.length + ' jogos)</span><b>' + brl(investido) + '</b></div>' +
        '<div class="saldo"><span>Saldo</span><b class="' + (saldo >= 0 ? "pos" : "neg") + '">' +
          (saldo >= 0 ? "+" : "\u2212") + brl(Math.abs(saldo)) + '</b></div>' +
      '</div>';
    balanceCard.hidden = false;
  }

  /* ---------- Mega-Sena, +Milionária, Quina e Dia de Sorte ---------- */
  // Volante no formato da cartela real, com a cruz central dividindo os quadrantes
  // (ou as linhas, na Dia de Sorte). A Lotofácil tem o seu próprio volante à parte.
  var LOTERIAS = {
    lotofacil: {
      nome: "Lotofácil", total: 25, linhas: 5, colunas: 5, escolher: 15,
      maxDezenas: 20,                 // volante oficial: 15 a 20 dezenas
      trevos: 0, divisao: "linhas",
      nota: "Volante 5×5. A divisão natural aqui são as 5 linhas de 5 dezenas."
    },
    megasena: {
      nome: "Mega-Sena", total: 60, linhas: 6, colunas: 10, escolher: 6,
      maxDezenas: 20,                 // volante oficial: 6 a 20 dezenas
      trevos: 0, divisao: "quadrantes",
      nota: "Cartela real: 6 linhas de 10 colunas. A cruz cai entre as colunas 5 e 6 e " +
            "entre as linhas 3 e 4, então os quatro quadrantes têm 15 dezenas cada."
    },
    maismilionaria: {
      nome: "+Milionária", total: 50, linhas: 10, colunas: 5, escolher: 6,
      maxDezenas: 12,                 // volante oficial: 6 a 12 dezenas (trevos: sempre 2 aqui)
      trevos: 6, escolherTrevos: 2, divisao: "metades",
      nota: "Cartela real: 10 linhas de 5 colunas. Com 5 colunas a linha vertical cortaria " +
            "a coluna do meio, então aqui a divisão é só horizontal: 25 dezenas em cima " +
            "(01 a 25) e 25 embaixo (26 a 50)."
    },
    quina: {
      nome: "Quina", total: 80, linhas: 8, colunas: 10, escolher: 5,
      maxDezenas: 15,                 // volante oficial: 5 a 15 dezenas
      trevos: 0, divisao: "quadrantes",
      nota: "Cartela real: 8 linhas de 10 colunas. A cruz cai entre as colunas 5 e 6 e " +
            "entre as linhas 4 e 5, então os quatro quadrantes têm 20 dezenas cada."
    },
    diadesorte: {
      nome: "Dia de Sorte", total: 31, linhas: 5, colunas: 7, escolher: 7,
      maxDezenas: 15,                 // volante oficial: 7 a 15 dezenas
      trevos: 12, escolherTrevos: 1, divisao: "linhas",
      nota: "Os 31 números representam os dias do mês — aqui organizados em semanas de 7 " +
            "só para visualizar; a cartela oficial não tem essa grade, é uma lista solta. " +
            "Além das dezenas, escolhe-se um Mês da Sorte entre os 12 — sempre só 1, mesmo " +
            "em apostas com mais dezenas."
    }
  };

  var loteriaAtual = "megasena";
  var lotSelecao = { megasena: [], maismilionaria: [], quina: [], diadesorte: [] };
  var lotTrevos = [];
  // Essas 4 loterias compartilham o mesmo card de volante ("outrasCard"),
  // trocado pelo menu lateral — Lotofácil tem o seu próprio, à parte.
  var VOLANTE_COMPARTILHADO = ["megasena", "maismilionaria", "quina", "diadesorte"];

  // "Trevo" é o nome genérico do mecanismo (escolher t de N à parte das
  // dezenas); a Dia de Sorte reaproveita ele para o Mês da Sorte.
  var MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho",
               "Agosto","Setembro","Outubro","Novembro","Dezembro"];
  function nomeTrevo(jogo0, n){ return jogo0 === "diadesorte" ? MESES[n - 1] : String(n); }
  function tituloTrevo(jogo0){ return jogo0 === "diadesorte" ? "Mês da sorte" : "Trevos"; }
  function palavraTrevo(jogo0, n){
    return jogo0 === "diadesorte" ? (n === 1 ? "mês" : "meses") : (n === 1 ? "trevo" : "trevos");
  }
  function listaTrevos(jogo0, lista){
    return (lista || []).map(function(n){ return nomeTrevo(jogo0, n); }).join(" e ");
  }

  var loteriaBox  = document.getElementById("loteriaBox");
  var loteriaGrid = document.getElementById("loteriaGrid");
  var loteriaNota = document.getElementById("loteriaNota");
  var loteriaTag  = document.getElementById("loteriaTag");
  var trevoBox    = document.getElementById("trevoBox");
  var trevoGrid   = document.getElementById("trevoGrid");
  var quadInfo    = document.getElementById("quadInfo");

  // Em qual quadrante cai a dezena. Com número ímpar de colunas ou linhas,
  // a faixa do meio é o eixo e não pertence a quadrante nenhum.
  // Onde a dezena cai. cortC/cortL dizem em qual coluna/linha a cruz passa;
  // sem eles, a cruz vai no meio exato (e só corta quando a dimensão é ímpar).
  function quadranteDe(n, cfg){
    var idx = n - 1;
    if (cfg.divisao === "linhas") return "l" + (Math.floor(idx / cfg.colunas) + 1);
    var lin = Math.floor(idx / cfg.colunas), col = idx % cfg.colunas;
    var cortL = cfg.cortL !== undefined ? cfg.cortL : cfg.linhas / 2;
    var cortC = cfg.cortC !== undefined ? cfg.cortC : cfg.colunas / 2;
    var cima = lin < cortL;
    if (cfg.divisao === "metades") return cima ? "sup" : "inf";
    if (cfg.cortL === undefined && (cfg.linhas % 2 === 1) && lin === Math.floor(cortL)) return "eixo";
    if (cfg.cortC === undefined && (cfg.colunas % 2 === 1) && col === Math.floor(cortC)) return "eixo";
    return cima ? (col < cortC ? "q1" : "q2") : (col < cortC ? "q3" : "q4");
  }

  // tamanho de cada quadrante, para o app dizer "3 de 6" corretamente
  function tamanhoQuadrantes(cfg){
    var t = {};
    for (var n = 1; n <= cfg.total; n++){
      var k = quadranteDe(n, cfg);
      t[k] = (t[k] || 0) + 1;
    }
    return t;
  }

  function buildLoteria(){
    var cfg = LOTERIAS[loteriaAtual];
    if (!loteriaGrid) return;

    loteriaGrid.className = "volante " + loteriaAtual + " div-" + (cfg.divisao || "quadrantes");
    loteriaGrid.style.setProperty("--cols", cfg.colunas);
    loteriaGrid.innerHTML = cfg.divisao === "metades"
      ? '<span class="qmark m1">SUPERIOR</span><span class="qmark m3">INFERIOR</span>'
      : '<span class="qmark m1">Q1</span><span class="qmark m2">Q2</span>' +
        '<span class="qmark m3">Q3</span><span class="qmark m4">Q4</span>';
    for (var n = 1; n <= cfg.total; n++){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "vnum " + quadranteDe(n, cfg);
      b.dataset.n = n;
      b.textContent = pad(n);
      loteriaGrid.appendChild(b);
    }

    if (cfg.trevos){
      trevoBox.hidden = false;
      var tt = document.getElementById("trevoTitulo");
      if (tt) tt.textContent = tituloTrevo(loteriaAtual);
      trevoGrid.innerHTML = "";
      trevoGrid.classList.toggle("meses", loteriaAtual === "diadesorte");
      for (var t = 1; t <= cfg.trevos; t++){
        var bt = document.createElement("button");
        bt.type = "button";
        bt.className = "vnum trevo";
        bt.dataset.t = t;
        bt.textContent = loteriaAtual === "diadesorte" ? nomeTrevo(loteriaAtual, t).slice(0, 3) : t;
        trevoGrid.appendChild(bt);
      }
    } else {
      trevoBox.hidden = true;
    }

    if (loteriaBox) loteriaBox.hidden = true;     // a troca de jogo é pelo menu lateral
    var lt = document.getElementById("loteriaTitulo");
    if (lt) lt.textContent = "Volante da " + cfg.nome;
    loteriaTag.textContent = cfg.linhas + "×" + cfg.colunas;
    loteriaNota.textContent = cfg.nota;
    paintLoteria();
  }

  function paintLoteria(){
    var cfg = LOTERIAS[loteriaAtual];
    var sel = lotSelecao[loteriaAtual];
    var bt = loteriaGrid.children, i;
    for (i = 0; i < bt.length; i++){
      var n = parseInt(bt[i].dataset.n, 10);
      var on = sel.indexOf(n) >= 0;
      bt[i].classList.toggle("on", on);
      bt[i].classList.toggle("locked", sel.length >= cfg.escolher && !on);
    }
    if (cfg.trevos){
      var tv = trevoGrid.children;
      for (i = 0; i < tv.length; i++){
        var t = parseInt(tv[i].dataset.t, 10);
        var onT = lotTrevos.indexOf(t) >= 0;
        tv[i].classList.toggle("on", onT);
        tv[i].classList.toggle("locked", lotTrevos.length >= cfg.escolherTrevos && !onT);
      }
    }

    // contagem por quadrante: do volante inteiro e das dezenas que você marcou
    var nomes = {q1:"superior esquerdo", q2:"superior direito", q3:"inferior esquerdo",
                 q4:"inferior direito", eixo:"eixo central",
                 sup:"01 a 25", inf:"26 a 50"};
    var rotulos = {sup:"Metade de cima", inf:"Metade de baixo"};
    var totalQ = {}, selQ = {};
    for (var n2 = 1; n2 <= cfg.total; n2++){
      var q = quadranteDe(n2, cfg);
      totalQ[q] = (totalQ[q] || 0) + 1;
      if (sel.indexOf(n2) >= 0) selQ[q] = (selQ[q] || 0) + 1;
    }
    var ordem = ["q1","q2","q3","q4","sup","inf","eixo"], html = "";
    for (var k = 0; k < ordem.length; k++){
      var qq = ordem[k];
      if (!totalQ[qq]) continue;
      var rot = rotulos[qq] || (qq === "eixo" ? "Eixo" : qq.toUpperCase());
      html += '<div class="quad ' + qq + '"><span class="qn">' + rot +
              '</span><b>' + (selQ[qq] || 0) + '</b><small>de ' + totalQ[qq] + ' · ' + nomes[qq] + '</small></div>';
    }
    quadInfo.innerHTML =
      '<p class="resumoCob">Marcadas: <b>' + sel.length + " de " + cfg.escolher + '</b>' +
      (cfg.trevos
        ? ' · ' + tituloTrevo(loteriaAtual).toLowerCase() + ': <b>' +
          (lotTrevos.length ? listaTrevos(loteriaAtual, lotTrevos)
                             : lotTrevos.length + " de " + cfg.escolherTrevos) + '</b>'
        : '') +
      '</p><div class="quads">' + html + '</div>';
  }

  function toggleLoteria(n){
    var cfg = LOTERIAS[loteriaAtual], sel = lotSelecao[loteriaAtual];
    var i = sel.indexOf(n);
    if (i >= 0) sel.splice(i, 1);
    else {
      if (sel.length >= cfg.escolher){ toast("A aposta simples tem " + cfg.escolher + " dezenas"); return; }
      sel.push(n);
    }
    sel.sort(asc);
    paintLoteria();
  }

  function toggleTrevo(t){
    var cfg = LOTERIAS[loteriaAtual];
    var i = lotTrevos.indexOf(t);
    if (i >= 0){
      lotTrevos.splice(i, 1);
    } else if (cfg.escolherTrevos === 1){
      lotTrevos = [t];              // só 1 escolha (mês): clicar troca, não bloqueia
    } else if (lotTrevos.length >= cfg.escolherTrevos){
      toast("São " + cfg.escolherTrevos + " " + palavraTrevo(loteriaAtual, cfg.escolherTrevos));
      return;
    } else {
      lotTrevos.push(t);
    }
    lotTrevos.sort(asc);
    paintLoteria();
  }

  function surpresinhaLoteria(){
    var cfg = LOTERIAS[loteriaAtual], pool = [];
    for (var n = 1; n <= cfg.total; n++) pool.push(n);
    lotSelecao[loteriaAtual] = shuffled(pool).slice(0, cfg.escolher).sort(asc);
    if (cfg.trevos){
      var pt = [];
      for (var t = 1; t <= cfg.trevos; t++) pt.push(t);
      lotTrevos = shuffled(pt).slice(0, cfg.escolherTrevos).sort(asc);
    }
    paintLoteria();
  }

  /* ---------- histórico das 4 loterias além da Lotofácil: sorteio a sorteio ---------- */
  // Mesma lógica para Mega, +Milionária, Quina e Dia de Sorte: muda a
  // configuração do volante, a divisão (quadrantes/metades/linhas) e o
  // corte de "baixas/altas".
  var HISTORICOS = {
    lotofacil: {
      hist: ((window.LOTOFACIL_HISTORICO_JSON || {}).concursos || []),
      idx: 0, janela: 30, corte: 13,
      ids: {grid:"lfGrid", conc:"lfConc", data:"lfData", tag:"lfTag",
            prev:"lfPrev", next:"lfNext", stats:"lfStats",
            agg:"lfAgg", range:"lfRange", aggTag:"lfAggTag", aggNota:"lfAggNota"}
    },
    megasena: {
      hist: ((window.MEGASENA_HISTORICO_JSON || {}).concursos || []),
      idx: 0, janela: 30, corte: 30,
      ids: {grid:"megaGrid", conc:"megaConc", data:"megaData", tag:"megaTag",
            prev:"megaPrev", next:"megaNext", stats:"megaStats",
            agg:"megaAgg", range:"megaRange", aggTag:"megaAggTag", aggNota:"megaAggNota"}
    },
    maismilionaria: {
      hist: ((window.MAISMILIONARIA_HISTORICO_JSON || {}).concursos || []),
      idx: 0, janela: 30, corte: 25,
      ids: {grid:"mmGrid", conc:"mmConc", data:"mmData", tag:"mmTag",
            prev:"mmPrev", next:"mmNext", stats:"mmStats",
            agg:"mmAgg", range:"mmRange", aggTag:"mmAggTag", aggNota:"mmAggNota"}
    },
    quina: {
      hist: ((window.QUINA_HISTORICO_JSON || {}).concursos || []),
      idx: 0, janela: 30, corte: 40,
      ids: {grid:"quinaGrid", conc:"quinaConc", data:"quinaData", tag:"quinaTag",
            prev:"quinaPrev", next:"quinaNext", stats:"quinaStats",
            agg:"quinaAgg", range:"quinaRange", aggTag:"quinaAggTag", aggNota:"quinaAggNota"}
    },
    diadesorte: {
      hist: ((window.DIADESORTE_HISTORICO_JSON || {}).concursos || []),
      idx: 0, janela: 30, corte: 15,
      ids: {grid:"dsGrid", conc:"dsConc", data:"dsData", tag:"dsTag",
            prev:"dsPrev", next:"dsNext", stats:"dsStats",
            agg:"dsAgg", range:"dsRange", aggTag:"dsAggTag", aggNota:"dsAggNota"}
    }
  };

  var NOMES_PARTE = {
    q1:"sup. esquerdo", q2:"sup. direito", q3:"inf. esquerdo", q4:"inf. direito",
    sup:"metade de cima", inf:"metade de baixo", eixo:"eixo"
  };
  var ORDINAL = ["1ª","2ª","3ª","4ª","5ª","6ª","7ª","8ª","9ª","10ª"];

  // Faixa de dezenas de uma linha ("l3" no volante de 7 colunas -> "15 a 21"):
  // calculado a partir do formato de cada volante, não fixo como no de 25.
  function faixaLinha(cfg, i){
    var ini = (i - 1) * cfg.colunas + 1;
    var fim = Math.min(ini + cfg.colunas - 1, cfg.total);
    return pad(ini) + " a " + pad(fim);
  }
  function nomeParte(cfg, p){
    return p.charAt(0) === "l" ? faixaLinha(cfg, parseInt(p.slice(1), 10)) : NOMES_PARTE[p];
  }
  function rotuloParte(p){
    return p.charAt(0) === "l" ? (ORDINAL[+p.slice(1) - 1] || (p.slice(1) + "ª")) + " linha" : null;
  }

  function partesDe(cfg){
    if (cfg.divisao === "metades") return ["sup","inf"];
    if (cfg.divisao === "linhas"){
      var ls = [];
      for (var i = 1; i <= cfg.linhas; i++) ls.push("l" + i);
      return ls;
    }
    return ["q1","q2","q3","q4"];
  }

  function renderSorteio(jogo){
    var h = HISTORICOS[jogo], cfg = LOTERIAS[jogo];
    if (!h || !h.hist.length) return;
    var grid = document.getElementById(h.ids.grid);
    if (!grid) return;

    if (h.idx < 0) h.idx = 0;
    if (h.idx > h.hist.length - 1) h.idx = h.hist.length - 1;
    var reg = h.hist[h.idx];

    grid.style.setProperty("--cols", cfg.colunas);
    grid.innerHTML = cfg.divisao === "linhas" ? ''
      : cfg.divisao === "metades"
      ? '<span class="qmark m1">SUPERIOR</span><span class="qmark m3">INFERIOR</span>'
      : '<span class="qmark m1">Q1</span><span class="qmark m2">Q2</span>' +
        '<span class="qmark m3">Q3</span><span class="qmark m4">Q4</span>';
    for (var n = 1; n <= cfg.total; n++){
      var b = document.createElement("span");
      b.className = "vnum " + quadranteDe(n, cfg) + (reg.dezenas.indexOf(n) >= 0 ? " on" : "");
      b.textContent = pad(n);
      grid.appendChild(b);
    }

    var partes = partesDe(cfg), conta = {}, par = 0, baixo = 0, soma = 0, i;
    for (i = 0; i < reg.dezenas.length; i++){
      var d = reg.dezenas[i];
      var k = quadranteDe(d, cfg);
      conta[k] = (conta[k] || 0) + 1;
      if (d % 2 === 0) par++;
      if (d <= h.corte) baixo++;
      soma += d;
    }

    document.getElementById(h.ids.conc).textContent = "Concurso " + reg.concurso;
    document.getElementById(h.ids.data).textContent = reg.data +
      (reg.ganhadores ? " · " + reg.ganhadores + (reg.ganhadores > 1 ? " ganhadores" : " ganhador") : " · acumulou");
    document.getElementById(h.ids.tag).textContent = (h.idx + 1) + " de " + h.hist.length;
    document.getElementById(h.ids.prev).disabled = h.idx >= h.hist.length - 1;
    document.getElementById(h.ids.next).disabled = h.idx <= 0;

    var html = '<p class="resumoCob">Dezenas: <b>' + reg.dezenas.map(pad).join(" ") + '</b>' +
      (reg.trevos && reg.trevos.length
        ? ' · ' + tituloTrevo(jogo).toLowerCase() + ': <b>' + listaTrevos(jogo, reg.trevos) + '</b>' : '') +
      '</p><div class="quads">';
    for (i = 0; i < partes.length; i++){
      var p2 = partes[i];
      html += '<div class="quad ' + p2 + '"><span class="qn">' +
              (rotuloParte(p2) || (p2.charAt(0) === "q" ? p2.toUpperCase() : nomeParte(cfg, p2))) + '</span><b>' +
              (conta[p2] || 0) + '</b><small>de ' + cfg.escolher + ' · ' + nomeParte(cfg, p2) + '</small></div>';
    }
    html += '</div><div class="stats" style="margin-top:10px">' +
      '<span class="stat">Pares <b>' + par + '</b></span>' +
      '<span class="stat">Ímpares <b>' + (reg.dezenas.length - par) + '</b></span>' +
      '<span class="stat">1–' + h.corte + ' <b>' + baixo + '</b></span>' +
      '<span class="stat">' + (h.corte + 1) + '–' + cfg.total + ' <b>' + (reg.dezenas.length - baixo) + '</b></span>' +
      '<span class="stat">Soma <b>' + soma + '</b></span></div>';
    document.getElementById(h.ids.stats).innerHTML = html;
  }

  function renderAcumulado(jogo){
    var h = HISTORICOS[jogo], cfg = LOTERIAS[jogo];
    if (!h || !h.hist.length) return;
    var box = document.getElementById(h.ids.agg);
    if (!box) return;

    var range = document.getElementById(h.ids.range);
    if (range && !range.children.length){
      [10, 30, 60, h.hist.length].forEach(function(j){
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn sizebtn"; b.dataset.j = j;
        b.innerHTML = '<b>' + j + ' concursos</b>';
        range.appendChild(b);
      });
      range.addEventListener("click", function(ev){
        var el = ev.target.closest(".sizebtn");
        if (!el) return;
        h.janela = parseInt(el.dataset.j, 10);
        renderAcumulado(jogo);
      });
    }
    if (range) for (var b2 = 0; b2 < range.children.length; b2++)
      range.children[b2].classList.toggle("on", +range.children[b2].dataset.j === h.janela);

    var usados = h.hist.slice(0, h.janela), partes = partesDe(cfg);
    var conta = {}, par = 0, baixo = 0, soma = 0, freq = {}, trevo = {}, i, j;
    for (i = 0; i < partes.length; i++) conta[partes[i]] = 0;
    for (i = 0; i < usados.length; i++){
      for (j = 0; j < usados[i].dezenas.length; j++){
        var n = usados[i].dezenas[j];
        var k = quadranteDe(n, cfg);
        if (conta[k] !== undefined) conta[k]++;
        if (n % 2 === 0) par++;
        if (n <= h.corte) baixo++;
        soma += n;
        freq[n] = (freq[n] || 0) + 1;
      }
      var tv = usados[i].trevos || [];
      for (j = 0; j < tv.length; j++) trevo[tv[j]] = (trevo[tv[j]] || 0) + 1;
    }
    var totalDez = usados.length * cfg.escolher;
    var esperado = (100 / partes.length).toFixed(0);

    var html = '<div class="quads">';
    for (i = 0; i < partes.length; i++){
      var p3 = partes[i];
      html += '<div class="quad ' + p3 + '"><span class="qn">' +
              (rotuloParte(p3) || (p3.charAt(0) === "q" ? p3.toUpperCase() : nomeParte(cfg, p3))) + '</span><b>' +
              (100 * conta[p3] / totalDez).toFixed(1).replace(".", ",") + '%</b><small>' +
              conta[p3] + ' dezenas · ' + nomeParte(cfg, p3) + '</small></div>';
    }
    html += '</div><div class="stats" style="margin-top:12px">' +
      '<span class="stat">Pares <b>' + (par / usados.length).toFixed(1).replace(".", ",") + '</b> por sorteio</span>' +
      '<span class="stat">Ímpares <b>' + ((totalDez - par) / usados.length).toFixed(1).replace(".", ",") + '</b></span>' +
      '<span class="stat">1–' + h.corte + ' <b>' + (baixo / usados.length).toFixed(1).replace(".", ",") + '</b></span>' +
      '<span class="stat">' + (h.corte + 1) + '–' + cfg.total + ' <b>' +
        ((totalDez - baixo) / usados.length).toFixed(1).replace(".", ",") + '</b></span>' +
      '<span class="stat">Soma média <b>' + Math.round(soma / usados.length) + '</b></span></div>';

    var ordem = [];
    for (var n2 = 1; n2 <= cfg.total; n2++) ordem.push({n: n2, f: freq[n2] || 0});
    ordem.sort(function(a, b){ return b.f - a.f; });
    html += '<p class="subhead">Mais sorteadas</p><div class="chips">' +
      ordem.slice(0, 6).map(function(x){ return '<span class="chip cover">' + pad(x.n) + '<small>' + x.f + 'x</small></span>'; }).join("") +
      '</div><p class="subhead">Menos sorteadas</p><div class="chips">' +
      ordem.slice(-6).reverse().map(function(x){ return '<span class="chip cover zero">' + pad(x.n) + '<small>' + x.f + 'x</small></span>'; }).join("") +
      '</div>';

    if (cfg.trevos){
      var ct = [];
      for (var t = 1; t <= cfg.trevos; t++) ct.push({n: t, f: trevo[t] || 0});
      ct.sort(function(a, b){ return b.f - a.f; });
      html += '<p class="subhead">' + tituloTrevo(jogo) + '</p><div class="chips">' +
        ct.map(function(x){ return '<span class="chip cover">' + nomeTrevo(jogo, x.n) + '<small>' + x.f + 'x</small></span>'; }).join("") +
        '</div>';
    }

    box.innerHTML = html;
    document.getElementById(h.ids.aggTag).textContent = "últimos " + h.janela;
    document.getElementById(h.ids.aggNota).innerHTML =
      "Concursos " + usados[usados.length - 1].concurso + " a " + usados[0].concurso +
      ". Com as " + cfg.total + " dezenas divididas por igual, o esperado é <b>" + esperado +
      "%</b> em cada parte — as diferenças abaixo são variação de sorteio, não tendência.";
  }

  /* ---------- análise probabilística: Dia de Sorte ---------- */
  var dsAnaliseJanela = 30;
  var dsBacktestEstrategia = "equilibrada";
  var DS_BACKTEST_ESTRATEGIAS = {
    equilibrada: {rot:"Frequência + atraso", dica:"combina os dois rankings com o mesmo peso"},
    frequentes:  {rot:"Mais frequentes", dica:"prioriza quem mais apareceu na janela anterior"},
    atrasadas:   {rot:"Mais atrasadas", dica:"prioriza quem está há mais concursos sem sair"},
    menos:       {rot:"Evitar frequentes", dica:"prioriza quem menos apareceu na janela anterior"}
  };

  function dsFmt1(v){ return v.toFixed(1).replace(".", ","); }

  function dsAtrasoAtual(hist, campo, valor){
    for (var i = 0; i < hist.length; i++){
      var lista = hist[i][campo] || [];
      if (lista.indexOf(valor) >= 0) return i;
    }
    return hist.length;
  }

  function dsMaiorAtraso(hist, campo, valor){
    var anterior = null, maior = 0;
    for (var i = 0; i < hist.length; i++){
      var lista = hist[i][campo] || [];
      if (lista.indexOf(valor) < 0) continue;
      if (anterior !== null) maior = Math.max(maior, i - anterior - 1);
      anterior = i;
    }
    return Math.max(maior, dsAtrasoAtual(hist, campo, valor));
  }

  function dsEstatisticasNumeros(hist, usados){
    var esperado = usados.length * 7 / 31;
    var desvio = Math.sqrt(usados.length * (7 / 31) * (24 / 31));
    var out = [];
    for (var n = 1; n <= 31; n++){
      var freq = 0;
      for (var i = 0; i < usados.length; i++) if (usados[i].dezenas.indexOf(n) >= 0) freq++;
      var z = desvio ? (freq - esperado) / desvio : 0;
      out.push({n:n, freq:freq, esperado:esperado, z:z,
                atraso:dsAtrasoAtual(hist, "dezenas", n),
                maior:dsMaiorAtraso(hist, "dezenas", n)});
    }
    return out;
  }

  function dsPerfilDezenas(dezenas){
    var linhas = [0,0,0,0,0];
    for (var i = 0; i < dezenas.length; i++) linhas[Math.floor((dezenas[i] - 1) / 7)]++;
    return linhas.sort(function(a,b){ return b-a; }).join("-");
  }

  function dsRenderResumo(hist, usados, stats){
    var box = document.getElementById("dsAnalysisSummary");
    if (!box) return;
    var freq = stats.slice().sort(function(a,b){ return b.freq-a.freq || a.n-b.n; });
    var atraso = stats.slice().sort(function(a,b){ return b.atraso-a.atraso || a.n-b.n; });
    var perfis = {};
    for (var i = 0; i < usados.length; i++){
      var p = dsPerfilDezenas(usados[i].dezenas);
      perfis[p] = (perfis[p] || 0) + 1;
    }
    var perfil = Object.keys(perfis).sort(function(a,b){ return perfis[b]-perfis[a]; })[0];
    var trans = Math.max(0, usados.length - 1), umDois = 0;
    for (i = 0; i < trans; i++){
      var atual = usados[i].dezenas, ant = usados[i+1].dezenas, rep = 0;
      for (var j = 0; j < atual.length; j++) if (ant.indexOf(atual[j]) >= 0) rep++;
      if (rep === 1 || rep === 2) umDois++;
    }
    box.innerHTML =
      '<div class="insight-card"><span>Mais frequente</span><b>' + pad(freq[0].n) + '</b><small>' +
        freq[0].freq + ' vezes · esperado ' + dsFmt1(freq[0].esperado) + '</small></div>' +
      '<div class="insight-card"><span>Maior atraso atual</span><b>' + pad(atraso[0].n) + '</b><small>' +
        atraso[0].atraso + ' concursos sem aparecer</small></div>' +
      '<div class="insight-card"><span>Repetição de 1 ou 2</span><b>' +
        (trans ? dsFmt1(100 * umDois / trans) : '—') + (trans ? '%' : '') + '</b><small>entre concursos seguidos</small></div>' +
      '<div class="insight-card"><span>Perfil mais comum</span><b>' + (perfil || '—') + '</b><small>' +
        (perfil ? dsFmt1(100 * perfis[perfil] / usados.length) + '% dos sorteios' : 'sem amostra') + '</small></div>';
  }

  function dsRenderRepeticoes(usados){
    var box = document.getElementById("dsRepeatChart"), mediaEl = document.getElementById("dsRepeatMean");
    if (!box || !mediaEl) return;
    var qtd = {}, soma = 0, trans = Math.max(0, usados.length - 1), i, j;
    for (i = 0; i <= 7; i++) qtd[i] = 0;
    for (i = 0; i < trans; i++){
      var rep = 0;
      for (j = 0; j < 7; j++) if (usados[i+1].dezenas.indexOf(usados[i].dezenas[j]) >= 0) rep++;
      qtd[rep]++; soma += rep;
    }
    var probs = {}, max = 1;
    for (i = 0; i <= 7; i++){
      probs[i] = 100 * comb(7,i) * comb(24,7-i) / comb(31,7);
      if (trans) max = Math.max(max, 100 * qtd[i] / trans, probs[i]);
    }
    var html = '<div class="repeat-row repeat-head"><b>Rep.</b><span></span><span>Real</span><small>Teoria</small></div>';
    for (i = 0; i <= 7; i++){
      var real = trans ? 100 * qtd[i] / trans : 0;
      html += '<div class="repeat-row"><b>' + i + '</b><span class="repeat-track"><i style="width:' +
        (100 * real / max).toFixed(1) + '%"></i></span><span>' + dsFmt1(real) + '%</span><small>' +
        dsFmt1(probs[i]) + '%</small></div>';
    }
    box.innerHTML = html;
    mediaEl.textContent = (trans ? dsFmt1(soma / trans) : '—') + ' média';
  }

  function dsRenderPares(usados){
    var box = document.getElementById("dsPairGrid");
    if (!box) return;
    var pares = {};
    for (var c = 0; c < usados.length; c++){
      for (var i = 0; i < 7; i++) for (var j = i + 1; j < 7; j++){
        var chave = pad(usados[c].dezenas[i]) + "–" + pad(usados[c].dezenas[j]);
        pares[chave] = (pares[chave] || 0) + 1;
      }
    }
    var lista = Object.keys(pares).map(function(k){ return {k:k,q:pares[k]}; });
    lista.sort(function(a,b){ return b.q-a.q || (a.k < b.k ? -1 : 1); });
    var esperado = usados.length * 21 / 465;
    box.innerHTML = lista.slice(0,8).map(function(x){
      return '<div class="pair-chip"><b>' + x.k + '</b><small>' + x.q + '× · esperado ' +
        dsFmt1(esperado) + '</small></div>';
    }).join("");
  }

  function dsRenderRanking(hist, usados, stats){
    var box = document.getElementById("dsRanking"), note = document.getElementById("dsRankingNote");
    if (!box || !note) return;
    var ordem = stats.slice().sort(function(a,b){ return b.freq-a.freq || b.atraso-a.atraso || a.n-b.n; });
    note.innerHTML = 'Esperado por dezena nesta janela: <b>' + dsFmt1(usados.length * 7 / 31) +
      ' aparições</b>. A cor só marca desvios maiores que um desvio-padrão da amostra.';
    var rows = ordem.map(function(x, i){
      var cls = x.z >= 1 ? "hot" : x.z <= -1 ? "cold" : "";
      var atrasoCls = x.atraso >= 7 ? " late" : "";
      var sinal = x.freq - x.esperado;
      return '<tr><td>' + (i + 1) + '</td><td><span class="rank-number ' + cls + '">' + pad(x.n) + '</span></td>' +
        '<td><b>' + x.freq + '</b></td><td>' + dsFmt1(x.esperado) + '</td><td>' +
        (sinal >= 0 ? '+' : '') + dsFmt1(sinal) + '</td><td><span class="delay-pill' + atrasoCls + '">' +
        x.atraso + '</span></td><td>' + x.maior + '</td></tr>';
    }).join("");
    box.innerHTML = '<table class="analysis-table"><thead><tr><th>#</th><th>Dezena</th><th>Vezes</th>' +
      '<th>Esperado</th><th>Diferença</th><th>Atraso</th><th>Maior atraso</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function dsRenderMeses(hist, usados){
    var box = document.getElementById("dsMonthAnalysis");
    if (!box) return;
    var lista = [];
    for (var m = 1; m <= 12; m++){
      var freq = 0;
      for (var i = 0; i < usados.length; i++) if ((usados[i].trevos || []).indexOf(m) >= 0) freq++;
      lista.push({m:m,freq:freq,atraso:dsAtrasoAtual(hist,"trevos",m)});
    }
    lista.sort(function(a,b){ return b.atraso-a.atraso || b.freq-a.freq; });
    box.innerHTML = lista.map(function(x){
      return '<div class="month-card' + (x.atraso >= 12 ? ' late' : '') + '"><b>' + nomeTrevo("diadesorte",x.m) +
        '</b><span>' + x.freq + '×</span><small>atraso atual: ' + x.atraso + '</small></div>';
    }).join("");
  }

  function dsTie(valor, concurso){
    var x = ((valor * 2654435761) ^ (concurso * 1597334677)) >>> 0;
    return x / 4294967296;
  }

  function dsEscolhaHistorica(treino, campo, total, qtd, estrategia, concurso){
    var itens = [], valor, i, j;
    for (valor = 1; valor <= total; valor++){
      var freq = 0, atraso = treino.length;
      for (i = 0; i < treino.length; i++){
        var arr = treino[i][campo] || [];
        if (arr.indexOf(valor) >= 0){ freq++; if (atraso === treino.length) atraso = i; }
      }
      itens.push({n:valor,freq:freq,atraso:atraso,tie:dsTie(valor,concurso)});
    }
    var porFreq = itens.slice().sort(function(a,b){ return b.freq-a.freq || b.tie-a.tie; });
    var porAtraso = itens.slice().sort(function(a,b){ return b.atraso-a.atraso || b.tie-a.tie; });
    for (i = 0; i < porFreq.length; i++) porFreq[i].rf = total-i;
    for (i = 0; i < porAtraso.length; i++) porAtraso[i].ra = total-i;
    for (i = 0; i < itens.length; i++){
      if (estrategia === "frequentes") itens[i].score = itens[i].freq;
      else if (estrategia === "atrasadas") itens[i].score = itens[i].atraso;
      else if (estrategia === "menos") itens[i].score = -itens[i].freq;
      else itens[i].score = itens[i].rf + itens[i].ra;
    }
    itens.sort(function(a,b){ return b.score-a.score || b.tie-a.tie; });
    var out = [];
    for (j = 0; j < qtd; j++) out.push(itens[j].n);
    return out.sort(asc);
  }

  function dsCalculaBacktest(hist, estrategia){
    var amostras = 0, somaHits = 0, quatro = 0, mes = 0, premiados = 0, retorno = 0;
    for (var i = 0; i < hist.length; i++){
      var treino = hist.slice(i + 1, i + 1 + dsAnaliseJanela);
      if (treino.length < 10) continue;
      var alvo = hist[i];
      var nums = dsEscolhaHistorica(treino,"dezenas",31,7,estrategia,alvo.concurso);
      var meses = dsEscolhaHistorica(treino,"trevos",12,1,estrategia,alvo.concurso);
      var hits = 0;
      for (var j = 0; j < nums.length; j++) if (alvo.dezenas.indexOf(nums[j]) >= 0) hits++;
      var acertouMes = (alvo.trevos || []).indexOf(meses[0]) >= 0;
      var ganhou = hits >= 4 || acertouMes;
      var valor = 0;
      if (hits >= 4 && alvo.premios) valor += alvo.premios[String(hits)] || 0;
      if (acertouMes) valor += (alvo.premios && alvo.premios.mes) || PRECOS.diadesorte;
      amostras++; somaHits += hits; if (hits >= 4) quatro++; if (acertouMes) mes++;
      if (ganhou) premiados++; retorno += valor;
    }
    return {amostras:amostras,somaHits:somaHits,quatro:quatro,mes:mes,premiados:premiados,retorno:retorno,
            media:amostras ? somaHits/amostras : 0};
  }

  function dsRenderBacktest(hist){
    var box = document.getElementById("dsBacktestResult");
    if (!box) return;
    var r = dsCalculaBacktest(hist,dsBacktestEstrategia);
    var amostras=r.amostras, quatro=r.quatro, mes=r.mes, premiados=r.premiados, retorno=r.retorno, media=r.media;
    var investido = amostras * PRECOS.diadesorte;
    var esperado = 49/31;
    box.innerHTML = '<div class="backtest-grid">' +
      '<div class="backtest-stat"><span>Concursos testados</span><b>' + amostras + '</b></div>' +
      '<div class="backtest-stat"><span>Média de acertos</span><b>' + dsFmt1(media) + '</b></div>' +
      '<div class="backtest-stat"><span>4+ dezenas</span><b>' + quatro + '</b></div>' +
      '<div class="backtest-stat"><span>Meses certos</span><b>' + mes + '</b></div>' +
      '<div class="backtest-stat"><span>Algum prêmio</span><b>' + premiados + '</b></div>' +
      '</div><p class="hint">Média matemática de qualquer jogo: <b>' + dsFmt1(esperado) +
      ' acertos</b>. Esta estratégia ficou em <b>' + (media >= esperado ? '+' : '') + dsFmt1(media-esperado) +
      '</b>. Teria investido <b>' + brl(investido) + '</b> e recebido <b>' + brl(retorno) +
      '</b> usando os rateios registrados. Diferenças pequenas podem ser apenas variação aleatória.</p>';
  }

  function dsRepMaisObservada(hist){
    var usados=hist.slice(0,Math.min(dsAnaliseJanela,hist.length)),freq={0:0,1:0,2:0,3:0};
    for(var i=0;i<usados.length-1;i++){
      var rep=0;
      for(var j=0;j<7;j++) if(usados[i+1].dezenas.indexOf(usados[i].dezenas[j])>=0)rep++;
      if(rep<=3)freq[rep]++;
    }
    return [0,1,2,3].sort(function(a,b){
      return freq[b]-freq[a] || Math.abs(a-49/31)-Math.abs(b-49/31);
    })[0];
  }

  function paintGeradorControls(jogo){
    var g=GERADORES[jogo],crits=document.getElementById(g.ids.crits),rep=document.getElementById(g.ids.evitar);
    if(crits)for(var i=0;i<crits.children.length;i++)
      crits.children[i].classList.toggle("on",crits.children[i].dataset.crit===g.criterio);
    if(rep)for(var j=0;j<rep.children.length;j++)
      rep.children[j].classList.toggle("on",rep.children[j].dataset.rep===(g.repetirAlvo===null?"":String(g.repetirAlvo)));
  }

  function paintDsGeradorControls(){paintGeradorControls("diadesorte");}

  function dsGerarRecomendacao(){
    var hist=HISTORICOS.diadesorte.hist;
    if(hist.length<11){toast("Histórico insuficiente para recomendar");return;}
    var candidatas=Object.keys(DS_BACKTEST_ESTRATEGIAS).map(function(k){
      var r=dsCalculaBacktest(hist,k);
      // Retorno financeiro não entra na decisão: um único rateio alto distorceria
      // a comparação. Média de acertos vem primeiro; 4+ e prêmio desempatarão.
      r.estrategia=k;
      r.pontuacao=r.media+(r.amostras?r.quatro/r.amostras*.35+r.premiados/r.amostras*.08:0);
      return r;
    });
    candidatas.sort(function(a,b){return b.pontuacao-a.pontuacao||b.quatro-a.quatro||b.premiados-a.premiados;});
    var melhor=candidatas[0], mapa={equilibrada:"misto",frequentes:"quentes",atrasadas:"frias",menos:"menos"};
    var g=GERADORES.diadesorte, repeticao=dsRepMaisObservada(hist);
    g.criterio=mapa[melhor.estrategia]; g.repetirAlvo=repeticao; g.janelaAnalise=dsAnaliseJanela;
    megaGerarJogos("diadesorte");
    paintDsGeradorControls();
    atualizarNotaGerador("diadesorte");
    var nome=DS_BACKTEST_ESTRATEGIAS[melhor.estrategia].rot;
    var out=document.getElementById("dsRecommendationResult");
    if(out){
      out.hidden=false;
      out.innerHTML='Escolha atual: <b>'+nome+'</b> com <b>'+repeticao+' repetida'+(repeticao===1?'':'s')+
        '</b>. No backtest, a média foi <b>'+dsFmt1(melhor.media)+'</b> acertos em '+melhor.amostras+' concursos.';
    }
    irPara("ds-gerar");
    toast("Recomendação: "+nome+" · "+repeticao+" repetida"+(repeticao===1?"":"s"));
  }

  function renderDsAnalise(){
    var hist = HISTORICOS.diadesorte.hist;
    if (!hist.length) return;
    var usados = hist.slice(0, Math.min(dsAnaliseJanela,hist.length));
    var stats = dsEstatisticasNumeros(hist,usados);
    var stamp = document.getElementById("dsAnalysisStamp");
    if (stamp) stamp.textContent = 'até o concurso ' + hist[0].concurso;
    dsRenderResumo(hist,usados,stats);
    dsRenderRepeticoes(usados);
    dsRenderPares(usados);
    dsRenderRanking(hist,usados,stats);
    dsRenderMeses(hist,usados);
    dsRenderBacktest(hist);
  }

  function buildDsAnalise(){
    var hist = HISTORICOS.diadesorte.hist;
    var range = document.getElementById("dsAnalysisRange");
    if (range && !range.children.length){
      [10,30,50,100,hist.length].forEach(function(n){
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn sizebtn"; b.dataset.j = n;
        b.innerHTML = '<b>' + (n === hist.length ? 'Todos' : n) + '</b><small>' + n + ' concursos</small>';
        range.appendChild(b);
      });
      range.addEventListener("click",function(ev){
        var el = ev.target.closest(".sizebtn"); if (!el) return;
        dsAnaliseJanela = +el.dataset.j; buildDsAnalise();
      });
    }
    if (range) for (var i = 0; i < range.children.length; i++)
      range.children[i].classList.toggle("on",+range.children[i].dataset.j === dsAnaliseJanela);

    var strategies = document.getElementById("dsBacktestStrategies");
    if (strategies && !strategies.children.length){
      Object.keys(DS_BACKTEST_ESTRATEGIAS).forEach(function(k){
        var s = DS_BACKTEST_ESTRATEGIAS[k], b = document.createElement("button");
        b.type="button"; b.className="btn critbtn"; b.dataset.strategy=k;
        b.innerHTML='<b>'+s.rot+'</b><small>'+s.dica+'</small>'; strategies.appendChild(b);
      });
      strategies.addEventListener("click",function(ev){
        var el=ev.target.closest(".critbtn"); if(!el)return;
        dsBacktestEstrategia=el.dataset.strategy; buildDsAnalise();
      });
    }
    if (strategies) for (var j=0;j<strategies.children.length;j++)
      strategies.children[j].classList.toggle("on",strategies.children[j].dataset.strategy===dsBacktestEstrategia);
    renderDsAnalise();
  }

  var ANALISES_GERAIS = {
    lotofacil:{prefix:"lfA",card:"lfAnalysisCard",janela:30,estrategia:"equilibrada",pagina:"lf-gerador"},
    megasena:{prefix:"megaA",card:"megaAnalysisCard",janela:30,estrategia:"equilibrada",pagina:"mega-gerar"},
    maismilionaria:{prefix:"mmA",card:"mmAnalysisCard",janela:30,estrategia:"equilibrada",pagina:"mm-gerar"},
    quina:{prefix:"quinaA",card:"quinaAnalysisCard",janela:100,estrategia:"equilibrada",pagina:"quina-gerar"}
  };

  function analiseId(a,nome){return a.prefix+nome;}

  function montarCardAnalise(jogo,a){
    var card=document.getElementById(a.card),cfg=LOTERIAS[jogo];
    if(!card||card.dataset.montado)return;
    card.dataset.montado="1";
    var extra=cfg.trevos?'<section class="analysis-panel"><div class="panel-head"><div><span class="eyebrow">'+
      cfg.trevos+' opções</span><h3>'+tituloTrevo(jogo)+'</h3></div></div><div class="month-analysis" id="'+
      analiseId(a,"Extra")+'"></div></section>':'';
    card.innerHTML='<div class="analysis-hero"><div><span class="eyebrow">Leitura estatística</span><h2>Raio-X da '+
      cfg.nome+'</h2><p>Frequência, atraso, repetição e backtest reunidos em uma leitura única. Os dados ajudam a '+
      'organizar a estratégia, sem prometer o próximo resultado.</p></div><span class="analysis-stamp" id="'+
      analiseId(a,"Stamp")+'">—</span></div><h3 class="subhead">Janela de análise</h3><div class="sizes analysis-range" id="'+
      analiseId(a,"Range")+'"></div><div class="insight-grid" id="'+analiseId(a,"Summary")+'"></div>'+
      '<div class="analysis-columns"><section class="analysis-panel"><div class="panel-head"><div><span class="eyebrow">'+
      'Concurso a concurso</span><h3>Repetição de dezenas</h3></div><span class="panel-metric" id="'+analiseId(a,"RepeatMean")+
      '">—</span></div><div id="'+analiseId(a,"Repeat")+'"></div></section><section class="analysis-panel"><div class="panel-head">'+
      '<div><span class="eyebrow">Combinações</span><h3>Pares mais recorrentes</h3></div></div><div class="pair-grid" id="'+
      analiseId(a,"Pairs")+'"></div></section></div><section class="analysis-panel analysis-ranking"><div class="panel-head">'+
      '<div><span class="eyebrow">'+cfg.total+' dezenas</span><h3>Frequência e atraso</h3></div><span class="legend-inline">'+
      '<i class="signal hot"></i>acima do esperado <i class="signal cold"></i>abaixo</span></div><p class="hint" id="'+
      analiseId(a,"RankNote")+'"></p><div class="tablewrap" id="'+analiseId(a,"Rank")+'"></div></section>'+extra+
      '<section class="analysis-panel backtest-panel"><div class="panel-head"><div><span class="eyebrow">Teste sem olhar o futuro</span>'+
      '<h3>Backtest de estratégia</h3></div></div><p class="hint" style="margin-top:0">Cada concurso é testado usando somente '+
      'os resultados que existiam antes dele.</p><div class="crits" id="'+analiseId(a,"Strategies")+'"></div><div id="'+
      analiseId(a,"Backtest")+'"></div></section><section class="recommendation-box"><div><span class="eyebrow">Sugestão automática</span>'+
      '<h3>Gerar com a recomendação da análise</h3><p>Compara as estratégias da janela, escolhe a melhor no backtest e combina '+
      'com a repetição mais observada.</p></div><button class="btn primary recommendation-btn" type="button" id="'+
      analiseId(a,"Recommend")+'">Gerar jogos recomendados</button><div class="recommendation-result" id="'+
      analiseId(a,"RecommendResult")+'" hidden></div></section><p class="analysis-disclaimer">Frequência e atraso descrevem o '+
      'passado. Nenhuma classificação torna uma dezena mais ou menos provável no próximo sorteio.</p>';
  }

  function estatisticasGerais(hist,usados,cfg){
    var esperado=usados.length*cfg.escolher/cfg.total;
    var sd=Math.sqrt(usados.length*(cfg.escolher/cfg.total)*(1-cfg.escolher/cfg.total)),out=[];
    for(var n=1;n<=cfg.total;n++){
      var f=0;for(var i=0;i<usados.length;i++)if(usados[i].dezenas.indexOf(n)>=0)f++;
      out.push({n:n,freq:f,esperado:esperado,z:sd?(f-esperado)/sd:0,
        atraso:dsAtrasoAtual(hist,"dezenas",n),maior:dsMaiorAtraso(hist,"dezenas",n)});
    }
    return out;
  }

  function perfilGeral(jogo,dezenas){
    var g=GERADORES[jogo],cfg=LOTERIAS[jogo],c={};
    for(var i=0;i<g.partes.length;i++)c[g.partes[i]]=0;
    for(i=0;i<dezenas.length;i++){var p=quadranteDe(dezenas[i],cfg);if(c[p]!==undefined)c[p]++;}
    return g.partes.map(function(p){return c[p];}).sort(function(x,y){return y-x;}).join("-");
  }

  function renderResumoGeral(jogo,a,hist,usados,stats){
    var freq=stats.slice().sort(function(x,y){return y.freq-x.freq||x.n-y.n;});
    var atraso=stats.slice().sort(function(x,y){return y.atraso-x.atraso||x.n-y.n;});
    var reps={},perfis={};
    for(var i=0;i<usados.length;i++){var p=perfilGeral(jogo,usados[i].dezenas);perfis[p]=(perfis[p]||0)+1;}
    for(i=0;i<usados.length-1;i++){
      var r=0;for(var j=0;j<usados[i].dezenas.length;j++)if(usados[i+1].dezenas.indexOf(usados[i].dezenas[j])>=0)r++;
      reps[r]=(reps[r]||0)+1;
    }
    var rep=Object.keys(reps).sort(function(x,y){return reps[y]-reps[x];})[0];
    var perfil=Object.keys(perfis).sort(function(x,y){return perfis[y]-perfis[x];})[0];
    document.getElementById(analiseId(a,"Summary")).innerHTML=
      '<div class="insight-card"><span>Mais frequente</span><b>'+pad(freq[0].n)+'</b><small>'+freq[0].freq+
      ' vezes · esperado '+dsFmt1(freq[0].esperado)+'</small></div><div class="insight-card"><span>Maior atraso atual</span><b>'+
      pad(atraso[0].n)+'</b><small>'+atraso[0].atraso+' concursos sem aparecer</small></div><div class="insight-card"><span>Repetição mais comum</span><b>'+
      (rep===undefined?'—':rep)+'</b><small>'+(rep===undefined?'sem transições':dsFmt1(100*reps[rep]/(usados.length-1))+'% das transições')+
      '</small></div><div class="insight-card"><span>Perfil mais comum</span><b>'+(perfil||'—')+'</b><small>'+
      (perfil?dsFmt1(100*perfis[perfil]/usados.length)+'% dos sorteios':'sem amostra')+'</small></div>';
  }

  function renderRepeticaoGeral(jogo,a,usados){
    var cfg=LOTERIAS[jogo],k=cfg.escolher,trans=usados.length-1,q={},soma=0,max=1,probs={},i,j;
    for(i=0;i<=k;i++)q[i]=0;
    for(i=0;i<trans;i++){var r=0;for(j=0;j<k;j++)if(usados[i+1].dezenas.indexOf(usados[i].dezenas[j])>=0)r++;q[r]++;soma+=r;}
    for(i=0;i<=k;i++){probs[i]=100*comb(k,i)*comb(cfg.total-k,k-i)/comb(cfg.total,k);max=Math.max(max,trans?100*q[i]/trans:0,probs[i]);}
    var html='<div class="repeat-row repeat-head"><b>Rep.</b><span></span><span>Real</span><small>Teoria</small></div>';
    for(i=0;i<=k;i++){var real=trans?100*q[i]/trans:0;html+='<div class="repeat-row"><b>'+i+'</b><span class="repeat-track"><i style="width:'+
      (100*real/max).toFixed(1)+'%"></i></span><span>'+dsFmt1(real)+'%</span><small>'+dsFmt1(probs[i])+'%</small></div>';}
    document.getElementById(analiseId(a,"Repeat")).innerHTML=html;
    document.getElementById(analiseId(a,"RepeatMean")).textContent=(trans?dsFmt1(soma/trans):'—')+' média';
  }

  function renderParesGerais(jogo,a,usados){
    var cfg=LOTERIAS[jogo],pares={};
    for(var c=0;c<usados.length;c++)for(var i=0;i<cfg.escolher;i++)for(var j=i+1;j<cfg.escolher;j++){
      var key=pad(usados[c].dezenas[i])+'–'+pad(usados[c].dezenas[j]);pares[key]=(pares[key]||0)+1;
    }
    var lista=Object.keys(pares).map(function(k){return{k:k,q:pares[k]};}).sort(function(x,y){return y.q-x.q||(x.k<y.k?-1:1);});
    var esperado=usados.length*comb(cfg.escolher,2)/comb(cfg.total,2);
    document.getElementById(analiseId(a,"Pairs")).innerHTML=lista.slice(0,8).map(function(x){return '<div class="pair-chip"><b>'+x.k+
      '</b><small>'+x.q+'× · esperado '+dsFmt1(esperado)+'</small></div>';}).join('');
  }

  function renderRankingGeral(jogo,a,usados,stats){
    var cfg=LOTERIAS[jogo],ordem=stats.slice().sort(function(x,y){return y.freq-x.freq||y.atraso-x.atraso||x.n-y.n;});
    document.getElementById(analiseId(a,"RankNote")).innerHTML='Esperado por dezena: <b>'+dsFmt1(usados.length*cfg.escolher/cfg.total)+
      ' aparições</b>. A cor marca desvios maiores que um desvio-padrão.';
    var rows=ordem.map(function(x,i){var cls=x.z>=1?'hot':x.z<=-1?'cold':'',dif=x.freq-x.esperado;
      return '<tr><td>'+(i+1)+'</td><td><span class="rank-number '+cls+'">'+pad(x.n)+'</span></td><td><b>'+x.freq+'</b></td><td>'+dsFmt1(x.esperado)+
      '</td><td>'+(dif>=0?'+':'')+dsFmt1(dif)+'</td><td><span class="delay-pill'+(x.atraso>=7?' late':'')+'">'+x.atraso+'</span></td><td>'+x.maior+'</td></tr>';}).join('');
    document.getElementById(analiseId(a,"Rank")).innerHTML='<table class="analysis-table"><thead><tr><th>#</th><th>Dezena</th><th>Vezes</th>'+
      '<th>Esperado</th><th>Diferença</th><th>Atraso</th><th>Maior atraso</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }

  function renderExtraGeral(jogo,a,hist,usados){
    var cfg=LOTERIAS[jogo],box=document.getElementById(analiseId(a,"Extra"));if(!box)return;
    var lista=[];for(var n=1;n<=cfg.trevos;n++){var f=0;for(var i=0;i<usados.length;i++)if((usados[i].trevos||[]).indexOf(n)>=0)f++;
      lista.push({n:n,f:f,a:dsAtrasoAtual(hist,"trevos",n)});}
    lista.sort(function(x,y){return y.a-x.a||y.f-x.f;});
    box.innerHTML=lista.map(function(x){return '<div class="month-card'+(x.a>=8?' late':'')+'"><b>'+nomeTrevo(jogo,x.n)+'</b><span>'+x.f+
      '×</span><small>atraso atual: '+x.a+'</small></div>';}).join('');
  }

  function calculaBacktestGeral(jogo,a,estrategia){
    var cfg=LOTERIAS[jogo],hist=HISTORICOS[jogo].hist,r={amostras:0,soma:0,faixas:0,extras:0,premiados:0,retorno:0};
    for(var i=0;i<hist.length;i++){
      var treino=hist.slice(i+1,i+1+a.janela);if(treino.length<10)continue;
      var alvo=hist[i],nums=dsEscolhaHistorica(treino,"dezenas",cfg.total,cfg.escolher,estrategia,alvo.concurso),tv=0;
      var extras=cfg.trevos?dsEscolhaHistorica(treino,"trevos",cfg.trevos,cfg.escolherTrevos,estrategia,alvo.concurso):[];
      var hits=0;for(var j=0;j<nums.length;j++)if(alvo.dezenas.indexOf(nums[j])>=0)hits++;
      for(j=0;j<extras.length;j++)if((alvo.trevos||[]).indexOf(extras[j])>=0)tv++;
      var mapaPremios=premiosDesdobrados(jogo,cfg.escolher,hits,tv),ganhou=false,valor=0;
      for(var fx in mapaPremios){ganhou=true;if(alvo.premios&&alvo.premios[fx])valor+=mapaPremios[fx]*alvo.premios[fx];}
      r.amostras++;r.soma+=hits;if(FAIXAS_TESTE[jogo](hits,tv))r.faixas++;if(tv)r.extras++;if(ganhou)r.premiados++;r.retorno+=valor;
    }
    r.media=r.amostras?r.soma/r.amostras:0;return r;
  }

  function renderBacktestGeral(jogo,a){
    var cfg=LOTERIAS[jogo],r=calculaBacktestGeral(jogo,a,a.estrategia),investido=r.amostras*PRECOS[jogo],esperado=cfg.escolher*cfg.escolher/cfg.total;
    document.getElementById(analiseId(a,"Backtest")).innerHTML='<div class="backtest-grid"><div class="backtest-stat"><span>Concursos</span><b>'+r.amostras+
      '</b></div><div class="backtest-stat"><span>Média de acertos</span><b>'+dsFmt1(r.media)+'</b></div><div class="backtest-stat"><span>Faixa numérica</span><b>'+r.faixas+
      '</b></div>'+(cfg.trevos?'<div class="backtest-stat"><span>Com trevo certo</span><b>'+r.extras+'</b></div>':'')+
      '<div class="backtest-stat"><span>Algum prêmio</span><b>'+r.premiados+'</b></div></div><p class="hint">Média matemática: <b>'+dsFmt1(esperado)+
      ' acertos</b>. Esta estratégia ficou em <b>'+(r.media>=esperado?'+':'')+dsFmt1(r.media-esperado)+'</b>. Teria investido <b>'+brl(investido)+
      '</b> e recebido <b>'+brl(r.retorno)+'</b>. Diferenças pequenas podem ser variação aleatória.</p>';
  }

  function repeticaoRecomendadaGeral(jogo,a){
    var g=GERADORES[jogo],hist=HISTORICOS[jogo].hist,usados=hist.slice(0,Math.min(a.janela,hist.length)),freq={};
    g.repetirOpcoes.forEach(function(n){freq[n]=0;});
    for(var i=0;i<usados.length-1;i++){var rep=0;for(var j=0;j<LOTERIAS[jogo].escolher;j++)if(usados[i+1].dezenas.indexOf(usados[i].dezenas[j])>=0)rep++;
      if(freq[rep]!==undefined)freq[rep]++;}
    var min=Math.max(0,g.dezenas+LOTERIAS[jogo].escolher-LOTERIAS[jogo].total),max=Math.min(g.dezenas,LOTERIAS[jogo].escolher);
    return g.repetirOpcoes.filter(function(n){return n>=min&&n<=max;}).sort(function(x,y){return freq[y]-freq[x]||Math.abs(x-LOTERIAS[jogo].escolher*LOTERIAS[jogo].escolher/LOTERIAS[jogo].total)-Math.abs(y-LOTERIAS[jogo].escolher*LOTERIAS[jogo].escolher/LOTERIAS[jogo].total);})[0];
  }

  function gerarRecomendacaoGeral(jogo){
    var a=ANALISES_GERAIS[jogo],hist=HISTORICOS[jogo].hist,candidatas=Object.keys(DS_BACKTEST_ESTRATEGIAS).map(function(k){var r=calculaBacktestGeral(jogo,a,k);
      r.estrategia=k;r.pontuacao=r.media+(r.amostras?r.faixas/r.amostras*.35+r.premiados/r.amostras*.08:0);return r;});
    candidatas.sort(function(x,y){return y.pontuacao-x.pontuacao||y.faixas-x.faixas||y.premiados-x.premiados;});
    var melhor=candidatas[0],mapa={equilibrada:"misto",frequentes:"quentes",atrasadas:"frias",menos:"menos"},g=GERADORES[jogo];
    if(jogo==="lotofacil")g.modalidade="normal";
    g.criterio=mapa[melhor.estrategia];g.repetirAlvo=repeticaoRecomendadaGeral(jogo,a);g.janelaAnalise=a.janela;
    megaGerarJogos(jogo);paintGeradorControls(jogo);atualizarNotaGerador(jogo);
    var nome=DS_BACKTEST_ESTRATEGIAS[melhor.estrategia].rot,out=document.getElementById(analiseId(a,"RecommendResult"));
    if(out){out.hidden=false;out.innerHTML='Escolha: <b>'+nome+'</b> com <b>'+g.repetirAlvo+' repetidas</b>. Média do backtest: <b>'+dsFmt1(melhor.media)+'</b>.';}
    irPara(a.pagina);toast('Recomendação: '+nome+' · '+g.repetirAlvo+' repetidas');
  }

  function renderAnaliseGeral(jogo){
    var a=ANALISES_GERAIS[jogo],hist=HISTORICOS[jogo].hist,cfg=LOTERIAS[jogo],usados=hist.slice(0,Math.min(a.janela,hist.length));
    var stats=estatisticasGerais(hist,usados,cfg);document.getElementById(analiseId(a,"Stamp")).textContent='até o concurso '+hist[0].concurso;
    renderResumoGeral(jogo,a,hist,usados,stats);renderRepeticaoGeral(jogo,a,usados);renderParesGerais(jogo,a,usados);
    renderRankingGeral(jogo,a,usados,stats);renderExtraGeral(jogo,a,hist,usados);renderBacktestGeral(jogo,a);
  }

  function buildAnaliseGeral(jogo){
    var a=ANALISES_GERAIS[jogo],hist=HISTORICOS[jogo].hist;montarCardAnalise(jogo,a);
    var range=document.getElementById(analiseId(a,"Range"));if(!range.dataset.lig){range.dataset.lig="1";
      [10,30,50,100,hist.length].forEach(function(n){var b=document.createElement("button");b.type="button";b.className="btn sizebtn";b.dataset.j=n;
        b.innerHTML='<b>'+(n===hist.length?'Todos':n)+'</b><small>'+n+' concursos</small>';range.appendChild(b);});
      range.addEventListener("click",function(ev){var el=ev.target.closest(".sizebtn");if(!el)return;a.janela=+el.dataset.j;buildAnaliseGeral(jogo);});}
    for(var i=0;i<range.children.length;i++)range.children[i].classList.toggle("on",+range.children[i].dataset.j===a.janela);
    var strategies=document.getElementById(analiseId(a,"Strategies"));if(!strategies.dataset.lig){strategies.dataset.lig="1";
      Object.keys(DS_BACKTEST_ESTRATEGIAS).forEach(function(k){var s=DS_BACKTEST_ESTRATEGIAS[k],b=document.createElement("button");b.type="button";b.className="btn critbtn";
        b.dataset.strategy=k;b.innerHTML='<b>'+s.rot+'</b><small>'+s.dica+'</small>';strategies.appendChild(b);});
      strategies.addEventListener("click",function(ev){var el=ev.target.closest(".critbtn");if(!el)return;a.estrategia=el.dataset.strategy;buildAnaliseGeral(jogo);});
      document.getElementById(analiseId(a,"Recommend")).addEventListener("click",function(){gerarRecomendacaoGeral(jogo);});}
    for(var j=0;j<strategies.children.length;j++)strategies.children[j].classList.toggle("on",strategies.children[j].dataset.strategy===a.estrategia);
    renderAnaliseGeral(jogo);
  }

  function navegarSorteio(jogo, passo){
    var h = HISTORICOS[jogo];
    if (!h) return;
    h.idx += passo;
    renderSorteio(jogo);
  }

  /* ---------- gerador da Mega-Sena ---------- */
  // Distribuições medidas nos 201 concursos de dados/megasena.json.
  var MEGA_DIST_IMPARES = {0:1.5, 1:11.4, 2:23.4, 3:31.8, 4:20.9, 5:9.0, 6:2.0};
  var MEGA_DIST_BAIXAS  = {0:0.5, 1:7.5, 2:22.9, 3:37.8, 4:22.4, 5:7.0, 6:2.0};
  // como as 6 dezenas se espalham pelos 4 quadrantes (perfil ordenado)
  var MEGA_PERFIS = [
    {p:[2,2,1,1], w:33.3}, {p:[3,2,1,0], w:30.8}, {p:[3,1,1,1], w:13.9},
    {p:[4,1,1,0], w:8.0},  {p:[2,2,2,0], w:7.0},  {p:[4,2,0,0], w:4.0},
    {p:[5,1,0,0], w:2.0},  {p:[3,3,0,0], w:1.0}
  ];
  var MEGA_SOMA_MIN = 138, MEGA_SOMA_MAX = 231;   // faixa dos 10% aos 90%

  var MEGA_CRITERIOS = {
    neutro:   {rot:"Sorteio puro",     dica:"seleção uniforme entre as dezenas disponíveis"},
    perfil:   {rot:"Perfil comum",     dica:"equilibra distribuição, pares/ímpares e soma"},
    quentes:  {rot:"Mais frequentes",  dica:"favorece as que mais saíram no histórico guardado"},
    frias:    {rot:"Mais atrasadas",   dica:"favorece as que estão há mais tempo sem sair"},
    menos:    {rot:"Evitar frequentes", dica:"favorece as que menos apareceram no histórico"},
    misto:    {rot:"Misto histórico",  dica:"perfil comum mais frequência e atraso"},
    repetir:  {rot:"Repetir do último", dica:"leva 8 a 10 dezenas do último concurso"}
  };

  var DIVERSIDADE_MODOS={
    normal:{rot:"Normal",dica:"somente evita jogos idênticos"},
    diversificada:{rot:"Diversificado",dica:"reduz jogos muito parecidos · recomendado"},
    maxima:{rot:"Cobertura máxima",dica:"prioriza dezenas ainda não usadas"}
  };

  // "Evitar repetidas" não entra nesta lista: é tratado como um interruptor à
  // parte (GERADORES[jogo].evitarUltimo), que se combina com qualquer um dos
  // critérios acima — inclusive "sem critério" — em vez de competir com eles.
  var EVITAR_REPETIDAS = {
    rot: "Evitar repetidas do último concurso", dica: "tira as que saíram no último concurso",
    info: "A ideia por trás é razoável: uma dezena que acabou de sair parece menos provável de " +
      "repetir tão cedo. Mas cada concurso é sorteado do zero, sem lembrar do anterior — nada " +
      "impede a mesma dezena de sair de novo, e de vez em quando ela sai mesmo. Não muda a chance " +
      "matemática, mas continua sendo um jeito legítimo de variar os seus números em vez de repetir " +
      "o que já saiu."
  };

  // Cada loteria mostra só os critérios que fazem sentido nela. Na Lotofácil,
  // com 15 de 25 dezenas saindo sempre, a diferença entre a mais e a menos
  // sorteada é pequena (110 a 131 em 200 concursos) — "mais frequentes" e
  // "mais atrasadas" isolados quase não mexem no jogo, por isso ficam de fora
  // daqui (o mapa de calor continua oferecendo os dois, para quem quiser
  // explorar). "Perfil comum" usa só o formato observado nos concursos;
  // "Misto histórico" acrescenta frequência e atraso como forma de escolha.
  var CRITERIOS_POR_JOGO = {
    // "repetir" existe no código, mas medi e ele é redundante: qualquer jogo de 15
    // já repete ~9 do último sorteio por aritmética. Fora da lista para não enganar.
    lotofacil:      ["neutro", "perfil", "quentes", "frias", "menos", "misto"],
    megasena:       ["neutro", "quentes", "frias", "menos", "misto"],
    maismilionaria: ["neutro", "quentes", "frias", "menos", "misto"],
    quina:          ["neutro", "quentes", "frias", "menos", "misto"],
    diadesorte:     ["neutro", "quentes", "frias", "menos", "misto"]
  };

  // ajustes de texto quando o critério se comporta diferente na loteria
  var DICA_ESPECIAL = {};

  // quantas dezenas do último sorteio o jogo repete — medido em 200 concursos
  var LF_DIST_REPETE = {6:0.5, 7:6.5, 8:28.1, 9:28.1, 10:26.6, 11:7.0, 12:2.5, 13:0.5};
  // distribuições da +Milionária, medidas nos 201 concursos
  var MM_DIST_IMPARES = {0:1.0, 1:8.0, 2:28.9, 3:30.8, 4:23.9, 5:7.0, 6:0.5};
  var MM_DIST_CIMA    = {0:1.5, 1:10.0, 2:18.4, 3:31.8, 4:24.9, 5:12.4, 6:1.0};
  // distribuições da Quina, medidas nos 205 concursos de dados/quina.json
  var QUINA_DIST_IMPARES = {0:2.9, 1:18.0, 2:30.2, 3:29.8, 4:19.0};
  var QUINA_DIST_BAIXAS  = {0:2.0, 1:13.7, 2:29.3, 3:38.5, 4:16.6};
  var QUINA_PERFIS = [
    {p:[2,2,1,0], w:37.1}, {p:[2,1,1,1], w:28.3}, {p:[3,1,1,0], w:21.0},
    {p:[3,2,0,0], w:7.8},  {p:[4,1,0,0], w:5.9}
  ];
  // distribuições da Dia de Sorte, medidas nos 205 concursos de dados/diadesorte.json
  var DS_DIST_IMPARES = {0:0.5, 1:3.4, 2:18.5, 3:32.7, 4:26.3, 5:16.6, 6:2.0};
  var DS_DIST_BAIXAS  = {0:1.5, 1:3.4, 2:15.1, 3:32.7, 4:29.8, 5:12.7, 6:4.9};
  // perfil por "semana" (l1..l5); não-direcional, como a Mega — l5 tem só 3
  // vagas, então formas com 4+ ali raramente aparecem (o gerador redistribui).
  var DS_PERFIS = [
    {p:[3,2,1,1,0], w:32.2}, {p:[2,2,1,1,1], w:19.0}, {p:[2,2,2,1,0], w:16.1},
    {p:[3,2,2,0,0], w:11.7}, {p:[3,1,1,1,1], w:6.8},  {p:[3,3,1,0,0], w:5.4},
    {p:[4,2,1,0,0], w:3.9},  {p:[4,1,1,1,0], w:2.9},  {p:[5,1,1,0,0], w:1.0},
    {p:[5,2,0,0,0], w:0.5},  {p:[4,3,0,0,0], w:0.5}
  ];

  var GERADORES = {
    lotofacil: {
      // medidas nos 200 concursos de dados/historico.json
      distImp:   {5:2.0, 6:6.5, 7:29.0, 8:32.0, 9:22.0, 10:7.5, 11:1.0},
      distBaixa: {4:1.0, 5:2.0, 6:10.0, 7:21.0, 8:32.0, 9:26.5, 10:6.0, 11:1.5},
      somaMin: 172, somaMax: 218, somaQ1: 182, somaQ3: 206, somaMed: 192,
      perfis: [{p:[4,3,3,3,2],w:35.0}, {p:[4,4,3,2,2],w:21.0}, {p:[4,4,3,3,1],w:11.5},
               {p:[5,3,3,2,2],w:11.0}, {p:[5,4,3,2,1],w:6.5},  {p:[4,4,4,2,1],w:3.5},
               {p:[5,4,2,2,2],w:3.5},  {p:[5,3,3,3,1],w:3.5}],
      partes: ["l1","l2","l3","l4","l5"], corte: 13,
      criterio: "neutro", repetirAlvo: null, repetirOpcoes: [6,7,8,9,10,11,12], diversidade: "diversificada",
      modalidade: "normal", espelhoFixasPorPar: [[]], espelhoParAtivo: 0, espelhoPares: 1, qtd: 4, dezenas: 15, jogos: [], trevos: [],
      // sem "excluir" aqui: saem 15 de 25 dezenas, toda linha tem sorteada em
      // 99,5% dos concursos — apostar contra uma parte não se aplica à Lotofácil
      ids: {crits:"lfCrits", evitar:"lfRepetir", qtd:"lfQtd", dez:"lfDez", box:"lfJogos", tag:"lfGenTag",
            nota:"lfGenNota", conf:"lfConfOut"},
      nota: "<b>Por que aparecem tantas sequências:</b> o jogo é mostrado em ordem crescente e " +
            "15 das 25 dezenas são marcadas. Entre as 3.268.760 combinações, a maior sequência tem " +
            "4, 5 ou 6 dezenas em <b>72,7%</b> dos casos; sequências de 7 ou mais aparecem em " +
            "<b>14,7%</b>. Removê-las deixaria o sorteio menos fiel. " +
            "<br><br><b>O que os 200 concursos mostram:</b> as 15 dezenas se espalham pelas 5 linhas " +
            "quase sempre como 4-3-3-3-2 (35%) ou 4-4-3-2-2 (21%), os ímpares ficam entre 7 e 9, " +
            "as dezenas de 1 a 13 entre 7 e 9, e a soma cai entre 172 e 218 em 80% dos sorteios. " +
            "<br><br><b>Sobre a força dos critérios aqui:</b> \"mais frequentes\" e \"mais atrasadas\" " +
            "usam todo o histórico guardado (não só os últimos concursos, que dariam uma amostra " +
            "pequena demais — testei e o \"mais frequente\" muda bastante de um dia para o outro se a " +
            "janela for curta). Mesmo assim, como saem 15 de 25 dezenas, cada uma aparece em cerca de " +
            "120 dos 200 concursos guardados — a diferença entre a mais e a menos sorteada é pequena " +
            "(110 a 131), efeito bem menor do que na Mega-Sena (11 a 29 aparições em 201 concursos). " +
            "O modo <b>Perfil comum</b> não usa frequência nem atraso; ele considera somente o formato " +
            "geral dos concursos. O <b>Misto histórico</b> acrescenta os dois critérios, sem excluir " +
            "nenhuma dezena."
    },
    megasena: {
      distImp: MEGA_DIST_IMPARES, distBaixa: MEGA_DIST_BAIXAS,
      somaMin: MEGA_SOMA_MIN, somaMax: MEGA_SOMA_MAX, somaQ1: 156, somaQ3: 209, somaMed: 182,
      perfis: MEGA_PERFIS, partes: ["q1","q2","q3","q4"], corte: 30,
      criterio: "neutro", evitarUltimo: false, repetirAlvo: null, repetirOpcoes: [0,1,2,3], diversidade: "diversificada", qtd: 4, dezenas: 6,
      excluir: {}, excluirPorJogo: [], excEscopo: "geral", excJogo: 0, jogos: [], trevos: [],
      ids: {crits:"megaCrits", evitar:"megaEvitar", qtd:"megaQtd", dez:"megaDez", exc:"megaExc",
            excInfo:"megaExcInfo", box:"megaJogos", tag:"megaGenTag", nota:"megaGenNota", conf:"megaConfOut"},
      nota: "<b>O que os 201 concursos mostram:</b> as dezenas se distribuem por igual entre os quadrantes " +
            "(25,2% · 25,3% · 24,6% · 24,9%), os ímpares ficam entre 2 e 4 na maioria das vezes e a soma " +
            "cai entre 138 e 231 em 80% dos sorteios."
    },
    maismilionaria: {
      distImp: MM_DIST_IMPARES, distBaixa: MM_DIST_CIMA,
      somaMin: 103, somaMax: 198, somaQ1: 129, somaQ3: 170, somaMed: 150,
      perfis: [{p:[4,2],w:24.9},{p:[3,3],w:31.8},{p:[5,1],w:12.4},{p:[2,4],w:18.4},{p:[1,5],w:10.0},{p:[6,0],w:1.5}],
      perfilDirecional: true,        // [4,2] é "4 em cima", diferente de [2,4]
      partes: ["sup","inf"], corte: 25,
      criterio: "neutro", evitarUltimo: false, repetirAlvo: null, repetirOpcoes: [0,1,2,3], diversidade: "diversificada", qtd: 4, dezenas: 6,
      excluir: {}, excluirPorJogo: [], excEscopo: "geral", excJogo: 0, jogos: [], trevos: [],
      ids: {crits:"mmCrits", evitar:"mmEvitar", qtd:"mmQtd", dez:"mmDez", exc:"mmExc",
            excInfo:"mmExcInfo", box:"mmJogos", tag:"mmGenTag", nota:"mmGenNota", conf:"mmConfOut"},
      nota: "<b>O que os 201 concursos mostram:</b> a divisão entre as metades fica em 3-3 (31,8%) ou " +
            "4-2 (24,9%) na maioria das vezes, os ímpares ficam entre 2 e 4, e a soma cai entre 103 e 198 " +
            "em 80% dos sorteios. Os trevos são sorteados à parte, sem critério — são só 15 combinações. " +
            "<br><br><b>Sobre premiar mais aqui:</b> as quatro faixas menores pagam valor fixo " +
            "(3+2 = R$ 50 · 3+1 = R$ 24 · 2+2 = R$ 12 · 2+1 = R$ 6), então cair em faixa é bem mais " +
            "comum do que na Mega — só que com prêmios pequenos, na média menores que o preço da aposta."
    },
    quina: {
      distImp: QUINA_DIST_IMPARES, distBaixa: QUINA_DIST_BAIXAS,
      somaMin: 142, somaMax: 262, somaQ1: 164, somaQ3: 231, somaMed: 193,
      perfis: QUINA_PERFIS, partes: ["q1","q2","q3","q4"], corte: 40,
      criterio: "neutro", evitarUltimo: false, repetirAlvo: null, repetirOpcoes: [0,1,2], diversidade: "diversificada", qtd: 4, dezenas: 5,
      excluir: {}, excluirPorJogo: [], excEscopo: "geral", excJogo: 0, jogos: [], trevos: [],
      ids: {crits:"quinaCrits", evitar:"quinaEvitar", qtd:"quinaQtd", dez:"quinaDez", exc:"quinaExc",
            excInfo:"quinaExcInfo", box:"quinaJogos", tag:"quinaGenTag", nota:"quinaGenNota", conf:"quinaConfOut"},
      nota: "<b>O que os 205 concursos mostram:</b> as 5 dezenas raramente concentram num quadrante só — " +
            "o mais comum é 2-2-1 (37%) ou 2-1-1-1 (28%) espalhados pelos quatro; os ímpares ficam entre " +
            "1 e 3 na maioria das vezes e a soma cai entre 142 e 262 em 80% dos sorteios."
    },
    diadesorte: {
      distImp: DS_DIST_IMPARES, distBaixa: DS_DIST_BAIXAS,
      somaMin: 86, somaMax: 138, somaQ1: 98, somaQ3: 127, somaMed: 114,
      perfis: DS_PERFIS, partes: ["l1","l2","l3","l4","l5"], corte: 15,
      criterio: "neutro", evitarUltimo: false, repetirAlvo: null, repetirOpcoes: [0,1,2,3], diversidade: "diversificada", qtd: 4, dezenas: 7, jogos: [], trevos: [],
      // sem "excluir": com 7 de 31 dezenas, qualquer linha (mesmo a de 3 dias)
      // tem sorteada na enorme maioria dos concursos — apostar contra não rende
      ids: {crits:"dsCrits", evitar:"dsEvitar", qtd:"dsQtd", dez:"dsDez", box:"dsJogos",
            tag:"dsGenTag", nota:"dsGenNota", conf:"dsConfOut"},
      nota: "<b>O que os 205 concursos mostram:</b> as 7 dezenas se espalham pelas 5 semanas do mês " +
            "quase sempre como 3-2-1-1 (32%) ou 2-2-1-1-1 (19%), os ímpares ficam entre 2 e 5 e a soma " +
            "cai entre 86 e 138 em 80% dos sorteios. " +
            "<br><br><b>Sobre o Mês da Sorte:</b> é sorteado à parte, sem relação com as dezenas. " +
            "No Sorteio puro ele é uniforme; nos critérios históricos, frequência e atraso também podem ordenar os meses."
    }
  };

  // Frequência e atraso no HISTÓRICO INTEIRO guardado (não numa janela curta):
  // com poucos concursos, "mais sorteada" e "menos sorteada" viram sorte de
  // amostra pequena — testado: numa janela de 30, a Mega chega a mostrar uma
  // dezena com 8 aparições e outra com 0, sem nenhuma diferença real entre elas.
  function megaFreqEAtraso(jogo,janela){
    var total = LOTERIAS[jogo].total;
    var h = HISTORICOS[jogo].hist.slice(0,janela||HISTORICOS[jogo].hist.length), info = {}, n, i;
    for (n = 1; n <= total; n++) info[n] = {freq: 0, atraso: h.length};
    for (i = 0; i < h.length; i++){
      for (var j = 0; j < h[i].dezenas.length; j++){
        var d = h[i].dezenas[j];
        info[d].freq++;
        if (info[d].atraso === h.length) info[d].atraso = i;   // i = concursos desde então
      }
    }
    return info;
  }

  // "evitarUltimo" é independente do critério: entra como um desconto extra
  // de peso por cima de quentes/frias/neutro, em vez de competir com eles.
  // Posição de cada dezena num ranking (0 = melhor colocada nesse campo).
  // Usado pelo "misto": frequência e atraso vivem em escalas bem diferentes
  // (uma dezena aparece ~120 vezes, mas fica atrasada só uns 5-10 concursos),
  // então somar os valores brutos faria o atraso desaparecer da conta — pela
  // posição no ranking, os dois critérios pesam igual.
  function rankingPorCampo(info, total, campo){
    var nums = [];
    for (var n = 1; n <= total; n++) nums.push(n);
    nums.sort(function(a, b){ return info[b][campo] - info[a][campo]; });
    var pos = {};
    for (var i = 0; i < nums.length; i++) pos[nums[i]] = i;
    return pos;
  }

  function megaPesos(jogo, criterio, evitarUltimo){
    var total = LOTERIAS[jogo].total;
    var info = megaFreqEAtraso(jogo,GERADORES[jogo].janelaAnalise), peso = {}, n;
    var recentes = {};
    if (evitarUltimo){
      var ultimo = HISTORICOS[jogo].hist.slice(0, 1);
      for (var i = 0; i < ultimo.length; i++)
        for (var j = 0; j < ultimo[i].dezenas.length; j++) recentes[ultimo[i].dezenas[j]] = 1;
    }
    var posFreq, posAtraso;
    if (criterio === "misto"){
      posFreq = rankingPorCampo(info, total, "freq");
      posAtraso = rankingPorCampo(info, total, "atraso");
    }

    var maxFreq = 0;
    for (n = 1; n <= total; n++) if (info[n].freq > maxFreq) maxFreq = info[n].freq;
    for (n = 1; n <= total; n++){
      var f = info[n].freq, a = info[n].atraso;
      if (criterio === "quentes")      peso[n] = Math.pow(1 + f, 1.8);
      else if (criterio === "frias")   peso[n] = Math.pow(1 + a, 1.4);
      else if (criterio === "menos")   peso[n] = Math.pow(1 + maxFreq - f, 1.8);
      else if (criterio === "misto")   peso[n] = Math.pow(total - posFreq[n], 1.8) +
                                                  Math.pow(total - posAtraso[n], 1.4);
      else                             peso[n] = 1;
      if (evitarUltimo && recentes[n]) peso[n] *= 0.001;
    }
    return peso;
  }

  function pesosExtras(jogo,criterio){
    var cfg=LOTERIAS[jogo],peso={},n;
    for(n=1;n<=cfg.trevos;n++)peso[n]=1;
    // Mês e trevos são sorteios independentes das dezenas, mas podem receber o
    // mesmo critério histórico quando o usuário escolhe esse tipo de análise.
    if(criterio==="neutro"||criterio==="perfil")return peso;
    var hist=HISTORICOS[jogo].hist.slice(0,GERADORES[jogo].janelaAnalise||HISTORICOS[jogo].hist.length),info={},maxFreq=0;
    for(n=1;n<=cfg.trevos;n++)info[n]={freq:0,atraso:hist.length};
    for(var i=0;i<hist.length;i++)for(var j=0;j<(hist[i].trevos||[]).length;j++){
      var t=hist[i].trevos[j];info[t].freq++;if(info[t].atraso===hist.length)info[t].atraso=i;
    }
    for(n=1;n<=cfg.trevos;n++)maxFreq=Math.max(maxFreq,info[n].freq);
    var pf=rankingPorCampo(info,cfg.trevos,"freq"),pa=rankingPorCampo(info,cfg.trevos,"atraso");
    for(n=1;n<=cfg.trevos;n++){
      if(criterio==="quentes")peso[n]=Math.pow(1+info[n].freq,1.8);
      else if(criterio==="frias")peso[n]=Math.pow(1+info[n].atraso,1.4);
      else if(criterio==="menos")peso[n]=Math.pow(1+maxFreq-info[n].freq,1.8);
      else peso[n]=Math.pow(cfg.trevos-pf[n],1.8)+Math.pow(cfg.trevos-pa[n],1.4);
    }
    return peso;
  }

  function sorteiaComPeso(candidatos, k, peso){
    var pool = candidatos.slice(), out = [], i;
    while (out.length < k && pool.length){
      var soma = 0;
      for (i = 0; i < pool.length; i++) soma += peso[pool[i]] || 0.001;
      var r = randomUnit() * soma, acc = 0, idx = pool.length - 1;
      for (i = 0; i < pool.length; i++){
        acc += peso[pool[i]] || 0.001;
        if (r <= acc){ idx = i; break; }
      }
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return out;
  }

  // Nos perfis ORDENADOS (Mega, Lotofácil) o embaralhamento decide qual parte
  // leva quanto. Nos DIRECIONAIS (+Milionária: [4,2] ≠ [2,4], cada um com seu
  // peso medido) embaralhar destruiria a direção — usa como está.
  function escolhePerfil(cfgGer){
    var lista = cfgGer.perfis, soma = 0, i;
    for (i = 0; i < lista.length; i++) soma += lista[i].w;
    var r = randomUnit() * soma, acc = 0;
    for (i = 0; i < lista.length; i++){
      acc += lista[i].w;
      if (r <= acc) return cfgGer.perfilDirecional ? lista[i].p.slice() : shuffled(lista[i].p.slice());
    }
    return lista[0].p.slice();
  }

  // Jogo que repete de 8 a 10 dezenas do último concurso — a faixa em que a
  // repetição real cai em 83% das vezes.
  function jogoRepetindo(jogo0){
    var cfg = LOTERIAS[jogo0], g = GERADORES[jogo0];
    var ultimo = HISTORICOS[jogo0].hist[0];
    if (!ultimo) return [];
    var base = ultimo.dezenas.slice(), fora = [], n;
    for (n = 1; n <= cfg.total; n++) if (base.indexOf(n) === -1) fora.push(n);

    var alvoImp = amostraDist(g.distImp), alvoBaixa = amostraDist(g.distBaixa);
    var melhor = null, melhorCusto = Infinity;
    for (var t = 0; t < 80; t++){
      var r = amostraDist(LF_DIST_REPETE);
      if (r > base.length) r = base.length;
      if (cfg.escolher - r > fora.length) r = cfg.escolher - fora.length;
      var jogo = shuffled(base).slice(0, r).concat(shuffled(fora).slice(0, cfg.escolher - r)).sort(asc);
      var imp = 0, baixa = 0, soma = 0;
      for (var k = 0; k < jogo.length; k++){
        if (jogo[k] % 2) imp++;
        if (jogo[k] <= g.corte) baixa++;
        soma += jogo[k];
      }
      var custo = Math.pow(imp - alvoImp, 2) + Math.pow(baixa - alvoBaixa, 2);
      if (soma < g.somaMin) custo += Math.pow(g.somaMin - soma, 2) / 400;
      if (soma > g.somaMax) custo += Math.pow(soma - g.somaMax, 2) / 400;
      if (custo < melhorCusto){ melhorCusto = custo; melhor = jogo; }
      if (!custo) break;
    }
    return melhor || [];
  }

  // Reparte o perfil-base (medido nos sorteios) para uma aposta de nDez dezenas,
  // respeitando o tamanho de cada parte do volante.
  function escalaPerfil(perfil, nDez, caps){
    var alvo = [], soma = 0, base = 0, i;
    for (i = 0; i < perfil.length; i++) base += perfil[i];
    for (i = 0; i < perfil.length; i++){
      var v = Math.min(caps[i], Math.floor(perfil[i] * nDez / base));
      alvo.push(v); soma += v;
    }
    var guarda = 0;
    while (soma < nDez && guarda++ < 200){
      var idx = randomInt(alvo.length);
      if (alvo[idx] < caps[idx]){ alvo[idx]++; soma++; }
    }
    return soma === nDez ? alvo : null;
  }

  function megaUmJogo(jogo0, peso, indiceJogo){
    var cfg = LOTERIAS[jogo0], g = GERADORES[jogo0];
    if (g.criterio === "repetir") return jogoRepetindo(jogo0);
    var nDez = g.dezenas || cfg.escolher;

    // "Sorteio puro" sorteia de verdade entre TODAS as combinações possíveis,
    // uniforme — sem moldar pro formato típico dos sorteios reais (soma,
    // pares/ímpares, distribuição pelas linhas). sorteiaComPeso com pesos
    // iguais é uniforme sem reposição; só fica enviesado se "evitar
    // repetidas" estiver ligado, e mesmo assim só nisso, não no formato.
    // Os critérios (quentes/frias/misto) continuam com o formato realista
    // abaixo, porque aí a intenção já é enviesar a escolha mesmo.
    if (g.criterio === "neutro"){
      var pool0 = [];
      for (var n0 = 1; n0 <= cfg.total; n0++) if (!dezenaExcluida(jogo0, n0, indiceJogo)) pool0.push(n0);
      if (g.repetirOpcoes && g.repetirAlvo !== null){
        var ultimo0 = HISTORICOS[jogo0].hist[0];
        var dentro0 = [], fora0 = [];
        for (var p0 = 0; p0 < pool0.length; p0++)
          (ultimo0 && ultimo0.dezenas.indexOf(pool0[p0]) >= 0 ? dentro0 : fora0).push(pool0[p0]);
        if (g.repetirAlvo <= dentro0.length && nDez - g.repetirAlvo <= fora0.length)
          return sorteiaComPeso(dentro0,g.repetirAlvo,peso)
            .concat(sorteiaComPeso(fora0,nDez-g.repetirAlvo,peso)).sort(asc);
      }
      return sorteiaComPeso(pool0, nDez, peso).sort(asc);
    }

    var fator = nDez / cfg.escolher;          // aposta múltipla: alvos escalados
    var qtdPartes = g.partes.length;
    var porParte = {}, caps = [], n, i;
    for (i = 0; i < g.partes.length; i++) porParte[g.partes[i]] = [];
    for (n = 1; n <= cfg.total; n++){
      if (dezenaExcluida(jogo0, n, indiceJogo)) continue;   // aposta do usuário: não sai daqui
      var k0 = quadranteDe(n, cfg);
      if (porParte[k0]) porParte[k0].push(n);
    }
    for (i = 0; i < g.partes.length; i++) caps.push(porParte[g.partes[i]].length);

    var alvoImp = amostraDist(g.distImp) * fator;
    var alvoBaixa = amostraDist(g.distBaixa) * fator;
    var melhor = null, melhorCusto = Infinity;

    for (var t = 0; t < 80; t++){
      var alvoParte = escalaPerfil(escolhePerfil(g), nDez, caps);
      if (!alvoParte) continue;
      var jogo = [];
      for (i = 0; i < qtdPartes; i++){
        if (!alvoParte[i]) continue;
        jogo = jogo.concat(sorteiaComPeso(porParte[g.partes[i]], alvoParte[i], peso));
      }
      if (jogo.length !== nDez) continue;
      var imp = 0, baixa = 0, soma = 0;
      for (var k = 0; k < jogo.length; k++){
        if (jogo[k] % 2) imp++;
        if (jogo[k] <= g.corte) baixa++;
        soma += jogo[k];
      }
      var custo = Math.pow(imp - alvoImp, 2) + Math.pow(baixa - alvoBaixa, 2);
      if (g.repetirOpcoes && g.repetirAlvo !== null && HISTORICOS[jogo0].hist[0]){
        var rep0 = 0, ult0 = HISTORICOS[jogo0].hist[0].dezenas;
        for (var r0 = 0; r0 < jogo.length; r0++) if (ult0.indexOf(jogo[r0]) >= 0) rep0++;
        custo += Math.pow(rep0 - g.repetirAlvo, 2) * 1000;
      }
      if (soma < g.somaMin * fator) custo += Math.pow(g.somaMin * fator - soma, 2) / 400;
      if (soma > g.somaMax * fator) custo += Math.pow(soma - g.somaMax * fator, 2) / 400;
      if (custo < melhorCusto){ melhorCusto = custo; melhor = jogo.slice().sort(asc); }
      if (custo < 1e-9) break;
    }
    return melhor || [];
  }

  function pontuacaoDiversidade(candidato, anteriores, modo){
    if(!anteriores.length)return 0;
    var usados={},novos=0,maxRep=0,somaRep=0;
    for(var i=0;i<anteriores.length;i++)for(var j=0;j<anteriores[i].length;j++)usados[anteriores[i][j]]=true;
    for(i=0;i<candidato.length;i++)if(!usados[candidato[i]])novos++;
    for(i=0;i<anteriores.length;i++){
      var rep=0;for(j=0;j<candidato.length;j++)if(anteriores[i].indexOf(candidato[j])>=0)rep++;
      maxRep=Math.max(maxRep,rep);somaRep+=rep;
    }
    // Diversificado reduz primeiro a maior semelhança entre dois bilhetes.
    // Cobertura máxima prioriza dezenas ainda ausentes no conjunto.
    return modo==="maxima" ? -novos*1000+maxRep*40+somaRep
      : maxRep*100+somaRep*5-novos*12;
  }

  function candidatoValido(jogo0,j,indice,vistos){
    var g=GERADORES[jogo0],cfg=LOTERIAS[jogo0];
    if(j.length!==(g.dezenas||cfg.escolher)||vistos[j.join(",")])return false;
    if(g.repetirOpcoes&&g.repetirAlvo!==null&&HISTORICOS[jogo0].hist[0]){
      var rep=0,ult=HISTORICOS[jogo0].hist[0].dezenas;
      for(var r=0;r<j.length;r++)if(ult.indexOf(j[r])>=0)rep++;
      if(rep!==g.repetirAlvo)return false;
    }
    return true;
  }

  function escolherExtraDiverso(jogo0,pesoExtra,anteriores){
    var g=GERADORES[jogo0],cfg=LOTERIAS[jogo0],pool=[];
    for(var t=1;t<=cfg.trevos;t++)pool.push(t);
    if(g.diversidade==="normal")return sorteiaComPeso(pool,cfg.escolherTrevos,pesoExtra).sort(asc);
    var melhor=null,score=Infinity,vistos={};
    for(var a=0;a<20;a++){
      var c=sorteiaComPeso(pool,cfg.escolherTrevos,pesoExtra).sort(asc),ch=c.join(",");if(vistos[ch])continue;vistos[ch]=1;
      var s=pontuacaoDiversidade(c,anteriores,g.diversidade);if(s<score){score=s;melhor=c;}
    }
    return melhor||sorteiaComPeso(pool,cfg.escolherTrevos,pesoExtra).sort(asc);
  }

  function criarParEspelho(fixas){
    var livres=[];for(var n=1;n<=25;n++)if(fixas.indexOf(n)<0)livres.push(n);
    livres=shuffled(livres);
    return [fixas.concat(livres.slice(0,10)).sort(asc),fixas.concat(livres.slice(10)).sort(asc)];
  }

  function garantirFixasEspelho(){
    var g=GERADORES.lotofacil;
    if(!Array.isArray(g.espelhoFixasPorPar))g.espelhoFixasPorPar=[];
    if(g.espelhoFixas&&g.espelhoFixas.length===5&&!g.espelhoFixasPorPar.length)g.espelhoFixasPorPar.push(g.espelhoFixas.slice());
    while(g.espelhoFixasPorPar.length<10)g.espelhoFixasPorPar.push([]);
    for(var i=0;i<g.espelhoFixasPorPar.length;i++)if(!Array.isArray(g.espelhoFixasPorPar[i]))g.espelhoFixasPorPar[i]=[];
    g.espelhoParAtivo=Math.max(0,Math.min(g.espelhoPares-1,g.espelhoParAtivo||0));
    return g.espelhoFixasPorPar;
  }

  function primeiroParEspelhoInvalido(){
    var g=GERADORES.lotofacil,grupos=garantirFixasEspelho(),assinaturas={};
    for(var i=0;i<g.espelhoPares;i++){
      if(grupos[i].length!==5)return{indice:i,motivo:"incompleto"};
      var chave=grupos[i].slice().sort(asc).join(",");
      if(assinaturas[chave]!==undefined)return{indice:i,motivo:"repetido",anterior:assinaturas[chave]};
      assinaturas[chave]=i;
    }
    return null;
  }

  function gerarEspelhoLotofacil(){
    var g=GERADORES.lotofacil,grupos=garantirFixasEspelho(),invalido=primeiroParEspelhoInvalido();
    if(invalido){g.espelhoParAtivo=invalido.indice;atualizarEspelhoLotofacil();
      toast(invalido.motivo==="repetido"?"O Par "+(invalido.indice+1)+" repete as fixas do Par "+(invalido.anterior+1):"Configure as 5 fixas do Par "+(invalido.indice+1));return;}
    var out=[],vistos={};
    for(var par=0;par<g.espelhoPares;par++){
      var melhor=null,melhorScore=Infinity;
      for(var a=0;a<24;a++){
        var candidato=criarParEspelho(grupos[par]),ka=candidato[0].join(","),kb=candidato[1].join(",");
        if(vistos[ka]||vistos[kb])continue;
        var score=pontuacaoDiversidade(candidato[0],out,"diversificada")+
          pontuacaoDiversidade(candidato[1],out.concat([candidato[0]]),"diversificada");
        if(score<melhorScore){melhorScore=score;melhor=candidato;}
      }
      if(!melhor)break;
      vistos[melhor[0].join(",")]=1;vistos[melhor[1].join(",")]=1;
      out.push(melhor[0],melhor[1]);
    }
    g.dezenas=15;g.qtd=g.espelhoPares*2;g.jogos=out;g.trevos=[];
    var conf=document.getElementById(g.ids.conf);if(conf)conf.innerHTML="";
    atualizarResumoGerador("lotofacil");renderMegaJogos("lotofacil");atualizarNotaGerador("lotofacil");
    if(out.length!==g.qtd)toast("Não foi possível completar todos os pares; tente gerar novamente");
  }

  function megaGerarJogos(jogo0){
    var g = GERADORES[jogo0], cfg = LOTERIAS[jogo0];
    if(jogo0==="lotofacil"&&g.modalidade==="espelho"){gerarEspelhoLotofacil();return;}
    var peso = megaPesos(jogo0, g.criterio, g.evitarUltimo), pesoExtra=cfg.trevos?pesosExtras(jogo0,g.criterio):null;
    var vistos={},out=[],trevos=[],modo=g.diversidade||"normal";
    for(var indice=0;indice<g.qtd;indice++){
      var amostras=modo==="normal"?1:modo==="maxima"?28:12;
      var comRepeticao=g.repetirOpcoes&&g.repetirAlvo!==null;
      var maxTent=modo==="normal"?(comRepeticao?160:40):amostras*(comRepeticao?20:5)+40;
      var validos=0,tent=0,melhor=null,melhorScore=Infinity,avaliados={};
      while(tent++<maxTent&&validos<amostras){
        var j=megaUmJogo(jogo0,peso,indice),chaveAvaliada=j.join(",");
        if(avaliados[chaveAvaliada]||!candidatoValido(jogo0,j,indice,vistos))continue;avaliados[chaveAvaliada]=1;
        validos++;var score=pontuacaoDiversidade(j,out,modo);
        if(score<melhorScore){melhorScore=score;melhor=j;}
        if(modo==="normal")break;
      }
      if(!melhor)break;
      vistos[melhor.join(",")]=1;out.push(melhor);
      if(cfg.trevos)trevos.push(escolherExtraDiverso(jogo0,pesoExtra,trevos));
    }
    g.jogos = out; g.trevos = trevos;
    if (out.length < g.qtd) toast("Foi possível montar " + out.length + " de " + g.qtd + " jogos com esses filtros");
    var conf = document.getElementById(g.ids.conf);
    if (conf) conf.innerHTML = "";       // a conferência exibida era dos jogos antigos
    atualizarResumoGerador(jogo0);
    renderMegaJogos(jogo0);
  }

  // Mini-cartela: mostra onde as dezenas do jogo caem no volante.
  function miniVolante(jogo, jogoCfg, destaques){
    var cfg = jogoCfg || LOTERIAS.megasena;
    destaques=destaques||{};
    var acertos=destaques.acertos||[],fixas=destaques.fixas||[];
    var html = '<div class="minivolante div-' + (cfg.divisao || "quadrantes") +
               '" style="--cols:' + cfg.colunas + '" aria-label="Mini volante da aposta">';
    for (var n = 1; n <= cfg.total; n++){
      var marc = jogo.indexOf(n) >= 0;
      html += '<span class="mnum ' + quadranteDe(n, cfg) + (marc ? " on" : "")+
              (marc&&acertos.indexOf(n)>=0?" hit":"")+(marc&&fixas.indexOf(n)>=0?" fixed":"")+
              '"'+(marc?' title="Dezena '+pad(n)+'"':'')+'>' +
              (marc ? pad(n) : "") + '</span>';
    }
    return html + '</div>';
  }

  function renderMegaJogos(jogo0){
    var g = GERADORES[jogo0], cfg = LOTERIAS[jogo0];
    var box = document.getElementById(g.ids.box);
    if (!box) return;
    box.innerHTML = "";
    for (var k = 0; k < g.jogos.length; k++){
      var jogo = g.jogos[k], conta = {}, imp = 0, baixa = 0, soma = 0, i;
      for (i = 0; i < g.partes.length; i++) conta[g.partes[i]] = 0;
      for (i = 0; i < jogo.length; i++){
        var pk = quadranteDe(jogo[i], cfg);
        if (conta[pk] !== undefined) conta[pk]++;
        if (jogo[i] % 2) imp++;
        if (jogo[i] <= g.corte) baixa++;
        soma += jogo[i];
      }
      var trevos = g.trevos[k] || null;
      var repetidas = 0;
      if (g.repetirOpcoes && HISTORICOS[jogo0].hist[0])
        for (var ri = 0; ri < jogo.length; ri++)
          if (HISTORICOS[jogo0].hist[0].dezenas.indexOf(jogo[ri]) >= 0) repetidas++;
      // o ♦ da soma só faz sentido no tamanho medido nos sorteios reais
      var somaOk = jogo.length === cfg.escolher && soma >= g.somaQ1 && soma <= g.somaQ3;
      var acertos = jogo0 === "lotofacil" && drawReady() ? hitsIn(jogo)
                  : jogo0 === "diadesorte" && dsDrawn.length === 7 ? jogo.filter(dsInDraw).length
                  : -1;
      var premiadoDs = jogo0 === "diadesorte" && dsDrawn.length === 7 &&
        (FAIXAS_TESTE.diadesorte(acertos) || (trevos && dsDrawnMes && trevos.indexOf(dsDrawnMes) >= 0));
      var copia = jogo.map(pad).join(" ") +
        (trevos ? "  | " + tituloTrevo(jogo0).toLowerCase() + ": " + listaTrevos(jogo0, trevos) : "");
      var divisao = g.partes.map(function(x){ return conta[x]; }).join("·");
      var exGeral = contarExclusoes(g.excluir), exPropria = g.excluirPorJogo ? contarExclusoes(g.excluirPorJogo[k]) : 0;
      var exResumo=[];
      if(exGeral)exResumo.push(exGeral+' '+(exGeral===1?'geral':'gerais'));
      if(exPropria)exResumo.push(exPropria+' própria'+(exPropria===1?'':'s'));
      var ehEspelho=jogo0==="lotofacil"&&g.modalidade==="espelho";
      var fixasDoJogo=ehEspelho?(garantirFixasEspelho()[Math.floor(k/2)]||[]):[];
      var tituloJogo=ehEspelho?'Par '+(Math.floor(k/2)+1)+' · Cartela '+(k%2?'B':'A'):'Jogo '+(k+1);
      var card = document.createElement("div");
      card.className = "game"+(ehEspelho?" mirror-game":"");
      card.innerHTML =
        '<header><div class="gtitle"><h3>' + tituloJogo + '</h3>' +
          (trevos ? '<span class="prize">' + listaTrevos(jogo0, trevos) + '</span>' : '') + '</div>' +
        '<button class="btn small" type="button" data-copia="' + copia + '">Copiar</button></header>' +
        '<div class="jogolinha">' +
          '<div class="gamenums">' + jogo.map(function(n){ return '<span class="num'+(ehEspelho&&fixasDoJogo.indexOf(n)>=0?' fixed':'')+'">' + pad(n) + '</span>'; }).join("") + '</div>' +
          miniVolante(jogo, cfg) +
        '</div>' +
        '<div class="stats">' +
          '<span class="stat">' +
            (g.partes.length === 5 ? "Linhas" : g.partes.length === 4 ? "Quadrantes" : "Cima·baixo") +
            ' <b>' + divisao + '</b></span>' +
          '<span class="stat">Pares <b>' + (jogo.length - imp) + '</b></span>' +
          '<span class="stat">Ímpares <b>' + imp + '</b></span>' +
          '<span class="stat">1–' + g.corte + ' <b>' + baixa + '</b></span>' +
          (ehEspelho?'<span class="stat mirror-stat">Espelho <b>5 fixas</b></span>':'')+
          (exResumo.length ? '<span class="stat">Exclusões <b>' + exResumo.join(' + ') + '</b></span>' : '') +
          (g.repetirOpcoes ? '<span class="stat">Repete do último <b>' + repetidas + '</b></span>' : '') +
          '<span class="stat' + (somaOk ? ' quente' : '') + '"' +
            ' title="metade dos sorteios reais soma entre ' + g.somaQ1 + ' e ' + g.somaQ3 + '">' +
            'Soma <b>' + soma + '</b>' + (somaOk ? ' ♦' : '') + '</span>' +
          (jogo.length > cfg.escolher
            ? '<span class="stat">' + comb(jogo.length, cfg.escolher).toLocaleString("pt-BR") +
              ' jogos simples · <b>' + brl(custoJogo(jogo0, jogo.length)) + '</b></span>' : '') +
          (acertos >= 0 ? '<span class="stat hitstat">Acertos <b>' + acertos + '</b></span>' : '') +
        '</div>';
      if (acertos >= PREMIA_A_PARTIR_DE || premiadoDs) card.className = "game premiado";
      box.appendChild(card);
    }
    renderResumoCarteira(jogo0);
    var tag = document.getElementById(g.ids.tag);
    if(tag&&jogo0==="lotofacil"&&g.modalidade==="espelho")tag.textContent=g.espelhoPares+" "+(g.espelhoPares===1?"par":"pares")+" · "+g.jogos.length+" cartelas";
    else if (tag) tag.textContent = g.jogos.length
      ? g.jogos.length + (g.jogos.length > 1 ? " jogos" : " jogo") +
        (g.dezenas > cfg.escolher ? " de " + g.dezenas + " dezenas" : "")
      : cfg.escolher + " dezenas" +
        (cfg.trevos ? " + " + cfg.escolherTrevos + " " + palavraTrevo(jogo0, cfg.escolherTrevos) : "");
    // o balanço depende dos jogos atuais — sem isso, gerar jogos novos com o
    // sorteio já marcado deixava a tabela presa mostrando os jogos antigos
    if (jogo0 === "lotofacil") renderBalanco();
    if (jogo0 === "diadesorte") renderDsBalanco();
  }

  // Faixas de prêmio de cada loteria, conforme o regulamento da Caixa. Devolve
  // a chave usada no histórico ou null se o jogo não premiou.
  // +Milionária: com 4+ acertos, 1 trevo ou nenhum caem na MESMA faixa ("+1/0");
  // com 2 ou 3 acertos é preciso ao menos 1 trevo, e o prêmio é fixo
  // (3+2 = R$ 50 · 3+1 = R$ 24 · 2+2 = R$ 12 · 2+1 = R$ 6).
  // Dia de Sorte: 4 a 7 acertos premia por si só; o Mês da Sorte é uma faixa
  // À PARTE (ganha com o mês certo mesmo sem bater 4 dezenas) — por isso essa
  // função só cobre as faixas de dezenas, e premiosDesdobrados soma o mês
  // separadamente logo abaixo.
  var FAIXAS_TESTE = {
    lotofacil: function(ac){ return ac >= 11 ? String(ac) : null; },
    megasena:  function(ac){ return ac >= 4 ? String(ac) : null; },
    quina:     function(ac){ return ac >= 2 ? String(ac) : null; },
    diadesorte: function(ac){ return ac >= 4 ? String(ac) : null; },
    maismilionaria: function(ac, tv){
      if (ac >= 4) return ac + (tv === 2 ? "+2" : "+1/0");
      if ((ac === 3 || ac === 2) && tv >= 1) return ac + "+" + tv;
      return null;
    }
  };

  function comb(n, k){
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  }

  // Uma aposta com mais dezenas equivale a C(n, escolher) jogos simples.
  function custoJogo(jogo0, nDez){
    return comb(nDez, LOTERIAS[jogo0].escolher) * PRECOS[jogo0];
  }

  // Desdobra a aposta múltipla: com "ac" das sorteadas dentro das nDez marcadas,
  // devolve quantos jogos simples caem em cada faixa. Na aposta simples o
  // resultado é no máximo uma faixa com 1 jogo — igual ao comportamento antigo.
  function premiosDesdobrados(jogo0, nDez, ac, tv){
    var cfg = LOTERIAS[jogo0], faixaDe = FAIXAS_TESTE[jogo0], out = {};
    for (var k = 0; k <= ac; k++){
      var chave = faixaDe(k, tv);
      if (!chave) continue;
      var qtd = comb(ac, k) * comb(nDez - ac, cfg.escolher - k);
      if (qtd) out[chave] = (out[chave] || 0) + qtd;
    }
    // Dia de Sorte: o mês certo premia à parte, em TODOS os jogos simples do
    // desdobramento — não depende de quantas dezenas bateram (só há 1 mês por
    // aposta, então ele não se combina com as dezenas como os trevos da
    // +Milionária combinam).
    if (jogo0 === "diadesorte" && tv === 1)
      out["mes"] = (out["mes"] || 0) + comb(nDez, cfg.escolher);
    return out;
  }

  // Chance de uma aposta de nDez dezenas pegar alguma faixa (hipergeométrica).
  // Na +Milionária os 2 trevos entram com P(2) = 1/15, P(1) = 8/15, P(0) = 6/15.
  function chancePremiado(jogo0, nDez){
    var cfg = LOTERIAS[jogo0], faixaDe = FAIXAS_TESTE[jogo0];
    // só a +Milionária combina o trevo DENTRO da faixa (2 de 6, hipergeométrico);
    // na Dia de Sorte o mês premia à parte — entra depois, fora deste laço.
    var pTv = cfg.escolherTrevos === 2 ? [6/15, 8/15, 1/15] : [1];
    var p = 0;
    for (var ac = 0; ac <= cfg.escolher; ac++){
      var pAc = comb(cfg.escolher, ac) * comb(cfg.total - cfg.escolher, nDez - ac) / comb(cfg.total, nDez);
      for (var tv = 0; tv < pTv.length; tv++)
        if (faixaDe(ac, tv)) p += pAc * pTv[tv];
    }
    if (jogo0 === "diadesorte"){
      var pMes = cfg.escolherTrevos / cfg.trevos;     // 1 em 12
      p += (1 - p) * pMes;                            // premia mesmo sem 4+ dezenas
    }
    return p;
  }

  // Confere os jogos GERADOS (os que estão na tela) contra todos os concursos
  // guardados: quantos acertos cada um teria feito se tivesse sido apostado em
  // todos eles. É o complemento do teste de critério — aqui os jogos são fixos;
  // lá, o motor gera jogos novos para cada concurso.
  // Nome amigável de uma faixa desdobrada ("6+1/0", "mes", "4") para a lista
  // de concursos premiados.
  function rotuloFaixa(jogo0, chave){
    if (chave === "mes") return "mês certo";
    if (jogo0 === "maismilionaria"){
      var partes = chave.split("+");
      return partes[0] + " acertos + " + (partes[1] === "1/0" ? "1 ou nenhum trevo" : partes[1] + " trevo(s)");
    }
    return chave + " acertos";
  }

  function barrasHistoricoLotofacil(titulo,nota,dist,total){
    var existentes=Object.keys(dist).map(Number),inicio=existentes.length?Math.min.apply(null,existentes):5;
    inicio=Math.min(inicio,11);inicio=Math.max(5,inicio);
    var maior=1,linhas="";
    for(var p=inicio;p<=15;p++)maior=Math.max(maior,dist[p]||0);
    for(p=inicio;p<=15;p++){
      var qtd=dist[p]||0,pct=total?100*qtd/total:0,prem=p>=11?" premiada":"";
      linhas+='<div class="history-bar-row'+prem+'"><span>'+p+' pontos</span><div class="history-bar"><i style="width:'+
        (100*qtd/maior).toFixed(2)+'%"></i></div><b>'+qtd+'</b><small>'+pct.toFixed(1).replace(".",",")+'%</small></div>';
    }
    return '<section class="history-dist"><header><div><span class="eyebrow">Distribuição de pontos</span><h4>'+titulo+
      '</h4></div><b>'+total.toLocaleString("pt-BR")+' resultados</b></header><p>'+nota+'</p><div class="history-bars">'+linhas+'</div></section>';
  }

  function resumoHistoricoLotofacil(distTodos,distMelhor,porJogo,nConc,modoEspelho){
    var total=porJogo.length*nConc,linhas="";
    for(var i=0;i<porJogo.length;i++){
      var r=porJogo[i],premios=0;for(var p=11;p<=15;p++)premios+=r.dist[p]||0;
      var nomeCartela=modoEspelho?'Par '+(Math.floor(i/2)+1)+' · '+(i%2?'B':'A'):'Jogo '+(i+1);
      linhas+='<tr><td><b>'+nomeCartela+'</b></td><td>'+(r.soma/nConc).toFixed(2).replace(".",",")+'</td><td><b>'+r.melhor+
        '</b></td><td>'+premios+'</td><td>'+(r.dist[11]||0)+'</td><td>'+(r.dist[12]||0)+'</td><td>'+
        (r.dist[13]||0)+'</td><td>'+(r.dist[14]||0)+'</td><td>'+(r.dist[15]||0)+'</td></tr>';
    }
    return '<section class="history-overview"><div class="panel-head"><div><span class="eyebrow">Amostra histórica</span><h3>Como a carteira se saiu em '+
      nConc+' concursos</h3></div><span class="modeTag">'+total.toLocaleString("pt-BR")+' comparações</span></div><p class="hint" style="margin-top:0">'+
      'É uma medição destes jogos contra o passado, não uma previsão do próximo resultado.</p><div class="history-dist-grid">'+
      barrasHistoricoLotofacil('Todas as cartelas','Cada um dos jogos foi comparado separadamente com cada concurso.',distTodos,total)+
      barrasHistoricoLotofacil('Melhor da carteira por concurso','Em cada concurso, conta somente a maior pontuação encontrada entre todos os jogos.',distMelhor,nConc)+
      '</div><h4 class="history-table-title">Resultado de cada cartela</h4><div class="tablewrap"><table class="testetab history-ticket-table"><thead><tr>'+
      '<th>Cartela</th><th>Média</th><th>Melhor</th><th>11+ pontos</th><th>11</th><th>12</th><th>13</th><th>14</th><th>15</th>'+
      '</tr></thead><tbody>'+linhas+'</tbody></table></div></section>';
  }

  function conferirGerados(jogo0){
    var g = GERADORES[jogo0], cfg = LOTERIAS[jogo0];
    var box = document.getElementById(g.ids.conf);
    if (!box) return;
    if (!g.jogos.length){ toast("Gere os jogos primeiro"); return; }
    var hist = HISTORICOS[jogo0].hist;
    if (!hist.length){ box.innerHTML = '<p class="hint">Sem histórico guardado para comparar.</p>'; return; }
    var cards = "", totRet = 0, totPrem = 0, somaAcertos = 0, semRateio = 0;
    var distTodos={},melhorPorConcurso=new Array(hist.length).fill(-1),porJogo=[];
    for (var k = 0; k < g.jogos.length; k++){
      var jogo = g.jogos[k], meusTrevos = g.trevos[k] || [];
      var nomeConferencia=jogo0==="lotofacil"&&g.modalidade==="espelho"?'Par '+(Math.floor(k/2)+1)+' · Cartela '+(k%2?'B':'A'):'Jogo '+(k+1);
      var soma = 0, melhor = -1, melhorTv = 0, ret = 0, vencidos = [],distJogo={};
      for (var i = 0; i < hist.length; i++){
        var c = hist[i], ac = 0, tv = 0, j;
        for (j = 0; j < jogo.length; j++) if (c.dezenas.indexOf(jogo[j]) >= 0) ac++;
        for (j = 0; j < meusTrevos.length; j++)
          if ((c.trevos || []).indexOf(meusTrevos[j]) >= 0) tv++;
        soma += ac;
        distTodos[ac]=(distTodos[ac]||0)+1;distJogo[ac]=(distJogo[ac]||0)+1;
        melhorPorConcurso[i]=Math.max(melhorPorConcurso[i],ac);
        if (ac > melhor || (ac === melhor && tv > melhorTv)){ melhor = ac; melhorTv = tv; }
        // aposta múltipla: desdobra nos jogos simples e soma faixa a faixa
        var mapa = premiosDesdobrados(jogo0, jogo.length, ac, tv), faixas = [], valor = 0;
        for (var fx in mapa){
          faixas.push(rotuloFaixa(jogo0, fx));
          var unit = (c.premios && c.premios[fx]) || 0;   // acumulado: sem rateio publicado
          if (unit) valor += mapa[fx] * unit; else semRateio += mapa[fx];
        }
        if (faixas.length){
          ret += valor;
          vencidos.push({concurso: c.concurso, data: c.data, acertos: ac, tv: tv,
                          faixas: faixas, valor: valor});
        }
      }
      somaAcertos += soma; totRet += ret; totPrem += vencidos.length;
      porJogo.push({soma:soma,melhor:melhor,dist:distJogo});

      var detConcursos = "";
      if (vencidos.length){
        detConcursos = '<details class="confdet"><summary>Ver ' + vencidos.length +
          (vencidos.length > 1 ? ' concursos em que premiou' : ' concurso em que premiou') + '</summary>' +
          '<div class="tablewrap"><table class="testetab"><thead><tr>' +
            '<th>Concurso</th><th>Data</th><th>Acertos</th><th>Faixa</th><th>Valor</th>' +
          '</tr></thead><tbody>' +
          vencidos.map(function(v){
            return '<tr><td>#' + v.concurso + '</td><td>' + v.data + '</td>' +
              '<td>' + v.acertos + (meusTrevos.length ? '+' + v.tv : '') + '</td>' +
              '<td>' + v.faixas.join(" · ") + '</td>' +
              '<td>' + (v.valor ? brl(v.valor) : '<small>sem rateio publicado</small>') + '</td></tr>';
          }).join("") +
          '</tbody></table></div></details>';
      }

      cards += '<div class="game confjogo' + (vencidos.length ? ' premiado' : '') + '">' +
        '<header><div class="gtitle"><h3>' + nomeConferencia + '</h3></div>' +
          '<button class="btn small" type="button" data-copia="' + jogo.map(pad).join(" ") +
            (meusTrevos.length ? "  | " + tituloTrevo(jogo0).toLowerCase() + ": " + listaTrevos(jogo0, meusTrevos) : "") +
            '">Copiar</button></header>' +
        '<div class="jogolinha">' +
          '<div class="gamenums">' + jogo.map(function(n){ return '<span class="num">' + pad(n) + '</span>'; }).join("") + '</div>' +
          miniVolante(jogo, cfg) +
        '</div>' +
        (meusTrevos.length ? '<p class="hint" style="margin:8px 0 0">' + tituloTrevo(jogo0) + ': <b>' +
          listaTrevos(jogo0, meusTrevos) + '</b></p>' : '') +
        '<div class="stats">' +
          '<span class="stat">Média de acertos <b>' + (soma / hist.length).toFixed(2).replace(".", ",") + '</b></span>' +
          '<span class="stat">Melhor <b>' + (cfg.trevos ? melhor + "+" + melhorTv : melhor) + '</b></span>' +
          '<span class="stat' + (vencidos.length ? ' hitstat' : '') + '">Premiado <b>' +
            (vencidos.length || "nunca") + (vencidos.length ? "×" : "") + '</b></span>' +
          '<span class="stat">Teria pago <b>' + (ret ? brl(ret) : "—") + '</b></span>' +
        '</div>' +
        detConcursos +
      '</div>';
    }

    var nJogos = g.jogos.length, nConc = hist.length, nDez = g.jogos[0].length;
    var esperadoMedia = cfg.escolher * nDez / cfg.total;
    var mediaGeral = somaAcertos / (nJogos * nConc);
    var investido = nJogos * nConc * custoJogo(jogo0, nDez);
    var premEsp = nJogos * nConc * chancePremiado(jogo0, nDez);
    var resumoHistorico="";
    if(jogo0==="lotofacil"){
      var distMelhor={};for(var mc=0;mc<melhorPorConcurso.length;mc++)distMelhor[melhorPorConcurso[mc]]=(distMelhor[melhorPorConcurso[mc]]||0)+1;
      resumoHistorico=resumoHistoricoLotofacil(distTodos,distMelhor,porJogo,nConc,g.modalidade==="espelho");
    }

    box.innerHTML =
      resumoHistorico+
      '<div class="totais">' +
        '<div><span>Concursos comparados</span><b>' + nConc + '</b></div>' +
        '<div><span>Média de acertos por concurso</span><b>' +
          mediaGeral.toFixed(2).replace(".", ",") +
          ' <small>esperado: ' + esperadoMedia.toFixed(2).replace(".", ",") + '</small></b></div>' +
        '<div><span>Vezes em faixa premiada</span><b>' + totPrem +
          ' <small>esperado: ~' + (premEsp < 10 ? premEsp.toFixed(1) : String(Math.round(premEsp)))
            .replace(".", ",") + '</small></b></div>' +
        '<div class="saldo"><span>Teria pago no total</span><b class="' +
          (totRet >= investido ? "pos" : "neg") + '">' + brl(totRet) + '</b>' +
          '<small>apostando os ' + nJogos + ' jogos' +
          (nDez > cfg.escolher ? ' de ' + nDez + ' dezenas' : '') + ' nos ' + nConc +
          ' concursos: ' + brl(investido) + '</small></div>' +
      '</div>' +
      '<p class="hint">Isto mostra como <b>estes</b> jogos teriam se saído no passado — não muda a chance ' +
        'deles no próximo concurso. Qualquer jogo tem a mesma média esperada (' +
        esperadoMedia.toFixed(2).replace(".", ",") + ' acertos); ficar perto dela não é defeito nem mérito, ' +
        'é o comportamento de qualquer aposta. Um jogo que "teria ganhado" ontem não tem vantagem amanhã: ' +
        'o sorteio não lembra do passado.' +
        (semRateio ? ' Em ' + semRateio + ' caso(s) o jogo caiu em faixa premiada de concurso que ' +
          'acumulou — conta como prêmio, mas sem valor publicado.' : '') +
      '</p>'+
      '<details class="conf-all-games"><summary>Ver os detalhes das '+nJogos+' cartelas</summary><div class="games confjogos">'+cards+'</div></details>';
  }

  function textoSoma(jogo0){
    var g = GERADORES[jogo0], cfg = LOTERIAS[jogo0];
    return '<b>Sobre a soma:</b> somando as ' + cfg.escolher + ' dezenas, a mediana dos sorteios é <b>' +
      g.somaMed + '</b> e <b>metade</b> deles cai entre <b>' + g.somaQ1 + '</b> e <b>' + g.somaQ3 + '</b>. ' +
      'Somas do meio aparecem mais porque existem muito mais combinações com esse formato — ' +
      'não porque o sorteio prefira. Os jogos com soma nessa faixa central ficam marcados com ♦; ' +
      'isso só diz que o jogo tem cara de sorteio comum, não que ele tenha mais chance.';
  }

  // A exclusão efetiva é a união da regra geral com a regra do jogo atual.
  // Cada mapa pode conter quadrantes/metades ("p:q1"), linhas ("l:3") e
  // colunas ("c:7") do volante.
  function mapasExclusao(jogo0, indiceJogo){
    var g=GERADORES[jogo0],mapas=[g.excluir||{}];
    if(indiceJogo!==undefined&&indiceJogo!==null&&g.excluirPorJogo&&g.excluirPorJogo[indiceJogo])
      mapas.push(g.excluirPorJogo[indiceJogo]);
    return mapas;
  }

  function dezenaExcluida(jogo0, n, indiceJogo){
    var cfg = LOTERIAS[jogo0], mapas=mapasExclusao(jogo0,indiceJogo), chaves=["p:"+quadranteDe(n,cfg)];
    var idx = n - 1;
    chaves.push("l:"+(Math.floor(idx/cfg.colunas)+1),"c:"+(idx%cfg.colunas+1));
    for(var m=0;m<mapas.length;m++)for(var c=0;c<chaves.length;c++)if(mapas[m][chaves[c]])return true;
    return false;
  }

  // Dezenas que sobram fora do que o usuário apostou que não sai.
  function capacidadeLivre(jogo0, indiceJogo){
    var cfg = LOTERIAS[jogo0], livre = 0;
    for (var n = 1; n <= cfg.total; n++)
      if (!dezenaExcluida(jogo0, n, indiceJogo)) livre++;
    return livre;
  }

  function capacidadeMinima(jogo0){
    var g=GERADORES[jogo0],min=LOTERIAS[jogo0].total;
    for(var i=0;i<g.qtd;i++)min=Math.min(min,capacidadeLivre(jogo0,i));
    return min;
  }

  // Grupos de botões da seção "apostar contra": partes, linhas e colunas.
  // Quando a divisão já É por linhas (Dia de Sorte), pula o primeiro grupo —
  // seria idêntico ao de "Linhas" logo abaixo.
  function gruposExclusao(jogo0){
    var cfg = LOTERIAS[jogo0], g = GERADORES[jogo0], grupos = [], i, j;
    if (cfg.divisao !== "linhas"){
      var partes = g.partes.map(function(p){
        return {k: "p:" + p,
                rot: rotuloParte(p) || (p.charAt(0) === "q" ? p.toUpperCase()
                     : p === "sup" ? "Metade de cima" : "Metade de baixo"),
                small: nomeParte(cfg, p)};
      });
      grupos.push({titulo: cfg.divisao === "metades" ? "Metades" : "Quadrantes", itens: partes});
    }
    var linhas = [];
    for (i = 1; i <= cfg.linhas; i++)
      linhas.push({k: "l:" + i, rot: "Linha " + i, small: faixaLinha(cfg, i)});
    grupos.push({titulo: "Linhas", itens: linhas});

    var colunas = [];
    for (j = 1; j <= cfg.colunas; j++){
      var nums = [];
      for (i = 0; i < cfg.linhas; i++){
        var n = j + i * cfg.colunas;
        if (n <= cfg.total) nums.push(n);   // última linha pode vir incompleta
      }
      colunas.push({k: "c:" + j, rot: "Coluna " + j,
                    small: nums.length <= 6 ? nums.map(pad).join("·")
                         : pad(nums[0]) + "·" + pad(nums[1]) + "·…·" + pad(nums[nums.length - 1])});
    }
    grupos.push({titulo: "Colunas", itens: colunas});
    return grupos;
  }

  function mapaExclusaoEditado(g){
    if(g.excEscopo!=="jogo")return g.excluir;
    if(!g.excluirPorJogo[g.excJogo])g.excluirPorJogo[g.excJogo]={};
    return g.excluirPorJogo[g.excJogo];
  }

  function contarExclusoes(mapa){return Object.keys(mapa||{}).filter(function(k){return mapa[k];}).length;}

  function renderExcluir(jogo0){
    var g=GERADORES[jogo0],cfg=LOTERIAS[jogo0],box=document.getElementById(g.ids.exc);if(!box)return;
    if(g.excJogo>=g.qtd)g.excJogo=Math.max(0,g.qtd-1);
    var pessoal=g.excEscopo==="jogo",mapa=mapaExclusaoEditado(g),html=
      '<div class="excscope" role="group" aria-label="Aplicação das exclusões">'+
      '<button type="button" class="btn scopebtn'+(!pessoal?' on':'')+'" data-ex-scope="geral"><b>Todos os jogos</b><small>regra geral</small></button>'+
      '<button type="button" class="btn scopebtn'+(pessoal?' on':'')+'" data-ex-scope="jogo"><b>Personalizar</b><small>jogo por jogo</small></button></div>';
    if(pessoal){
      html+='<div class="exgame-tabs" role="group" aria-label="Escolha o jogo">';
      for(var j=0;j<g.qtd;j++)html+='<button type="button" class="btn'+(j===g.excJogo?' on':'')+'" data-ex-game="'+j+'">Jogo '+(j+1)+
        (contarExclusoes(g.excluirPorJogo[j])?' <i>•</i>':'')+'</button>';
      html+='</div>';
    }
    html+='<div class="exccontext"><b>'+(pessoal?'Somente no jogo '+(g.excJogo+1):'Regra para todos os jogos')+'</b><small>'+
      (pessoal?'Estas marcações são somadas à regra geral.':'Estas marcações valem igualmente para todos os jogos gerados.')+'</small></div>';
    gruposExclusao(jogo0).forEach(function(gr){
      html+='<div class="excgrupo"><span class="exclabel">'+gr.titulo+'</span><div class="sizes">';
      gr.itens.forEach(function(bt){var herdada=pessoal&&g.excluir[bt.k];html+='<button type="button" class="btn sizebtn'+
        (mapa[bt.k]?' on':'')+(herdada?' inherited':'')+'" data-ex-key="'+bt.k+'"'+(herdada?' disabled':'')+'><b>'+bt.rot+
        '</b><small>'+(herdada?'já excluída para todos':bt.small)+'</small></button>';});
      html+='</div></div>';
    });
    if(contarExclusoes(mapa))html+='<button type="button" class="btn excclear" data-ex-clear>Limpar '+(pessoal?'jogo '+(g.excJogo+1):'regra geral')+'</button>';
    box.innerHTML=html;

    var info = document.getElementById(g.ids.excInfo);
    if (!info) return;
    var gerais=contarExclusoes(g.excluir),personalizados=0;
    for(var x=0;x<g.qtd;x++)if(contarExclusoes(g.excluirPorJogo[x]))personalizados++;
    if (!gerais&&!personalizados){
      info.innerHTML = "Nenhuma parte excluída — todos os jogos usam o volante inteiro.";
      return;
    }
    // chance de a aposta "segurar": todas as sorteadas fora das partes excluídas
    var alvo=pessoal?g.excJogo:null,livre=capacidadeLivre(jogo0,alvo);
    var p = 100 * comb(livre, cfg.escolher) / comb(cfg.total, cfg.escolher);
    info.innerHTML = '<b>'+gerais+' regra'+(gerais===1?'':'s')+' geral'+(gerais===1?'':'is')+'</b> e <b>'+personalizados+
      ' jogo'+(personalizados===1?'':'s')+' personalizado'+(personalizados===1?'':'s')+'</b>. '+(pessoal?'No jogo '+(alvo+1):'Com a regra geral')+
      ', as ' + cfg.escolher + ' sorteadas precisariam cair nas <b>' + livre +
      '</b> dezenas restantes. Isso acontece em <b>' + p.toFixed(1).replace(".", ",") +
      '%</b> dos concursos. A chance matemática de cada combinação não muda.';
  }

  // Repinta estados e preços dos seletores: o custo por jogo depende de quantas
  // dezenas a aposta leva (C(n, escolher) × preço da simples).
  function atualizarPlanoLotofacil(){
    var g=GERADORES.lotofacil,status=document.getElementById("lfPlanStatus"),botao=document.getElementById("lfPlano60");
    if(!status&&!botao)return;
    var limite=60,custo=g.qtd*custoJogo("lotofacil",g.dezenas),saldo=limite-custo;
    var pronto=g.qtd===17&&g.dezenas===15&&g.criterio==="perfil"&&g.repetirAlvo===null&&g.diversidade==="diversificada";
    if(status){
      status.classList.toggle("over",saldo<0);
      status.classList.toggle("ready",pronto);
      status.innerHTML=pronto
        ? '<b>Plano pronto:</b> 17 jogos distintos · R$ 59,50 · sobra R$ 0,50'
        : '<b>Configuração atual: '+brl(custo)+'</b> · '+(saldo>=0?'sobram '+brl(saldo):'ultrapassa o orçamento em '+brl(-saldo));
    }
    if(botao){botao.disabled=pronto;botao.textContent=pronto?'Plano aplicado ✓':'Aplicar plano recomendado';}
  }

  function aplicarPlanoLotofacil60(){
    var g=GERADORES.lotofacil;
    g.modalidade="normal";g.dezenas=15;g.qtd=17;g.qtdNormal=17;g.criterio="perfil";g.repetirAlvo=null;g.diversidade="diversificada";g.janelaAnalise=null;
    criterioAtivo=null;
    var crits=document.getElementById(g.ids.crits);
    if(crits)for(var i=0;i<crits.children.length;i++)
      crits.children[i].classList.toggle("on",crits.children[i].dataset.crit===g.criterio);
    montarControleDiversidade("lotofacil");
    atualizarEspelhoLotofacil();
    paintCustos("lotofacil");
    atualizarNotaGerador("lotofacil");
    megaGerarJogos("lotofacil");
    toast("Plano aplicado: 17 jogos por R$ 59,50");
  }

  function paintCustos(jogo0){
    var g = GERADORES[jogo0], cfg = LOTERIAS[jogo0];
    var unit = custoJogo(jogo0, g.dezenas);
    var dez = document.getElementById(g.ids.dez), i;
    if (dez) for (i = 0; i < dez.children.length; i++){
      var bd = dez.children[i];
      bd.classList.toggle("on", +bd.dataset.n === g.dezenas);
      bd.querySelector("small").textContent = brl(custoJogo(jogo0, +bd.dataset.n));
    }
    var qtd = document.getElementById(g.ids.qtd);
    if (qtd) for (i = 0; i < qtd.children.length; i++){
      var bq = qtd.children[i];
      bq.classList.toggle("on", +bq.dataset.n === g.qtd);
      bq.querySelector("small").textContent = brl(+bq.dataset.n * unit);
    }
    if (g.repetirOpcoes){
      var minimoRep = Math.max(0,g.dezenas + cfg.escolher - cfg.total);
      var maximoRep = Math.min(g.dezenas,cfg.escolher);
      if (g.repetirAlvo !== null && (g.repetirAlvo < minimoRep || g.repetirAlvo > maximoRep)) g.repetirAlvo=null;
      var repBox=document.getElementById(g.ids.evitar);
      if(repBox)for(i=0;i<repBox.children.length;i++){
        var rv=repBox.children[i].dataset.rep;
        repBox.children[i].disabled=rv!=="" && (+rv<minimoRep || +rv>maximoRep);
        repBox.children[i].classList.toggle("on",rv===(g.repetirAlvo===null?"":String(g.repetirAlvo)));
      }
    }
    if(jogo0==="lotofacil")atualizarPlanoLotofacil();
  }

  function atualizarResumoGerador(jogo0){
    var g=GERADORES[jogo0],cfg=LOTERIAS[jogo0],box=document.getElementById(g.ids.box);if(!box)return;
    var card=box.closest(".card"),resumo=card&&card.querySelector(".generator-summary");
    if(card&&!resumo){resumo=document.createElement("div");resumo.className="generator-summary";
      var primeiroTexto=card.getElementsByTagName("p")[0];if(primeiroTexto)primeiroTexto.insertAdjacentElement("afterend",resumo);}
    if(!resumo)return;
    if(jogo0==="lotofacil"&&g.modalidade==="espelho"){
      var configurados=garantirFixasEspelho().slice(0,g.espelhoPares).filter(function(x){return x.length===5;}).length;
      resumo.innerHTML='<div><small>Configuração atual</small><b>'+g.espelhoPares+' '+(g.espelhoPares===1?'par':'pares')+
        ' · '+g.qtd+' cartelas</b></div><span>Jogada espelho</span><span>'+configurados+'/'+g.espelhoPares+' pares configurados</span>'+
        '<span>5 fixas próprias por par</span><span>Cada par cobre 25/25</span><strong>'+brl(g.qtd*PRECOS.lotofacil)+'</strong>';
      return;
    }
    var criterio=(MEGA_CRITERIOS[g.criterio]||MEGA_CRITERIOS.neutro).rot;
    var repeticao=g.repetirAlvo===null?"livre":g.repetirAlvo+" do último";
    var gerais=contarExclusoes(g.excluir),personalizados=0;
    if(g.excluirPorJogo)for(var i=0;i<g.qtd;i++)if(contarExclusoes(g.excluirPorJogo[i]))personalizados++;
    resumo.innerHTML='<div><small>Configuração atual</small><b>'+g.qtd+' '+(g.qtd===1?'jogo':'jogos')+' de '+g.dezenas+' dezenas</b></div>'+
      '<span>'+criterio+'</span><span>Diversidade: '+DIVERSIDADE_MODOS[g.diversidade||"normal"].rot+'</span><span>Repetição: '+repeticao+'</span>'+
      ((gerais||personalizados)?'<span>Exclusões: '+gerais+' gerais · '+personalizados+' personalizados</span>':'')+
      '<strong>'+brl(g.qtd*custoJogo(jogo0,g.dezenas))+'</strong>';
  }

  function metricasCarteira(jogos){
    var unicas={},soma=0,pares=0,max=0;
    for(var i=0;i<jogos.length;i++)for(var n=0;n<jogos[i].length;n++)unicas[jogos[i][n]]=true;
    for(i=0;i<jogos.length;i++)for(var j=i+1;j<jogos.length;j++){
      var rep=0;for(n=0;n<jogos[i].length;n++)if(jogos[j].indexOf(jogos[i][n])>=0)rep++;
      soma+=rep;pares++;max=Math.max(max,rep);
    }
    return{unicas:Object.keys(unicas).length,media:pares?soma/pares:0,max:max,pares:pares};
  }

  function renderResumoCarteira(jogo0){
    var g=GERADORES[jogo0],cfg=LOTERIAS[jogo0],box=document.getElementById(g.ids.box);if(!box)return;
    var painel=box.previousElementSibling;
    if(!painel||!painel.classList.contains("portfolio-summary")){painel=document.createElement("div");painel.className="portfolio-summary";box.parentNode.insertBefore(painel,box);}
    if(!g.jogos.length){painel.hidden=true;return;}painel.hidden=false;
    var m=metricasCarteira(g.jogos),modo=DIVERSIDADE_MODOS[g.diversidade||"normal"];
    var tituloModo=jogo0==="lotofacil"&&g.modalidade==="espelho"?"Jogada espelho":modo.rot;
    var extra="";if(cfg.trevos&&g.trevos.length){var mt=metricasCarteira(g.trevos);extra='<span><b>'+mt.unicas+'/'+cfg.trevos+'</b> '+tituloTrevo(jogo0).toLowerCase()+' cobertos</span>';}
    if(jogo0==="lotofacil"&&g.modalidade==="espelho")extra+='<span><b>'+g.espelhoPares+'</b> '+(g.espelhoPares===1?'par espelhado':'pares espelhados')+'</span>';
    painel.innerHTML='<div><small>Carteira de jogos</small><b>'+tituloModo+'</b></div><span><b>'+m.unicas+'/'+cfg.total+'</b> dezenas cobertas</span>'+
      (m.pares?'<span><b>'+dsFmt1(m.media)+'</b> repetidas em média</span><span><b>'+m.max+'</b> maior sobreposição</span>':'')+extra;
  }

  function montarControleDiversidade(jogo0){
    var g=GERADORES[jogo0],qtd=document.getElementById(g.ids.qtd);if(!qtd)return;
    var id=g.ids.box+"Diversidade",area=document.getElementById(id);
    if(!area){area=document.createElement("section");area.className="generator-diversity";area.id=id;
      area.innerHTML='<h3 class="subhead">Diversidade entre jogos</h3><p class="hint" style="margin-top:0">Organiza o conjunto de bilhetes. Não altera a chance individual de cada combinação.</p><div class="crits"></div>';
      qtd.insertAdjacentElement("afterend",area);
      var grade=area.querySelector(".crits");Object.keys(DIVERSIDADE_MODOS).forEach(function(k){var m=DIVERSIDADE_MODOS[k],b=document.createElement("button");
        b.type="button";b.className="btn critbtn";b.dataset.diversidade=k;b.innerHTML='<b>'+m.rot+'</b><small>'+m.dica+'</small>';grade.appendChild(b);});
      area.addEventListener("click",function(ev){var b=ev.target.closest("[data-diversidade]");if(!b)return;g.diversidade=b.dataset.diversidade;
        montarControleDiversidade(jogo0);megaGerarJogos(jogo0);});
    }
    var botoes=area.querySelectorAll("[data-diversidade]");for(var i=0;i<botoes.length;i++)botoes[i].classList.toggle("on",botoes[i].dataset.diversidade===g.diversidade);
  }

  function limparResultadoEspelho(){
    var g=GERADORES.lotofacil;g.jogos=[];g.trevos=[];
    var conf=document.getElementById(g.ids.conf);if(conf)conf.innerHTML="";renderMegaJogos("lotofacil");atualizarResumoGerador("lotofacil");
  }

  function atualizarEspelhoLotofacil(){
    var g=GERADORES.lotofacil,espelho=document.getElementById("lfMirrorBuilder"),padrao=document.getElementById("lfStandardSettings");
    if(!espelho||!padrao)return;
    var grupos=garantirFixasEspelho(),ativas=grupos[g.espelhoParAtivo];
    var ativo=g.modalidade==="espelho";espelho.hidden=!ativo;padrao.hidden=ativo;
    var modos=document.querySelectorAll("[data-lf-mode]");for(var i=0;i<modos.length;i++)modos[i].classList.toggle("on",modos[i].dataset.lfMode===g.modalidade);
    var abas=document.getElementById("lfMirrorPairTabs");if(abas){abas.innerHTML="";for(i=0;i<g.espelhoPares;i++){
      var aba=document.createElement("button");aba.type="button";aba.className="mirror-pair-tab"+(i===g.espelhoParAtivo?" on":"")+(grupos[i].length===5?" complete":" incomplete");
      aba.dataset.mirrorPair=i;aba.setAttribute("aria-pressed",i===g.espelhoParAtivo?"true":"false");
      aba.innerHTML='<b>Par '+(i+1)+'</b><small>'+(grupos[i].length===5?'✓ pronto':grupos[i].length+'/5 fixas')+'</small>';abas.appendChild(aba);
    }}
    var fixas=document.querySelectorAll("[data-mirror-number]");for(i=0;i<fixas.length;i++)fixas[i].classList.toggle("on",ativas.indexOf(+fixas[i].dataset.mirrorNumber)>=0);
    var cont=document.getElementById("lfMirrorFixedCount");if(cont)cont.textContent="Par "+(g.espelhoParAtivo+1)+" · "+ativas.length+" de 5";
    var pares=document.querySelectorAll("[data-mirror-pairs]");for(i=0;i<pares.length;i++)pares[i].classList.toggle("on",+pares[i].dataset.mirrorPairs===g.espelhoPares);
    var configurados=grupos.slice(0,g.espelhoPares).filter(function(x){return x.length===5;}).length;
    var custo=g.espelhoPares*2*PRECOS.lotofacil,saldo=60-custo,custoEl=document.getElementById("lfMirrorCost");
    if(custoEl){custoEl.classList.toggle("over",saldo<0);custoEl.innerHTML='<div><small>Total da jogada</small><b>'+g.espelhoPares+' '+
      (g.espelhoPares===1?'par':'pares')+' · '+(g.espelhoPares*2)+' cartelas</b></div><strong>'+brl(custo)+'</strong><span>'+
      configurados+' de '+g.espelhoPares+' '+(g.espelhoPares===1?'par configurado':'pares configurados')+' · '+
      (saldo>=0?'dentro de R$ 60, sobra '+brl(saldo):'ultrapassa R$ 60 em '+brl(-saldo))+'</span>';}
    var gerar=document.getElementById("lfGerar");if(gerar)gerar.textContent=ativo?'Gerar pares espelho':'Gerar jogos';
  }

  function escolherFixasEspelhoDoPar(indice){
    var g=GERADORES.lotofacil,grupos=garantirFixasEspelho(),uso={},assinaturas={};
    for(var n=1;n<=25;n++)uso[n]=0;
    for(var p=0;p<g.espelhoPares;p++)if(p!==indice){
      if(grupos[p].length===5)assinaturas[grupos[p].slice().sort(asc).join(",")]=1;
      for(var j=0;j<grupos[p].length;j++)uso[grupos[p][j]]++;
    }
    var escolha=[];
    for(var tentativa=0;tentativa<60;tentativa++){
      escolha=shuffled(Array.from({length:25},function(_,i){return i+1;})).sort(function(a,b){return uso[a]-uso[b];}).slice(0,5).sort(asc);
      if(!assinaturas[escolha.join(",")])break;
    }
    grupos[indice]=escolha;
  }

  function distribuirFixasEspelho(){
    var g=GERADORES.lotofacil,grupos=garantirFixasEspelho(),assinaturas={};
    for(var inicio=0;inicio<g.espelhoPares;inicio+=5){
      var bloco=[],duplicado=true,tentativa=0;
      while(duplicado&&tentativa++<60){
        duplicado=false;bloco=[];var ordem=shuffled(Array.from({length:25},function(_,i){return i+1;}));
        for(var pos=0;pos<5&&inicio+pos<g.espelhoPares;pos++){
          var conjunto=ordem.slice(pos*5,pos*5+5).sort(asc),chave=conjunto.join(",");
          if(assinaturas[chave])duplicado=true;bloco.push(conjunto);
        }
      }
      for(pos=0;pos<bloco.length;pos++){grupos[inicio+pos]=bloco[pos];assinaturas[bloco[pos].join(",")]=1;}
    }
  }

  function montarEspelhoLotofacil(){
    var g=GERADORES.lotofacil,modos=document.getElementById("lfGeneratorMode"),grid=document.getElementById("lfMirrorFixedGrid"),pares=document.getElementById("lfMirrorPairs"),abas=document.getElementById("lfMirrorPairTabs");
    if(!modos||!grid||!pares||!abas)return;
    garantirFixasEspelho();
    if(!grid.children.length)for(var n=1;n<=25;n++){
      var b=document.createElement("button");b.type="button";b.className="mirror-number";b.dataset.mirrorNumber=n;b.textContent=pad(n);grid.appendChild(b);
    }
    if(!pares.children.length)for(var p=1;p<=10;p++){
      var bp=document.createElement("button");bp.type="button";bp.className="btn sizebtn";bp.dataset.mirrorPairs=p;
      bp.innerHTML='<b>'+p+(p===1?' par':' pares')+'</b><small>'+(p*2)+' cartelas · '+brl(p*2*PRECOS.lotofacil)+'</small>';pares.appendChild(bp);
    }
    if(!modos.dataset.lig){
      modos.dataset.lig="1";modos.addEventListener("click",function(ev){var b=ev.target.closest("[data-lf-mode]");if(!b)return;
        if(b.dataset.lfMode===g.modalidade)return;
        if(b.dataset.lfMode==="espelho"){g.qtdNormal=g.qtd;g.modalidade="espelho";g.dezenas=15;g.qtd=g.espelhoPares*2;limparResultadoEspelho();}
        else{g.modalidade="normal";g.qtd=g.qtdNormal||4;megaGerarJogos("lotofacil");}
        atualizarEspelhoLotofacil();atualizarNotaGerador("lotofacil");
      });
      abas.addEventListener("click",function(ev){var b=ev.target.closest("[data-mirror-pair]");if(!b)return;g.espelhoParAtivo=+b.dataset.mirrorPair;atualizarEspelhoLotofacil();});
      grid.addEventListener("click",function(ev){var b=ev.target.closest("[data-mirror-number]");if(!b)return;var grupo=garantirFixasEspelho()[g.espelhoParAtivo],n=+b.dataset.mirrorNumber,idx=grupo.indexOf(n);
        if(idx>=0)grupo.splice(idx,1);else if(grupo.length<5)grupo.push(n);else{toast("O Par "+(g.espelhoParAtivo+1)+" já tem as 5 dezenas fixas");return;}
        grupo.sort(asc);limparResultadoEspelho();atualizarEspelhoLotofacil();
      });
      pares.addEventListener("click",function(ev){var b=ev.target.closest("[data-mirror-pairs]");if(!b)return;g.espelhoPares=+b.dataset.mirrorPairs;g.qtd=g.espelhoPares*2;
        g.espelhoParAtivo=Math.min(g.espelhoParAtivo,g.espelhoPares-1);limparResultadoEspelho();atualizarEspelhoLotofacil();
      });
      onClick("lfMirrorAuto",function(){escolherFixasEspelhoDoPar(g.espelhoParAtivo);limparResultadoEspelho();atualizarEspelhoLotofacil();});
      onClick("lfMirrorAutoAll",function(){distribuirFixasEspelho();limparResultadoEspelho();atualizarEspelhoLotofacil();toast("Fixas distribuídas entre os "+g.espelhoPares+" pares");});
      onClick("lfMirrorClear",function(){garantirFixasEspelho()[g.espelhoParAtivo]=[];limparResultadoEspelho();atualizarEspelhoLotofacil();});
    }
    atualizarEspelhoLotofacil();
  }

  function buildMegaGerador(jogo0){
    var g = GERADORES[jogo0], cfg = LOTERIAS[jogo0];
    var crits = document.getElementById(g.ids.crits);
    if (crits && !crits.children.length){
      (CRITERIOS_POR_JOGO[jogo0] || Object.keys(MEGA_CRITERIOS)).forEach(function(k){
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn critbtn" + (k === g.criterio ? " on" : "");
        b.dataset.crit = k;
        var dica = (DICA_ESPECIAL[jogo0] && DICA_ESPECIAL[jogo0][k]) || MEGA_CRITERIOS[k].dica;
        b.innerHTML = '<b>' + MEGA_CRITERIOS[k].rot + '</b><small>' +
                      dica.replace("{N}", cfg.total) + '</small>';
        crits.appendChild(b);
      });
      crits.addEventListener("click", function(ev){
        var el = ev.target.closest(".critbtn");
        if (!el) return;
        g.criterio = el.dataset.crit;
        g.janelaAnalise = null;       // clique manual volta ao histórico inteiro
        for (var i = 0; i < crits.children.length; i++)
          crits.children[i].classList.toggle("on", crits.children[i].dataset.crit === g.criterio);
        atualizarNotaGerador(jogo0);
        megaGerarJogos(jogo0);
      });
    }
    // Nas loterias com repetirOpcoes, o apostador escolhe uma quantidade exata
    // de repetidas; configurações antigas ainda podem usar o interruptor de peso.
    var evitarBox = document.getElementById(g.ids.evitar);
    if (evitarBox && !evitarBox.children.length){
      if (g.repetirOpcoes){
        [{v:"",rot:"Livre",dica:"sem quantidade obrigatória"}].concat(g.repetirOpcoes.map(function(n){
          return {v:String(n),rot:n+" repetida"+(n===1?"":"s"),dica:"quantidade exata do último"};
        })).forEach(function(op){
          var rb = document.createElement("button");
          rb.type="button"; rb.className="btn critbtn"; rb.dataset.rep=op.v;
          rb.innerHTML='<b>'+op.rot+'</b><small>'+op.dica+'</small>'; evitarBox.appendChild(rb);
        });
        evitarBox.addEventListener("click",function(ev){
          var el=ev.target.closest(".critbtn"); if(!el)return;
          if(el.disabled)return;
          g.repetirAlvo=el.dataset.rep === "" ? null : +el.dataset.rep;
          for(var ri=0;ri<evitarBox.children.length;ri++)
            evitarBox.children[ri].classList.toggle("on",evitarBox.children[ri].dataset.rep === el.dataset.rep);
          megaGerarJogos(jogo0);
        });
        for(var ri0=0;ri0<evitarBox.children.length;ri0++)
          evitarBox.children[ri0].classList.toggle("on",evitarBox.children[ri0].dataset.rep ===
            (g.repetirAlvo === null ? "" : String(g.repetirAlvo)));
        paintCustos(jogo0);
      } else {
        var be = document.createElement("button");
        be.type = "button"; be.className = "btn critbtn" + (g.evitarUltimo ? " on" : "");
        be.innerHTML = '<span class="critrow"><b>' + EVITAR_REPETIDAS.rot + '</b>' +
          '<i class="infoc" title="' + EVITAR_REPETIDAS.info.replace(/"/g, "&quot;") + '">ⓘ</i></span>' +
          '<small>' + EVITAR_REPETIDAS.dica + '</small>';
        evitarBox.appendChild(be);
        evitarBox.addEventListener("click", function(){
          g.evitarUltimo = !g.evitarUltimo;
          be.classList.toggle("on", g.evitarUltimo);
          megaGerarJogos(jogo0);
        });
      }
    }
    // apostar contra partes do volante (só onde o card oferece o seletor)
    var exc = document.getElementById(g.ids.exc);
    if (exc && !exc.dataset.lig){
      exc.dataset.lig="1";
      exc.addEventListener("click", function(ev){
        var scope=ev.target.closest("[data-ex-scope]");
        if(scope){g.excEscopo=scope.dataset.exScope;renderExcluir(jogo0);return;}
        var game=ev.target.closest("[data-ex-game]");
        if(game){g.excJogo=+game.dataset.exGame;renderExcluir(jogo0);return;}
        if(ev.target.closest("[data-ex-clear]")){
          if(g.excEscopo==="jogo")g.excluirPorJogo[g.excJogo]={};else g.excluir={};
          renderExcluir(jogo0);megaGerarJogos(jogo0);return;
        }
        var el=ev.target.closest("[data-ex-key]");if(!el||el.disabled)return;
        var mapa=mapaExclusaoEditado(g),chave=el.dataset.exKey,estava=!!mapa[chave];
        if(estava)delete mapa[chave];else mapa[chave]=true;
        if(capacidadeMinima(jogo0)<g.dezenas){
          if(estava)mapa[chave]=true;else delete mapa[chave];
            toast("Sobrariam menos de " + g.dezenas + " dezenas para montar o jogo");
        }else{
          megaGerarJogos(jogo0);
        }
        renderExcluir(jogo0);
      });
      renderExcluir(jogo0);
    }
    // dezenas por jogo: aposta múltipla dentro do limite do volante oficial
    var dez = document.getElementById(g.ids.dez);
    if (dez && !dez.children.length){
      for (var nd = cfg.escolher; nd <= cfg.maxDezenas; nd++){
        var bd = document.createElement("button");
        bd.type = "button"; bd.className = "btn sizebtn";
        bd.dataset.n = nd;
        bd.innerHTML = '<b>' + nd + '</b><small></small>';
        dez.appendChild(bd);
      }
      dez.addEventListener("click", function(ev){
        var el = ev.target.closest(".sizebtn");
        if (!el) return;
        var novo = parseInt(el.dataset.n, 10);
        if (capacidadeMinima(jogo0) < novo){
          toast("As exclusões deixam somente " + capacidadeMinima(jogo0) + " dezenas livres em pelo menos um jogo");
          return;
        }
        g.dezenas = novo;
        paintCustos(jogo0);
        megaGerarJogos(jogo0);
      });
    }
    var qtd = document.getElementById(g.ids.qtd);
    if (qtd && !qtd.children.length){
      (jogo0==="lotofacil"?[1,2,4,6,8,10,12,15,17]:[1,2,4,6,8,10]).forEach(function(n){
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn sizebtn";
        b.dataset.n = n;
        b.innerHTML = '<b>' + n + (n > 1 ? ' jogos' : ' jogo') + '</b><small></small>';
        qtd.appendChild(b);
      });
      qtd.addEventListener("click", function(ev){
        var el = ev.target.closest(".sizebtn");
        if (!el) return;
        g.qtd = parseInt(el.dataset.n, 10);
        if(jogo0==="lotofacil")g.qtdNormal=g.qtd;
        if(g.ids.exc)renderExcluir(jogo0);
        paintCustos(jogo0);
        megaGerarJogos(jogo0);
      });
    }
    montarControleDiversidade(jogo0);
    if(jogo0==="lotofacil")montarEspelhoLotofacil();
    paintCustos(jogo0);
    var box = document.getElementById(g.ids.box);
    if (box && !box.dataset.lig){
      box.dataset.lig = "1";
      box.addEventListener("click", function(ev){
        var el = ev.target.closest("[data-copia]");
        if (el) copyText(el.dataset.copia, "Jogo copiado");
      });
    }
    var confBox = document.getElementById(g.ids.conf);
    if (confBox && !confBox.dataset.lig){
      confBox.dataset.lig = "1";
      confBox.addEventListener("click", function(ev){
        var el = ev.target.closest("[data-copia]");
        if (el) copyText(el.dataset.copia, "Jogo copiado");
      });
    }
    atualizarNotaGerador(jogo0);
    if (!g.jogos.length) megaGerarJogos(jogo0); else renderMegaJogos(jogo0);
  }

  // O texto deixa clara a diferença entre sorteio uniforme, perfil estrutural
  // e critérios que também usam o histórico das dezenas.
  function atualizarNotaGerador(jogo0){
    var g = GERADORES[jogo0], cfg = LOTERIAS[jogo0];
    var nota = document.getElementById(g.ids.nota);
    if (!nota) return;
    if(jogo0==="lotofacil"&&g.modalidade==="espelho"){
      nota.innerHTML='<b>Como funciona o espelho:</b> cada par tem suas próprias 5 dezenas fixas, compartilhadas somente por suas cartelas A e B. As outras 20 são divididas sem repetição entre elas, por isso cada par cobre as 25 dezenas. '+
        'Isso organiza a cobertura, mas não aumenta a chance individual de nenhuma cartela. Pares diferentes são novas apostas e aumentam o custo em R$ 7,00 cada.';
      return;
    }
    var chance = (100 * cfg.escolher / cfg.total).toFixed(1).replace(".", ",");
    var baseHistorica = g.janelaAnalise ? "os últimos <b>" + g.janelaAnalise + " concursos</b>" : "o histórico guardado";
    var textoFormato;
    if (g.criterio === "neutro"){
      textoFormato = " No <b>Sorteio puro</b>, todas as combinações disponíveis têm a mesma chance; " +
        "nenhuma regra de soma, linhas, frequência ou atraso é aplicada. Filtros de exclusão ou " +
        "repetição, quando ligados, continuam valendo.";
    } else if (g.criterio === "perfil"){
      textoFormato = " O <b>Perfil comum</b> considera somente distribuição pelo volante, " +
        "pares/ímpares e soma. Não usa frequência nem atraso das dezenas.";
    } else if (g.criterio === "quentes") {
      textoFormato = " Em <b>Mais frequentes</b>, o perfil comum é mantido e a escolha favorece " +
        "dezenas com mais aparições em " + baseHistorica + ", sem garantir que elas voltem a sair.";
    } else if (g.criterio === "frias") {
      textoFormato = " Em <b>Mais atrasadas</b>, o perfil comum é mantido e a escolha favorece " +
        "dezenas há mais concursos sem aparecer, considerando " + baseHistorica + ". Atraso não aumenta a chance matemática.";
    } else if (g.criterio === "menos") {
      textoFormato = " Em <b>Evitar frequentes</b>, o perfil comum é mantido e a escolha favorece " +
        "as dezenas com menos aparições em " + baseHistorica + ". Isso não torna as demais menos prováveis.";
    } else {
      textoFormato = " O <b>Misto histórico</b> usa o perfil comum e também favorece dezenas pela " +
        "frequência e pelo atraso em " + baseHistorica + ", sem excluir nenhuma delas.";
    }
    nota.innerHTML = textoSoma(jogo0) + "<br><br>" + g.nota + textoFormato +
      " Mas <b>formato não é previsão</b>: cada dezena tem <b>" + chance + "%</b> de chance (" +
      cfg.escolher + " de " + cfg.total + ") em qualquer concurso, tenha ela saído muito, pouco ou nada. " +
      "Os critérios mudam quais dezenas entram, não a probabilidade de acertar.";
  }

  /* ---------- resultado da Dia de Sorte: real ou simulado ---------- */
  // Mesma ideia do "Último resultado" da Lotofácil, mas independente: marca
  // as 7 dezenas + o mês (à mão, ou sorteando um resultado de mentira) para
  // conferir contra os jogos gerados, sem precisar esperar um concurso real.
  var dsDrawn = [];        // dezenas marcadas (reais ou simuladas)
  var dsDrawnMes = null;   // mês marcado, ou null
  var STORE_DS_DRAW = "diadesorte:sorteio";

  function dsInDraw(n){ return dsDrawn.indexOf(n) >= 0; }

  function buildDsDrawPick(){
    var box = document.getElementById("dsDrawPick");
    if (!box || box.children.length) return;
    var frag = document.createDocumentFragment();
    for (var n = 1; n <= 31; n++){
      var b = document.createElement("button");
      b.type = "button"; b.className = "dpick"; b.textContent = pad(n); b.dataset.n = n;
      b.setAttribute("aria-pressed", "false");
      frag.appendChild(b);
    }
    box.appendChild(frag);
    box.addEventListener("click", function(ev){
      var el = ev.target.closest(".dpick");
      if (el) toggleDsDrawn(parseInt(el.dataset.n, 10));
    });

    var mesBox = document.getElementById("dsDrawMes");
    if (mesBox && !mesBox.children.length){
      MESES.forEach(function(nome, i){
        var b = document.createElement("button");
        b.type = "button"; b.className = "vnum trevo"; b.dataset.m = i + 1;
        b.textContent = nome.slice(0, 3);
        mesBox.appendChild(b);
      });
      mesBox.addEventListener("click", function(ev){
        var el = ev.target.closest(".trevo");
        if (el) toggleDsMes(parseInt(el.dataset.m, 10));
      });
    }

    var salvo = null;
    try { salvo = JSON.parse(load(STORE_DS_DRAW) || "null"); } catch(e){}
    if (salvo){
      dsDrawn = (salvo.dezenas || []).filter(function(n){ return n >= 1 && n <= 31; }).sort(asc);
      dsDrawnMes = salvo.mes >= 1 && salvo.mes <= 12 ? salvo.mes : null;
    }
    atualizarDsSorteio();
  }

  function salvarDsDraw(){
    store(STORE_DS_DRAW, JSON.stringify({dezenas: dsDrawn, mes: dsDrawnMes}));
  }

  function toggleDsDrawn(n){
    var i = dsDrawn.indexOf(n);
    if (i >= 0){
      dsDrawn.splice(i, 1);
    } else {
      if (dsDrawn.length >= 7){ toast("O sorteio tem 7 dezenas"); return; }
      dsDrawn.push(n);
    }
    dsDrawn.sort(asc);
    salvarDsDraw();
    atualizarDsSorteio();
  }

  function toggleDsMes(m){
    dsDrawnMes = dsDrawnMes === m ? null : m;   // clicar de novo desmarca
    salvarDsDraw();
    atualizarDsSorteio();
  }

  function limparDsDraw(){
    if (!dsDrawn.length && !dsDrawnMes) return;
    dsDrawn = []; dsDrawnMes = null;
    try { localStorage.removeItem(STORE_DS_DRAW); } catch(e){}
    atualizarDsSorteio();
    toast("Resultado apagado");
  }

  // Sorteia um resultado FAKE (uniforme, sem nenhum critério) pra testar a
  // aderência dos jogos gerados sem esperar um concurso real sair.
  function sortearDsDraw(){
    var pool = [];
    for (var n = 1; n <= 31; n++) pool.push(n);
    dsDrawn = shuffled(pool).slice(0, 7).sort(asc);
    dsDrawnMes = 1 + randomInt(12);
    salvarDsDraw();
    atualizarDsSorteio();
    toast("Resultado sorteado (fake) — não é um concurso real");
  }

  function atualizarDsSorteio(){
    paintDsDrawPick();
    if (GERADORES.diadesorte.jogos.length) renderMegaJogos("diadesorte");   // acertos nos jogos
    renderDsBalanco();
  }

  function paintDsDrawPick(){
    var box = document.getElementById("dsDrawPick");
    if (!box) return;
    var cheio = dsDrawn.length === 7;
    for (var i = 0; i < box.children.length; i++){
      var el = box.children[i], n = parseInt(el.dataset.n, 10);
      var on = dsInDraw(n);
      el.classList.toggle("on", on);
      el.classList.toggle("locked", cheio && !on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }
    var mesBox = document.getElementById("dsDrawMes");
    if (mesBox) for (var j = 0; j < mesBox.children.length; j++)
      mesBox.children[j].classList.toggle("on", +mesBox.children[j].dataset.m === dsDrawnMes);
    renderDsDrawStatus();
  }

  function renderDsDrawStatus(){
    var el = document.getElementById("dsDrawStatus");
    if (!el) return;
    if (!dsDrawn.length && !dsDrawnMes){
      el.innerHTML = '<span class="muted">Nenhuma dezena marcada — clique nas 7 sorteadas e no mês, ' +
        'ou use "Sortear resultado"</span>';
      return;
    }
    var falta = [];
    if (dsDrawn.length < 7) falta.push((7 - dsDrawn.length) + (dsDrawn.length === 6 ? ' dezena' : ' dezenas'));
    if (!dsDrawnMes) falta.push('o mês');
    if (falta.length){
      el.innerHTML = 'Marcadas: <b>' + dsDrawn.length + '/7</b>' +
        (dsDrawnMes ? ' · mês: <b>' + nomeTrevo("diadesorte", dsDrawnMes) + '</b>' : '') +
        '<span class="muted"> · falta ' + falta.join(" e ") + '</span>';
      return;
    }
    var txt = 'Marcadas: <b>7/7</b> · mês: <b>' + nomeTrevo("diadesorte", dsDrawnMes) + '</b>';
    var g = GERADORES.diadesorte, jogos = g.jogos;
    if (jogos.length){
      var n = 0;
      for (var k = 0; k < jogos.length; k++){
        var ac = 0, j;
        for (j = 0; j < jogos[k].length; j++) if (dsInDraw(jogos[k][j])) ac++;
        var tv = (g.trevos[k] || []).indexOf(dsDrawnMes) >= 0 ? 1 : 0;
        if (FAIXAS_TESTE.diadesorte(ac) || tv) n++;
      }
      txt += '<span class="muted"> · ' + (n
        ? '<b>' + n + '</b> dos ' + jogos.length + ' jogos ficaram em faixa premiada'
        : 'nenhum dos ' + jogos.length + ' jogos chegou a premiar') + '</span>';
    } else {
      txt += '<span class="muted"> · gere jogos para conferir</span>';
    }
    el.innerHTML = txt;
  }

  // Prêmios fixos como múltiplos do preço da aposta simples (R$ 2,50), no
  // mesmo esquema da Lotofácil: 4 acertos = 2×, 5 acertos = 10×, mês certo = 1×.
  // 6 e 7 acertos são rateio e variam — ficam editáveis, com o concurso 1291
  // (o mais recente com as duas faixas pagas ao mesmo tempo) como referência.
  var STORE_DS_PREMIOS = "diadesorte:premios";
  var DS_PREMIO_FIXO = {4:2, 5:10, mes:1};
  var DS_PREMIO_RATEIO_PADRAO = {6:2093.16, 7:701249.51};
  var dsPremios = {};

  function dsPremioFixo(faixa){ return !!DS_PREMIO_FIXO[faixa]; }

  function dsPremioDe(faixa){
    if (dsPremioFixo(faixa)) return DS_PREMIO_FIXO[faixa] * PRECOS.diadesorte;
    var v = dsPremios[faixa];
    return (typeof v === "number" && isFinite(v) && v >= 0) ? v : DS_PREMIO_RATEIO_PADRAO[faixa];
  }

  function renderDsBalanco(){
    var card = document.getElementById("dsBalanceCard"), box = document.getElementById("dsBalanceBox");
    if (!card || !box) return;
    var g = GERADORES.diadesorte, jogos = g.jogos;
    if (!jogos.length || dsDrawn.length !== 7 || !dsDrawnMes){
      card.hidden = true;
      box.innerHTML = "";      // não guarda balanço velho escondido
      return;
    }

    var porFaixa = {}, premiados = 0, investido = 0;
    for (var k = 0; k < jogos.length; k++){
      var ac = 0, j;
      for (j = 0; j < jogos[k].length; j++) if (dsInDraw(jogos[k][j])) ac++;
      var tv = (g.trevos[k] || []).indexOf(dsDrawnMes) >= 0 ? 1 : 0;
      investido += custoJogo("diadesorte", jogos[k].length);
      // aposta múltipla: cada faixa recebe os jogos simples do desdobramento
      var mapa = premiosDesdobrados("diadesorte", jogos[k].length, ac, tv), pegou = false;
      for (var fx in mapa){ porFaixa[fx] = (porFaixa[fx] || 0) + mapa[fx]; pegou = true; }
      if (pegou) premiados++;
    }

    var recebido = 0, linhas = "";
    ["7", "6", "5", "4", "mes"].forEach(function(faixa){
      var qtd = porFaixa[faixa] || 0;
      if (!qtd) return;
      var unit = dsPremioDe(faixa);
      recebido += qtd * unit;
      linhas +=
        '<tr>' +
          '<td>' + (faixa === "mes" ? "Mês certo" : faixa + " acertos") + '</td>' +
          '<td>' + qtd + (qtd > 1 ? ' jogos' : ' jogo') + '</td>' +
          '<td>' + (dsPremioFixo(faixa)
            ? '<span class="fixo">' + brl(unit) + '<small>prêmio fixo · ' + DS_PREMIO_FIXO[faixa] + '× a aposta</small></span>'
            : '<span class="moneyIn small"><span>R$</span>' +
              '<input type="number" min="0" step="0.01" data-dsfaixa="' + faixa + '" value="' + unit.toFixed(2) + '">' +
              '</span><small class="rateio">rateio — varia</small>') + '</td>' +
          '<td class="right"><b>' + brl(qtd * unit) + '</b></td>' +
        '</tr>';
    });

    if (!premiados){
      linhas = '<tr><td colspan="4" class="muted">Nenhum jogo chegou a premiar neste sorteio.</td></tr>';
    }

    var saldo = recebido - investido;
    box.innerHTML =
      '<div class="tablewrap"><table class="balance"><tbody>' + linhas + '</tbody></table></div>' +
      '<div class="totais">' +
        '<div><span>Recebido</span><b class="' + (recebido > 0 ? "pos" : "") + '">' + brl(recebido) + '</b></div>' +
        '<div><span>Investido (' + jogos.length + ' jogos)</span><b>' + brl(investido) + '</b></div>' +
        '<div class="saldo"><span>Saldo</span><b class="' + (saldo >= 0 ? "pos" : "neg") + '">' +
          (saldo >= 0 ? "+" : "−") + brl(Math.abs(saldo)) + '</b></div>' +
      '</div>';
    card.hidden = false;
  }

  /* ---------- minhas apostas: salvar e conferir sozinho ---------- */
  var STORE_APOSTAS = "loterias:apostas";
  var PRECOS = {lotofacil: 3.50, megasena: 6.00, maismilionaria: 6.00, quina: 3.00, diadesorte: 2.50};

  function histDe(loteria){ return HISTORICOS[loteria].hist; }

  function lerApostas(){
    try { return JSON.parse(load(STORE_APOSTAS) || "[]"); } catch(e){ return []; }
  }
  function salvarApostas(lista){ store(STORE_APOSTAS, JSON.stringify(lista)); }

  function hojeBR(){
    var d = new Date();
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function escHtml(valor){
    return String(valor == null ? "" : valor).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function proximoNomeAposta(loteria){
    var lista=lerApostas(),usados={},i,n=1;
    for(i=0;i<lista.length;i++)if(lista[i].loteria===loteria&&lista[i].nome)usados[String(lista[i].nome).toLowerCase()]=true;
    while(usados[("Aposta "+n).toLowerCase()])n++;
    return "Aposta "+n;
  }

  var salvarPendente=null;
  function fecharModalAposta(){
    var modal=document.getElementById("saveBetModal");if(modal)modal.hidden=true;salvarPendente=null;
  }

  function abrirModalSalvarAposta(loteria,jogos,trevos){
    if(!jogos||!jogos.length){toast("Gere os jogos primeiro");return;}
    salvarPendente={tipo:"salvar",loteria:loteria,jogos:jogos.map(function(j){return j.slice();}),
      trevos:trevos?trevos.map(function(t){return t.slice();}):null};
    var modal=document.getElementById("saveBetModal"),titulo=document.getElementById("saveBetTitle"),
      contexto=document.getElementById("saveBetContext"),input=document.getElementById("saveBetName");
    if(!modal||!input)return;
    if(titulo)titulo.textContent="Nomear carteira";
    if(contexto)contexto.textContent=jogos.length+" "+(jogos.length===1?"jogo":"jogos")+" da "+NOMES_JOGO[loteria]+" serão guardados juntos.";
    input.value=proximoNomeAposta(loteria);modal.hidden=false;input.focus();input.select();
  }

  function abrirModalRenomearAposta(id){
    var lista=lerApostas(),ap=null;for(var i=0;i<lista.length;i++)if(lista[i].id===id){ap=lista[i];break;}
    if(!ap)return;salvarPendente={tipo:"renomear",id:id};
    var modal=document.getElementById("saveBetModal"),titulo=document.getElementById("saveBetTitle"),
      contexto=document.getElementById("saveBetContext"),input=document.getElementById("saveBetName");
    if(!modal||!input)return;
    if(titulo)titulo.textContent="Renomear carteira";
    if(contexto)contexto.textContent=NOMES_JOGO[ap.loteria]+" · "+ap.jogos.length+" "+(ap.jogos.length===1?"jogo":"jogos");
    input.value=ap.nome||"Aposta sem nome";modal.hidden=false;input.focus();input.select();
  }

  function confirmarNomeAposta(){
    if(!salvarPendente)return;
    var input=document.getElementById("saveBetName"),nome=(input?input.value:"").trim().slice(0,40);
    if(!nome){toast("Digite um nome para a carteira");if(input)input.focus();return;}
    if(salvarPendente.tipo==="renomear"){
      var lista=lerApostas();for(var i=0;i<lista.length;i++)if(lista[i].id===salvarPendente.id){lista[i].nome=nome;break;}
      salvarApostas(lista);fecharModalAposta();renderApostas();toast("Carteira renomeada");return;
    }
    var p=salvarPendente;fecharModalAposta();salvarAposta(p.loteria,p.jogos,p.trevos,nome);
  }

  // Guarda a aposta mirando o próximo concurso ainda não sorteado.
  function salvarAposta(loteria, jogos, trevos, nome){
    if(nome===undefined){abrirModalSalvarAposta(loteria,jogos,trevos);return;}
    var h = histDe(loteria);
    var alvo = h.length ? h[0].concurso + 1 : null;
    var lista = lerApostas();
    lista.unshift({
      id: "a" + Date.now(),
      nome: nome,
      loteria: loteria,
      criado: hojeBR(),
      alvo: alvo,
      preco: custoJogo(loteria, jogos[0].length),   // aposta múltipla custa C(n,esc) × simples
      jogos: jogos.map(function(j){ return j.slice(); }),
      trevos: trevos ? trevos.map(function(t){ return t.slice(); }) : null,
      modalidade: loteria==="lotofacil"&&GERADORES.lotofacil.modalidade==="espelho"?"espelho":"normal",
      espelhoFixasPorPar: loteria==="lotofacil"&&GERADORES.lotofacil.modalidade==="espelho"?
        garantirFixasEspelho().slice(0,GERADORES.lotofacil.espelhoPares).map(function(x){return x.slice();}):null
    });
    salvarApostas(lista);
    toast(nome+": "+jogos.length + (jogos.length > 1 ? " jogos salvos" : " jogo salvo") + " para o concurso " + alvo);
    renderApostas();
  }

  // Confere uma aposta contra o concurso alvo, se ele já existir no histórico.
  function premioMaximoAtingido(loteria,acertos,extras){
    if(loteria==="maismilionaria")return acertos===LOTERIAS[loteria].escolher&&extras===LOTERIAS[loteria].escolherTrevos;
    return acertos===LOTERIAS[loteria].escolher;
  }

  function conferirAposta(ap){
    var h = histDe(ap.loteria), i;
    var sorteio = null;
    for (i = 0; i < h.length; i++) if (h[i].concurso === ap.alvo){ sorteio = h[i]; break; }
    if (!sorteio) return null;

    var resultado = {sorteio: sorteio, linhas: [], recebido: 0, distribuicao:{}, melhor:-1, melhorExtra:-1,
      melhores:[], maximos:[], premiados:0, somaAcertos:0, rateioPendente:false};
    for (i = 0; i < ap.jogos.length; i++){
      var jogo = ap.jogos[i], acertos = 0, j;
      for (j = 0; j < jogo.length; j++) if (sorteio.dezenas.indexOf(jogo[j]) >= 0) acertos++;

      var tv = 0;
      if (LOTERIAS[ap.loteria].trevos){
        var meus = (ap.trevos && ap.trevos[i]) || [];
        for (j = 0; j < meus.length; j++) if ((sorteio.trevos || []).indexOf(meus[j]) >= 0) tv++;
      }
      // melhor faixa do jogo (para exibir) e desdobramento (para somar o prêmio)
      var faixa = FAIXAS_TESTE[ap.loteria](acertos, tv);
      var premio = 0, mapa = premiosDesdobrados(ap.loteria, jogo.length, acertos, tv),temPremio=false,premioPendente=false;
      for (var fx in mapa){
        temPremio=true;
        if (sorteio.premios && sorteio.premios[fx]) premio += mapa[fx] * sorteio.premios[fx];
        else premioPendente=true;
      }
      resultado.recebido += premio;resultado.somaAcertos+=acertos;
      if(premioPendente)resultado.rateioPendente=true;
      var maximo=premioMaximoAtingido(ap.loteria,acertos,tv);
      resultado.distribuicao[acertos]=(resultado.distribuicao[acertos]||0)+1;
      if(temPremio)resultado.premiados++;
      if(maximo)resultado.maximos.push(i);
      resultado.linhas.push({jogo: jogo, acertos: acertos, trevos: tv, faixa: faixa, premio: premio,premiada:temPremio,maximo:maximo,rateioPendente:premioPendente});
    }
    for(i=0;i<resultado.linhas.length;i++){
      var lin=resultado.linhas[i],extraRelevante=ap.loteria==="maismilionaria"?lin.trevos:0;
      if(lin.acertos>resultado.melhor||(lin.acertos===resultado.melhor&&extraRelevante>resultado.melhorExtra)){
        resultado.melhor=lin.acertos;resultado.melhorExtra=extraRelevante;resultado.melhores=[i];
      }else if(lin.acertos===resultado.melhor&&extraRelevante===resultado.melhorExtra)resultado.melhores.push(i);
    }
    resultado.investido = ap.jogos.length * ap.preco;
    resultado.saldo = resultado.recebido - resultado.investido;
    resultado.media = resultado.somaAcertos / ap.jogos.length;
    var ordenados=resultado.linhas.map(function(x){return x.acertos;}).sort(asc),meio=Math.floor(ordenados.length/2);
    resultado.mediana=ordenados.length%2?ordenados[meio]:(ordenados[meio-1]+ordenados[meio])/2;
    resultado.esperada=ap.jogos.reduce(function(s,jogo){return s+jogo.length*LOTERIAS[ap.loteria].escolher/LOTERIAS[ap.loteria].total;},0)/ap.jogos.length;
    return resultado;
  }

  function renderApostas(){
    var lista = lerApostas();
    var box = document.getElementById("apostasLista");
    var resumo = document.getElementById("apostasResumo");
    var acoes = document.getElementById("apostasAcoes");
    if (!box) return;

    var tag = document.getElementById("apostasTag");
    if (tag) tag.textContent = lista.length ? lista.length + (lista.length > 1 ? " carteiras" : " carteira") : "vazio";

    if (!lista.length){
      resumo.innerHTML = "";
      box.innerHTML = '<p class="resumoCob">Nenhuma carteira salva ainda. Gere jogos em qualquer loteria ' +
                      'e use o botão <b>“Salvar aposta”</b>.</p>';
      if (acoes) acoes.hidden = true;
      return;
    }

    var totInv = 0, totRec = 0, conferidas = 0, html = "";
    for (var k = 0; k < lista.length; k++){
      var ap = lista[k], r = conferirAposta(ap);
      var nomeAposta=ap.nome||"Aposta sem nome";
      var inv = ap.jogos.length * ap.preco;
      totInv += inv;
      if (r){ totRec += r.recebido; conferidas++; }

      html += '<div class="aposta ' + (r ? (r.saldo >= 0 ? "ok" : "conf") : "aberta") + '">' +
        '<div class="apostatopo">' +
          '<div class="aposta-ident"><span class="bet-lottery">' + NOMES_JOGO[ap.loteria] + '</span><b>' + escHtml(nomeAposta) + '</b>' +
            '<small>' + (ap.modalidade==="espelho"?(ap.jogos.length/2)+' pares · ':'')+ap.jogos.length + (ap.jogos.length > 1 ? " jogos" : " jogo") +
            ' · concurso ' + ap.alvo + ' · salva em ' + ap.criado + '</small></div>' +
          '<div class="apostaacoes">' +
            '<span class="stat">' + brl(inv) + '</span>' +
            '<button class="btn small" type="button" data-renomear="' + ap.id + '">Renomear</button>' +
            '<button class="btn small" type="button" data-copiar="' + ap.id + '">Copiar</button>' +
            '<button class="btn small" type="button" data-apagar="' + ap.id + '">Apagar</button>' +
          '</div>' +
        '</div>';

      if (!r){
        html += '<p class="resumoCob">Aguardando o sorteio do concurso <b>' + ap.alvo + '</b>. ' +
                'Rode <code>python3 atualizar.py</code> depois que ele sair.</p>';
      } else {
        html += '<div class="saved-draw-result"><div class="saved-draw-copy"><small>Resultado do concurso</small><p class="resumoCob">Sorteio ' + r.sorteio.concurso + ' (' + r.sorteio.data + '): <b>' +
                r.sorteio.dezenas.map(pad).join(" ") + '</b>' +
                (r.sorteio.trevos ? ' · ' + tituloTrevo(ap.loteria).toLowerCase() + ' <b>' +
                  listaTrevos(ap.loteria, r.sorteio.trevos) + '</b>' : '') +
                (r.sorteio.provisorio?' · <span class="result-pending">resultado confirmado; rateio provisório</span>':'')+'</p></div><div class="saved-draw-mini">'+
                miniVolante(r.sorteio.dezenas,LOTERIAS[ap.loteria],{acertos:r.sorteio.dezenas})+'</div></div>';
        var rotuloSalvo=function(x){return ap.modalidade==="espelho"?"Par "+(Math.floor(x/2)+1)+(x%2?" B":" A"):"Jogo "+(x+1);};
        var melhores=r.melhores.map(rotuloSalvo).join(", ");
        var distChips="";Object.keys(r.distribuicao).map(Number).sort(asc).forEach(function(pontos){
          var emFaixa=r.linhas.some(function(l){return l.acertos===pontos&&l.premiada;});
          distChips+='<span class="result-chip'+(emFaixa?' premiado':'')+'"><b>'+pontos+'</b> pontos · '+r.distribuicao[pontos]+'×</span>';
        });
        html+='<div class="saved-result-summary"><div><small>Melhor resultado</small><b>'+r.melhor+' pontos'+
          (ap.loteria==="maismilionaria"?' + '+r.melhorExtra+' trevo(s)':'')+'</b><span>'+melhores+'</span></div>'+
          '<div><small>Cartelas premiadas</small><b>'+r.premiados+' de '+ap.jogos.length+'</b><span>neste concurso</span></div>'+
          '<div><small>Desempenho da carteira</small><b>'+dsFmt1(r.media)+' pontos em média</b><span>mediana '+dsFmt1(r.mediana)+' · referência aleatória '+dsFmt1(r.esperada)+'</span></div>'+
          (r.maximos.length?'<strong>★ Prêmio máximo em '+r.maximos.map(rotuloSalvo).join(", ")+'</strong>':'')+
          (r.rateioPendente?'<span class="result-pending">Há prêmio com rateio ainda não publicado; o valor recebido é parcial.</span>':'')+
          '<div class="saved-result-dist">'+distChips+'</div></div>';
      }

      html += '<div class="apostajogos">';
      for (var i = 0; i < ap.jogos.length; i++){
        var lin = r ? r.linhas[i] : null;
        var fixasDoPar=ap.espelhoFixasPorPar&&ap.espelhoFixasPorPar[Math.floor(i/2)]||ap.espelhoFixas||[];
        html += '<div class="apostajogo' + (lin && lin.premiada ? " premiado" : "") +
          (r&&r.melhores.indexOf(i)>=0?' melhor':'')+(lin&&lin.maximo?' maximo':'')+'">' +
          '<span class="game-index">'+(ap.modalidade==="espelho"?'Par '+(Math.floor(i/2)+1)+(i%2?' B':' A'):'Jogo '+(i+1))+'</span><div class="saved-game-picks"><span class="dz">' + ap.jogos[i].map(function(n){
              var bateu = r && r.sorteio.dezenas.indexOf(n) >= 0;
              var fixa=ap.modalidade==="espelho"&&fixasDoPar.indexOf(n)>=0;
              return '<i class="' + (bateu ? "hit " : "")+(fixa?"fixed":"") + '">' + pad(n) + '</i>';
            }).join("") + '</span>' +
          (ap.trevos && ap.trevos[i] ? '<span class="tv">' + tituloTrevo(ap.loteria).toLowerCase() + ' ' +
            listaTrevos(ap.loteria, ap.trevos[i]) + '</span>' : '') +
          (lin ? '<span class="res">' + lin.acertos + ' acertos' +
                 (LOTERIAS[ap.loteria].escolherTrevos === 2 ? " + " + lin.trevos + " trevos" : "") +
                 (lin.maximo ? ' · <b>PRÊMIO MÁXIMO</b>' : '') +
                 (lin.premio ? ' · <b>' + brl(lin.premio) + '</b>'
                  : lin.faixa ? ' · <b>faixa premiada</b> <small>(rateio ainda não publicado)</small>' : '') +
                 '</span>' : '') +'</div><div class="saved-mini">'+
          miniVolante(ap.jogos[i],LOTERIAS[ap.loteria],{acertos:r?r.sorteio.dezenas:[],fixas:ap.modalidade==="espelho"?fixasDoPar:[]})+'</div>'+
        '</div>';
      }
      html += '</div>';

      if (r){
        html += '<div class="totais"><div><span>'+(r.rateioPendente?'Recebido calculado':'Recebido')+'</span><b class="' + (r.recebido ? "pos" : "") + '">' +
                brl(r.recebido) + '</b></div><div><span>Investido</span><b>' + brl(r.investido) + '</b></div>' +
                '<div class="saldo"><span>Saldo</span><b class="' + (r.saldo >= 0 ? "pos" : "neg") + '">' +
                (r.saldo >= 0 ? "+" : "\u2212") + brl(Math.abs(r.saldo)) + '</b></div></div>';
      }
      html += '</div>';
    }
    box.innerHTML = html;

    var saldo = totRec - totInv;
    resumo.innerHTML = '<div class="totais"><div><span>Investido no total</span><b>' + brl(totInv) + '</b></div>' +
      '<div><span>Recebido</span><b class="' + (totRec ? "pos" : "") + '">' + brl(totRec) + '</b></div>' +
      '<div class="saldo"><span>Saldo</span><b class="' + (saldo >= 0 ? "pos" : "neg") + '">' +
      (saldo >= 0 ? "+" : "\u2212") + brl(Math.abs(saldo)) + '</b></div></div>' +
      '<p class="hint">' + conferidas + ' de ' + lista.length + ' carteira(s) já conferida(s).</p>';
    if (acoes) acoes.hidden = !conferidas;
  }

  function apagarAposta(id){
    var lista = lerApostas().filter(function(a){ return a.id !== id; });
    salvarApostas(lista);
    renderApostas();
    toast("Aposta apagada");
  }

  function textoAposta(ap){
    var linhas = [(ap.nome||"Aposta sem nome")+" · "+NOMES_JOGO[ap.loteria] + " · concurso " + ap.alvo];
    for (var i = 0; i < ap.jogos.length; i++){
      linhas.push((ap.modalidade==="espelho"?"Par "+(Math.floor(i/2)+1)+(i%2?" B":" A"):"Jogo "+(i+1)) + ": " + ap.jogos[i].map(pad).join(" ") +
        (ap.trevos && ap.trevos[i]
          ? "  | " + tituloTrevo(ap.loteria).toLowerCase() + ": " + listaTrevos(ap.loteria, ap.trevos[i])
          : ""));
    }
    linhas.push("Total: " + brl(ap.jogos.length * ap.preco));
    return linhas.join("\n");
  }

  /* ---------- navegação: header + menu lateral ---------- */
  // Cada página junta cards que já existem no HTML — eles são movidos para cá
  // na inicialização, então todos os ids e ouvintes continuam valendo.
  var PAGINAS = [
    {id:"inicio",      jogo:"geral",          grupo:"Geral",       rot:"Visão geral", ic:"inicio",
     sub:"Acesse rapidamente os geradores, análises e jogos que você salvou.",
     cards:["homeCard"]},
    {id:"apostas",     jogo:"geral",          grupo:"Geral",       rot:"Minhas apostas", ic:"conferir",
     sub:"Os jogos que você salvou, conferidos automaticamente quando o concurso sai.",
     cards:["apostasCard"]},
    {id:"lf-gerador",  jogo:"lotofacil",      grupo:"Lotofácil",   rot:"Gerador", ic:"gerador",
     sub:"Gere os jogos e, logo abaixo, confira contra o sorteio para comparar.",
     cards:["lfGenCard","drawCard","balanceCard"]},
    {id:"lf-analise",  jogo:"lotofacil",      grupo:"Lotofácil",   rot:"Análise", ic:"mapa",
     sub:"Frequência, atraso, repetição e recomendação testada nos concursos anteriores.",
     cards:["lfAnalysisCard"]},
    {id:"lf-sorteios", jogo:"lotofacil",      grupo:"Lotofácil",   rot:"Sorteios", ic:"mapa",
     sub:"Navegue pelos concursos e veja como a cartela foi preenchida.",
     cards:["lfDrawCard","lfAggCard"]},
    {id:"lf-mapa",     jogo:"lotofacil",      grupo:"Lotofácil",   rot:"Mapa de calor", ic:"mapa",
     sub:"Frequência e sequências dos últimos concursos, com geração por critério.",
     cards:["heatCard"]},
    {id:"sobre",       jogo:"lotofacil",      grupo:"Lotofácil",   rot:"Sobre os números", ic:"sobre",
     sub:"O que dá e o que não dá para esperar dos números.",
     cards:["notesCard"]},

    {id:"mega-gerar",  jogo:"megasena",       grupo:"Mega-Sena",   rot:"Gerador", ic:"gerador",
     sub:"Jogos com o formato dos sorteios reais, no critério que você escolher.",
     cards:["megaGenCard"]},
    {id:"mega-analise",jogo:"megasena",       grupo:"Mega-Sena",   rot:"Análise", ic:"mapa",
     sub:"Frequência, atraso, repetição e recomendação testada nos concursos anteriores.",
     cards:["megaAnalysisCard"]},
    {id:"mega",        jogo:"megasena",       grupo:"Mega-Sena",   rot:"Volante", ic:"volante",
     sub:"Cartela 6×10 com a cruz central dividindo os quatro quadrantes.",
     cards:["outrasCard"]},
    {id:"mega-mapa",   jogo:"megasena",       grupo:"Mega-Sena",   rot:"Sorteios", ic:"mapa",
     sub:"Navegue pelos concursos e veja onde as dezenas caem no volante.",
     cards:["megaDrawCard","megaAggCard"]},

    {id:"mm-gerar",    jogo:"maismilionaria", grupo:"+Milionária", rot:"Gerador", ic:"gerador",
     sub:"Jogos no formato dos sorteios da +Milionária, com os trevos incluídos.",
     cards:["mmGenCard"]},
    {id:"mm-analise",  jogo:"maismilionaria", grupo:"+Milionária", rot:"Análise", ic:"mapa",
     sub:"Frequência, atraso, repetição, trevos e recomendação testada no histórico.",
     cards:["mmAnalysisCard"]},
    {id:"milionaria",  jogo:"maismilionaria", grupo:"+Milionária", rot:"Volante", ic:"volante",
     sub:"Cartela 10×5 dividida em metade de cima e metade de baixo, mais os trevos.",
     cards:["outrasCard"]},
    {id:"mm-mapa",     jogo:"maismilionaria", grupo:"+Milionária", rot:"Sorteios", ic:"mapa",
     sub:"Navegue pelos concursos e veja onde as dezenas e os trevos caem.",
     cards:["mmDrawCard","mmAggCard"]},

    {id:"quina-gerar", jogo:"quina",          grupo:"Quina",       rot:"Gerador", ic:"gerador",
     sub:"Jogos com o formato dos sorteios reais, no critério que você escolher.",
     cards:["quinaGenCard"]},
    {id:"quina-analise",jogo:"quina",         grupo:"Quina",       rot:"Análise", ic:"mapa",
     sub:"Frequência, atraso, repetição e recomendação em uma janela maior de concursos.",
     cards:["quinaAnalysisCard"]},
    {id:"quina",       jogo:"quina",          grupo:"Quina",       rot:"Volante", ic:"volante",
     sub:"Cartela 8×10 com a cruz central dividindo os quatro quadrantes.",
     cards:["outrasCard"]},
    {id:"quina-mapa",  jogo:"quina",          grupo:"Quina",       rot:"Sorteios", ic:"mapa",
     sub:"Navegue pelos concursos e veja onde as dezenas caem no volante.",
     cards:["quinaDrawCard","quinaAggCard"]},

    {id:"ds-gerar",    jogo:"diadesorte",     grupo:"Dia de Sorte", rot:"Gerador", ic:"gerador",
     sub:"Jogos no formato dos sorteios do Dia de Sorte, com o mês da sorte incluído.",
     cards:["dsGenCard","dsResultCard","dsBalanceCard"]},
    {id:"ds-analise",  jogo:"diadesorte",     grupo:"Dia de Sorte", rot:"Análise", ic:"mapa",
     sub:"Frequência, atraso, repetição e backtest usando apenas os concursos anteriores.",
     cards:["dsAnalysisCard"]},
    {id:"diasorte",    jogo:"diadesorte",     grupo:"Dia de Sorte", rot:"Volante", ic:"volante",
     sub:"Os 31 dias do mês organizados em semanas, mais o mês da sorte.",
     cards:["outrasCard"]},
    {id:"ds-mapa",     jogo:"diadesorte",     grupo:"Dia de Sorte", rot:"Sorteios", ic:"mapa",
     sub:"Navegue pelos concursos e veja onde as dezenas e o mês caem.",
     cards:["dsDrawCard","dsAggCard"]}
  ];

  var NOMES_JOGO = {geral:"Loterias",lotofacil:"Lotofácil", megasena:"Mega-Sena", maismilionaria:"+Milionária",
                    quina:"Quina", diadesorte:"Dia de Sorte"};

  var SIGLAS_JOGO = {geral:"◆",lotofacil:"LF", megasena:"MS", maismilionaria:"+M",
                     quina:"QN", diadesorte:"DS"};

  var ICONES = {
    inicio:   '<path d="M3 11.5L12 4l9 7.5M5.5 10v9h13v-9M9.5 19v-5h5v5"/>',
    gerador:  '<path d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z"/>',
    conferir: '<path d="M20 6L9 17l-5-5"/>',
    mapa:     '<path d="M3 20V10M8.5 20V4M14 20v-7M19.5 20V7"/>',
    sobre:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
    volante:  '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h2M11 10h2M15 10h2M7 14h2M11 14h2M15 14h2"/>'
  };
  var STORE_PAGINA = "lotofacil:pagina";
  var paginaAtual = "inicio";

  function montarPaginas(){
    var content = document.getElementById("content");
    if (!content) return;
    for (var i = 0; i < PAGINAS.length; i++){
      var pg = PAGINAS[i];
      var div = document.createElement("div");
      div.className = "page";
      div.id = "page-" + pg.id;
      div.hidden = true;
      content.appendChild(div);
      // move os cards já na montagem: se ficarem soltos no #content, aparecem
      // em todas as páginas (era assim que o volante da Lotofácil vazava).
      for (var k = 0; k < pg.cards.length; k++){
        var card = document.getElementById(pg.cards[k]);
        if (card) div.appendChild(card);
      }
    }
  }

  // O menu lateral escolhe a loteria; as páginas internas (Gerador, Análise,
  // Volante e Sorteios) ficam nas abas contextuais acima do conteúdo.
  var grupoAbertoMenu = null;

  function montarMenu(){
    var nav = document.getElementById("nav");
    if (!nav) return;
    var loterias=[
      {grupo:"Lotofácil",jogo:"lotofacil",pg:"lf-gerador"},
      {grupo:"Mega-Sena",jogo:"megasena",pg:"mega-gerar"},
      {grupo:"+Milionária",jogo:"maismilionaria",pg:"mm-gerar"},
      {grupo:"Quina",jogo:"quina",pg:"quina-gerar"},
      {grupo:"Dia de Sorte",jogo:"diadesorte",pg:"ds-gerar"}
    ];
    nav.innerHTML='<div class="navquick"><button type="button" class="navitem" data-pg="inicio"><svg viewBox="0 0 24 24" aria-hidden="true">'+
      ICONES.inicio+'</svg><span class="navrot">Visão geral</span></button><button type="button" class="navitem" data-pg="apostas">'+
      '<svg viewBox="0 0 24 24" aria-hidden="true">'+ICONES.conferir+'</svg><span class="navrot">Minhas apostas</span></button></div>'+
      '<span class="navcaption">Loterias</span>'+loterias.map(function(l){return '<button type="button" class="navlottery jogo-'+l.jogo+
      '" data-pg="'+l.pg+'" data-grupo="'+l.grupo+'"><span class="navgame-mark" aria-hidden="true">'+SIGLAS_JOGO[l.jogo]+
      '</span><span class="navlottery-copy"><b>'+l.grupo+'</b><small>Gerador e análises</small></span><svg viewBox="0 0 24 24" aria-hidden="true">'+
      '<path d="M9 18l6-6-6-6"/></svg></button>';}).join('');
    nav.addEventListener("click", function(ev){
      var el = ev.target.closest("[data-pg]");
      if (el) irPara(el.dataset.pg);
    });
  }

  function abrirGrupoMenu(nome){
    grupoAbertoMenu = nome;
    var itens=document.querySelectorAll(".navlottery");
    for(var i=0;i<itens.length;i++)itens[i].classList.toggle("on",itens[i].dataset.grupo===nome);
  }

  function montarTabsPagina(pg){
    var tabs=document.getElementById("pageTabs");if(!tabs)return;
    if(pg.grupo==="Geral"){tabs.hidden=true;tabs.innerHTML="";return;}
    var irmas=PAGINAS.filter(function(p){return p.grupo===pg.grupo;});
    tabs.hidden=false;tabs.innerHTML=irmas.map(function(p){return '<button type="button" class="pagetab'+(p.id===pg.id?' on':'')+
      '" data-tab-pg="'+p.id+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+(ICONES[p.ic]||ICONES.volante)+
      '</svg><span>'+p.rot+'</span></button>';}).join('');
    if(!tabs.dataset.lig){tabs.dataset.lig="1";tabs.addEventListener("click",function(ev){var b=ev.target.closest("[data-tab-pg]");if(b)irPara(b.dataset.tabPg);});}
  }

  function renderHome(){
    var card=document.getElementById("homeCard");if(!card)return;
    Object.keys(HISTORICOS).forEach(function(jogo){var h=HISTORICOS[jogo].hist,el=document.getElementById("homeLatest-"+jogo);
      if(el&&h.length)el.textContent="Concurso "+h[0].concurso+" · "+h[0].data;});
    if(!card.dataset.lig){card.dataset.lig="1";card.addEventListener("click",function(ev){var b=ev.target.closest("[data-home-page]");if(b)irPara(b.dataset.homePage);});}
  }

  function irPara(id){
    var pg = null, i;
    for (i = 0; i < PAGINAS.length; i++) if (PAGINAS[i].id === id) pg = PAGINAS[i];
    if (!pg) return;
    paginaAtual = id;
    store(STORE_PAGINA, id);

    var destino = document.getElementById("page-" + id);
    for (i = 0; i < pg.cards.length; i++){
      var card = document.getElementById(pg.cards[i]);
      if (card && card.parentNode !== destino) destino.appendChild(card);   // move, não recria
    }

    for (i = 0; i < PAGINAS.length; i++){
      var el = document.getElementById("page-" + PAGINAS[i].id);
      if (el) el.hidden = PAGINAS[i].id !== id;
    }
    var itens = document.querySelectorAll(".navitem");
    for (i = 0; i < itens.length; i++) itens[i].classList.toggle("on", itens[i].dataset.pg === id);
    abrirGrupoMenu(pg.grupo);
    montarTabsPagina(pg);

    // tema de cor conforme o jogo da página
    var app = document.getElementById("app");
    if (app) app.dataset.jogo = pg.jogo;
    var bt = document.getElementById("brandTitle"), bs = document.getElementById("brandSub");
    if (bt) bt.textContent = "Nexo";
    if (bs) bs.textContent = pg.jogo === "geral" ? "Análise e combinações" : NOMES_JOGO[pg.jogo] + " · " + pg.rot;
    var pt = document.getElementById("pageTitle");
    if (pt) pt.textContent = pg.rot === "Volante" ? NOMES_JOGO[pg.jogo] : pg.rot;
    var pill = document.getElementById("topPill");
    if (pill) pill.textContent = NOMES_JOGO[pg.jogo] + " · " + pg.rot;

    // o volante compartilhado (outrasCard) acompanha a página nessas 4 loterias
    if (VOLANTE_COMPARTILHADO.indexOf(pg.jogo) >= 0){
      if (loteriaAtual !== pg.jogo){ loteriaAtual = pg.jogo; lotTrevos = []; }
      buildLoteria();
    }
    if (id === "mega-mapa"){ renderSorteio("megasena"); renderAcumulado("megasena"); }
    if (id === "lf-gerador") buildMegaGerador("lotofacil");
    if (id === "mega-gerar") buildMegaGerador("megasena");
    if (id === "mm-gerar") buildMegaGerador("maismilionaria");
    if (id === "quina-gerar") buildMegaGerador("quina");
    if (id === "ds-gerar") buildMegaGerador("diadesorte");
    if (id === "ds-analise") buildDsAnalise();
    if (id === "lf-analise") buildAnaliseGeral("lotofacil");
    if (id === "mega-analise") buildAnaliseGeral("megasena");
    if (id === "mm-analise") buildAnaliseGeral("maismilionaria");
    if (id === "quina-analise") buildAnaliseGeral("quina");
    if (id === "inicio") renderHome();
    if (id === "apostas") renderApostas();
    if (id === "mm-mapa"){ renderSorteio("maismilionaria"); renderAcumulado("maismilionaria"); }
    if (id === "lf-sorteios"){ renderSorteio("lotofacil"); renderAcumulado("lotofacil"); }
    if (id === "quina-mapa"){ renderSorteio("quina"); renderAcumulado("quina"); }
    if (id === "ds-mapa"){ renderSorteio("diadesorte"); renderAcumulado("diadesorte"); }
    if (subtitulo) subtitulo.textContent = pg.sub;   // cada página tem o seu texto

    fecharMenu();
    window.scrollTo(0, 0);
  }

  function abrirMenu(){
    document.getElementById("sidebar").classList.add("aberto");
    var bd = document.getElementById("backdrop");
    if (bd) bd.hidden = false;
  }
  function fecharMenu(){
    var sb = document.getElementById("sidebar");
    if (sb) sb.classList.remove("aberto");
    var bd = document.getElementById("backdrop");
    if (bd) bd.hidden = true;
  }

  /* ---------- eventos ---------- */
  function onClick(id, fn){
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }
  onClick("btnClearDraw", limparSorteio);
  onClick("btnSortearDraw", sortearResultadoFake);
  onClick("btnSortearDs", sortearDsDraw);
  onClick("btnClearDs", limparDsDraw);
  onClick("dsRecommendation", dsGerarRecomendacao);

  if (loteriaBox){
    loteriaBox.addEventListener("click", function(ev){
      var el = ev.target.closest(".modobtn");
      if (!el) return;
      loteriaAtual = el.dataset.lot;
      for (var i = 0; i < loteriaBox.children.length; i++)
        loteriaBox.children[i].classList.toggle("on", loteriaBox.children[i].dataset.lot === loteriaAtual);
      lotTrevos = [];
      buildLoteria();
    });
  }
  if (loteriaGrid){
    loteriaGrid.addEventListener("click", function(ev){
      var el = ev.target.closest(".vnum");
      if (el) toggleLoteria(parseInt(el.dataset.n, 10));
    });
  }
  if (trevoGrid){
    trevoGrid.addEventListener("click", function(ev){
      var el = ev.target.closest(".vnum");
      if (el) toggleTrevo(parseInt(el.dataset.t, 10));
    });
  }
  var STORE_MENU = "lotofacil:menu";
  onClick("menuBtn", function(){
    var app = document.getElementById("app");
    var sb = document.getElementById("sidebar");
    if (window.matchMedia("(min-width:900px)").matches){
      app.classList.toggle("compacto");
      store(STORE_MENU, app.classList.contains("compacto") ? "1" : "0");
    } else if (sb && sb.classList.contains("aberto")) fecharMenu();
    else abrirMenu();
  });
  onClick("backdrop", fecharMenu);
  var apostasBox = document.getElementById("apostasLista");
  if (apostasBox){
    apostasBox.addEventListener("click", function(ev){
      var rn = ev.target.closest("[data-renomear]");
      if(rn){abrirModalRenomearAposta(rn.dataset.renomear);return;}
      var ap = ev.target.closest("[data-apagar]");
      if (ap){ apagarAposta(ap.dataset.apagar); return; }
      var cp = ev.target.closest("[data-copiar]");
      if (cp){
        var achou = lerApostas().filter(function(a){ return a.id === cp.dataset.copiar; })[0];
        if (achou) copyText(textoAposta(achou), "Aposta copiada");
      }
    });
  }
  onClick("saveBetCancel", fecharModalAposta);
  onClick("saveBetConfirm", confirmarNomeAposta);
  var saveBetName=document.getElementById("saveBetName");
  if(saveBetName)saveBetName.addEventListener("keydown",function(ev){
    if(ev.key==="Enter")confirmarNomeAposta();else if(ev.key==="Escape")fecharModalAposta();
  });
  var saveBetModal=document.getElementById("saveBetModal");
  if(saveBetModal)saveBetModal.addEventListener("click",function(ev){if(ev.target===saveBetModal)fecharModalAposta();});
  onClick("apostasLimparConf", function(){
    var restam = lerApostas().filter(function(a){ return !conferirAposta(a); });
    salvarApostas(restam);
    renderApostas();
    toast("Apostas conferidas apagadas");
  });

  onClick("salvarMega", function(){ salvarAposta("megasena", GERADORES.megasena.jogos, null); });

  function copiarTodosGerador(jogo0){
    var g = GERADORES[jogo0];
    if (!g.jogos.length) return;
    var linhas = g.jogos.map(function(j, i){
      var rot=jogo0==="lotofacil"&&g.modalidade==="espelho"?"Par "+(Math.floor(i/2)+1)+(i%2?" B":" A"):"Jogo "+(i+1);
      return rot + ": " + j.map(pad).join(" ") +
             (g.trevos[i] ? "  | " + tituloTrevo(jogo0).toLowerCase() + ": " + listaTrevos(jogo0, g.trevos[i]) : "");
    });
    var unit = custoJogo(jogo0, g.jogos[0].length);   // C(n,escolher) × preço, se for múltipla
    copyText(linhas.join("\n") + "\n\nTotal: " + g.jogos.length + " jogos x " + brl(unit) +
             " = " + brl(g.jogos.length * unit), "Todos os jogos copiados");
  }
  onClick("lfGerar",  function(){ megaGerarJogos("lotofacil"); });
  onClick("lfPlano60", aplicarPlanoLotofacil60);
  onClick("lfCopiar", function(){ copiarTodosGerador("lotofacil"); });
  onClick("salvarLf2", function(){ salvarAposta("lotofacil", GERADORES.lotofacil.jogos, null); });
  onClick("lfConferir",   function(){ conferirGerados("lotofacil"); });
  onClick("megaConferir", function(){ conferirGerados("megasena"); });
  onClick("mmConferir",   function(){ conferirGerados("maismilionaria"); });
  onClick("quinaConferir", function(){ conferirGerados("quina"); });
  onClick("dsConferir",    function(){ conferirGerados("diadesorte"); });
  onClick("megaGerar", function(){ megaGerarJogos("megasena"); });
  onClick("mmGerar",   function(){ megaGerarJogos("maismilionaria"); });
  onClick("quinaGerar", function(){ megaGerarJogos("quina"); });
  onClick("dsGerar",    function(){ megaGerarJogos("diadesorte"); });
  onClick("megaCopiar", function(){ copiarTodosGerador("megasena"); });
  onClick("mmCopiar",   function(){ copiarTodosGerador("maismilionaria"); });
  onClick("quinaCopiar", function(){ copiarTodosGerador("quina"); });
  onClick("dsCopiar",    function(){ copiarTodosGerador("diadesorte"); });
  onClick("salvarMm", function(){
    var g = GERADORES.maismilionaria;
    salvarAposta("maismilionaria", g.jogos, g.trevos);
  });
  onClick("salvarQuina", function(){ salvarAposta("quina", GERADORES.quina.jogos, null); });
  onClick("salvarDs", function(){
    var g = GERADORES.diadesorte;
    salvarAposta("diadesorte", g.jogos, g.trevos);
  });
  onClick("megaPrev", function(){ navegarSorteio("megasena", +1); });
  onClick("megaNext", function(){ navegarSorteio("megasena", -1); });
  onClick("lfPrev",   function(){ navegarSorteio("lotofacil", +1); });
  onClick("lfNext",   function(){ navegarSorteio("lotofacil", -1); });
  onClick("mmPrev",   function(){ navegarSorteio("maismilionaria", +1); });
  onClick("mmNext",   function(){ navegarSorteio("maismilionaria", -1); });
  onClick("quinaPrev", function(){ navegarSorteio("quina", +1); });
  onClick("quinaNext", function(){ navegarSorteio("quina", -1); });
  onClick("dsPrev",    function(){ navegarSorteio("diadesorte", +1); });
  onClick("dsNext",    function(){ navegarSorteio("diadesorte", -1); });
  document.addEventListener("keydown", function(ev){
    if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    var jogo = paginaAtual === "mega-mapa"   ? "megasena"
             : paginaAtual === "mm-mapa"     ? "maismilionaria"
             : paginaAtual === "quina-mapa"  ? "quina"
             : paginaAtual === "ds-mapa"     ? "diadesorte"
             : paginaAtual === "lf-sorteios" ? "lotofacil" : null;
    if (!jogo) return;
    if (ev.key === "ArrowLeft")  navegarSorteio(jogo, +1);
    if (ev.key === "ArrowRight") navegarSorteio(jogo, -1);
  });
  onClick("btnLotRandom", surpresinhaLoteria);
  onClick("btnLotClear", function(){
    lotSelecao[loteriaAtual] = []; lotTrevos = [];
    paintLoteria();
  });


  if (balanceBox){
    balanceBox.addEventListener("input", function(ev){
      var el = ev.target;
      if (!el.dataset || !el.dataset.faixa) return;
      var v = parseFloat(String(el.value).replace(",", "."));
      premios[el.dataset.faixa] = (isFinite(v) && v >= 0) ? v : PREMIO_RATEIO_PADRAO[el.dataset.faixa];
      store(STORE_PREMIOS, JSON.stringify(premios));
      renderBalanco();
    });
  }
  var dsBalanceBox = document.getElementById("dsBalanceBox");
  if (dsBalanceBox){
    dsBalanceBox.addEventListener("input", function(ev){
      var el = ev.target;
      if (!el.dataset || !el.dataset.dsfaixa) return;
      var v = parseFloat(String(el.value).replace(",", "."));
      dsPremios[el.dataset.dsfaixa] = (isFinite(v) && v >= 0) ? v : DS_PREMIO_RATEIO_PADRAO[el.dataset.dsfaixa];
      store(STORE_DS_PREMIOS, JSON.stringify(dsPremios));
      renderDsBalanco();
    });
  }

  var savedDraw = load(STORE_DRAW);
  if (savedDraw){
    try {
      drawn = (JSON.parse(savedDraw) || []).map(function(x){ return parseInt(x, 10); })
                .filter(function(n){ return n >= 1 && n <= TOTAL; })
                .slice(0, GAME_SIZE).sort(asc);
    } catch(e){ drawn = []; }
  }

  // Cada etapa é isolada: se uma falhar (HTML antigo em cache, por exemplo),
  // o volante e a geração de jogos continuam funcionando.
  function etapa(nome, fn){
    try { fn(); }
    catch (e){
      if (window.console) console.error("[lotofacil] falhou em " + nome + ":", e);
      avisar("Parte da página não carregou (" + nome + "). Recarregue com Ctrl+Shift+R / Cmd+Shift+R.");
    }
  }

  function avisar(msg){
    var el = document.getElementById("fatal");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  etapa("prêmios", function(){
    var p = JSON.parse(load(STORE_PREMIOS) || "{}");
    for (var k in PREMIO_RATEIO_PADRAO){
      var v = parseFloat(p[k]);
      premios[k] = (isFinite(v) && v >= 0) ? v : PREMIO_RATEIO_PADRAO[k];
    }
  });
  etapa("prêmios da dia de sorte", function(){
    var p = JSON.parse(load(STORE_DS_PREMIOS) || "{}");
    for (var k in DS_PREMIO_RATEIO_PADRAO){
      var v = parseFloat(p[k]);
      dsPremios[k] = (isFinite(v) && v >= 0) ? v : DS_PREMIO_RATEIO_PADRAO[k];
    }
  });
  etapa("faixa do sorteio", buildDrawPick);
  etapa("resultado da dia de sorte", buildDsDrawPick);
  etapa("mapa de calor", renderHeat);
  etapa("mega/milionária", buildLoteria);
  // Confere na subida se a página e o código continuam combinando. Foi assim que
  // apareceram os erros desta sessão: elemento que sumiu, card que ficou fora da
  // página, constante perdida numa reescrita — tudo silencioso até alguém usar.
  // Todos os ids que o código procura (lista mantida à mão): se um elemento
  // sumir do HTML, a verificação acusa na subida.
  var ELEMENTOS_ESPERADOS = [
    "apostasAcoes",
    "apostasCard",
    "apostasLimparConf",
    "apostasLista",
    "apostasResumo",
    "apostasTag",
    "app",
    "backdrop",
    "balanceBox",
    "balanceCard",
    "brandMark",
    "brandSub",
    "brandTitle",
    "btnClearDraw",
    "btnClearDs",
    "btnLotClear",
    "btnLotRandom",
    "btnSortearDraw",
    "btnSortearDs",
    "content",
    "drawCard",
    "drawPick",
    "drawStatus",
    "dsBalanceBox",
    "dsBalanceCard",
    "dsAnalysisCard",
    "dsAnalysisRange",
    "dsAnalysisSummary",
    "dsAnalysisStamp",
    "dsBacktestResult",
    "dsBacktestStrategies",
    "dsMonthAnalysis",
    "dsPairGrid",
    "dsRanking",
    "dsRankingNote",
    "dsRepeatChart",
    "dsRepeatMean",
    "dsRecommendation",
    "dsRecommendationResult",
    "dsConferir",
    "dsCopiar",
    "dsDrawMes",
    "dsDrawPick",
    "dsDrawStatus",
    "dsGerar",
    "fatal",
    "heatActions",
    "heatCard",
    "heatGrid",
    "heatHint",
    "heatNote",
    "heatRange",
    "heatTag",
    "heatWarn",
    "homeCard",
    "lfAgg",
    "lfAggCard",
    "lfAggNota",
    "lfAggTag",
    "lfConc",
    "lfConfOut",
    "lfConferir",
    "lfCopiar",
    "lfCrits",
    "lfData",
    "lfDez",
    "lfDrawCard",
    "lfGenCard",
    "lfGenNota",
    "lfGenTag",
    "lfGerar",
    "lfPlanStatus",
    "lfPlano60",
    "lfGrid",
    "lfJogos",
    "lfGeneratorMode",
    "lfMirrorAuto",
    "lfMirrorAutoAll",
    "lfMirrorBuilder",
    "lfMirrorClear",
    "lfMirrorCost",
    "lfMirrorFixedCount",
    "lfMirrorFixedGrid",
    "lfMirrorPairTabs",
    "lfMirrorPairs",
    "lfRepetir",
    "lfNext",
    "lfPrev",
    "lfQtd",
    "lfRange",
    "lfStats",
    "lfStandardSettings",
    "lfTag",
    "loteriaBox",
    "loteriaGrid",
    "loteriaNota",
    "loteriaTag",
    "loteriaTitulo",
    "megaAgg",
    "megaAnalysisCard",
    "megaAggCard",
    "megaAggNota",
    "megaAggTag",
    "megaConc",
    "megaConfOut",
    "megaConferir",
    "megaCopiar",
    "megaCrits",
    "megaData",
    "megaDez",
    "megaDrawCard",
    "megaExc",
    "megaExcInfo",
    "megaGenCard",
    "megaGenNota",
    "megaGenTag",
    "megaGerar",
    "megaGrid",
    "megaJogos",
    "megaNext",
    "megaPrev",
    "megaQtd",
    "megaRange",
    "megaStats",
    "megaTag",
    "menuBtn",
    "mmAgg",
    "mmAnalysisCard",
    "mmAggCard",
    "mmAggNota",
    "mmAggTag",
    "mmConc",
    "mmConfOut",
    "mmConferir",
    "mmCopiar",
    "mmCrits",
    "mmData",
    "mmDez",
    "mmDrawCard",
    "mmExc",
    "mmExcInfo",
    "mmGenCard",
    "mmGenNota",
    "mmGenTag",
    "mmGerar",
    "mmGrid",
    "mmJogos",
    "mmNext",
    "mmPrev",
    "mmQtd",
    "mmRange",
    "mmStats",
    "mmTag",
    "nav",
    "notesCard",
    "lfAnalysisCard",
    "outrasCard",
    "pageTitle",
    "pageTabs",
    "quadInfo",
    "quinaAnalysisCard",
    "quinaConferir",
    "quinaCopiar",
    "quinaGerar",
    "saveBetCancel",
    "saveBetConfirm",
    "saveBetContext",
    "saveBetModal",
    "saveBetName",
    "saveBetTitle",
    "salvarDs",
    "salvarLf2",
    "salvarMega",
    "salvarMm",
    "salvarQuina",
    "sidebar",
    "subtitulo",
    "toast",
    "topPill",
    "trevoBox",
    "trevoGrid"
  ];


  function verificarIntegridade(){
    var problemas = [], i, k;

    for (i = 0; i < ELEMENTOS_ESPERADOS.length; i++)
      if (!document.getElementById(ELEMENTOS_ESPERADOS[i]))
        problemas.push("elemento ausente no HTML: #" + ELEMENTOS_ESPERADOS[i]);

    for (i = 0; i < PAGINAS.length; i++){
      for (k = 0; k < PAGINAS[i].cards.length; k++){
        var card = document.getElementById(PAGINAS[i].cards[k]);
        if (!card) problemas.push("card ausente: " + PAGINAS[i].cards[k] + " (página " + PAGINAS[i].id + ")");
        else if (!card.closest(".page")) problemas.push("card solto fora de página: " + PAGINAS[i].cards[k]);
      }
    }

    for (var jogo in HISTORICOS){
      var h = HISTORICOS[jogo];
      for (var id in h.ids)
        if (!document.getElementById(h.ids[id])) problemas.push("elemento ausente: " + h.ids[id] + " (" + jogo + ")");
      if (!h.hist.length) problemas.push("histórico vazio: " + jogo);
      else if (!h.hist[0].dezenas || !h.hist[0].dezenas.length) problemas.push("histórico sem dezenas: " + jogo);
    }

    for (var g in GERADORES){
      var ger = GERADORES[g];
      for (var id2 in ger.ids)
        if (!document.getElementById(ger.ids[id2])) problemas.push("elemento ausente: " + ger.ids[id2] + " (" + g + ")");
    }

    // a divisão do volante tem que cobrir todas as dezenas, sem sobra nem falta
    for (var lot in LOTERIAS){
      var cfg = LOTERIAS[lot], soma = 0, t = tamanhoQuadrantes(cfg);
      for (var parte in t) soma += t[parte];
      if (soma !== cfg.total) problemas.push("divisão do volante inconsistente em " + lot + ": " + soma + " de " + cfg.total);
    }

    if (problemas.length){
      if (window.console) console.error("[lotofacil] integridade:", problemas);
      avisar("Achei " + problemas.length + " problema(s) na montagem da página: " +
             problemas.slice(0, 3).join("; ") + (problemas.length > 3 ? "…" : "") +
             " — detalhes no console.");
    }
    return problemas;
  }
  window.__verificar = verificarIntegridade;   // dá para rodar à mão no console

  etapa("navegação", function(){
    if (load(STORE_MENU) === "1") document.getElementById("app").classList.add("compacto");
    montarPaginas();
    montarMenu();
    var salva = load(STORE_PAGINA);
    var existe = false;
    for (var i = 0; i < PAGINAS.length; i++) if (PAGINAS[i].id === salva) existe = true;
    irPara(existe ? salva : "inicio");
  });
  etapa("integridade", verificarIntegridade);
  etapa("botões do mapa", buildHeatActions);
  etapa("pintura", paintDrawPick);
  etapa("balanço", renderBalanco);
})();

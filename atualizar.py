#!/usr/bin/env python3
"""Atualiza os históricos locais das loterias.

Uso:  python3 atualizar.py              (todas)
      python3 atualizar.py lotofacil    (só uma)
      python3 atualizar.py megasena quina

Usa duas fontes: a comunitária (loteriascaixa-api) e, se ela estiver atrasada,
a api.guidi.dev.br — que costuma publicar o resultado no mesmo dia.
Sem internet, dá para acrescentar a linha à mão em dados/*.js.
"""
import json, sys, os, urllib.request

RAIZ = os.path.dirname(os.path.abspath(__file__))
API1 = "https://loteriascaixa-api.herokuapp.com/api/{jogo}/{rota}"
API2 = "https://api.guidi.dev.br/loteria/{jogo}/ultimo"

MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho",
         "agosto","setembro","outubro","novembro","dezembro"]


def mes_numero(nome):
    """'Dezembro' -> 12. Usado só na Dia de Sorte, onde o mês vem por nome."""
    if not nome: return None
    try: return MESES.index(nome.strip().lower()) + 1
    except ValueError: return None

# nome da faixa por índice, para guardar os prêmios de cada concurso.
# +Milionária conforme o regulamento da Caixa: 1 ou nenhum trevo dividem a
# MESMA faixa ("6+1/0"), e as quatro últimas são de valor fixo
# (3+2 = R$50, 3+1 = R$24, 2+2 = R$12, 2+1 = R$6).
# Dia de Sorte: a faixa "mes" (Mês da Sorte) é prêmio fixo e independente das
# dezenas — quem acerta o mês ganha essa faixa mesmo sem bater 4+ dezenas.
FAIXAS_POR_JOGO = {
    "lotofacil":      {1:"15", 2:"14", 3:"13", 4:"12", 5:"11"},
    "megasena":       {1:"6", 2:"5", 3:"4"},
    "maismilionaria": {1:"6+2", 2:"6+1/0", 3:"5+2", 4:"5+1/0", 5:"4+2",
                       6:"4+1/0", 7:"3+2", 8:"3+1", 9:"2+2", 10:"2+1"},
    "quina":          {1:"5", 2:"4", 3:"3", 4:"2"},
    "diadesorte":     {1:"7", 2:"6", 3:"5", 4:"4", 5:"mes"},
}

JOGOS = {
    "lotofacil":      {"arq": "historico",      "var": "LOTOFACIL_HISTORICO_JSON"},
    "megasena":       {"arq": "megasena",       "var": "MEGASENA_HISTORICO_JSON"},
    "maismilionaria": {"arq": "maismilionaria", "var": "MAISMILIONARIA_HISTORICO_JSON"},
    "quina":          {"arq": "quina",          "var": "QUINA_HISTORICO_JSON"},
    "diadesorte":     {"arq": "diadesorte",     "var": "DIADESORTE_HISTORICO_JSON"},
}


def baixar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "loterias-local"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def normaliza(d, faixas, jogo=None):
    """aceita o formato das duas fontes"""
    if d.get("dezenas"):                       # loteriascaixa-api
        faixa1 = [p for p in (d.get("premiacoes") or []) if p.get("faixa") == 1]
        r = {"concurso": d["concurso"], "data": d["data"],
             "dezenas": sorted(int(x) for x in d["dezenas"]),
             "ganhadores": faixa1[0]["ganhadores"] if faixa1 else 0}
        if d.get("trevos"): r["trevos"] = sorted(int(x) for x in d["trevos"])
        if jogo == "diadesorte":
            m = mes_numero(d.get("mesSorte"))
            if m: r["trevos"] = [m]           # mês tratado como "trevo" de 1 escolha
        pr = {}
        for p2 in (d.get("premiacoes") or []):
            if p2.get("valorPremio"):
                pr[faixas.get(p2.get("faixa"), str(p2.get("faixa")))] = round(p2["valorPremio"], 2)
        if pr: r["premios"] = pr
        return r
    if d.get("listaDezenas"):                  # api.guidi.dev.br
        faixa1 = [x for x in (d.get("listaRateioPremio") or []) if x.get("faixa") == 1]
        r = {"concurso": d["numero"], "data": d["dataApuracao"],
             "dezenas": sorted(int(x) for x in d["listaDezenas"]),
             "ganhadores": faixa1[0]["numeroDeGanhadores"] if faixa1 else 0}
        if d.get("trevosSorteados"): r["trevos"] = sorted(int(x) for x in d["trevosSorteados"])
        if jogo == "diadesorte":
            m = mes_numero(d.get("nomeTimeCoracaoMesSorte"))
            if m: r["trevos"] = [m]
        pr = {}
        for x in (d.get("listaRateioPremio") or []):
            nome = faixas.get(x.get("faixa"))
            if nome and x.get("valorPremio"):
                pr[nome] = round(x["valorPremio"], 2)
        if pr: r["premios"] = pr
        return r
    return None


def grava(jogo, base):
    cfg = JOGOS[jogo]
    base["concursos"].sort(key=lambda r: -r["concurso"])
    base["atualizado_em"] = base["concursos"][0]["data"]
    with open(os.path.join(RAIZ, "dados", cfg["arq"] + ".json"), "w", encoding="utf-8") as f:
        json.dump(base, f, ensure_ascii=False, indent=1)
    linhas = []
    for r in base["concursos"]:
        extra = ""
        if r.get("trevos"):
            extra += ',"trevos":[%s]' % ",".join(str(t) for t in r["trevos"])
        if "ganhadores" in r:
            extra += ',"ganhadores":%d' % r["ganhadores"]
        if r.get("provisorio"):
            extra += ',"provisorio":true'
        if r.get("premios"):
            extra += ',"premios":{%s}' % ",".join('"%s":%s' % (k, v) for k, v in r["premios"].items())
        linhas.append('    {"concurso":%d,"data":"%s","dezenas":[%s]%s}' %
                      (r["concurso"], r["data"], ",".join(str(n) for n in r["dezenas"]), extra))
    with open(os.path.join(RAIZ, "dados", cfg["arq"] + ".js"), "w", encoding="utf-8") as f:
        f.write("// Histórico — dados fixos, sem chamada de rede.\n"
                "// Do mais recente para o mais antigo.  Atualize com:  python3 atualizar.py\n"
                "window.%s = {\n" % cfg["var"] +
                '  "atualizado_em": "%s",\n' % base["atualizado_em"] +
                '  "fonte": "loteriascaixa-api + api.guidi.dev.br",\n  "concursos": [\n' +
                ",\n".join(linhas) + "\n  ]\n};\n")


def atualiza(jogo):
    faixas = FAIXAS_POR_JOGO[jogo]
    cfg = JOGOS[jogo]
    caminho = os.path.join(RAIZ, "dados", cfg["arq"] + ".json")
    with open(caminho, encoding="utf-8") as f:
        base = json.load(f)
    tenho = {r["concurso"] for r in base["concursos"]}
    ultimo = max(tenho)
    print(f"[{jogo}] tenho até o concurso {ultimo}")

    novos = 0
    atualizados = 0
    # 1) tudo o que a fonte principal já tem — inclusive buracos deixados por
    #    rodadas anteriores (ex.: a alternativa gravou o último e pulou o meio)
    try:
        alvo = baixar(API1.format(jogo=jogo, rota="latest"))["concurso"]
    except Exception as e:
        print(f"  fonte principal indisponível ({e})")
        alvo = ultimo
    provisorios = {r["concurso"] for r in base["concursos"] if r.get("provisorio")}
    faltam = sorted((set(range(min(tenho), max(alvo, ultimo) + 1)) - tenho) | provisorios)
    if faltam:
        print(f"  consultando: {len(faltam)} concurso(s) novo(s) ou provisório(s)")
    for n in faltam:
        try:
            r = normaliza(baixar(API1.format(jogo=jogo, rota=str(n))), faixas, jogo)
        except Exception:
            r = None
        if not r:
            print(f"  concurso {n} indisponível — tento de novo na próxima rodada")
            continue
        anterior = next((x for x in base["concursos"] if x["concurso"] == r["concurso"]), None)
        if anterior:
            base["concursos"].remove(anterior); atualizados += 1
            print(f"  ~ concurso {r['concurso']} atualizado com o rateio oficial")
        else:
            novos += 1
            print(f"  + {r['concurso']} ({r['data']}): " + " ".join(f"{x:02d}" for x in r["dezenas"]))
        base["concursos"].append(r)

    # 2) a alternativa costuma publicar antes
    try:
        r = normaliza(baixar(API2.format(jogo=jogo)), faixas, jogo)
        if r:
            anterior = next((c for c in base["concursos"] if c["concurso"] == r["concurso"]), None)
            if not anterior or anterior.get("provisorio"):
                if anterior:
                    base["concursos"].remove(anterior); atualizados += 1
                    print(f"  ~ concurso {r['concurso']} atualizado pela fonte alternativa")
                else:
                    novos += 1
                    print(f"  + {r['concurso']} ({r['data']}) pela fonte alternativa: " +
                          " ".join(f"{x:02d}" for x in r["dezenas"]))
                base["concursos"].append(r)
    except Exception as e:
        print(f"  fonte alternativa indisponível ({e})")

    if novos or atualizados:
        grava(jogo, base)
        print(f"  pronto: {novos} novo(s), {atualizados} atualizado(s), total {len(base['concursos'])}")
    else:
        print("  nada novo")


if __name__ == "__main__":
    alvos = sys.argv[1:] or list(JOGOS)
    for j in alvos:
        if j in JOGOS: atualiza(j)
        else: print("loteria desconhecida:", j)

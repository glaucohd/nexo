# Nexo

Aplicação web estática para análise de históricos, organização e geração de combinações numéricas.

## Recursos

- Geradores para diferentes modalidades.
- Análises de frequência, atraso, repetição e distribuição.
- Diversificação de carteiras e jogadas espelho.
- Conferência automática de apostas salvas.
- Histórico local de resultados.
- Interface responsiva, com tema claro e escuro.

## Executar localmente

O projeto não exige instalação de dependências. Abra `index.html` diretamente ou inicie um servidor local:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Atualizar resultados

```bash
python3 atualizar.py
```

Também é possível atualizar somente algumas modalidades:

```bash
python3 atualizar.py lotofacil megasena
```

## Testes

```bash
node tests/analises.test.js
node tests/carteira-historica.test.js
node tests/diadesorte.test.js
node tests/diversidade.test.js
node tests/espelho.test.js
```

## Armazenamento

As apostas são guardadas no `localStorage` do navegador. Elas não são enviadas para um servidor nem sincronizadas automaticamente entre dispositivos.

## Publicação

Por ser uma aplicação estática e utilizar caminhos relativos, o Nexo pode ser publicado diretamente pelo GitHub Pages.

# Nexo — instruções para agentes

Gerador e analisador de jogos de loteria, voltado a palpite e intuição (o
usuário sabe que os sorteios são aleatórios; não prometa ganho).

## Onde está o quê

- `apps/web/`: a aplicação atual (Next.js 16 + Postgres no Supabase via
  Drizzle, autenticação com Better Auth). Leia também `apps/web/AGENTS.md`:
  este Next.js tem mudanças que não constam do seu treinamento.
- Raiz (`index.html`, `js/`, `css/`): a versão estática antiga.
- Branch de trabalho: `next-migration`.

## Regras

- **Nunca commitar `.env`** (tem a senha do banco). Ele é ignorado pelo Git.
- Commit e push só quando o usuário pedir.
- Antes de entregar: `npx tsc --noEmit`, `npx eslint src` e
  `node --test tests/*.test.mjs` dentro de `apps/web`.
- As garantias das reduções (fechamentos) são provadas por força bruta nos
  testes. Não altere um fechamento ou a tabela `src/lib/reduction-stats.ts`
  sem o teste correspondente passar.

## Servidor (Proxmox de casa)

O Nexo está publicado em http://192.168.68.74:3000 (container 104 do Proxmox).
**O servidor só é atualizado quando o usuário pedir "atualiza o servidor".**
Aí, com tudo commitado e enviado, o comando é:

```bash
pct exec 104 -- /usr/local/bin/nexo-update
```

Detalhes, comandos e problemas conhecidos em
[`apps/web/deploy/README.md`](apps/web/deploy/README.md).

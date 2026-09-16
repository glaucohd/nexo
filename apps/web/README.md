# Nexo Web

Nova aplicação do Nexo em Next.js, TypeScript, PostgreSQL, Drizzle ORM e Better Auth.

## Desenvolvimento

1. Copie `.env.example` para `.env` e ajuste as variáveis.
2. Crie ou selecione um banco PostgreSQL.
3. Execute `npm run db:migrate` com `DATABASE_URL` no ambiente.
4. Inicie com `npm run dev`.

Exemplo:

```bash
export DATABASE_URL='postgresql://usuario:senha@host:5432/banco'
npm run db:migrate
npm run dev
```

As migrações SQL são registradas em `_nexo_migrations` e não são reaplicadas.

## Importar resultados da CAIXA

O importador consulta o endpoint público usado pelo portal da CAIXA e grava concursos, dezenas, extras e premiações no PostgreSQL. Concursos já cadastrados são atualizados sem duplicação.

```bash
# Um concurso específico
npm run db:import-caixa -- --game=megasena --from=3058 --to=3058

# Toda a série histórica de uma modalidade
npm run db:import-caixa -- --game=lotofacil --all

# Todas as modalidades (carga inicial mais demorada)
npm run db:import-caixa -- --all

# Atualizar os últimos 205 concursos das modalidades exibidas em Resultados
npm run db:import-caixa -- --game=lotofacil,megasena,quina,maismilionaria,diadesorte --recent=205
```

Depois da carga inicial, informe apenas o intervalo dos concursos novos para a atualização manual.

O comando `npm run db:seed-history` importa as séries históricas já presentes em `dados/` como ponto de partida. A importação da CAIXA substitui esses registros pelo dado oficial do mesmo concurso e preserva sua origem no banco.

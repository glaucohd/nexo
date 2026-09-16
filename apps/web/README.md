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

# Arquitetura do Nexo

## Objetivo

O Nexo está sendo migrado da aplicação estática para uma plataforma web com contas, persistência e uma base própria de resultados. A versão publicada continua funcionando enquanto os recursos são migrados por fatias completas.

## Estrutura inicial

- `apps/web`: Next.js com App Router e TypeScript.
- `src/app`: landing page, autenticação e área logada.
- `src/db/schema`: contratos tipados do PostgreSQL com Drizzle ORM.
- `migrations`: SQL versionado e aplicado em ordem pelo script idempotente.
- raiz do repositório: aplicação estática atual, mantida durante a transição.

## Fronteiras do produto

1. **Site público**: explica o que o Nexo faz e deixa clara a limitação das análises históricas.
2. **Identidade**: Better Auth com sessão no PostgreSQL e autorização verificada no servidor.
3. **Domínio**: modalidades, concursos, faixas de premiação, carteiras e cartelas.
4. **Ingestão**: processo separado para buscar, validar e registrar resultados.
5. **Análise**: consultas derivadas apenas de concursos confirmados, sem promessas preditivas.

## Base própria de resultados

"Base própria" significa que o aplicativo consulta o banco do Nexo, e não uma API externa a cada visita. A origem inicial dos resultados ainda precisa ser externa. Para reduzir essa dependência operacional:

- cada resposta original é preservada em `source_payloads`;
- um hash impede duplicações e permite auditoria;
- concursos entram como `provisional` e só depois passam a `confirmed`;
- divergências podem gerar `corrected`, sem apagar o histórico bruto;
- `ingestion_runs` registra execução, volume e erro da coleta;
- uma segunda fonte poderá confirmar automaticamente os dados antes da publicação.

## Segurança e isolamento

- credenciais ficam apenas em variáveis de ambiente do servidor;
- toda consulta de carteira deve incluir o `user_id` obtido da sessão;
- a validação de permissão ocorre na camada de acesso a dados, não apenas na interface;
- payloads externos são tratados como entrada não confiável e validados antes da normalização.

## Ordem de migração

1. Infraestrutura, landing page, login e modelo de dados.
2. Importação das apostas locais existentes para a conta.
3. Lotofácil completa: resultados, análise, geradores e conferência.
4. Mega-Sena, Quina, Dia de Sorte e +Milionária.
5. Coletor agendado, reconciliação de fontes e painel administrativo.
6. Planos, limites e cobrança, somente depois de medir uso real.

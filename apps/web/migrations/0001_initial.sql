create extension if not exists pgcrypto;

create table if not exists _nexo_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create type draw_status as enum ('provisional', 'confirmed', 'corrected');
create type ingestion_status as enum ('running', 'succeeded', 'failed');

create table "user" (
  id text primary key,
  name text not null,
  email text not null,
  email_verified boolean not null default false,
  image text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_email_unique on "user" (email);

create table session (
  id text primary key,
  expires_at timestamptz not null,
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references "user" (id) on delete cascade
);
create unique index session_token_unique on session (token);
create index session_user_id_idx on session (user_id);

create table account (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references "user" (id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index account_user_id_idx on account (user_id);
create unique index account_provider_account_unique on account (provider_id, account_id);

create table verification (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_identifier_idx on verification (identifier);

create table lotteries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  total_numbers integer not null check (total_numbers > 0),
  draw_size integer not null check (draw_size > 0 and draw_size <= total_numbers),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table draws (
  id uuid primary key default gen_random_uuid(),
  lottery_id uuid not null references lotteries (id) on delete restrict,
  contest_number integer not null check (contest_number > 0),
  drawn_at timestamptz not null,
  numbers jsonb not null,
  extras jsonb,
  source text not null,
  status draw_status not null default 'provisional',
  checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index draw_lottery_contest_unique on draws (lottery_id, contest_number);
create index draw_lottery_date_idx on draws (lottery_id, drawn_at);

create table prize_tiers (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references draws (id) on delete cascade,
  label text not null,
  hits integer not null,
  extra_hits integer,
  winners integer not null default 0,
  prize numeric(16,2)
);
create index prize_tier_draw_idx on prize_tiers (draw_id);

create table portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" (id) on delete cascade,
  lottery_id uuid not null references lotteries (id) on delete restrict,
  name text not null,
  target_contest integer,
  mode text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_user_idx on portfolios (user_id, created_at);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios (id) on delete cascade,
  position integer not null,
  numbers jsonb not null,
  extras jsonb,
  created_at timestamptz not null default now()
);
create unique index ticket_portfolio_position_unique on tickets (portfolio_id, position);

create table ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status ingestion_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  received_count integer not null default 0,
  error text
);

create table source_payloads (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid references draws (id) on delete set null,
  source text not null,
  external_id text not null,
  payload jsonb not null,
  hash text not null,
  fetched_at timestamptz not null default now()
);
create unique index source_payload_hash_unique on source_payloads (source, hash);
create index source_payload_draw_idx on source_payloads (draw_id);

-- O Nexo acessa estas tabelas pelo backend. Sem políticas, a Data API pública
-- permanece bloqueada mesmo quando recebe a chave publishable do projeto.
alter table "user" enable row level security;
alter table session enable row level security;
alter table account enable row level security;
alter table verification enable row level security;
alter table lotteries enable row level security;
alter table draws enable row level security;
alter table prize_tiers enable row level security;
alter table portfolios enable row level security;
alter table tickets enable row level security;
alter table ingestion_runs enable row level security;
alter table source_payloads enable row level security;

insert into _nexo_migrations (name)
values ('0001_initial.sql')
on conflict (name) do nothing;

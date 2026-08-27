-- Gestão de Páginas — schema Postgres (Vercel Postgres / Neon)
-- Rode este arquivo uma vez no seu banco (painel do Neon/Vercel > SQL editor,
-- ou `psql "$POSTGRES_URL" -f db/schema.sql`).

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  nome text,
  criado_em timestamptz not null default now()
);

-- Depois de rodar o schema, crie seu usuário de acesso (troque e-mail/senha/nome):
--
-- insert into users (email, password_hash, nome)
-- values ('voce@exemplo.com', crypt('sua-senha-aqui', gen_salt('bf')), 'Seu Nome');

create table if not exists domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  ssl_active boolean not null default true,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  status text not null default 'draft',
  page_data jsonb not null default '{"blocks":[]}'::jsonb,
  html text,
  integrations jsonb,
  domain_id uuid references domains(id) on delete set null,
  page_slug text,
  seo jsonb,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  nome text,
  email text,
  telefone text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  utm_audience text,
  referral_source text,
  event_id text,
  pais text,
  cidade text,
  estado text,
  ip text,
  user_agent text,
  referrer text,
  campos_extras jsonb default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_leads_page_id on leads(page_id);
create index if not exists idx_pages_status on pages(status);

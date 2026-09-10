-- migrations/2026-09-09-experiments.sql
create table if not exists experiments (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  status text not null default 'running',
  criado_em timestamptz not null default now()
);

create table if not exists experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (experiment_id, page_id)
);

create index if not exists experiment_variants_experiment_id_idx on experiment_variants(experiment_id);

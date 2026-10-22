-- migrations/2026-10-22-page-views-visitor.sql
alter table page_views add column if not exists vid uuid;
alter table page_views add column if not exists utm_source text;
alter table page_views add column if not exists utm_medium text;
alter table page_views add column if not exists utm_campaign text;
alter table page_views add column if not exists utm_term text;
alter table page_views add column if not exists utm_content text;
alter table page_views add column if not exists referrer text;
alter table page_views add column if not exists user_agent text;

create index if not exists idx_page_views_experiment_vid on page_views(experiment_id, vid, criado_em);

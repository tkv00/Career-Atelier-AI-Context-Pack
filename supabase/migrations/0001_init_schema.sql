-- Career Atelier v2 — 1단계(기반) 스키마
-- 참조: docs/DESIGN-V2-CLOUD.md §5
--
-- v1(local-data/career-atelier.sqlite)의 12개 테이블을 계승하되, 다기기 지원을 위해
-- 모든 테이블에 owner_id를 붙인다. `settings` 테이블은 이관하지 않는다 — 안전 잠금은
-- DB 값이 아니라 러너 코드 상수로만 존재해야 한다 (§5, §19.2 #10).

create extension if not exists pgcrypto;

-- ── 계승 테이블 (owner_id 추가, jsonb/timestamptz로 전환) ──────────────────

create table profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '사용자',
  target_roles jsonb not null default '[]'::jsonb,
  interests jsonb not null default '[]'::jsonb,
  summary text not null default '',
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create table experience_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '제목 없는 경험',
  situation text not null default '',
  task text not null default '',
  action text not null default '',
  result text not null default '',
  metrics jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table job_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  url text not null default '',
  deadline date,
  status text not null default 'saved',
  fit_score int not null default 0,
  description text not null default '',
  requirements jsonb not null default '[]'::jsonb,
  source text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_job_posts_owner_url on job_posts (owner_id, url) where url <> '';

create table research_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references job_posts(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  sources jsonb not null default '[]'::jsonb,
  provider text not null default '',
  created_at timestamptz not null default now()
);

create table prompt_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  name text not null,
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  version int not null default 1,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table prompt_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references prompt_templates(id) on delete cascade,
  version int not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table harness_configs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  provider_map jsonb not null,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

-- essay_projects: revision은 §7 낙관적 잠금(다기기 충돌 감지)에 쓴다.
create table essay_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references job_posts(id) on delete set null,
  title text not null default '제목 없는 자소서',
  question text not null default '',
  draft text not null default '',
  target_chars int not null default 700,
  status text not null default 'draft',
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table essay_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  essay_id uuid not null references essay_projects(id) on delete cascade,
  version int not null,
  content text not null,
  chars_with_spaces int not null,
  chars_without_spaces int not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (essay_id, version)
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pipeline_id uuid,
  agent_id text not null,
  provider text not null,
  status text not null default 'queued',
  prompt text not null,
  output text not null default '',
  error text not null default '',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table run_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references agent_runs(id) on delete cascade,
  sequence int not null,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pipeline_id uuid,
  run_id uuid references agent_runs(id) on delete set null,
  kind text not null,
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── 색인 (v1 SQLite 인덱스 계승) ─────────────────────────────────────────

create index idx_jobs_status_deadline on job_posts (owner_id, status, deadline);
create index idx_research_job_kind on research_notes (owner_id, job_id, kind);
create index idx_prompts_agent_active on prompt_templates (owner_id, agent_id, is_active);
create index idx_essay_versions_essay_version on essay_versions (essay_id, version desc);
create index idx_runs_pipeline_created on agent_runs (owner_id, pipeline_id, created_at);
create index idx_artifacts_pipeline_kind on artifacts (owner_id, pipeline_id, kind);

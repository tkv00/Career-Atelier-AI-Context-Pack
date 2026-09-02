-- Career Atelier v2 — 신설 테이블 (작업 큐, 러너, 캘린더, 자소서 문항/자동저장/제안)
-- 참조: docs/DESIGN-V2-CLOUD.md §5, §4

-- 작업 큐. 웹은 여기에 넣기만, 러너는 여기서 꺼내기만 한다.
create table jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,             -- news | jobs | schedule | company | writer | review | review_inline
  pipeline_id uuid,
  payload jsonb not null,         -- 컨텍스트 팩 재료 (본문 원문이 아니라 참조 id 위주)
  harness_snapshot jsonb not null,-- 실행 시점 하네스를 동결해 재현성 확보
  status text not null default 'queued',
  priority int not null default 0,-- 인라인 제안은 10, 야간 배치는 0
  runner_id uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_jobs_owner_status_priority on jobs (owner_id, status, priority desc, created_at);

-- 러너 등록부. 신규 러너는 웹에서 수동 승인해야 잡을 집을 수 있다.
create table runners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null,
  fingerprint text not null unique,
  approved boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- 캘린더 (요구사항 9)
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_post_id uuid references job_posts(id) on delete cascade,
  title text not null,
  company text,
  event_type text not null,        -- deadline | interview | result | custom
  starts_at timestamptz not null,
  all_day boolean not null default true,
  source_url text,
  confidence text not null default 'confirmed', -- confirmed | needs_review
  raw_deadline_text text,          -- "상시채용" 원문 보존
  memo text,
  created_at timestamptz not null default now()
);
create index idx_calendar_events_owner_starts on calendar_events (owner_id, starts_at);

-- 자소서 문항 (요구사항 8, 11)
create table essay_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_post_id uuid references job_posts(id) on delete cascade,
  order_no int not null,
  question text not null,
  char_limit int,                  -- 목표/제한 글자 수
  char_limit_basis text,           -- with_spaces | without_spaces | unspecified
  guide text,                      -- 문항 안내문
  source text not null,            -- manual | paste_import | extension
  created_at timestamptz not null default now()
);
create index idx_essay_questions_job on essay_questions (owner_id, job_post_id, order_no);

-- 1분 자동저장 스냅샷 (명시 버전과 별개, 롤링 50개)
create table essay_autosaves (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  essay_id uuid not null references essay_projects(id) on delete cascade,
  content text not null,
  chars_with_spaces int not null,
  chars_without_spaces int not null,
  device_name text,
  created_at timestamptz not null default now()
);
create index idx_essay_autosaves_essay_created on essay_autosaves (essay_id, created_at desc);

-- 인라인 제안 (요구사항 7)
create table essay_suggestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  essay_id uuid not null references essay_projects(id) on delete cascade,
  paragraph_hash text not null,    -- 같은 문단 재요청 캐시 키
  original text not null,
  suggested text not null,
  rationale text,
  category text,                   -- evidence_missing | overclaim | wordy | structure | tone
  status text not null default 'pending', -- pending | applied | dismissed
  created_at timestamptz not null default now()
);
create index idx_essay_suggestions_essay_hash on essay_suggestions (essay_id, paragraph_hash);

-- ── 원자적 claim (§4) ────────────────────────────────────────────────────
-- 두 러너가 동시에 호출해도 `for update skip locked`로 서로 다른 잡을 가져가거나
-- 한쪽이 빈손으로 돌아간다. security definer로 실행되지만 auth.uid()로 호출자 본인의
-- 큐만 본다 — RLS 우회가 아니라 RLS와 같은 경계를 함수 안에서 재확인하는 것이다.
create or replace function claim_next_job(p_runner_id uuid)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  j jobs;
begin
  select * into j from jobs
   where owner_id = auth.uid()
     and status = 'queued'
     and created_at > now() - interval '6 hours'
   order by priority desc, created_at asc
   for update skip locked
   limit 1;
  if not found then
    return null;
  end if;
  update jobs set status = 'running', runner_id = p_runner_id, claimed_at = now()
   where id = j.id
  returning * into j;
  return j;
end;
$$;

-- 유령 잡 회수: running인데 하트비트가 끊긴 지 90초 넘은 잡을 queued로 되돌린다 (§4).
-- 재시도 상한은 별도 컬럼 없이 claimed_at 초기화로만 처리하고, 러너 쪽 retry_count: 0
-- 정책(§19.2 #7)은 이 함수와 무관하게 실행 계층에서 지킨다.
create or replace function reap_stale_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update jobs j set status = 'queued', runner_id = null, claimed_at = null
   from runners r
   where j.status = 'running'
     and j.runner_id = r.id
     and r.last_seen_at < now() - interval '90 seconds';
end;
$$;

-- 6시간 지난 대기 잡 폐기 (§4 잡 생명주기: expired).
-- jobs.status에 'expired' 값을 그대로 저장하는 방식으로, 별도 상태 컬럼 제약 없이
-- 애플리케이션 계층의 상태 문자열 계약을 유지한다.
create or replace function expire_old_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update jobs set status = 'expired'
   where status = 'queued'
     and created_at <= now() - interval '6 hours';
end;
$$;

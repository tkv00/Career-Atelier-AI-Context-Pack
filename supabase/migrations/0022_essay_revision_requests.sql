-- 자소서 대화형 수정(요청 2026-09-02).
--
-- 지금까지 뮤즈는 실행할 때마다 백지에서 다시 썼다. "2문단을 더 구체적으로"
-- 같은 요청을 반영할 방법이 없어서, 마음에 안 들면 통째로 다시 뽑고 손으로
-- 고치는 수밖에 없었다.
--
-- CLI 세션을 이어붙이는 방식(--continue/--resume)은 쓰지 않는다. 실행은
-- --ephemeral로 격리하는 게 이 프로젝트의 전제이고, 세션이 끊기면 맥락도
-- 사라져 재현이 안 된다. 대신 요청을 DB에 남겨 두고 실행할 때마다 최근
-- 몇 개를 컨텍스트로 함께 넘긴다 — 대화 상태를 CLI가 아니라 우리가 갖는다.

create table if not exists essay_revision_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  essay_id uuid not null references essay_projects(id) on delete cascade,
  instruction text not null,
  -- 이 요청을 넣을 때 화면에 있던 본문. 나중에 "그때 뭘 보고 이렇게 시켰나"를
  -- 되짚을 수 있어야 한다.
  base_draft text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists essay_revision_requests_essay_idx
  on essay_revision_requests (essay_id, created_at desc);

alter table essay_revision_requests enable row level security;
create policy owner_all on essay_revision_requests
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

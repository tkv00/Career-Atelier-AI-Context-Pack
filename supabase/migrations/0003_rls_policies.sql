-- Career Atelier v2 — RLS 기본 거부 (§5, §6 4층 방어의 마지막 층)
--
-- 정책을 걸기 전에는 anon 키로도 service_role 없이는 한 행도 못 읽는 게 기본값이어야
-- 한다(§5). 모든 테이블에 동일한 owner_all 패턴을 적용한다: 절대로 service_role로
-- 이 방어를 우회하지 않는다(§19.2 #2, #3) — Vercel 환경변수에는 anon 키만 들어간다.

alter table profiles          enable row level security;
alter table experience_cards  enable row level security;
alter table job_posts         enable row level security;
alter table research_notes    enable row level security;
alter table prompt_templates  enable row level security;
alter table prompt_versions   enable row level security;
alter table harness_configs   enable row level security;
alter table essay_projects    enable row level security;
alter table essay_versions    enable row level security;
alter table agent_runs        enable row level security;
alter table run_events        enable row level security;
alter table artifacts         enable row level security;
alter table jobs              enable row level security;
alter table runners           enable row level security;
alter table calendar_events   enable row level security;
alter table essay_questions   enable row level security;
alter table essay_autosaves   enable row level security;
alter table essay_suggestions enable row level security;

create policy owner_all on profiles          for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on experience_cards  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on job_posts         for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on research_notes    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on prompt_templates  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on prompt_versions   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on harness_configs   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on essay_projects    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on essay_versions    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on agent_runs        for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on run_events        for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on artifacts         for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on jobs              for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on runners           for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on calendar_events   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on essay_questions   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on essay_autosaves   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on essay_suggestions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- claim_next_job/reap_stale_jobs/expire_old_jobs는 security definer이지만 내부에서
-- auth.uid()로 호출자 본인 소유 행만 다룬다(§4). service_role이 아니라 러너가 로그인한
-- 일반 authenticated 세션으로 호출한다 — 별도 관리자 권한을 주지 않는다.
revoke execute on function claim_next_job(uuid) from public;
revoke execute on function reap_stale_jobs() from public;
revoke execute on function expire_old_jobs() from public;
grant execute on function claim_next_job(uuid) to authenticated;
grant execute on function reap_stale_jobs() to authenticated;
grant execute on function expire_old_jobs() to authenticated;

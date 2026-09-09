-- SECURITY DEFINER 함수는 테이블 RLS와 별도로 호출자의 경계를 확인해야 한다.
create or replace function public.claim_next_job(p_runner_id uuid)
returns public.jobs language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  if not exists (select 1 from public.runners where id = p_runner_id and owner_id = auth.uid() and approved) then
    raise exception '승인된 본인 러너만 작업을 받을 수 있습니다.';
  end if;
  select * into j from public.jobs
    where owner_id = auth.uid() and status = 'queued'
      and created_at > now() - interval '6 hours'
    order by priority desc, created_at asc for update skip locked limit 1;
  if not found then return null; end if;
  update public.jobs set status = 'running', runner_id = p_runner_id, claimed_at = now()
    where id = j.id returning * into j;
  return j;
end;
$$;

create or replace function public.reap_stale_jobs()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.jobs j set status = 'queued', runner_id = null, claimed_at = null
    from public.runners r where j.owner_id = auth.uid() and r.owner_id = auth.uid()
      and j.status = 'running' and j.runner_id = r.id
      and r.last_seen_at < now() - interval '90 seconds';
end;
$$;

create or replace function public.expire_old_jobs()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.jobs set status = 'expired' where owner_id = auth.uid()
    and status = 'queued' and created_at <= now() - interval '6 hours';
end;
$$;

revoke execute on function public.claim_next_job(uuid), public.reap_stale_jobs(), public.expire_old_jobs() from public, anon;
grant execute on function public.claim_next_job(uuid), public.reap_stale_jobs(), public.expire_old_jobs() to authenticated;
-- 가입 트리거는 함수 소유자로 실행되므로 클라이언트에 시드 권한을 줄 필요가 없다.
revoke execute on function public.seed_default_prompts(uuid), public.seed_default_prompts_on_signup() from public, anon, authenticated;
revoke execute on function public.restrict_signup_to_owner(jsonb) from public, anon, authenticated;
grant execute on function public.restrict_signup_to_owner(jsonb) to supabase_auth_admin;

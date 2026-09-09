-- 가입 훅의 조회와 계정 INSERT 사이에도 다른 요청이 들어올 수 있다.
-- 단일 행의 고유 제약으로 소유자 선점을 계정 생성 트랜잭션에 묶는다.
create schema if not exists career_atelier_private;
revoke all on schema career_atelier_private from public, anon, authenticated;

create table career_atelier_private.instance_owner (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null
);
alter table career_atelier_private.instance_owner enable row level security;
create policy owner_read on career_atelier_private.instance_owner
  for select using (owner_id = auth.uid());
revoke all on career_atelier_private.instance_owner from public, anon, authenticated;

-- 기존 계정은 변경하지 않는다. 소유자 계정을 삭제해도 공개 가입이 다시 열리지 않는다.
insert into career_atelier_private.instance_owner (singleton, owner_id)
  select true, id from auth.users order by id limit 1;

create function public.enforce_single_owner_signup()
returns trigger language plpgsql security definer
set search_path = public, career_atelier_private as $$
begin
  insert into career_atelier_private.instance_owner (singleton, owner_id)
    values (true, new.id) on conflict (singleton) do nothing;
  if not found then
    raise exception '이 인스턴스에는 이미 소유자가 있습니다. 직접 배포해 사용하세요.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_single_owner_signup() from public, anon, authenticated;
create trigger enforce_single_owner_before_signup
  before insert on auth.users for each row
  execute function public.enforce_single_owner_signup();

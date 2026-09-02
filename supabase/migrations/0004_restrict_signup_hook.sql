-- 단일 사용자 앱의 실제 방어(§6 3층 "허용 이메일 1개"). 이전에 auth.email의
-- enable_signup=false로 시도했다가 기존 사용자 로그인까지 막히는 걸 확인하고
-- 되돌렸다 — Before User Created 훅으로 "새 계정 생성"만 정확히 막는다.
-- 기존 사용자의 OTP 로그인 경로는 이 훅을 거치지 않는다.

create or replace function public.restrict_signup_to_owner(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  incoming_email text;
begin
  incoming_email := event->'user'->>'email';

  if incoming_email = 'tkv0098@gmail.com' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', '이 앱은 단일 사용자 전용입니다.',
      'http_code', 403
    )
  );
end;
$$;

grant execute on function public.restrict_signup_to_owner to supabase_auth_admin;

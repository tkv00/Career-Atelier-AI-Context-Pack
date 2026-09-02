-- 단일 사용자 앱의 실제 방어(§6 3층 "허용 이메일 1개"). 이전에 auth.email의
-- enable_signup=false로 시도했다가 기존 사용자 로그인까지 막히는 걸 확인하고
-- 되돌렸다 — Before User Created 훅으로 "새 계정 생성"만 정확히 막는다.
-- 기존 사용자의 OTP 로그인 경로는 이 훅을 거치지 않는다.
--
-- 주의: 소유자 이메일을 여기 직접 박는 이 방식은 0018에서 완전히 대체됐다 —
-- 자체 호스팅하는 사람마다 이메일이 다른데 이 파일은 고정값이라, 리포를 clone한
-- 사람이 자기 계정조차 가입할 수 없었기 때문이다. 아래 주소는 그 흔적을 남긴
-- 자리표시자일 뿐이며, 마이그레이션을 순서대로 적용하면 0018이 이 함수를 곧바로
-- "첫 가입자가 소유자" 방식으로 덮어쓴다. 새로 설치한다면 0018만 보면 된다.

create or replace function public.restrict_signup_to_owner(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  incoming_email text;
begin
  incoming_email := event->'user'->>'email';

  if incoming_email = 'owner@example.com' then
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

-- 자체 호스팅을 위한 소유자 판정 방식 교체.
--
-- 0004는 소유자 이메일을 함수 본문에 직접 박아 뒀다. 그 리포를 그대로 clone해
-- 자기 Supabase에 올린 사람은 자기 계정조차 가입이 403으로 거부됐다 — 오픈소스로
-- 열면서 이 방식은 더 쓸 수 없다.
--
-- 대신 "첫 번째로 가입한 사람이 이 인스턴스의 소유자가 되고, 그 다음부터는 전부
-- 막는다"로 바꾼다(Gitea·Grafana 등 자체 호스팅 앱의 first-run 소유자 패턴).
-- 설정할 값이 하나도 없으면서 §6 3층("이 배포본을 쓰는 사람은 1명")은 그대로
-- 유지된다. 이미 사용자가 있는 기존 배포본에서는 count >= 1이라 지금까지와
-- 똑같이 신규 가입이 막힌다 — 기존 사용자의 OTP 로그인은 애초에 이 훅을 타지
-- 않으므로 영향이 없다.
--
-- search_path를 고정하고 security definer로 선언한다. auth.users를 읽어야 하고,
-- 고정하지 않으면 Supabase 보안 린터의 function_search_path_mutable 경고 대상이다.

create or replace function public.restrict_signup_to_owner(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  existing_users integer;
begin
  select count(*) into existing_users from auth.users;

  -- 아직 아무도 없다 = 이 인스턴스를 세운 본인의 첫 가입이다. 허용한다.
  if existing_users = 0 then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', '이 인스턴스에는 이미 소유자가 있습니다. 직접 배포해 사용하세요.',
      'http_code', 403
    )
  );
end;
$$;

grant execute on function public.restrict_signup_to_owner to supabase_auth_admin;

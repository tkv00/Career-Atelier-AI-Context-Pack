-- Codex의 구독 한도는 계정이 아니라 로컬 CLI 로그인 세션에 묶여 있다. 그래서
-- 어느 기기가 마지막으로 확인했는지를 함께 남겨, 여러 러너가 있을 때도 화면이
-- 다른 컴퓨터의 오래된 한도를 현재 값처럼 보이지 않게 한다.
alter table runners
  add column if not exists codex_rate_limits jsonb,
  add column if not exists codex_rate_limits_checked_at timestamptz;

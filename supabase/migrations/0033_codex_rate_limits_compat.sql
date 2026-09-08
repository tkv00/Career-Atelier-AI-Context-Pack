-- 자료 가져오기 0031을 먼저 적용한 인스턴스도 원격 사용량 표시 컬럼을 받을 수 있게 한다.
-- 새 설치에서는 0031_codex_rate_limits.sql 뒤에 실행되어도 IF NOT EXISTS로 안전하다.
alter table runners
  add column if not exists codex_rate_limits jsonb,
  add column if not exists codex_rate_limits_checked_at timestamptz;

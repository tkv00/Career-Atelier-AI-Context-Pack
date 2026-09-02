-- 로컬 폴더 자동 백업(사용자 요청, 2026-09-02).
--
-- 클라우드 DB가 날아가면 지금까지 쓴 자소서·경험 카드가 통째로 사라진다.
-- Supabase 무료 플랜은 일정 기간 미사용 시 프로젝트가 정지되기도 해서, 클라우드
-- 하나만 믿을 근거가 약하다. 러너는 이미 사용자 본인 세션으로 로그인해 내 컴퓨터에서
-- 도는 프로세스이므로, 러너가 주기적으로 전체 데이터를 로컬 폴더에 JSON으로 떨군다.
--
-- 백업 폴더 경로는 기기마다 다르다(맥의 /Users/... 와 윈도우의 C:\... 는 같은 값일
-- 수 없다). 그래서 별도 설정 테이블이 아니라 runners 행에 둔다 — 러너 1대 = 백업
-- 설정 1벌이다.

alter table runners add column if not exists backup_enabled boolean not null default false;
alter table runners add column if not exists backup_dir text;
alter table runners add column if not exists last_backup_at timestamptz;
alter table runners add column if not exists last_backup_error text;

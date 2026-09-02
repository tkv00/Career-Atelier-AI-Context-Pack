-- 합불을 "서류" 단일 필드로만 추적하던 것을, 전형 단계별(서류/필기시험/
-- 코딩테스트/기술면접/최종면접)로 나눠서 추적한다(사용자 요청, 2026-09-02).
-- 기존 result_status는 그대로 둔다 — 캘린더 칩·현황판 색상이 이미 이
-- 컬럼을 읽고 있고(.includes('합격') 검사라 "최종면접 합격" 같은 새 값도
-- 그대로 통과한다), 매번 stage_results가 바뀔 때 서버 액션이 이 컬럼을
-- 자동 재계산해서 같이 쓴다 — 화면 여러 곳을 고칠 필요 없이 한 곳만
-- 고치면 된다.
alter table job_posts
  add column if not exists stage_results jsonb not null default '{}'::jsonb;

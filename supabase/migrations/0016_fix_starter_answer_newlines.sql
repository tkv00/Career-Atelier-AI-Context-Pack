-- 0015에서 공통 면접 질문의 답변 골격을 표준 작은따옴표 문자열로 넣었는데,
-- Postgres 표준 문자열에서 \n은 개행이 아니라 "역슬래시 + n" 두 글자로
-- 저장된다(E'...' 이스케이프 문자열이어야 개행이 된다). 그래서 면접
-- 준비실 답변 편집기에 "## 답변 골격\n\n- 상황/맥락: \n- ..."이 그대로
-- 텍스트로 노출됐다 — 실제 화면에서 확인한 버그다.
--
-- 사용자가 직접 쓴 답변에 역슬래시+n이 들어갈 일은 거의 없지만, 안전하게
-- source='starter'(시드로 심은 행)로만 범위를 좁혀 되돌린다.
update interview_questions
set answer_markdown = replace(answer_markdown, '\n', E'\n')
where source = 'starter'
  and answer_markdown like '%\n%';

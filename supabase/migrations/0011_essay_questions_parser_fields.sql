-- §10 파서 명세의 ParsedQuestion 타입은 char_min과 raw를 요구하는데
-- 0002의 essay_questions에는 없었다 — 5단계 raw_deadline_text와 같은 종류의
-- 스펙 보강(§5 초안에는 없었지만 §10 상세 명세에서 추가됨).
alter table essay_questions
  add column char_min int,
  add column raw text;

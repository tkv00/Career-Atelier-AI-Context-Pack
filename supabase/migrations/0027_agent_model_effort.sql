-- 비서별 모델명·추론 사용량(effort) — 사용자 요청 2026-09-05.
--
-- provider(0021, "어떤 CLI로 도는가")만으로는 부족하다. 같은 Claude 안에서도
-- Opus/Sonnet/Haiku 중 뭘 쓸지, 같은 Codex 안에서도 추론에 얼마나 시간을
-- 쓸지(reasoning effort)를 비서마다 다르게 정하고 싶다는 요청이다.
--
-- provider와 같은 자리(prompt_templates, 비서당 한 행)에 둔다. 값을 CHECK로
-- 강제하지 않는다 — GPT·Claude·Gemini 세 CLI가 모델명·effort 표기를 각자
-- 다르게 쓰고(§ 웹 UI lib/agent-providers.ts가 표기 차이를 다룬다), CLI
-- 버전이 바뀌면 유효한 값 자체가 바뀐다. 빈 문자열은 "지정하지 않음"이고,
-- 러너(runner/index.mjs)는 빈 값이면 --model/--effort 플래그 자체를 CLI에
-- 넘기지 않아 CLI 기본값이 그대로 적용된다.
alter table prompt_templates
  add column if not exists model text not null default '',
  add column if not exists effort text not null default '';

-- 비서별 LLM을 사용자가 고른다(요청 2026-09-02).
--
-- 지금까지는 어떤 비서가 어떤 CLI로 도는지가 runner/index.mjs에 박혀 있었다.
-- 구독을 하나만 쓰는 사람은 나머지 비서를 아예 못 쓰고, Claude만 결제한
-- 사람에게 "루미는 Codex라서 안 됩니다"라고 할 이유도 없다.
--
-- 저장 위치는 prompt_templates다. 이미 비서당 한 행이고, 러너가 실행 직전에
-- 이 행을 읽고 있어서 조회가 늘지 않는다. harness_configs.provider_map이
-- 이름상 더 맞아 보이지만 그 테이블은 v1 잔재로 행이 0개이고 코드 어디서도
-- 읽지 않는다 — 죽은 테이블을 되살리는 것보다 살아 있는 쪽에 붙인다.

alter table prompt_templates
  add column if not exists provider text not null default 'codex';

-- 셋 중 하나만 허용한다. 러너도 실행 전에 한 번 더 검사하지만(safety.mjs),
-- 잘못된 값이 애초에 저장되지 않게 DB에서도 막는다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prompt_templates_provider_check'
  ) then
    alter table prompt_templates
      add constraint prompt_templates_provider_check
      check (provider in ('codex', 'claude', 'gemini'));
  end if;
end $$;

-- 기존 동작을 그대로 보존한다. 이 값들이 지금까지 index.mjs에 박혀 있던 것과
-- 같아야, 이번 변경으로 돌아가던 비서가 갑자기 다른 CLI를 타지 않는다.
update prompt_templates set provider = 'codex'  where agent_id in ('news', 'jobs', 'writer', 'interview');
update prompt_templates set provider = 'claude' where agent_id in ('company', 'review');
update prompt_templates set provider = 'gemini' where agent_id = 'subtitle';

-- Career Atelier — 면접 준비실
-- 공통 경험/인성 질문은 job_post_id가 null이고, 기업별 질문은 채용공고에 연결된다.

create table interview_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  job_post_id uuid references job_posts(id) on delete cascade,
  category text not null check (category in ('experience', 'personality', 'company')),
  question text not null,
  answer_markdown text not null default '',
  source text not null default 'manual' check (source in ('manual', 'agent', 'starter')),
  order_no int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (category in ('experience', 'personality') and job_post_id is null)
    or (category = 'company' and job_post_id is not null)
  )
);

create index idx_interview_questions_scope
  on interview_questions (owner_id, job_post_id, category, order_no, updated_at desc);

alter table interview_questions enable row level security;
create policy owner_all on interview_questions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 현재 허용된 사용자에게 공통 질문 골격을 한 번만 제공한다.
insert into interview_questions (owner_id, category, question, answer_markdown, source, order_no)
select users.id, starter.category, starter.question, starter.answer_markdown, 'starter', starter.order_no
from auth.users as users
cross join (values
  ('experience', '가장 복잡한 문제를 구조화하고 해결한 경험을 말씀해 주세요.', '## 답변 골격\n\n- **상황/맥락:** \n- **문제와 근거:** \n- **내 역할:** \n- **판단과 행동:** \n- **결과:** \n- **회고:** ', 10),
  ('experience', '실패한 접근을 바꾸어 결과를 만든 경험이 있나요?', '## 답변 골격\n\n> 실패 자체보다 무엇을 관찰하고 판단을 바꿨는지에 집중합니다.\n\n- 처음 선택한 접근: \n- 예상과 달랐던 점: \n- 바꾼 판단과 행동: \n- 결과와 배운 기준: ', 20),
  ('personality', '협업 중 의견 충돌을 해결한 방식을 말씀해 주세요.', '## 답변 골격\n\n- 충돌한 쟁점: \n- 상대의 우선순위: \n- 내가 확인한 공통 목표: \n- 합의한 기준과 결과: ', 10),
  ('personality', '일할 때 가장 중요하게 지키는 기준은 무엇인가요?', '## 답변 골격\n\n**업무 기준 한 문장:** \n\n이 기준이 생긴 경험과 실제 행동을 연결해 설명합니다.', 20)
) as starter(category, question, answer_markdown, order_no)
where not exists (
  select 1 from interview_questions existing
  where existing.owner_id = users.id
    and existing.category = starter.category
    and existing.question = starter.question
);

-- Echo(면접 코치) 프롬프트. 답변은 경험 카드에 있는 사실만 사용한다.
insert into prompt_templates (owner_id, agent_id, name, body, variables, version, is_active)
select users.id, 'interview', '기업별 예상 면접 질문·답안',
  '채용공고, 기업 조사, 사용자의 경험 카드를 교차해 실제 면접에서 나올 가능성이 높은 질문을 만든다. 답안은 결론부터 말하고 상황/문제/내 역할/판단/행동/결과/회고 중 필요한 근거만 사용한다. 경험 카드에 없는 회사명, 수치, 행동을 만들지 말고 답할 근거가 부족하면 [내 경험 입력 필요]라고 명확히 표시한다. 질문은 JD 검증, 기업·직무 이해, 경험 검증, 꼬리질문 대응이 균형을 이루게 구성한다.',
  '["job_post","company_research","experiences","existing_questions"]'::jsonb,
  1, true
from auth.users as users
where not exists (
  select 1 from prompt_templates existing
  where existing.owner_id = users.id and existing.agent_id = 'interview'
);

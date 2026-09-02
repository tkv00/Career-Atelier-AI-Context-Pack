import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = resolve(import.meta.dirname, '..');
export const dataDir = resolve(process.env.CAREER_ATELIER_DATA_DIR || resolve(projectRoot, 'local-data'));
mkdirSync(dataDir, { recursive: true });

export const databasePath = resolve(dataDir, 'career-atelier.sqlite');
export const database = new DatabaseSync(databasePath);
database.exec('PRAGMA journal_mode = WAL');
database.exec('PRAGMA foreign_keys = ON');
database.exec('PRAGMA busy_timeout = 5000');

database.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    target_roles TEXT NOT NULL DEFAULT '[]',
    interests TEXT NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS experience_cards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '',
    problem TEXT NOT NULL DEFAULT '',
    role_scope TEXT NOT NULL DEFAULT '',
    judgment TEXT NOT NULL DEFAULT '',
    situation TEXT NOT NULL DEFAULT '',
    task TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL DEFAULT '',
    trial_error TEXT NOT NULL DEFAULT '',
    reflection TEXT NOT NULL DEFAULT '',
    metrics TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS job_posts (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    deadline TEXT,
    status TEXT NOT NULL DEFAULT 'saved',
    application_type TEXT NOT NULL DEFAULT '서류접수',
    company_type TEXT NOT NULL DEFAULT '미분류',
    submission_status TEXT NOT NULL DEFAULT '미제출',
    result_status TEXT NOT NULL DEFAULT '아직',
    fit_score INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    requirements TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    title TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL DEFAULT 'deadline',
    starts_at TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 1,
    source_url TEXT NOT NULL DEFAULT '',
    memo TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(job_id) REFERENCES job_posts(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS research_notes (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]',
    provider TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(job_id) REFERENCES job_posts(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    variables TEXT NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(template_id) REFERENCES prompt_templates(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS harness_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_map TEXT NOT NULL,
    config TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS essay_projects (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    title TEXT NOT NULL,
    question TEXT NOT NULL DEFAULT '',
    draft TEXT NOT NULL DEFAULT '',
    target_chars INTEGER NOT NULL DEFAULT 700,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(job_id) REFERENCES job_posts(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS essay_versions (
    id TEXT PRIMARY KEY,
    essay_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    chars_with_spaces INTEGER NOT NULL,
    chars_without_spaces INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(essay_id) REFERENCES essay_projects(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS interview_questions (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    answer_markdown TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    order_no INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(job_id) REFERENCES job_posts(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT,
    agent_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    prompt TEXT NOT NULL,
    output TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS run_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT,
    run_id TEXT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES agent_runs(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_jobs_status_deadline ON job_posts(status, deadline);
  CREATE INDEX IF NOT EXISTS idx_calendar_starts_at ON calendar_events(starts_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_job ON calendar_events(job_id) WHERE job_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_research_job_kind ON research_notes(job_id, kind);
  CREATE INDEX IF NOT EXISTS idx_prompts_agent_active ON prompt_templates(agent_id, is_active);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_versions_template_version ON prompt_versions(template_id, version);
  CREATE INDEX IF NOT EXISTS idx_essay_versions_essay_version ON essay_versions(essay_id, version DESC);
  CREATE INDEX IF NOT EXISTS idx_interview_scope_order ON interview_questions(job_id, category, order_no, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_runs_pipeline_created ON agent_runs(pipeline_id, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_run_events_run_sequence ON run_events(run_id, sequence);
  CREATE INDEX IF NOT EXISTS idx_artifacts_pipeline_kind ON artifacts(pipeline_id, kind);
`);

const experienceColumns = new Set(
  database.prepare('PRAGMA table_info(experience_cards)').all().map((column) => column.name),
);
for (const [name, definition] of [
  ['context', "TEXT NOT NULL DEFAULT ''"],
  ['problem', "TEXT NOT NULL DEFAULT ''"],
  ['role_scope', "TEXT NOT NULL DEFAULT ''"],
  ['judgment', "TEXT NOT NULL DEFAULT ''"],
  ['trial_error', "TEXT NOT NULL DEFAULT ''"],
  ['reflection', "TEXT NOT NULL DEFAULT ''"],
]) {
  if (!experienceColumns.has(name)) database.exec(`ALTER TABLE experience_cards ADD COLUMN ${name} ${definition}`);
}
const jobColumns = new Set(
  database.prepare('PRAGMA table_info(job_posts)').all().map((column) => column.name),
);
for (const [name, definition] of [
  ['application_type', "TEXT NOT NULL DEFAULT '서류접수'"],
  ['company_type', "TEXT NOT NULL DEFAULT '미분류'"],
  ['submission_status', "TEXT NOT NULL DEFAULT '미제출'"],
  ['result_status', "TEXT NOT NULL DEFAULT '아직'"],
]) {
  if (!jobColumns.has(name)) database.exec(`ALTER TABLE job_posts ADD COLUMN ${name} ${definition}`);
}

const now = () => new Date().toISOString();
const toJson = (value) => JSON.stringify(value);
const legacyWriterPrompt = '문항 {{question}}에 답하되 제공된 경험과 조사 근거 밖의 사실을 만들지 마라. 결론을 먼저 쓰고 상황-행동-결과-직무 연결 순서로 작성하라. 목표 글자 수는 {{target_chars}}자다.';
const frameworkWriterPrompt = '문항 {{question}}에 답하되 제공된 경험과 조사 근거 밖의 사실을 만들지 마라. 활용 태그로 문항에 적합한 경험을 찾고, 상황/맥락·문제·내 역할·판단·행동·결과·시행착오·회고 중 문항에 필요한 근거를 선택해 구성하라. 목표 글자 수는 {{target_chars}}자다.';

function seed() {
  if (database.prepare('SELECT COUNT(*) AS count FROM settings').get().count > 0) return;
  const timestamp = now();
  const putSetting = database.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  putSetting.run('provider_mode', 'subscription_only', timestamp);
  putSetting.run('allow_api_keys', 'false', timestamp);
  putSetting.run('allow_paid_overage', 'false', timestamp);
  putSetting.run('on_limit', 'pause_until_reset', timestamp);

  database.prepare(`INSERT INTO profiles (id, display_name, target_roles, interests, summary, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    'me', '사용자', toJson(['Product Manager', 'AI Product']), toJson(['AI', '커리어', '생산성']),
    '데이터로 문제를 구조화하고 팀이 실행할 수 있는 언어로 바꾸는 기획자', timestamp,
  );

  database.prepare(`INSERT INTO experience_cards
    (id, title, context, problem, role_scope, judgment, situation, task, action, result, trial_error, reflection, metrics, tags, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'exp-conversion', '사용자 이탈 구간 개선', '신규 사용자의 활성화를 높이는 온보딩 개선 프로젝트였고, 핵심 퍼널 전환율 회복이 목표였다.',
    '핵심 퍼널에서 신규 사용자의 이탈이 증가했으며 행동 데이터와 사용자 인터뷰에서 같은 이탈 구간이 확인됐다.',
    '제품 기획자로서 이탈 원인 정의, 실험 우선순위 결정, 온보딩 개선안 설계를 맡았다.',
    '전면 개편과 단계별 실험을 비교했고, 제한된 개발 리소스에서 원인을 검증할 수 있는 단계별 실험을 선택했다.',
    '신규 사용자의 활성화를 높이는 온보딩 개선 프로젝트였다.',
    '행동 데이터와 인터뷰에서 같은 구간의 이탈이 확인됐다.',
    '행동 데이터를 구간별로 나누고 인터뷰 결과와 교차 검증한 뒤, 온보딩 메시지와 순서를 재설계했다.',
    '개선 전보다 핵심 전환율이 높아졌고 팀의 실험 의사결정 시간이 줄었다.',
    '초기에는 메시지만 수정했지만 이탈 구간이 바뀌지 않아 정보 순서까지 다시 설계했다.',
    '다시 한다면 실험 전 성공 지표와 중단 기준을 더 명확히 합의한다. 이후 근거가 확인된 최소 단위부터 검증하는 것을 업무 기준으로 삼았다.',
    toJson(['전환율 개선', '실험 의사결정 시간 단축']), toJson(['문제해결', '협업', '주도성']), timestamp,
  );

  database.prepare(`INSERT INTO job_posts
    (id, company, role, url, deadline, status, application_type, company_type, submission_status, result_status, fit_score, description, requirements, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'job-naver-pm', '네이버', 'Product Manager', '', '2026-09-11', 'researching', '서류접수', '대기업', '작성중', '아직', 86,
    '사용자 문제를 정의하고 데이터 기반으로 제품 개선을 주도하는 역할',
    toJson(['제품 전략', '데이터 분석', '유관부서 협업']), '샘플 데이터', timestamp, timestamp,
  );

  const prompts = [
    ['prompt-news', 'news', '산업 뉴스 브리핑', '관심 분야 {{interests}}와 목표 직무 {{target_roles}}에 직접 영향을 주는 최근 뉴스만 조사하라. 각 항목에 날짜, 출처 URL, 왜 중요한지, 채용 준비에 반영할 행동을 포함하라.', ['interests', 'target_roles']],
    ['prompt-jobs', 'jobs', '맞춤 채용공고 선별', '사용자 프로필과 경험 카드를 기준으로 채용공고를 비교하라. 필수 역량, 우대 역량, 경험 매칭 근거, 부족한 점, 지원 우선순위를 구조화하라.', ['profile', 'experiences', 'job_posts']],
    ['prompt-company', 'company', '기업·직무 심층 조사', '대상 기업 {{company}}와 직무 {{role}}를 공식 자료 중심으로 조사하라. 사업 방향, 최근 변화, 직무 핵심 과제, 자소서에 사용할 수 있는 근거와 출처를 분리해 작성하라.', ['company', 'role']],
    ['prompt-writer', 'writer', '근거 기반 자소서 작성', frameworkWriterPrompt, ['question', 'target_chars', 'experiences', 'research']],
    ['prompt-review', 'review', '자소서 교차 검수', '초안을 직무 적합성, 구체성, 근거성, 기업 이해도, 문장 자연스러움, 과장 위험으로 평가하라. 점수와 문장별 수정 제안을 분리하고, 사실 근거가 없는 표현은 표시하라.', ['draft', 'job', 'research']],
    ['prompt-interview', 'interview', '기업별 예상 면접 질문·답안', '채용공고, 기업 조사, 사용자의 경험 카드를 교차해 실제 면접에서 나올 가능성이 높은 질문을 만든다. 답안은 결론부터 말하고 상황/문제/내 역할/판단/행동/결과/회고 중 필요한 근거만 사용한다. 경험 카드에 없는 회사명, 수치, 행동을 만들지 말고 답할 근거가 부족하면 [내 경험 입력 필요]라고 명확히 표시한다. 질문은 JD 검증, 기업·직무 이해, 경험 검증, 꼬리질문 대응이 균형을 이루게 구성한다.', ['job', 'research', 'experiences', 'existing_questions']],
  ];
  const insertPrompt = database.prepare(`INSERT INTO prompt_templates
    (id, agent_id, name, body, variables, version, is_active, updated_at) VALUES (?, ?, ?, ?, ?, 1, 1, ?)`);
  const insertPromptVersion = database.prepare(`INSERT INTO prompt_versions
    (id, template_id, version, body, created_at) VALUES (?, ?, 1, ?, ?)`);
  for (const [id, agentId, name, body, variables] of prompts) {
    insertPrompt.run(id, agentId, name, body, toJson(variables), timestamp);
    insertPromptVersion.run(randomUUID(), id, body, timestamp);
  }

  database.prepare(`INSERT INTO harness_configs (id, name, provider_map, config, updated_at)
    VALUES (?, ?, ?, ?, ?)`).run(
    'harness-default', '구독 전용 커리어 파이프라인',
    toJson({ news: 'codex', jobs: 'codex', company: 'claude', writer: 'codex', review: 'claude', interview: 'codex' }),
    toJson({ maxTurns: 6, timeoutMinutes: 12, sandbox: 'read-only', evidenceRequired: true, approvalBeforeDraft: true, retryCount: 0, onUsageLimit: 'pause', writingBlueprint: { tone: '담백한 실무형', structure: '결론 → 문제 → 판단 → 행동 → 변화 → 직무 연결', evidenceDensity: 3, preferredTags: ['문제해결', '주도성'], bannedExpressions: ['열정적인', '최선을 다해', '귀사'], reviewPasses: 2 } }), timestamp,
  );

  const essayId = 'essay-sample';
  const initialDraft = '저는 낯선 문제를 구조화하고, 팀이 실행할 수 있는 언어로 바꾸는 사람입니다. 프로젝트에서 사용자 행동 데이터를 분석해 이탈 구간을 정의했고, 실험 우선순위를 조정해 전환율을 개선했습니다.';
  database.prepare(`INSERT INTO essay_projects
    (id, job_id, title, question, draft, target_chars, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    essayId, 'job-naver-pm', '네이버 PM 지원동기', '지원 동기와 입사 후 기여할 수 있는 점을 작성해 주세요.', initialDraft, 700, 'draft', timestamp, timestamp,
  );
  database.prepare(`INSERT INTO essay_versions
    (id, essay_id, version, content, chars_with_spaces, chars_without_spaces, note, created_at)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?)`).run(
    randomUUID(), essayId, initialDraft, initialDraft.length, initialDraft.replace(/\s/g, '').length, '초기 샘플', timestamp,
  );

  const insertInterview = database.prepare(`INSERT INTO interview_questions
    (id, job_id, category, question, answer_markdown, source, order_no, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?, 'starter', ?, ?, ?)`);
  insertInterview.run(randomUUID(), 'experience', '가장 복잡한 문제를 구조화하고 해결한 경험을 말씀해 주세요.', '## 답변 골격\n\n- **상황/맥락:** \n- **문제와 근거:** \n- **내 역할:** \n- **판단과 행동:** \n- **결과:** \n- **회고:** ', 10, timestamp, timestamp);
  insertInterview.run(randomUUID(), 'experience', '실패한 접근을 바꾸어 결과를 만든 경험이 있나요?', '## 답변 골격\n\n> 실패 자체보다 무엇을 관찰하고 판단을 바꿨는지에 집중합니다.\n\n- 처음 선택한 접근: \n- 예상과 달랐던 점: \n- 바꾼 판단과 행동: \n- 결과와 배운 기준: ', 20, timestamp, timestamp);
  insertInterview.run(randomUUID(), 'personality', '협업 중 의견 충돌을 해결한 방식을 말씀해 주세요.', '## 답변 골격\n\n- 충돌한 쟁점: \n- 상대의 우선순위: \n- 내가 확인한 공통 목표: \n- 합의한 기준과 결과: ', 10, timestamp, timestamp);
  insertInterview.run(randomUUID(), 'personality', '일할 때 가장 중요하게 지키는 기준은 무엇인가요?', '## 답변 골격\n\n**업무 기준 한 문장:** \n\n이 기준이 생긴 경험과 실제 행동을 연결해 설명합니다.', 20, timestamp, timestamp);
}

seed();
database.prepare("UPDATE experience_cards SET context = situation WHERE context = '' AND situation <> ''").run();
database.prepare("UPDATE experience_cards SET problem = task WHERE problem = '' AND task <> ''").run();
const defaultWriterPrompt = database.prepare('SELECT id, body, version FROM prompt_templates WHERE id = ?').get('prompt-writer');
if (defaultWriterPrompt?.body === legacyWriterPrompt) {
  const timestamp = now();
  const version = Number(defaultWriterPrompt.version) + 1;
  database.prepare('UPDATE prompt_templates SET body = ?, version = ?, updated_at = ? WHERE id = ?').run(frameworkWriterPrompt, version, timestamp, defaultWriterPrompt.id);
  database.prepare('INSERT OR IGNORE INTO prompt_versions (id, template_id, version, body, created_at) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), defaultWriterPrompt.id, version, frameworkWriterPrompt, timestamp);
}
const defaultHarness = database.prepare('SELECT id, config FROM harness_configs WHERE id = ?').get('harness-default');
if (defaultHarness) {
  const config = JSON.parse(defaultHarness.config);
  if (!config.writingBlueprint) {
    config.writingBlueprint = { tone: '담백한 실무형', structure: '결론 → 문제 → 판단 → 행동 → 변화 → 직무 연결', evidenceDensity: 3, preferredTags: ['문제해결', '주도성'], bannedExpressions: ['열정적인', '최선을 다해', '귀사'], reviewPasses: 2 };
    database.prepare('UPDATE harness_configs SET config = ?, updated_at = ? WHERE id = ?').run(toJson(config), now(), defaultHarness.id);
  }
  const harnessRow = database.prepare('SELECT provider_map FROM harness_configs WHERE id = ?').get(defaultHarness.id);
  const providerMap = JSON.parse(harnessRow.provider_map);
  if (!providerMap.interview) {
    providerMap.interview = 'codex';
    database.prepare('UPDATE harness_configs SET provider_map = ?, updated_at = ? WHERE id = ?').run(toJson(providerMap), now(), defaultHarness.id);
  }
}
if (!database.prepare("SELECT id FROM prompt_templates WHERE agent_id = 'interview' LIMIT 1").get()) {
  const timestamp = now();
  const body = '채용공고, 기업 조사, 사용자의 경험 카드를 교차해 실제 면접에서 나올 가능성이 높은 질문을 만든다. 답안은 결론부터 말하고 상황/문제/내 역할/판단/행동/결과/회고 중 필요한 근거만 사용한다. 경험 카드에 없는 회사명, 수치, 행동을 만들지 말고 답할 근거가 부족하면 [내 경험 입력 필요]라고 명확히 표시한다. 질문은 JD 검증, 기업·직무 이해, 경험 검증, 꼬리질문 대응이 균형을 이루게 구성한다.';
  database.prepare(`INSERT INTO prompt_templates (id, agent_id, name, body, variables, version, is_active, updated_at) VALUES (?, 'interview', ?, ?, ?, 1, 1, ?)`).run('prompt-interview', '기업별 예상 면접 질문·답안', body, toJson(['job', 'research', 'experiences', 'existing_questions']), timestamp);
  database.prepare(`INSERT INTO prompt_versions (id, template_id, version, body, created_at) VALUES (?, 'prompt-interview', 1, ?, ?)`).run(randomUUID(), body, timestamp);
}
{
  const timestamp = now();
  const insertInterviewIfMissing = database.prepare(`INSERT INTO interview_questions
    (id, job_id, category, question, answer_markdown, source, order_no, created_at, updated_at)
    SELECT ?, NULL, ?, ?, ?, 'starter', ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM interview_questions WHERE job_id IS NULL AND category = ? AND question = ?)`);
  for (const item of [
    ['experience', '가장 복잡한 문제를 구조화하고 해결한 경험을 말씀해 주세요.', '## 답변 골격\n\n- **상황/맥락:** \n- **문제와 근거:** \n- **내 역할:** \n- **판단과 행동:** \n- **결과:** \n- **회고:** ', 10],
    ['experience', '실패한 접근을 바꾸어 결과를 만든 경험이 있나요?', '## 답변 골격\n\n> 실패 자체보다 무엇을 관찰하고 판단을 바꿨는지에 집중합니다.\n\n- 처음 선택한 접근: \n- 예상과 달랐던 점: \n- 바꾼 판단과 행동: \n- 결과와 배운 기준: ', 20],
    ['personality', '협업 중 의견 충돌을 해결한 방식을 말씀해 주세요.', '## 답변 골격\n\n- 충돌한 쟁점: \n- 상대의 우선순위: \n- 내가 확인한 공통 목표: \n- 합의한 기준과 결과: ', 10],
    ['personality', '일할 때 가장 중요하게 지키는 기준은 무엇인가요?', '## 답변 골격\n\n**업무 기준 한 문장:** \n\n이 기준이 생긴 경험과 실제 행동을 연결해 설명합니다.', 20],
  ]) {
    insertInterviewIfMissing.run(randomUUID(), item[0], item[1], item[2], item[3], timestamp, timestamp, item[0], item[1]);
  }
}
database.exec('PRAGMA optimize');

export function jsonValue(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function mapRows(rows, jsonFields = []) {
  return rows.map((row) => {
    const next = { ...row };
    for (const field of jsonFields) next[field] = jsonValue(next[field], field === 'config' ? {} : []);
    return next;
  });
}

export function snapshot() {
  return {
    settings: Object.fromEntries(database.prepare('SELECT key, value FROM settings').all().map((row) => [row.key, row.value])),
    profile: mapRows(database.prepare('SELECT * FROM profiles LIMIT 1').all(), ['target_roles', 'interests'])[0] || null,
    experiences: mapRows(database.prepare('SELECT * FROM experience_cards ORDER BY updated_at DESC').all(), ['metrics', 'tags']),
    jobs: mapRows(database.prepare('SELECT * FROM job_posts ORDER BY deadline IS NULL, deadline, updated_at DESC').all(), ['requirements']),
    calendar: database.prepare('SELECT * FROM calendar_events ORDER BY starts_at, updated_at DESC').all(),
    research: mapRows(database.prepare('SELECT * FROM research_notes ORDER BY created_at DESC').all(), ['sources']),
    prompts: mapRows(database.prepare('SELECT * FROM prompt_templates ORDER BY agent_id').all(), ['variables']),
    harnesses: mapRows(database.prepare('SELECT * FROM harness_configs ORDER BY updated_at DESC').all(), ['provider_map', 'config']),
    essays: database.prepare('SELECT * FROM essay_projects ORDER BY updated_at DESC').all(),
    versions: database.prepare('SELECT * FROM essay_versions ORDER BY essay_id, version DESC').all(),
    interviews: database.prepare('SELECT * FROM interview_questions ORDER BY job_id IS NOT NULL, category, order_no, updated_at DESC').all(),
    runs: database.prepare('SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 50').all(),
    artifacts: mapRows(database.prepare('SELECT * FROM artifacts ORDER BY created_at DESC LIMIT 100').all(), ['metadata']),
  };
}

export function saveEssay(input) {
  const id = input.id || randomUUID();
  const timestamp = now();
  const content = String(input.draft || '');
  const existing = database.prepare('SELECT id FROM essay_projects WHERE id = ?').get(id);
  if (existing) {
    database.prepare(`UPDATE essay_projects SET job_id = ?, title = ?, question = ?, draft = ?, target_chars = ?, status = ?, updated_at = ? WHERE id = ?`).run(
      input.job_id || null, input.title || '제목 없는 자소서', input.question || '', content, Number(input.target_chars || 700), input.status || 'draft', timestamp, id,
    );
  } else {
    database.prepare(`INSERT INTO essay_projects (id, job_id, title, question, draft, target_chars, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, input.job_id || null, input.title || '제목 없는 자소서', input.question || '', content, Number(input.target_chars || 700), input.status || 'draft', timestamp, timestamp,
    );
  }
  const nextVersion = Number(database.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM essay_versions WHERE essay_id = ?').get(id).version);
  database.prepare(`INSERT INTO essay_versions (id, essay_id, version, content, chars_with_spaces, chars_without_spaces, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    randomUUID(), id, nextVersion, content, content.length, content.replace(/\s/g, '').length, input.note || '수동 저장', timestamp,
  );
  return { essay: database.prepare('SELECT * FROM essay_projects WHERE id = ?').get(id), versions: database.prepare('SELECT * FROM essay_versions WHERE essay_id = ? ORDER BY version DESC').all(id) };
}

export function saveInterviewQuestion(input) {
  const id = input.id || randomUUID();
  const timestamp = now();
  const jobId = input.job_id || null;
  const category = jobId ? 'company' : (input.category === 'personality' ? 'personality' : 'experience');
  const question = String(input.question || '').trim();
  if (!question) throw new Error('면접 질문을 입력해 주세요.');
  const orderNo = Number.isFinite(Number(input.order_no))
    ? Number(input.order_no)
    : Number(database.prepare('SELECT COALESCE(MAX(order_no), 0) + 10 AS next FROM interview_questions WHERE job_id IS ? AND category = ?').get(jobId, category).next);
  database.prepare(`INSERT INTO interview_questions
    (id, job_id, category, question, answer_markdown, source, order_no, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET job_id = excluded.job_id, category = excluded.category, question = excluded.question, answer_markdown = excluded.answer_markdown, source = excluded.source, order_no = excluded.order_no, updated_at = excluded.updated_at`).run(
    id, jobId, category, question, String(input.answer_markdown || ''), input.source || 'manual', orderNo, input.created_at || timestamp, timestamp,
  );
  return database.prepare('SELECT * FROM interview_questions WHERE id = ?').get(id);
}

export function deleteInterviewQuestion(id) {
  database.prepare('DELETE FROM interview_questions WHERE id = ?').run(id);
  return { ok: true };
}

export function saveGeneratedInterviewQuestions(jobId, rows) {
  if (!database.prepare('SELECT id FROM job_posts WHERE id = ?').get(jobId)) throw new Error('연결할 채용공고를 찾지 못했습니다.');
  const existingQuestions = new Set(
    database.prepare('SELECT question FROM interview_questions WHERE job_id = ?').all(jobId).map((item) => item.question.trim().toLowerCase()),
  );
  let orderNo = Number(database.prepare('SELECT COALESCE(MAX(order_no), 0) AS current FROM interview_questions WHERE job_id = ?').get(jobId).current);
  let saved = 0;
  for (const row of Array.isArray(rows) ? rows.slice(0, 12) : []) {
    const question = String(row?.question || '').trim();
    if (!question || existingQuestions.has(question.toLowerCase())) continue;
    orderNo += 10;
    saveInterviewQuestion({
      job_id: jobId,
      category: 'company',
      question,
      answer_markdown: String(row?.answer_markdown || row?.answer || ''),
      source: 'agent',
      order_no: orderNo,
    });
    existingQuestions.add(question.toLowerCase());
    saved += 1;
  }
  return saved;
}

export function saveProfile(input) {
  const id = input.id || 'me';
  const timestamp = now();
  database.prepare(`INSERT INTO profiles (id, display_name, target_roles, interests, summary, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, target_roles = excluded.target_roles, interests = excluded.interests, summary = excluded.summary, updated_at = excluded.updated_at`).run(
    id, input.display_name || '사용자', toJson(input.target_roles || []), toJson(input.interests || []), input.summary || '', timestamp,
  );
  return mapRows(database.prepare('SELECT * FROM profiles WHERE id = ?').all(id), ['target_roles', 'interests'])[0];
}

export function saveExperience(input) {
  const id = input.id || randomUUID();
  const timestamp = now();
  const context = input.context ?? input.situation ?? '';
  const problem = input.problem ?? input.task ?? '';
  database.prepare(`INSERT INTO experience_cards
    (id, title, context, problem, role_scope, judgment, situation, task, action, result, trial_error, reflection, metrics, tags, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, context = excluded.context, problem = excluded.problem, role_scope = excluded.role_scope, judgment = excluded.judgment, situation = excluded.situation, task = excluded.task, action = excluded.action, result = excluded.result, trial_error = excluded.trial_error, reflection = excluded.reflection, metrics = excluded.metrics, tags = excluded.tags, updated_at = excluded.updated_at`).run(
    id, input.title || '제목 없는 경험', context, problem, input.role_scope || '', input.judgment || '', context, problem,
    input.action || '', input.result || '', input.trial_error || '', input.reflection || '', toJson(input.metrics || []), toJson(input.tags || []), timestamp,
  );
  return mapRows(database.prepare('SELECT * FROM experience_cards WHERE id = ?').all(id), ['metrics', 'tags'])[0];
}

export function saveJob(input) {
  const id = input.id || randomUUID();
  const timestamp = now();
  const createdAt = input.created_at || timestamp;
  const current = database.prepare('SELECT * FROM job_posts WHERE id = ?').get(id);
  database.prepare(`INSERT INTO job_posts
    (id, company, role, url, deadline, status, application_type, company_type, submission_status, result_status, fit_score, description, requirements, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET company = excluded.company, role = excluded.role, url = excluded.url, deadline = excluded.deadline, status = excluded.status, application_type = excluded.application_type, company_type = excluded.company_type, submission_status = excluded.submission_status, result_status = excluded.result_status, fit_score = excluded.fit_score, description = excluded.description, requirements = excluded.requirements, source = excluded.source, updated_at = excluded.updated_at`).run(
    id, input.company || current?.company || '회사 미정', input.role || current?.role || '직무 미정', input.url ?? current?.url ?? '', input.deadline || current?.deadline || null,
    input.status || current?.status || 'saved', input.application_type || current?.application_type || '서류접수', input.company_type || current?.company_type || '미분류',
    input.submission_status || current?.submission_status || '미제출', input.result_status || current?.result_status || '아직', Number(input.fit_score ?? current?.fit_score ?? 0),
    input.description ?? current?.description ?? '', toJson(input.requirements ?? jsonValue(current?.requirements, [])), input.source ?? current?.source ?? '', current?.created_at || createdAt, timestamp,
  );
  return mapRows(database.prepare('SELECT * FROM job_posts WHERE id = ?').all(id), ['requirements'])[0];
}

export function saveCalendarEvent(input) {
  const timestamp = now();
  const job = input.job_id ? database.prepare('SELECT * FROM job_posts WHERE id = ?').get(input.job_id) : null;
  const linkedJobId = job?.id || null;
  const existing = input.id
    ? database.prepare('SELECT id FROM calendar_events WHERE id = ?').get(input.id)
    : linkedJobId
      ? database.prepare('SELECT id FROM calendar_events WHERE job_id = ?').get(linkedJobId)
      : null;
  const id = existing?.id || input.id || randomUUID();
  const startsAt = String(input.starts_at || job?.deadline || '');
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) throw new Error('올바른 일정 날짜가 필요합니다.');
  const company = String(input.company || job?.company || '회사 미정');
  const role = String(input.role || job?.role || '직무 미정');
  database.prepare(`INSERT INTO calendar_events
    (id, job_id, title, company, role, event_type, starts_at, all_day, source_url, memo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET job_id = excluded.job_id, title = excluded.title, company = excluded.company, role = excluded.role, event_type = excluded.event_type, starts_at = excluded.starts_at, all_day = excluded.all_day, source_url = excluded.source_url, memo = excluded.memo, updated_at = excluded.updated_at`).run(
    id, linkedJobId, input.title || `${company} · ${role} 지원 마감`, company, role, input.event_type || 'deadline',
    new Date(startsAt).toISOString(), input.all_day === false ? 0 : 1, input.source_url || job?.url || '', input.memo || '', input.created_at || timestamp, timestamp,
  );
  return database.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
}

export function saveResearch(input) {
  const id = input.id || randomUUID();
  const timestamp = now();
  database.prepare(`INSERT INTO research_notes (id, job_id, kind, title, body, sources, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET job_id = excluded.job_id, kind = excluded.kind, title = excluded.title, body = excluded.body, sources = excluded.sources, provider = excluded.provider`).run(
    id, input.job_id || null, input.kind || 'company', input.title || '제목 없는 조사', input.body || '', toJson(input.sources || []), input.provider || '', input.created_at || timestamp,
  );
  return mapRows(database.prepare('SELECT * FROM research_notes WHERE id = ?').all(id), ['sources'])[0];
}

export function savePrompt(input) {
  const id = input.id || randomUUID();
  const timestamp = now();
  const current = database.prepare('SELECT version FROM prompt_templates WHERE id = ?').get(id);
  const version = current ? Number(current.version) + 1 : 1;
  if (current) {
    database.prepare(`UPDATE prompt_templates SET agent_id = ?, name = ?, body = ?, variables = ?, version = ?, is_active = ?, updated_at = ? WHERE id = ?`).run(
      input.agent_id, input.name, input.body, toJson(input.variables || []), version, input.is_active === false ? 0 : 1, timestamp, id,
    );
  } else {
    database.prepare(`INSERT INTO prompt_templates (id, agent_id, name, body, variables, version, is_active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, input.agent_id, input.name, input.body, toJson(input.variables || []), version, input.is_active === false ? 0 : 1, timestamp,
    );
  }
  database.prepare(`INSERT INTO prompt_versions (id, template_id, version, body, created_at) VALUES (?, ?, ?, ?, ?)`).run(randomUUID(), id, version, input.body, timestamp);
  return database.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
}

export function saveHarness(input) {
  const id = input.id || randomUUID();
  const timestamp = now();
  database.prepare(`INSERT INTO harness_configs (id, name, provider_map, config, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, provider_map = excluded.provider_map, config = excluded.config, updated_at = excluded.updated_at`).run(
    id, input.name || '새 하네스', toJson(input.provider_map || {}), toJson(input.config || {}), timestamp,
  );
  return database.prepare('SELECT * FROM harness_configs WHERE id = ?').get(id);
}

export function createRun({ pipelineId, agentId, provider, prompt }) {
  const id = randomUUID();
  database.prepare(`INSERT INTO agent_runs (id, pipeline_id, agent_id, provider, status, prompt, created_at) VALUES (?, ?, ?, ?, 'queued', ?, ?)`).run(
    id, pipelineId || null, agentId, provider, prompt, now(),
  );
  return id;
}

export function updateRun(id, fields) {
  const allowed = ['status', 'output', 'error', 'started_at', 'finished_at'];
  const entries = Object.entries(fields).filter(([key]) => allowed.includes(key));
  if (!entries.length) return;
  const sql = `UPDATE agent_runs SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`;
  database.prepare(sql).run(...entries.map(([, value]) => value), id);
}

export function addRunEvent(runId, sequence, kind, payload) {
  database.prepare(`INSERT OR REPLACE INTO run_events (run_id, sequence, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    runId, sequence, kind, typeof payload === 'string' ? payload : toJson(payload), now(),
  );
}

export function runDetail(id) {
  return {
    run: database.prepare('SELECT * FROM agent_runs WHERE id = ?').get(id) || null,
    events: database.prepare('SELECT * FROM run_events WHERE run_id = ? ORDER BY sequence').all(id).map((event) => ({ ...event, payload: jsonValue(event.payload, event.payload) })),
  };
}

export function saveArtifact(input) {
  const id = randomUUID();
  database.prepare(`INSERT INTO artifacts (id, pipeline_id, run_id, kind, title, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, input.pipelineId || null, input.runId || null, input.kind, input.title, input.content, toJson(input.metadata || {}), now(),
  );
  return id;
}

function rows(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

export function mergeBackup(input) {
  const backup = input?.backup && typeof input.backup === 'object' ? input.backup : input;
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) throw new Error('올바른 Career Atelier 백업 JSON이 아닙니다.');
  if (backup.product && backup.product !== 'Career Atelier') throw new Error('Career Atelier에서 내보낸 백업만 가져올 수 있습니다.');
  const imported = { profile: 0, experiences: 0, jobs: 0, calendar: 0, research: 0, prompts: 0, harnesses: 0, essays: 0, versions: 0, interviews: 0, runs: 0, artifacts: 0 };
  const timestamp = now();

  database.exec('BEGIN IMMEDIATE');
  try {
    if (backup.profile && typeof backup.profile === 'object') {
      saveProfile(backup.profile);
      imported.profile = 1;
    }
    for (const item of rows(backup.experiences)) {
      saveExperience(item);
      imported.experiences += 1;
    }
    for (const item of rows(backup.jobs)) {
      saveJob(item);
      imported.jobs += 1;
    }
    for (const item of rows(backup.calendar)) {
      const jobId = item.job_id && database.prepare('SELECT id FROM job_posts WHERE id = ?').get(item.job_id) ? item.job_id : null;
      saveCalendarEvent({ ...item, job_id: jobId });
      imported.calendar += 1;
    }
    for (const item of rows(backup.research)) {
      const jobId = item.job_id && database.prepare('SELECT id FROM job_posts WHERE id = ?').get(item.job_id) ? item.job_id : null;
      saveResearch({ ...item, job_id: jobId });
      imported.research += 1;
    }
    for (const item of rows(backup.prompts)) {
      if (!item.agent_id || !item.body) continue;
      savePrompt(item);
      imported.prompts += 1;
    }
    for (const item of rows(backup.harnesses)) {
      saveHarness(item);
      imported.harnesses += 1;
    }
    for (const item of rows(backup.essays)) {
      const id = item.id || randomUUID();
      const jobId = item.job_id && database.prepare('SELECT id FROM job_posts WHERE id = ?').get(item.job_id) ? item.job_id : null;
      const createdAt = item.created_at || timestamp;
      database.prepare(`INSERT INTO essay_projects (id, job_id, title, question, draft, target_chars, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET job_id = excluded.job_id, title = excluded.title, question = excluded.question, draft = excluded.draft, target_chars = excluded.target_chars, status = excluded.status, updated_at = excluded.updated_at`).run(
        id, jobId, item.title || '가져온 자소서', item.question || '', String(item.draft || ''), Number(item.target_chars || 700), item.status || 'draft', createdAt, item.updated_at || timestamp,
      );
      imported.essays += 1;
    }
    for (const item of rows(backup.versions)) {
      if (!item.essay_id || !database.prepare('SELECT id FROM essay_projects WHERE id = ?').get(item.essay_id)) continue;
      const content = String(item.content || '');
      const sameId = item.id && database.prepare('SELECT id FROM essay_versions WHERE id = ?').get(item.id);
      if (sameId) continue;
      const collision = database.prepare('SELECT id, content FROM essay_versions WHERE essay_id = ? AND version = ? LIMIT 1').get(item.essay_id, Number(item.version || 1));
      if (collision?.content === content) continue;
      const version = collision
        ? Number(database.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM essay_versions WHERE essay_id = ?').get(item.essay_id).version)
        : Number(item.version || 1);
      database.prepare(`INSERT INTO essay_versions (id, essay_id, version, content, chars_with_spaces, chars_without_spaces, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        item.id || randomUUID(), item.essay_id, version, content, content.length, content.replace(/\s/g, '').length,
        collision ? `[다른 기기 병합] ${item.note || ''}`.trim() : item.note || '다른 기기에서 가져옴', item.created_at || timestamp,
      );
      imported.versions += 1;
    }
    for (const item of rows(backup.interviews)) {
      const jobId = item.job_id && database.prepare('SELECT id FROM job_posts WHERE id = ?').get(item.job_id) ? item.job_id : null;
      if (item.id && database.prepare('SELECT id FROM interview_questions WHERE id = ?').get(item.id)) continue;
      saveInterviewQuestion({ ...item, job_id: jobId, category: jobId ? 'company' : item.category });
      imported.interviews += 1;
    }
    for (const item of rows(backup.runs)) {
      if (!item.id || database.prepare('SELECT id FROM agent_runs WHERE id = ?').get(item.id)) continue;
      const status = ['queued', 'running'].includes(item.status) ? 'cancelled' : item.status || 'completed';
      database.prepare(`INSERT INTO agent_runs (id, pipeline_id, agent_id, provider, status, prompt, output, error, started_at, finished_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        item.id, item.pipeline_id || null, item.agent_id || 'review', item.provider || 'codex', status, item.prompt || '', item.output || '',
        ['queued', 'running'].includes(item.status) ? '다른 기기 백업에서 중단된 실행으로 가져왔습니다.' : item.error || '', item.started_at || null, item.finished_at || timestamp, item.created_at || timestamp,
      );
      imported.runs += 1;
    }
    for (const item of rows(backup.artifacts)) {
      if (!item.id || database.prepare('SELECT id FROM artifacts WHERE id = ?').get(item.id)) continue;
      const runId = item.run_id && database.prepare('SELECT id FROM agent_runs WHERE id = ?').get(item.run_id) ? item.run_id : null;
      database.prepare(`INSERT INTO artifacts (id, pipeline_id, run_id, kind, title, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        item.id, item.pipeline_id || null, runId, item.kind || 'imported', item.title || '가져온 문서', item.content || '', toJson(item.metadata || {}), item.created_at || timestamp,
      );
      imported.artifacts += 1;
    }

    const putSafety = database.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
    putSafety.run('provider_mode', 'subscription_only', timestamp);
    putSafety.run('allow_api_keys', 'false', timestamp);
    putSafety.run('allow_paid_overage', 'false', timestamp);
    putSafety.run('on_limit', 'pause_until_reset', timestamp);
    database.exec('COMMIT');
    return { ok: true, mode: 'merge', imported, safetyPreserved: true };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

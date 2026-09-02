import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const testRoot = mkdtempSync(join(tmpdir(), 'career-atelier-verify-'));
const mockBin = join(testRoot, 'bin');
const dataDir = join(testRoot, 'data');
const port = 49000 + Math.floor(Math.random() * 900);
const baseUrl = `http://127.0.0.1:${port}`;
mkdirSync(mockBin, { recursive: true });
mkdirSync(dataDir, { recursive: true });

const codexMock = `#!/bin/sh
if [ "$1" = "--version" ]; then echo "codex-cli verify-mock";
elif [ "$1" = "login" ] && [ "$2" = "status" ]; then echo "Logged in using ChatGPT";
else case "$*" in
  *"CANCEL_ME"*) sleep 5; printf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"취소되지 않음"}}';;
  *"<interview_json>"*) printf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"<interview_json>[{\\"question\\":\\"이 직무에서 가장 중요한 판단 기준은 무엇인가요?\\",\\"answer_markdown\\":\\"## 답변 구조\\\\n- 고객 영향\\\\n- 기술적 타당성\\\\n- 실행 가능성\\"}]</interview_json>"}}';;
  *"<jobs_json>"*) printf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"맞춤 공고 확인\\n<jobs_json>[{\\"company\\":\\"검증회사\\",\\"role\\":\\"AI Product Manager\\",\\"url\\":\\"https://example.com/jobs/verified\\",\\"deadline\\":null,\\"fit_score\\":91,\\"description\\":\\"검증용 공고\\",\\"requirements\\":[\\"제품 전략\\"],\\"source\\":\\"공식 채용 페이지\\"}]</jobs_json>"}}';;
  *) printf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"Codex 구독 모의 작업 완료"}}';;
esac; fi
`;
const claudeMock = `#!/bin/sh
if [ "$1" = "--version" ]; then echo "Claude Code verify-mock";
elif [ "$1" = "auth" ] && [ "$2" = "status" ]; then printf '%s\\n' '{"authMethod":"oauth","subscriptionType":"max"}';
else printf '%s\\n' '{"type":"result","result":"Claude 구독 모의 작업 완료"}'; fi
`;
for (const [name, source] of [['codex', codexMock], ['claude', claudeMock]]) {
  const path = join(mockBin, name);
  writeFileSync(path, source, 'utf8');
  chmodSync(path, 0o755);
}

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PATH: `${mockBin}${delimiter}${process.env.PATH || ''}`,
    CAREER_ATELIER_DATA_DIR: dataDir,
    CAREER_ATELIER_PORT: String(port),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverError = '';
server.stderr.on('data', (chunk) => { serverError += chunk.toString(); });
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function api(path, options = {}) {
  const response = await fetch(baseUrl + path, { ...options, headers: { 'content-type': 'application/json' } });
  const value = await response.json();
  assert.equal(response.ok, true, JSON.stringify(value));
  return value;
}
async function waitFor(check, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const state = await api('/api/bootstrap');
      if (check(state)) return state;
    } catch {}
    await delay(80);
  }
  throw new Error(`${label} 시간 초과${serverError ? `: ${serverError}` : ''}`);
}

try {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { await api('/api/health'); break; } catch { await delay(50); }
    if (attempt === 99) throw new Error(`로컬 검증 서버를 시작하지 못했습니다: ${serverError}`);
  }
  const initial = await api('/api/bootstrap');
  const started = await api('/api/pipeline/start', {
    method: 'POST',
    body: JSON.stringify({ jobId: initial.jobs[0].id, essayId: initial.essays[0].id, harnessId: initial.harnesses[0].id }),
  });
  let state = await waitFor(
    (value) => value.artifacts.some((item) => item.pipeline_id === started.pipelineId && item.kind === 'approval_required'),
    '승인 게이트',
  );
  let runs = state.runs.filter((item) => item.pipeline_id === started.pipelineId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  assert.deepEqual(runs.map((item) => item.agent_id), ['news', 'jobs', 'company']);
  assert(runs.every((item) => item.status === 'completed'));

  await api(`/api/pipeline/${started.pipelineId}/approve`, { method: 'POST', body: '{}' });
  state = await waitFor(
    (value) => value.artifacts.some((item) => item.pipeline_id === started.pipelineId && item.kind === 'pipeline_complete'),
    '파이프라인 완료',
  );
  runs = state.runs.filter((item) => item.pipeline_id === started.pipelineId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  assert.deepEqual(runs.map((item) => item.agent_id), ['news', 'jobs', 'company', 'writer', 'review']);
  assert(runs.every((item) => item.status === 'completed'));
  assert(runs.find((item) => item.agent_id === 'writer')?.prompt.includes('[사용자 자소서 블루프린트]'));
  const kinds = state.artifacts.filter((item) => item.pipeline_id === started.pipelineId).map((item) => item.kind);
  for (const required of ['news', 'jobs', 'company', 'approval_required', 'approval_granted', 'writer', 'review', 'pipeline_complete']) assert(kinds.includes(required));
  assert(state.jobs.some((item) => item.url === 'https://example.com/jobs/verified' && item.fit_score === 91));
  assert(state.research.some((item) => item.kind === 'news'));
  assert(state.research.some((item) => item.kind === 'company'));
  const calendarJob = await api('/api/jobs/save', { method: 'POST', body: JSON.stringify({
    company: '캘린더 검증회사', role: 'Platform Engineer', url: 'https://example.com/jobs/calendar', deadline: '2026-10-15',
    description: '캘린더에서 저장한 JD 원문', requirements: ['분산 시스템'], source: '캘린더 직접 입력',
  }) });
  const calendarEvent = await api('/api/calendar/save', { method: 'POST', body: JSON.stringify({
    job_id: calendarJob.id, company: calendarJob.company, role: calendarJob.role, title: `${calendarJob.company} · ${calendarJob.role} 지원 마감`,
    starts_at: '2026-10-15T12:00:00.000Z', source_url: calendarJob.url, memo: calendarJob.description,
  }) });
  const progressedJob = await api('/api/jobs/save', { method: 'POST', body: JSON.stringify({
    ...calendarJob, application_type: '서류접수', company_type: '중견기업', submission_status: '제출 완료', result_status: '서류 합격',
  }) });
  assert.equal(progressedJob.submission_status, '제출 완료');
  assert.equal(progressedJob.result_status, '서류 합격');
  state = await api('/api/bootstrap');
  assert(state.calendar.some((item) => item.id === calendarEvent.id && item.job_id === calendarJob.id));
  assert(state.jobs.some((item) => item.id === calendarJob.id && item.company_type === '중견기업' && item.result_status === '서류 합격'));
  const linkedEssay = await api('/api/essays/save', { method: 'POST', body: JSON.stringify({ job_id: calendarJob.id, title: '캘린더 연결 자소서', question: '지원 동기', draft: '' }) });
  assert.equal(linkedEssay.essay.job_id, calendarJob.id);
  const frameworkExperience = await api('/api/experiences/save', { method: 'POST', body: JSON.stringify({
    title: '9단계 경험 구조 검증', context: '프로젝트 맥락', problem: '근거가 있는 문제', role_scope: '내가 맡은 범위', judgment: '대안 비교와 선택 이유',
    action: '직접 실행한 행동', result: 'Before / After 변화', trial_error: '실패한 접근', reflection: '다음 업무 기준', metrics: ['처리시간 20% 단축'], tags: ['문제해결', '주도성'],
  }) });
  assert.equal(frameworkExperience.context, '프로젝트 맥락');
  assert.equal(frameworkExperience.role_scope, '내가 맡은 범위');
  assert.equal(frameworkExperience.trial_error, '실패한 접근');
  assert.deepEqual(frameworkExperience.tags, ['문제해결', '주도성']);
  assert(initial.prompts.some((item) => item.agent_id === 'interview'));
  assert(initial.interviews.some((item) => item.job_id === null && item.category === 'experience'));
  const manualInterview = await api('/api/interviews/save', { method: 'POST', body: JSON.stringify({
    job_id: calendarJob.id, category: 'company', question: '수동 면접 질문', answer_markdown: '## 핵심\n- 직접 작성한 답변',
  }) });
  assert.equal(manualInterview.answer_markdown, '## 핵심\n- 직접 작성한 답변');
  const interviewRun = await api('/api/agents/run', { method: 'POST', body: JSON.stringify({
    agentId: 'interview', provider: 'codex', prompt: '예상 질문을 <interview_json> 형식으로 작성해 줘.', artifactMetadata: { jobId: calendarJob.id },
  }) });
  state = await waitFor(
    (value) => value.runs.some((item) => item.id === interviewRun.runId && item.status === 'completed')
      && value.interviews.some((item) => item.job_id === calendarJob.id && item.source === 'agent'),
    '면접 코치 저장',
  );
  assert(state.interviews.some((item) => item.id === manualInterview.id));
  assert(state.interviews.some((item) => item.job_id === calendarJob.id && item.answer_markdown.includes('답변 구조')));
  const cancellable = await api('/api/agents/run', { method: 'POST', body: JSON.stringify({ agentId: 'review', provider: 'codex', prompt: 'CANCEL_ME' }) });
  await api(`/api/runs/${cancellable.runId}/cancel`, { method: 'POST', body: '{}' });
  state = await waitFor((value) => value.runs.some((item) => item.id === cancellable.runId && item.status === 'cancelled'), '실행 취소');
  const exported = await api('/api/export');
  assert.equal(exported.settings.provider_mode, 'subscription_only');
  assert.equal(exported.settings.allow_api_keys, 'false');
  assert.equal(exported.settings.allow_paid_overage, 'false');
  const downloadResponse = await fetch(`${baseUrl}/api/export/download`);
  assert.match(downloadResponse.headers.get('content-disposition') || '', /attachment; filename="career-atelier-backup-/);
  const portableBackup = {
    ...exported,
    settings: { ...exported.settings, allow_api_keys: 'true', allow_paid_overage: 'true' },
    experiences: [...exported.experiences, {
      id: 'exp-portable-merge', title: '다른 기기 경험 병합 검증', situation: '새 컴퓨터로 이동했다.', task: '기존 데이터를 지우지 않고 경험을 가져와야 했다.',
      action: 'Career Atelier 백업 JSON을 병합했다.', result: '구독 안전 설정을 유지한 채 경험 카드가 추가됐다.', metrics: ['삭제 0건'], tags: ['기기 이전'],
    }],
  };
  const importResult = await api('/api/import/merge', { method: 'POST', body: JSON.stringify({ backup: portableBackup }) });
  assert.equal(importResult.safetyPreserved, true);
  state = await api('/api/bootstrap');
  const importedLegacyExperience = state.experiences.find((item) => item.id === 'exp-portable-merge');
  assert(importedLegacyExperience);
  assert.equal(importedLegacyExperience.context, importedLegacyExperience.situation);
  assert.equal(importedLegacyExperience.problem, importedLegacyExperience.task);
  assert.equal(state.settings.allow_api_keys, 'false');
  assert.equal(state.settings.allow_paid_overage, 'false');
  console.log('✓ build, calendar persistence, application progress matrix, writing blueprint handoff, interview markdown storage, interview-agent generation, job-to-essay link, nine-part experience framework, selectable tags, legacy experience migration, portable merge, job-board import, approval gate, five-agent handoff, cancellation, export, cost lock verified');
} finally {
  server.kill('SIGTERM');
}

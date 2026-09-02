import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import {
  addRunEvent,
  createRun,
  dataDir,
  database,
  databasePath,
  mergeBackup,
  runDetail,
  saveArtifact,
  saveCalendarEvent,
  saveEssay,
  saveExperience,
  deleteInterviewQuestion,
  saveGeneratedInterviewQuestions,
  saveInterviewQuestion,
  saveHarness,
  saveJob,
  savePrompt,
  saveProfile,
  saveResearch,
  snapshot,
  updateRun,
} from './db.mjs';

const host = '127.0.0.1';
const port = Number(process.env.CAREER_ATELIER_PORT || 48620);
const allowedOrigins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
const activeProcesses = new Map();
const cancelledRuns = new Set();
const sensitiveApiVariables = [
  'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY',
];

function childEnvironment() {
  const environment = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
  for (const key of sensitiveApiVariables) delete environment[key];
  return environment;
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  const acceptedOrigin = allowedOrigins.has(origin) ? origin : 'http://localhost:3000';
  return {
    'Access-Control-Allow-Origin': acceptedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

function sendJson(response, status, value, request) {
  response.writeHead(status, corsHeaders(request));
  response.end(JSON.stringify(value));
}

function sendJsonDownload(response, value, request) {
  const date = new Date().toISOString().slice(0, 10);
  response.writeHead(200, { ...corsHeaders(request), 'Content-Disposition': `attachment; filename="career-atelier-backup-${date}.json"` });
  response.end(JSON.stringify(value, null, 2));
}

async function readBody(request, maxBytes = 2_000_000) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > maxBytes) throw new Error(`요청 본문이 ${Math.round(maxBytes / 1_000_000)}MB를 초과했습니다.`);
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

function runCommand(command, args, { timeoutMs = 12_000 } = {}) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, { env: childEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => {
      clearTimeout(timer);
      resolveResult({ ok: false, code: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolveResult({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function classifyCodexAuth(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes('api key') || normalized.includes('api-key')) return { safe: false, mode: 'api_key', detail: text.trim() };
  if (normalized.includes('chatgpt') || normalized.includes('oauth')) return { safe: true, mode: 'subscription', detail: text.trim() };
  return { safe: false, mode: 'unknown', detail: text.trim() || '로그인 방식을 확인할 수 없습니다.' };
}

function classifyClaudeAuth(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes('api_key') || normalized.includes('api key') || normalized.includes('console')) return { safe: false, mode: 'api_key', detail: text.trim() };
  if (normalized.includes('claude.ai') || normalized.includes('oauth') || normalized.includes('subscription')) return { safe: true, mode: 'subscription', detail: 'Claude 구독 계정으로 로그인됨' };
  try {
    const parsed = JSON.parse(text);
    const method = String(parsed.authMethod || parsed.auth_method || '').toLowerCase();
    const subscription = parsed.subscriptionType || parsed.subscription_type;
    if (subscription || method.includes('oauth') || method.includes('claude.ai')) return { safe: true, mode: 'subscription', detail: 'Claude 구독 계정으로 로그인됨' };
  } catch {}
  return { safe: false, mode: 'unknown', detail: text.trim() || '로그인 방식을 확인할 수 없습니다.' };
}

async function providerStatus(provider) {
  if (provider === 'codex') {
    const [version, auth] = await Promise.all([runCommand('codex', ['--version']), runCommand('codex', ['login', 'status'])]);
    const classification = auth.ok ? classifyCodexAuth(`${auth.stdout}\n${auth.stderr}`) : { safe: false, mode: 'not_logged_in', detail: auth.stderr || auth.stdout };
    return { provider, installed: version.ok, version: version.stdout.trim(), auth: classification };
  }
  const [version, auth] = await Promise.all([runCommand('claude', ['--version']), runCommand('claude', ['auth', 'status', '--json'])]);
  const classification = auth.ok ? classifyClaudeAuth(`${auth.stdout}\n${auth.stderr}`) : { safe: false, mode: 'not_logged_in', detail: auth.stderr || auth.stdout };
  return { provider, installed: version.ok, version: version.stdout.trim(), auth: classification };
}

async function assertSubscriptionProvider(provider) {
  if (!['codex', 'claude'].includes(provider)) throw new Error('허용되지 않은 AI 제공자입니다.');
  const status = await providerStatus(provider);
  if (!status.installed) throw new Error(`${provider} CLI가 설치되어 있지 않습니다.`);
  if (!status.auth.safe) throw new Error(`${provider}의 구독 인증을 확인하지 못해 실행을 차단했습니다. 인증 모드: ${status.auth.mode}`);
  return status;
}

function extractOutput(provider, parsed, fallback) {
  if (provider === 'codex') {
    if (parsed?.type === 'item.completed' && parsed.item?.type === 'agent_message') return parsed.item.text || parsed.item.content || '';
    if (parsed?.type === 'message' && parsed.message?.role === 'assistant') return parsed.message.content || '';
  }
  if (provider === 'claude') {
    if (parsed?.type === 'result') return parsed.result || parsed.structured_output || '';
    if (parsed?.type === 'assistant' && parsed.message?.content) {
      return parsed.message.content.map((item) => item.text || '').join('');
    }
  }
  return fallback;
}

async function executeAgent({ pipelineId, agentId, provider, prompt, maxTurns = 6, timeoutMinutes = 12 }) {
  const runId = createRun({ pipelineId, agentId, provider, prompt });
  try {
    await assertSubscriptionProvider(provider);
  } catch (error) {
    updateRun(runId, { status: 'blocked_auth', error: error.message, finished_at: new Date().toISOString() });
    addRunEvent(runId, 0, 'lifecycle', { status: 'blocked_auth', error: error.message });
    throw Object.assign(error, { runId, status: 'blocked_auth' });
  }
  const workspace = resolve(dataDir, 'workspaces', runId);
  mkdirSync(workspace, { recursive: true });
  const startedAt = new Date().toISOString();
  updateRun(runId, { status: 'running', started_at: startedAt });
  addRunEvent(runId, 0, 'lifecycle', { status: 'running', agentId, provider });

  const codexArgs = ['exec', '--json', '--ephemeral', '--ignore-user-config', '--sandbox', 'read-only', '--skip-git-repo-check', prompt];
  const needsSearch = ['news', 'jobs', 'company', 'interview'].includes(agentId);
  const args = provider === 'codex'
    ? (needsSearch ? ['--search', ...codexArgs] : codexArgs)
    : ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'plan', '--max-turns', String(Math.max(1, Math.min(12, maxTurns))), '--allowedTools', 'WebSearch,WebFetch,Read,Glob,Grep'];

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(provider, args, { cwd: workspace, env: childEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
    activeProcesses.set(runId, child);
    let buffer = '';
    let stderr = '';
    let sequence = 1;
    let finalOutput = '';
    let paidOverageBlocked = false;
    const safeTimeoutMinutes = Math.max(3, Math.min(30, Number(timeoutMinutes) || 12));
    const timeout = setTimeout(() => child.kill('SIGTERM'), safeTimeoutMinutes * 60 * 1000);

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let parsed;
        try { parsed = JSON.parse(line); } catch { parsed = { type: 'text', text: line }; }
        addRunEvent(runId, sequence++, parsed.type || 'event', parsed);
        if (provider === 'claude' && parsed.type === 'rate_limit_event') {
          const info = parsed.rate_limit_info || {};
          const overageAvailable = info.isUsingOverage === true || (info.overageStatus && info.overageStatus !== 'rejected');
          if (overageAvailable) {
            paidOverageBlocked = true;
            addRunEvent(runId, sequence++, 'safety_block', { reason: 'paid_overage_available', message: '유료 초과 사용 가능성이 감지되어 실행을 중단했습니다.' });
            child.kill('SIGTERM');
          }
        }
        const candidate = extractOutput(provider, parsed, '');
        if (candidate) finalOutput = typeof candidate === 'string' ? candidate : JSON.stringify(candidate, null, 2);
      }
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      addRunEvent(runId, sequence++, 'stderr', { text: text.slice(0, 4000) });
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      activeProcesses.delete(runId);
      updateRun(runId, { status: 'failed', error: error.message, finished_at: new Date().toISOString() });
      rejectRun(Object.assign(error, { runId }));
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      activeProcesses.delete(runId);
      const wasCancelled = cancelledRuns.delete(runId);
      if (buffer.trim()) {
        let parsed;
        try { parsed = JSON.parse(buffer); } catch { parsed = { type: 'text', text: buffer }; }
        addRunEvent(runId, sequence++, parsed.type || 'event', parsed);
        const candidate = extractOutput(provider, parsed, buffer);
        if (candidate) finalOutput = typeof candidate === 'string' ? candidate : JSON.stringify(candidate, null, 2);
      }
      const finishedAt = new Date().toISOString();
      if (wasCancelled) {
        const errorText = '사용자가 실행을 중단했습니다.';
        updateRun(runId, { status: 'cancelled', output: finalOutput, error: errorText, finished_at: finishedAt });
        addRunEvent(runId, sequence, 'lifecycle', { status: 'cancelled' });
        rejectRun(Object.assign(new Error(errorText), { runId, status: 'cancelled' }));
      } else if (paidOverageBlocked) {
        const errorText = '유료 초과 사용 가능성이 감지되어 Subscription Only Lock이 실행을 중단했습니다.';
        updateRun(runId, { status: 'blocked_paid_overage', output: finalOutput, error: errorText, finished_at: finishedAt });
        addRunEvent(runId, sequence, 'lifecycle', { status: 'blocked_paid_overage' });
        rejectRun(Object.assign(new Error(errorText), { runId, status: 'blocked_paid_overage' }));
      } else if (code === 0 && finalOutput) {
        updateRun(runId, { status: 'completed', output: finalOutput, finished_at: finishedAt });
        addRunEvent(runId, sequence, 'lifecycle', { status: 'completed' });
        resolveRun({ runId, output: finalOutput });
      } else {
        const errorText = stderr || `프로세스가 code=${code}, signal=${signal || 'none'}로 종료되었습니다.`;
        const usageLimited = /usage limit|rate limit|reset/i.test(errorText);
        const status = usageLimited ? 'waiting_for_reset' : 'failed';
        updateRun(runId, { status, output: finalOutput, error: errorText.slice(0, 12000), finished_at: finishedAt });
        addRunEvent(runId, sequence, 'lifecycle', { status, code, signal });
        rejectRun(Object.assign(new Error(errorText), { runId, status }));
      }
    });
  });
}

function buildPipelinePrompt(stage, body, context, evidenceRequired = true, writingBlueprint = null) {
  const evidenceRule = evidenceRequired ? '\n- 제공된 자료와 실제로 확인한 출처만 사용한다.\n- 사실과 추론을 구분한다.' : '';
  const blueprintRule = writingBlueprint && ['writer', 'review'].includes(stage) ? `

[사용자 자소서 블루프린트]
- 문체 DNA: ${writingBlueprint.tone || '담백한 실무형'}
- 전개 구조: ${writingBlueprint.structure || '결론 → 문제 → 판단 → 행동 → 변화 → 직무 연결'}
- 문단당 근거 밀도: ${writingBlueprint.evidenceDensity || 3}/5
- 우선 활용 태그: ${(writingBlueprint.preferredTags || []).join(', ') || '지정 없음'}
- 금지 표현: ${(writingBlueprint.bannedExpressions || []).join(', ') || '지정 없음'}
- 검수 패스: ${writingBlueprint.reviewPasses || 2}회
작성 단계에서는 태그에 맞는 경험을 우선 선택하고 경험 카드 밖의 사실을 만들지 않는다. 검수 단계에서는 사실성, 직무 적합성, 문체 순서로 위 횟수만큼 점검한다.` : '';
  const jobsContract = stage === 'jobs' ? `\n\n[채용 보드 자동 저장 규격]\n확인한 공고만 아래 태그 사이에 JSON 배열로도 작성한다. URL을 확인하지 못한 공고는 넣지 않는다.\n<jobs_json>\n[{"company":"회사","role":"직무","url":"공고 원문 URL","deadline":"YYYY-MM-DD 또는 null","fit_score":0,"description":"요약","requirements":["요구 역량"],"source":"출처"}]\n</jobs_json>` : '';
  const guardrail = `\n\n[필수 규칙]${evidenceRule}\n- 결과는 한국어로 작성한다.\n- API 키 생성·요청·사용을 금지한다.\n- 결과 마지막에 다음 에이전트가 바로 사용할 수 있는 인계 요약을 작성한다.${jobsContract}`;
  return `${body}${blueprintRule}${guardrail}\n\n[현재 단계]\n${stage}\n\n[입력 컨텍스트]\n${JSON.stringify(context, null, 2).slice(0, 60_000)}`;
}

function taggedJsonArray(output, tag) {
  const match = String(output).match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, 'i'));
  if (!match) return [];
  try { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : []; } catch { return []; }
}

function saveDiscoveredJobs(output) {
  const rows = taggedJsonArray(output, 'jobs_json').slice(0, 30);
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !row.company || !row.role || !row.url) continue;
    let normalizedUrl;
    try { const candidate = new URL(String(row.url)); if (!['http:', 'https:'].includes(candidate.protocol)) continue; normalizedUrl = candidate.toString(); } catch { continue; }
    const existing = database.prepare('SELECT id FROM job_posts WHERE url = ? LIMIT 1').get(normalizedUrl);
    saveJob({
      id: existing?.id,
      company: String(row.company),
      role: String(row.role),
      url: normalizedUrl,
      deadline: row.deadline || null,
      status: 'saved',
      fit_score: Math.max(0, Math.min(100, Number(row.fit_score) || 0)),
      description: String(row.description || ''),
      requirements: Array.isArray(row.requirements) ? row.requirements.map(String) : [],
      source: String(row.source || '맞춤 채용 탐색 비서'),
    });
  }
  return rows.length;
}

async function executePipeline(pipelineId, input, { startAt = 0, restoredContext = null } = {}) {
  const state = snapshot();
  const harness = state.harnesses.find((item) => item.id === (input.harnessId || 'harness-default')) || state.harnesses[0];
  const providerMap = harness.provider_map;
  const maxTurns = harness.config.maxTurns || 6;
  const timeoutMinutes = harness.config.timeoutMinutes || 12;
  const selectedJob = state.jobs.find((job) => job.id === input.jobId) || state.jobs[0];
  const selectedEssay = state.essays.find((essay) => essay.id === input.essayId) || state.essays[0];
  const context = restoredContext || { profile: state.profile, experiences: state.experiences, job: selectedJob, essay: selectedEssay, artifacts: [] };
  const stages = ['news', 'jobs', 'company', 'writer', 'review'];
  for (let stageIndex = startAt; stageIndex < stages.length; stageIndex += 1) {
    const agentId = stages[stageIndex];
    if (agentId === 'writer' && startAt === 0 && harness.config.approvalBeforeDraft) {
      saveArtifact({
        pipelineId,
        kind: 'approval_required',
        title: '조사 완료 · 초안 작성 승인 필요',
        content: JSON.stringify({ input, context }),
        metadata: { nextAgent: 'writer', reason: 'approvalBeforeDraft' },
      });
      return { status: 'waiting_for_approval' };
    }
    const template = state.prompts.find((item) => item.agent_id === agentId && item.is_active) || state.prompts.find((item) => item.agent_id === agentId);
    if (!template) continue;
    const provider = providerMap[agentId] || 'codex';
    const prompt = buildPipelinePrompt(agentId, template.body, context, harness.config.evidenceRequired !== false, harness.config.writingBlueprint);
    try {
      const result = await executeAgent({ pipelineId, agentId, provider, prompt, maxTurns, timeoutMinutes });
      const artifact = { agentId, provider, output: result.output };
      context.artifacts.push(artifact);
      saveArtifact({ pipelineId, runId: result.runId, kind: agentId, title: template.name, content: result.output, metadata: { provider } });
      if (agentId === 'jobs') saveDiscoveredJobs(result.output);
      if (agentId === 'news' || agentId === 'company') {
        saveResearch({
          job_id: agentId === 'company' ? selectedJob?.id : null,
          kind: agentId,
          title: template.name,
          body: result.output,
          sources: [],
          provider,
        });
      }
      if (agentId === 'writer' && selectedEssay) {
        saveEssay({ ...selectedEssay, draft: result.output, note: `파이프라인 ${pipelineId} 자동 초안` });
      }
    } catch (error) {
      saveArtifact({ pipelineId, runId: error.runId, kind: 'pipeline_error', title: `${agentId} 단계 중단`, content: error.message, metadata: { agentId, status: error.status || 'failed' } });
      return { status: error.status || 'failed' };
    }
  }
  saveArtifact({
    pipelineId,
    kind: 'pipeline_complete',
    title: '전체 파이프라인 완료',
    content: '뉴스·채용·기업 조사와 자소서 작성·검수가 모두 끝났습니다.',
    metadata: { stages },
  });
  return { status: 'completed' };
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return sendJson(response, 204, {}, request);
  const url = new URL(request.url, `http://${host}:${port}`);
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const [codex, claude] = await Promise.all([providerStatus('codex'), providerStatus('claude')]);
      return sendJson(response, 200, {
        ok: true,
        mode: 'subscription_only',
        bind: `${host}:${port}`,
        databasePath,
        apiVariablesRemovedFromChildren: sensitiveApiVariables.filter((key) => Boolean(process.env[key])),
        providers: { codex, claude },
      }, request);
    }
    if (request.method === 'GET' && url.pathname === '/api/bootstrap') return sendJson(response, 200, snapshot(), request);
    if (request.method === 'GET' && url.pathname === '/api/export') return sendJson(response, 200, { exported_at: new Date().toISOString(), product: 'Career Atelier', ...snapshot() }, request);
    if (request.method === 'GET' && url.pathname === '/api/export/download') return sendJsonDownload(response, { exported_at: new Date().toISOString(), product: 'Career Atelier', ...snapshot() }, request);
    if (request.method === 'POST' && url.pathname === '/api/import/merge') return sendJson(response, 200, mergeBackup(await readBody(request, 20_000_000)), request);
    if (request.method === 'POST' && url.pathname === '/api/profile/save') return sendJson(response, 200, saveProfile(await readBody(request)), request);
    if (request.method === 'POST' && url.pathname === '/api/experiences/save') return sendJson(response, 200, saveExperience(await readBody(request)), request);
    if (request.method === 'POST' && url.pathname === '/api/jobs/save') return sendJson(response, 200, saveJob(await readBody(request)), request);
    if (request.method === 'POST' && url.pathname === '/api/calendar/save') return sendJson(response, 200, saveCalendarEvent(await readBody(request)), request);
    if (request.method === 'POST' && url.pathname === '/api/research/save') return sendJson(response, 200, saveResearch(await readBody(request)), request);
    if (request.method === 'POST' && url.pathname === '/api/essays/save') return sendJson(response, 200, saveEssay(await readBody(request)), request);
    if (request.method === 'POST' && url.pathname === '/api/interviews/save') return sendJson(response, 200, saveInterviewQuestion(await readBody(request)), request);
    if (request.method === 'POST' && url.pathname === '/api/interviews/delete') {
      const body = await readBody(request);
      if (!body.id) throw new Error('삭제할 면접 질문 id가 필요합니다.');
      return sendJson(response, 200, deleteInterviewQuestion(body.id), request);
    }
    if (request.method === 'POST' && url.pathname === '/api/prompts/save') return sendJson(response, 200, savePrompt(await readBody(request)), request);
    if (request.method === 'POST' && url.pathname === '/api/harnesses/save') return sendJson(response, 200, saveHarness(await readBody(request)), request);
    if (request.method === 'POST' && url.pathname === '/api/agents/run') {
      const body = await readBody(request);
      if (!body.agentId || !body.provider || !body.prompt) throw new Error('agentId, provider, prompt가 필요합니다.');
      const pipelineId = body.pipelineId || randomUUID();
      const task = executeAgent({ pipelineId, agentId: body.agentId, provider: body.provider, prompt: body.prompt, maxTurns: body.maxTurns, timeoutMinutes: body.timeoutMinutes });
      task.then((result) => {
        saveArtifact({
          pipelineId,
          runId: result.runId,
          kind: body.artifactKind || body.agentId,
          title: body.artifactTitle || `${body.agentId} 단독 작업`,
          content: result.output,
          metadata: { provider: body.provider, standalone: true, ...(body.artifactMetadata && typeof body.artifactMetadata === 'object' ? body.artifactMetadata : {}) },
        });
        if (body.agentId === 'news' || body.agentId === 'company') {
          saveResearch({
            job_id: body.agentId === 'company' ? body.artifactMetadata?.jobId || null : null,
            kind: body.agentId,
            title: body.artifactTitle || `${body.agentId} 단독 작업`,
            body: result.output,
            sources: [],
            provider: body.provider,
          });
        }
        if (body.agentId === 'interview' && body.artifactMetadata?.jobId) {
          const tagged = taggedJsonArray(result.output, 'interview_json');
          let parsed = tagged;
          if (!parsed.length) {
            try {
              const value = JSON.parse(result.output);
              parsed = Array.isArray(value) ? value : Array.isArray(value?.questions) ? value.questions : [];
            } catch {}
          }
          saveGeneratedInterviewQuestions(body.artifactMetadata.jobId, parsed);
        }
      }).catch(() => {});
      task.catch(() => {});
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
      const recent = database.prepare('SELECT id FROM agent_runs WHERE pipeline_id = ? ORDER BY created_at DESC LIMIT 1').get(pipelineId);
      return sendJson(response, 202, { ok: true, pipelineId, runId: recent?.id || null }, request);
    }
    if (request.method === 'POST' && url.pathname === '/api/pipeline/start') {
      const body = await readBody(request);
      const pipelineId = randomUUID();
      executePipeline(pipelineId, body).catch((error) => {
        saveArtifact({ pipelineId, kind: 'pipeline_error', title: '파이프라인 실행 오류', content: error.message, metadata: {} });
      });
      return sendJson(response, 202, { ok: true, pipelineId }, request);
    }
    const approveMatch = url.pathname.match(/^\/api\/pipeline\/([^/]+)\/approve$/);
    if (request.method === 'POST' && approveMatch) {
      const pipelineId = approveMatch[1];
      const alreadyApproved = database.prepare("SELECT id FROM artifacts WHERE pipeline_id = ? AND kind IN ('approval_granted', 'pipeline_complete') LIMIT 1").get(pipelineId);
      if (alreadyApproved) throw new Error('이미 승인되었거나 완료된 파이프라인입니다.');
      const waiting = database.prepare("SELECT content FROM artifacts WHERE pipeline_id = ? AND kind = 'approval_required' ORDER BY created_at DESC LIMIT 1").get(pipelineId);
      if (!waiting) throw new Error('승인을 기다리는 파이프라인을 찾지 못했습니다.');
      const saved = JSON.parse(waiting.content);
      saveArtifact({ pipelineId, kind: 'approval_granted', title: '초안 작성 승인됨', content: '사용자가 조사 결과를 확인하고 자소서 작성·검수 단계를 승인했습니다.', metadata: {} });
      executePipeline(pipelineId, saved.input || {}, { startAt: 3, restoredContext: saved.context }).catch((error) => {
        saveArtifact({ pipelineId, kind: 'pipeline_error', title: '승인 후 실행 오류', content: error.message, metadata: {} });
      });
      return sendJson(response, 202, { ok: true, pipelineId, resumedAt: 'writer' }, request);
    }
    const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (request.method === 'GET' && runMatch) return sendJson(response, 200, runDetail(runMatch[1]), request);
    const cancelMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/cancel$/);
    if (request.method === 'POST' && cancelMatch) {
      const child = activeProcesses.get(cancelMatch[1]);
      if (child) {
        cancelledRuns.add(cancelMatch[1]);
        child.kill('SIGTERM');
      }
      return sendJson(response, 200, { ok: Boolean(child) }, request);
    }
    return sendJson(response, 404, { error: '찾을 수 없는 로컬 API 경로입니다.' }, request);
  } catch (error) {
    return sendJson(response, 400, { error: error.message }, request);
  }
});

server.listen(port, host, () => {
  console.log(`Career Atelier companion: http://${host}:${port}`);
  console.log(`Subscription-only lock: active · data: ${databasePath}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of activeProcesses.values()) child.kill('SIGTERM');
    server.close(() => process.exit(0));
  });
}

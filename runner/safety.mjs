import { spawn } from 'node:child_process';

// v1(server/index.mjs)의 안전장치를 그대로 옮긴 것 — UI에서 끌 수 없는 코드
// 상수로만 존재해야 한다(§5, §6, §19.2 #10). 값을 DB/env로 노출하지 않는다.

export const SENSITIVE_API_VARIABLES = [
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  // Gemini(Antigravity CLI) — 이 변수들이 우연히 켜져 있으면 개인 계정
  // 대신 API 키/GCP 결제 계정 경로로 새서 구독 밖 과금이 날 수 있다.
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GENAI_USE_VERTEXAI',
  'GOOGLE_GENAI_USE_GCA',
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_APPLICATION_CREDENTIALS',
];

// §6 "LLM 남용 방지" 표의 값. 고정값이며 하네스/DB로 바꿀 수 없다.
export const DAILY_RUN_LIMIT = 40;
export const CONCURRENT_RUN_LIMIT = 1;
export const TIMEOUT_MINUTES_CAP = 15;
export const RETRY_COUNT = 0;
export const JOB_EXPIRY_HOURS = 6;
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_STALE_MS = 90_000;

export function childEnvironment() {
  const environment = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
  for (const key of SENSITIVE_API_VARIABLES) delete environment[key];
  return environment;
}

function runCommand(command, args, { timeoutMs = 12_000 } = {}) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, { env: childEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
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
  if (normalized.includes('api key') || normalized.includes('api-key')) {
    return { safe: false, mode: 'api_key', detail: text.trim() };
  }
  if (normalized.includes('chatgpt') || normalized.includes('oauth')) {
    return { safe: true, mode: 'subscription', detail: text.trim() };
  }
  return { safe: false, mode: 'unknown', detail: text.trim() || '로그인 방식을 확인할 수 없습니다.' };
}

function classifyClaudeAuth(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes('api_key') || normalized.includes('api key') || normalized.includes('console')) {
    return { safe: false, mode: 'api_key', detail: text.trim() };
  }
  if (normalized.includes('claude.ai') || normalized.includes('oauth') || normalized.includes('subscription')) {
    return { safe: true, mode: 'subscription', detail: 'Claude 구독 계정으로 로그인됨' };
  }
  try {
    const parsed = JSON.parse(text);
    const method = String(parsed.authMethod || parsed.auth_method || '').toLowerCase();
    const subscription = parsed.subscriptionType || parsed.subscription_type;
    if (subscription || method.includes('oauth') || method.includes('claude.ai')) {
      return { safe: true, mode: 'subscription', detail: 'Claude 구독 계정으로 로그인됨' };
    }
  } catch {
    // JSON이 아니면 아래 기본값으로 떨어진다.
  }
  return { safe: false, mode: 'unknown', detail: text.trim() || '로그인 방식을 확인할 수 없습니다.' };
}

// agy(Gemini/Antigravity CLI)는 codex/claude와 달리 "로그인 상태만 조용히
// 알려주는" 전용 서브커맨드가 없다(실측, 2026-09-01 — help에 login/auth
// 서브커맨드 자체가 없다). 대신 `agy models`(모델 목록 조회, LLM 추론 자체는
// 안 함 — 쿼터를 안 쓴다)의 성공 여부로 판별한다. childEnvironment()가 이미
// GEMINI_API_KEY 등 API/Vertex 경로에 필요한 환경변수를 전부 지우고 실행하므로,
// 그 상태에서 성공했다는 것 자체가 "API 키/Vertex 경로가 아니라 개인 계정
// OAuth로 인증됐다"는 근거가 된다(반대였다면 애초에 인증에 실패했을 것).
function classifyGeminiAuth(auth) {
  if (!auth.ok) {
    const text = (auth.stderr || auth.stdout || '').toLowerCase();
    if (text.includes('not logged in') || text.includes('ineligibletier')) {
      return { safe: false, mode: 'not_logged_in', detail: auth.stderr || auth.stdout || '로그인되어 있지 않습니다.' };
    }
    return { safe: false, mode: 'unknown', detail: auth.stderr || auth.stdout || '로그인 방식을 확인할 수 없습니다.' };
  }
  return { safe: true, mode: 'subscription', detail: '개인 Google 계정(OAuth)으로 로그인됨' };
}

export async function providerStatus(provider) {
  if (provider === 'codex') {
    const [version, auth] = await Promise.all([runCommand('codex', ['--version']), runCommand('codex', ['login', 'status'])]);
    const classification = auth.ok
      ? classifyCodexAuth(`${auth.stdout}\n${auth.stderr}`)
      : { safe: false, mode: 'not_logged_in', detail: auth.stderr || auth.stdout };
    return { provider, installed: version.ok, version: version.stdout.trim(), auth: classification };
  }
  if (provider === 'gemini') {
    const [version, auth] = await Promise.all([runCommand('agy', ['--version']), runCommand('agy', ['models'], { timeoutMs: 20_000 })]);
    return { provider, installed: version.ok, version: version.stdout.trim(), auth: classifyGeminiAuth(auth) };
  }
  const [version, auth] = await Promise.all([runCommand('claude', ['--version']), runCommand('claude', ['auth', 'status', '--json'])]);
  const classification = auth.ok
    ? classifyClaudeAuth(`${auth.stdout}\n${auth.stderr}`)
    : { safe: false, mode: 'not_logged_in', detail: auth.stderr || auth.stdout };
  return { provider, installed: version.ok, version: version.stdout.trim(), auth: classification };
}

export async function assertSubscriptionProvider(provider) {
  if (!['codex', 'claude', 'gemini'].includes(provider)) throw new Error('허용되지 않은 AI 제공자입니다.');
  const status = await providerStatus(provider);
  if (!status.installed) throw new Error(`${provider} CLI가 설치되어 있지 않습니다.`);
  if (!status.auth.safe) {
    throw new Error(`${provider}의 구독 인증을 확인하지 못해 실행을 차단했습니다. 인증 모드: ${status.auth.mode}`);
  }
  return status;
}

// Claude의 rate_limit_event에서 유료 초과 사용 가능성을 감지한다 — 감지되면
// 호출자는 즉시 프로세스를 죽이고 상태를 blocked_paid_overage로 남겨야 한다.
export function detectPaidOverage(parsedEvent) {
  if (parsedEvent?.type !== 'rate_limit_event') return false;
  const info = parsedEvent.rate_limit_info || {};
  return info.isUsingOverage === true || (info.overageStatus && info.overageStatus !== 'rejected');
}

// 구독 한도 도달(waiting_for_reset)인지, 그냥 실패(failed)인지 구분한다.
export function isUsageLimitError(text) {
  return /usage limit|rate limit|reset/i.test(text);
}

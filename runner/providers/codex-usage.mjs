import readline from 'node:readline';
import spawn from 'cross-spawn';
import { childEnvironment } from '../safety.mjs';

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeWindow(value) {
  const raw = asRecord(value);
  if (!raw || typeof raw.usedPercent !== 'number' || !Number.isFinite(raw.usedPercent)) return null;

  return {
    usedPercent: Math.min(Math.max(raw.usedPercent, 0), 100),
    windowDurationMins: typeof raw.windowDurationMins === 'number' && Number.isFinite(raw.windowDurationMins)
      ? Math.max(raw.windowDurationMins, 0)
      : null,
    resetsAt: typeof raw.resetsAt === 'number' && Number.isFinite(raw.resetsAt) ? raw.resetsAt : null,
  };
}

// App Server 응답에는 인증 정보도 섞일 수 있으므로, 화면에 필요한 한도 창만 골라
// 저장한다. 원문 전체를 DB에 옮기면 웹이 자격 증명 경계에 가까워질 수 있다.
export function normalizeCodexRateLimits(value) {
  const root = asRecord(value);
  if (!root) return null;

  const byLimitId = asRecord(root.rateLimitsByLimitId);
  const legacy = asRecord(root.rateLimits);
  const entries = byLimitId
    ? Object.entries(byLimitId)
    : legacy
      ? [[typeof legacy.limitId === 'string' ? legacy.limitId : 'codex', legacy]]
      : [];
  const normalized = {};

  for (const [limitId, rawLimit] of entries) {
    const limit = asRecord(rawLimit);
    if (!limit) continue;
    const primary = normalizeWindow(limit.primary);
    const secondary = normalizeWindow(limit.secondary);
    if (!primary && !secondary) continue;

    normalized[limitId] = {
      limitName: typeof limit.limitName === 'string' && limit.limitName.trim() ? limit.limitName.trim() : null,
      primary,
      secondary,
    };
  }

  return Object.keys(normalized).length ? { rateLimitsByLimitId: normalized } : null;
}

// `codex exec --json`은 작업별 토큰만 주므로 구독 한도를 알 수 없다. 같은 로컬
// 로그인 세션을 쓰는 App Server에 읽기 전용 RPC를 보내 실제 한도 창을 확인한다.
// 매번 짧게 열고 닫아 러너 종료·재시작 때 남는 별도 데몬을 만들지 않는다.
export function readCodexRateLimits({ timeoutMs = 12_000, spawnProcess = spawn } = {}) {
  return new Promise((resolve) => {
    const child = spawnProcess('codex', ['app-server'], {
      env: childEnvironment(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.on('error', () => {});

    let settled = false;
    const timer = setTimeout(() => finish(null), timeoutMs);
    const lines = readline.createInterface({ input: child.stdout });

    function finish(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      lines.close();
      child.stdin.end();
      if (!child.killed) child.kill('SIGTERM');
      resolve(value);
    }

    function send(message) {
      if (!child.stdin.destroyed) child.stdin.write(`${JSON.stringify(message)}\n`);
    }

    lines.on('line', (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }

      if (message.id === 1) {
        if (message.error) return finish(null);
        send({ method: 'initialized', params: {} });
        send({ method: 'account/rateLimits/read', id: 2, params: {} });
        return;
      }
      if (message.id === 2) finish(message.error ? null : normalizeCodexRateLimits(message.result));
    });

    child.stderr.resume();
    child.once('error', () => finish(null));
    child.once('close', () => {
      // 인증이 없거나 구형 CLI여도 러너를 멈추지 않고, 화면만 "측정값 없음"으로 둔다.
      finish(null);
    });

    send({
      method: 'initialize',
      id: 1,
      params: {
        clientInfo: {
          name: 'career_atelier_runner',
          title: 'Career Atelier Runner',
          version: '0.2.0-beta.1',
        },
      },
    });
  });
}

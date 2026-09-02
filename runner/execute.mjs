import { spawnClaude, extractOutput as extractClaudeOutput } from './providers/claude.mjs';
import { spawnCodex, extractOutput as extractCodexOutput } from './providers/codex.mjs';
import { spawnGemini, extractOutput as extractGeminiOutput } from './providers/gemini.mjs';
import { TIMEOUT_MINUTES_CAP, detectPaidOverage, isUsageLimitError } from './safety.mjs';

const PROVIDERS = {
  codex: { spawn: spawnCodex, extractOutput: extractCodexOutput },
  claude: { spawn: spawnClaude, extractOutput: extractClaudeOutput },
  gemini: { spawn: spawnGemini, extractOutput: extractGeminiOutput },
};

const EVENT_FLUSH_MS = 200;

function flushBuffer(supabase, runId, ownerId, buffer) {
  if (buffer.length === 0) return;
  const rows = buffer.splice(0, buffer.length).map((event) => ({
    owner_id: ownerId,
    run_id: runId,
    sequence: event.sequence,
    kind: event.kind,
    payload: event.payload,
  }));
  void supabase
    .from('run_events')
    .insert(rows)
    .then(({ error }) => {
      if (error) console.error('run_events insert 실패:', error.message);
    });
}

// 프로바이더 공통 실행기(codex/claude/gemini) — 스트림 파싱·200ms 배칭·
// 타임아웃·유료 초과 감지·취소를 여기서 한 번만 구현한다 (§4, §6, §19.2 #8).
// index.mjs와 테스트 스크립트 양쪽에서 그대로 재사용한다.
export function runProvider({
  supabase,
  provider,
  ownerId,
  runId,
  workspace,
  contextDir,
  prompt,
  model,
  effort,
  timeoutMinutes,
  outputSchema,
  jsonSchema,
}) {
  const safeTimeoutMinutes = Math.max(1, Math.min(TIMEOUT_MINUTES_CAP, Number(timeoutMinutes) || TIMEOUT_MINUTES_CAP));
  const child = PROVIDERS[provider].spawn({ workspace, contextDir, prompt, model, effort, outputSchema, jsonSchema });

  return new Promise((resolveRun) => {
    let buffer = '';
    let stderr = '';
    let sequence = 1;
    let finalOutput = '';
    let paidOverageBlocked = false;
    const eventBuffer = [];
    const flushTimer = setInterval(() => flushBuffer(supabase, runId, ownerId, eventBuffer), EVENT_FLUSH_MS);
    const timeout = setTimeout(() => child.kill('SIGTERM'), safeTimeoutMinutes * 60 * 1000);

    const extractOutput = PROVIDERS[provider].extractOutput;

    function handleLine(line) {
      if (!line.trim()) return;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        parsed = { type: 'text', text: line };
      }
      eventBuffer.push({ sequence: sequence++, kind: parsed.type || 'event', payload: parsed });
      // Codex는 rate_limit_event를 내지 않는다(§9 실측) — 나머지 스트리밍
      // 계열 프로바이더는 감지해둔다. detectPaidOverage 자체가
      // type!=='rate_limit_event'면 항상 false라 안전하다.
      if (provider !== 'codex' && detectPaidOverage(parsed)) {
        paidOverageBlocked = true;
        eventBuffer.push({
          sequence: sequence++,
          kind: 'safety_block',
          payload: { reason: 'paid_overage_available', message: '유료 초과 사용 가능성이 감지되어 실행을 중단했습니다.' },
        });
        child.kill('SIGTERM');
      }
      const candidate = extractOutput(parsed, '');
      if (candidate) finalOutput = typeof candidate === 'string' ? candidate : JSON.stringify(candidate, null, 2);
    }

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) handleLine(line);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      eventBuffer.push({ sequence: sequence++, kind: 'stderr', payload: { text: text.slice(0, 4000) } });
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      clearInterval(flushTimer);
      flushBuffer(supabase, runId, ownerId, eventBuffer);
      resolveRun({ status: 'failed', output: finalOutput, error: error.message });
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      clearInterval(flushTimer);
      if (buffer.trim()) handleLine(buffer);
      flushBuffer(supabase, runId, ownerId, eventBuffer);

      if (paidOverageBlocked) {
        resolveRun({ status: 'blocked_paid_overage', output: finalOutput, error: '유료 초과 사용 가능성이 감지되어 실행을 중단했습니다.' });
      } else if (code === 0 && finalOutput) {
        resolveRun({ status: 'completed', output: finalOutput, error: '' });
      } else {
        const errorText = stderr || `프로세스가 code=${code}, signal=${signal || 'none'}로 종료되었습니다.`;
        resolveRun({ status: isUsageLimitError(errorText) ? 'waiting_for_reset' : 'failed', output: finalOutput, error: errorText.slice(0, 12_000) });
      }
    });
  });
}

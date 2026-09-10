import { spawnClaude, extractOutput as extractClaudeOutput } from './providers/claude.mjs';
import { spawnCodex, extractOutput as extractCodexOutput } from './providers/codex.mjs';
import { spawnGemini, extractOutput as extractGeminiOutput, geminiResult } from './providers/gemini.mjs';
import { TIMEOUT_MINUTES_CAP, detectPaidOverage, isUsageLimitError } from './safety.mjs';
import { collectUsage } from './usage.mjs';
import { terminateManaged, terminationReason } from './lib/managed-process.mjs';
import { countPackReferences, summarizeReferences } from './pack-metrics.mjs';

const PROVIDERS = {
  codex: { spawn: spawnCodex, extractOutput: extractCodexOutput },
  claude: { spawn: spawnClaude, extractOutput: extractClaudeOutput },
  gemini: { spawn: spawnGemini, extractOutput: extractGeminiOutput },
};

const EVENT_FLUSH_MS = 200;

// Codex --json의 완료된 검색 이벤트는 item.completed 안의
// item.type='web_search'로 온다. item.started만 있고 실패한 요청이나 최종
// 문장에 "검색했다"고 쓴 것은 근거가 아니므로 완료 이벤트만 인정한다.
export function eventUsesWebSearch(event) {
  return event?.type === 'item.completed' && event?.item?.type === 'web_search';
}

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
  liveWebSearch = false,
  packFiles = [],
}, { spawnProvider = PROVIDERS[provider]?.spawn, scheduleTimeout = setTimeout } = {}) {
  const safeTimeoutMinutes = Math.max(1, Math.min(TIMEOUT_MINUTES_CAP, Number(timeoutMinutes) || TIMEOUT_MINUTES_CAP));
  const child = spawnProvider({ workspace, contextDir, prompt, model, effort, outputSchema, jsonSchema, liveWebSearch });

  return new Promise((resolveRun) => {
    let buffer = '';
    let stderr = '';
    let sequence = 1;
    let finalOutput = '';
    let paidOverageBlocked = false;
    let webSearchUsed = false;
    let providerError = '';
    const eventBuffer = [];
    const usageEvents = [];
    const packReferenceCounts = {};
    const finish = result => resolveRun({
      ...result,
      usage: collectUsage(usageEvents, provider),
      packReferences: summarizeReferences(packReferenceCounts, packFiles),
    });
    const flushTimer = setInterval(() => flushBuffer(supabase, runId, ownerId, eventBuffer), EVENT_FLUSH_MS);
    const terminate = reason => {
      void terminateManaged(child, reason).catch(error => { providerError = error.message; console.error(error.message); });
    };
    const timeout = scheduleTimeout(() => terminate('timeout'), safeTimeoutMinutes * 60 * 1000);

    const extractOutput = PROVIDERS[provider].extractOutput;

    function handleLine(line) {
      if (!line.trim()) return;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        parsed = { type: 'text', text: line };
      }
      eventBuffer.push({ sequence: sequence++, kind: parsed.type || parsed.event || 'event', payload: parsed });
      countPackReferences(line, parsed, packFiles, packReferenceCounts);
      const outcome = provider === 'gemini' ? geminiResult(parsed) : parsed;
      if (outcome?.usage || outcome?.model || outcome?.message?.model) usageEvents.push(outcome);
      if (parsed.type === 'result' && parsed.is_error) {
        providerError = JSON.stringify(parsed.errors || parsed.result || parsed.subtype);
      }
      if (provider === 'gemini' && outcome?.status && outcome.status !== 'SUCCESS') {
        providerError = String(outcome.error || `Gemini 실행 상태: ${outcome.status}`);
      }
      if (provider === 'claude' && parsed.type === 'result' && parsed.permission_denials?.length) {
        providerError = `Claude 도구 권한이 거부되었습니다: ${parsed.permission_denials.map(item => item.tool_name).join(', ')}`;
      }
      if (provider === 'codex' && eventUsesWebSearch(parsed)) webSearchUsed = true;
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
        terminate('paid_overage');
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
      finish({ status: 'failed', output: finalOutput, error: error.message, webSearchUsed });
    });
    child.once('close', async (code, signal) => {
      clearTimeout(timeout);
      clearInterval(flushTimer);
      if (buffer.trim()) handleLine(buffer);
      flushBuffer(supabase, runId, ownerId, eventBuffer);
      if (terminationReason(child)) {
        await terminateManaged(child).catch(error => { providerError = error.message; });
      }

      if (paidOverageBlocked) {
        finish({ status: 'blocked_paid_overage', output: finalOutput, error: '유료 초과 사용 가능성이 감지되어 실행을 중단했습니다.', webSearchUsed });
      } else if (terminationReason(child)) {
        finish({ status: 'failed', output: finalOutput, error: terminationReason(child) === 'timeout' ? 'CLI 실행 제한 시간을 초과해 프로세스 트리를 종료했습니다.' : '러너 종료로 CLI 실행을 중단했습니다.', webSearchUsed });
      } else if (code === 0 && finalOutput && !providerError) {
        finish({ status: 'completed', output: finalOutput, error: '', webSearchUsed });
      } else {
        const errorText = providerError || stderr || (code === 0
          ? `${provider} CLI가 정상 종료했지만 결과 JSON 이벤트를 반환하지 않았습니다. CLI 출력 옵션과 프롬프트 전달 경로를 확인하세요.`
          : `프로세스가 code=${code}, signal=${signal || 'none'}로 종료되었습니다.`);
        finish({ status: isUsageLimitError(errorText) ? 'waiting_for_reset' : 'failed', output: finalOutput, error: errorText.slice(0, 12_000), webSearchUsed });
      }
    });
  });
}

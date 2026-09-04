// codex.mjs와 같은 이유로 cross-spawn을 쓴다(Windows .cmd 셰임 + 프롬프트
// 안전 이스케이프).
import spawn from 'cross-spawn';
import { childEnvironment } from '../safety.mjs';

// 인자 구성만 담당한다 — 프로세스 생명주기는 index.mjs가 공통 처리한다.
export function spawnClaude({
  workspace,
  contextDir,
  prompt,
  model,
  effort,
  jsonSchema,
  systemPromptFile,
  permissionMode = 'plan',
  restricted = true,
}) {
  const args = ['-p', prompt];
  if (contextDir) args.push('--add-dir', contextDir);
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort);
  args.push('--permission-mode', permissionMode);
  if (restricted) args.push('--restricted');
  if (systemPromptFile) args.push('--append-system-prompt-file', systemPromptFile);
  // --output-format=stream-json은 --print와 함께 쓸 때 --verbose가 필수다
  // (`claude --help`로 실측 확인 — §8 문서 예시엔 없었다).
  args.push('--output-format', 'stream-json', '--include-partial-messages', '--verbose');
  if (jsonSchema) args.push('--json-schema', jsonSchema);

  // codex.mjs와 같은 이유로 stdin을 파이프로 열어 즉시 닫는다(§9).
  const child = spawn('claude', args, { cwd: workspace, env: childEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.end();
  return child;
}

export function extractOutput(parsed, fallback) {
  if (parsed?.type === 'result') return parsed.result || parsed.structured_output || '';
  if (parsed?.type === 'assistant' && parsed.message?.content) {
    return parsed.message.content.map((item) => item.text || '').join('');
  }
  return fallback;
}

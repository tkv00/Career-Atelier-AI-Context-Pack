// codex.mjs와 같은 이유로 cross-spawn을 쓴다(Windows .cmd 셰임 + 프롬프트
// 안전 이스케이프).
import { spawnManaged as spawn } from '../lib/managed-process.mjs';
import { childEnvironment } from '../safety.mjs';

// 프롬프트와 별도로 옵션을 구성해 Windows 명령행에서 본문이 잘리지 않게 한다.
export function buildClaudeArgs({
  contextDir,
  model,
  effort,
  jsonSchema,
  systemPromptFile,
  // 헤드리스 실행에서는 허용 목록 밖의 권한 질문을 자동 거부한다.
  permissionMode = 'dontAsk',
  restricted = true,
}) {
  // Windows .cmd는 다중 줄 인자와 그 뒤 옵션을 잘라내므로 본문은 stdin에 쓴다.
  const args = ['-p'];
  if (contextDir) args.push('--add-dir', contextDir);
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort);
  args.push('--permission-mode', permissionMode);
  args.push('--permission-prompts', 'none');
  // dontAsk는 미승인 검색도 거부한다. 조사에 필요한 읽기·검색만 허용한다.
  args.push('--allowedTools', 'Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch');
  if (restricted) args.push('--restricted');
  if (systemPromptFile) args.push('--append-system-prompt-file', systemPromptFile);
  // --output-format=stream-json은 --print와 함께 쓸 때 --verbose가 필수다
  // (`claude --help`로 실측 확인 — §8 문서 예시엔 없었다).
  args.push('--output-format', 'stream-json', '--include-partial-messages', '--verbose');
  if (jsonSchema) args.push('--json-schema', jsonSchema);
  return args;
}

export function spawnClaude(options) {
  const { workspace, prompt } = options;
  const args = buildClaudeArgs(options);
  const child = spawn('claude', args, { cwd: workspace, env: childEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.on('error', () => {});
  child.stdin.end(prompt, 'utf8');
  return child;
}

export function extractOutput(parsed, fallback) {
  if (parsed?.type === 'result') return parsed.is_error ? '' : (parsed.structured_output || parsed.result || '');
  if (parsed?.type === 'assistant' && parsed.message?.content) {
    return parsed.message.content.map((item) => item.text || '').join('');
  }
  return fallback;
}

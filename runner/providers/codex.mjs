import { spawn } from 'node:child_process';
import { childEnvironment } from '../safety.mjs';

// 인자 구성만 담당한다 — 프로세스 생명주기(스트림 파싱·타임아웃·취소)는
// index.mjs가 두 프로바이더 공통으로 처리한다 (§9 프로바이더 지원 매트릭스).
export function spawnCodex({ workspace, prompt, model, effort, outputSchema, sandbox = 'read-only' }) {
  const args = ['exec', '-C', workspace, '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '-s', sandbox];
  if (model) args.push('-m', model);
  if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
  if (outputSchema) args.push('--output-schema', outputSchema);
  args.push('--json', prompt);

  // stdin은 'ignore'가 아니라 실제 파이프를 즉시 닫아 EOF를 준다 — Codex가
  // "stdin이 파이프면 프롬프트에 이어붙인다"를 시도할 때 tty 없는 헤드리스
  // 환경에서 os error 2(No such file or directory)로 죽는 걸 막는다.
  const child = spawn('codex', args, { cwd: workspace, env: childEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.end();
  return child;
}

export function extractOutput(parsed, fallback) {
  if (parsed?.type === 'item.completed' && parsed.item?.type === 'agent_message') {
    return parsed.item.text || parsed.item.content || '';
  }
  if (parsed?.type === 'message' && parsed.message?.role === 'assistant') {
    return parsed.message.content || '';
  }
  return fallback;
}

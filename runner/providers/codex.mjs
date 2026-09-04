// Windows에서 codex는 실행파일이 아니라 .cmd 셰임이라 node:child_process의
// spawn(shell:false 기본값)으로는 ENOENT로 죽는다 — cross-spawn이 프롬프트에
// 셸 메타문자(%, &, " 등)가 있어도 안전하게 이스케이프해서 실행한다.
import spawn from 'cross-spawn';
import { childEnvironment } from '../safety.mjs';

// --search는 exec의 옵션이 아니라 codex 자체의 전역 옵션이다. 따라서 반드시
// `codex --search exec` 순서여야 한다(`codex exec --search`는 현재 CLI에서
// unexpected argument로 실패한다). 루미·모카에만 켜서 최신 결과가 필요 없는
// 작성 비서가 불필요하게 웹을 보지 않게 한다.
export function buildCodexArgs({ workspace, prompt, model, effort, outputSchema, sandbox = 'read-only', liveWebSearch = false }) {
  const args = liveWebSearch ? ['--search', 'exec'] : ['exec'];
  args.push('-C', workspace, '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '-s', sandbox);
  // 최신 Codex는 --search가 없어도 캐시 검색을 기본 제공한다. 구조화·작성
  // 단계가 검색 전용 단계 밖에서 새 웹 사실을 섞지 못하도록 도구를 제거한다.
  if (!liveWebSearch) args.push('-c', 'web_search="disabled"');
  if (model) args.push('-m', model);
  if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
  if (outputSchema) args.push('--output-schema', outputSchema);
  args.push('--json', prompt);
  return args;
}

// 인자 구성만 담당한다 — 프로세스 생명주기(스트림 파싱·타임아웃·취소)는
// execute.mjs가 모든 프로바이더 공통으로 처리한다 (§9 프로바이더 지원 매트릭스).
export function spawnCodex(options) {
  const { workspace } = options;
  const args = buildCodexArgs(options);

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

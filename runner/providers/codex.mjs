// Windows npm .cmd 탐색은 cross-spawn에 맡기고 다중 줄 본문은 stdin에 쓴다.
import spawn from 'cross-spawn';
import { childEnvironment } from '../safety.mjs';

// --search는 exec의 옵션이 아니라 codex 자체의 전역 옵션이다. 따라서 반드시
// `codex --search exec` 순서여야 한다(`codex exec --search`는 현재 CLI에서
// unexpected argument로 실패한다). 루미·모카에만 켜서 최신 결과가 필요 없는
// 작성 비서가 불필요하게 웹을 보지 않게 한다.
export function buildCodexArgs({ workspace, model, effort, outputSchema, sandbox = 'read-only', liveWebSearch = false }) {
  const args = liveWebSearch ? ['--search', 'exec'] : ['exec'];
  args.push('-C', workspace, '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '-s', sandbox);
  // 최신 Codex는 --search가 없어도 캐시 검색을 기본 제공한다. 구조화·작성
  // 단계가 검색 전용 단계 밖에서 새 웹 사실을 섞지 못하도록 도구를 제거한다.
  if (!liveWebSearch) args.push('-c', 'web_search="disabled"');
  if (model) args.push('-m', model);
  if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
  if (outputSchema) args.push('--output-schema', outputSchema);
  // cmd.exe가 줄바꿈 뒤를 버리지 않도록 프롬프트는 stdin으로 전달한다.
  args.push('--json', '-');
  return args;
}

// 인자 구성만 담당한다 — 프로세스 생명주기(스트림 파싱·타임아웃·취소)는
// execute.mjs가 모든 프로바이더 공통으로 처리한다 (§9 프로바이더 지원 매트릭스).
export function spawnCodex(options) {
  const { workspace } = options;
  const args = buildCodexArgs(options);

  // 본문 전송 뒤 EOF를 보내야 CLI가 입력 완료를 알고 실행을 시작한다.
  const child = spawn('codex', args, { cwd: workspace, env: childEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.on('error', () => {});
  child.stdin.end(options.prompt, 'utf8');
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

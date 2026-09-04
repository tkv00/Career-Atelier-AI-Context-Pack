// codex.mjs·claude.mjs와 같은 이유로 cross-spawn을 쓴다(Windows .cmd 셰임 +
// 프롬프트 안전 이스케이프).
import spawn from 'cross-spawn';
import { childEnvironment } from '../safety.mjs';

// "Gemini"는 실제로는 Antigravity CLI(바이너리명 agy)를 통해 실행한다 —
// Gemini CLI가 2026-06-18부로 개인 계정 지원을 끊고 Antigravity로 이전됐다
// (사용자 요청 당시엔 몰랐던 사실, 실측으로 발견). 인자 이름이 Claude Code와
// 거의 같다(-p, --add-dir, --model, --effort, --json-schema) — 같은 계열
// 하네스로 다룬다. 인자 구성만 담당하고 프로세스 생명주기는 index.mjs가
// 공통 처리한다.
export function spawnGemini({ workspace, contextDir, prompt, model, effort, jsonSchema, mode = 'accept-edits' }) {
  const args = ['-p', prompt];
  if (contextDir) args.push('--add-dir', contextDir);
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort);
  // §9 매트릭스의 "plan=읽기전용 안전 모드"라는 통념이 여기선 안 맞는다
  // (실측, 2026-09-01) — agy의 --mode plan은 Claude의 permission-mode
  // plan과 달리 "실행하지 않고 계획서 파일만 써서 사용자 확인을 기다리는"
  // 완전히 다른 워크플로우라 헤드리스 단발 실행에서 빈 결과만 낸다.
  // accept-edits가 이 프로젝트가 원하는 "그냥 바로 실행하고 결과를 내는"
  // 동작에 해당한다. --restricted 같은 읽기전용 강제 플래그는 없어서,
  // "파일을 만들거나 수정하지 말라"를 프롬프트로 명시해야 한다(안전망은
  // §14 evidence 강제가 아니라 이 프롬프트 지시뿐이라는 뜻 — 소제목처럼
  // 원래 편집 권한이 필요 없는 가벼운 작업에만 이 프로바이더를 쓴다).
  args.push('--mode', mode);
  args.push('--sandbox');
  // stream-json이 아니라 json을 쓴다 — 실측해보니(2026-09-01) agy는 완료 시
  // 한 줄짜리 완성된 JSON({conversation_id,status,response,usage,...})만
  // 내고, Codex/Claude처럼 중간 이벤트를 스트리밍하지 않는다. 소제목처럼
  // 짧은 작업엔 실시간 중계 가치가 없어 굳이 stream-json 스키마를 추측할
  // 필요가 없다.
  args.push('--output-format', 'json');
  if (jsonSchema) args.push('--json-schema', jsonSchema);

  // codex.mjs·claude.mjs와 같은 이유로 stdin을 파이프로 열어 즉시 닫는다.
  const child = spawn('agy', args, { cwd: workspace, env: childEnvironment(), stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.end();
  return child;
}

// 실측 결과(2026-09-01): --json-schema를 쓰면 response(사람이 읽는 자유
// 텍스트)와 별개로 structured_output 필드에 스키마를 따르는 객체가
// 따로 온다 — response가 아니라 structured_output을 읽어야 한다.
// (스키마 각 필드에 description을 안 넣으면 모델이 "작업을 완료했다"는
// 메타 요약을 필드에 채워 넣는 오작동이 있었다 — description 필수.)
// status가 SUCCESS가 아닌 경우는 아직 실측 못 했다.
export function extractOutput(parsed, fallback) {
  if (parsed?.structured_output && typeof parsed.structured_output === 'object') return parsed.structured_output;
  if (typeof parsed?.response === 'string' && parsed.response) return parsed.response;
  return fallback;
}

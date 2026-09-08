// 비서가 돌 수 있는 LLM 목록, 그리고 LLM마다 다른 모델명·추론 사용량(effort)
// 표기.
//
// 원래 prompts/actions.ts에 있었는데, 그 파일은 'use server'라 **async 함수만**
// export할 수 있다. 상수를 내보내면 빌드는 통과하지만 클라이언트가 받는 건
// 배열이 아니라 서버 액션 프록시라, 화면에서 .map을 부르는 순간
// "TypeError: g.map is not a function"으로 페이지가 통째로 죽는다
// (2026-09-02 프로덕션에서 실제로 발생). 서버·클라이언트가 함께 쓰는 값은
// 이렇게 평범한 모듈에 둔다.
//
// DB의 check 제약(마이그레이션 0021)과 러너의 화이트리스트(runner/safety.mjs)가
// 같은 목록을 갖는다. 셋 중 하나만 고치면 안 된다.

export const PROVIDERS = ['codex', 'claude', 'gemini'] as const;
export type Provider = (typeof PROVIDERS)[number];

// 화면에 보일 이름과, 그 선택이 실제로 돌려면 어떤 CLI에 로그인해야 하는지.
// label은 "Gemini, Claude, GPT" 같은 사용자의 멘탈모델을 따르고, cli에는 실제
// 실행되는 도구 이름을 괄호로 남겨 둔다 — 로그인 안내(requires)와 실제
// 터미널에서 보게 될 이름이 다르면 헷갈린다.
export const PROVIDER_META: Record<Provider, { label: string; requires: string }> = {
  codex: { label: 'GPT (Codex)', requires: 'ChatGPT 구독 · codex login' },
  claude: { label: 'Claude', requires: 'Claude 구독 · claude auth login' },
  gemini: { label: 'Gemini (Antigravity)', requires: 'Google 계정 · agy' },
};

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value);
}

// 모델 이름과 CLI 인자를 분리한다. 목록은 계정 권한 조회 결과가 아니므로
// 기본값·직접 입력을 유지해 새 모델과 기존에 저장한 모델도 사용할 수 있게 한다.
// 2026-09-08: OpenAI 모델 문서, Claude 기존 후보, Google CLI 안내를 확인했다.
// https://developers.openai.com/api/docs/models/gpt-6-astra
// https://code.claude.com/docs/en/model-config
// https://codelabs.developers.google.com/antigravity-cli-hands-on?hl=en
export const MODEL_OPTIONS: Record<Provider, { value: string; label: string }[]> = {
  codex: [
    { value: 'gpt-6-astra', label: 'GPT-6 Astra' },
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  ],
  claude: [
    { value: 'claude-opus-5', label: 'Claude Opus 5' },
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { value: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
    { value: 'opus', label: 'Opus (CLI 별칭)' },
    { value: 'sonnet', label: 'Sonnet (CLI 별칭)' },
    { value: 'haiku', label: 'Haiku (CLI 별칭)' },
  ],
  gemini: [
    { value: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)' },
    { value: 'gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash (Medium)' },
    { value: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash (Low)' },
    { value: 'gemini-3.1-pro-high', label: 'Gemini 3.1 Pro (High)' },
    { value: 'gemini-3.1-pro-low', label: 'Gemini 3.1 Pro (Low)' },
  ],
};

/**
 * 추론 사용량(effort). 세 CLI 모두 "low / medium / high" 3단 표기를 쓴다고
 * 가정했다(Codex는 `-c model_reasoning_effort=`로 이미 이 표기를 실제로
 * 넘기고 있다 — codex.mjs 참고. Claude·Gemini의 `--effort` 플래그가 정확히
 * 같은 값을 받는지는 아직 실측하지 않았다).
 *
 * 셋을 한 배열로 합치지 않고 provider별로 따로 둔 이유: 지금은 값이 우연히
 * 같지만, 한 CLI가 실제로 다른 표기(예: Codex의 "minimal")를 쓰는 게
 * 확인되면 그 provider의 배열만 고치면 된다 — 나머지 둘은 건드릴 필요가
 * 없다. label은 항상 한국어 3단으로 통일해 화면에서는 어느 LLM을 고르든
 * 같은 멘탈모델(낮음/중간/높음)로 보이게 한다.
 */
export const EFFORT_OPTIONS: Record<Provider, { value: string; label: string }[]> = {
  codex: [
    { value: 'low', label: '낮음' },
    { value: 'medium', label: '중간' },
    { value: 'high', label: '높음' },
  ],
  claude: [
    { value: 'low', label: '낮음' },
    { value: 'medium', label: '중간' },
    { value: 'high', label: '높음' },
  ],
  gemini: [
    { value: 'low', label: '낮음' },
    { value: 'medium', label: '중간' },
    { value: 'high', label: '높음' },
  ],
};

export function effortLabel(provider: Provider, value: string): string {
  if (!value) return '기본값';
  return EFFORT_OPTIONS[provider].find((option) => option.value === value)?.label ?? value;
}

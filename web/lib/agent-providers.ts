// 비서가 돌 수 있는 LLM 목록.
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

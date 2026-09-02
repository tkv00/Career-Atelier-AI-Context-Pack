// 하트비트 15초 주기, 유령 판정 90초(runner/safety.mjs HEARTBEAT_STALE_MS)와
// 같은 기준으로 "지금 켜져 있는지"를 판단한다. 컴포넌트 렌더 본문에서 직접
// Date.now()를 부르면 React Compiler purity 규칙에 걸려 별도 함수로 뺐다.
export function isRunnerOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 90_000;
}

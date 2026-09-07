import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';

// URL만 비교하고 키·토큰은 오류나 로그에 포함하지 않는다.
export function assertSameAuthProject(runnerUrl, webUrl) {
  if (!webUrl) return;
  if (new URL(runnerUrl).origin !== new URL(webUrl).origin) {
    throw new Error('웹과 러너가 서로 다른 Supabase 프로젝트에 연결돼 있습니다. web/.env.local의 NEXT_PUBLIC_SUPABASE_URL과 runner/.env의 SUPABASE_URL을 같은 프로젝트로 맞춘 뒤 두 프로세스를 다시 시작하세요.');
  }
}

export function checkLocalWebProject(runnerUrl, webEnvPath) {
  if (!existsSync(webEnvPath)) return;
  const config = parseEnv(readFileSync(webEnvPath, 'utf8'));
  assertSameAuthProject(runnerUrl, config.NEXT_PUBLIC_SUPABASE_URL);
}

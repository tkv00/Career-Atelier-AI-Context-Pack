import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SERVICE = 'career-atelier-runner';
const ACCOUNT = 'supabase-session';

// 러너 자격증명은 macOS 키체인에만 둔다 — 파일·리포·환경변수에 평문으로 두지
// 않는다 (docs/DESIGN-V2-CLOUD.md §6). `security` CLI는 macOS 기본 제공이라
// 추가 의존성이 없다. 인자는 항상 배열로 넘겨 셸 인젝션 여지를 없앤다.

export async function saveSession(value) {
  await execFileAsync('security', [
    'add-generic-password',
    '-a', ACCOUNT,
    '-s', SERVICE,
    '-w', value,
    '-U',
  ]);
}

export async function loadSession() {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-a', ACCOUNT,
      '-s', SERVICE,
      '-w',
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  try {
    await execFileAsync('security', ['delete-generic-password', '-a', ACCOUNT, '-s', SERVICE]);
  } catch {
    // 애초에 없던 경우도 성공으로 취급한다.
  }
}

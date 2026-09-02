import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SESSION_DIR = join(homedir(), '.career-atelier');
const SESSION_FILE = join(SESSION_DIR, 'session.json');

// 러너 자격증명은 macOS 키체인에만 두던 걸(`security` CLI) 홈 디렉토리 파일로
// 바꿨다 — 키체인은 macOS 전용이라 Windows/Linux에서 로그인 자체가 안 됐다
// (2026-09-02). 파일 권한(0600)으로 같은 기기의 다른 계정 접근만 막는다 —
// OS 키체인만큼의 암호화 보안은 아니지만, 개인 노트북에서 도는 개인용 러너
// 용도로는 이 정도로 충분하다고 판단했다.

export async function saveSession(value) {
  await mkdir(SESSION_DIR, { recursive: true });
  await writeFile(SESSION_FILE, value, { mode: 0o600 });
}

export async function loadSession() {
  try {
    const content = await readFile(SESSION_FILE, 'utf8');
    return content.trim() || null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  try {
    await rm(SESSION_FILE);
  } catch {
    // 애초에 없던 경우도 성공으로 취급한다.
  }
}

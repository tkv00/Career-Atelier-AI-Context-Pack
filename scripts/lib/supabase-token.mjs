import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_PATTERN = /^sbp_(?:oauth_|v0_)?[a-f0-9]{40}$/;

function optionalFile(path) {
  try { return readFileSync(path, 'utf8').trim(); }
  catch (error) {
    if (error.code === 'ENOENT') return '';
    throw new Error('Supabase CLI 설정 파일을 읽을 수 없습니다. 파일 접근 권한을 확인하세요.');
  }
}

function readKeyring(account, platform, run) {
  const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000, windowsHide: true };
  let result;
  if (platform === 'win32') {
    result = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-File',
      fileURLToPath(new URL('./supabase-token.ps1', import.meta.url)), '-Account', account], options);
  } else if (platform === 'darwin') {
    result = run('/usr/bin/security', ['find-generic-password', '-s', 'Supabase CLI', '-a', account, '-w'], options);
  } else if (platform === 'linux') {
    result = run('secret-tool', ['lookup', 'service', 'Supabase CLI', 'username', account], options);
    if (result.status !== 0 || !result.stdout?.trim()) {
      result = run('secret-tool', ['lookup', 'service', 'Supabase CLI', 'user', account], options);
    }
  }
  // 실패 객체에는 stdout(토큰)이 들어갈 수 있으므로 그대로 던지거나 출력하지 않는다.
  return result?.status === 0 ? result.stdout.trim() : '';
}

export function loadManagementToken({ env = process.env, home = homedir(), platform = process.platform, run = spawnSync, read = optionalFile } = {}) {
  const directory = env.SUPABASE_HOME || resolve(home, '.supabase');
  const profile = env.SUPABASE_PROFILE || read(resolve(directory, 'profile')) || 'supabase';
  // CLI와 설치기가 다른 서버/계정에 접근하지 않도록 공식 클라우드 프로필만 허용한다.
  if (profile !== 'supabase') throw new Error('설치기는 Supabase 공식 클라우드 프로필만 지원합니다. supabase login --profile supabase 후 다시 실행하세요.');
  const validate = (token) => {
    if (!TOKEN_PATTERN.test(token)) throw new Error('Supabase 관리 토큰 형식이 올바르지 않습니다. supabase login으로 다시 로그인하세요. anon/service_role 키는 사용할 수 없습니다.');
    return token;
  };
  if (env.SUPABASE_ACCESS_TOKEN) return validate(env.SUPABASE_ACCESS_TOKEN.trim());
  const wsl = platform === 'linux' && /microsoft|wsl/i.test(read('/proc/sys/kernel/osrelease'));
  if (env.SUPABASE_NO_KEYRING !== '1' && !wsl) {
    for (const account of ['supabase', 'access-token']) {
      const token = readKeyring(account, platform, run);
      if (token) return validate(token);
    }
  }
  const token = read(resolve(directory, 'access-token'));
  if (token) return validate(token);
  throw new Error('Supabase 관리 토큰을 읽지 못했습니다. supabase login 후 다시 실행하세요. 키링을 사용할 수 없는 환경에서는 SUPABASE_ACCESS_TOKEN을 현재 셸에만 설정하세요. 프로젝트 .env에는 저장하지 마세요.');
}

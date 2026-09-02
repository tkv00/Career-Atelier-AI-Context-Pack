#!/usr/bin/env node
// 자체 호스팅 설치 마법사. Windows·macOS·Linux에서 같은 명령(`npm run setup`)으로
// 돌아야 해서 셸 스크립트가 아니라 Node로 짰다 — 러너를 돌리려면 어차피 Node가
// 필요하므로 추가 의존성이 늘지 않는다.
//
// 하는 일: 필수 도구 확인 → Supabase 프로젝트 연결 → 마이그레이션 적용 →
// web/.env.local과 runner/.env 생성. 실제 계정 생성처럼 사람만 할 수 있는 일은
// 대신 하지 않고, 어디서 무엇을 해야 하는지 안내만 한다.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const rl = createInterface({ input: process.stdin, output: process.stdout });

const c = {
  bold: (s) => `[1m${s}[0m`,
  dim: (s) => `[2m${s}[0m`,
  green: (s) => `[32m${s}[0m`,
  yellow: (s) => `[33m${s}[0m`,
  red: (s) => `[31m${s}[0m`,
};

const ok = (s) => console.log(`${c.green('✓')} ${s}`);
const warn = (s) => console.log(`${c.yellow('!')} ${s}`);
const fail = (s) => console.log(`${c.red('✗')} ${s}`);

function has(command) {
  // Windows는 where, 그 외는 which. 둘 다 없으면 false로 떨어뜨린다.
  const probe = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(probe, [command], { stdio: 'ignore', shell: process.platform === 'win32' }).status === 0;
}

function version(command, args = ['--version']) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' }).trim().split('\n')[0];
  } catch {
    return null;
  }
}

function writeEnv(path, values) {
  const body = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  writeFileSync(path, `${body}\n`, 'utf8');
}

async function main() {
  console.log(c.bold('\nCareer Atelier 설치\n'));

  // 1. 필수 도구 -------------------------------------------------------------
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 22) {
    fail(`Node.js 22 이상이 필요합니다. 현재: ${process.version}`);
    console.log('  https://nodejs.org 에서 LTS를 설치한 뒤 다시 실행하세요.\n');
    process.exit(1);
  }
  ok(`Node.js ${process.version}`);

  if (!has('supabase')) {
    fail('Supabase CLI가 없습니다.');
    console.log('  설치: npm install -g supabase');
    console.log('  설치 후 이 명령을 다시 실행하세요.\n');
    process.exit(1);
  }
  ok(`Supabase CLI ${version('supabase') ?? ''}`);

  // AI 비서용 CLI는 없어도 설치는 진행된다 — 나중에 붙여도 되기 때문이다.
  const clis = [
    ['codex', 'Codex(GPT) — 루미·모카·뮤즈', 'npm install -g @openai/codex && codex login'],
    ['claude', 'Claude Code — 솔·렌즈·에코', 'npm install -g @anthropic-ai/claude-code && claude auth login'],
    ['agy', 'Antigravity(Gemini) — 소제목', 'https://antigravity.google 설치 안내 참고'],
  ];
  console.log('');
  for (const [bin, label, howto] of clis) {
    if (has(bin)) ok(`${label}`);
    else warn(`${label} — 없음. 이 비서를 쓰려면: ${c.dim(howto)}`);
  }

  // 2. Supabase 프로젝트 -----------------------------------------------------
  console.log(c.bold('\n\nSupabase 프로젝트 연결\n'));
  console.log('아직 없다면 https://supabase.com 에서 새 프로젝트를 만드세요 (무료).');
  console.log(c.dim('프로젝트 설정 → Data API 에서 Project URL과 anon key를 복사할 수 있습니다.\n'));

  const projectRef = (await rl.question('프로젝트 ref (예: abcdefghijklmnop): ')).trim();
  if (!projectRef) {
    fail('프로젝트 ref가 필요합니다.');
    process.exit(1);
  }

  const supabaseUrl = (await rl.question(`Project URL [https://${projectRef}.supabase.co]: `)).trim()
    || `https://${projectRef}.supabase.co`;
  const anonKey = (await rl.question('anon public key: ')).trim();
  if (!anonKey) {
    fail('anon key가 필요합니다.');
    process.exit(1);
  }

  // 3. 마이그레이션 ----------------------------------------------------------
  console.log(c.bold('\n\n데이터베이스 준비\n'));
  console.log('Supabase에 로그인 창이 열릴 수 있습니다.');

  const link = spawnSync('supabase', ['link', '--project-ref', projectRef], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (link.status !== 0) {
    fail('supabase link 실패. 프로젝트 ref와 로그인 상태를 확인하세요.');
    process.exit(1);
  }

  const push = spawnSync('supabase', ['db', 'push', '--linked'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (push.status !== 0) {
    fail('마이그레이션 적용 실패.');
    process.exit(1);
  }
  ok('테이블·RLS·기본 프롬프트 적용 완료');

  // 4. 환경변수 파일 ---------------------------------------------------------
  const webEnv = resolve(root, 'web/.env.local');
  const runnerEnv = resolve(root, 'runner/.env');

  for (const [path, values] of [
    [webEnv, { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }],
    [runnerEnv, { SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: anonKey, RUNNER_DEVICE_NAME: '' }],
  ]) {
    if (existsSync(path)) {
      const keep = (await rl.question(`${path} 이 이미 있습니다. 덮어쓸까요? [y/N] `)).trim().toLowerCase();
      if (keep !== 'y') {
        warn(`${path} 유지`);
        continue;
      }
    }
    writeEnv(path, values);
    ok(`${path} 작성`);
  }

  // 5. 다음 단계 -------------------------------------------------------------
  console.log(c.bold('\n\n설치 완료. 다음 순서로 실행하세요.\n'));
  console.log(`  ${c.bold('1)')} 웹 앱 실행       ${c.dim('cd web && npm install && npm run dev')}`);
  console.log(`     ${c.dim('http://localhost:3000 에서 본인 이메일로 로그인하세요.')}`);
  console.log(`     ${c.dim('가장 먼저 가입한 계정이 이 인스턴스의 소유자가 되고, 이후 가입은 막힙니다.')}`);
  console.log(`\n  ${c.bold('2)')} 러너 로그인      ${c.dim('cd runner && npm install && npm run login')}`);
  console.log(`  ${c.bold('3)')} 러너 실행        ${c.dim('cd runner && npm run start')}`);
  console.log(`     ${c.dim('웹 관제실 화면 아래 "러너" 목록에서 이 기기를 승인해야 작업을 받습니다.')}`);
  console.log(`\n자세한 내용: ${c.dim('docs/USER-GUIDE.md')}\n`);

  rl.close();
}

main().catch((error) => {
  fail(error.message);
  rl.close();
  process.exit(1);
});

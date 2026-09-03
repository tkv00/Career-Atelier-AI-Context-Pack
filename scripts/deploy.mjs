#!/usr/bin/env node
// 웹 앱을 Vercel에 올리는 마법사. `npm run setup`이 만든 web/.env.local의
// 값을 그대로 재사용해서, GitHub 연동·프로젝트 생성·환경변수 입력을 전부
// CLI로 대신한다.
//
// GitHub에서 "Import Repository"를 거치지 않는다 — Vercel의 GitHub App이
// 그 저장소에 접근 권한이 없으면(포크·조직 저장소 등) import 목록에 아예
// 안 뜨는 경우가 흔하고, 실제로 그래서 막힌 사례가 있었다(2026-09-03).
// `vercel link`는 로컬 폴더를 그대로 프로젝트로 등록하므로 이 문제를
// 피해 간다 — 이 리포 자신도 지금 이 방식으로 배포돼 있다.
//
//   node scripts/deploy.mjs                          # 로그인만 하면 나머지는 알아서
//   node scripts/deploy.mjs --yes                    # 확인 없이 끝까지 진행
//   node scripts/deploy.mjs --project-name my-app     # 프로젝트 이름을 직접 정할 때

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const webDir = resolve(root, 'web');

function parseArgs(argv) {
  const out = { yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--project-name') { out.projectName = argv[i + 1]; i += 1; }
    else if (flag === '--yes' || flag === '-y') { out.yes = true; }
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const interactive = !args.yes;
const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
const ask = async (question) => (rl ? (await rl.question(question)).trim() : '');

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};
const ok = (s) => console.log(`${c.green('✓')} ${s}`);
const warn = (s) => console.log(`${c.yellow('!')} ${s}`);
const fail = (s) => console.log(`${c.red('✗')} ${s}`);

function has(command) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(probe, [command], { stdio: 'ignore', shell: process.platform === 'win32' }).status === 0;
}

function readEnvValue(path, key) {
  if (!existsSync(path)) return null;
  const line = readFileSync(path, 'utf8').split('\n').find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : null;
}

async function main() {
  console.log(c.bold('\nCareer Atelier 배포\n'));

  const envPath = resolve(webDir, '.env.local');
  const supabaseUrl = readEnvValue(envPath, 'NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = readEnvValue(envPath, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    fail('web/.env.local이 없거나 값이 비어 있습니다.');
    console.log('  먼저 npm run setup을 실행해 Supabase 연결을 끝내세요.\n');
    process.exit(1);
  }
  ok('web/.env.local에서 Supabase 값 확인');

  if (!has('vercel')) {
    fail('Vercel CLI가 없습니다.');
    console.log('  설치: npm install -g vercel');
    console.log('  설치 후 이 명령을 다시 실행하세요.\n');
    process.exit(1);
  }
  ok(`Vercel CLI ${spawnSync('vercel', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' }).stdout?.trim() ?? ''}`);

  const whoami = spawnSync('vercel', ['whoami'], { cwd: webDir, encoding: 'utf8', shell: process.platform === 'win32' });
  if (whoami.status !== 0) {
    if (!interactive) {
      fail('Vercel에 로그인되어 있지 않습니다. 먼저 실행하세요: vercel login');
      process.exit(1);
    }
    console.log('Vercel에 로그인합니다. 브라우저가 열립니다.\n');
    const login = spawnSync('vercel', ['login'], { cwd: webDir, stdio: 'inherit', shell: process.platform === 'win32' });
    if (login.status !== 0) {
      fail('vercel login 실패.');
      process.exit(1);
    }
  } else {
    ok(`Vercel 로그인됨: ${whoami.stdout.trim()}`);
  }

  // GitHub import 없이 web/ 폴더를 그 자체로 프로젝트에 연결한다. 이미
  // 연결돼 있으면(web/.vercel/project.json 존재) 그대로 재사용한다.
  console.log(c.bold('\n\n프로젝트 연결\n'));
  if (existsSync(resolve(webDir, '.vercel/project.json'))) {
    ok('이미 연결된 프로젝트를 사용합니다');
  } else {
    // 이름을 안 주면 vercel link가 디렉토리 이름(= "web")을 그대로 쓰는데,
    // 그건 흔해 빠진 이름이라 다른 사람이 이미 <이름>.vercel.app을 쓰고
    // 있을 확률이 높다(2026-09-03 확인). Supabase project ref는 각자
    // 고유하므로 그걸 붙여 기본값을 사실상 겹칠 일 없게 만든다.
    const supabaseRef = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
    const defaultName = supabaseRef ? `career-atelier-${supabaseRef}` : 'career-atelier';
    const projectName = args.projectName || defaultName;

    const link = spawnSync('vercel', ['link', '--project', projectName, '--yes'], {
      cwd: webDir, stdio: 'inherit', shell: process.platform === 'win32',
    });
    if (link.status !== 0) {
      fail(`vercel link 실패 — "${projectName}"이 이미 다른 사람의 프로젝트일 수 있습니다.`);
      console.log(c.dim('  다른 이름으로 다시 시도하세요:'));
      console.log(c.dim(`    npm run deploy -- --project-name <원하는-이름>`));
      process.exit(1);
    }
    ok(`프로젝트 연결됨: ${projectName}`);
  }

  // 환경변수 두 개만 설정한다 — service_role이나 AI 제공자 키는 절대
  // 넣지 않는다(web/lib/env.ts가 빌드 타임에 그 값들을 막는다).
  console.log(c.bold('\n\n환경변수 설정\n'));
  for (const [key, value] of [
    ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey],
  ]) {
    // anon key는 클라이언트 번들에 그대로 노출되는 게 정상 설계다(RLS가
    // 실제 보안 경계). 최신 Vercel CLI는 NEXT_PUBLIC_ 접두사가 붙은
    // credential-like 값에 --type을 명시하지 않으면 거부한다 — config로
    // 지정해 "의도적으로 공개"임을 밝힌다.
    const add = spawnSync('vercel', ['env', 'add', key, 'production', '--value', value, '--type', 'config', '--force', '--yes'], {
      cwd: webDir, stdio: 'inherit', shell: process.platform === 'win32',
    });
    if (add.status !== 0) {
      warn(`${key} 설정 실패 — Vercel 대시보드에서 직접 추가해야 할 수 있습니다.`);
    } else {
      ok(`${key} 설정 완료`);
    }
  }

  console.log(c.bold('\n\n배포\n'));
  const deploy = spawnSync('vercel', ['deploy', '--prod', '--yes'], {
    cwd: webDir, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (deploy.status !== 0) {
    fail('배포 실패. 위 로그를 확인하세요.');
    process.exit(1);
  }

  console.log(c.bold('\n\n배포 완료.\n'));
  console.log(c.dim('  위에 출력된 주소로 접속해 로그인하세요 — 러너가 꺼져 있어도 웹은 그대로 동작합니다.'));
  console.log(c.dim('  다음에 코드를 바꾼 뒤 다시 올리려면 이 명령을 그대로 다시 실행하면 됩니다.\n'));

  rl?.close();
}

main().catch((error) => {
  fail(error.message);
  rl?.close();
  process.exit(1);
});

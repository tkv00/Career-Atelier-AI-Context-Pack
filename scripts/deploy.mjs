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
// 프로젝트 이름(vercel link)과 배포 주소(*.vercel.app)는 서로 다른
// 이야기다 — 프로젝트 이름은 본인 계정 안에서만 격리돼서 "vercel"처럼
// 흔한 이름도 그냥 새로 만들어지지만(2026-09-04 확인), 그 이름 그대로의
// 짧은 주소는 이미 다른 사람이 쓰고 있으면 vercel deploy가 실패하는 대신
// 조용히 무작위 접미사가 붙은 못생긴 주소로 대체해 버린다. 원하는 주소를
// 확실히 얻거나, 안 되면 명확히 알기 위해 배포 뒤 `vercel alias set`으로
// 따로 요청한다 — 이 명령만 실제로 "이미 사용 중"이라는 에러를 낸다.
//
//   node scripts/deploy.mjs                          # 로그인만 하면 나머지는 알아서
//   node scripts/deploy.mjs --yes                    # 확인 없이 끝까지 진행
//   node scripts/deploy.mjs --project-name my-app     # 원하는 주소 이름을 미리 정할 때

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
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

// 배포를 실행하고 실제 배포 URL(예: career-atelier-abc123-team.vercel.app)을
// 뽑아낸다. 실시간 로그 대신 끝난 뒤 전체 출력을 한 번에 보여준다 — 그래야
// 최종 결과 JSON에서 URL을 안정적으로 파싱할 수 있다.
function deployAndCapture(webDir) {
  console.log(c.dim('  빌드에 20~30초 정도 걸립니다...'));
  const result = spawnSync('vercel', ['deploy', '--prod', '--yes'], {
    cwd: webDir, encoding: 'utf8', shell: process.platform === 'win32',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) return null;

  const match = `${result.stdout}\n${result.stderr}`.match(/https?:\/\/([a-z0-9-]+\.vercel\.app)/);
  return match ? match[1] : null;
}

// 사용자가 원하는 주소 이름을 먼저 물어보고 그 이름으로 별칭 연결을
// 시도한다. 실패는 그 이름을 이미 다른 사람(또는 본인의 다른 프로젝트)이
// 쓰고 있다는 뜻이라 매번 새로 물어보는데, 3번째 실패부터는 매번 새 이름을
// 생각해내라고 하는 대신 무작위 접미사가 붙은(사실상 절대 안 겹치는)
// 이름을 제안한다. --yes(비대화형)일 때는 물어보는 대신 같은 규칙을 그대로
// 자동 적용한다.
async function pickAlias(webDir, deployUrl, defaultBase) {
  let candidate = args.projectName || null;
  let failures = 0;
  const maxAttempts = 10;
  // 대화형이면 사용자가 직접 고른 이름을 3번까지 시도해 볼 기회를 준다.
  // 비대화형은 다시 물어볼 수 없어서 같은 이름을 반복해 봐야 매번 같은
  // 결과이므로, 1번 실패하면 바로 무작위 이름으로 넘어간다.
  const graceAttempts = interactive ? 3 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!candidate) {
      candidate = interactive
        ? (await ask(`원하는 주소 이름 (Enter시 기본값: ${defaultBase}): `)) || defaultBase
        : defaultBase;
    }
    const aliasDomain = `${candidate}.vercel.app`;

    const set = spawnSync('vercel', ['alias', 'set', deployUrl, aliasDomain], {
      cwd: webDir, stdio: 'inherit', shell: process.platform === 'win32',
    });
    if (set.status === 0) return aliasDomain;

    failures += 1;
    warn(`"${aliasDomain}" 은 이미 다른 곳에서 쓰고 있습니다.`);

    if (failures >= graceAttempts) {
      const randomName = `${defaultBase}-${randomBytes(3).toString('hex')}`;
      if (!interactive) {
        warn(`무작위 이름으로 넘어갑니다: ${randomName}`);
        candidate = randomName;
      } else {
        const answer = await ask(`계속 실패하네요. 무작위 이름 "${randomName}"으로 시도할까요? [Y/n] `);
        candidate = answer.toLowerCase() === 'n' ? null : randomName;
      }
    } else {
      candidate = null;
    }
  }

  return null;
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

  const supabaseRef = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const defaultName = supabaseRef ? `career-atelier-${supabaseRef}` : `career-atelier-${randomBytes(3).toString('hex')}`;

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
  // 연결돼 있으면(web/.vercel/project.json 존재) 그대로 재사용한다. 여기서
  // 쓰는 이름은 Vercel 대시보드에서만 보이는 내부 식별자다 — 본인 계정
  // 안에서만 격리되므로 사실상 항상 성공한다. 사용자가 실제로 보게 될
  // 짧은 주소는 아래 "주소 정하기" 단계에서 따로 정한다.
  console.log(c.bold('\n\n프로젝트 연결\n'));
  if (existsSync(resolve(webDir, '.vercel/project.json'))) {
    ok('이미 연결된 프로젝트를 사용합니다');
  } else {
    const link = spawnSync('vercel', ['link', '--project', defaultName, '--yes'], {
      cwd: webDir, stdio: 'inherit', shell: process.platform === 'win32',
    });
    if (link.status !== 0) {
      fail('vercel link 실패.');
      process.exit(1);
    }
    ok(`프로젝트 연결됨: ${defaultName}`);
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
  const deployUrl = deployAndCapture(webDir);
  if (!deployUrl) {
    fail('배포 실패. 위 로그를 확인하세요.');
    process.exit(1);
  }
  ok(`배포됨: https://${deployUrl}`);

  console.log(c.bold('\n\n주소 정하기\n'));
  const alias = await pickAlias(webDir, deployUrl, defaultName);
  if (!alias) {
    warn('원하는 주소를 정하지 못했습니다 — 위 배포 URL을 그대로 쓰세요.');
  } else {
    ok(`주소 연결됨: https://${alias}`);
  }

  console.log(c.bold('\n\n배포 완료.\n'));
  console.log(c.dim(`  https://${alias || deployUrl} 로 접속해 로그인하세요 — 러너가 꺼져 있어도 웹은 그대로 동작합니다.`));
  console.log(c.dim('  다음에 코드를 바꾼 뒤 다시 올리려면 이 명령을 그대로 다시 실행하면 됩니다.\n'));

  rl?.close();
}

main().catch((error) => {
  fail(error.message);
  rl?.close();
  process.exit(1);
});

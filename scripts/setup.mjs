#!/usr/bin/env node
// 자체 호스팅 설치 마법사. Windows·macOS·Linux에서 같은 명령(`npm run setup`)으로
// 돌아야 해서 셸 스크립트가 아니라 Node로 짰다 — 러너를 돌리려면 어차피 Node가
// 필요하므로 추가 의존성이 늘지 않는다.
//
// 하는 일: 필수 도구 확인 → Supabase 로그인 → 프로젝트 선택(없으면 생성) →
// anon 키 조회 → 마이그레이션 적용 → web/.env.local과 runner/.env 생성.
//
// 예전에는 사용자가 대시보드에서 프로젝트를 만들고 ref와 anon 키를 손으로
// 복사해 와야 했다. CLI가 projects list/create와 api-keys를 전부 제공해서
// 그 왕복이 통째로 없어졌다 — 브라우저 로그인 한 번이면 끝난다.
//
// 모든 값을 인자로 넘기면 아무것도 묻지 않고 끝까지 돈다 — AGENTS.md를 읽은
// AI 코딩 에이전트가 대신 설치할 수 있어야 해서다. 그런
// 환경에는 tty가 없어서, 값이 빠졌을 때 프롬프트를 띄우면 그대로 멈춰 버린다.
//
//   node scripts/setup.mjs                      # 로그인만 하면 프로젝트 생성·키 조회까지 알아서
//   node scripts/setup.mjs --new-project my-app --region ap-northeast-2
//   node scripts/setup.mjs --project-ref abc --anon-key eyJ...   # 값을 직접 줄 때 (Supabase 로그인 필요)
//   node scripts/setup.mjs --owner-email me@example.com   # 웹 가입 화면에 이메일만 미리 채움
//   node scripts/setup.mjs --skip-migrations              # SQL Editor로 이미 수동 적용을 끝냈을 때

import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { checkLocalWebProject } from './lib/auth-target.mjs';
import { markDatabaseCurrent } from './lib/database-version.mjs';
import { loadManagementToken } from './lib/supabase-token.mjs';
import { createCliManagementQuery, createManagementQuery, supportsSupabaseDbQuery } from './lib/supabase-management.mjs';
import { applyMigrations } from './lib/setup-migrations.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  // 서울에서 가장 가까운 리전을 기본값으로 둔다.
  const out = { yes: false, region: 'ap-northeast-2' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--project-ref') { out.projectRef = value; i += 1; }
    else if (flag === '--anon-key') { out.anonKey = value; i += 1; }
    else if (flag === '--url') { out.url = value; i += 1; }
    else if (flag === '--new-project') { out.newProject = value ?? 'career-atelier'; i += 1; }
    else if (flag === '--region') { out.region = value; i += 1; }
    else if (flag === '--db-password') { out.dbPassword = value; i += 1; }
    else if (flag === '--owner-email') { out.ownerEmail = value; i += 1; }
    else if (flag === '--skip-migrations') { out.skipMigrations = true; }
    else if (flag === '--migrate-only') { out.migrateOnly = true; }
    else if (flag === '--yes' || flag === '-y') { out.yes = true; }
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

// --yes를 주거나 필요한 값이 전부 인자로 왔으면 stdin을 아예 건드리지 않는다.
// 프로젝트 ref와 키를 이제 CLI로 알아내므로, 에이전트는 --yes 하나만 주면 된다.
const interactive = Boolean(process.stdin.isTTY) && !args.yes && !(args.projectRef && args.anonKey);
const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
const ask = async (question) => (rl ? (await rl.question(question)).trim() : '');

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

// supabase CLI를 JSON으로 부르고 파싱한다. 실패하면 null — 호출부가 판단한다.
function supabaseJson(argv) {
  try {
    const out = execFileSync('supabase', [...argv, '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

// 로그인 여부는 전용 명령이 없어서, 인증이 필요한 조회가 되는지로 판단한다.
async function supabaseLoggedIn() {
  return Array.isArray(supabaseJson(['orgs', 'list']));
}

// 갓 만든 프로젝트는 몇십 초 동안 연결을 못 받는다. 준비될 때까지 기다렸다가
// 다음 단계(Management API 마이그레이션)로 넘어간다.
async function waitUntilHealthy(ref, timeoutMs = 5 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  process.stdout.write('  프로젝트가 준비되기를 기다리는 중');
  while (Date.now() < deadline) {
    const found = (supabaseJson(['projects', 'list']) ?? []).find((p) => p.ref === ref);
    if (found && /ACTIVE_HEALTHY/i.test(String(found.status))) {
      console.log(' 준비됨');
      return;
    }
    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  console.log('');
  warn('준비 확인이 시간 초과됐습니다. 계속 진행하지만 실패하면 잠시 뒤 다시 실행하세요.');
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
    console.log('  설치: https://supabase.com/docs/guides/local-development/cli/getting-started');
    console.log('  운영체제에 맞게 설치한 뒤 PATH에서 supabase를 실행할 수 있어야 합니다.');
    console.log('  설치 후 이 명령을 다시 실행하세요.\n');
    process.exit(1);
  }
  ok(`Supabase CLI ${version('supabase') ?? ''}`);

  // AI 비서용 CLI는 없어도 설치는 진행된다 — 나중에 붙여도 되기 때문이다.
  // 안내 명령은 한 줄씩 배열로 둔다 — &&로 이어 붙이면 Windows의 기본
  // PowerShell(5.1)이 파싱조차 못 해서 그대로 붙여넣기 못 한다.
  const clis = [
    ['codex', 'Codex(GPT) — 루미·모카·뮤즈', ['npm install -g @openai/codex', 'codex login']],
    ['claude', 'Claude Code — 솔·렌즈·에코', ['npm install -g @anthropic-ai/claude-code', 'claude auth login']],
    ['agy', 'Antigravity(Gemini) — 소제목', ['https://antigravity.google 설치 안내 참고']],
  ];
  console.log('');
  for (const [bin, label, steps] of clis) {
    if (has(bin)) ok(`${label}`);
    else {
      warn(`${label} — 없음. 이 비서를 쓰려면:`);
      for (const step of steps) console.log(`    ${c.dim(step)}`);
    }
  }

  // 2. Supabase 프로젝트 -----------------------------------------------------
  console.log(c.bold('\n\nSupabase 프로젝트\n'));

  let projectRef = args.projectRef;
  let dbPassword = args.dbPassword;

  // 기존 설치의 npm start가 새 스키마만 적용할 때도 CLI 로그인은 필요하다.
  // 브라우저 승인은 사람만 끝낼 수 있으므로 tty가 있을 때만 로그인 흐름을 연다.
  if (args.migrateOnly && !(await supabaseLoggedIn())) {
    if (!interactive) {
      fail('DB 업데이트에 Supabase 로그인이 필요합니다. 먼저 실행하세요: supabase login');
      process.exit(1);
    }
    console.log('DB 업데이트를 위해 Supabase에 로그인합니다. 브라우저가 열립니다.\n');
    const login = spawnSync('supabase', ['login'], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (login.status !== 0) {
      fail('supabase login 실패.');
      process.exit(1);
    }
  }

  // ref를 안 줬으면 대시보드를 오가며 키를 복사하게 하지 않는다. CLI가
  // 프로젝트 목록 조회·생성·키 조회를 전부 할 수 있어서, 로그인 한 번이면
  // 나머지는 여기서 끝난다.
  if (!projectRef) {
    if (!(await supabaseLoggedIn())) {
      if (!interactive) {
        // 브라우저 로그인은 사람이 눌러야 끝난다. tty 없는 환경에서 띄우면
        // 아무도 못 누르는 창을 열어 두고 영원히 기다린다.
        fail('Supabase에 로그인되어 있지 않습니다. 먼저 실행하세요: supabase login');
        process.exit(1);
      }
      console.log('Supabase에 로그인합니다. 브라우저가 열립니다.\n');
      const login = spawnSync('supabase', ['login'], { stdio: 'inherit', shell: process.platform === 'win32' });
      if (login.status !== 0) {
        fail('supabase login 실패.');
        process.exit(1);
      }
    }

    const projects = supabaseJson(['projects', 'list']) ?? [];
    let usable = projects.filter((p) => p.ref);

    // 계정에 프로젝트가 1개뿐이면 예전에는 묻지도 않고 그대로 재사용했다 —
    // 이 컴퓨터에서 예전에 로그인해 둔 계정에 프로덕션 프로젝트 하나만 있으면,
    // 완전히 새로 테스트하려던 사람이 그 프로덕션에 조용히 연결돼 버린다
    // (실제로 겪음, 2026-09-04 — 개발한 적 없는 새 컴퓨터인데 예전 로그인
    // 세션 때문에 유일한 기존 프로젝트로 자동 연결됨). 1개뿐이어도 대화형
    // 이면 확인을 받는다.
    if (usable.length === 1 && interactive && !args.newProject) {
      const { name, ref } = usable[0];
      const proceed = (
        await ask(`Supabase 계정에 이미 "${name}" (${ref}) 프로젝트가 있습니다. 이 프로젝트를 쓸까요? 새로 만들려면 n을 입력하세요. [Y/n] `)
      ).toLowerCase();
      if (proceed === 'n') usable = [];
    }

    if (usable.length && !args.newProject) {
      // 이미 프로젝트가 있으면 새로 만들지 않는다 — 무료 플랜은 개수 제한이 있고,
      // 남의 프로젝트를 말없이 늘리는 건 예의가 아니다.
      const pick = usable.length === 1 || !interactive
        ? usable[0]
        : usable[Number(await ask(usable.map((p, i) => `  ${i + 1}) ${p.name} (${p.ref})`).join('\n') + '\n선택 [1]: ')) - 1] ?? usable[0];
      projectRef = pick.ref;
      ok(`기존 프로젝트 사용: ${pick.name} (${projectRef})`);

    } else {
      const orgs = supabaseJson(['orgs', 'list']) ?? [];
      if (!orgs.length) {
        fail('Supabase 조직을 찾지 못했습니다. supabase.com에서 조직을 먼저 만드세요.');
        process.exit(1);
      }
      const name = args.newProject || 'career-atelier';
      dbPassword = dbPassword || randomBytes(24).toString('base64url');

      console.log(`새 프로젝트를 만듭니다: ${name} (${args.region})`);
      const create = spawnSync(
        'supabase',
        ['projects', 'create', name, '--org-id', orgs[0].id, '--db-password', dbPassword, '--region', args.region],
        { stdio: 'inherit', shell: process.platform === 'win32' },
      );
      if (create.status !== 0) {
        fail('프로젝트 생성 실패.');
        process.exit(1);
      }

      const created = (supabaseJson(['projects', 'list']) ?? []).find((p) => p.name === name);
      if (!created?.ref) {
        fail('만든 프로젝트를 찾지 못했습니다.');
        process.exit(1);
      }
      projectRef = created.ref;
      ok(`프로젝트 생성됨: ${projectRef}`);
      console.log(c.dim(`  DB 비밀번호는 무작위로 만들었고 어디에도 저장하지 않습니다.`));
      console.log(c.dim(`  필요하면 supabase.com 대시보드에서 재설정할 수 있습니다.`));

      // 새 프로젝트는 곧바로 연결을 못 받는다. 준비될 때까지 기다린다.
      await waitUntilHealthy(projectRef);
    }
  }

  const supabaseUrl = args.url || `https://${projectRef}.supabase.co`;

  // anon 키도 CLI로 가져온다. 사용자가 대시보드에서 복사해 올 이유가 없다.
  let anonKey = args.anonKey;
  if (!args.migrateOnly && !anonKey) {
    const keys = supabaseJson(['projects', 'api-keys', '--project-ref', projectRef]) ?? [];
    anonKey = keys.find((k) => k.name === 'anon')?.api_key;
  }
  if (!args.migrateOnly && !anonKey) {
    fail('anon key를 가져오지 못했습니다. --anon-key로 직접 넘기세요.');
    process.exit(1);
  }
  if (!args.migrateOnly) ok('anon key 확보');

  // 최신 CLI의 db query --linked는 DB 포트 대신 Management API(HTTPS)를 사용한다.
  console.log(c.bold('\n\n데이터베이스 준비\n'));
  if (args.skipMigrations) {
    warn('--skip-migrations — 적용 상태를 검증하지 않고 건너뜁니다. 모든 마이그레이션 적용을 별도로 확인한 경우에만 사용하세요.');
    // 이 플래그는 사용자가 원격 적용을 별도로 검증했다는 선언이다. 표시를 남기지
    // 않으면 다음 npm start가 같은 파일 집합을 다시 적용하려 든다.
    markDatabaseCurrent(root, projectRef);
  } else {
    // 최신 CLI는 로그인 자격 증명을 외부에 꺼내지 않고 Management API SQL을
    // 실행한다. 키체인 구현을 설치기가 흉내 내면 CLI 저장 형식 변경 때 깨진다.
    const cliQuery = supportsSupabaseDbQuery();
    const query = cliQuery
      ? createCliManagementQuery({ projectRef })
      : createManagementQuery({ projectRef, token: loadManagementToken() });
    console.log(cliQuery
      ? 'Supabase CLI 로그인 세션으로 적용 이력을 확인합니다.'
      : 'Management API(HTTPS)로 적용 이력을 확인합니다.');
    const result = await applyMigrations({ root, query, onProgress: ok });
    ok(`마이그레이션 이력 검증 완료: 신규 ${result.applied}개, 기존 ${result.skipped}개`);
    markDatabaseCurrent(root, projectRef);
  }

  if (args.migrateOnly) {
    console.log(c.bold('\nDB 업데이트 확인 완료. 서비스를 시작합니다.\n'));
    rl?.close();
    return;
  }

  const supabaseEnv = { ...process.env };

  // 4. Auth 설정(이메일 템플릿·가입 제한 훅·SMTP) -----------------------------
  // config.toml의 [auth] 섹션은 db push로는 안 밀린다 — 별도 명령이 필요하다.
  // 예전에는 supabase/.env(Resend 설정)가 없으면 이 단계 전체를 건너뛰었는데,
  // 그러면 가입 제한 훅도, 이메일 확인 필수 여부도, 비밀번호 정책도 전부
  // Supabase 기본값(훅 꺼짐 = 아무나 가입 가능, 이메일 확인 필수 = 방금 가입한
  // 계정도 로그인 불가)으로 남는다 — 실제로 겪음, 2026-09-04: Resend를 안 쓴
  // 새 프로젝트에서 가입은 됐는데 그 즉시 로그인이 막혔고, 가입 제한 훅도
  // 꺼진 채 방치돼 있었다. Resend는 선택이지만 나머지는 항상 반영해야 한다 —
  // SMTP 섹션만 조건부로 끄고, SITE_URL도 없으면 로컬 기본값으로 채운다.
  const supabaseEnvFile = resolve(root, 'supabase/.env');
  const configPath = resolve(root, 'supabase/config.toml');
  const hasResend = existsSync(supabaseEnvFile);

  let restoreConfig = null;
  if (!hasResend) {
    const original = readFileSync(configPath, 'utf8');
    // Windows 체크아웃은 CRLF일 수 있어 `\n`만 고정하면 SMTP가 켜진 채 원격 검증으로 넘어간다.
    const disabled = original.replace(/(\[auth\.email\.smtp\]\r?\nenabled = )true/, '$1false');
    if (disabled !== original) {
      writeFileSync(configPath, disabled, 'utf8');
      restoreConfig = () => writeFileSync(configPath, original, 'utf8');
    }
  }

  const configEnv = {
    ...supabaseEnv,
    SITE_URL: supabaseEnv.SITE_URL || 'http://localhost:3000',
    SITE_REDIRECT_URL: supabaseEnv.SITE_REDIRECT_URL || 'http://localhost:3000/**',
    RESEND_API_KEY: supabaseEnv.RESEND_API_KEY || '',
    RESEND_ADMIN_EMAIL: supabaseEnv.RESEND_ADMIN_EMAIL || '',
  };

  let configPush;
  try {
    configPush = spawnSync('supabase', ['config', 'push', '--project-ref', projectRef], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: configEnv,
    });
  } finally {
    restoreConfig?.();
  }

  if (configPush.status !== 0) {
    throw new Error('Supabase Auth 설정 적용에 실패했습니다. 가입 제한과 이메일 확인 설정을 확인할 수 없어 설치를 중단합니다. 원인을 해결한 뒤 같은 설치 명령을 다시 실행하세요.');
  } else if (hasResend) {
    ok('이메일 템플릿·가입 제한·SMTP 설정 적용 완료');
  } else {
    ok('이메일 템플릿·가입 제한 설정 적용 완료 (지금은 Supabase 기본 메일 서비스, 시간당 2통)');
    console.log(c.dim('  더 넉넉한 한도가 필요하면 Resend(무료, resend.com)에 가입해 API 키를'));
    console.log(c.dim('  supabase/.env에 채우고 다시 실행하세요: supabase config push'));
  }
  if (!existsSync(supabaseEnvFile)) {
    console.log(c.dim('  참고: SITE_URL을 localhost 기본값으로 반영했습니다 — 나중에 배포 주소가'));
    console.log(c.dim('  생기면(npm run deploy) supabase/.env에 실제 주소를 채우고 다시 실행하세요.'));
  }

  // 5. 환경변수 파일 ---------------------------------------------------------
  const webEnv = resolve(root, 'web/.env.local');
  const runnerEnv = resolve(root, 'runner/.env');

  for (const [path, values] of [
    [webEnv, { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }],
    [runnerEnv, { SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: anonKey, RUNNER_DEVICE_NAME: '' }],
  ]) {
    if (existsSync(path)) {
      // --yes면 묻지 않고 덮어쓴다. 비대화형인데 --yes도 없으면 기존 파일을
      // 남기는 쪽이 안전하다 — 남의 설정을 말없이 지우지 않는다.
      const keep = args.yes ? 'y' : (await ask(`${path} 이 이미 있습니다. 덮어쓸까요? [y/N] `)).toLowerCase();
      if (keep !== 'y') {
        warn(`${path} 유지`);
        continue;
      }
    }
    writeEnv(path, values);
    ok(`${path} 작성`);
  }

  // 가입은 웹 한 곳에서만 한다. signup의 HTTP 200은 로그인 가능한 세션을
  // 보장하지 않아 임시 비밀번호를 출력하는 설치 경로가 혼란을 만들었다.
  checkLocalWebProject(parseEnv(readFileSync(runnerEnv, 'utf8')).SUPABASE_URL, webEnv);
  const signupUrl = new URL('http://localhost:3000/login');
  signupUrl.searchParams.set('mode', 'signup');
  if (args.ownerEmail) signupUrl.searchParams.set('email', args.ownerEmail);

  // 통합 실행 중에도 같은 안내를 사용해 다음부터 외울 명령을 하나로 유지한다.
  console.log(c.bold('\n\n설정 완료. 실행 명령은 저장소 폴더에서 npm start입니다.\n'));
  console.log(c.dim('  npm start로 시작했다면 패키지 준비와 웹·러너 실행이 이어집니다.'));
  console.log(c.dim(`  브라우저에서 열기: ${signupUrl.href}`));
  console.log(c.dim('  처음이면 본인 이메일과 직접 정한 비밀번호로 가입하세요. 첫 계정만 허용됩니다.'));
  console.log(c.dim('  같은 터미널의 러너 로그인에 웹에서 정한 이메일·비밀번호를 입력하세요.'));
  console.log(c.dim('  Supabase 대시보드 계정이나 DB 비밀번호와는 다릅니다.'));
  console.log(c.dim('  웹 관제실의 러너 목록에서 이 기기를 승인해야 작업을 받습니다.'));
  console.log(c.dim('  웹 주소는 실행 시 출력되는 주소를 사용하세요. 종료는 Ctrl+C 한 번입니다.'));
  console.log(c.dim('  배포된 웹을 쓴다면 npm run runner로 러너만 실행할 수 있습니다.'));
  console.log(`\n자세한 내용: ${c.dim('docs/USER-GUIDE.md')}\n`);

  rl?.close();
}

main().catch((error) => {
  fail(error.message);
  rl?.close();
  process.exit(1);
});

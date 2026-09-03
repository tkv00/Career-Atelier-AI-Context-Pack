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
// AI 코딩 에이전트가 대신 설치할 수 있어야 해서다(요청 2026-09-02). 그런
// 환경에는 tty가 없어서, 값이 빠졌을 때 프롬프트를 띄우면 그대로 멈춰 버린다.
//
//   node scripts/setup.mjs                      # 로그인만 하면 프로젝트 생성·키 조회까지 알아서
//   node scripts/setup.mjs --new-project my-app --region ap-northeast-2
//   node scripts/setup.mjs --project-ref abc --anon-key eyJ... --db-password ...   # 값을 직접 줄 때

import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    else if (flag === '--yes' || flag === '-y') { out.yes = true; }
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

// --yes를 주거나 필요한 값이 전부 인자로 왔으면 stdin을 아예 건드리지 않는다.
// 프로젝트 ref와 키를 이제 CLI로 알아내므로, 에이전트는 --yes 하나만 주면 된다.
const interactive = !args.yes && !(args.projectRef && args.anonKey);
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
// 다음 단계(link → db push)로 넘어간다.
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
    console.log('  설치: npm install -g supabase');
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
    const usable = projects.filter((p) => p.ref);

    if (usable.length && !args.newProject) {
      // 이미 프로젝트가 있으면 새로 만들지 않는다 — 무료 플랜은 개수 제한이 있고,
      // 남의 프로젝트를 말없이 늘리는 건 예의가 아니다.
      const pick = usable.length === 1 || !interactive
        ? usable[0]
        : usable[Number(await ask(usable.map((p, i) => `  ${i + 1}) ${p.name} (${p.ref})`).join('\n') + '\n선택 [1]: ')) - 1] ?? usable[0];
      projectRef = pick.ref;
      ok(`기존 프로젝트 사용: ${pick.name} (${projectRef})`);

      // db push는 관리 API가 아니라 실제 Postgres 접속이라 DB 비밀번호가
      // 따로 필요하다. 방금 만든 프로젝트라면 아래에서 그 값을 그대로 쓰지만,
      // 기존 프로젝트는 CLI도 이 값을 알려주지 않는다(서버가 평문 보관을
      // 안 한다) — 사용자에게 직접 물어보는 수밖에 없다.
      if (!dbPassword) {
        if (!interactive) {
          fail(`${pick.name}의 DB 비밀번호를 모릅니다. --db-password로 넘기거나 --new-project로 새 프로젝트를 만드세요.`);
          process.exit(1);
        }
        dbPassword = await ask(`${pick.name}의 데이터베이스 비밀번호 (모르면 대시보드 Settings → Database에서 재설정): `);
        if (!dbPassword) {
          fail('비밀번호 없이는 마이그레이션을 적용할 수 없습니다.');
          process.exit(1);
        }
      }
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
  if (!anonKey) {
    const keys = supabaseJson(['projects', 'api-keys', '--project-ref', projectRef]) ?? [];
    anonKey = keys.find((k) => k.name === 'anon')?.api_key;
  }
  if (!anonKey) {
    fail('anon key를 가져오지 못했습니다. --anon-key로 직접 넘기세요.');
    process.exit(1);
  }
  ok('anon key 확보');

  // --project-ref를 직접 줘서 위의 프로젝트 선택/생성 분기를 아예 건너뛴
  // 경우(문서에 나온 사용법)에도 마찬가지로 비밀번호가 필요하다 — 안전망으로
  // 여기서 한 번 더 확인한다.
  if (!dbPassword) {
    if (!interactive) {
      fail('DB 비밀번호가 없습니다. --db-password로 넘기세요(대시보드 Settings → Database에서 확인/재설정).');
      process.exit(1);
    }
    dbPassword = await ask('데이터베이스 비밀번호 (모르면 대시보드 Settings → Database에서 재설정): ');
    if (!dbPassword) {
      fail('비밀번호 없이는 마이그레이션을 적용할 수 없습니다.');
      process.exit(1);
    }
  }

  // 3. 마이그레이션 ----------------------------------------------------------
  console.log(c.bold('\n\n데이터베이스 준비\n'));
  console.log('Supabase에 로그인 창이 열릴 수 있습니다.');

  // link/db push는 admin API가 아니라 실제 Postgres 접속이라 이 환경변수가
  // 없으면 CLI가 비밀번호를 못 찾고 pooler 연결에서 조용히 끊긴다.
  const supabaseEnv = { ...process.env, SUPABASE_DB_PASSWORD: dbPassword };

  const link = spawnSync('supabase', ['link', '--project-ref', projectRef], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: supabaseEnv,
  });
  if (link.status !== 0) {
    fail('supabase link 실패. 프로젝트 ref와 로그인 상태를 확인하세요.');
    process.exit(1);
  }

  const push = spawnSync('supabase', ['db', 'push', '--linked'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: supabaseEnv,
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

  // 5. 다음 단계 -------------------------------------------------------------
  // 명령을 한 줄씩 따로 찍는다 — &&로 이으면 Windows 기본 PowerShell(5.1)에서
  // 그대로 붙여넣었을 때 파싱 에러가 난다.
  console.log(c.bold('\n\n설치 완료. 다음 순서로 실행하세요.\n'));
  console.log(`  ${c.bold('1)')} 웹 앱 실행`);
  console.log(`     ${c.dim('cd web')}`);
  console.log(`     ${c.dim('npm install')}`);
  console.log(`     ${c.dim('npm run dev')}`);
  console.log(`     ${c.dim('http://localhost:3000 에서 본인 이메일로 로그인하세요.')}`);
  console.log(`     ${c.dim('가장 먼저 가입한 계정이 이 인스턴스의 소유자가 되고, 이후 가입은 막힙니다.')}`);
  console.log(`\n  ${c.bold('2)')} 러너 로그인`);
  console.log(`     ${c.dim('cd runner')}`);
  console.log(`     ${c.dim('npm install')}`);
  console.log(`     ${c.dim('npm run login')}`);
  console.log(`\n  ${c.bold('3)')} 러너 실행`);
  console.log(`     ${c.dim('cd runner')}`);
  console.log(`     ${c.dim('npm run start')}`);
  console.log(`     ${c.dim('웹 관제실 화면 아래 "러너" 목록에서 이 기기를 승인해야 작업을 받습니다.')}`);
  console.log(`\n자세한 내용: ${c.dim('docs/USER-GUIDE.md')}\n`);

  rl?.close();
}

main().catch((error) => {
  fail(error.message);
  rl?.close();
  process.exit(1);
});

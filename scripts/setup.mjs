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
//   node scripts/setup.mjs --owner-email me@example.com   # 계정도 자동 생성(비밀번호는 화면에 출력)

import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// db push/db query가 Postgres에 직접 접속하는 단계. 정상 네트워크에서는
// 1~3초면 끝나는데, 막힌 네트워크에서는 CLI가 내부적으로 최대 8번 재시도하며
// 몇 분씩 걸린다(SSAFY 실습실에서 실제로 겪음, 2026-09-03) — 그 시간을 다
// 기다리게 두지 않고, 이 시간 안에 안 끝나면 끊고 바로 다음 폴백으로 넘어간다.
const DB_CONNECT_TIMEOUT_MS = 20_000;

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

// db push가 처음 성공할 때 자동으로 만들어 주는 이력 테이블이다. HTTPS
// 폴백 경로는 db push를 거치지 않으므로, 이력을 기록하기 전에 이 스키마와
// 테이블이 없으면 우리가 직접 만들어야 한다(실제로 SSAFY 실습실에서
// "relation supabase_migrations.schema_migrations does not exist"로 걸림,
// 2026-09-03). 컬럼 구성은 실제 운영 프로젝트에서 그대로 읽어 옴.
const MIGRATION_HISTORY_TABLE_SQL =
  'create schema if not exists supabase_migrations;\n' +
  'create table if not exists supabase_migrations.schema_migrations (\n' +
  '  version text not null primary key,\n' +
  '  statements text[],\n' +
  '  name text\n' +
  ');\n';

function migrationFiles(root) {
  const dir = resolve(root, 'supabase/migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      return { file, path: resolve(dir, file), version: match?.[1], name: match?.[2] };
    });
}

// db push가 막힌 네트워크(학교·회사 방화벽으로 Postgres 5432/6543이 닫힌
// 경우 — SSAFY 실습실에서 실제로 겪음, 2026-09-03)에서 쓰는 우회 경로.
// `db query --linked`는 로컬에서 Postgres로 직접 붙는 대신 Management
// API(HTTPS)로 SQL을 실행한다 — 웹 브라우징이 되는 네트워크면 대개 이것도
// 된다. 파일마다 db push와 같은 이력 테이블에도 기록해 둔다 — 안 하면
// 나중에 정상 네트워크에서 db push를 다시 돌릴 때 이미 적용된 걸 또
// 적용하려다 충돌한다.
function applyMigrationsOverHttps(root) {
  const historyFile = resolve(root, '.setup-migration-history-init.sql');
  writeFileSync(historyFile, MIGRATION_HISTORY_TABLE_SQL, 'utf8');
  const initHistory = spawnSync('supabase', ['db', 'query', '--linked', '--file', historyFile], {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32', timeout: DB_CONNECT_TIMEOUT_MS,
  });
  try { unlinkSync(historyFile); } catch {}
  if (initHistory.status !== 0) return false;

  for (const { file, path, version, name } of migrationFiles(root)) {
    if (!version) continue;
    const apply = spawnSync('supabase', ['db', 'query', '--linked', '--file', path], {
      cwd: root, stdio: 'inherit', shell: process.platform === 'win32', timeout: DB_CONNECT_TIMEOUT_MS,
    });
    if (apply.status !== 0) return false;

    const sql = readFileSync(path, 'utf8').replace(/'/g, "''");
    const recordFile = resolve(root, `.setup-migration-record-${version}.sql`);
    writeFileSync(
      recordFile,
      `insert into supabase_migrations.schema_migrations (version, name, statements)\n` +
        `values ('${version}', '${name}', ARRAY['${sql}'])\n` +
        `on conflict (version) do nothing;\n`,
      'utf8',
    );
    const record = spawnSync('supabase', ['db', 'query', '--linked', '--file', recordFile], {
      cwd: root, stdio: 'inherit', shell: process.platform === 'win32', timeout: DB_CONNECT_TIMEOUT_MS,
    });
    try { unlinkSync(recordFile); } catch {}
    if (record.status !== 0) return false;

    ok(`${file} 적용`);
  }
  return true;
}

// 마지막 수단: CLI로는 아예 안 되는 네트워크일 때, 사람이 브라우저로 Supabase
// 대시보드 SQL Editor에 붙여넣을 수 있는 파일을 만든다. 대시보드는 HTTPS로만
// 접속하므로 Postgres 포트가 막혀 있어도 언제나 열려 있다. 이력 테이블
// 기록까지 같이 넣는다 — 안 하면 나중에 이 명령을 다시 실행했을 때 db
// push(또는 위 HTTPS 폴백)가 이미 만들어진 테이블을 또 만들려다 충돌한다.
function writeManualMigrationFile(root) {
  const header =
    '-- Career Atelier 전체 마이그레이션을 순서대로 이어붙인 파일.\n' +
    '-- CLI로 적용이 안 되는 네트워크에서, 이 파일 전체를 복사해 Supabase\n' +
    '-- 대시보드의 SQL Editor(브라우저)에 붙여넣고 실행하세요.\n\n' +
    MIGRATION_HISTORY_TABLE_SQL +
    '\n';
  const body = migrationFiles(root)
    .map(({ file, path, version, name }) => {
      const sql = readFileSync(path, 'utf8');
      const record = version
        ? `\ninsert into supabase_migrations.schema_migrations (version, name, statements)\n` +
          `values ('${version}', '${name}', ARRAY['${sql.replace(/'/g, "''")}'])\n` +
          `on conflict (version) do nothing;\n`
        : '';
      return `-- ===== ${file} =====\n${sql}${record}\n`;
    })
    .join('\n');
  const outPath = resolve(root, 'career-atelier-migrations-manual.sql');
  writeFileSync(outPath, header + body, 'utf8');
  return outPath;
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

  console.log(c.dim(`  (최대 ${DB_CONNECT_TIMEOUT_MS / 1000}초 기다립니다 — 막힌 네트워크면 CLI가 내부적으로 훨씬 오래 재시도하는데, 그건 기다리지 않습니다.)`));
  const push = spawnSync('supabase', ['db', 'push', '--linked'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: supabaseEnv,
    timeout: DB_CONNECT_TIMEOUT_MS,
  });

  if (push.status === 0) {
    ok('테이블·RLS·기본 프롬프트 적용 완료');
  } else {
    // db push는 Postgres에 직접 접속한다(pooler로 TCP) — 학교·회사 네트워크가
    // 이 포트를 막아 두면 여기서 조용히 타임아웃난다. db query --linked는
    // Management API(HTTPS)를 우선 쓰므로 같은 네트워크에서도 될 수 있다.
    warn('supabase db push 실패 — 직접 DB 연결(포트 5432/6543)이 막힌 네트워크일 수 있습니다.');
    console.log(c.dim('  HTTPS 경로로 다시 시도합니다...'));

    if (applyMigrationsOverHttps(root)) {
      ok('테이블·RLS·기본 프롬프트 적용 완료 (HTTPS 경로)');
    } else {
      const manualPath = writeManualMigrationFile(root);
      fail('두 경로 모두 실패했습니다 — 이 네트워크에서는 CLI로 적용할 수 없습니다.');
      console.log(c.dim(`  ${manualPath}의 전체 내용을 복사해 아래 주소의 SQL Editor에 붙여넣고 실행하세요:`));
      console.log(c.dim(`    https://supabase.com/dashboard/project/${projectRef}/sql/new`));
      console.log(c.dim('  실행 후 이 명령을 다시 실행하면 나머지 단계(Auth 설정·환경변수 파일)를 이어서 끝냅니다.'));
      process.exit(1);
    }
  }

  // 4. Auth 설정(이메일 템플릿·가입 제한 훅·SMTP) -----------------------------
  // config.toml의 [auth] 섹션은 db push로는 안 밀린다 — 별도 명령이 필요하다.
  // 이게 빠지면 이메일이 기본 Supabase 템플릿(형식이 달라 로그인 링크가 깨짐)
  // 으로 나가고, 단일 사용자 방어 훅도 원격에서 켜지지 않는다. env()로 참조하는
  // SITE_URL 등은 supabase/.env에 있어야 하는데, 갓 설치한 시점엔 Vercel 주소를
  // 아직 모를 수 있어 그 파일이 없으면 건너뛴다.
  const supabaseEnvFile = resolve(root, 'supabase/.env');
  if (existsSync(supabaseEnvFile)) {
    const configPush = spawnSync('supabase', ['config', 'push', '--project-ref', projectRef], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: supabaseEnv,
    });
    if (configPush.status !== 0) {
      warn('supabase config push 실패 — 이메일 템플릿과 가입 제한 훅이 원격에 반영되지 않았습니다.');
      console.log(c.dim('  supabase/.env 값을 확인한 뒤 다시 실행하세요: supabase config push'));
    } else {
      ok('이메일 템플릿·가입 제한·SMTP 설정 적용 완료');
    }
  } else {
    warn('supabase/.env가 없어 이메일 템플릿·가입 제한 훅·SMTP 설정을 원격에 반영하지 못했습니다.');
    console.log(c.dim('  지금은 Supabase 기본 이메일 서비스(시간당 2통)를 씁니다 — 첫 가입 1번은'));
    console.log(c.dim('  문제없지만 반복 테스트하면 금방 막힙니다. 더 넉넉한 한도가 필요하면'));
    console.log(c.dim('  Resend(무료, resend.com)에 가입해 API 키를 supabase/.env에 채우고 실행하세요:'));
    console.log(c.dim('    supabase config push'));
    warn('가입 제한 훅도 아직 반영 전입니다 — 다른 사람이 먼저 가입할 위험이 있으니 곧 실행하세요.');
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

  // 6. 소유자 계정 -------------------------------------------------------------
  // service_role은 여기서도 안 쓴다 — anon 키로 회원가입 API를 그대로 호출할
  // 뿐이고, before_user_created 훅이 이미 "첫 계정만 허용"을 강제하므로 이
  // 결과는 웹 폼으로 직접 가입하는 것과 동일하게 안전하다. AI 에이전트가
  // --yes로 무인 설치할 때는 사람 대신 이메일을 지어내면 안 되므로(AGENTS.md
  // "First sign-up ... this must be them"), --owner-email을 직접 받았거나
  // 사람이 지금 이 프롬프트에 답한 경우에만 진행한다.
  let ownerEmail = args.ownerEmail;
  if (!ownerEmail && interactive) {
    ownerEmail = await ask('\n웹 앱 로그인에 쓸 본인 이메일 (건너뛰려면 Enter): ');
  }

  let ownerAccountCreated = false;
  if (ownerEmail) {
    const ownerPassword = randomBytes(9).toString('base64url');
    const signupResult = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword, data: { generated_password: true } }),
    }).catch((error) => ({ ok: false, status: null, statusText: error.message }));

    if (signupResult.ok) {
      ownerAccountCreated = true;
      console.log(c.bold('\n계정을 만들었습니다.\n'));
      console.log(`  이메일:   ${ownerEmail}`);
      console.log(`  비밀번호: ${c.bold(ownerPassword)}`);
      console.log(c.dim('  로그인 후 반드시 비밀번호를 바꾸세요 — 대시보드에 안내 배너가 뜹니다.'));
    } else {
      const detail = await signupResult.json?.().catch(() => null);
      warn(`계정 자동 생성 실패(${detail?.msg ?? signupResult.statusText ?? signupResult.status}).`);
      console.log(c.dim('  웹에서 직접 "계정이 없으신가요? 만들기"로 가입하세요.'));
    }
  }

  // 7. 다음 단계 -------------------------------------------------------------
  // 명령을 한 줄씩 따로 찍는다 — &&로 이으면 Windows 기본 PowerShell(5.1)에서
  // 그대로 붙여넣었을 때 파싱 에러가 난다.
  console.log(c.bold('\n\n설치 완료. 다음 순서로 실행하세요.\n'));
  console.log(`  ${c.bold('1)')} 웹 앱 실행`);
  console.log(`     ${c.dim('cd web')}`);
  console.log(`     ${c.dim('npm install')}`);
  console.log(`     ${c.dim('npm run dev')}`);
  if (ownerAccountCreated) {
    console.log(c.dim('     http://localhost:3000 에서 위 이메일·비밀번호로 로그인하세요.'));
  } else {
    console.log(c.dim('     http://localhost:3000 에서 본인 이메일과 비밀번호로 계정을 만드세요.'));
    console.log(c.dim('     가장 먼저 가입한 계정이 이 인스턴스의 소유자가 되고, 이후 가입은 막힙니다.'));
  }
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

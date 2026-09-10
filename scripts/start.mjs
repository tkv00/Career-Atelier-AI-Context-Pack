import { existsSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { databaseIsCurrent, markDatabaseCurrent, projectRefFromUrl } from './lib/database-version.mjs';
import { createProcessGroup } from './lib/local-processes.mjs';
import { assertSameAuthProject } from './lib/auth-target.mjs';
import { printCareerBanner } from './lib/career-banner.mjs';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const version = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).version;
const releaseRepository = 'tkv00/Career-Atelier-AI-Context-Pack';
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(beta|rc)\.(0|[1-9]\d*))?$/;

export function dependencyFingerprint(directory) {
  return createHash('sha256')
    .update(readFileSync(resolve(directory, 'package.json')))
    .update(readFileSync(resolve(directory, 'package-lock.json')))
    .update(`${process.versions.node}:${process.platform}:${process.arch}`)
    .digest('hex');
}

export async function ensureDependencies(directory, run, npmPath = process.env.npm_execpath) {
  const fingerprint = dependencyFingerprint(directory);
  const marker = resolve(directory, 'node_modules/.career-atelier-dependencies');
  const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  const installed = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
    .every(name => existsSync(resolve(directory, 'node_modules', name, 'package.json')));
  if (installed && existsSync(marker) && readFileSync(marker, 'utf8') === fingerprint) return;
  if (!npmPath || !existsSync(npmPath)) throw new Error('저장소 폴더에서 npm start로 실행하세요.');
  console.log(`\n${manifest.name} 패키지를 준비합니다. 처음 실행하거나 의존성이 바뀐 경우에만 설치합니다.`);
  await run([npmPath, 'ci', '--include=dev', '--no-audit', '--no-fund'], { cwd: directory });
  writeFileSync(marker, fingerprint);
}

export function hasConfiguration(root, mode, environment = process.env) {
  const parts = mode === 'web' ? ['web'] : mode === 'all' ? ['web', 'runner'] : ['runner'];
  return parts.every(part => {
    const path = resolve(root, part, part === 'web' ? '.env.local' : '.env');
    const values = { ...(existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {}), ...environment };
    const prefix = part === 'web' ? 'NEXT_PUBLIC_' : '';
    return Boolean(values[`${prefix}SUPABASE_URL`] && values[`${prefix}SUPABASE_ANON_KEY`]);
  });
}

function configuredSupabaseUrl(root, mode, environment = process.env) {
  const part = mode === 'web' ? 'web' : 'runner';
  const path = resolve(root, part, part === 'web' ? '.env.local' : '.env');
  const values = { ...(existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {}), ...environment };
  return values[part === 'web' ? 'NEXT_PUBLIC_SUPABASE_URL' : 'SUPABASE_URL'];
}

export async function ensureDatabaseCurrent(root, mode, run, environment = process.env) {
  if (mode === 'all') assertSameAuthProject(configuredSupabaseUrl(root, 'runner', environment), configuredSupabaseUrl(root, 'web', environment));
  const projectRef = projectRefFromUrl(configuredSupabaseUrl(root, mode, environment));
  if (databaseIsCurrent(root, projectRef)) return false;
  console.log('\n새 버전의 데이터베이스 변경 사항을 확인합니다.');
  await run([resolve(root, 'scripts/setup.mjs'), '--project-ref', projectRef, '--migrate-only'], { cwd: root });
  // setup도 기록하지만 테스트 대역과 비정상 종료 직전의 성공을 같은 기준으로 남긴다.
  markDatabaseCurrent(root, projectRef);
  return true;
}

export async function checkPort(port) {
  await new Promise((resolveReady, reject) => {
    const probe = createServer();
    probe.once('error', () => reject(new Error(`포트 ${port}를 사용 중입니다. 기존 웹 실행을 종료한 뒤 npm start를 다시 실행하세요.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolveReady));
  });
}

export async function waitForWeb(url, service, signal, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let exited = false;
  void service.done.then(() => { exited = true; });
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    if (exited) throw new Error('웹 서버가 준비되기 전에 종료됐습니다. 위의 오류를 확인하세요.');
    try {
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch { /* 첫 컴파일 중에는 연결이 늦을 수 있어 다음 확인까지 기다린다. */ }
    await delay(300, undefined, { signal });
  }
  throw new Error('웹 서버 준비가 시간 초과됐습니다. 위의 오류를 확인한 뒤 npm start를 다시 실행하세요.');
}

function parseVersion(version) {
  const match = versionPattern.exec(version.startsWith('v') ? version.slice(1) : version);
  if (!match) return null;
  const preType = match[4];
  return [
    BigInt(match[1]),
    BigInt(match[2]),
    BigInt(match[3]),
    BigInt(preType === 'beta' ? 0 : preType === 'rc' ? 1 : 2),
    BigInt(match[5] ?? 0),
  ];
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

function formatReleaseMessage(tag) {
  return [
    `A newer release (${tag}) is available.`,
    'To install:',
    '  1) git fetch --all --tags',
    `  2) git checkout tags/${tag}`,
    '  3) npm install',
    '  4) node scripts/setup.mjs --yes',
    '  5) npm run release:update -- --yes --deploy',
    '',
    '`npm run release:update -- --yes --deploy` will also run Supabase migration and Vercel deployment automatically.',
    '',
  ].join('\n');
}

async function checkForLatestRelease(root) {
  let currentVersionString;
  try {
    currentVersionString = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
  } catch {
    return;
  }
  const currentVersion = parseVersion(currentVersionString);
  if (!currentVersion) return;
  let response;
  try {
    response = await fetch(`https://api.github.com/repos/${releaseRepository}/releases/latest`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'career-atelier-start',
      },
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    return;
  }
  if (!response.ok) return;
  let latestTag;
  try {
    ({ tag_name: latestTag } = await response.json());
  } catch {
    return;
  }
  if (typeof latestTag !== 'string') return;
  const latestVersion = parseVersion(latestTag);
  if (!latestVersion || compareVersions(currentVersion, latestVersion) >= 0) return;
  console.log('\n' + formatReleaseMessage(latestTag));
}

export async function main(argv = process.argv.slice(2), root = projectRoot) {
  const mode = argv[0] ?? 'all';
  if (mode === '--help' || mode === '-h') {
    console.log('npm start         웹 + 러너 실행 (Windows / macOS / Linux)\nnpm run runner    배포된 웹을 사용할 때 러너만 실행\nnpm run web       웹만 실행\nnpm run login     서비스 계정 다시 로그인\nnpm run doctor    연결 진단\n종료: Ctrl+C');
    return;
  }
  if (argv.length > 1 || !['all', 'web', 'runner', 'login', 'doctor'].includes(mode)) throw new Error('알 수 없는 실행 옵션입니다. npm start -- --help를 확인하세요.');
  const [major, minor] = process.versions.node.split('.').map(Number);
  await checkForLatestRelease(root);
  if (major < 22 || (major === 22 && minor < 13)) throw new Error('Node.js 22.13 이상을 설치한 뒤 npm start를 실행하세요.');
  printCareerBanner({ version, mode });
  const group = createProcessGroup();
  const onSignal = () => { void group.stop(); };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    if (!hasConfiguration(root, mode)) {
      if (!process.stdin.isTTY) throw new Error('최초 설정이 필요합니다. 본인 터미널에서 npm start를 실행해 Supabase 로그인과 프로젝트 선택을 마치세요.');
      console.log('처음 실행합니다. Supabase 설정을 안내합니다.');
      await group.run([resolve(root, 'scripts/setup.mjs')], { cwd: root });
      if (!hasConfiguration(root, mode)) throw new Error('설정이 완성되지 않았습니다. npm run setup으로 확인하세요.');
    }
    if (['all', 'web', 'runner'].includes(mode)) {
      await ensureDatabaseCurrent(root, mode, group.run);
    }
    const directories = mode === 'all' ? ['web', 'runner'] : mode === 'web' ? ['web'] : ['runner'];
    for (const directory of directories) await ensureDependencies(resolve(root, directory), group.run);
    if (mode !== 'web') {
      // 문서 변환기는 Node 패키지와 별도인 Python 가상환경에 고정한다. 시스템
      // Python을 오염시키지 않고, requirements가 바뀔 때만 다시 설치한다.
      await group.run([resolve(root, 'scripts/install-markitdown.mjs')], { cwd: root });
    }
    group.signal.throwIfAborted();

    const services = [];
    if (mode === 'all' || mode === 'web') {
      const port = Number(process.env.PORT || 3000);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT는 1~65535 사이의 정수여야 합니다.');
      await checkPort(port);
      const web = group.start([resolve(root, 'web/node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: resolve(root, 'web'), stdio: ['ignore', 'inherit', 'inherit'] });
      services.push(web);
      const url = `http://localhost:${port}`;
      console.log(`\n웹 준비 중: ${url}\n처음이면 브라우저에서 본인 계정을 만드세요. 종료: Ctrl+C`);
      await waitForWeb(`http://127.0.0.1:${port}/login`, web, group.signal);
      console.log(`\n웹 준비 완료: ${url}`);
      if (mode === 'all') console.log('웹 가입을 마쳤다면 아래 로그인에 같은 이메일·비밀번호를 입력하세요.');
    }
    if (mode !== 'web') {
      const command = ['login', 'doctor'].includes(mode) ? mode : 'start';
      const args = [resolve(root, 'runner/index.mjs'), command];
      if (command === 'start') args.push('--login-if-needed');
      services.push(group.start(args, { cwd: resolve(root, 'runner') }));
    }
    const result = await Promise.race([
      ...services.map(service => service.done),
      new Promise(resolveStopped => {
        if (group.signal.aborted) resolveStopped({ code: 0 });
        else group.signal.addEventListener('abort', () => resolveStopped({ code: 0 }), { once: true });
      }),
    ]);
    if (!group.signal.aborted && result.code !== 0) throw result.error ?? new Error(`서비스가 종료됐습니다 (코드 ${result.code}).`);
  } catch (error) {
    if (!group.signal.aborted) throw error;
  } finally {
    await group.stop();
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}

// macOS /var 별칭이나 사용자의 폴더 링크도 같은 진입점으로 인식해야 한다.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { dependencyFingerprint, ensureDependencies, hasConfiguration, checkPort, waitForWeb } from '../start.mjs';
import { createProcessGroup } from '../lib/local-processes.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'career atelier 실행 '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function put(root, path, value) {
  const target = resolve(root, path);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, value);
}

async function until(predicate, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Condition timed out');
    await delay(50);
  }
}

test('launcher also executes through a linked repository folder', t => {
  const root = fixture(t);
  const alias = resolve(root, 'linked scripts');
  symlinkSync(fileURLToPath(new URL('../', import.meta.url)), alias, 'junction');
  const child = spawnSync(process.execPath, [resolve(alias, 'start.mjs'), '--help'], { encoding: 'utf8', windowsHide: true });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /npm start/);
});

test('dependency setup reuses successful installs and retries changes or failures', async t => {
  const root = fixture(t);
  put(root, 'package.json', JSON.stringify({ name: 'fixture', dependencies: { demo: '1' } }));
  put(root, 'package-lock.json', '{}');
  let calls = 0;
  const install = async (args, options) => {
    calls++;
    assert.deepEqual(args.slice(1), ['ci', '--include=dev', '--no-audit', '--no-fund']);
    assert.equal(options.cwd, root);
    put(root, 'node_modules/demo/package.json', '{}');
  };
  await ensureDependencies(root, install, process.execPath);
  await ensureDependencies(root, install, process.execPath);
  assert.equal(calls, 1);
  put(root, 'package-lock.json', '{"changed":true}');
  const before = readFileSync(resolve(root, 'node_modules/.career-atelier-dependencies'), 'utf8');
  await assert.rejects(ensureDependencies(root, async () => { throw new Error('offline'); }, process.execPath), /offline/);
  assert.equal(readFileSync(resolve(root, 'node_modules/.career-atelier-dependencies'), 'utf8'), before);
  await ensureDependencies(root, install, process.execPath);
  rmSync(resolve(root, 'node_modules/demo/package.json'));
  await ensureDependencies(root, install, process.execPath);
  assert.equal(calls, 3);
});

test('configuration checks only the requested components and accepts environment values', t => {
  const root = fixture(t);
  put(root, 'web/.env.local', 'NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=example\n');
  assert.equal(hasConfiguration(root, 'web', {}), true);
  assert.equal(hasConfiguration(root, 'all', {}), false);
  assert.equal(hasConfiguration(root, 'runner', { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'example' }), true);
});

test('web readiness requires a successful response and detects startup failure', async t => {
  let status = 503;
  const server = createServer((_, res) => { res.writeHead(status); res.end('fixture'); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = server.address().port;
  await assert.rejects(checkPort(port), /포트/);
  const url = `http://127.0.0.1:${port}/login`;
  const service = { done: new Promise(() => {}) };
  await assert.rejects(waitForWeb(url, service, new AbortController().signal, 50), /시간 초과/);
  status = 200;
  await waitForWeb(url, service, new AbortController().signal);
  await assert.rejects(waitForWeb('http://127.0.0.1:1', { done: Promise.resolve({ code: 1 }) }, new AbortController().signal), /종료/);
});

test('process group stops its child and grandchild and can be stopped twice', { timeout: 20000 }, async t => {
  const root = fixture(t);
  const group = createProcessGroup();
  t.after(() => group.stop());
  put(root, 'grandchild.mjs', "import { createServer } from 'node:http'; const server = createServer(); server.listen(0, '127.0.0.1', () => console.log(server.address().port));");
  put(root, 'child.mjs', `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const child = spawn(process.execPath, [${JSON.stringify(resolve(root, 'grandchild.mjs'))}], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
child.stdout.once('data', port => writeFileSync(${JSON.stringify(resolve(root, 'port'))}, port));
setInterval(() => {}, 1000);`);
  const service = group.start([resolve(root, 'child.mjs')], { stdio: 'ignore' });
  await until(() => existsSync(resolve(root, 'port')));
  const port = Number(readFileSync(resolve(root, 'port'), 'utf8'));
  await assert.rejects(checkPort(port), /포트/);
  await group.stop();
  await group.stop();
  await service.done;
  await checkPort(port);
  assert.throws(() => group.start([]), /종료/);
});

for (const scenario of ['runner failure', 'interrupt']) {
test(`combined launcher starts web before runner and cleans up on ${scenario}`, { timeout: 20000 }, async t => {
  const root = fixture(t);
  for (const part of ['web', 'runner']) {
    put(root, `${part}/package.json`, JSON.stringify({ name: part, type: 'module' }));
    put(root, `${part}/package-lock.json`, '{}');
    put(root, `${part}/node_modules/.career-atelier-dependencies`, dependencyFingerprint(resolve(root, part)));
  }
  put(root, 'web/.env.local', 'NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=example\n');
  put(root, 'runner/.env', 'SUPABASE_URL=https://example.supabase.co\nSUPABASE_ANON_KEY=example\n');
  put(root, 'web/node_modules/next/package.json', '{"type":"module"}');
  put(root, 'web/node_modules/next/dist/bin/next', `import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
const server = createServer((_, res) => { writeFileSync(${JSON.stringify(resolve(root, 'web-ready'))}, String(process.pid)); res.end('ready'); });
server.listen(Number(process.argv.at(-1)), '127.0.0.1');`);
  put(root, 'runner/index.mjs', `import { existsSync, writeFileSync } from 'node:fs';
if (!existsSync(${JSON.stringify(resolve(root, 'web-ready'))})) process.exit(88);
writeFileSync(${JSON.stringify(resolve(root, 'runner-args'))}, JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()}));
${scenario === 'runner failure' ? 'process.exit(7);' : 'setInterval(() => {}, 1000);'}`);
  put(root, 'launch.mjs', `import { main } from ${JSON.stringify(new URL('../start.mjs', import.meta.url).href)};
process.on('message', () => process.emit('SIGINT'));
main([], ${JSON.stringify(root)}).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => process.disconnect());`);
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  const child = spawn(process.execPath, [resolve(root, 'launch.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = once(child, 'exit');
  if (scenario === 'interrupt') {
    await until(() => existsSync(resolve(root, 'runner-args')));
    child.send('interrupt');
  }
  const [code] = await exited;
  assert.equal(code, scenario === 'runner failure' ? 1 : 0, output);
  if (scenario === 'runner failure') assert.match(output, /코드 7/);
  const runner = JSON.parse(readFileSync(resolve(root, 'runner-args'), 'utf8'));
  assert.deepEqual(runner.args, ['start', '--login-if-needed']);
  assert.equal(realpathSync(runner.cwd), realpathSync(resolve(root, 'runner')));
  await checkPort(port);
});
}

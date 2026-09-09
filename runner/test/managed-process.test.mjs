import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { spawnManaged, terminateManaged, stopManagedProcesses } from '../lib/managed-process.mjs';
import { runProvider } from '../execute.mjs';

const fixture = fileURLToPath(new URL('../fixtures/process-tree.cjs', import.meta.url));
const db = { from: () => ({ insert: async () => ({ error: null }) }) };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function tree(t) {
  const child = spawnManaged(process.execPath, [fixture], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => terminateManaged(child));
  const closed = once(child, 'close');
  let text = '';
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.on('data', chunk => {
      text += chunk;
      if (text.includes('\n')) resolve(JSON.parse(text.split('\n')[0]).pid);
    });
  });
  return { child, closed, grandchild: await ready };
}

async function assertGone(pid) {
  for (let i = 0; i < 50; i++) {
    try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') return; throw error; }
    await delay(20);
  }
  assert.fail(`child ${pid} survived termination`);
}

test('termination kills a SIGTERM-resistant child and grandchild and is idempotent', { timeout: 10000 }, async t => {
  const { child, closed, grandchild } = await tree(t);
  await Promise.all([terminateManaged(child), terminateManaged(child)]);
  await closed;
  await assertGone(grandchild);
  await stopManagedProcesses();
});

test('provider timeout invokes tree cleanup rather than reporting successful output', { timeout: 10000 }, async t => {
  const { child, closed, grandchild } = await tree(t);
  let expire;
  const result = runProvider({ supabase: db, provider: 'codex', ownerId: 'owner', runId: 'run' }, {
    spawnProvider: () => child,
    scheduleTimeout: (callback, ms) => { assert.equal(ms, 15 * 60 * 1000); expire = callback; },
  });
  expire();
  assert.equal((await result).status, 'failed');
  await closed;
  await assertGone(grandchild);
});

test('runner shutdown waits for all registered CLI trees', { timeout: 10000 }, async t => {
  const first = await tree(t);
  const second = await tree(t);
  await stopManagedProcesses();
  await Promise.all([first.closed, second.closed]);
  await assertGone(first.grandchild);
  await assertGone(second.grandchild);
});

test('Gemini ERROR is a failed run even when the CLI exits zero with response text', async () => {
  const result = await runProvider({ supabase: db, provider: 'gemini', ownerId: 'owner', runId: 'run' }, {
    spawnProvider: () => spawnManaged(process.execPath, ['-e', `console.log(JSON.stringify({event:'result',result:{status:'ERROR',response:'not a result',error:'fixture failure'}}))`], { stdio: ['ignore', 'pipe', 'pipe'] }),
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.output, '');
  assert.match(result.error, /fixture failure/);
});

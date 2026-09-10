import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { applyMigrations, migrationFiles, inspectMigrations } from '../lib/setup-migrations.mjs';
import { createCliManagementQuery, createManagementQuery, supportsSupabaseDbQuery, runCliQuery } from '../lib/supabase-management.mjs';
import { loadManagementToken } from '../lib/supabase-token.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const files = migrationFiles(root);
const token = 'sbp_' + 'a'.repeat(40);
const projectRef = 'a'.repeat(20);

test('CLI receives SQL and EOF before returning JSON', async () => {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  let input = '';
  child.stdin.on('data', chunk => { input += chunk; });
  child.stdin.on('finish', () => {
    child.stdout.write('[{"ok":1}]');
    child.emit('close', 0);
  });
  const query = createCliManagementQuery({ projectRef, run: (command, argv, options) => runCliQuery(command, argv, options, { launch: () => child }) });
  assert.deepEqual(await query('select 1'), [{ ok: 1 }]);
  assert.equal(input, 'select 1');
});

test('Windows CLI timeout settles even when the process never emits close', async () => {
  const child = new EventEmitter();
  child.pid = 12345;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  let detached = false;
  child.unref = () => { detached = true; };
  const kills = [];
  const query = createCliManagementQuery({ projectRef, platform: 'win32', timeoutMs: 20,
    run: (command, argv, options) => runCliQuery(command, argv, options, {
      launch: () => child,
      killTree: (command, argv) => {
        kills.push({ command, argv });
        const killer = new EventEmitter();
        killer.unref = () => {};
        return killer;
      },
    }),
  });
  await assert.rejects(query('select 1'), /제한을 초과/);
  assert.deepEqual(kills, [{ command: 'taskkill', argv: ['/pid', '12345', '/t', '/f'] }]);
  assert.equal(detached, true);
  assert.ok(child.stdin.destroyed && child.stdout.destroyed && child.stderr.destroyed);
});

test('every application table grants authenticated access before RLS filtering', () => {
  const sql = files.map(file => file.sql).join('\n');
  const grants = [...sql.matchAll(/grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table([\s\S]*?)to\s+authenticated\s*;/gi)]
    .map(match => match[1]).join('\n');
  const tables = [...sql.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+(?:([a-z_]+)\.)?([a-z_]+)/gi)]
    .filter(match => !match[1] || match[1] === 'public')
    .map(match => match[2])
    .filter(name => name !== 'schema_migrations');
  for (const table of tables) assert.match(grants, new RegExp(`(?:public\\.)?${table}\\b`), `${table} 권한이 없습니다.`);
  assert.match(sql, /grant\s+usage,\s*select\s+on\s+sequence\s+public\.run_events_id_seq\s+to\s+authenticated/i);
});

test('HTTPS request uses only the official API and returns rows', async () => {
  const query = createManagementQuery({ projectRef, token, fetchImpl: async (url, options) => {
    assert.equal(url, `https://api.supabase.com/v1/projects/${projectRef}/database/query`);
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { query: 'select 1', read_only: true });
    assert.ok(options.signal instanceof AbortSignal);
    return new Response('[{"ok":1}]', { status: 201 });
  } });
  assert.deepEqual(await query('select 1', { readOnly: true }), [{ ok: 1 }]);
});

test('CLI query uses each platform shell contract without exposing SQL in argv', async () => {
  for (const [platform, shell] of [['linux', false], ['win32', true]]) {
    const calls = [];
    const run = (command, argv, options) => {
      calls.push({ command, argv, options });
      return { status: 0, stdout: '[{"ok":1}]', stderr: '' };
    };
    assert.equal(supportsSupabaseDbQuery({ run, platform }), true);
    const query = createCliManagementQuery({ projectRef, run, platform });
    assert.deepEqual(await query('select 1', { readOnly: true }), [{ ok: 1 }]);
    assert.deepEqual(calls[0].argv, ['db', 'query', '--help']);
    assert.deepEqual(calls[1].argv, [
      'db', 'query', '--linked', '--project-ref', projectRef,
      '--output', 'json', '--agent', 'no',
    ]);
    assert.equal(calls[0].options.shell, shell);
    assert.equal(calls[1].options.shell, shell);
    assert.equal(calls[1].options.input, 'select 1');
    assert.ok(!calls[1].argv.includes('select 1'));
  }
});

test('CLI query errors redact credentials and malformed output is rejected', async () => {
  const secret = 'sbp_' + 'b'.repeat(40);
  const failed = createCliManagementQuery({ projectRef, run: () => ({ status: 1, stdout: '', stderr: `failure ${secret}` }) });
  await assert.rejects(failed('select 1'), (error) => {
    assert.ok(!error.message.includes(secret));
    assert.match(error.message, /다시 실행/);
    return true;
  });
  const malformed = createCliManagementQuery({ projectRef, run: () => ({ status: 0, stdout: 'not-json', stderr: '' }) });
  await assert.rejects(malformed('select 1'), /JSON/);
  assert.equal(supportsSupabaseDbQuery({ run: () => ({ status: 1 }) }), false);
});

test('HTTP errors redact credentials and do not retry writes', async () => {
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    const query = createManagementQuery({ projectRef, token, fetchImpl: async () => {
      calls++;
      return new Response(`error ${token}`, { status });
    } });
    await assert.rejects(query('create table example(id int)'), (error) => {
      assert.match(error.message, new RegExp(`HTTP ${status}`));
      assert.ok(!error.message.includes(token));
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('lost responses stop and instruct history verification on rerun', async () => {
  const query = createManagementQuery({ projectRef, token, fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } });
  await assert.rejects(query('write'), /재실행 시 이력/);
});

test('malformed success responses are rejected', async () => {
  const query = createManagementQuery({ projectRef, token, fetchImpl: async () => new Response('<html>proxy</html>') });
  await assert.rejects(query('select 1'), /JSON/);
  assert.throws(() => createManagementQuery({ projectRef: '../elsewhere', token }), /ref/);
});

test('recorded migrations are skipped without writes', async () => {
  let calls = 0;
  const result = await applyMigrations({ root, query: async (sql, options) => {
    assert.equal(options?.readOnly, true);
    calls++;
    if (sql.includes('to_regclass')) return [{ history_exists: true, has_tables: true }];
    return files.map(({ version, name }) => ({ version, name }));
  } });
  assert.deepEqual(result, { applied: 0, skipped: files.length });
  assert.equal(calls, 3);
});

test('existing tables without history stop before any writes', async () => {
  let calls = 0;
  await assert.rejects(applyMigrations({ root, query: async (sql, options) => {
    calls++;
    assert.equal(options?.readOnly, true);
    return [{ history_exists: false, has_tables: true }];
  } }), /적용 이력이 없습니다/);
  assert.equal(calls, 1);
});

test('history gaps, foreign versions, names, and malformed rows fail closed', async () => {
  for (const history of [[files[1]], [{ version: '9999' }], [...files, { version: '9999', name: 'newer_schema' }], [{ version: files[0].version, name: 'foreign' }], [null]]) {
    await assert.rejects(inspectMigrations({ root, query: async (sql, options) => {
      assert.equal(options?.readOnly, true);
      return sql.includes('to_regclass') ? [{ history_exists: true, has_tables: true }] : history;
    } }), /이력/);
  }
});

test('accepts the historical source-imports name for the renumbered 0031 migration', async () => {
  const history = files.map(({ version, name }) => ({
    version,
    name: version === '0031' ? 'source_imports' : name,
  }));
  const result = await inspectMigrations({ root, query: async (sql, options) => {
    assert.equal(options?.readOnly, true);
    return sql.includes('to_regclass') ? [{ history_exists: true, has_tables: true }] : history;
  } });
  assert.equal(result.history[30].name, 'source_imports');
});

test('after an ambiguous write failure, the next run resumes from committed history', async () => {
  const history = files.slice(0, files.length - 2);
  let loseResponse = true;
  let writes = 0;
  const query = async (sql, options) => {
    if (options?.readOnly) {
      if (sql.includes('to_regclass')) return [{ history_exists: true, has_tables: true }];
      return history.map(({ version, name }) => ({ version, name }));
    }
    writes++;
    history.push(files[history.length]);
    if (loseResponse) { loseResponse = false; throw new Error('response lost after commit'); }
    return [];
  };
  await assert.rejects(applyMigrations({ root, query }), /response lost/);
  assert.equal(writes, 1);
  const result = await applyMigrations({ root, query });
  assert.equal(writes, 2);
  assert.equal(result.applied, 1);
});

test('environment token takes precedence and never invokes the keyring', () => {
  assert.equal(loadManagementToken({ env: { SUPABASE_ACCESS_TOKEN: token }, read: () => '', run: () => { throw new Error('must not run'); } }), token);
  assert.throws(() => loadManagementToken({ env: { SUPABASE_ACCESS_TOKEN: 'eyJ-not-a-management-token' }, read: () => '' }), /토큰 형식/);
});

test('credential lookup uses captured output, no shell, and CLI fallback file', () => {
  assert.equal(loadManagementToken({ env: {}, platform: 'win32', read: () => '', run: (command, args, options) => {
    assert.equal(command, 'powershell.exe');
    assert.ok(args.includes('supabase'));
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    assert.ok(!options.shell);
    assert.equal(options.windowsHide, true);
    return { status: 0, stdout: token };
  } }), token);
  assert.equal(loadManagementToken({ env: { SUPABASE_NO_KEYRING: '1' }, read: (path) => path.endsWith('access-token') ? token : '' }), token);
  assert.throws(() => loadManagementToken({ env: { SUPABASE_PROFILE: 'supabase-staging' }, read: () => '' }), /공식 클라우드/);
});
